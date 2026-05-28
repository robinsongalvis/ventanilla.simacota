import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { PREDICTIVE_THRESHOLDS } from './thresholds';

export interface AnalisisTendenciaTag {
  tag: string;
  frecuenciaW1: number;       // Últimos 15 días
  frecuenciaW2: number;       // 15 días anteriores
  crecimientoPercent: number; // Porcentaje de crecimiento
  tendencia: 'ALTA_CRITICA' | 'CRECIENTE' | 'ESTABLE' | 'DECRECIENTE';
  esAnomalia: boolean;        // Si el crecimiento es extremadamente inusual
}

function parseFechaOnly(str: string): Date {
  const parts = str.split('T')[0].split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

/**
 * Calcula la deriva de tendencias semánticas (Delta_sem) analizando ventanas móviles de 15 días
 */
export function calcularTendenciasSemanticas(
  todosLosRadicados: VentanillaRadicado[]
): AnalisisTendenciaTag[] {
  const hoy = new Date();
  
  // Definición de las ventanas temporales (W1: [hoy - 15, hoy], W2: [hoy - 30, hoy - 15])
  const limiteW1 = new Date();
  limiteW1.setDate(hoy.getDate() - PREDICTIVE_THRESHOLDS.VENTANA_TENDENCIAS_DIAS);
  
  const limiteW2 = new Date();
  limiteW2.setDate(hoy.getDate() - (PREDICTIVE_THRESHOLDS.VENTANA_TENDENCIAS_DIAS * 2));

  // Mapa de frecuencias para ambas ventanas
  const freqW1: Record<string, number> = {};
  const freqW2: Record<string, number> = {};

  todosLosRadicados.forEach((r) => {
    const fecha = parseFechaOnly(r.control.fechaRadicado);
    const tags = r.analisisIa?.etiquetasSemanticas || [];

    if (fecha >= limiteW1) {
      // Pertenece a W1
      tags.forEach((tag) => {
        const cleaned = tag.toLowerCase().trim();
        freqW1[cleaned] = (freqW1[cleaned] || 0) + 1;
      });
    } else if (fecha >= limiteW2 && fecha < limiteW1) {
      // Pertenece a W2
      tags.forEach((tag) => {
        const cleaned = tag.toLowerCase().trim();
        freqW2[cleaned] = (freqW2[cleaned] || 0) + 1;
      });
    }
  });

  // Consolidar todos los tags detectados
  const todosLosTags = new Set([...Object.keys(freqW1), ...Object.keys(freqW2)]);

  const analisis: AnalisisTendenciaTag[] = [];

  todosLosTags.forEach((tag) => {
    const w1 = freqW1[tag] || 0;
    const w2 = freqW2[tag] || 0;

    // Calcular crecimiento. Evitar división por cero sumando epsilon
    let crecimientoPercent = 0;
    if (w2 > 0) {
      crecimientoPercent = Math.round(((w1 - w2) / w2) * 100);
    } else if (w1 > 0) {
      crecimientoPercent = w1 * 100; // Si no existía y ahora sí, crece exponencialmente
    }

    // Clasificación de la tendencia
    let tendencia: 'ALTA_CRITICA' | 'CRECIENTE' | 'ESTABLE' | 'DECRECIENTE' = 'ESTABLE';
    let esAnomalia = false;

    const ratioDrift = crecimientoPercent / 100;

    if (w1 >= 3 && ratioDrift >= 1.5) {
      // Crecimiento superior al 150% con al menos 3 menciones
      tendencia = 'ALTA_CRITICA';
      esAnomalia = true;
    } else if (ratioDrift >= PREDICTIVE_THRESHOLDS.DERIVA_SEMANTICA) {
      tendencia = 'CRECIENTE';
    } else if (ratioDrift <= -PREDICTIVE_THRESHOLDS.DERIVA_SEMANTICA) {
      tendencia = 'DECRECIENTE';
    }

    analisis.push({
      tag,
      frecuenciaW1: w1,
      frecuenciaW2: w2,
      crecimientoPercent,
      tendencia,
      esAnomalia,
    });
  });

  // Ordenar por crecimiento porcentual descendente
  return analisis.sort((a, b) => b.crecimientoPercent - a.crecimientoPercent);
}
