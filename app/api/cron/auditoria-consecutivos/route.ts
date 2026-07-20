import { NextResponse }          from 'next/server';
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
      // semántica (ver reporte de la tarea A1).
      const docsSnap = await db.collection(coleccion).get();
      const presentesLista: number[] = [];
      for (const d of docsSnap.docs) {
        if (!perteneceAlAnio(d.id, anio)) continue;
        const c = consecutivoDeId(d.id);
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
