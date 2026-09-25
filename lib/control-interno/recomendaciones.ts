/**
 * Recomendaciones del día para Control Interno.
 *
 * Devuelve hasta 5 acciones sugeridas en lenguaje humano, ordenadas por
 * urgencia, para responder la pregunta "¿qué debo revisar hoy?".
 *
 * Función pura — no accede a Firestore. El consumidor le pasa contadores
 * ya derivados (alertas críticas, vencidos, hallazgos abiertos, etc.).
 */

import type {
  AlertaControlInterno,
  DesempenoDependencia,
  HallazgoControlInterno,
  NivelRiesgo,
  PlanMejora,
} from '@/src/types/control-interno';

export type SeveridadRecomendacion = 'POSITIVO' | 'INFORMATIVO' | 'ATENCION' | 'URGENTE';

export interface RecomendacionDia {
  titulo:    string;
  detalle?:  string;
  severidad: SeveridadRecomendacion;
}

interface EntradaRecomendaciones {
  alertas:      AlertaControlInterno[];
  hallazgos:    HallazgoControlInterno[];
  planes:       PlanMejora[];
  dependencias: DesempenoDependencia[];
  ahora?:       Date;
}

function fechaCompromiso(plan: PlanMejora): Date | null {
  const t = Date.parse(plan.fechaCompromiso);
  return Number.isNaN(t) ? null : new Date(t);
}

function esPlanVencido(plan: PlanMejora, ahora: Date): boolean {
  if (plan.estado === 'CUMPLIDO') return false;
  if (plan.estado === 'VENCIDO')  return true;
  const f = fechaCompromiso(plan);
  return f !== null && f.getTime() < ahora.getTime();
}

export function generarRecomendacionesDia(input: EntradaRecomendaciones): RecomendacionDia[] {
  const ahora = input.ahora ?? new Date();
  const recomendaciones: RecomendacionDia[] = [];

  const alertasAbiertas = input.alertas.filter((a) => a.estado === 'ABIERTA');
  const vencidos      = alertasAbiertas.filter((a) => a.tipo === 'RADICADO_VENCIDO');
  const porVencer     = alertasAbiertas.filter((a) => a.tipo === 'RADICADO_POR_VENCER');
  const sinResponsable = alertasAbiertas.filter((a) => a.tipo === 'SIN_RESPONSABLE');
  const notifFallidas = alertasAbiertas.filter((a) => a.tipo === 'NOTIFICACION_FALLIDA');

  const hallazgosAbiertos = input.hallazgos.filter(
    (h) => h.estado !== 'CERRADO' && (h.nivel === 'ALTO' || h.nivel === 'CRITICO'),
  );
  const hallazgosOtros = input.hallazgos.filter(
    (h) => h.estado !== 'CERRADO' && h.nivel !== 'ALTO' && h.nivel !== 'CRITICO',
  );
  const planesVencidos = input.planes.filter((p) => esPlanVencido(p, ahora));
  const planesPendientes = input.planes.filter(
    (p) => (p.estado === 'PENDIENTE' || p.estado === 'EN_EJECUCION') && !esPlanVencido(p, ahora),
  );

  const dependenciasEnRiesgo = input.dependencias.filter(
    (d) => d.nivelRiesgo === 'ALTO' || d.nivelRiesgo === 'CRITICO',
  );
  const dependenciasBajoCumpl = input.dependencias.filter(
    (d) => d.total >= 3 && d.cumplimientoPct < 75,
  );

  // 1. Vencidos
  if (vencidos.length > 0) {
    recomendaciones.push({
      severidad: 'URGENTE',
      titulo: `Revisar ${vencidos.length} radicado${vencidos.length === 1 ? '' : 's'} vencido${vencidos.length === 1 ? '' : 's'}.`,
      detalle: 'Escale a la dependencia responsable y registre la observación correspondiente.',
    });
  }

  // 2. Plan vencido
  if (planesVencidos.length > 0) {
    recomendaciones.push({
      severidad: 'URGENTE',
      titulo: `Solicitar evidencia de ${planesVencidos.length} plan${planesVencidos.length === 1 ? '' : 'es'} de mejora vencido${planesVencidos.length === 1 ? '' : 's'}.`,
      detalle: 'Confirme avance con el responsable o registre incumplimiento.',
    });
  }

  // 3. Hallazgos abiertos de nivel alto/crítico
  if (hallazgosAbiertos.length > 0) {
    const n = hallazgosAbiertos.length;
    recomendaciones.push({
      severidad: 'URGENTE',
      titulo: `Revisar ${n} hallazgo${n === 1 ? '' : 's'} abierto${n === 1 ? '' : 's'} de nivel alto.`,
      detalle: 'Considere solicitar un plan de mejora si aún no existe.',
    });
  }

  // 4. Por vencer
  if (porVencer.length > 0 && recomendaciones.length < 5) {
    recomendaciones.push({
      severidad: 'ATENCION',
      titulo: `Revisar ${porVencer.length} radicado${porVencer.length === 1 ? '' : 's'} por vencer.`,
      detalle: 'Confirme con la dependencia que la respuesta esté en preparación.',
    });
  }

  // 5. Sin responsable
  if (sinResponsable.length > 0 && recomendaciones.length < 5) {
    recomendaciones.push({
      severidad: 'ATENCION',
      titulo: `Solicitar asignación de responsable a ${sinResponsable.length} radicado${sinResponsable.length === 1 ? '' : 's'}.`,
      detalle: 'Ventanilla o el jefe de dependencia debe asignar un funcionario.',
    });
  }

  // 6. Dependencias en riesgo
  if (dependenciasEnRiesgo.length > 0 && recomendaciones.length < 5) {
    const d = dependenciasEnRiesgo[0];
    recomendaciones.push({
      severidad: 'ATENCION',
      titulo: `Validar dependencia con riesgo elevado: ${d.nombre}.`,
      detalle: `Tiene ${d.vencidos} vencidos y ${d.hallazgosAbiertos} hallazgos abiertos.`,
    });
  }

  // 7. Notificaciones fallidas
  if (notifFallidas.length > 0 && recomendaciones.length < 5) {
    recomendaciones.push({
      severidad: 'ATENCION',
      titulo: `Verificar ${notifFallidas.length} notificación${notifFallidas.length === 1 ? '' : 'es'} sin entregar.`,
      detalle: 'Confirme con la dependencia que se usó un canal alternativo.',
    });
  }

  // 8. Dependencias con bajo cumplimiento
  if (dependenciasBajoCumpl.length > 0 && recomendaciones.length < 5) {
    const d = dependenciasBajoCumpl[0];
    recomendaciones.push({
      severidad: 'INFORMATIVO',
      titulo: `Hacer seguimiento al cumplimiento de ${d.nombre}.`,
      detalle: `Cumplimiento actual: ${d.cumplimientoPct}%.`,
    });
  }

  // 9. Hallazgos abiertos sin escalar
  if (hallazgosOtros.length > 0 && recomendaciones.length < 5) {
    const n = hallazgosOtros.length;
    recomendaciones.push({
      severidad: 'INFORMATIVO',
      titulo: `Hacer seguimiento a ${n} hallazgo${n === 1 ? '' : 's'} abierto${n === 1 ? '' : 's'}.`,
      detalle: 'Verifique si requieren plan de mejora u observación adicional.',
    });
  }

  // 10. Planes pendientes sin avance
  if (planesPendientes.length > 0 && recomendaciones.length < 5) {
    const n = planesPendientes.length;
    recomendaciones.push({
      severidad: 'INFORMATIVO',
      titulo: `Revisar ${n} plan${n === 1 ? '' : 'es'} de mejora en curso.`,
      detalle: 'Confirme avances o solicite evidencia a las dependencias.',
    });
  }

  // Estado positivo
  if (recomendaciones.length === 0) {
    recomendaciones.push({
      severidad: 'POSITIVO',
      titulo: 'No hay alertas críticas para hoy.',
      detalle: 'La gestión se encuentra dentro de los tiempos revisados.',
    });
  }

  return recomendaciones.slice(0, 5);
}

/**
 * Etiqueta humana para un nivel de riesgo con explicación corta.
 * Útil para tooltips y leyenda de semáforo.
 */
export function describirNivelRiesgo(nivel: NivelRiesgo): string {
  switch (nivel) {
    case 'BAJO':    return 'Sin señales importantes de incumplimiento.';
    case 'MEDIO':   return 'Requiere seguimiento preventivo.';
    case 'ALTO':    return 'Requiere revisión prioritaria.';
    case 'CRITICO': return 'Requiere acción inmediata.';
  }
}
