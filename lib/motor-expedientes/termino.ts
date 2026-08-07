/**
 * Término como PROYECCIÓN sobre una serie de eventos — Fase 2 (arranque,
 * PASO 7 / Tareas 3-4 de la orden).
 *
 * PURO, sin I/O. A diferencia del reloj de subsanación de BM-B33
 * (`lib/tiempos-radicado.ts`), que calcula un vencimiento FIJO a partir de
 * un único ancla, este módulo modela el vencimiento como una PROYECCIÓN
 * que cambia según qué eventos ocurrieron en el expediente — necesario
 * porque el efecto de una subsanación sobre el término NO es uniforme
 * entre regímenes reales: el Decreto 1077 (licencias) usa un efecto, y
 * otros regímenes pueden usar otro. `PoliticaTermino` hace ese efecto un
 * DATO, no una rama hardcodeada de código (mismo principio D5/D9 del resto
 * del motor).
 *
 * Fechas: convención `atLocalNoon` ya establecida en
 * `lib/tiempos-radicado.ts` (RS-1, PASO 1 de este arranque) — mediodía del
 * día CIVIL de Bogotá. NO se introduce un tipo `FechaLocal` paralelo; los
 * eventos llevan `Date` ya anclado.
 */

import { diasRestantesHabiles, sumarDiasHabiles, atLocalNoon } from '@/lib/tiempos-radicado';
import type { Actuacion } from './tipos';

/* ──────────────────────────────────────────────
   Tipos
────────────────────────────────────────────── */

export type TipoEventoTermino =
  | 'RADICACION_DEBIDA_FORMA'
  | 'ACTA_OBSERVACIONES'
  | 'RESPUESTA_SUBSANACION'
  | 'MODIFICACION_SOLICITUD';

export interface EventoTermino {
  tipo: TipoEventoTermino;
  /** Mediodía del día civil de Bogotá (`atLocalNoon`) — nunca un instante crudo. */
  fecha: Date;
}

/**
 * Política de cómputo del término — SIN valor por defecto en ningún punto
 * de este módulo (obligatoria en cada llamada a `calcularVencimiento`):
 * cada régimen real declara la suya explícitamente, nunca se asume una.
 *
 * - `efectoSubsanacion: 'REINICIO_A_CERO'`: el plazo son `plazoDias` días
 *   hábiles contados desde el ÚLTIMO evento que reinicia (acta de
 *   observaciones, respuesta de subsanación, o modificación de la
 *   solicitud) — SIN TOPE al número de reinicios (confirmado por Jurídica,
 *   respuesta 4: el Decreto 1077 no limita cuántas veces puede reiniciarse
 *   el plazo por actas sucesivas).
 * - `efectoSubsanacion: 'SUSPENSION_REANUDACION'`: el reloj se DETIENE en
 *   `ACTA_OBSERVACIONES` (se congelan los días hábiles que quedaban) y se
 *   REANUDA en `RESPUESTA_SUBSANACION`, con esos mismos días hábiles
 *   restantes contados desde la respuesta — el tiempo usado antes del acta
 *   NUNCA se recupera. `MODIFICACION_SOLICITUD` no tiene efecto declarado
 *   bajo esta política (supuesto explícito, Principio 13: ningún régimen
 *   real conocido hoy combina modificación de solicitud con suspensión/
 *   reanudación; se amplía si aparece un caso real).
 */
export interface PoliticaTermino {
  plazoDias: number;
  computo: 'HABILES';
  efectoSubsanacion: 'REINICIO_A_CERO' | 'SUSPENSION_REANUDACION';
  anclaje: 'RADICACION_EN_DEBIDA_FORMA';
}

const EVENTOS_QUE_REINICIAN: readonly TipoEventoTermino[] = [
  'ACTA_OBSERVACIONES',
  'RESPUESTA_SUBSANACION',
  'MODIFICACION_SOLICITUD',
];

/**
 * Calcula el vencimiento vigente a partir de la serie de eventos y la
 * política. `null` si no hay evento de anclaje (`RADICACION_DEBIDA_FORMA`)
 * — sin radicación en debida forma no hay término que proyectar (D5).
 *
 * `eventos` no necesita llegar ordenado — esta función ordena por `fecha`
 * internamente antes de proyectar. Si hay más de un evento del mismo tipo
 * relevante (p. ej. dos actas de observaciones sucesivas bajo
 * SUSPENSION_REANUDACION), se procesan en orden cronológico: cada
 * suspensión/reanudación es independiente de la anterior.
 */
export function calcularVencimiento(eventos: EventoTermino[], politica: PoliticaTermino): Date | null {
  const ordenados = [...eventos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const radicacion = ordenados.find((e) => e.tipo === 'RADICACION_DEBIDA_FORMA');
  if (!radicacion) return null;

  if (politica.efectoSubsanacion === 'REINICIO_A_CERO') {
    const reinicios = ordenados.filter((e) => EVENTOS_QUE_REINICIAN.includes(e.tipo));
    const ancla = reinicios.length > 0 ? reinicios[reinicios.length - 1]! : radicacion;
    return sumarDiasHabiles(ancla.fecha, politica.plazoDias);
  }

  // SUSPENSION_REANUDACION
  let vencimiento = sumarDiasHabiles(radicacion.fecha, politica.plazoDias);
  let diasRestantesGuardados: number | null = null;

  for (const evento of ordenados) {
    if (evento.tipo === 'RADICACION_DEBIDA_FORMA') continue;
    if (evento.tipo === 'ACTA_OBSERVACIONES' && diasRestantesGuardados === null) {
      // Congela los días hábiles que quedaban ENTRE el acta y el vencimiento vigente.
      diasRestantesGuardados = diasRestantesHabiles(vencimiento, evento.fecha);
    } else if (evento.tipo === 'RESPUESTA_SUBSANACION' && diasRestantesGuardados !== null) {
      vencimiento = sumarDiasHabiles(evento.fecha, diasRestantesGuardados);
      diasRestantesGuardados = null;
    }
    // MODIFICACION_SOLICITUD y ACTA/RESPUESTA fuera de secuencia (p. ej. una
    // segunda acta mientras ya está suspendido): sin efecto adicional —
    // supuesto declarado arriba.
  }

  return vencimiento;
}

/* ──────────────────────────────────────────────
   Derivación pura desde la trazabilidad real (Actuacion)
────────────────────────────────────────────── */

/**
 * Mapa de slugs de `Actuacion.tipo` (dato abierto, D1) a los tipos de
 * evento que SÍ son relevantes para el término. Cualquier `tipo` de
 * actuación no listado aquí se excluye de la proyección — no es un error:
 * la mayoría de actuaciones de un expediente (p. ej. una nota interna) no
 * mueven el reloj legal.
 */
const SLUG_A_TIPO_EVENTO: Readonly<Record<string, TipoEventoTermino>> = {
  'radicacion-debida-forma': 'RADICACION_DEBIDA_FORMA',
  'acta-observaciones': 'ACTA_OBSERVACIONES',
  'respuesta-subsanacion': 'RESPUESTA_SUBSANACION',
  'modificacion-solicitud': 'MODIFICACION_SOLICITUD',
};

/**
 * Deriva la serie de `EventoTermino` a partir de la trazabilidad REAL de
 * un expediente (`Actuacion[]`, `lib/motor-expedientes/tipos.ts`) — pura,
 * sin I/O.
 *
 * R9 (exclusión de reconstruidos): toda `Actuacion` con
 * `origen === 'RECONSTRUIDO'` se EXCLUYE de la proyección, sin excepción.
 * Una actuación reconstruida (D6: migración de un expediente en trámite)
 * representa un evento histórico aproximado — dejarla mover el reloj de un
 * término LEGAL VIVO reintroduciría, para el término, el mismo defecto que
 * el guard D9 previene para los consecutivos (`verificarAvanceCounter`,
 * `lib/server/consecutivo-legal.ts`): un dato reconstruido no debe alterar
 * el cómputo vigente de algo que corre en tiempo real.
 */
export function derivarEventosTermino(actuaciones: Actuacion[]): EventoTermino[] {
  const eventos: EventoTermino[] = [];
  for (const actuacion of actuaciones) {
    if (actuacion.origen === 'RECONSTRUIDO') continue; // R9
    const tipo = SLUG_A_TIPO_EVENTO[actuacion.tipo];
    if (!tipo) continue; // actuación sin relevancia para el término (D1: tipo es dato abierto)
    eventos.push({ tipo, fecha: atLocalNoon(actuacion.fecha) });
  }
  return eventos;
}
