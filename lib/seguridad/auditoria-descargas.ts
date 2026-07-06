/**
 * Auditoría persistente de descargas de archivos internos — H-N04.
 *
 * Cada descarga (autorizada o denegada) queda registrada en la colección
 * `seguridad_descargas_auditoria` con datos mínimos para responder
 * preguntas forenses:
 *
 *   - ¿Quién descargó qué?
 *   - ¿Cuándo y desde qué IP (hasheada)?
 *   - ¿Qué denegaciones ocurrieron y por qué?
 *
 * Reutiliza el patrón de hash HMAC-SHA256 introducido en H-03 para IP y
 * User-Agent. NO guarda el path completo del archivo, tokens ni URLs
 * firmadas. TTL de 180 días controlado por el campo `expiresAt` (política
 * de Firestore aplicada por operaciones).
 */

import { createHmac } from 'node:crypto';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';

const TTL_DIAS = 180;
const MAX_ARCHIVO_NOMBRE = 200;
const MAX_ACTOR_NOMBRE = 120;

export type EventoDescarga =
  | 'ARCHIVO_DESCARGA_AUTORIZADA'
  | 'ARCHIVO_DESCARGA_DENEGADA';

export interface RegistroDescargaParams {
  evento:        EventoDescarga;
  /** Id del documento dueño: radicadoId o salidaId (oficios 2-SAL). */
  radicadoId:    string;
  /** Valor del `tipoArchivo` que concedió la autorización (o null si se denegó). */
  tipoArchivo:   string | null;
  archivoNombre: string;
  motivo?:       string;
  actorUid:      string;
  actorNombre:   string;
  actorRol:      string;
  actorTenant:   string;
  ip?:           string | null;
  userAgent?:    string | null;
}

function secretoHash(): string {
  return process.env.CONSULTA_HASH_SECRET
    ?? process.env.FIREBASE_SERVICE_ACCOUNT
    ?? 'ventanilla-descargas-runtime';
}

function hashear(valor: string): string {
  return createHmac('sha256', secretoHash()).update(valor, 'utf8').digest('hex');
}

/**
 * Registra el evento en Firestore. Nunca lanza — fire-and-forget
 * compatible con `.catch()` desde el endpoint. Falla silenciosa preserva
 * la respuesta 302 al usuario si Firestore no responde.
 */
export async function registrarDescargaAuditoria(
  params: RegistroDescargaParams,
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_DIAS * 86_400_000);

    await getFirebaseAdminDb().collection('seguridad_descargas_auditoria').add({
      fecha:         now.toISOString(),
      evento:        params.evento,
      radicadoId:    params.radicadoId,
      archivoNombre: params.archivoNombre.slice(0, MAX_ARCHIVO_NOMBRE),
      tipoArchivo:   params.tipoArchivo,
      ...(params.motivo ? { motivo: params.motivo } : {}),
      actorUid:      params.actorUid,
      actorNombre:   params.actorNombre.slice(0, MAX_ACTOR_NOMBRE),
      actorRol:      params.actorRol,
      actorTenant:   params.actorTenant,
      ...(params.ip ? { ipHash: hashear(params.ip) } : {}),
      ...(params.userAgent
        ? { userAgentHash: hashear(params.userAgent.slice(0, 200)) }
        : {}),
      expiresAt,
    });
  } catch {
    // La auditoría no debe bloquear la descarga ni convertir un 302 en 500.
  }
}
