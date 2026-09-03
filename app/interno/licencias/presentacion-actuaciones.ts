/**
 * Presentación de `Actuacion[]` como riel de `EventoTimeline` — extraído
 * de `fixtures.ts` (bloque "Integración UI y demo") para que la MISMA
 * función sirva a los fixtures (preview de componentes) y a la Pantalla 02
 * real (`[expedienteId]/DetalleLicenciaClient.tsx`) sin duplicar el mapa
 * de etiquetas ni el orden cronológico. Función PURA de presentación —
 * no calcula ningún término, solo traduce hechos ya ocurridos a texto.
 */

import type { Actuacion, OrigenActuacion } from '@/lib/motor-expedientes/tipos';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { PREFIJO_AVISO_ACTA_COMUNICACION } from '@/lib/motor-expedientes/comunicaciones-licencia';
import type { EventoTimelineItem } from './tipos';

/* EN LENGUAJE DE PERSONA, no el slug. Sin título, el mapa caía a `a.tipo` y la
   pantalla imprimía literalmente `apertura-expediente` — la traza interna del
   sistema delante de quien atiende a un ciudadano. Lo vio el propietario en
   producción el 30-ago-2026. */
export const TITULO_ACTUACION: Record<string, string> = {
  'apertura-expediente': 'Se abrió el expediente',
  'vinculacion-radicado': 'Se vinculó con el radicado de ventanilla',
  'inicio-revision': 'Empezó la revisión técnica',
  /* El nombre COMPLETO del acto, como lo llama el Decreto 1077. El chip de
     estado nombra el ESTADO («Radicada en debida forma»); aquí se nombra el
     ACTO, que en la norma es «en legal y debida forma». No es divergencia: son
     dos cosas distintas. */
  'radicacion-debida-forma': 'Radicada en legal y debida forma',
  'acta-observaciones': 'Acta de observaciones',
  'respuesta-subsanacion': 'Respuesta de subsanación',
  'modificacion-solicitud': 'Modificación de la solicitud',
};

export const TIPO_TIMELINE: Record<string, EventoTimelineItem['tipo']> = {
  'apertura-expediente': 'APERTURA',
  'vinculacion-radicado': 'APERTURA',
  'inicio-revision': 'SUBSANACION',
  'radicacion-debida-forma': 'RADICACION',
  'acta-observaciones': 'ACTA',
  'respuesta-subsanacion': 'SUBSANACION',
  'modificacion-solicitud': 'SUBSANACION',
  'comunicacion-enviada': 'COMUNICACION',
};

/**
 * Título de una actuación `comunicacion-enviada` (Bloque A·A4/A5). El
 * SERVIDOR no distingue constancia de aviso de acta con un campo propio —
 * `Actuacion`/`ActuacionLicenciaDoc` (`lib/motor-expedientes/tipos.ts`,
 * `lib/server/expedientes-licencias.ts`) NO tienen `metadata`; las dos
 * comparten `tipo: 'comunicacion-enviada'` y solo se distinguen por el
 * PREFIJO de `detalle` que arma `construirActuacionComunicacionEnviada`
 * (`"Constancia de radicación…"` desde `desde-radicado/route.ts`,
 * `"Aviso de acta de observaciones…"` desde `[id]/actuaciones/route.ts`).
 * Si el texto no coincide con ninguno de los dos prefijos conocidos hoy,
 * cae en un título genérico en vez de fallar — un `detalle` inesperado no
 * debe romper el timeline.
 *
 * `PREFIJO_AVISO_ACTA_COMUNICACION` viene de `lib/motor-expedientes/
 * comunicaciones-licencia.ts` — MISMA constante que usa el servidor
 * (`esComunicacionDelActa`, `lib/server/expedientes-licencias.ts`) para
 * decidir si una comunicación es el aviso del acta; antes de este fix este
 * archivo mantenía `'Aviso de acta'` como literal propio, duplicado.
 */
export function tituloComunicacionEnviada(detalle: string | undefined): string {
  if (detalle?.startsWith(PREFIJO_AVISO_ACTA_COMUNICACION)) return 'Aviso de acta enviado';
  if (detalle?.startsWith('Acuse')) return 'Acuse de recibo enviado al ciudadano';
  /* Se conserva para las actuaciones YA ESCRITAS antes del 26-ago-2026, cuando
     este momento enviaba una constancia. No se borra: el timeline debe seguir
     describiendo con fidelidad lo que de verdad salió aquel día. */
  if (detalle?.startsWith('Constancia')) return 'Constancia enviada al ciudadano';
  return 'Comunicación enviada al ciudadano';
}

/**
 * Construye el timeline de presentación a partir de la trazabilidad REAL
 * (`Actuacion[]`). `origenExpediente` controla si se añade la fila de
 * "Vencimiento calculado": para `RECONSTRUIDO` nunca se añade (R9 — no hay
 * término que proyectar sobre un histórico migrado), igual que hacía
 * `fixtures.ts` antes de este extraído.
 */
export function construirTimelineDesdeActuaciones(
  actuaciones: Actuacion[],
  origenExpediente: OrigenActuacion | undefined,
  vigente: Date | null,
  /**
   * ISO del instante en que la solicitud quedó completa. NO es una actuación
   * —vive en `completitud.completoDesde`— y sin embargo es el hecho que ancla
   * el término: el historial lo pintaba en ninguna parte.
   */
  completoDesde?: string | null,
): EventoTimelineItem[] {
  const items: EventoTimelineItem[] = actuaciones
    .slice()
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .map((a) => ({
      tipo: TIPO_TIMELINE[a.tipo] ?? 'SUBSANACION',
      titulo: a.tipo === 'comunicacion-enviada' ? tituloComunicacionEnviada(a.detalle) : (TITULO_ACTUACION[a.tipo] ?? a.tipo),
      cuando: formatFechaHoraColombia(a.fecha),
      quien: a.actorNombre || undefined,
      /* EL RESUMEN SE COMPONE DE CAMPOS, NUNCA PARSEANDO EL `detalle`. Partir
         prosa para extraer datos es frágil: el día que alguien cambie una coma,
         el resumen miente. Lo que no esté estructurado se queda abajo. */
      resumen: resumenDe(a),
      /* La jerga entera, tal cual la escribió el servidor. Plegada. */
      detalleTecnico: a.detalle || undefined,
      meta: formatFechaColombia(a.fecha),
      ocurrioEn: a.fecha,
    }));

  /* LA COMPLETITUD, que no es actuación pero sí es hecho. Se inserta en su sitio
     cronológico, no al final: el historial cuenta una historia y el orden es
     parte de lo que cuenta. */
  if (completoDesde) {
    items.push({
      tipo: 'COMPLETITUD',
      titulo: 'La documentación quedó completa',
      cuando: formatFechaHoraColombia(completoDesde),
      resumen: 'Desde este día se ancla el plazo para resolver.',
      meta: formatFechaColombia(completoDesde),
      ocurrioEn: completoDesde,
    });
    /* POR EL INSTANTE, no por la fecha formateada (3-sep-2026, cazado por el
       propietario en el ensayo). El orden anterior comparaba `meta`, que es un
       `dd/mm/yyyy` ya escrito para leer, y fallaba de dos maneras: con día de
       precisión, la completitud caía al FINAL entre hechos del mismo día —que
       es justo lo que el comentario de arriba promete que no pasa—; y entre
       meses distintos el orden salía invertido, porque «01/09» va antes que
       «29/08» como texto y después como calendario. */
    items.sort((a, b) => (a.ocurrioEn ?? '').localeCompare(b.ocurrioEn ?? ''));
  }

  if (origenExpediente !== 'RECONSTRUIDO' && vigente) {
    items.push({
      tipo: 'VENCIMIENTO_CALCULADO',
      /* NO ES UN HECHO, y el título lo dice: «si nada lo detiene». Los demás
         eventos ocurrieron; este se recalcula en cada consulta y un acta de
         observaciones lo suspende. */
      titulo: `Vencerá el ${formatFechaColombia(vigente)} — si nada lo detiene`,
      resumen: 'Proyección, nunca almacenada: se recalcula a partir de los hechos anteriores. Un acta de observaciones la suspende.',
      meta: 'Proyección, nunca almacenado — se recalcula en cada consulta a partir de los hechos anteriores.',
    });
  }

  return items;
}

/** Lo que importa del hecho, compuesto de CAMPOS estructurados. */
function resumenDe(a: Actuacion): string | undefined {
  if (a.tipo === 'apertura-expediente') return undefined;
  return undefined;
}

/** Fecha y hora en Bogotá, para leer. */
function formatFechaHoraColombia(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(iso));
  } catch {
    return formatFechaColombia(iso);
  }
}
