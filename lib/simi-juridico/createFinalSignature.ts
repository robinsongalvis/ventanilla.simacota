/**
 * createFinalSignature — Firma/aprobación final de respuesta institucional.
 * Colección: simi_respuestas_firma
 *
 * No permite firma si validateReadyToSend falla.
 * Guarda la versión exacta enviada para auditoría MIPG.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { validateReadyToSend } from './validateReadyToSend';
import type { ApprovalFlow }   from '@/src/types/simi-approval';
import type { RespuestaFirma, CanalEnvio } from '@/src/types/simi-firma';

interface CreateFirmaParams {
  radicadoId:          string;
  aprobacionId:        string;
  firmadoPor:          string;
  firmadoPorCargo?:    string;
  dependencia:         string;
  tenantId:            string;
  textoRespuestaFinal?: string;
  canalEnvio?:         CanalEnvio;
  emailCiudadano?:     string;
  borradorVersionId?:  string;
}

/** Genera un hash SHA-256 simple del texto (para trazabilidad) */
async function hashTexto(texto: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16).toUpperCase();
  } catch {
    return `HASH-${Date.now().toString(36).toUpperCase()}`;
  }
}

export interface CreateFirmaResult {
  firmaId:  string;
  estado:   string;
  mensaje:  string;
  hashDocumento?: string;
}

export async function createFinalSignature(
  params: CreateFirmaParams,
): Promise<CreateFirmaResult> {
  const db = getFirebaseAdminDb();

  // 1. Obtener el flujo de aprobación
  const approvalSnap = await db
    .collection('simi_aprobaciones_respuesta')
    .doc(params.aprobacionId)
    .get();

  if (!approvalSnap.exists) {
    throw new Error('Flujo de aprobación no encontrado.');
  }

  const flujo = approvalSnap.data() as ApprovalFlow;

  // 2. Validar que puede firmarse
  const validacion = validateReadyToSend(flujo);
  if (!validacion.ready) {
    throw new Error(
      `No se puede firmar: ${validacion.bloqueado[0] ?? 'Validación fallida.'}`,
    );
  }

  // 3. Calcular hash del documento
  const hashDocumento = params.textoRespuestaFinal
    ? await hashTexto(params.textoRespuestaFinal)
    : undefined;

  const ahora = new Date().toISOString();

  const firma: Omit<RespuestaFirma, 'id'> = {
    radicadoId:          params.radicadoId,
    borradorVersionId:   params.borradorVersionId,
    aprobacionId:        params.aprobacionId,
    aprobadoPor:         flujo.aprobadoPor ?? params.firmadoPor,
    aprobadoPorRol:      flujo.aprobadoPorRol ?? '',
    firmadoPor:          params.firmadoPor,
    firmadoPorCargo:     params.firmadoPorCargo,
    dependencia:         params.dependencia,
    estado:              'firmado',
    textoRespuestaFinal: params.textoRespuestaFinal,
    hashDocumento,
    fechaFirma:          ahora,
    canalEnvio:          params.canalEnvio,
    emailCiudadano:      params.emailCiudadano,
    tenantId:            params.tenantId,
    createdAt:           ahora,
    updatedAt:           ahora,
  };

  const ref = await db.collection('simi_respuestas_firma').add(firma);

  // 4. Actualizar el flujo de aprobación a listo_para_envio
  await db.collection('simi_aprobaciones_respuesta')
    .doc(params.aprobacionId)
    .update({ estado: 'listo_para_envio', updatedAt: ahora });

  return {
    firmaId:       ref.id,
    estado:        'firmado',
    mensaje:       'Firma registrada. La respuesta está lista para envío oficial.',
    hashDocumento,
  };
}

/** Actualizar estado de la firma (enviado, notificado, cerrado) */
export async function updateFirmaEstado(params: {
  firmaId:        string;
  nuevoEstado:    RespuestaFirma['estado'];
  fechaEnvio?:    string;
  notificado?:    boolean;
}): Promise<void> {
  const ahora = new Date().toISOString();
  await getFirebaseAdminDb()
    .collection('simi_respuestas_firma')
    .doc(params.firmaId)
    .update({
      estado:             params.nuevoEstado,
      fechaEnvio:         params.fechaEnvio ?? (params.nuevoEstado === 'enviado_ciudadano' ? ahora : undefined),
      notificadoWhatsApp: params.notificado ?? false,
      updatedAt:          ahora,
    });
}
