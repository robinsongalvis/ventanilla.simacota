/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Alerta de vencimiento de radicado

   Identidad institucional (verde #14532D + dorado #D4A017), extraída del
   cron `app/api/cron/alertas-vencimiento/route.ts` siguiendo el mismo
   patrón de `lib/email/templates/desistimiento.ts` (plantilla pura,
   testeable de forma aislada, HTML de email con tablas + estilos inline —
   sin CSS externo ni flexbox, para compatibilidad con Gmail/Outlook).

   Saludo digno: si no hay nombre de funcionario responsable registrado
   (vacío o literalmente "No registrado"), se saluda al equipo de la
   dependencia en lugar de imprimir "No registrado" en el correo.
══════════════════════════════════════════════════════════════ */

export interface TemplateAlertaVencimientoParams {
  radicadoId:        string;
  /** Nombre del funcionario responsable, tal como llega de Firestore (puede venir vacío). */
  funcionarioNombre: string;
  asunto:            string;
  ciudadanoNombre:   string;
  dependenciaNombre: string;
  diasRestantes:     number;
  fechaVencimiento:  string;
  tipoSolicitud:     string;
  enlaceUrl:         string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildAlertaVencimientoSubject(radicadoId: string, diasRestantes: number): string {
  return diasRestantes === 0
    ? `[URGENTE] Radicado ${radicadoId} vence HOY`
    : `[ALERTA] Radicado ${radicadoId} vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''} hábil${diasRestantes > 1 ? 'es' : ''}`;
}

export function buildAlertaVencimientoHtml(p: TemplateAlertaVencimientoParams): string {
  const fechaFmt = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const nombreLimpio    = p.funcionarioNombre.trim();
  const tieneNombreReal = nombreLimpio.length > 0 && nombreLimpio !== 'No registrado';
  const saludo = tieneNombreReal
    ? `Estimado/a <strong style="color:#14532D;">${escapeHtml(nombreLimpio)}</strong>:`
    : `Estimado equipo de <strong style="color:#14532D;">${escapeHtml(p.dependenciaNombre)}</strong>:`;

  const urgente = p.diasRestantes === 0;
  const textoUrgencia = urgente
    ? 'VENCE HOY'
    : `VENCE EN ${p.diasRestantes} DÍA${p.diasRestantes > 1 ? 'S' : ''} HÁBIL${p.diasRestantes > 1 ? 'ES' : ''}`;

  return /* html */`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Cabecera -->
  <tr><td style="background:#14532D;padding:24px 32px;text-align:left;">
    <img src="https://ventanilla-simacota.vercel.app/brand/logo-alcaldia-simacota.png" alt="Alcaldía de Simacota" height="44" style="height:44px;display:block;margin:0 0 10px;border:0;outline:none;"/>
    <p style="margin:0;color:#FDF6E3;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">ALCALDÍA DE SIMACOTA · VENTANILLA ÚNICA DIGITAL</p>
    <p style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">Alerta de vencimiento</p>
  </td></tr>

  <!-- Cinta de urgencia -->
  <tr><td style="background:#FDF6E3;padding:14px 32px;">
    <span style="background:#D4A017;color:#1F2933;font-size:11px;font-weight:700;letter-spacing:1px;padding:5px 14px;border-radius:20px;">${textoUrgencia}</span>
    <span style="color:#5A4A16;font-size:12px;font-weight:600;margin-left:10px;">Fecha límite: ${fechaFmt}</span>
  </td></tr>

  <!-- Cuerpo -->
  <tr><td style="padding:28px 32px;background:#ffffff;">
    <p style="margin:0 0 16px;color:#37474f;font-size:15px;line-height:1.6;">
      ${saludo}
    </p>
    <p style="margin:0 0 20px;color:#37474f;font-size:15px;line-height:1.6;">
      El siguiente radicado está próximo a vencer y requiere su atención prioritaria para dar respuesta dentro del término legal (Ley 1755 de 2015).
    </p>

    <!-- Tarjeta radicado -->
    <table width="100%" style="background:#F6F9F6;border-left:4px solid #14532D;border-radius:4px;margin-bottom:22px;">
    <tr><td style="padding:18px 22px;">
      <p style="margin:0 0 3px;color:#5A6B5D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Radicado</p>
      <p style="margin:0 0 14px;color:#14532D;font-size:15px;font-weight:800;font-family:monospace;word-break:break-word;">${escapeHtml(p.radicadoId)}</p>
      <p style="margin:0 0 3px;color:#5A6B5D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Asunto</p>
      <p style="margin:0 0 14px;color:#37474f;font-size:14px;">${escapeHtml(p.asunto)}</p>
      <p style="margin:0 0 3px;color:#5A6B5D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Dependencia responsable</p>
      <p style="margin:0 0 14px;color:#37474f;font-size:14px;">${escapeHtml(p.dependenciaNombre)}</p>
      <p style="margin:0 0 3px;color:#5A6B5D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Fecha límite de respuesta</p>
      <p style="margin:0 0 14px;color:#37474f;font-size:14px;">${fechaFmt}</p>
      <p style="margin:0 0 3px;color:#5A6B5D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Ciudadano</p>
      <p style="margin:0 0 14px;color:#37474f;font-size:14px;">${escapeHtml(p.ciudadanoNombre)}</p>
      <p style="margin:0 0 3px;color:#5A6B5D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Tipo solicitud</p>
      <p style="margin:0;color:#37474f;font-size:14px;">${escapeHtml(p.tipoSolicitud)}</p>
    </td></tr>
    </table>

    <!-- Botón CTA -->
    <table cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
    <tr><td style="background:#14532D;border-radius:6px;">
      <a href="${escapeHtml(p.enlaceUrl)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Abrir el radicado en la Ventanilla →</a>
    </td></tr>
    </table>
  </td></tr>

  <!-- Pie institucional -->
  <tr><td style="background:#F3F6F3;padding:20px 32px;text-align:center;">
    <p style="margin:0 0 4px;color:#5A6B5D;font-size:12px;font-weight:600;">Alcaldía Municipal de Simacota, Santander · Ventanilla Única Digital</p>
    <p style="margin:0 0 4px;color:#5A6B5D;font-size:11px;">Mensaje automático del sistema — por favor no responda a este correo.</p>
    <p style="margin:0;color:#5A6B5D;font-size:11px;">Sus datos personales se tratan conforme a la Ley 1581 de 2012.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`.trim();
}
