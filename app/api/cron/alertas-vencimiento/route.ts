import { NextResponse }          from 'next/server';
import { getFirebaseAdminDb }    from '@/lib/firebase-admin';
import { enviarEmail }           from '@/lib/email/mailer';
import { diasRestantesHabiles }  from '@/lib/tiempos-radicado';
import { DIRECTORIO_TENANTS }    from '@/src/types/reglas-negocio';
import { logError }              from '@/lib/logger';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId }         from '@/src/types/radicado';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   GET /api/cron/alertas-vencimiento
   Ejecutado diariamente por Vercel Cron (o manualmente con CRON_SECRET).

   Busca radicados activos con ≤ 2 días hábiles al vencimiento y envía
   email de alerta al funcionario responsable y/o a la dependencia.

   Seguridad: requiere header Authorization: Bearer <CRON_SECRET>
   (Vercel lo inyecta automáticamente para cron jobs configurados).
══════════════════════════════════════════════════════════════ */

const ESTADOS_ACTIVOS = new Set([
  'PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'DEVUELTO', 'PRORROGA',
]);

const UMBRAL_DIAS = 2; // Alerta cuando quedan ≤ 2 días hábiles

export async function GET(request: Request): Promise<NextResponse> {
  // Verificar autorización
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const db    = getFirebaseAdminDb();
  const ahora = new Date().toISOString();
  let enviados = 0;
  let errores  = 0;
  let omitidos = 0;

  try {
    // Consultar TODOS los radicados activos (los cron no tienen contexto de tenant)
    const snap = await db.collection('ventanilla_radicados').get();
    const radicados = snap.docs
      .map((d) => d.data() as VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean })
      .filter((r) => ESTADOS_ACTIVOS.has(r.estadoActual) && !r.isTest && !r.excludeFromMetrics);

    for (const r of radicados) {
      const diasRestantes = diasRestantesHabiles(r.termino.fechaVencimiento);

      // Solo alertar si está dentro del umbral y no ya vencido (vencidos se manejan aparte)
      if (diasRestantes > UMBRAL_DIAS || diasRestantes < 0) {
        continue;
      }

      // Determinar destinatario: funcionario responsable o email de la dependencia
      const emailDestino =
        r.clasificacion.funcionarioResponsableEmail ||
        DIRECTORIO_TENANTS[r.clasificacion.oficinaDestino as TenantId]?.emailOficial;

      if (!emailDestino) {
        omitidos++;
        continue;
      }

      const nombreDestino =
        r.clasificacion.funcionarioResponsableNombre ||
        DIRECTORIO_TENANTS[r.clasificacion.oficinaDestino as TenantId]?.nombreOficial ||
        r.clasificacion.oficinaDestino;

      const dependenciaNombre =
        DIRECTORIO_TENANTS[r.clasificacion.oficinaDestino as TenantId]?.nombreOficial ||
        r.clasificacion.oficinaDestino;

      // Construir y enviar email de alerta
      try {
        const asuntoEmail = diasRestantes === 0
          ? `[URGENTE] Radicado ${r.radicadoId} vence HOY`
          : `[ALERTA] Radicado ${r.radicadoId} vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''} hábil${diasRestantes > 1 ? 'es' : ''}`;

        const htmlEmail = buildAlertaHtml({
          radicadoId:        r.radicadoId,
          funcionarioNombre: nombreDestino,
          asunto:            r.detalle.asunto,
          ciudadanoNombre:   r.solicitante.nombreCompleto,
          dependenciaNombre,
          diasRestantes,
          fechaVencimiento:  r.termino.fechaVencimiento,
          tipoSolicitud:     r.termino.tipoSolicitudNombre,
        });

        await enviarEmail({
          to:      emailDestino,
          subject: asuntoEmail,
          html:    htmlEmail,
        });

        enviados++;
      } catch (err) {
        errores++;
        logError({
          radicadoId: r.radicadoId,
          modulo:     'cron/alertas-vencimiento',
          error:      err,
        });
      }
    }

    return NextResponse.json({
      ok:        true,
      timestamp: ahora,
      total:     radicados.length,
      alertados: enviados,
      errores,
      omitidos,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/alertas-vencimiento] Error fatal:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ══════════════════════════════════════════════════════════════
   TEMPLATE HTML — Alerta de vencimiento próximo
══════════════════════════════════════════════════════════════ */

function escapeHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildAlertaHtml(p: {
  radicadoId:        string;
  funcionarioNombre: string;
  asunto:            string;
  ciudadanoNombre:   string;
  dependenciaNombre: string;
  diasRestantes:     number;
  fechaVencimiento:  string;
  tipoSolicitud:     string;
}): string {
  const fechaFmt = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const urgente = p.diasRestantes === 0;
  const colorBg    = urgente ? '#FEF2F2' : '#FFFBEB';
  const colorBorde = urgente ? '#DC2626' : '#F59E0B';
  const colorTexto = urgente ? '#991B1B' : '#92400E';
  const iconoUrgencia = urgente ? 'VENCE HOY' : `VENCE EN ${p.diasRestantes} DÍA${p.diasRestantes > 1 ? 'S' : ''}`;

  return /* html */`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#1a237e;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">Alerta de Vencimiento · Ventanilla Única</p>
    <p style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:800;">Radicado próximo a vencer</p>
  </td></tr>

  <!-- Badge urgencia -->
  <tr><td style="background:${colorBg};padding:14px 32px;border-bottom:1px solid ${colorBorde}40;">
    <span style="background:${colorBorde};color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;padding:5px 14px;border-radius:20px;">${iconoUrgencia}</span>
    <span style="color:${colorTexto};font-size:12px;font-weight:600;margin-left:10px;">Fecha límite: ${fechaFmt}</span>
  </td></tr>

  <!-- Cuerpo -->
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 16px;color:#37474f;font-size:15px;line-height:1.6;">
      Estimado/a <strong style="color:#1a237e;">${escapeHtml(p.funcionarioNombre)}</strong>,
    </p>
    <p style="margin:0 0 20px;color:#37474f;font-size:15px;line-height:1.6;">
      Le recordamos que el siguiente radicado está <strong>próximo a vencer</strong> y requiere su atención prioritaria:
    </p>

    <!-- Tarjeta radicado -->
    <table width="100%" style="background:#f8f9ff;border:1px solid #e3e8ff;border-radius:8px;margin-bottom:20px;">
    <tr><td style="padding:18px 22px;">
      <p style="margin:0 0 3px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Radicado</p>
      <p style="margin:0 0 14px;color:#1a237e;font-size:17px;font-weight:800;font-family:monospace;">${escapeHtml(p.radicadoId)}</p>
      <p style="margin:0 0 3px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Asunto</p>
      <p style="margin:0 0 14px;color:#37474f;font-size:14px;">${escapeHtml(p.asunto)}</p>
      <p style="margin:0 0 3px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Ciudadano</p>
      <p style="margin:0 0 14px;color:#37474f;font-size:14px;">${escapeHtml(p.ciudadanoNombre)}</p>
      <p style="margin:0 0 3px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Tipo solicitud</p>
      <p style="margin:0;color:#37474f;font-size:14px;">${escapeHtml(p.tipoSolicitud)}</p>
    </td></tr>
    </table>

    <p style="margin:0;color:#546e7a;font-size:13px;line-height:1.6;">
      Por favor ingrese al sistema para revisar y dar respuesta oportuna a esta solicitud.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#eceff1;padding:18px 32px;text-align:center;">
    <p style="margin:0;color:#546e7a;font-size:12px;font-weight:600;">
      Ventanilla Única Digital · ${escapeHtml(p.dependenciaNombre)} · Simacota, Santander
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`.trim();
}
