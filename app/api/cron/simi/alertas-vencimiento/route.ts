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

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
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
    return NextResponse.json({ error: msg, duracionMs: Date.now() - inicio }, { status: 500 });
  }
}
