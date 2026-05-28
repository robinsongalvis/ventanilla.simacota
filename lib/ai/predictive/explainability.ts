import type { AnalisisRiesgoRadicado } from './riesgo-vencimiento';

export interface FactorExplicabilidad {
  nombre: string;
  impacto: 'ALTO_INCREMENTO' | 'MODERADO_INCREMENTO' | 'NEUTRAL' | 'REDUCTOR';
  detalle: string;
}

export interface DesgloseExplicabilidad {
  scoreFinal: number;
  factores: FactorExplicabilidad[];
  resumenExplicable: string;
}

/**
 * Desglosa y genera la matriz de explicabilidad y transparencia para un radicado analizado
 */
export function explicarRiesgoRadicado(
  analisis: AnalisisRiesgoRadicado
): DesgloseExplicabilidad {
  const factores: FactorExplicabilidad[] = [];

  // 1. Evaluar factor Días Hábiles
  if (analisis.diasHabilesRestantes < 0) {
    factores.push({
      nombre: 'Término Legal Expirado',
      impacto: 'ALTO_INCREMENTO',
      detalle: `El radicado rebasó el término por ${Math.abs(analisis.diasHabilesRestantes)} días hábiles, provocando un score de riesgo del ${analisis.probabilidadVencimiento}%.`,
    });
  } else if (analisis.diasHabilesRestantes <= 2) {
    factores.push({
      nombre: 'Término Crítico Cercano',
      impacto: 'ALTO_INCREMENTO',
      detalle: `Quedan únicamente ${analisis.diasHabilesRestantes} días hábiles, lo cual incrementa el riesgo exponencialmente bajo el modelo sigmoide.`,
    });
  } else if (analisis.diasHabilesRestantes <= 5) {
    factores.push({
      nombre: 'Término Moderado',
      impacto: 'MODERADO_INCREMENTO',
      detalle: `Se cuenta con ${analisis.diasHabilesRestantes} días hábiles. Requiere atención prioritaria.`,
    });
  } else {
    factores.push({
      nombre: 'Término Seguro',
      impacto: 'REDUCTOR',
      detalle: `Plazo confortable de ${analisis.diasHabilesRestantes} días hábiles para resolver.`,
    });
  }

  // 2. Evaluar Complejidad Semántica
  const cSemPercent = Math.round(analisis.complejidadSemantica * 100);
  if (analisis.complejidadSemantica > 0.65) {
    factores.push({
      nombre: 'Complejidad Semántica Elevada',
      impacto: 'ALTO_INCREMENTO',
      detalle: `Complejidad calculada en ${cSemPercent}%. Solicitud extensa, alta densidad de anexos/folios o etiquetas que incrementan el tiempo de resolución estimado.`,
    });
  } else if (analisis.complejidadSemantica > 0.40) {
    factores.push({
      nombre: 'Complejidad Semántica Media',
      impacto: 'MODERADO_INCREMENTO',
      detalle: `Complejidad del ${cSemPercent}%. La longitud del radicado y los metadatos inyectan un retardo moderado en la predicción.`,
    });
  } else {
    factores.push({
      nombre: 'Baja Complejidad Semántica',
      impacto: 'REDUCTOR',
      detalle: `Complejidad óptima del ${cSemPercent}%. Asunto conciso y claro de rápida digestión operativa.`,
    });
  }

  // 3. Evaluar Tiempo Promedio de Secretaría (Desviación)
  const diffTiempo = analisis.tiempoEstandarResolucion - analisis.diasHabilesRestantes;
  if (diffTiempo > 3) {
    factores.push({
      nombre: 'Rezago Histórico de Dependencia',
      impacto: 'ALTO_INCREMENTO',
      detalle: `El tiempo de resolución esperado para esta secretaría (${analisis.tiempoEstandarResolucion} días hábiles) supera con creces los días restantes (${analisis.diasHabilesRestantes} días), sugiriendo alta probabilidad de cuello de botella.`,
    });
  } else if (diffTiempo > 0) {
    factores.push({
      nombre: 'Desviación Operativa Leve',
      impacto: 'MODERADO_INCREMENTO',
      detalle: `El tiempo estándar de respuesta (${analisis.tiempoEstandarResolucion} días) está muy ajustado respecto a los días restantes (${analisis.diasHabilesRestantes} días).`,
    });
  } else {
    factores.push({
      nombre: 'Flujo de Trabajo Favorable',
      impacto: 'REDUCTOR',
      detalle: `La secretaría suele resolver en un tiempo promedio (${analisis.tiempoEstandarResolucion} días) menor al término restante (${analisis.diasHabilesRestantes} días).`,
    });
  }

  // 4. Resumen legible consolidado
  let resumenExplicable = '';
  if (analisis.categoriaRiesgo === 'CRITICO') {
    resumenExplicable = 'Riesgo crítico detectado: Días de término extremadamente limitados combinados con alta complejidad y congestión histórica en la secretaría asignada.';
  } else if (analisis.categoriaRiesgo === 'MEDIO') {
    resumenExplicable = 'Alerta preventiva: Los plazos de entrega se aproximan al promedio de resolución histórica de la dependencia. Se aconseja asignación de analistas.';
  } else {
    resumenExplicable = 'Riesgo normal controlado: El flujo operativo y los plazos legales aseguran un trámite exitoso bajo parámetros estándar.';
  }

  return {
    scoreFinal: analisis.probabilidadVencimiento,
    factores,
    resumenExplicable,
  };
}
export default explicarRiesgoRadicado;
