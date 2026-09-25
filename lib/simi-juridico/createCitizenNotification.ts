/**
 * createCitizenNotification — Notificación al ciudadano cuando su caso es respondido.
 * Email con template institucional. Sin información interna.
 */

import { enviarEmail } from '@/lib/email/mailer';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ventanilla.simacota.gov.co';

export interface CitizenNotifParams {
  emailCiudadano:   string;
  nombreCiudadano?: string;
  radicadoId:       string;
  asunto:           string;
  fechaRespuesta:   string;
  dependencia:      string;
  /** Mensaje institucional claro — sin análisis internos */
  mensajePublico:   string;
  canalConsulta?:   string;
}

export async function notificarCiudadanoRespuesta(
  params: CitizenNotifParams,
): Promise<void> {
  const saludo = params.nombreCiudadano
    ? `Estimado(a) <strong>${params.nombreCiudadano}</strong>`
    : 'Estimado(a) peticionario(a)';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAF7;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #D9E2D9;overflow:hidden;">

    <!-- Encabezado institucional -->
    <div style="background:#14532D;padding:20px 24px;">
      <p style="margin:0;color:#F5E8B7;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
        Alcaldía Municipal de Simacota — Santander
      </p>
      <p style="margin:4px 0 0;color:#fff;font-size:15px;font-weight:800;">
        Su solicitud fue respondida
      </p>
    </div>

    <!-- Cuerpo -->
    <div style="padding:28px 24px;">
      <p style="font-size:14px;color:#1F2933;margin:0 0 16px;">
        ${saludo},
      </p>
      <p style="font-size:13px;color:#667085;margin:0 0 20px;">
        Le informamos que su solicitud radicada ante la Alcaldía Municipal de Simacota
        ha recibido respuesta oficial.
      </p>

      <!-- Datos del radicado -->
      <div style="background:#EEF4EE;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#667085;padding-right:16px;white-space:nowrap;">N.° Radicado:</td>
            <td style="padding:4px 0;font-size:12px;color:#14532D;font-weight:700;">${params.radicadoId}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#667085;padding-right:16px;">Asunto:</td>
            <td style="padding:4px 0;font-size:12px;color:#1F2933;font-weight:600;">${params.asunto}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#667085;padding-right:16px;">Dependencia:</td>
            <td style="padding:4px 0;font-size:12px;color:#1F2933;">${params.dependencia}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#667085;padding-right:16px;">Fecha respuesta:</td>
            <td style="padding:4px 0;font-size:12px;color:#1F2933;">${params.fechaRespuesta}</td>
          </tr>
        </table>
      </div>

      <!-- Mensaje público -->
      <div style="border-left:3px solid #14532D;padding-left:16px;margin-bottom:20px;">
        <p style="font-size:13px;color:#1F2933;margin:0;line-height:1.6;">
          ${params.mensajePublico}
        </p>
      </div>

      <!-- Consulta en portal -->
      <p style="font-size:12px;color:#667085;margin:0 0 16px;">
        Puede consultar el estado completo de su solicitud en nuestro portal ciudadano:
      </p>
      <a href="${BASE_URL}/consulta"
         style="display:inline-block;padding:10px 20px;background:#14532D;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">
        Consultar mi radicado
      </a>

      ${params.canalConsulta ? `
      <p style="font-size:12px;color:#667085;margin:16px 0 0;">
        Canal de respuesta: <strong>${params.canalConsulta}</strong>
      </p>` : ''}
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;background:#F8FAF7;border-top:1px solid #D9E2D9;">
      <p style="margin:0;font-size:10px;color:#94A3B8;line-height:1.6;">
        Este mensaje es de carácter oficial y fue generado automáticamente por la
        Ventanilla Única Digital de la Alcaldía Municipal de Simacota.
        Si tiene dudas sobre su solicitud, comuníquese al PBX: 7267100 o visite
        la Alcaldía de Simacota en horario de atención al ciudadano.
        <br><br>
        Para consultar el estado de su radicado: <a href="${BASE_URL}/consulta" style="color:#14532D;">${BASE_URL}/consulta</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();

  await enviarEmail({
    to:      params.emailCiudadano,
    subject: `[Respuesta oficial] Radicado ${params.radicadoId} — Alcaldía de Simacota`,
    html,
  });
}
