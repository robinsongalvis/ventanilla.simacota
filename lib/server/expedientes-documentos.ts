import { createHash, randomUUID } from 'node:crypto';
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
import type {
  ErrorExpediente,
  ActorExpediente,
  ActuacionLicenciaDoc,
} from '@/lib/server/expedientes-licencias';

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
  /**
   * La actuación escrita en el historial, si correspondía escribirla (solo
   * desde la radicación en debida forma). Se devuelve para que el caller pueda
   * responderla y para que las pruebas la vean sin espiar la transacción.
   */
  actuacion?: ActuacionLicenciaDoc;
}

/* ══════════════════════════════════════════════════════════════════════════
   EL MOVIMIENTO DE UN DOCUMENTO ES UN HECHO DEL EXPEDIENTE

   ── EL DEFECTO QUE ESTO CIERRA ────────────────────────────────────────────

   Hasta el 9-sep-2026 subir, reemplazar o actualizar un documento NO dejaba
   rastro alguno en el historial: la ruta de documentos no escribía ni una
   actuación. Lo probó el propietario y no encontró nada.

   Las VERSIONES sí se guardaban —`documentos/{id}/versiones/vNNNN`, ninguna se
   borra jamás—, así que la evidencia nunca se perdió. Lo que faltaba era el
   HECHO: cuándo cambió, quién lo cambió y a qué versión. Sin eso, un
   expediente no puede responder la pregunta que un juez hace primero cuando
   una licencia se demanda: «¿cuál plano evaluó la Secretaría?».

   ── DESDE CUÁNDO SE REGISTRA, Y POR QUÉ NO ANTES ──────────────────────────

   Desde la RADICACIÓN EN DEBIDA FORMA. Antes de ese hito el ciudadano todavía
   está armando su solicitud: registrar los dieciocho documentos del intake
   como dieciocho hechos ahogaría los cinco o seis que de verdad cuentan. Desde
   la debida forma el contenido documental está fijado y cualquier cambio
   importa — que es exactamente lo que el propietario pidió ver.

   Las versiones anteriores a ese hito siguen guardándose igual: lo que no se
   escribe es la línea del historial, no el archivo.

   ── ESTO NO MUEVE EL RELOJ, Y ES DELIBERADO ───────────────────────────────

   Ninguno de los dos slugs está en `SLUG_A_TIPO_EVENTO`
   (`lib/motor-expedientes/termino.ts`), así que `derivarEventosTermino` los
   ignora por construcción. No es un olvido: la norma no suspende el término
   porque se cambie un papel, y el propio `MODIFICACION_SOLICITUD` está
   declarado inerte por el mismo motivo. Cambiar un documento deja huella
   archivística; no detiene un plazo.

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: los documentos que ENTRAN (aporte nuevo y reemplazo por versión
   nueva), desde la debida forma en adelante.
   Esto NO MIRA: el intake previo a la debida forma; el retiro de un documento
   —hoy no existe ninguna ruta que borre, así que no hay hecho que registrar—;
   ni los cambios de `contexto` o del checklist, que no son documentos.
══════════════════════════════════════════════════════════════════════════ */

/** Primer aporte de un documento lógico. */
export const SLUG_DOCUMENTO_APORTADO = 'documento-aportado';
/** Versión nueva sobre un documento que ya existía — el CAMBIO. */
export const SLUG_DOCUMENTO_REEMPLAZADO = 'documento-reemplazado';

/**
 * La actuación que deja constancia del movimiento. PURA: se puede probar sin
 * Firestore, y el caller decide si la escribe.
 *
 * `detalle` es prosa para el auditor; todo lo verificable viaja en
 * `evidenciaDocumento`. El resumen que lee la funcionaria se compone de esos
 * campos, nunca partiendo esta frase.
 */
export function construirActuacionMovimientoDocumento(
  expedienteId: string,
  tenantId: string,
  evidencia: { documentoId: string; nombre: string; numeroVersion: number; requisitoId?: string; hashSha256: string },
  actor: ActorExpediente,
  ahora: Date,
): ActuacionLicenciaDoc {
  const esReemplazo = evidencia.numeroVersion > 1;
  return {
    id: randomUUID(),
    expedienteId,
    tenantId,
    tipo: esReemplazo ? SLUG_DOCUMENTO_REEMPLAZADO : SLUG_DOCUMENTO_APORTADO,
    etapa: 'documentacion',
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    fecha: ahora.toISOString(),
    origen: 'REAL',
    evidenciaDocumento: {
      documentoId: evidencia.documentoId,
      nombre: evidencia.nombre,
      numeroVersion: evidencia.numeroVersion,
      ...(evidencia.requisitoId ? { requisitoId: evidencia.requisitoId } : {}),
      hashSha256: evidencia.hashSha256,
    },
    detalle: esReemplazo
      ? `Se reemplazó el documento "${evidencia.nombre}" con una versión nueva (v${evidencia.numeroVersion}). La versión anterior se conserva.`
      : `Se aportó el documento "${evidencia.nombre}".`,
  };
}

/**
 * ¿Este movimiento deja constancia en el historial? Solo desde la radicación
 * en debida forma — ver el bloque de arriba.
 *
 * Función propia y no un `if` en línea porque es la REGLA, y una regla que
 * vive dentro de otra función no se puede probar ni encontrar.
 */
export function registraMovimientoEnHistorial(anclaDebidaForma: string | null | undefined): boolean {
  return Boolean(anclaDebidaForma);
}

/**
 * Lo que la subida necesita saber del expediente.
 *
 * Va como OBJETO y no como tres parámetros sueltos por una razón concreta: al
 * añadir `anclaDebidaForma` la función habría llegado a nueve posicionales, y
 * —más importante— siendo un campo del objeto, el compilador OBLIGA a cada
 * llamador nuevo a decidir si este expediente ya está radicado. Un opcional
 * habría dejado que un llamador futuro se olvidara y perdiera el rastro sin
 * que nada avisara: la misma familia de defecto que este cambio viene a cerrar.
 */
export interface ExpedienteParaSubida {
  id: string;
  tenantId: string;
  aportes: AporteRequisito[];
  /** ISO de la radicación en debida forma, o `null` si todavía no ocurrió. */
  anclaDebidaForma: string | null;
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
  expediente: ExpedienteParaSubida,
  input: SubirDocumentoInput,
  actor: ActorExpediente,
  ahora: Date,
): Promise<PlanSubirDocumento> {
  const { id: expedienteId, tenantId, aportes: aportesActuales } = expediente;
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

  /* EL HECHO, EN LA MISMA TRANSACCIÓN QUE LA VERSIÓN. No después: si se
     escribiera fuera, un fallo entre las dos dejaría una versión sin historial
     —o un historial que anuncia una versión que no existe—, y el expediente
     mentiría sobre su propio contenido en el momento exacto en que más
     importa. */
  let actuacion: ActuacionLicenciaDoc | undefined;
  if (registraMovimientoEnHistorial(expediente.anclaDebidaForma)) {
    actuacion = construirActuacionMovimientoDocumento(
      expedienteId,
      tenantId,
      {
        documentoId,
        nombre: nombreDocumento,
        numeroVersion,
        ...(requisitoIdDocumento ? { requisitoId: requisitoIdDocumento } : {}),
        hashSha256: input.archivo.hashSha256,
      },
      actor,
      ahora,
    );
    tx.create(db.collection(`expedientes/${expedienteId}/actuaciones`).doc(actuacion.id), actuacion);
  }

  return { storagePathFinal, documentoNuevo, documentoId, numeroVersion, aportesActualizados, actuacion };
}
