import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { PREDICTIVE_THRESHOLDS } from './thresholds';

export interface AnalisisRiesgoRadicado {
  radicadoId: string;
  asunto: string;
  dependenciaId: string;
  complejidadSemantica: number; // 0.0 a 1.0
  diasHabilesRestantes: number;
  tiempoEstandarResolucion: number; // T_std en días hábiles
  probabilidadVencimiento: number; // 0 a 100
  categoriaRiesgo: 'CRITICO' | 'MEDIO' | 'BAJO';
  motivosAlerta: string[];
}

const ESTADOS_RESUELTOS = new Set(['RESUELTO', 'RECHAZADO']);

function estaResuelto(r: VentanillaRadicado): boolean {
  return ESTADOS_RESUELTOS.has(r.estadoActual);
}

/**
 * Calcula los días hábiles transcurridos desde radicación hasta resolución o fecha actual
 */
function diasHabilesTranscurridos(r: VentanillaRadicado): number {
  const inicio = r.control.fechaRadicado;
  const fin = estaResuelto(r)
    ? (r.ultimaActualizacion ?? new Date().toISOString())
    : new Date().toISOString();
  return Math.abs(diasRestantesHabiles(fin, inicio));
}

/**
 * Calcula la complejidad semántica (C_sem) del radicado (0.0 a 1.0)
 */
export function calcularComplejidadSemantica(radicado: VentanillaRadicado): number {
  const folios = radicado.detalle.numeroFolios || 1;
  const numTags = radicado.analisisIa?.etiquetasSemanticas?.length || 0;
  const confianza = radicado.analisisIa?.confianzaClasificacion ?? 0.85;

  // 1. Aporte de folios (hasta 0.3)
  const factorFolios = Math.min(0.3, folios / 15);

  // 2. Aporte de etiquetas semánticas (hasta 0.3)
  const factorTags = Math.min(0.3, numTags * 0.08);

  // 3. Aporte por ambigüedad / baja confianza de IA (hasta 0.2)
  const factorAmbiguiedad = Math.min(0.2, (1.0 - confianza) * 0.5);

  // Suma base (0.2) + factores
  const cSem = 0.2 + factorFolios + factorTags + factorAmbiguiedad;

  return Math.min(1.0, Math.max(0.0, cSem));
}

/**
 * Evalúa el riesgo de vencimiento probabilístico de un radicado activo
 */
export function calcularRiesgoVencimiento(
  radicado: VentanillaRadicado,
  todosLosRadicados: VentanillaRadicado[]
): AnalisisRiesgoRadicado {
  const radicadoId = radicado.radicadoId;
  const asunto = radicado.detalle.asunto;
  const dependenciaId = radicado.clasificacion.oficinaDestino;

  // C_sem
  const complejidadSemantica = calcularComplejidadSemantica(radicado);

  // Días hábiles restantes para el vencimiento oficial
  const diasHabilesRestantes = diasRestantesHabiles(radicado.termino.fechaVencimiento);

  // Calcular la media histórica (mu) de tiempo de respuesta de radicados resueltos en esta misma oficina
  const resueltosDep = todosLosRadicados.filter(
    (r) => r.clasificacion.oficinaDestino === dependenciaId && estaResuelto(r)
  );

  let muDep = radicado.termino.diasRespuesta * 0.6; // Valor por defecto: 60% del término oficial
  if (resueltosDep.length >= 3) {
    const totalDias = resueltosDep.reduce((acc, r) => acc + diasHabilesTranscurridos(r), 0);
    muDep = totalDias / resueltosDep.length;
  }

  // T_std = mu_dep * (1 + C_sem)
  const tiempoEstandarResolucion = Math.round(muDep * (1 + complejidadSemantica));

  // Ecuación sigmoide: P_venc = 100 / (1 + e^(-k * (T_std - d_hab)))
  const k = 0.45; // Factor de aceleración de la pendiente de riesgo
  const diferencia = tiempoEstandarResolucion - diasHabilesRestantes;
  const pVenc = Math.round(100 / (1 + Math.exp(-k * diferencia)));

  // Categorización de riesgo basada en thresholds centralizados
  let categoriaRiesgo: 'CRITICO' | 'MEDIO' | 'BAJO' = 'BAJO';
  const ratioProb = pVenc / 100;

  if (ratioProb >= PREDICTIVE_THRESHOLDS.RIESGO_CRITICO || diasHabilesRestantes <= 2) {
    categoriaRiesgo = 'CRITICO';
  } else if (ratioProb >= PREDICTIVE_THRESHOLDS.RIESGO_MEDIO || diasHabilesRestantes <= 5) {
    categoriaRiesgo = 'MEDIO';
  }

  // Generación de motivos de alerta en caliente
  const motivosAlerta: string[] = [];
  if (diasHabilesRestantes < 0) {
    motivosAlerta.push(`El término de respuesta oficial ha expirado por ${Math.abs(diasHabilesRestantes)} días hábiles.`);
  } else if (diasHabilesRestantes <= 2) {
    motivosAlerta.push(`Quedan únicamente ${diasHabilesRestantes} días hábiles de término legal.`);
  }

  if (complejidadSemantica > 0.65) {
    motivosAlerta.push(`Complejidad semántica elevada (${Math.round(complejidadSemantica * 100)}%) debido a volumen de folios o etiquetas complejas.`);
  }

  if (resueltosDep.length >= 3 && muDep > radicado.termino.diasRespuesta * 0.8) {
    motivosAlerta.push(`La secretaría presenta congestión histórica, con tiempos promedio de respuesta de ${Math.round(muDep)} días.`);
  }

  if (pVenc >= 75 && diasHabilesRestantes > 0) {
    motivosAlerta.push(`El modelo predice una probabilidad del ${pVenc}% de rebasar el término por rezago acumulado.`);
  }

  return {
    radicadoId,
    asunto,
    dependenciaId,
    complejidadSemantica,
    diasHabilesRestantes,
    tiempoEstandarResolucion,
    probabilidadVencimiento: pVenc,
    categoriaRiesgo,
    motivosAlerta,
  };
}
