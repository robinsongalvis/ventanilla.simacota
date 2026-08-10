import { createHash } from 'node:crypto';
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import { verificarMagicBytes, tiposPermitidosMagicBytes } from '@/lib/seguridad/magic-bytes';
import { sanitizeFilename } from '@/lib/server/radicados-security';
import {
  SUBCOLECCION_DOCUMENTOS,
  SUBCOLECCION_VERSIONES,
  construirStoragePathVersion,
  formatearIdVersion,
  type DocumentoExpedienteDoc,
  type VersionDocumentoExpedienteDoc,
} from '@/lib/server/expedientes-documentos-tipos';
import { requisitoAplica } from '@/lib/motor-expedientes/completitud';
import type { AporteRequisito, ContextoEvaluacionRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import type { ErrorExpediente, ActorExpediente } from '@/lib/server/expedientes-licencias';

/* ══════════════════════════════════════════════════════════════
   Lógica de DECISIÓN de documentos de expediente (D7) — Bloque A·A2.
   Mismo patrón que `lib/server/expedientes-licencias.ts`: funciones puras
   separadas de la ruta, que solo orquesta IO/auth.
══════════════════════════════════════════════════════════════ */

export const MAX_DOCUMENTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/* ──────────────────────────────────────────────
   Validación del binario (pura sobre un Buffer ya leído)
────────────────────────────────────────────── */

export interface ValidarArchivoInput {
  buffer: Buffer;
  mimeTypeDeclarado: string;
  nombreOriginal: string;
}

export interface ArchivoValidado {
  buffer: Buffer;
  filenameSaneado: string;
  mimeType: string;
  tamanioBytes: number;
  /** SHA-256 hex minúscula, calculado SERVER-side sobre `buffer` — JAMÁS del cliente (INV-3). */
  hashSha256: string;
}

/**
 * Valida tamaño, allowlist MIME + firma binaria (magic bytes, H-08) y
 * sanea el nombre — PURA sobre un `Buffer` ya leído por el caller (la
 * lectura de `File`/`Blob` es I/O, fuera de esta función; mismo patrón de
 * `verificarMagicBytes` en `app/api/radicacion/route.ts`).
 *
 * `hashSha256` se calcula AQUÍ, sobre los bytes recibidos — no hay ningún
 * parámetro para que el caller lo sobrescriba con un valor externo
 * (INV-3: precedente `sha256Hex`, `app/api/radicados/[radicadoId]/
 * sellar-documento/route.ts`).
 */
export function validarYPrepararArchivoDocumento(input: ValidarArchivoInput): ArchivoValidado | ErrorExpediente {
  if (!input.buffer || input.buffer.length === 0) {
    return { status: 400, mensaje: 'El archivo está vacío.' };
  }
  if (input.buffer.length > MAX_DOCUMENTO_SIZE_BYTES) {
    return { status: 400, mensaje: 'El archivo supera el tamaño máximo de 10 MB.' };
  }
  if (!tiposPermitidosMagicBytes().includes(input.mimeTypeDeclarado)) {
    return { status: 400, mensaje: `Tipo de archivo no permitido (${input.mimeTypeDeclarado || 'desconocido'}). Formatos admitidos: PDF, JPG, PNG, WEBP, DOCX, XLSX, PPTX.` };
  }
  if (!verificarMagicBytes(input.buffer, input.mimeTypeDeclarado)) {
    return { status: 400, mensaje: 'El archivo no tiene una firma válida para su tipo declarado.' };
  }

  return {
    buffer: input.buffer,
    filenameSaneado: sanitizeFilename(input.nombreOriginal),
    mimeType: input.mimeTypeDeclarado,
    tamanioBytes: input.buffer.length,
    hashSha256: createHash('sha256').update(input.buffer).digest('hex'),
  };
}

/* ──────────────────────────────────────────────
   requisitoId contra la Definición de Trámite
────────────────────────────────────────────── */

/**
 * Valida que `requisitoId` (si se envía) exista en la Definición dada —
 * 400 si no. `undefined`/`''` es válido (documento sin requisito enlazado,
 * p. ej. un anexo espontáneo — ver `DocumentoExpedienteDoc.requisitoId`).
 */
export function validarRequisitoIdContraDefinicion(
  requisitoId: string | undefined,
  definicion: DefinicionTramite,
): ErrorExpediente | null {
  if (!requisitoId) return null;
  const existe = definicion.requisitos.some((r) => r.id === requisitoId);
  if (!existe) {
    return { status: 400, mensaje: `El requisito "${requisitoId}" no existe en la Definición de Trámite "${definicion.id}".` };
  }
  return null;
}

/* ──────────────────────────────────────────────
   Revalidación server de NO_APLICA (defensa en profundidad, endurecimiento
   pre-reunión — hallazgo QA ago-2026)
────────────────────────────────────────────── */

/**
 * Revalida en SERVIDOR que un requisito CONDICIONAL sí aplique al caso
 * antes de aceptar su documento. La UI ya bloquea la subida de un
 * requisito que no aplica según el contexto del expediente, pero el
 * servidor no puede confiar solo en ese bloqueo (validación estricta de
 * entrada, nunca solo del cliente).
 *
 * Reutiliza `requisitoAplica`/`evaluarCondicion` del motor
 * (`lib/motor-expedientes/completitud.ts`) — NO duplica la evaluación de
 * condiciones.
 *
 * Solo actúa sobre requisitos `CONDICIONAL`: un `OBLIGATORIO` siempre
 * aplica, y un `OPCIONAL` — aunque `requisitoAplica` también lo resuelve
 * como `NO_APLICA` (no bloquea completitud) — NO es lo mismo que "no
 * aplica al caso": el funcionario puede subir un documento opcional
 * cuando quiera, así que este gate lo ignora.
 *
 * Semántica de la decisión, por resultado de `requisitoAplica`:
 *  - `NO_APLICA`       → 422, rechaza. La condición del checklist ya
 *    decidió que este caso no lo necesita; aceptar el documento sería
 *    inconsistente con la propia Definición.
 *  - `INDETERMINADO`   → permite subir (fail-open DELIBERADO, distinto del
 *    fail-closed de `completitud.ts`). El contexto de hechos puede llegar
 *    DESPUÉS que el documento — p. ej. el funcionario adjunta el
 *    certificado de PH antes de marcar "es PH" en el contexto — bloquear
 *    aquí penalizaría un orden de trabajo legítimo. El fail-closed de
 *    completitud sigue vigente para CERRAR el expediente: un requisito
 *    `INDETERMINADO` nunca deja el checklist "completo", así que subir
 *    primero no burla el control, solo lo adelanta.
 *  - `APLICA`, requisito no `CONDICIONAL`, requisito no encontrado, o sin
 *    `requisitoId` → nada que revalidar aquí (un `requisitoId` inexistente
 *    ya lo atrapa `validarRequisitoIdContraDefinicion`, llamada antes que
 *    esta función).
 */
export function validarRequisitoAplicaContraContexto(
  requisitoId: string | undefined,
  definicion: DefinicionTramite,
  contexto: ContextoEvaluacionRequisito,
): ErrorExpediente | null {
  if (!requisitoId) return null;
  const requisito = definicion.requisitos.find((r) => r.id === requisitoId);
  if (!requisito || requisito.tipo !== 'CONDICIONAL') return null;

  if (requisitoAplica(requisito, contexto) === 'NO_APLICA') {
    return {
      status: 422,
      mensaje: 'El requisito no aplica al caso según los hechos registrados; ajuste los hechos del caso si corresponde.',
    };
  }
  return null;
}

/* ──────────────────────────────────────────────
   Plan de subida (transaccional — D7 INV-1/INV-2)
────────────────────────────────────────────── */

export interface SubirDocumentoInput {
  archivo: ArchivoValidado;
  requisitoId?: string;
  nombre?: string;
}

export interface PlanSubirDocumento {
  /** Ruta de Storage FINAL a la que se debe mover el binario tras el commit (INV-2). */
  storagePathFinal: string;
  /** `true` si esta subida creó un documento lógico nuevo; `false` si añadió una versión a uno existente. */
  documentoNuevo: boolean;
  documentoId: string;
  numeroVersion: number;
  /** Aportes resultantes del expediente, listos para `tx.update` — solo se incluye si `requisitoId` estaba presente. */
  aportesActualizados?: AporteRequisito[];
}

/**
 * Ejecuta la fase LECTURA+ESCRITURA de la subida DENTRO de la transacción
 * del caller (patrón `leerConsecutivosLegales`/`confirmarConsecutivosLegales`,
 * pero aquí en una sola función porque D7 no exige separarlas: no hay
 * ningún otro caller que solo necesite leer).
 *
 * Reglas (INV-2, INV-5):
 *  - Si `requisitoId` referencia un aporte que YA tiene un documento
 *    lógico (`aportes[].documentoIds[0]`), esta subida agrega una VERSIÓN
 *    NUEVA a ESE documento — `numeroVersion = totalVersiones + 1`, LEÍDO
 *    dentro de esta misma transacción (nunca asumido desde una lectura
 *    previa fuera de la tx: evita una condición de carrera entre lectura
 *    y escritura).
 *  - En cualquier otro caso (sin `requisitoId`, o el aporte aún sin
 *    documento), crea un documento lógico NUEVO con su v0001.
 *  - `tx.create()` del doc de versión (id `vNNNN` determinista) — si el
 *    id ya existiera (no debería, dado que `numeroVersion` se leyó en
 *    esta misma tx), la transacción aborta: candado natural contra
 *    duplicado, sin necesitar una comprobación explícita adicional.
 *  - El aporte del requisito (si aplica) pasa a `APORTADO` con
 *    `documentoIds: [documentoId]` — el documento LÓGICO, nunca el id de
 *    la versión (addendum A2 aprobado 8-ago sobre `AporteRequisito.
 *    documentoIds`, ver JSDoc de ese campo en `tipos.ts`).
 *
 * NO toca Storage — el caller sube a staging ANTES de abrir la tx y mueve
 * a `storagePathFinal` DESPUÉS del commit (INV-2, patrón H3).
 */
export async function planSubirDocumento(
  tx: Transaction,
  db: Firestore,
  expedienteId: string,
  tenantId: string,
  aportesActuales: AporteRequisito[],
  input: SubirDocumentoInput,
  actor: ActorExpediente,
  ahora: Date,
): Promise<PlanSubirDocumento> {
  const documentosCol = () => db.collection(`expedientes/${expedienteId}/${SUBCOLECCION_DOCUMENTOS}`);
  const nowIso = ahora.toISOString();

  // ¿El requisito ya tiene un documento lógico enlazado? (versión nueva sobre uno existente)
  const aporteExistente = input.requisitoId
    ? aportesActuales.find((a) => a.requisitoId === input.requisitoId)
    : undefined;
  const documentoIdExistente = aporteExistente?.documentoIds?.[0];

  let documentoRef: DocumentReference;
  let documentoId: string;
  let totalVersionesActual: number;
  let documentoNuevo: boolean;
  let nombreDocumento: string;
  let requisitoIdDocumento: string | undefined;
  let creadoEnDocumento: string;

  if (documentoIdExistente) {
    // LECTURA dentro de la tx — numeroVersion sale de ESTE dato, no de un
    // conteo externo (evita condición de carrera entre lectura y escritura).
    documentoRef = documentosCol().doc(documentoIdExistente);
    const snap = await tx.get(documentoRef);
    const existente = snap.data() as DocumentoExpedienteDoc | undefined;
    documentoId = documentoIdExistente;
    totalVersionesActual = existente?.totalVersiones ?? 0;
    documentoNuevo = false;
    nombreDocumento = existente?.nombre ?? input.nombre ?? input.archivo.filenameSaneado;
    requisitoIdDocumento = existente?.requisitoId ?? input.requisitoId;
    creadoEnDocumento = existente?.creadoEn ?? nowIso;
  } else {
    documentoRef = documentosCol().doc();
    documentoId = documentoRef.id;
    totalVersionesActual = 0;
    documentoNuevo = true;
    nombreDocumento = input.nombre?.trim() || input.archivo.filenameSaneado;
    requisitoIdDocumento = input.requisitoId;
    creadoEnDocumento = nowIso;
  }

  const numeroVersion = totalVersionesActual + 1;
  const storagePathFinal = construirStoragePathVersion(expedienteId, documentoId, numeroVersion, input.archivo.filenameSaneado);

  const version: VersionDocumentoExpedienteDoc = {
    numeroVersion,
    storagePath: storagePathFinal,
    hashSha256: input.archivo.hashSha256,
    tamanioBytes: input.archivo.tamanioBytes,
    mimeType: input.archivo.mimeType,
    subidoPor: { uid: actor.uid, nombre: actor.nombre },
    subidoEn: nowIso,
    tenantId,
  };

  const versionRef = documentoRef.collection(SUBCOLECCION_VERSIONES).doc(formatearIdVersion(numeroVersion));
  // tx.create: falla si el id ya existe — candado natural (ver JSDoc arriba).
  tx.create(versionRef, version);

  const documentoLogico: DocumentoExpedienteDoc = {
    id: documentoId,
    tenantId,
    nombre: nombreDocumento,
    ...(requisitoIdDocumento ? { requisitoId: requisitoIdDocumento } : {}),
    creadoEn: creadoEnDocumento,
    versionVigente: version,
    totalVersiones: numeroVersion,
  };
  if (documentoNuevo) {
    tx.create(documentoRef, documentoLogico);
  } else {
    tx.update(documentoRef, { versionVigente: version, totalVersiones: numeroVersion });
  }

  let aportesActualizados: AporteRequisito[] | undefined;
  if (input.requisitoId) {
    const yaTieneAporte = aportesActuales.some((a) => a.requisitoId === input.requisitoId);
    aportesActualizados = yaTieneAporte
      ? aportesActuales.map((a) => (
        a.requisitoId === input.requisitoId
          ? { ...a, estado: 'APORTADO' as const, documentoIds: [documentoId] }
          : a
      ))
      : [...aportesActuales, { requisitoId: input.requisitoId, estado: 'APORTADO' as const, documentoIds: [documentoId] }];
  }

  return { storagePathFinal, documentoNuevo, documentoId, numeroVersion, aportesActualizados };
}
