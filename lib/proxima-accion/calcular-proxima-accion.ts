import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

/**
 * Panel Operativo Fase 1 — cálculo determinístico de la "próxima acción
 * esperada" del radicado según su estado y sub-señales.
 *
 * Reglas ordenadas por precedencia — la primera que aplica gana.
 * Cada regla retorna también un `ruleId` para tooltip explicativo y
 * pruebas específicas (una prueba por regla).
 *
 * Función pura: cero side effects, cero acceso a Firestore, cero
 * dependencias de React. Testeable en aislamiento total.
 */

export type UrgenciaAccion = 'critica' | 'alta' | 'media' | 'ninguna';

export type RuleIdProximaAccion =
  | 'NOTIFICACION_FALLIDA'
  | 'VENCIDO'
  | 'POR_VENCER'
  | 'PENDIENTE_SIN_RESPONSABLE'
  | 'PENDIENTE_CON_RESPONSABLE'
  | 'ASIGNADO'
  | 'EN_REVISION'
  | 'EN_PROCESO'
  | 'PRORROGA'
  | 'DEVUELTO'
  | 'RESUELTO'
  | 'RECHAZADO'
  | 'DESCONOCIDO';

export interface ProximaAccion {
  accion:  string;
  urgencia: UrgenciaAccion;
  ruleId:  RuleIdProximaAccion;
}

const ESTADOS_ACTIVOS = new Set<string>([
  'PENDIENTE', 'ASIGNADO', 'EN_REVISION', 'EN_PROCESO', 'DEVUELTO', 'PRORROGA',
]);

function estaActivo(estadoActual: string): boolean {
  return ESTADOS_ACTIVOS.has(estadoActual);
}

/**
 * Devuelve la próxima acción esperada para el radicado.
 * Las reglas se evalúan en orden estricto de precedencia:
 * las señales críticas (correo fallido, vencido, por vencer) ganan
 * sobre las derivadas de estado normal.
 */
export function calcularProximaAccion(radicado: VentanillaRadicado): ProximaAccion {
  const dias = radicado.termino?.fechaVencimiento
    ? diasRestantesHabiles(radicado.termino.fechaVencimiento)
    : 0;
  const activo = estaActivo(radicado.estadoActual);

  // Regla 1 — Notificación por correo fallida (mayor precedencia).
  if (radicado.alertaNotificacionFallida === true && activo) {
    return {
      accion:  'Gestionar notificación fallida por correo institucional',
      urgencia: 'alta',
      ruleId:  'NOTIFICACION_FALLIDA',
    };
  }

  // Regla 2 — Vencido y aún activo.
  if (activo && dias < 0) {
    return {
      accion:  'Responder inmediatamente · término legal excedido',
      urgencia: 'critica',
      ruleId:  'VENCIDO',
    };
  }

  // Regla 3 — Por vencer (0..2 días hábiles).
  if (activo && dias >= 0 && dias <= 2) {
    const diasLabel = dias === 0 ? 'vence hoy' : `vence en ${dias} d`;
    return {
      accion:  `Priorizar respuesta · ${diasLabel}`,
      urgencia: 'alta',
      ruleId:  'POR_VENCER',
    };
  }

  // Regla 4 — PENDIENTE sin responsable asignado.
  if (radicado.estadoActual === 'PENDIENTE'
      && !radicado.clasificacion?.funcionarioResponsableUid) {
    return {
      accion:  'Asignar a dependencia y responsable',
      urgencia: 'media',
      ruleId:  'PENDIENTE_SIN_RESPONSABLE',
    };
  }

  // Regla 5 — PENDIENTE con responsable.
  if (radicado.estadoActual === 'PENDIENTE') {
    return {
      accion:  'Iniciar revisión',
      urgencia: 'media',
      ruleId:  'PENDIENTE_CON_RESPONSABLE',
    };
  }

  // Regla 6 — ASIGNADO.
  if (radicado.estadoActual === 'ASIGNADO') {
    return {
      accion:  'Iniciar revisión',
      urgencia: 'media',
      ruleId:  'ASIGNADO',
    };
  }

  // Regla 7 — EN_REVISION.
  if (radicado.estadoActual === 'EN_REVISION') {
    return {
      accion:  'Proyectar respuesta',
      urgencia: 'media',
      ruleId:  'EN_REVISION',
    };
  }

  // Regla 8 — EN_PROCESO.
  if (radicado.estadoActual === 'EN_PROCESO') {
    return {
      accion:  'Continuar gestión y responder',
      urgencia: 'media',
      ruleId:  'EN_PROCESO',
    };
  }

  // Regla 9 — PRORROGA.
  if (radicado.estadoActual === 'PRORROGA') {
    return {
      accion:  'Continuar con prórroga vigente',
      urgencia: 'media',
      ruleId:  'PRORROGA',
    };
  }

  // Regla 10 — DEVUELTO.
  if (radicado.estadoActual === 'DEVUELTO') {
    return {
      accion:  'Requerir aclaración al ciudadano',
      urgencia: 'media',
      ruleId:  'DEVUELTO',
    };
  }

  // Regla 11 — RESUELTO.
  if (radicado.estadoActual === 'RESUELTO') {
    return {
      accion:  'Sin acción pendiente',
      urgencia: 'ninguna',
      ruleId:  'RESUELTO',
    };
  }

  // Regla 12 — RECHAZADO.
  if (radicado.estadoActual === 'RECHAZADO') {
    return {
      accion:  'Sin acción pendiente',
      urgencia: 'ninguna',
      ruleId:  'RECHAZADO',
    };
  }

  // Fallback defensivo: estado desconocido (no debería ocurrir).
  return {
    accion:  'Estado no reconocido',
    urgencia: 'media',
    ruleId:  'DESCONOCIDO',
  };
}
