import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { calcularRiesgoVencimiento } from '../predictive/riesgo-vencimiento';
import { calcularSaturacionDependencias } from '../predictive/saturacion';
import { calcularRiesgoTerritorial } from '../predictive/zonas';

export interface ContextoIARadicado {
  radicadoId: string;
  asunto: string;
  descripcion: string;
  dependenciaActual: string;
  diasHabilesRestantes: number;
  zonaGeografica: string;
  complejidadSemantica: number;
  probabilidadVencimiento: number;
  tagsSemanticos: string[];
  nivelSaturacionOficina: 'CRITICO' | 'ALTO' | 'MEDIO' | 'NORMAL';
  anomaliaZona: boolean;
  resumenEjecutivo: string;
  resumenTrazabilidad: string[];
}

/**
 * AI Context Engine: Consolida toda la telemetría operativa y el historial 
 * de un radicado en un payload estructurado JSON reutilizable por los agentes.
 */
export function construirContextoAgente(
  radicado: VentanillaRadicado,
  todosLosRadicados: VentanillaRadicado[],
  overridesAuditoria: any[] = []
): ContextoIARadicado {
  // 1. Calcular riesgo matemático
  const riesgo = calcularRiesgoVencimiento(radicado, todosLosRadicados);

  // 2. Calcular saturación de la dependencia actual
  const saturaciones = calcularSaturacionDependencias(todosLosRadicados, overridesAuditoria);
  const saturacion = saturaciones.find((s) => s.dependenciaId === radicado.clasificacion.oficinaDestino);

  // 3. Evaluar si la zona geográfica está reportando anomalías críticas
  const riesgoTerritorial = calcularRiesgoTerritorial(todosLosRadicados);
  const territorial = riesgoTerritorial.find((z) => z.zona === radicado.clasificacion.zonaGeografica);

  // 4. Formatear la bitácora cronológica de trazabilidad
  const resumenTrazabilidad = radicado.trazabilidad.map((t) => {
    const fecha = t.fecha ? t.fecha.split('T')[0] : 'Sin fecha';
    return `[${fecha}] Acción: ${t.accion} por ${t.actorNombre}. Nota: ${t.nota}`;
  });

  return {
    radicadoId: radicado.radicadoId,
    asunto: radicado.detalle.asunto,
    descripcion: radicado.detalle.descripcion,
    dependenciaActual: radicado.clasificacion.oficinaDestino,
    diasHabilesRestantes: riesgo.diasHabilesRestantes,
    zonaGeografica: radicado.clasificacion.zonaGeografica,
    complejidadSemantica: riesgo.complejidadSemantica,
    probabilidadVencimiento: riesgo.probabilidadVencimiento,
    tagsSemanticos: radicado.analisisIa?.etiquetasSemanticas || [],
    nivelSaturacionOficina: saturacion?.nivelSaturacion || 'NORMAL',
    anomaliaZona: territorial?.nivelRiesgoTerritorial === 'CRITICO',
    resumenEjecutivo: radicado.analisisIa?.resumenEjecutivo || 'Sin resumen registrado.',
    resumenTrazabilidad,
  };
}
