import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { PREDICTIVE_THRESHOLDS, CAPACIDAD_DIARIA_DEPENDENCIAS } from './thresholds';

export interface AnalisisSaturacionDependencia {
  dependenciaId: string;
  nombreDependencia: string;
  radicadosActivosCount: number;
  capacidadDiaria: number;
  indiceSaturacion: number; // 0 a 100
  nivelSaturacion: 'CRITICO' | 'ALTO' | 'MEDIO' | 'NORMAL';
  overridesRecientes: number;
  motivoSaturacion: string;
}

const ESTADOS_ACTIVOS = new Set(['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'POR_VENCER', 'VENCIDO', 'PRORROGA']);

function estaActivo(r: VentanillaRadicado): boolean {
  return ESTADOS_ACTIVOS.has(r.estadoActual);
}

/**
 * Calcula el nivel de saturación por secretaría (I_sat) normalizado entre 0 y 100
 */
export function calcularSaturacionDependencias(
  todosLosRadicados: VentanillaRadicado[],
  overridesAuditoria: Array<{ clasificacionOriginal?: string | null }> = []
): AnalisisSaturacionDependencia[] {
  
  const dependenciasIds = Object.keys(CAPACIDAD_DIARIA_DEPENDENCIAS);

  return dependenciasIds.map((depId) => {
    const nombreDependencia = NOMBRES_TENANT[depId as keyof typeof NOMBRES_TENANT] || depId;
    const activos = todosLosRadicados.filter((r) => r.clasificacion.oficinaDestino === depId && estaActivo(r));
    const activosCount = activos.length;

    // Capacidad diaria registrada
    const capacidadDiaria = CAPACIDAD_DIARIA_DEPENDENCIAS[depId] || 4;

    // Buffer óptimo de trabajo (ej. capacidad para 5 días hábiles, o sea una semana)
    const bufferSano = capacidadDiaria * 5;

    // 1. Ratio base de cola (radicados activos vs buffer de una semana)
    const ratioBase = activosCount / bufferSano;

    // 2. Multiplicador de overrides (desvíos del clasificador de la IA)
    // Indica si la oficina recibe PQRS mal clasificadas de forma recurrente, aumentando la fricción
    const overridesDep = overridesAuditoria.filter((a) => a.clasificacionOriginal === depId).length;
    const totalRadicadosRecientes = todosLosRadicados.filter((r) => r.clasificacion.oficinaDestino === depId).length;

    const ratioOverrides = totalRadicadosRecientes > 0
      ? overridesDep / totalRadicadosRecientes
      : 0;

    // I_sat = min(1.0, ratioBase * (1 + ratioOverrides))
    const iSatDecimal = Math.min(1.0, ratioBase * (1.0 + ratioOverrides));
    const indiceSaturacion = Math.round(iSatDecimal * 100);

    // Clasificación del nivel de saturación
    let nivelSaturacion: 'CRITICO' | 'ALTO' | 'MEDIO' | 'NORMAL' = 'NORMAL';
    if (iSatDecimal >= PREDICTIVE_THRESHOLDS.RIESGO_CRITICO) {
      nivelSaturacion = 'CRITICO';
    } else if (iSatDecimal >= PREDICTIVE_THRESHOLDS.SATURACION_ALTA) {
      nivelSaturacion = 'ALTO';
    } else if (iSatDecimal >= PREDICTIVE_THRESHOLDS.SATURACION_MEDIA) {
      nivelSaturacion = 'MEDIO';
    }

    // Generar justificaciones descriptivas interpretables
    let motivoSaturacion = `Operación balanceada. Capacidad óptima disponible (${activosCount} radicados activos).`;
    if (nivelSaturacion === 'CRITICO') {
      motivoSaturacion = `Congestión crítica: La cola de radicados activos (${activosCount}) sobrepasa en ${Math.round((ratioBase - 1) * 100)}% el límite saludable de la dependencia (${bufferSano}).`;
    } else if (nivelSaturacion === 'ALTO') {
      motivoSaturacion = `Saturación alta: Cola de trabajo de ${activosCount} radicados con una velocidad de resolución diaria limitada a ${capacidadDiaria} solicitudes.`;
    } else if (nivelSaturacion === 'MEDIO') {
      motivoSaturacion = `Atención preventiva: Carga laboral moderada. Se aconseja supervisar tiempos de respuesta.`;
    }

    // Añadir factor de fricción por re-enrutamiento
    if (ratioOverrides > 0.20 && (nivelSaturacion === 'CRITICO' || nivelSaturacion === 'ALTO')) {
      motivoSaturacion += ` Incremento de fricción operativa por alta tasa de traslados/overrides (${Math.round(ratioOverrides * 100)}%).`;
    }

    return {
      dependenciaId: depId,
      nombreDependencia,
      radicadosActivosCount: activosCount,
      capacidadDiaria,
      indiceSaturacion,
      nivelSaturacion,
      overridesRecientes: overridesDep,
      motivoSaturacion,
    };
  });
}
