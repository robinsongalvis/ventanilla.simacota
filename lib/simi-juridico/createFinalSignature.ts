/**
 * createFinalSignature — Firma/aprobación final de respuesta institucional.
 * Colección: simi_respuestas_firma
 *
 * No permite firma si validateReadyToSend falla.
 * Guarda la versión exacta enviada para auditoría MIPG.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { validateReadyToSend } from './validateReadyToSend';
import { canReadTenant, type InternalUserSession } from '@/lib/server/internal-auth';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import type { TenantId } from '@/src/types/radicado';
import type { ApprovalFlow }   from '@/src/types/simi-approval';
import type { RespuestaFirma, CanalEnvio } from '@/src/types/simi-firma';

export interface CreateFirmaParams {
  radicadoId:          string;
  aprobacionId:        string;
  firmadoPor:          string;
  firmadoPorCargo?:    string;
  /** Compatibilidad con callers servidor: el valor efectivo se deriva del radicado. */
  dependencia:         string;
  /** Compatibilidad con callers servidor: el valor efectivo se deriva del radicado. */
  tenantId:            string;
  textoRespuestaFinal?: string;
  canalEnvio?:         CanalEnvio;
  emailCiudadano?:     string;
  borradorVersionId?:  string;
  /** Obligatorio desde HTTP; omitido solo por el caller servidor E2E cerrado en Production. */
  actor?: InternalUserSession;
}

export class FirmaValidationError extends Error {
  constructor(message: string, readonly status: 403 | 404 | 422) {
    super(message);
    this.name = 'FirmaValidationError';
  }
}

/** Genera un hash SHA-256 simple del texto (para trazabilidad) */
async function hashTexto(texto: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16).toUpperCase();
}

export interface CreateFirmaResult {
  firmaId:  string;
  estado:   string;
  mensaje:  string;
  hashDocumento?: string;
}

/**
 * Valida permiso, pertenencia y aprobación humana antes de confirmar firma y
 * estado en una única transacción. El actor omitido se reserva al caller E2E
 * servidor, cerrado en Production; HTTP siempre proporciona la sesión validada.
 */
export async function createFinalSignature(
  params: CreateFirmaParams,
): Promise<CreateFirmaResult> {
  const db = getFirebaseAdminDb();

  const approvalRef = db.collection('simi_aprobaciones_respuesta').doc(params.aprobacionId);
  const ref = db.collection('simi_respuestas_firma').doc();
  const ahora = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    // El permiso y las relaciones se revalidan si Firestore reintenta la
    // transacción: un traslado concurrente no autoriza la firma en el tenant anterior.
    const radicadoSnap = await tx.get(db.collection('ventanilla_radicados').doc(params.radicadoId));
    if (!radicadoSnap.exists) throw new FirmaValidationError('Radicado no encontrado.', 404);
    const tenant: unknown = radicadoSnap.data()?.clasificacion?.oficinaDestino;
    if (typeof tenant !== 'string' || !Object.prototype.hasOwnProperty.call(DIRECTORIO_TENANTS, tenant)) {
      throw new FirmaValidationError('El radicado no tiene una dependencia válida para la firma.', 422);
    }
    const tenantId = tenant as TenantId;
    if (params.actor && (params.actor.rol !== 'ADMIN' && params.actor.rol !== 'JEFE_DEPENDENCIA'
      || !canReadTenant(params.actor, tenantId))) {
      throw new FirmaValidationError('Sin acceso para firmar este radicado.', 403);
    }

    const approvalSnap = await tx.get(approvalRef);
    if (!approvalSnap.exists) throw new FirmaValidationError('Flujo de aprobación no encontrado.', 404);
    const flujo = approvalSnap.data() as ApprovalFlow;
    if (flujo.radicadoId !== params.radicadoId) {
      throw new FirmaValidationError('La aprobación no corresponde al radicado.', 403);
    }
    if (params.actor?.rol === 'JEFE_DEPENDENCIA' && flujo.tenantId !== params.actor.tenantId) {
      throw new FirmaValidationError('Sin acceso a la dependencia de esta aprobación.', 403);
    }
    if (params.borradorVersionId) {
      const borradorSnap = await tx.get(db.collection('simi_borrador_versiones').doc(params.borradorVersionId));
      if (!borradorSnap.exists) throw new FirmaValidationError('Versión de borrador no encontrada.', 404);
      const borrador = borradorSnap.data();
      if (borrador?.radicadoId !== params.radicadoId
        || borrador.approvalId !== undefined && borrador.approvalId !== params.aprobacionId) {
        throw new FirmaValidationError('El borrador no corresponde al radicado o a su aprobación.', 403);
      }
    }

    const validacion = validateReadyToSend(flujo);
    if (!validacion.ready) {
      throw new FirmaValidationError(`No se puede firmar: ${validacion.bloqueado[0] ?? 'Validación fallida.'}`, 422);
    }

    // Fallar al calcular SHA-256 aborta toda la operación; no se fabrica evidencia.
    const hashDocumento = params.textoRespuestaFinal ? await hashTexto(params.textoRespuestaFinal) : undefined;
    const firma: Omit<RespuestaFirma, 'id'> = {
      radicadoId:          params.radicadoId,
      borradorVersionId:   params.borradorVersionId,
      aprobacionId:        params.aprobacionId,
      aprobadoPor:         flujo.aprobadoPor ?? params.firmadoPor,
      aprobadoPorRol:      flujo.aprobadoPorRol ?? '',
      firmadoPor:          params.firmadoPor,
      firmadoPorCargo:     params.firmadoPorCargo,
      dependencia:         tenantId,
      estado:              'firmado',
      textoRespuestaFinal: params.textoRespuestaFinal,
      hashDocumento,
      fechaFirma:          ahora,
      canalEnvio:          params.canalEnvio,
      emailCiudadano:      params.emailCiudadano,
      digitalSignatureStatus: 'no_requerida',
      tenantId,
      createdAt:           ahora,
      updatedAt:           ahora,
    };
    tx.create(ref, removeUndefinedDeep(firma));
    tx.update(approvalRef, { estado: 'listo_para_envio', updatedAt: ahora });

    return {
      firmaId: ref.id,
      estado: 'firmado',
      mensaje: 'Firma registrada. La respuesta está lista para envío oficial.',
      hashDocumento,
    };
  });
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
    .update(removeUndefinedDeep({
      estado:             params.nuevoEstado,
      fechaEnvio:         params.fechaEnvio ?? (params.nuevoEstado === 'enviado_ciudadano' ? ahora : undefined),
      notificadoWhatsApp: params.notificado ?? false,
      updatedAt:          ahora,
    }));
}
