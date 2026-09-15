/**
 * app/interno/licencias/estado-visual-evento.ts
 *
 * CAPA DE ESTADO VISUAL del historial — presentación PURA, independiente del
 * cálculo jurídico, del funcionario, de la dependencia y del tipo de actuación.
 *
 * ── QUÉ RESUELVE ──────────────────────────────────────────────────────────
 *
 * El riel pintaba cada evento por su ESPECIE (`tipo`: APERTURA, RADICACION,
 * ACTA…), y por eso el color no decía en qué ESTADO estaba cada actuación:
 * dos hechos igual de terminados salían de colores distintos, y el paso actual
 * no se distinguía de un hito ya cumplido. Aquí se traduce esa especie —que no
 * se toca— a una semántica de estado que una persona lee de un vistazo:
 *
 *   completed · in_progress · pending · projected · warning · suspended · cancelled
 *
 * ── LO QUE ESTO **NO** ES ─────────────────────────────────────────────────
 *
 * NO es una máquina de estados jurídica. No calcula términos, no mueve fechas,
 * no decide anclas ni suspensiones. El estado JURÍDICO sigue viviendo en
 * `lib/motor-expedientes/estados-licencia.ts` y la fase del camino en
 * `./camino-del-tramite.ts` — de ahí LEE, no reimplementa. Si el motor y esta
 * capa dijeran cosas distintas, manda el motor.
 *
 * El evento «en curso» que se añade abajo NO es una actuación inventada: es la
 * MISMA fase que el «Camino del trámite» ya marca como ACTUAL
 * (`situacionDePaso`), traída al riel para que se vea sin leer todo el historial.
 */
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { ESTADOS_RESUELTOS_LICENCIA } from '@/lib/motor-expedientes/estados-licencia';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { PASOS, situacionDePaso } from './camino-del-tramite';
import type { EventoTimelineItem } from './tipos';

/** Los siete estados visuales. Nombres estables en inglés (utilidad técnica). */
export type EstadoVisual =
  | 'completed'
  | 'in_progress'
  | 'pending'
  | 'projected'
  | 'warning'
  | 'suspended'
  | 'cancelled';

export interface DefinicionEstadoVisual {
  estado: EstadoVisual;
  /** Etiqueta de cara a la persona, en mayúscula. */
  etiqueta: string;
  /** Emoji redundante al color — para no depender SOLO del color (accesibilidad). */
  emoji: string;
  /** Color sólido del punto / borde / línea. Es una forma, no texto: contrasta en ambos temas. */
  color: string;
  /** Fondo OPACO y claro del chip: un badge autocontenido, legible sobre panel claro u oscuro. */
  chipFondo: string;
  /** Texto del chip, oscuro para AA sobre el fondo claro del propio chip. */
  chipTexto: string;
  /** Qué significa, para la leyenda. */
  significado: string;
}

/**
 * La paleta. Los colores sólidos (punto/línea) son formas; los del chip son un
 * badge autocontenido (fondo claro + texto oscuro) que se lee sobre cualquier
 * superficie. Donde el sistema de diseño ya tiene un tono semántico
 * (`--color-success/warning/danger`, `app/globals.css`) se respeta ese tono.
 */
export const ESTADOS_VISUALES: Record<EstadoVisual, DefinicionEstadoVisual> = {
  completed: {
    estado: 'completed', etiqueta: 'COMPLETADO', emoji: '🟢',
    color: '#16A34A', chipFondo: '#E7F5EC', chipTexto: '#117937',
    significado: 'La actuación ya ocurrió y quedó finalizada.',
  },
  in_progress: {
    estado: 'in_progress', etiqueta: 'EN CURSO', emoji: '🔵',
    color: '#2563EB', chipFondo: '#E6EEFE', chipTexto: '#1D4ED8',
    significado: 'Es el punto donde está el expediente ahora mismo.',
  },
  pending: {
    estado: 'pending', etiqueta: 'PENDIENTE', emoji: '⚪',
    color: '#94A3B8', chipFondo: '#EEF2F6', chipTexto: '#556072',
    significado: 'Todavía no ha ocurrido; está por hacerse.',
  },
  projected: {
    estado: 'projected', etiqueta: 'PROYECTADO', emoji: '🟣',
    color: '#7C3AED', chipFondo: '#F1E9FE', chipTexto: '#6D28D9',
    significado: 'Una fecha estimada que se recalcula; aún no es un hecho.',
  },
  warning: {
    estado: 'warning', etiqueta: 'ATENCIÓN', emoji: '🟠',
    color: '#F59E0B', chipFondo: '#FDF1DC', chipTexto: '#8E5C06',
    significado: 'Requiere una acción o una revisión.',
  },
  suspended: {
    estado: 'suspended', etiqueta: 'SUSPENDIDO', emoji: '🔴',
    color: '#DC2626', chipFondo: '#FCEAEA', chipTexto: '#B91C1C',
    significado: 'El trámite está detenido; el término no corre.',
  },
  cancelled: {
    estado: 'cancelled', etiqueta: 'ANULADO', emoji: '🔴',
    color: '#7F1D1D', chipFondo: '#F3E1E1', chipTexto: '#7F1D1D',
    significado: 'La actuación quedó sin efecto.',
  },
};

/** Fondo tenue del evento ACTUAL (translúcido: se adapta al tema). */
export const FONDO_EVENTO_ACTUAL = 'rgba(37, 99, 235, 0.06)';

/**
 * La especie del evento (`tipo`) → estado visual, INDEPENDIENTE del tipo salvo
 * en las dos especies que no son «un hecho más ya cumplido»:
 *
 *  · `VENCIMIENTO_CALCULADO` → `projected`: no ocurrió, se recalcula.
 *  · `ACTA` (de observaciones) → `warning`: es el hecho que exige la atención
 *    del ciudadano (subsanar) y que suspende el término.
 *
 * Todo lo demás que ya ocurrió es `completed`. El marcado de «en curso» NO sale
 * de aquí: lo pone `construirEventosVisuales` sobre la fase actual del camino.
 */
export function estadoVisualDeTipo(tipo: EventoTimelineItem['tipo']): EstadoVisual {
  if (tipo === 'VENCIMIENTO_CALCULADO') return 'projected';
  if (tipo === 'ACTA') return 'warning';
  return 'completed';
}

/** Un evento del riel ya resuelto a su estado visual — lo que el render consume. */
export interface EventoVisual {
  titulo: string;
  cuando?: string;
  quien?: string;
  resumen?: string;
  meta?: string;
  detalleTecnico?: string;
  estadoVisual: EstadoVisual;
  /** `true` en el único evento que representa DÓNDE está el expediente ahora. */
  esActual: boolean;
}

/** El estado jurídico y la completitud — lo mínimo para ubicar la fase actual. */
export interface ContextoEstadoExpediente {
  estado: EstadoJuridicoLicencia;
  documentacionCompleta?: boolean;
}

/** ¿El expediente sigue en trámite? (no resuelto, no histórico migrado). */
function sigueEnTramite(estado: EstadoJuridicoLicencia): boolean {
  return estado !== 'HISTORICO_SIN_RESOLVER' && !ESTADOS_RESUELTOS_LICENCIA.includes(estado);
}

/**
 * Traduce el riel de hechos a `EventoVisual[]` y —cuando hay contexto y el
 * expediente sigue en trámite— inserta la fase ACTUAL como un evento «en curso»
 * justo antes de la proyección de vencimiento.
 *
 * PURA: no ordena de nuevo (respeta el orden cronológico que ya trae la lista),
 * no toca fechas, no calcula nada. Solo clasifica y marca.
 */
export function construirEventosVisuales(
  eventos: EventoTimelineItem[],
  contexto?: ContextoEstadoExpediente,
): EventoVisual[] {
  const base: EventoVisual[] = eventos.map((e) => ({
    titulo: e.titulo,
    cuando: e.cuando,
    quien: e.quien,
    resumen: e.resumen,
    meta: e.meta,
    detalleTecnico: e.detalleTecnico,
    estadoVisual: estadoVisualDeTipo(e.tipo),
    esActual: false,
  }));

  if (!contexto || !sigueEnTramite(contexto.estado)) return base;

  const pasoActual = PASOS.find(
    (p) => situacionDePaso(p, contexto.estado, contexto.documentacionCompleta) === 'ACTUAL',
  );
  if (!pasoActual) return base;

  /* «En curso desde» = la fecha del último hecho REAL (no la proyección). Es un
     dato que YA existe en el historial, no una fecha calculada: cuándo el
     expediente alcanzó el punto en que está. */
  const ultimoHechoIso = [...eventos]
    .filter((e) => e.tipo !== 'VENCIMIENTO_CALCULADO' && e.ocurrioEn)
    .map((e) => e.ocurrioEn as string)
    .sort((a, b) => a.localeCompare(b))
    .at(-1);

  const eventoActual: EventoVisual = {
    titulo: pasoActual.titulo,
    resumen: capitalizar(pasoActual.subtexto('ACTUAL')),
    cuando: ultimoHechoIso ? `En curso desde el ${formatFechaColombia(ultimoHechoIso)}` : undefined,
    estadoVisual: 'in_progress',
    esActual: true,
  };

  /* Va ANTES de la proyección de vencimiento (lo que aún no ocurre queda al
     final) y DESPUÉS de todo hecho real. */
  const idxProyeccion = base.findIndex((e) => e.estadoVisual === 'projected');
  if (idxProyeccion === -1) return [...base, eventoActual];
  return [...base.slice(0, idxProyeccion), eventoActual, ...base.slice(idxProyeccion)];
}

function capitalizar(texto: string): string {
  return texto.length ? texto[0]!.toUpperCase() + texto.slice(1) : texto;
}
