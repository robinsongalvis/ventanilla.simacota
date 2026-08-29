/**
 * GET /api/cron/simi/alertas-vencimiento
 * Cron job mejorado con alertas predictivas SIMI.
 *
 * Protegido por: Authorization: Bearer ${CRON_SECRET}
 * Configurar en Vercel Cron Jobs: diariamente a las 07:00 COT.
 */

import { NextResponse }          from 'next/server';
import { generateDeadlineAlerts } from '@/lib/simi-juridico/predictDeadlineAlerts';
import { createNotification }    from '@/lib/simi-juridico/createNotification';
import { autorizarCron }         from '@/lib/seguridad/autorizar-cron';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';

export const runtime = 'nodejs';
// Techo del plan (Vercel Hobby/Pro: 300s en funciones cron) — mismo estándar
// que los demás crons de plazo legal (Roadmap P1.4). La consulta subyacente
// (`generateDeadlineAlerts` en lib/simi-juridico/predictDeadlineAlerts.ts) ya
// está acotada con `.limit(500)` — no se toca (pertenece al dominio IA/SIMI).
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  const auth = autorizarCron({
    authorization: request.headers.get('authorization'),
    secret:        process.env.CRON_SECRET,
  });

  if (!auth.ok) {
    console.warn('[cron/simi/alertas] acceso denegado', { motivo: auth.motivo });
    return NextResponse.json({ error: auth.mensaje }, { status: auth.status });
  }

  const inicio = Date.now();

  try {
    const result = await generateDeadlineAlerts();

    // Crear notificación interna de resumen (solo si hay alertas críticas)
    const criticas = result.resumen.filter((r) =>
      ['vencido', 'vencimiento_1_dia', 'pendiente_juridica'].includes(r.tipo),
    );

    if (criticas.length > 0) {
      void createNotification({
        tipo:            'pendiente_revision_juridica',
        tenantId:        'TODOS',
        destinatarioRol: 'ADMIN',
        titulo:          `⚠️ ${result.alertasCreadas} alertas de vencimiento generadas`,
        mensaje:         `Hoy se generaron ${result.alertasCreadas} alertas. Críticas: ${
          criticas.map((c) => `${c.tipo}: ${c.cantidad}`).join(', ')
        }. Ver dashboard de Control Interno.`,
        creadoPor:       'system-cron',
      });
    }

    /* DEJAR RASTRO DE LO QUE HIZO, no solo de que respondió 200.
       Hasta el 27-ago-2026 este cron terminaba en silencio: los logs de Vercel
       guardan el estado y la duración, no el cuerpo de la respuesta. Así que
       una corrida que analizó 500 radicados y una que no encontró ninguno se
       veían EXACTAMENTE igual — y la única forma de saber qué hizo era
       ejecutarlo a mano con el secreto, que no todo el mundo tiene.
       Es la misma regla de siempre: el silencio de un vigilante tiene que poder
       distinguirse de «no hizo nada». */
    registrarEventoNegocio({
      operacion:  'alertas_vencimiento_simi',
      resultado:  'ok',
      latenciaMs: Date.now() - inicio,
      radicadoId: null,
      actorRol:   'CRON',
      tenant:     'VENTANILLA_UNICA',
      docsLeidos: result.radicadosAnalizados,
      alertasCreadas:  result.alertasCreadas,
      alertasOmitidas: result.alertasOmitidas,
    });

    return NextResponse.json({
      ok:                  true,
      duracionMs:          Date.now() - inicio,
      radicadosAnalizados: result.radicadosAnalizados,
      alertasCreadas:      result.alertasCreadas,
      alertasOmitidas:     result.alertasOmitidas,
      resumen:             result.resumen,
      timestamp:           new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/simi/alertas]', msg);
    /* Un fallo también deja rastro estructurado: sin esto, una corrida que
       revienta y una que no encuentra nada se distinguen solo por el 500. */
    registrarEventoNegocio({
      operacion:  'alertas_vencimiento_simi',
      resultado:  'error',
      latenciaMs: Date.now() - inicio,
      radicadoId: null,
      actorRol:   'CRON',
      tenant:     'VENTANILLA_UNICA',
      error:      err,
    });
    return NextResponse.json(
      { error: 'No fue posible ejecutar el cron.', duracionMs: Date.now() - inicio },
      { status: 500 },
    );
  }
}
