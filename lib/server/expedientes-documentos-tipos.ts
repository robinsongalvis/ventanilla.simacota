/* ══════════════════════════════════════════════════════════════
   Contrato de DATOS de documentos del expediente — D7 ADR-0026
   (Bloque A · A1, decisión firestore-datos 2026-08-08).

   SOLO tipos, nombres canónicos y constructores puros de rutas: la
   lógica de subida/descarga (validación de MIME y tamaño, cálculo del
   hash, transacción, staging→move) la implementa dev-backend consumiendo
   este contrato. Ninguna ruta ni UI importa de aquí todavía.

   ESQUEMA FIRESTORE (server-only, reglas `if false` — ver firestore.rules):

     expedientes/{expedienteId}
       └── documentos/{documentoId}            ← documento LÓGICO
             └── versiones/{vNNNN}             ← versión INMUTABLE (append-only)

   ESQUEMA STORAGE (server-only — ver storage.rules):

     staging: expedientes/_pendientes/{requestId}/{archivo}
     final:   expedientes/{expedienteId}/{documentoId}/{vNNNN}/{archivo}

   INVARIANTES (no negociables — D7 "anti-pérdida"):

   · INV-1 APPEND-ONLY: un doc de `versiones` JAMÁS se actualiza ni se
     borra, y su binario en Storage tampoco. Corregir un documento =
     crear la versión siguiente. Nada de sobrescrituras.
   · INV-2 ATOMICIDAD: crear una versión = `tx.create()` del doc de
     versión (id determinista `vNNNN` — si ya existe, la transacción
     falla: candado natural contra subida concurrente duplicada, mismo
     truco que `unicidad_expedientes`) + `tx.update()` del espejo
     `versionVigente`/`totalVersiones` del doc lógico, en la MISMA
     transacción. El binario va ANTES a staging y se mueve DESPUÉS del
     commit (patrón H3 de /api/radicacion: staging → tx → finalize;
     Storage no es transaccional con Firestore — un fallo del move deja
     la versión válida en Firestore y el binario pendiente de
     conciliación, nunca un binario huérfano sin metadatos).
   · INV-3 HASH SERVER-SIDE: `hashSha256` se calcula en el SERVIDOR
     sobre los bytes recibidos, antes de subir (precedente `sha256Hex`,
     app/api/radicados/[radicadoId]/sellar-documento/route.ts) y se
     valida al recuperar el binario. El cliente nunca aporta el hash.
   · INV-4 TENANT SERVER-SIDE: `tenantId` se copia en el servidor desde
     el expediente raíz — jamás del cliente (mismo patrón que
     `ActuacionLicenciaDoc`, cierra deuda #6 ADR-0026 §A2 para estas
     subcolecciones: habilita collectionGroup y reglas futuras por
     tenant sin `get()` del padre).
   · INV-5 ESPEJO CONSISTENTE: `versionVigente.numeroVersion ===
     totalVersiones` siempre; `numeroVersion` es correlativo 1..n sin
     huecos. El checklist de completitud lee SOLO la subcolección
     `documentos` (una query) — nunca necesita tocar `versiones`.

   ENLACE CON EL CHECKLIST (contrato congelado del motor):
   `AporteRequisito.documentoIds` (lib/motor-expedientes/tipos.ts)
   referencia ids de documentos LÓGICOS de esta subcolección; la versión
   que satisface el requisito es SIEMPRE la vigente — así una versión
   corregida no exige reescribir el aporte (anti-pérdida también en el
   enlace). `DocumentoExpedienteDoc.requisitoId` es el enlace inverso.
   NOTA: el JSDoc de `documentoIds` en tipos.ts dice "ids de versiones";
   ese archivo está congelado por ADR-0029 y NO se toca aquí — la
   reconciliación de esa línea es un addendum de una palabra que debe
   aprobar quien gobierna el contrato (ver reporte del bloque).
══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────
   Nombres canónicos
────────────────────────────────────────────── */

/** Subcolección de documentos lógicos bajo `expedientes/{expedienteId}`. */
export const SUBCOLECCION_DOCUMENTOS = 'documentos';

/** Sub-subcolección de versiones inmutables bajo cada documento lógico. */
export const SUBCOLECCION_VERSIONES = 'versiones';

/** Prefijo raíz de Storage para binarios del motor de expedientes. */
export const STORAGE_PREFIJO_EXPEDIENTES = 'expedientes';

/**
 * Carpeta de staging bajo el prefijo (patrón H3). El guion bajo inicial
 * es deliberado: ningún `expedienteId` real (crypto.randomUUID) empieza
 * por `_`, y el alfabeto de `PATH_REGEX_DOCUMENTO_EXPEDIENTE` lo excluye
 * — una ruta de staging JAMÁS puede autorizar descarga.
 */
export const STORAGE_CARPETA_STAGING = '_pendientes';

/* ──────────────────────────────────────────────
   Contratos de documento
────────────────────────────────────────────── */

/**
 * Versión INMUTABLE de un documento del expediente —
 * `expedientes/{expedienteId}/documentos/{documentoId}/versiones/{vNNNN}`.
 * Se crea una vez (`tx.create`) y nunca se vuelve a escribir (INV-1/INV-2).
 */
export interface VersionDocumentoExpedienteDoc {
  /** Correlativo 1..n sin huecos; coincide con el doc id (`v0001` ↔ 1). */
  numeroVersion: number;
  /** Ruta final canónica del binario — `construirStoragePathVersion`. */
  storagePath: string;
  /** SHA-256 hex minúscula (64 chars) de los bytes, calculado SERVER-side (INV-3). */
  hashSha256: string;
  /** Tamaño en bytes de los bytes hasheados (convención repo: sin ñ en identificadores, cf. `tamanioKB`). */
  tamanioBytes: number;
  /** Content-Type validado por el servidor (allowlist de dev-backend, cf. magic-bytes). */
  mimeType: string;
  /** Funcionario que subió la versión — capturado de la sesión del servidor, jamás del body. */
  subidoPor: { uid: string; nombre: string };
  /** ISO 8601 — momento de la subida (reloj del servidor). */
  subidoEn: string;
  /** DENORMALIZADO del expediente raíz, copiado en servidor (INV-4). */
  tenantId: string;
}

/**
 * Documento LÓGICO del expediente —
 * `expedientes/{expedienteId}/documentos/{documentoId}`.
 *
 * Es la identidad estable que el checklist enlaza
 * (`AporteRequisito.documentoIds`): las versiones van y vienen debajo;
 * el id lógico no cambia. `versionVigente` es un ESPEJO de la última
 * versión para que el detalle/checklist resuelva nombre + hash + ruta
 * con UNA query a esta subcolección, sin N+1 sobre `versiones` (INV-5).
 */
export interface DocumentoExpedienteDoc {
  /** Doc id (auto-id de Firestore) — el valor que viaja en `AporteRequisito.documentoIds`. */
  id: string;
  /** DENORMALIZADO del expediente raíz, copiado en servidor (INV-4). */
  tenantId: string;
  /** Nombre lógico institucional, p. ej. "Certificado de tradición y libertad". */
  nombre: string;
  /**
   * Enlace inverso a `RequisitoDefinicion.id` de la Definición del
   * trámite. Opcional: un documento puede pertenecer al expediente sin
   * satisfacer un requisito del checklist (p. ej. anexo espontáneo).
   */
  requisitoId?: string;
  /** ISO 8601 — creación del documento lógico (= subida de su v0001). */
  creadoEn: string;
  /** Espejo de la última versión (INV-5) — actualizado SOLO en la transacción que la crea (INV-2). */
  versionVigente: VersionDocumentoExpedienteDoc;
  /** Invariante: `totalVersiones === versionVigente.numeroVersion` (INV-5). */
  totalVersiones: number;
}

/* ──────────────────────────────────────────────
   Rutas canónicas (Storage) e ids de versión
────────────────────────────────────────────── */

/** Zero-pad a 4 → ordena lexicográfica = numéricamente hasta 9999 versiones. */
const ANCHO_ID_VERSION = 4;

/** Máximo representable por el formato `vNNNN` — límite práctico documentado. */
export const MAX_NUMERO_VERSION = 10 ** ANCHO_ID_VERSION - 1;

/**
 * Id determinista del doc de versión Y segmento de la ruta de Storage:
 * `formatearIdVersion(1) === 'v0001'`. Un solo formato para ambos —
 * mapeo directo ruta ↔ doc, sin traducción.
 */
export function formatearIdVersion(numeroVersion: number): string {
  if (!Number.isInteger(numeroVersion) || numeroVersion < 1 || numeroVersion > MAX_NUMERO_VERSION) {
    throw new Error(
      `numeroVersion inválido: ${numeroVersion} (entero entre 1 y ${MAX_NUMERO_VERSION}).`,
    );
  }
  return `v${String(numeroVersion).padStart(ANCHO_ID_VERSION, '0')}`;
}

/**
 * Ruta FINAL canónica del binario de una versión. `archivo` debe llegar
 * ya saneado con `sanitizeFilename` (lib/server/radicados-security.ts)
 * — este constructor no sanea, solo compone (misma división de
 * responsabilidades que `guardarEnStorage` en /api/radicacion).
 *
 * Decisión: SIN `tenantId` en la ruta, siguiendo la convención de toda
 * la ventanilla (radicados/, respuestas/, sellados/, salidas/,
 * planillas/). El tenant autoritativo vive en Firestore y la descarga
 * autorizada lo verifica contra el expediente (anti-IDOR); un tenant
 * embebido en la ruta sería una copia desincronizable que las reglas
 * (`if false`) jamás inspeccionan.
 */
export function construirStoragePathVersion(
  expedienteId: string,
  documentoId: string,
  numeroVersion: number,
  archivo: string,
): string {
  return `${STORAGE_PREFIJO_EXPEDIENTES}/${expedienteId}/${documentoId}/${formatearIdVersion(numeroVersion)}/${archivo}`;
}

/**
 * Ruta de STAGING previa a la transacción (patrón H3): el binario sube
 * aquí antes de conocer/confirmar `numeroVersion`, y se mueve a la ruta
 * final DESPUÉS del commit de Firestore (INV-2).
 */
export function construirStoragePathStaging(requestId: string, archivo: string): string {
  return `${STORAGE_PREFIJO_EXPEDIENTES}/${STORAGE_CARPETA_STAGING}/${requestId}/${archivo}`;
}

/**
 * Validación estructural de una ruta FINAL para la futura descarga
 * autorizada (patrón `parsearPathArchivo`,
 * lib/seguridad/autorizar-descarga-archivo.ts).
 *
 * ATENCIÓN — lo que esta expresión NO rechaza: `..` como NOMBRE DE
 * ARCHIVO. En `expedienteId`/`documentoId` no cabe (su alfabeto no tiene
 * punto) y en la versión tampoco (`v\d{4}`), pero el último segmento sí
 * lo admite: `expedientes/<exp>/<doc>/v0001/..` le encaja entero.
 * Comprobado ejecutándola. Quien filtra eso es la guarda
 * `path.includes('..')` de `parsearPathDocumentoExpediente` —gemela de
 * la de `parsearPathArchivo`—, NO este regex: no la quites. La vigila
 * `__tests__/autorizar-descarga-archivo.test.ts`, bloque «travesía de
 * directorios».
 *
 * Alfabeto de `expedienteId`/`documentoId`: `[A-Za-z0-9-]` (UUID y
 * auto-id de Firestore) — SIN `_`, para que `_pendientes` (staging)
 * nunca valide. Alfabeto del archivo: el que produce `sanitizeFilename`.
 */
export const PATH_REGEX_DOCUMENTO_EXPEDIENTE =
  /^expedientes\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\/v\d{4}\/[A-Za-z0-9._\- ]+$/;
