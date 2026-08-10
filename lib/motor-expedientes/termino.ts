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

/**
 * DF-7 (ADR-0029) amplió el vocabulario con 5 tipos nuevos —
 * `COMUNICACION_ACTA`, `RENUNCIA_PLAZO_RESTANTE`, `ACTO_VIABILIDAD`,
 * `ENTREGA_DOCUMENTOS_PAGO`, `PRORROGA_TERMINO_ADMINISTRACION` — que el
 * anexo normativo confirma como hitos reales del ciclo (comunicación del
 * acta ≠ su expedición; renuncia expresa al plazo restante; suspensión por
 * pagos en el acto de viabilidad; prórroga administrativa del término),
 * pero cuyo EFECTO sobre el cómputo del vencimiento queda ⚖️ BLOQUEADO
 * (hueco 1, ADR-0029) hasta el concepto escrito de Jurídica —
 * `calcularVencimiento` los trata como INERTES (ver su JSDoc y el switch
 * exhaustivo `esEventoQueReinicia`): se reconocen sin alterar el resultado
 * de ninguna de las dos políticas.
 */
export type TipoEventoTermino =
  | 'RADICACION_DEBIDA_FORMA'
  | 'ACTA_OBSERVACIONES'
  | 'RESPUESTA_SUBSANACION'
  | 'MODIFICACION_SOLICITUD'
  | 'COMUNICACION_ACTA'
  | 'RENUNCIA_PLAZO_RESTANTE'
  | 'ACTO_VIABILIDAD'
  | 'ENTREGA_DOCUMENTOS_PAGO'
  | 'PRORROGA_TERMINO_ADMINISTRACION';

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

/**
 * ¿Este tipo de evento reinicia el plazo bajo `REINICIO_A_CERO`? Switch
 * EXHAUSTIVO (no un `Array.includes`) a propósito: el caso `default` con
 * asignación a `never` fuerza al COMPILADOR a rechazar el build si algún
 * día se añade un `TipoEventoTermino` nuevo sin decidir aquí si reinicia o
 * no — nunca queda un tipo "sin decidir" en silencio. Los 5 tipos nuevos de
 * DF-7 (ADR-0029) son INERTES también bajo esta política — su semántica
 * real (⚖️ hueco 1) no está definida, así que NO reinician nada.
 */
function esEventoQueReinicia(tipo: TipoEventoTermino): boolean {
  switch (tipo) {
    case 'ACTA_OBSERVACIONES':
    case 'RESPUESTA_SUBSANACION':
    case 'MODIFICACION_SOLICITUD':
      return true;
    case 'RADICACION_DEBIDA_FORMA':
    case 'COMUNICACION_ACTA':
    case 'RENUNCIA_PLAZO_RESTANTE':
    case 'ACTO_VIABILIDAD':
    case 'ENTREGA_DOCUMENTOS_PAGO':
    case 'PRORROGA_TERMINO_ADMINISTRACION':
      return false;
    default: {
      const _exhaustivo: never = tipo;
      throw new Error(`Tipo de evento de término no contemplado en esEventoQueReinicia: ${String(_exhaustivo)}`);
    }
  }
}

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
    const reinicios = ordenados.filter((e) => esEventoQueReinicia(e.tipo));
    const ancla = reinicios.length > 0 ? reinicios[reinicios.length - 1]! : radicacion;
    return sumarDiasHabiles(ancla.fecha, politica.plazoDias);
  }

  // SUSPENSION_REANUDACION
  let vencimiento = sumarDiasHabiles(radicacion.fecha, politica.plazoDias);
  let diasRestantesGuardados: number | null = null;

  for (const evento of ordenados) {
    // Switch EXHAUSTIVO (ver `esEventoQueReinicia` arriba para el mismo
    // patrón bajo REINICIO_A_CERO): el `default` con `never` obliga al
    // compilador a rechazar el build si se añade un tipo sin decidir su
    // efecto aquí.
    switch (evento.tipo) {
      case 'RADICACION_DEBIDA_FORMA':
        break; // ya se usó como ancla arriba
      case 'ACTA_OBSERVACIONES':
        if (diasRestantesGuardados === null) {
          // Congela los días hábiles que quedaban ENTRE el acta y el vencimiento vigente.
          diasRestantesGuardados = diasRestantesHabiles(vencimiento, evento.fecha);
        }
        break;
      case 'RESPUESTA_SUBSANACION':
        if (diasRestantesGuardados !== null) {
          vencimiento = sumarDiasHabiles(evento.fecha, diasRestantesGuardados);
          diasRestantesGuardados = null;
        }
        break;
      case 'MODIFICACION_SOLICITUD':
      case 'COMUNICACION_ACTA':
      case 'RENUNCIA_PLAZO_RESTANTE':
      case 'ACTO_VIABILIDAD':
      case 'ENTREGA_DOCUMENTOS_PAGO':
      case 'PRORROGA_TERMINO_ADMINISTRACION':
        // INERTES (⚖️ hueco 1, DF-7 ADR-0029): su semántica real —
        // reanudación al plazo MÁXIMO salvo renuncia expresa, descuento
        // expedición→comunicación del acta, suspensión por el acto de
        // viabilidad mientras se aportan documentos de pago, prórroga
        // administrativa ≤ mitad del término — queda BLOQUEADA hasta el
        // concepto escrito de Jurídica (P7 del anexo normativo). Se
        // reconocen (no lanzan) pero NO alteran el cómputo.
        break;
      default: {
        const _exhaustivo: never = evento.tipo;
        throw new Error(`Tipo de evento de término no contemplado en calcularVencimiento: ${String(_exhaustivo)}`);
      }
    }
  }

  return vencimiento;
}

/* ──────────────────────────────────────────────
   Doble cómputo (Bloque "Términos y vigencias protectores", 10-ago-2026)
────────────────────────────────────────────── */

export interface VencimientoDual {
  /** `calcularVencimiento` bajo `efectoSubsanacion: 'SUSPENSION_REANUDACION'`. */
  suspension: Date | null;
  /** `calcularVencimiento` bajo `efectoSubsanacion: 'REINICIO_A_CERO'`. */
  reinicio: Date | null;
  /** La MÁS TEMPRANA de las dos no-nulas (`null` si ambas lo son — sin radicación en debida forma). */
  fechaAlertaConservadora: Date | null;
}

/**
 * Calcula el vencimiento bajo AMBAS políticas de `PoliticaTermino.efectoSubsanacion`
 * (`SUSPENSION_REANUDACION` y `REINICIO_A_CERO`) y expone la MÁS TEMPRANA de
 * las dos como `fechaAlertaConservadora` — NADA elige una política: el
 * hueco 1 (⚖️, ADR-0029, efecto de la subsanación sobre el término) sigue
 * SIN default, exactamente igual que antes de esta función. Propuesta
 * técnica autorizada por el propietario el 10-ago-2026 (acta de la mesa
 * Jurídica+Planeación, `docs/planes/ACTA_MESA_JURIDICA_PLANEACION_2026-08-10.md`,
 * PR #178, "Qué sigue" #3): "mostrar ambas fechas de vencimiento
 * (suspensión/reinicio) y alertar sobre la más temprana".
 *
 * La alerta va sobre la fecha MÁS TEMPRANA (nunca la más tardía, nunca un
 * promedio) porque protege a la ADMINISTRACIÓN bajo cualquiera de las dos
 * lecturas posibles del hueco 1: si el régimen real termina siendo
 * `REINICIO_A_CERO` pero el sistema solo hubiera alertado sobre la fecha
 * (más tardía) de `SUSPENSION_REANUDACION`, la alerta llegaría TARDE
 * respecto del plazo real — el riesgo documentado en el acta es
 * precisamente que el silencio administrativo positivo (SAP, ⚖️ hueco 2)
 * corra sin que nadie lo haya visto venir. Alertar temprano nunca perjudica
 * al ciudadano (es una alerta INTERNA de la administración, no un plazo que
 * se le comunique a él); alertar tarde sí podría.
 *
 * `plazoDias` es un parámetro OBLIGATORIO (sin default, mismo principio que
 * `PoliticaTermino.plazoDias`) — el caller (una ruta de un trámite
 * concreto) declara el plazo normativo de SU régimen; este módulo sigue
 * siendo trámite-agnóstico (A3, ADR-0026 §A3).
 */
export function calcularVencimientoDual(eventos: EventoTermino[], plazoDias: number): VencimientoDual {
  const base = { plazoDias, computo: 'HABILES' as const, anclaje: 'RADICACION_EN_DEBIDA_FORMA' as const };
  const suspension = calcularVencimiento(eventos, { ...base, efectoSubsanacion: 'SUSPENSION_REANUDACION' });
  const reinicio = calcularVencimiento(eventos, { ...base, efectoSubsanacion: 'REINICIO_A_CERO' });

  const noNulos = [suspension, reinicio].filter((d): d is Date => d !== null);
  const fechaAlertaConservadora = noNulos.length === 0
    ? null
    : noNulos.reduce((masTemprana, d) => (d.getTime() < masTemprana.getTime() ? d : masTemprana));

  return { suspension, reinicio, fechaAlertaConservadora };
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
