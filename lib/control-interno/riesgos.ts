/**
 * Motor de riesgos operativos — Control Interno.
 *
 * Evalúa un radicado y devuelve un nivel de riesgo (BAJO/MEDIO/ALTO/CRITICO)
 * basado en criterios cuantificables: cumplimiento de término, asignación,
 * trazabilidad, devoluciones, prórrogas, notificaciones, sensibilidad
 * (anónimo/reservado), tipo urgente y congestión de la dependencia.
 *
 * Funciones puras — sin acceso a Firestore — para que sean fáciles de
 * testear y de invocar tanto desde el servidor como desde el cliente.
 */

import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type {
  EvaluacionRiesgo,
  MotivoRiesgo,
  NivelRiesgo,
} from '@/src/types/control-interno';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);

/** Tipos que se consideran urgentes para escalado prioritario. */
const TIPOS_URGENTES = new Set<string>([
  'URGENTE',
  'PETICION_ENTES_CONTROL',
  'ENTES_CONTROL_URGENTE',
  'DENUNCIA',
  'HABEAS_DATA',
  'QUERELLA',
]);

/** Umbral mínimo de vencidos para considerar congestionada una dependencia. */
const UMBRAL_DEPENDENCIA_CONGESTIONADA = 5;

/** Umbral de días sin eventos para considerar trazabilidad insuficiente. */
const UMBRAL_DIAS_SIN_TRAZABILIDAD = 5;

/** Devoluciones que disparan el flag de "varias devoluciones". */
const UMBRAL_DEVOLUCIONES = 2;

/* ══════════════════════════════════════════════════════════════
   HELPERS PURAS
══════════════════════════════════════════════════════════════ */

function estaActivo(r: VentanillaRadicado): boolean {
  return !ESTADOS_RESUELTOS.has(r.estadoActual);
}

function diasDesde(iso: string | undefined | null, ahora: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((ahora.getTime() - t) / (1000 * 60 * 60 * 24));
}

/* ══════════════════════════════════════════════════════════════
   AGREGACIÓN POR DEPENDENCIA
══════════════════════════════════════════════════════════════ */

export interface CargaDependencia {
  tenantId: TenantId;
  vencidos: number;
}

/** Cuenta vencidos por tenant para alimentar el motor de riesgos. */
export function calcularCargaDependencias(
  radicados: VentanillaRadicado[],
): Map<TenantId, number> {
  const carga = new Map<TenantId, number>();
  for (const r of radicados) {
    if (!estaActivo(r)) continue;
    if (diasRestantesHabiles(r.termino.fechaVencimiento) >= 0) continue;
    const tenant = r.clasificacion.oficinaDestino;
    carga.set(tenant, (carga.get(tenant) ?? 0) + 1);
  }
  return carga;
}

/* ══════════════════════════════════════════════════════════════
   EVALUACIÓN DE RIESGO POR RADICADO
══════════════════════════════════════════════════════════════ */

export interface ContextoRiesgo {
  /** Mapa de vencidos por dependencia (para detectar congestión). */
  cargaDependencias?: Map<TenantId, number>;
  /** ISO del último evento de trazabilidad. Opcional — si no se conoce, se omite el criterio. */
  ultimaTrazabilidadIso?: string | null;
  /** Conteo histórico de devoluciones — opcional. */
  devolucionesPrevias?: number;
}

/**
 * Evalúa el riesgo de un radicado individual.
 *
 * El puntaje suma los pesos de cada motivo aplicable.
 * El nivel resultante se mapea por umbrales:
 *   - 0       → BAJO
 *   - 1–3     → MEDIO
 *   - 4–6     → ALTO
 *   - 7+      → CRITICO
 */
export function evaluarRiesgoRadicado(
  radicado: VentanillaRadicado,
  contexto: ContextoRiesgo = {},
  ahora: Date = new Date(),
): EvaluacionRiesgo {
  const motivos: MotivoRiesgo[] = [];
  let puntaje = 0;

  const activo = estaActivo(radicado);
  const dias = diasRestantesHabiles(radicado.termino.fechaVencimiento, ahora);

  // 1. Vencido
  if (activo && dias < 0) {
    motivos.push('VENCIDO');
    puntaje += 4;
  } else if (activo && dias >= 0 && dias <= 2) {
    motivos.push('POR_VENCER');
    puntaje += 2;
  }

  // 2. Sin responsable
  if (activo && !radicado.clasificacion.funcionarioResponsableUid) {
    motivos.push('SIN_RESPONSABLE');
    puntaje += 2;
  }

  // 3. Sin trazabilidad reciente
  if (activo && contexto.ultimaTrazabilidadIso !== undefined) {
    const d = diasDesde(contexto.ultimaTrazabilidadIso, ahora);
    if (d === null || d > UMBRAL_DIAS_SIN_TRAZABILIDAD) {
      motivos.push('SIN_TRAZABILIDAD');
      puntaje += 1;
    }
  }

  // 4. Devuelto varias veces
  if ((contexto.devolucionesPrevias ?? 0) >= UMBRAL_DEVOLUCIONES) {
    motivos.push('DEVUELTO_VARIAS_VECES');
    puntaje += 2;
  }

  // 5. Con prórroga
  if (radicado.estadoActual === 'PRORROGA' || (radicado.termino.prorrogasAplicadas ?? 0) > 0) {
    motivos.push('CON_PRORROGA');
    puntaje += 1;
  }

  // 6. Resuelto fuera de término
  if (radicado.cumplioTermino === false) {
    motivos.push('RESUELTO_FUERA_TERMINO');
    puntaje += 3;
  }

  // 7. Notificación fallida sin gestionar
  if (radicado.alertaNotificacionFallida === true) {
    motivos.push('NOTIFICACION_FALLIDA');
    puntaje += 2;
  }

  // 8. Anónimo / identidad reservada (sensible)
  if (radicado.esAnonimo === true || radicado.identidadReservada === true) {
    motivos.push('ANONIMO_RESERVADO');
    puntaje += 1;
  }

  // 9. Tipo urgente
  if (TIPOS_URGENTES.has(radicado.termino.tipoSolicitudId)) {
    motivos.push('TIPO_URGENTE');
    puntaje += 2;
  }

  // 10. Dependencia congestionada
  const tenant = radicado.clasificacion.oficinaDestino;
  const vencidosDep = contexto.cargaDependencias?.get(tenant) ?? 0;
  if (activo && vencidosDep >= UMBRAL_DEPENDENCIA_CONGESTIONADA) {
    motivos.push('DEPENDENCIA_CONGESTIONADA');
    puntaje += 1;
  }

  return {
    radicadoId: radicado.radicadoId,
    nivel:      nivelDesdePuntaje(puntaje),
    puntaje,
    motivos,
    accion:     sugerirAccion(motivos, dias),
  };
}

export function nivelDesdePuntaje(puntaje: number): NivelRiesgo {
  if (puntaje >= 7) return 'CRITICO';
  if (puntaje >= 4) return 'ALTO';
  if (puntaje >= 1) return 'MEDIO';
  return 'BAJO';
}

function sugerirAccion(motivos: MotivoRiesgo[], diasRestantes: number): string {
  if (motivos.includes('VENCIDO')) {
    return `Escalar al jefe de dependencia y solicitar respuesta inmediata (vencido hace ${Math.abs(diasRestantes)} días).`;
  }
  if (motivos.includes('NOTIFICACION_FALLIDA')) {
    return 'Verificar notificación por canal alternativo (correo institucional fallido).';
  }
  if (motivos.includes('SIN_RESPONSABLE')) {
    return 'Asignar responsable funcional inmediatamente.';
  }
  if (motivos.includes('POR_VENCER')) {
    return `Atender prioritariamente — vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}.`;
  }
  if (motivos.includes('TIPO_URGENTE')) {
    return 'Solicitud de tipo urgente: confirmar atención prioritaria.';
  }
  if (motivos.includes('DEPENDENCIA_CONGESTIONADA')) {
    return 'Dependencia con varios vencidos; evaluar refuerzo o redistribución.';
  }
  if (motivos.includes('SIN_TRAZABILIDAD')) {
    return 'Solicitar a la dependencia que documente avance en la trazabilidad.';
  }
  if (motivos.includes('RESUELTO_FUERA_TERMINO')) {
    return 'Documentar hallazgo y solicitar plan de mejora.';
  }
  if (motivos.includes('CON_PRORROGA')) {
    return 'Validar que la prórroga esté debidamente justificada.';
  }
  return 'Sin acciones inmediatas. Mantener seguimiento periódico.';
}

/* ══════════════════════════════════════════════════════════════
   EVALUACIÓN MASIVA
══════════════════════════════════════════════════════════════ */

export function evaluarRiesgoMasivo(
  radicados: VentanillaRadicado[],
  ahora: Date = new Date(),
): EvaluacionRiesgo[] {
  const carga = calcularCargaDependencias(radicados);
  return radicados.map((r) =>
    evaluarRiesgoRadicado(r, { cargaDependencias: carga }, ahora),
  );
}

/** Cuenta cuántos radicados caen en cada nivel de riesgo. */
export function resumirNiveles(
  evaluaciones: EvaluacionRiesgo[],
): Record<NivelRiesgo, number> {
  const resumen: Record<NivelRiesgo, number> = { BAJO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 };
  for (const e of evaluaciones) {
    resumen[e.nivel] += 1;
  }
  return resumen;
}
