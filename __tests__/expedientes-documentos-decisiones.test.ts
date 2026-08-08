import { describe, expect, it, vi } from 'vitest';
import type { Transaction, Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import {
  validarYPrepararArchivoDocumento,
  validarRequisitoIdContraDefinicion,
  planSubirDocumento,
  MAX_DOCUMENTO_SIZE_BYTES,
} from '@/lib/server/expedientes-documentos';
import { planActualizarContexto, esErrorExpediente } from '@/lib/server/expedientes-licencias';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import { formatearIdVersion } from '@/lib/server/expedientes-documentos-tipos';

/* Bloque A·A2 — decisiones puras de documentos de expediente. */

const ACTOR = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO' };
const AHORA = new Date(2026, 7, 10, 12, 0, 0, 0);

// Firma PDF real (%PDF-) — pasa verificarMagicBytes.
const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 0x20)]);

function err(x: unknown) {
  if (!esErrorExpediente(x)) throw new Error('esperaba error');
  return x;
}

describe('validarYPrepararArchivoDocumento', () => {
  it('PDF válido → prepara buffer, filename saneado y hash sha256 correcto', () => {
    const resultado = validarYPrepararArchivoDocumento({
      buffer: PDF_BUFFER, mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'Certificado Tradición.pdf',
    });
    expect(esErrorExpediente(resultado)).toBe(false);
    if (!esErrorExpediente(resultado)) {
      expect(resultado.hashSha256).toBe(createHash('sha256').update(PDF_BUFFER).digest('hex'));
      expect(resultado.hashSha256).toMatch(/^[0-9a-f]{64}$/); // hex minúscula
      expect(resultado.mimeType).toBe('application/pdf');
      expect(resultado.tamanioBytes).toBe(PDF_BUFFER.length);
    }
  });

  it('buffer vacío → 400', () => {
    expect(err(validarYPrepararArchivoDocumento({ buffer: Buffer.alloc(0), mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'x.pdf' })).status).toBe(400);
  });

  it('supera MAX_DOCUMENTO_SIZE_BYTES (10MB) → 400', () => {
    const grande = Buffer.alloc(MAX_DOCUMENTO_SIZE_BYTES + 1);
    expect(err(validarYPrepararArchivoDocumento({ buffer: grande, mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'x.pdf' })).status).toBe(400);
  });

  it('MIME no permitido (fuera de la allowlist) → 400', () => {
    expect(err(validarYPrepararArchivoDocumento({ buffer: PDF_BUFFER, mimeTypeDeclarado: 'application/x-msdownload', nombreOriginal: 'x.exe' })).status).toBe(400);
  });

  it('MIME declarado PDF pero bytes NO son un PDF real (magic-bytes falla) → 400', () => {
    const bytesFalsos = Buffer.from('esto no es un pdf');
    expect(err(validarYPrepararArchivoDocumento({ buffer: bytesFalsos, mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'x.pdf' })).status).toBe(400);
  });

  it('FAIL-CLOSED: el hash SIEMPRE se calcula server-side sobre el buffer — no hay ningún parámetro para inyectarlo desde el cliente', () => {
    const resultado = validarYPrepararArchivoDocumento({ buffer: PDF_BUFFER, mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'x.pdf' });
    if (!esErrorExpediente(resultado)) {
      // Si se manipulan los bytes, el hash cambia — no hay forma de que el
      // caller "pase" un hash distinto del que corresponde al buffer real.
      const otroBuffer = Buffer.concat([PDF_BUFFER, Buffer.from('extra')]);
      const otroResultado = validarYPrepararArchivoDocumento({ buffer: otroBuffer, mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'x.pdf' });
      expect(esErrorExpediente(otroResultado)).toBe(false);
      if (!esErrorExpediente(otroResultado)) {
        expect(otroResultado.hashSha256).not.toBe(resultado.hashSha256);
      }
    }
  });
});

describe('validarRequisitoIdContraDefinicion', () => {
  it('requisitoId existente en la Definición → null (sin error)', () => {
    expect(validarRequisitoIdContraDefinicion('certificado-tradicion-libertad', DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL)).toBeNull();
  });
  it('requisitoId ausente/undefined → null (documento sin requisito enlazado, válido)', () => {
    expect(validarRequisitoIdContraDefinicion(undefined, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL)).toBeNull();
  });
  it('requisitoId inexistente en la Definición → 400', () => {
    const resultado = validarRequisitoIdContraDefinicion('requisito-inventado', DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL);
    expect(resultado?.status).toBe(400);
  });
});

describe('planActualizarContexto', () => {
  it('clave declarada, tipo correcto → aplica el merge sobre el contexto actual', () => {
    const plan = planActualizarContexto({ esApoderado: false }, { categoriaComplejidad: 'BAJA' }, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL);
    expect(esErrorExpediente(plan)).toBe(false);
    if (!esErrorExpediente(plan)) {
      expect(plan.contexto).toEqual({ esApoderado: false, categoriaComplejidad: 'BAJA' });
    }
  });

  it('clave NO declarada en clavesContexto → 400 citando el catálogo', () => {
    const resultado = err(planActualizarContexto({}, { claveInventada: true }, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL));
    expect(resultado.status).toBe(400);
    expect(resultado.mensaje).toContain('esApoderado'); // cita el catálogo de claves válidas
  });

  it('tipo de valor incoherente con la clave declarada → 400', () => {
    const resultado = err(planActualizarContexto({}, { esApoderado: 'si' }, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL));
    expect(resultado.status).toBe(400);
  });

  it('valor fuera del dominio declarado → 400', () => {
    const resultado = err(planActualizarContexto({}, { categoriaComplejidad: 'INVENTADA' }, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL));
    expect(resultado.status).toBe(400);
  });

  it('body vacío → 400 (nada que actualizar)', () => {
    expect(err(planActualizarContexto({}, {}, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL)).status).toBe(400);
  });

  it('todo o nada: si UNA clave es inválida, ninguna se aplica (sin plan parcial)', () => {
    const resultado = planActualizarContexto({}, { esApoderado: true, claveInventada: 1 }, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL);
    expect(esErrorExpediente(resultado)).toBe(true);
  });
});

/* ── Harness de dobles para planSubirDocumento (mismo patrón que consecutivo-legal.test.ts) ── */

function fakeDb(datos: Record<string, Record<string, unknown>> = {}): { db: Firestore; tx: Transaction; creados: string[] } {
  const creados: string[] = [];
  const colecciones = new Map<string, { doc: (id?: string) => unknown }>();

  function docRef(path: string): { id: string; path: string; collection: (s: string) => unknown } {
    const id = path.split('/').pop()!;
    return {
      id,
      path,
      collection: (sub: string) => collectionRef(`${path}/${sub}`),
    };
  }
  function collectionRef(basePath: string) {
    let contador = 0;
    return {
      doc: (id?: string) => docRef(`${basePath}/${id ?? `auto-${basePath}-${contador++}`}`),
    };
  }
  void colecciones;

  const db = {
    collection: (name: string) => collectionRef(name),
  } as unknown as Firestore;

  const tx = {
    get: vi.fn(async (ref: { path: string }) => ({
      exists: datos[ref.path] !== undefined,
      data: () => datos[ref.path],
    })),
    create: vi.fn((ref: { path: string }) => { creados.push(ref.path); }),
    update: vi.fn(() => {}),
  } as unknown as Transaction;

  return { db, tx, creados };
}

describe('planSubirDocumento — documento NUEVO (v0001)', () => {
  it('sin requisitoId: crea documento lógico nuevo con versión v0001', async () => {
    const { db, tx, creados } = fakeDb();
    const archivo = validarYPrepararArchivoDocumento({ buffer: PDF_BUFFER, mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'anexo.pdf' });
    if (esErrorExpediente(archivo)) throw new Error('setup inválido');

    const resultado = await planSubirDocumento(tx, db, 'exp-1', 'SEC_PLANEACION', [], { archivo }, ACTOR, AHORA);

    expect(resultado.documentoNuevo).toBe(true);
    expect(resultado.numeroVersion).toBe(1);
    expect(resultado.storagePathFinal).toContain(formatearIdVersion(1));
    expect(creados.some((p) => p.includes('/versiones/v0001'))).toBe(true);
    expect(resultado.aportesActualizados).toBeUndefined(); // sin requisitoId, no toca aportes
  });

  it('con requisitoId nuevo (sin aporte previo): crea documento Y marca el aporte APORTADO', async () => {
    const { db, tx } = fakeDb();
    const archivo = validarYPrepararArchivoDocumento({ buffer: PDF_BUFFER, mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'certificado.pdf' });
    if (esErrorExpediente(archivo)) throw new Error('setup inválido');

    const resultado = await planSubirDocumento(
      tx, db, 'exp-1', 'SEC_PLANEACION', [], { archivo, requisitoId: 'certificado-tradicion-libertad' }, ACTOR, AHORA,
    );

    expect(resultado.aportesActualizados).toEqual([
      { requisitoId: 'certificado-tradicion-libertad', estado: 'APORTADO', documentoIds: [resultado.documentoId] },
    ]);
    // El enlace es al documento LÓGICO, no a la versión (addendum A2).
    expect(resultado.aportesActualizados![0].documentoIds[0]).toBe(resultado.documentoId);
    expect(resultado.aportesActualizados![0].documentoIds[0]).not.toContain('v0001');
  });
});

describe('planSubirDocumento — SEGUNDA versión (v0002) sobre un documento existente', () => {
  it('mismo requisitoId con aporte ya APORTADO: numeroVersion se lee DENTRO de la tx (totalVersiones+1)', async () => {
    const documentoExistente = { id: 'doc-1', tenantId: 'SEC_PLANEACION', nombre: 'Certificado', creadoEn: '2026-08-01T00:00:00.000Z', totalVersiones: 1, versionVigente: { numeroVersion: 1 } };
    const { db, tx, creados } = fakeDb({ 'expedientes/exp-1/documentos/doc-1': documentoExistente });

    const archivo = validarYPrepararArchivoDocumento({ buffer: PDF_BUFFER, mimeTypeDeclarado: 'application/pdf', nombreOriginal: 'certificado-corregido.pdf' });
    if (esErrorExpediente(archivo)) throw new Error('setup inválido');

    const aportesActuales = [{ requisitoId: 'certificado-tradicion-libertad', estado: 'APORTADO' as const, documentoIds: ['doc-1'] }];
    const resultado = await planSubirDocumento(
      tx, db, 'exp-1', 'SEC_PLANEACION', aportesActuales, { archivo, requisitoId: 'certificado-tradicion-libertad' }, ACTOR, AHORA,
    );

    expect(resultado.documentoNuevo).toBe(false);
    expect(resultado.documentoId).toBe('doc-1');
    expect(resultado.numeroVersion).toBe(2);
    expect(creados.some((p) => p.includes('/versiones/v0002'))).toBe(true);
    expect(creados.some((p) => p.includes('/versiones/v0001'))).toBe(false); // v0001 NO se vuelve a crear (INV-1)
    // El aporte sigue apuntando al MISMO documento lógico (no cambia por versionar).
    expect(resultado.aportesActualizados).toEqual([
      { requisitoId: 'certificado-tradicion-libertad', estado: 'APORTADO', documentoIds: ['doc-1'] },
    ]);
  });
});
