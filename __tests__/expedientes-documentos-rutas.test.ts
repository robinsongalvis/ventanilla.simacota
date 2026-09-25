import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

/**
 * Bloque A·A2 — cableado de las rutas de documentos/contexto (grep de
 * fuente, mismo patrón que `__tests__/subsanacion-rutas.test.ts` /
 * `__tests__/expedientes-licencias-rutas.test.ts`).
 */

const UPLOAD_ROUTE = readFileSync('app/api/licencias/expedientes/[id]/documentos/route.ts', 'utf8');
const CONTEXTO_ROUTE = readFileSync('app/api/licencias/expedientes/[id]/contexto/route.ts', 'utf8');
const MODULO_DOCUMENTOS = readFileSync('lib/server/expedientes-documentos.ts', 'utf8');
const MODULO_LICENCIAS = readFileSync('lib/server/expedientes-licencias.ts', 'utf8');
const ARCHIVO_ROUTE = readFileSync('app/api/interno/archivo/route.ts', 'utf8');

describe('POST .../documentos — validación server-side obligatoria (rules if false)', () => {
  it('usa verificarMagicBytes (H-08) — no confía en el Content-Type declarado', () => {
    expect(MODULO_DOCUMENTOS).toContain('verificarMagicBytes');
  });

  it('usa sanitizeFilename sobre el nombre del archivo', () => {
    expect(MODULO_DOCUMENTOS).toContain('sanitizeFilename');
  });

  it('calcula el hash con createHash(\'sha256\') sobre el buffer — nunca recibe un hash como parámetro de entrada', () => {
    expect(MODULO_DOCUMENTOS).toContain("createHash('sha256')");
    // `ValidarArchivoInput` (lo que puede llegar del caller) no tiene campo hash:
    // solo buffer/mimeTypeDeclarado/nombreOriginal — grep negativo defensivo.
    expect(MODULO_DOCUMENTOS).not.toMatch(/ValidarArchivoInput[^}]*hash/i);
  });

  it('la ruta NUNCA lee un campo "hash" ni "hashSha256" del formData/body del cliente', () => {
    expect(UPLOAD_ROUTE).not.toMatch(/formData\??\.get\(\s*['"]hash/i);
  });

  it('el candado R10 (serie legal expedientes) sigue intacto: la ruta de documentos NO importa emitir-numero-expediente ni consecutivo-legal', () => {
    expect(UPLOAD_ROUTE).not.toContain('emitir-numero-expediente');
    expect(UPLOAD_ROUTE).not.toContain('consecutivo-legal');
  });

  it('valida requisitoId contra la Definición ANTES de tocar Storage/Firestore de escritura', () => {
    const idxValidacion = UPLOAD_ROUTE.indexOf('validarRequisitoIdContraDefinicion');
    const idxStaging = UPLOAD_ROUTE.indexOf('guardarEnStorage(');
    expect(idxValidacion).toBeGreaterThan(-1);
    expect(idxStaging).toBeGreaterThan(-1);
    expect(idxValidacion).toBeLessThan(idxStaging);
  });

  it('sigue el patrón H3: staging → transacción → move post-commit', () => {
    expect(UPLOAD_ROUTE).toContain('guardarEnStorage');
    expect(UPLOAD_ROUTE).toContain('runTransaction');
    expect(UPLOAD_ROUTE).toContain('moverEnStorage');
    // `lastIndexOf`: cada helper aparece 2 veces (su definición arriba y su
    // LLAMADA dentro de POST) — la llamada es la que importa para el orden.
    const idxStaging = UPLOAD_ROUTE.lastIndexOf('guardarEnStorage(');
    const idxTx = UPLOAD_ROUTE.indexOf('runTransaction');
    const idxMove = UPLOAD_ROUTE.lastIndexOf('moverEnStorage(');
    expect(idxStaging).toBeLessThan(idxTx);
    expect(idxTx).toBeLessThan(idxMove);
  });

  it('exige sesión + permiso de tenant (canOperateTenant)', () => {
    expect(UPLOAD_ROUTE).toContain('requireActiveInternalUser');
    expect(UPLOAD_ROUTE).toContain('canOperateTenant');
  });
});

describe('PATCH .../contexto — fail-closed contra clavesContexto', () => {
  it('llama a planActualizarContexto (la validación vive en el módulo puro)', () => {
    expect(CONTEXTO_ROUTE).toContain('planActualizarContexto');
  });
  it('exige sesión + permiso de tenant', () => {
    expect(CONTEXTO_ROUTE).toContain('requireActiveInternalUser');
    expect(CONTEXTO_ROUTE).toContain('canOperateTenant');
  });
});

describe('GET /api/interno/archivo — descarga de documentos de expediente extiende la vía canónica', () => {
  it('usa PATH_REGEX_DOCUMENTO_EXPEDIENTE (vía parsearPathDocumentoExpediente) del contrato A1, no un regex propio duplicado', () => {
    expect(ARCHIVO_ROUTE).toContain('parsearPathDocumentoExpediente');
    expect(ARCHIVO_ROUTE).not.toMatch(/expedientes\\\//); // no reimplementa el regex inline
  });

  it('autoriza con autorizarDescargaDocumentoExpediente (anti-IDOR por tenant del expediente)', () => {
    expect(ARCHIVO_ROUTE).toContain('autorizarDescargaDocumentoExpediente');
  });

  it('valida el hash (INV-3) con createHash(\'sha256\') ANTES de responder con los bytes', () => {
    expect(ARCHIVO_ROUTE).toContain("createHash('sha256')");
    const idxHash = ARCHIVO_ROUTE.indexOf('hashCalculado !== version.hashSha256');
    const idxRespuesta = ARCHIVO_ROUTE.indexOf('new NextResponse(new Uint8Array(bytes)');
    expect(idxHash).toBeGreaterThan(-1);
    expect(idxRespuesta).toBeGreaterThan(-1);
    expect(idxHash).toBeLessThan(idxRespuesta);
  });
});

describe('lib/seguridad/autorizar-descarga-archivo.ts — staging jamás autoriza (estructural, vía el regex del contrato)', () => {
  const MODULO_AUTORIZAR = readFileSync('lib/seguridad/autorizar-descarga-archivo.ts', 'utf8');
  it('importa PATH_REGEX_DOCUMENTO_EXPEDIENTE del contrato A1 en vez de redefinirlo', () => {
    expect(MODULO_AUTORIZAR).toMatch(/import\s*\{[^}]*PATH_REGEX_DOCUMENTO_EXPEDIENTE[^}]*\}\s*from\s*['"][^'"]*expedientes-documentos-tipos['"]/);
  });
});

describe('AporteRequisito.documentoIds — addendum A2 documentado', () => {
  it('el JSDoc de tipos.ts cita el addendum A2 aprobado 8-ago', () => {
    const TIPOS = readFileSync('lib/motor-expedientes/tipos.ts', 'utf8');
    expect(TIPOS).toContain('addendum A2 aprobado 8-ago');
    // La cita vive en el JSDoc INMEDIATAMENTE antes del campo `documentoIds`.
    const idxAddendum = TIPOS.indexOf('addendum A2 aprobado 8-ago');
    const idxCampo = TIPOS.indexOf('documentoIds: string[];');
    expect(idxCampo - idxAddendum).toBeGreaterThan(0);
    expect(idxCampo - idxAddendum).toBeLessThan(400);
  });
});

describe('MODULO_LICENCIAS sanity — planActualizarContexto exportado', () => {
  it('está definido', () => {
    expect(MODULO_LICENCIAS).toContain('export function planActualizarContexto');
  });
});
