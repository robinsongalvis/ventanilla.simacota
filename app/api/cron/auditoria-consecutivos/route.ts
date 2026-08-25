import { NextResponse }          from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { getFirebaseAdminDb }    from '@/lib/firebase-admin';
import { autorizarCron }         from '@/lib/seguridad/autorizar-cron';
import { enviarEmail }           from '@/lib/email/mailer';
import { logError }              from '@/lib/logger';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';
import {
  buildAuditoriaConsecutivosHtml,
  buildAuditoriaConsecutivosSubject,
}                                 from '@/lib/email/templates/auditoria-consecutivos';
import type { SerieHallazgoAuditoria } from '@/lib/email/templates/auditoria-consecutivos';
import {
  COLECCION_POR_SERIE,
  huecosDe,
  duplicadosDe,
  consecutivoDeId,
  perteneceAlAnio,
} from '@/scripts/laboratorio/detectar-consecutivos-fantasma.mjs';

export const runtime = 'nodejs';
// Techo del plan (Vercel Hobby/Pro: 300s en funciones cron) — mismo estándar
// que los demás crons de plazo legal (Roadmap P1.4).
export const maxDuration = 300;

// Tamaño de lote para la barrida por cursor (ver nota junto al bucle de
// lectura más abajo sobre por qué esta serie SÍ debe leerse completa).
const TAMANO_LOTE_BARRIDA = 500;

/* ══════════════════════════════════════════════════════════════
   GET /api/cron/auditoria-consecutivos   (A1)

   Ejecutado semanalmente por Vercel Cron (lunes 8:00 a.m. Colombia), o
   manualmente con CRON_SECRET.

   Automatiza la verificación de continuidad Y unicidad de las 3 series
   legales de radicación (AGN 060/2001 art. 5) que hoy hace manualmente
   `scripts/laboratorio/detectar-consecutivos-fantasma.mjs`: barre, por
   cada serie (radicados, salidas, planillas) del año en curso, el
   contador (`counters/{serie}-{año}.ultimo`) contra los consecutivos
   realmente persistidos y reporta huecos (número consumido sin
   documento) y duplicados (mismo consecutivo en 2+ documentos).

   REUTILIZA las funciones puras del detector (`huecosDe`, `duplicadosDe`,
   `consecutivoDeId`, `perteneceAlAnio`, `COLECCION_POR_SERIE`) — no
   duplica el algoritmo. El script sigue funcionando standalone (esta ruta
   solo importa de él, no lo modifica).

   SOLO LECTURA ABSOLUTA: nunca escribe en counters ni en las colecciones
   de negocio. Si hay hallazgos, el sistema los REPORTA por correo — jamás
   los corrige por sí solo (Principio 9: la automatización propone, un
   funcionario decide y prepara, si aplica, la constancia de subsanación).

   Silencio = todo bien: si huecos+duplicados == 0 no se envía correo,
   solo se registra el evento de negocio de la corrida.

   Seguridad: requiere header Authorization: Bearer <CRON_SECRET>
   (Vercel lo inyecta automáticamente para cron jobs configurados).
══════════════════════════════════════════════════════════════ */

interface ReporteSerie {
  coleccion:  string;
  ultimo:     number;
  documentos: number;
  distintos:  number;
  huecos:     number[];
  duplicados: number[];
}

/**
 * Rama propia para la serie `expedientes` (PASO 6, Fase 2 arranque) —
 * DELIBERADAMENTE fuera de `COLECCION_POR_SERIE`/`huecosDe`/`duplicadosDe`:
 * esa maquinaria asume el formato `1-110-{AAAA}-{NNNNNNNN}` de las 3 series
 * legadas (`perteneceAlAnio` con regex de año de 4 dígitos;
 * `consecutivoDeId` toma el ÚLTIMO segmento tras `-`). El número de
 * expediente (`68745-0-26-0020`) tiene AÑO DE 2 DÍGITOS en el PENÚLTIMO
 * segmento — reutilizar esas funciones tal cual produciría 19 "huecos"
 * falsos (`perteneceAlAnio` nunca matchearía `-26-`) y `consecutivoDeId`
 * devolvería el consecutivo real por casualidad de posición, no por diseño.
 * Ampliar esa maquinaria para dos formatos de id es tarea de Fase 1, cuando
 * exista la colección real de expedientes (deuda #12, ADR-0026 §A2) — aquí
 * NO se inventa un nombre de colección que todavía no existe.
 *
 * Por eso esta serie solo reporta el ESTADO del contador, sin auditoría de
 * continuidad/unicidad contra documentos (no hay colección que barrer):
 * - `SIN_ABRIR`: el counter `counters/expedientes-{año}` no existe — cero
 *   ruido, es el estado normal antes de que Fase 1/2 emita el primer
 *   expediente.
 * - `PARCIAL`: el counter existe y tiene forma válida (`ultimo` entero >=
 *   0) — se reporta su valor, pero la auditoría de continuidad real queda
 *   pendiente de que exista la colección.
 * - `CORRUPTO`: el counter existe pero `ultimo` NO es un entero >= 0 — esto
 *   SÍ es un hallazgo real (dato corrupto), y es el único caso de esta
 *   rama que dispara el correo de alerta.
 */
interface ReporteSerieExpedientes {
  estado: 'SIN_ABRIR' | 'PARCIAL' | 'CORRUPTO';
  ultimo?: number;
  motivo?: string;
}

/**
 * Lógica PURA de la rama `expedientes` — testeable sin Firestore: recibe el
 * dato ya leído de `counters/expedientes-{año}` (`undefined` si el
 * documento no existe) y decide el estado. No hace I/O.
 */
export function auditarCounterExpedientes(
  data: Record<string, unknown> | undefined,
): ReporteSerieExpedientes {
  if (data === undefined) {
    return { estado: 'SIN_ABRIR' };
  }
  const ultimoRaw = data.ultimo;
  const ultimo = Number(ultimoRaw);
  if (!Number.isInteger(ultimo) || ultimo < 0) {
    return {
      estado: 'CORRUPTO',
      motivo: `counters/expedientes-{año}.ultimo inválido (${JSON.stringify(ultimoRaw)}): debe ser un entero >= 0.`,
    };
  }
  return {
    estado: 'PARCIAL',
    ultimo,
    motivo: 'auditoría de continuidad pendiente de colección (Fase 1)',
  };
}

/**
 * Lee TODOS los IDs de documento de una colección, en lotes con cursor
 * (`limit` + `startAfter`), SIN techo de lectura: a diferencia de otras
 * consultas acotadas del Roadmap (P1.4), esta barrida es una auditoría de
 * CONTINUIDAD de la serie — necesita ver el 100% de los consecutivos
 * persistidos del año para poder afirmar "no hay huecos ni duplicados".
 * Detenerse antes de agotar la colección invalidaría el propósito del
 * control (silencio ≠ "todo bien" si en realidad quedó sin barrer). El
 * lote acota la MEMORIA y la forma de la lectura (varias páginas en vez de
 * un `.get()` monolítico), no el ALCANCE, que sigue siendo la colección
 * completa. Solo se pide `FieldPath.documentId()` como orden estable de
 * paginación — no se leen campos de negocio, la auditoría solo usa el ID.
 */
async function leerTodosLosIds(
  db: FirebaseFirestore.Firestore,
  coleccion: string,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let agotado = false;

  while (!agotado) {
    let lote: FirebaseFirestore.Query = db.collection(coleccion).orderBy(FieldPath.documentId()).limit(TAMANO_LOTE_BARRIDA);
    if (cursor) lote = lote.startAfter(cursor);

    const loteSnap = await lote.get();
    for (const d of loteSnap.docs) ids.push(d.id);
    // `docs.length` (no `.size`) a propósito: es la señal de fin de página
    // más robusta — no depende de una propiedad específica del snapshot real
    // de Firestore (que en los tests con mock no siempre está presente) y es
    // matemáticamente idéntica a `.size` en el SDK real.
    if (loteSnap.docs.length > 0) cursor = loteSnap.docs[loteSnap.docs.length - 1];
    if (loteSnap.docs.length < TAMANO_LOTE_BARRIDA) agotado = true;
  }

  return ids;
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = autorizarCron({
    authorization: request.headers.get('authorization'),
    secret:        process.env.CRON_SECRET,
  });

  if (!auth.ok) {
    console.warn('[cron/auditoria-consecutivos] acceso denegado', { motivo: auth.motivo });
    return NextResponse.json({ error: auth.mensaje }, { status: auth.status });
  }

  const db          = getFirebaseAdminDb();
  const anio        = new Date().getFullYear();
  const inicio      = Date.now();
  const timestampIso = new Date().toISOString();

  try {
    const series: Record<string, ReporteSerie | ReporteSerieExpedientes> = {};
    let totalHuecos = 0;
    let totalDuplicados = 0;
    let totalDocumentosLeidos = 0;
    /* Contadores que se contradicen a sí mismos. Se reportan aparte de huecos y
       duplicados porque son de otra naturaleza: un hueco es un síntoma, esto es
       la CAUSA — y la causa hay que arreglarla antes de que produzca síntomas. */
    const contadoresIncoherentes: string[] = [];

    for (const [serie, coleccion] of Object.entries(COLECCION_POR_SERIE)) {
      // Solo lectura: contador anual de la serie (NUNCA se escribe aquí).
      const counterSnap = await db.doc(`counters/${serie}-${anio}`).get();
      const ultimo = Number(counterSnap.data()?.ultimo ?? 0);

      /* ── Vigilancia: ¿el contador cuadra con su propia historia de apertura?
         Tercera capa, y la que ve lo que las otras dos no pueden.

         La reserva de unicidad IMPIDE el duplicado. La coherencia en la
         emisión DETIENE una emisión sobre un contador movido hacia atrás.
         Ninguna de las dos ve un contador movido hacia ADELANTE: eso no rompe
         nada al emitir —solo salta números— y solo se nota mirando.

         Aquí se mira, y SOLO se mira: este cron es de lectura absoluta. */
      const aperturaReg = counterSnap.data()?.apertura as
        { abiertoEn?: number; autorizadoPor?: string; fecha?: string } | undefined;
      const abiertoEn = aperturaReg?.abiertoEn;
      if (typeof abiertoEn === 'number' && Number.isInteger(abiertoEn) && ultimo < abiertoEn - 1) {
        contadoresIncoherentes.push(
          `${serie}: declara apertura en ${abiertoEn} (autorizó ${aperturaReg?.autorizadoPor ?? 'sin declarar'}` +
          `${aperturaReg?.fecha ? `, ${aperturaReg.fecha}` : ''}) pero su valor es ${ultimo}. ` +
          `Alguien lo movió hacia atrás fuera del mecanismo de apertura.`,
        );
      }

      // Solo lectura: consecutivos realmente persistidos del año en curso.
      // Mismo criterio que el detector: cuenta TODO documento del año,
      // incluidos los marcados isTest — un radicado de prueba consume un
      // consecutivo real de la MISMA serie/contador, así que excluirlo del
      // conteo de "presentes" generaría un falso hueco. No se cambia esta
      // semántica (ver reporte de la tarea A1). La lectura en sí ahora es
      // por lotes con cursor (`leerTodosLosIds`) en vez de un único `.get()`
      // — MISMO alcance (toda la colección), solo cambia la forma de traerla.
      const idsColeccion = await leerTodosLosIds(db, coleccion);
      const presentesLista: number[] = [];
      for (const id of idsColeccion) {
        if (!perteneceAlAnio(id, anio)) continue;
        const c = consecutivoDeId(id);
        if (c !== null) presentesLista.push(c);
      }
      const presentes = new Set(presentesLista);

      const huecos = huecosDe(ultimo, presentes);
      const duplicados = duplicadosDe(presentesLista);

      series[serie] = {
        coleccion, ultimo,
        documentos: presentesLista.length,
        distintos:  presentes.size,
        huecos, duplicados,
      };
      totalHuecos += huecos.length;
      totalDuplicados += duplicados.length;
      totalDocumentosLeidos += presentesLista.length;
    }

    // Rama propia de 'expedientes' (PASO 6) — SIEMPRE se agrega al reporte,
    // sin importar el estado, para que el reporte nunca "olvide" la serie
    // mientras Fase 1 no le asigna colección (ver JSDoc de
    // ReporteSerieExpedientes / auditarCounterExpedientes arriba).
    const counterExpedientesSnap = await db.doc(`counters/expedientes-${anio}`).get();
    const reporteExpedientes = auditarCounterExpedientes(counterExpedientesSnap.data());
    series.expedientes = reporteExpedientes;
    const expedientesCorrupto = reporteExpedientes.estado === 'CORRUPTO';
    if (expedientesCorrupto) {
      logError({
        radicadoId: 'n/a',
        modulo: 'cron/auditoria-consecutivos/expedientes',
        error: new Error(reporteExpedientes.motivo ?? 'counter de expedientes corrupto'),
      });
    }

    const totalHallazgos = totalHuecos + totalDuplicados + (expedientesCorrupto ? 1 : 0);

    registrarEventoNegocio({
      operacion:  'auditoria_consecutivos',
      resultado:  'ok',
      latenciaMs: Date.now() - inicio,
      radicadoId: null,
      actorRol:   'CRON',
      tenant:     'VENTANILLA_UNICA',
      docsLeidos: totalDocumentosLeidos,
    });

    if (totalHallazgos === 0) {
      // Silencio = todo bien: sin correo.
      return NextResponse.json({
        ok: true, anio, timestamp: timestampIso, hallazgos: 0, series,
      });
    }

    // Hay hallazgos: notificar por correo (informativo, nunca corrige).
    const destino = process.env.AUDITORIA_ALERTA_EMAIL ?? process.env.EMAIL_USER;
    let correoEnviado = false;

    if (!destino) {
      logError({
        radicadoId: 'n/a',
        modulo:     'cron/auditoria-consecutivos',
        error:      new Error('Sin destinatario configurado (AUDITORIA_ALERTA_EMAIL / EMAIL_USER).'),
      });
    } else {
      try {
        // La plantilla del correo (SerieHallazgoAuditoria) asume la forma de
        // las 3 series legadas (huecos/duplicados) — 'expedientes' tiene una
        // forma distinta (estado) y se excluye aquí; su hallazgo CORRUPTO ya
        // se registró vía logError arriba y siempre aparece en la respuesta
        // JSON. Extender la plantilla para 'expedientes' queda para cuando
        // Fase 1 le asigne colección real y tenga auditoría de continuidad
        // que valga la pena mostrar en el correo.
        const seriesArr: SerieHallazgoAuditoria[] = Object.entries(series)
          .filter((entry): entry is [string, ReporteSerie] => entry[0] !== 'expedientes')
          .map(([nombre, s]) => ({ serie: nombre, ...s }));

        const asunto = buildAuditoriaConsecutivosSubject(totalHallazgos, anio);
        const html = buildAuditoriaConsecutivosHtml({
          anio, timestamp: timestampIso, series: seriesArr, totalHuecos, totalDuplicados,
        });

        await enviarEmail({ to: destino, subject: asunto, html });
        correoEnviado = true;
      } catch (err) {
        logError({ radicadoId: 'n/a', modulo: 'cron/auditoria-consecutivos', error: err });
      }
    }

    return NextResponse.json({
      ok: true, anio, timestamp: timestampIso, hallazgos: totalHallazgos, correoEnviado, series,
    });

  } catch (err) {
    logError({ radicadoId: 'n/a', modulo: 'cron/auditoria-consecutivos', error: err });
    return NextResponse.json({ error: 'No fue posible ejecutar la auditoría de consecutivos.' }, { status: 500 });
  }
}
