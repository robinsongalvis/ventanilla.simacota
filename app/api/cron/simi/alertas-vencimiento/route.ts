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
    return NextResponse.json(
      { error: 'No fue posible ejecutar el cron.', duracionMs: Date.now() - inicio },
      { status: 500 },
    );
  }
}
