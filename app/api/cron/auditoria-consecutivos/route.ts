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
    const series: Record<string, ReporteSerie> = {};
    let totalHuecos = 0;
    let totalDuplicados = 0;
    let totalDocumentosLeidos = 0;

    for (const [serie, coleccion] of Object.entries(COLECCION_POR_SERIE)) {
      // Solo lectura: contador anual de la serie (NUNCA se escribe aquí).
      const counterSnap = await db.doc(`counters/${serie}-${anio}`).get();
      const ultimo = Number(counterSnap.data()?.ultimo ?? 0);

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

    const totalHallazgos = totalHuecos + totalDuplicados;

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
        const seriesArr: SerieHallazgoAuditoria[] = Object.entries(series).map(([nombre, s]) => ({
          serie: nombre, ...s,
        }));

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
