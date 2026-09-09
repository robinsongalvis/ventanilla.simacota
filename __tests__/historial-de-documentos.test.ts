import { describe, expect, it, vi } from 'vitest';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import {
  construirActuacionMovimientoDocumento,
  planSubirDocumento,
  registraMovimientoEnHistorial,
  validarYPrepararArchivoDocumento,
  SLUG_DOCUMENTO_APORTADO,
  SLUG_DOCUMENTO_REEMPLAZADO,
} from '@/lib/server/expedientes-documentos';
import { esErrorExpediente, type ActuacionLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { derivarEventosTermino } from '@/lib/motor-expedientes/termino';
import { construirTimelineDesdeActuaciones } from '@/app/interno/licencias/presentacion-actuaciones';

/* ══════════════════════════════════════════════════════════════
   CAMBIAR UN DOCUMENTO ES UN HECHO DEL EXPEDIENTE.

   EL DEFECTO. Hasta el 9-sep-2026 la ruta de documentos no escribía ni una
   actuación: `grep -n "actuacion" documentos/route.ts` devolvía cero en 192
   líneas. Subir, reemplazar o actualizar un papel no dejaba rastro. Lo probó el
   propietario —«realicé el cambio de un documento y no quedó registrado»— y
   tenía razón.

   Las VERSIONES sí se guardaban y ninguna se borra jamás, así que la evidencia
   nunca se perdió. Lo que faltaba era el hecho: cuándo cambió, quién lo cambió,
   y a qué versión. Sin eso, el expediente no puede responder lo que un juez
   pregunta primero cuando una licencia se demanda: «¿cuál plano evaluó la
   Secretaría?».

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: que el movimiento quede escrito desde la debida forma y NO antes;
   que distinga aportar de reemplazar; que la evidencia viaje ESTRUCTURADA (con
   el hash, que es lo verificable); que se escriba en la MISMA transacción que
   la versión; que NO mueva el reloj; y que el historial lo pinte en español.

   Esto NO MIRA: la validación del archivo (MIME, magic-bytes, tamaño), que ya
   custodia `expedientes-documentos-decisiones`; ni el movimiento del binario en
   Storage, que ocurre fuera de la transacción por diseño (patrón H3).
══════════════════════════════════════════════════════════════ */

const ACTOR = { uid: 'u-1', nombre: 'Funcionaria de Planeación', rol: 'FUNCIONARIO' };
const AHORA = new Date('2026-09-09T15:00:00.000Z');
const ANCLA = '2026-09-01T12:00:00.000Z';

/* PDF mínimo real: los magic-bytes se validan de verdad, no se saltan. */
const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 0x20)]);

function archivoDe(nombre: string) {
  const validado = validarYPrepararArchivoDocumento({
    buffer: PDF_BUFFER,
    mimeTypeDeclarado: 'application/pdf',
    nombreOriginal: nombre,
  });
  if (esErrorExpediente(validado)) throw new Error('setup inválido');
  return validado;
}

function fakeDb(datos: Record<string, Record<string, unknown>> = {}) {
  const creados: { path: string; data: unknown }[] = [];
  function docRef(path: string) {
    return { id: path.split('/').pop()!, path, collection: (sub: string) => collectionRef(`${path}/${sub}`) };
  }
  function collectionRef(basePath: string) {
    let contador = 0;
    return { doc: (id?: string) => docRef(`${basePath}/${id ?? `auto-${contador++}`}`) };
  }
  const db = { collection: (name: string) => collectionRef(name) } as unknown as Firestore;
  const tx = {
    get: vi.fn(async (ref: { path: string }) => ({ exists: datos[ref.path] !== undefined, data: () => datos[ref.path] })),
    create: vi.fn((ref: { path: string }, data: unknown) => { creados.push({ path: ref.path, data }); }),
    update: vi.fn(() => {}),
  } as unknown as Transaction;
  return { db, tx, creados };
}

const expedienteRadicado = {
  id: 'exp-1',
  tenantId: 'SEC_PLANEACION',
  aportes: [],
  anclaDebidaForma: ANCLA,
};

describe('el movimiento queda escrito — el defecto que el propietario encontró', () => {
  it('aportar un documento después de la debida forma deja su actuación', async () => {
    const { db, tx, creados } = fakeDb();

    const resultado = await planSubirDocumento(
      tx, db, expedienteRadicado,
      { archivo: archivoDe('plano-arquitectonico.pdf'), nombre: 'Plano arquitectónico' },
      ACTOR, AHORA,
    );

    expect(resultado.actuacion, 'no se escribió ninguna actuación').toBeDefined();
    expect(resultado.actuacion!.tipo).toBe(SLUG_DOCUMENTO_APORTADO);
    expect(creados.some((c) => c.path.includes('/actuaciones/'))).toBe(true);
  });

  it('reemplazar uno existente lo dice con OTRO verbo, y con la versión', async () => {
    /* Aportar añade; reemplazar SUSTITUYE lo que ya se estaba evaluando. Si los
       dos dijeran lo mismo, el historial no distinguiría el caso que importa. */
    const existente = {
      id: 'doc-1', tenantId: 'SEC_PLANEACION', nombre: 'Plano arquitectónico',
      creadoEn: ANCLA, totalVersiones: 1, versionVigente: { numeroVersion: 1 },
    };
    const { db, tx } = fakeDb({ 'expedientes/exp-1/documentos/doc-1': existente });

    const resultado = await planSubirDocumento(
      tx, db,
      { ...expedienteRadicado, aportes: [{ requisitoId: 'planos-arquitectonicos', estado: 'APORTADO' as const, documentoIds: ['doc-1'] }] },
      { archivo: archivoDe('plano-corregido.pdf'), requisitoId: 'planos-arquitectonicos' },
      ACTOR, AHORA,
    );

    expect(resultado.actuacion!.tipo).toBe(SLUG_DOCUMENTO_REEMPLAZADO);
    expect(resultado.actuacion!.evidenciaDocumento!.numeroVersion).toBe(2);
    expect(resultado.actuacion!.detalle).toContain('La versión anterior se conserva');
  });

  it('la evidencia va ESTRUCTURADA, con el hash — que es lo único verificable', async () => {
    /* La razón de ser de todo esto: dentro de dos años, «¿cuál plano evaluó la
       Secretaría?» no se responde con una frase, se responde contrastando una
       huella contra el archivo. */
    const { db, tx } = fakeDb();
    const archivo = archivoDe('plano.pdf');

    const resultado = await planSubirDocumento(
      tx, db, expedienteRadicado, { archivo, nombre: 'Plano arquitectónico' }, ACTOR, AHORA,
    );

    const evidencia = resultado.actuacion!.evidenciaDocumento!;
    expect(evidencia.hashSha256).toBe(archivo.hashSha256);
    expect(evidencia.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidencia.documentoId).toBe(resultado.documentoId);
    expect(evidencia.nombre).toBe('Plano arquitectónico');
  });

  it('el actor sale del SERVIDOR, no de lo que mande el cliente', async () => {
    const { db, tx } = fakeDb();
    const resultado = await planSubirDocumento(
      tx, db, expedienteRadicado, { archivo: archivoDe('x.pdf') }, ACTOR, AHORA,
    );
    expect(resultado.actuacion!.actorUid).toBe('u-1');
    expect(resultado.actuacion!.actorNombre).toBe('Funcionaria de Planeación');
    expect(resultado.actuacion!.origen).toBe('REAL');
    expect(resultado.actuacion!.fecha).toBe(AHORA.toISOString());
  });
});

describe('la actuación y la versión son ATÓMICAS', () => {
  it('las dos se crean en la MISMA transacción', async () => {
    /* Escribir el historial fuera de la tx dejaría, ante un fallo entre las
       dos, una versión sin rastro —o un rastro que anuncia una versión que no
       existe—. El expediente mentiría sobre su propio contenido justo cuando
       más importa. */
    const { db, tx, creados } = fakeDb();

    await planSubirDocumento(tx, db, expedienteRadicado, { archivo: archivoDe('x.pdf') }, ACTOR, AHORA);

    const rutas = creados.map((c) => c.path);
    expect(rutas.some((r) => r.includes('/versiones/v0001'))).toBe(true);
    expect(rutas.some((r) => r.includes('/actuaciones/'))).toBe(true);
    /* Todas por el MISMO `tx.create`: si alguien las separara en dos escrituras,
       una de ellas dejaría de pasar por aquí. */
    expect((tx.create as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(rutas.length);
  });
});

describe('antes de la debida forma NO se registra, y es deliberado', () => {
  it('durante el intake no se escribe actuación', async () => {
    /* El ciudadano todavía está armando su solicitud: dieciocho documentos
       serían dieciocho hechos que ahogarían los cinco o seis que cuentan. */
    const { db, tx, creados } = fakeDb();

    const resultado = await planSubirDocumento(
      tx, db, { ...expedienteRadicado, anclaDebidaForma: null },
      { archivo: archivoDe('x.pdf') }, ACTOR, AHORA,
    );

    expect(resultado.actuacion).toBeUndefined();
    expect(creados.some((c) => c.path.includes('/actuaciones/'))).toBe(false);
  });

  it('pero la VERSIÓN sí se guarda igual: lo que no se escribe es la línea, no el archivo', async () => {
    const { db, tx, creados } = fakeDb();
    await planSubirDocumento(
      tx, db, { ...expedienteRadicado, anclaDebidaForma: null },
      { archivo: archivoDe('x.pdf') }, ACTOR, AHORA,
    );
    expect(creados.some((c) => c.path.includes('/versiones/v0001'))).toBe(true);
  });

  it('la regla vive en su propia función, para poder encontrarla', () => {
    expect(registraMovimientoEnHistorial(ANCLA)).toBe(true);
    expect(registraMovimientoEnHistorial(null)).toBe(false);
    expect(registraMovimientoEnHistorial(undefined)).toBe(false);
    expect(registraMovimientoEnHistorial(''), 'una cadena vacía no es una fecha').toBe(false);
  });
});

describe('esto NO mueve el reloj', () => {
  it('ninguno de los dos slugs produce un evento de término', () => {
    /* La norma no suspende el término porque se cambie un papel — el propio
       `MODIFICACION_SOLICITUD` está declarado inerte por lo mismo. Si algún día
       uno de estos slugs entrara en `SLUG_A_TIPO_EVENTO`, un reemplazo de
       documento empezaría a correr o parar plazos legales sin que nadie lo
       hubiera decidido. */
    const movimientos = [
      construirActuacionMovimientoDocumento('exp-1', 'SEC_PLANEACION',
        { documentoId: 'd1', nombre: 'Plano', numeroVersion: 1, hashSha256: 'a'.repeat(64) }, ACTOR, AHORA),
      construirActuacionMovimientoDocumento('exp-1', 'SEC_PLANEACION',
        { documentoId: 'd1', nombre: 'Plano', numeroVersion: 2, hashSha256: 'b'.repeat(64) }, ACTOR, AHORA),
    ];

    expect(derivarEventosTermino(movimientos)).toEqual([]);
  });
});

describe('el historial lo pinta en español, no el slug', () => {
  const movimiento = (numeroVersion: number): ActuacionLicenciaDoc =>
    construirActuacionMovimientoDocumento('exp-1', 'SEC_PLANEACION',
      { documentoId: 'd1', nombre: 'Plano arquitectónico', numeroVersion, hashSha256: 'c'.repeat(64) }, ACTOR, AHORA);

  it('el aporte y el reemplazo dicen cosas distintas, con tono propio', () => {
    const timeline = construirTimelineDesdeActuaciones([movimiento(1), movimiento(3)], 'REAL', null);

    expect(timeline[0]!.titulo).toBe('Se aportó un documento');
    expect(timeline[1]!.titulo).toBe('Se reemplazó un documento');
    /* Tono propio: NO `SUBSANACION`, que es donde caían por defecto. Una
       subsanación responde a un acta y mueve el reloj; esto no hace ninguna de
       las dos cosas, y pintarlos igual haría creer que sí. */
    expect(timeline.every((i) => i.tipo === 'DOCUMENTO')).toBe(true);
    expect(timeline[0]!.titulo, 'el riel volvió a imprimir el slug crudo').not.toContain('documento-');
  });

  it('el resumen se compone de los CAMPOS, no partiendo la prosa del detalle', () => {
    const timeline = construirTimelineDesdeActuaciones([movimiento(3)], 'REAL', null);
    expect(timeline[0]!.resumen).toContain('«Plano arquitectónico»');
    expect(timeline[0]!.resumen).toContain('versión 3');
  });

  it('dice QUIÉN y CUÁNDO — un historial sin autor no sirve para responder por él', () => {
    const timeline = construirTimelineDesdeActuaciones([movimiento(1)], 'REAL', null);
    expect(timeline[0]!.quien).toBe('Funcionaria de Planeación');
    expect(timeline[0]!.ocurrioEn).toBe(AHORA.toISOString());
  });
});
