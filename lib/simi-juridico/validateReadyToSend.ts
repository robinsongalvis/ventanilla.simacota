/**
 * validateReadyToSend — Control fuerte antes de marcar listo para envío.
 *
 * Un borrador solo puede marcarse "listo_para_envio" si pasa
 * TODAS las validaciones. Ninguna excepción.
 */

import type { ApprovalFlow } from '@/src/types/simi-approval';

export interface ReadyToSendResult {
  ready:     boolean;
  bloqueado: string[];   // razones por las que NO puede enviarse
  ok:        string[];   // controles que SÍ pasaron
}

export function validateReadyToSend(
  approval: ApprovalFlow,
  opciones?: {
    tieneFuentesPendientes?: boolean;
    tieneDatosSensiblesSinRevisar?: boolean;
    tieneVersionFinal?: boolean;
  },
): ReadyToSendResult {
  const bloqueado: string[] = [];
  const ok: string[] = [];

  // 1. Debe tener aprobación humana registrada
  const estadosAprobados = new Set(['aprobado_por_jefe', 'aprobado_por_juridica', 'listo_para_envio']);
  if (!estadosAprobados.has(approval.estado)) {
    bloqueado.push('El borrador no ha sido aprobado por el jefe de dependencia o asesor jurídico.');
  } else {
    ok.push('Aprobación humana registrada.');
  }

  // 2. Riesgo alto requiere aprobación jurídica específica
  if (approval.nivelRiesgo === 'alto' && approval.estado !== 'aprobado_por_juridica') {
    bloqueado.push('Casos de riesgo ALTO requieren aprobación del asesor jurídico (no solo del jefe).');
  } else if (approval.nivelRiesgo === 'alto') {
    ok.push('Riesgo alto con aprobación jurídica.');
  } else {
    ok.push(`Nivel de riesgo: ${approval.nivelRiesgo}.`);
  }

  // 3. No debe haber fuentes pendientes sin validar
  if (opciones?.tieneFuentesPendientes) {
    bloqueado.push('Existen fuentes normativas pendientes de verificación. Validar antes del envío.');
  } else {
    ok.push('Sin fuentes normativas pendientes.');
  }

  // 4. No debe haber datos sensibles sin revisión
  if (opciones?.tieneDatosSensiblesSinRevisar) {
    bloqueado.push('Se detectaron datos personales o sensibles que requieren revisión antes del envío.');
  } else {
    ok.push('Datos personales revisados.');
  }

  // 5. Debe tener una versión final del borrador
  if (opciones?.tieneVersionFinal === false) {
    bloqueado.push('No se encontró versión final del borrador. Generar o guardar el texto de respuesta.');
  } else {
    ok.push('Versión final del borrador disponible.');
  }

  // 6. Debe quedar registro de quién aprobó
  if (!approval.aprobadoPor) {
    bloqueado.push('No se registró quién aprobó el borrador. Completar el flujo de aprobación.');
  } else {
    ok.push(`Aprobado por: ${approval.aprobadoPor} (${approval.aprobadoPorRol ?? 'N/A'}).`);
  }

  // 7. No puede estar en estado "devuelto" o "pendiente"
  const estadosBloqueantes = new Set([
    'borrador_generado', 'pendiente_revision_jefe',
    'pendiente_revision_juridica', 'devuelto_para_ajustes',
  ]);
  if (estadosBloqueantes.has(approval.estado)) {
    bloqueado.push(`Estado actual "${approval.estado.replace(/_/g, ' ')}" no permite el envío. Completar el proceso de aprobación.`);
  }

  return {
    ready: bloqueado.length === 0,
    bloqueado,
    ok,
  };
}
