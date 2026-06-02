/**
 * createApprovalFlow — Flujo de aprobación humana.
 * Colección: simi_aprobaciones_respuesta
 *
 * Ningún borrador puede pasar a "enviado" sin aprobación humana.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { ApprovalFlow, ApprovalRules, ApprovalStatus, ApprovalFlowResult } from '@/src/types/simi-approval';

/**
 * Determinar el estado inicial según reglas de riesgo.
 */
export function determinarEstadoInicial(rules: ApprovalRules): {
  estado: ApprovalStatus;
  motivoRevision: string[];
  requiereRevisionJuridica: boolean;
} {
  const motivos: string[] = [];
  let requiereJuridica = false;

  // Riesgo alto → jurídica obligatoria
  if (rules.nivelRiesgo === 'alto') {
    requiereJuridica = true;
    motivos.push('Nivel de riesgo ALTO detectado por SIMI.');
  }

  // Datos sensibles → jurídica
  if (rules.tieneDatosSensibles) {
    requiereJuridica = true;
    motivos.push('Se detectaron datos personales o sensibles.');
  }

  // Menores → jurídica
  if (rules.tieneMenoresEdad) {
    requiereJuridica = true;
    motivos.push('Caso que involucra menores de edad.');
  }

  // Ente de control → jurídica
  if (rules.esEnteControl) {
    requiereJuridica = true;
    motivos.push('Requerimiento de ente de control.');
  }

  // Tutela/demanda → jurídica
  if (rules.esTutela) {
    requiereJuridica = true;
    motivos.push('Posible tutela, demanda o amenaza jurídica.');
  }

  // Respuesta negativa que afecta derechos → jurídica
  if (rules.esRespuestaNegativa && rules.afectaDerechosFundamentales) {
    requiereJuridica = true;
    motivos.push('Respuesta negativa con posible afectación de derechos fundamentales.');
  }

  // Respuesta negativa sin afectación a derechos → jefe de dependencia
  if (rules.esRespuestaNegativa && !rules.afectaDerechosFundamentales && !requiereJuridica) {
    motivos.push('Respuesta negativa — requiere revisión del jefe de dependencia.');
  }

  // Riesgo medio → jefe de dependencia
  if (rules.nivelRiesgo === 'medio' && !requiereJuridica) {
    motivos.push('Nivel de riesgo MEDIO — se recomienda revisión del jefe de dependencia.');
  }

  // Estado inicial
  const estado: ApprovalStatus = requiereJuridica
    ? 'pendiente_revision_juridica'
    : rules.nivelRiesgo === 'bajo'
      ? 'borrador_generado'
      : 'pendiente_revision_jefe';

  return { estado, motivoRevision: motivos, requiereRevisionJuridica: requiereJuridica };
}

/**
 * Crear flujo de aprobación en Firestore.
 */
export async function createApprovalFlow(params: {
  radicadoId:   string;
  tenantId:     string;
  usuarioId:    string;
  usuarioNombre: string;
  usuarioRol:   string;
  simiAuditId?: string;
  rules:        ApprovalRules;
}): Promise<ApprovalFlowResult> {
  const { estado, motivoRevision, requiereRevisionJuridica } = determinarEstadoInicial(params.rules);

  const ahora = new Date().toISOString();
  const flujo: Omit<ApprovalFlow, 'id'> = {
    radicadoId:               params.radicadoId,
    simiAuditId:              params.simiAuditId,
    tenantId:                 params.tenantId,
    estado,
    nivelRiesgo:              params.rules.nivelRiesgo,
    requiereRevisionJuridica,
    motivoRevision,
    historial: [
      {
        estado,
        usuarioId:    params.usuarioId,
        usuarioNombre: params.usuarioNombre,
        rol:          params.usuarioRol,
        fecha:        ahora,
        observacion:  'Flujo creado automáticamente por SIMI Jurídico.',
      },
    ],
    createdAt: ahora,
    updatedAt: ahora,
  };

  const ref = await getFirebaseAdminDb()
    .collection('simi_aprobaciones_respuesta')
    .add(flujo);

  const mensajes: Record<ApprovalStatus, string> = {
    borrador_generado:             'Borrador generado. Disponible para revisión voluntaria.',
    pendiente_revision_jefe:       'Pendiente de revisión por el jefe de dependencia antes del envío.',
    pendiente_revision_juridica:   'REVISIÓN JURÍDICA OBLIGATORIA antes de emitir respuesta oficial.',
    devuelto_para_ajustes:         'Devuelto para ajustes.',
    aprobado_por_jefe:             'Aprobado por jefe de dependencia.',
    aprobado_por_juridica:         'Aprobado por asesor jurídico.',
    listo_para_envio:              'Listo para envío.',
    enviado:                       'Enviado.',
  };

  return {
    approvalId:               ref.id,
    estado,
    mensaje:                  mensajes[estado],
    requiereRevisionJuridica,
    nivelRiesgo:              params.rules.nivelRiesgo,
  };
}

/**
 * Actualizar estado del flujo de aprobación.
 * Registra en historial.
 */
export async function updateApprovalFlow(params: {
  approvalId:    string;
  nuevoEstado:   ApprovalStatus;
  usuarioId:     string;
  usuarioNombre: string;
  rol:           string;
  observacion?:  string;
}): Promise<void> {
  const ahora = new Date().toISOString();
  const db    = getFirebaseAdminDb();
  const docRef = db.collection('simi_aprobaciones_respuesta').doc(params.approvalId);

  const snap = await docRef.get();
  if (!snap.exists) throw new Error('Flujo de aprobación no encontrado.');

  const data = snap.data() as ApprovalFlow;

  const nuevoItem = {
    estado:       params.nuevoEstado,
    usuarioId:    params.usuarioId,
    usuarioNombre: params.usuarioNombre,
    rol:          params.rol,
    fecha:        ahora,
    observacion:  params.observacion,
  };

  await docRef.update({
    estado:     params.nuevoEstado,
    historial:  [...(data.historial ?? []), nuevoItem],
    updatedAt:  ahora,
    ...(params.nuevoEstado === 'aprobado_por_jefe' || params.nuevoEstado === 'aprobado_por_juridica'
      ? { aprobadoPor: params.usuarioId, aprobadoPorRol: params.rol, fechaAprobacion: ahora }
      : {}),
    ...(params.nuevoEstado === 'devuelto_para_ajustes'
      ? { devueltoPor: params.usuarioId, motivoDevolucion: params.observacion }
      : {}),
  });
}
