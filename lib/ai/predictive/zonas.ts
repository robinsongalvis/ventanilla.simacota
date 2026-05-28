import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { ZonaGeografica } from '@/src/types/radicado';
import { calcularRiesgoVencimiento } from './riesgo-vencimiento';

export interface AnalisisTerritorialZona {
  zona: ZonaGeografica;
  nombreZona: string;
  totalRadicadosActivos: number;
  probabilidadRiesgoPromedio: number; // 0 a 100
  tagsMasComunes: string[];
  nivelRiesgoTerritorial: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';
  incidenciasCriticasCount: number;
}

const ESTADOS_ACTIVOS = new Set(['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'POR_VENCER', 'VENCIDO', 'PRORROGA']);

function estaActivo(r: VentanillaRadicado): boolean {
  return ESTADOS_ACTIVOS.has(r.estadoActual);
}

const LABEL_ZONA: Record<ZonaGeografica, string> = {
  CASCO_URBANO: 'Casco Urbano',
  ZONA_RURAL: 'Zona Rural',
  ZONA_YARIGUIES: 'Corregimiento Yariguíes',
};

/**
 * Agrupa y territorializa la data de riesgo e insatisfacción por zona geográfica
 */
export function calcularRiesgoTerritorial(
  todosLosRadicados: VentanillaRadicado[]
): AnalisisTerritorialZona[] {
  const zonasIds: ZonaGeografica[] = ['CASCO_URBANO', 'ZONA_RURAL', 'ZONA_YARIGUIES'];
  
  const activos = todosLosRadicados.filter(estaActivo);

  return zonasIds.map((zonaId) => {
    const radicadosZona = activos.filter((r) => r.clasificacion.zonaGeografica === zonaId);
    const total = radicadosZona.length;

    // Calcular el promedio de probabilidad de riesgo utilizando riesgo-vencimiento puro
    let totalRiesgo = 0;
    let criticos = 0;

    radicadosZona.forEach((r) => {
      const analisis = calcularRiesgoVencimiento(r, todosLosRadicados);
      totalRiesgo += analisis.probabilidadVencimiento;
      if (analisis.categoriaRiesgo === 'CRITICO') {
        criticos++;
      }
    });

    const riesgoPromedio = total > 0 ? Math.round(totalRiesgo / total) : 0;

    // Obtener los tags más recurrentes en esta zona específica
    const freqTags: Record<string, number> = {};
    radicadosZona.forEach((r) => {
      const tags = r.analisisIa?.etiquetasSemanticas || [];
      tags.forEach((t) => {
        const cleaned = t.toLowerCase().trim();
        freqTags[cleaned] = (freqTags[cleaned] || 0) + 1;
      });
    });

    const tagsMasComunes = Object.entries(freqTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    // Determinar nivel de riesgo territorial basado en severidad agregada
    let nivelRiesgoTerritorial: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO' = 'BAJO';
    if (riesgoPromedio >= 75 || criticos >= 3) {
      nivelRiesgoTerritorial = 'CRITICO';
    } else if (riesgoPromedio >= 45 || total >= 6) {
      nivelRiesgoTerritorial = 'ALTO';
    } else if (riesgoPromedio >= 20 || total >= 3) {
      nivelRiesgoTerritorial = 'MEDIO';
    }

    return {
      zona: zonaId,
      nombreZona: LABEL_ZONA[zonaId],
      totalRadicadosActivos: total,
      probabilidadRiesgoPromedio: riesgoPromedio,
      tagsMasComunes,
      nivelRiesgoTerritorial,
      incidenciasCriticasCount: criticos,
    };
  });
}
