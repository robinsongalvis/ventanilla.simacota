/**
 * lib/email/templates/hito-licencia.ts
 *
 * El correo de un hito del expediente de licencia. Puro: recibe el hito ya
 * compuesto (`componerCorreoHito`) y devuelve HTML.
 *
 * No decide QUÉ se comunica —eso vive en `lib/email/hitos-licencia.ts`— ni
 * redacta el texto —que sale del vocabulario ciudadano de la consulta pública—.
 * Aquí solo se pinta.
 */
import type { CorreoHito } from '@/lib/email/hitos-licencia';

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface HitoLicenciaParams {
  hito: CorreoHito;
  numeroExpediente: string;
  solicitanteNombre: string;
  /** URL de la consulta pública, para que pueda verlo por sí mismo. */
  urlConsulta: string;
}

export function buildHitoLicenciaHtml(p: HitoLicenciaParams): string {
  const { hito } = p;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:#14532D;padding:24px 32px;">
    <p style="margin:0;color:#FDF6E3;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">ALCALDÍA DE SIMACOTA · SECRETARÍA DE PLANEACIÓN</p>
    <p style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">${escapeHtml(hito.titulo)}</p>
  </td></tr>

  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 16px;color:#37474f;font-size:15px;line-height:1.6;">
      Señor(a) <strong>${escapeHtml(p.solicitanteNombre)}</strong>:
    </p>
    <p style="margin:0 0 18px;color:#37474f;font-size:15px;line-height:1.6;">
      ${escapeHtml(hito.explicacion)}
    </p>

    <table width="100%" style="background:#F6F9F6;border-left:4px solid #14532D;border-radius:4px;margin-bottom:20px;">
    <tr><td style="padding:16px 20px;">
      <p style="margin:0 0 3px;color:#5A6B5D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Su radicado</p>
      <p style="margin:0;color:#14532D;font-size:15px;font-weight:800;font-family:monospace;word-break:break-word;">${escapeHtml(p.numeroExpediente)}</p>
    </td></tr>
    </table>
${
  hito.llamadoAAccion
    ? `
    <p style="margin:0 0 20px;padding:14px 18px;background:#FDF6E3;border-left:4px solid #D4A017;color:#5A4A16;font-size:14px;font-weight:600;line-height:1.5;">
      ${escapeHtml(hito.llamadoAAccion)}
    </p>`
    : ''
}
    <p style="margin:0;">
      <a href="${escapeHtml(p.urlConsulta)}" style="background:#14532D;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:6px;display:inline-block;">Consultar el estado de mi solicitud</a>
    </p>
  </td></tr>

  <tr><td style="background:#F6F9F6;padding:18px 32px;">
    <p style="margin:0;color:#5A6B5D;font-size:11px;line-height:1.5;">
      Este correo es informativo y <strong>no constituye la notificación</strong> del acto
      administrativo, que se surte conforme a la Ley 1437 de 2011. No responda a este mensaje;
      para trámites diríjase a la Secretaría de Planeación con su número de radicado.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
