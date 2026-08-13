import { INSTITUCION } from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Notificación de respuesta al ciudadano
   Activado cuando el funcionario marca un radicado como RESUELTO.
══════════════════════════════════════════════════════════════ */

export interface TemplateRespuestaCiudadanoParams {
  radicadoId:        string;
  ciudadanoNombre:   string;
  asunto:            string;
  nota:              string;
  dependenciaNombre: string;
  dependenciaEmail:  string;
  fechaRespuesta:    string;   // ISO — se formatea internamente
  tieneArchivo:      boolean;
}

import { formatFechaLargaColombia } from '@/lib/fecha-colombia';

function formatearFecha(iso: string): string {
  return formatFechaLargaColombia(iso, { fallback: iso });
}

export function buildRespuestaCiudadanoHtml(
  p: TemplateRespuestaCiudadanoParams,
): string {
  const fecha = formatearFecha(p.fechaRespuesta);

  return /* html */`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Su solicitud ha sido respondida – ${INSTITUCION.nombre}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Encabezado institucional -->
          <tr>
            <td style="background:#1a237e;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">
                ${INSTITUCION.nombre} · ${INSTITUCION.departamento}
              </p>
              <p style="margin:6px 0 0;color:#c7d2fe;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">
                ${INSTITUCION.sistema}
              </p>
              <p style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3;">
                Su solicitud ha sido respondida
              </p>
            </td>
          </tr>

          <!-- Badge de estado -->
          <tr>
            <td style="background:#e8f5e9;padding:16px 32px;border-bottom:1px solid #c8e6c9;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#2e7d32;border-radius:20px;padding:6px 16px;">
                    <span style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;">✓ RESUELTO</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#1b5e20;font-size:12px;font-weight:600;">${fecha}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo principal -->
          <tr>
            <td style="padding:32px;">

              <p style="margin:0 0 20px;color:#37474f;font-size:15px;line-height:1.6;">
                Estimado/a <strong style="color:#1a237e;">${escapeHtml(p.ciudadanoNombre)}</strong>,
              </p>

              <p style="margin:0 0 24px;color:#37474f;font-size:15px;line-height:1.6;">
                Le informamos que su solicitud radicada en la <strong>${escapeHtml(p.dependenciaNombre)}</strong>
                de la ${INSTITUCION.nombre} ha sido atendida y marcada como resuelta.
              </p>

              <!-- Tarjeta del radicado -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border:1px solid #e3e8ff;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                      Número de radicado
                    </p>
                    <p style="margin:0 0 16px;color:#1a237e;font-size:18px;font-weight:800;font-family:monospace;">
                      ${escapeHtml(p.radicadoId)}
                    </p>
                    <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                      Asunto de la solicitud
                    </p>
                    <p style="margin:0;color:#37474f;font-size:14px;line-height:1.5;">
                      ${escapeHtml(p.asunto)}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Respuesta del funcionario -->
              <p style="margin:0 0 8px;color:#37474f;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
                Respuesta de la Alcaldía
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-left:3px solid #1a237e;border-radius:0 6px 6px 0;margin-bottom:${p.tieneArchivo ? '16px' : '24px'};">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;color:#455a64;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(p.nota)}</p>
                  </td>
                </tr>
              </table>

              ${p.tieneArchivo ? `
              <!-- Aviso de archivo adjunto -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#C24400;font-size:13px;line-height:1.5;">
                      <strong>📎 Oficio de respuesta disponible</strong><br/>
                      <span style="color:#bf360c;">Se adjuntó un oficio firmado a su expediente. Para descargarlo, comuníquese con la dependencia indicada a continuación o preséntese en las instalaciones de la Alcaldía.</span>
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin:0 0 6px;color:#37474f;font-size:14px;line-height:1.6;">
                Si tiene preguntas adicionales sobre su solicitud, puede comunicarse directamente con la dependencia que atendió su caso:
              </p>
            </td>
          </tr>

          <!-- Datos de la dependencia -->
          <tr>
            <td style="background:#f8f9fa;border-top:1px solid #e9ecef;padding:20px 32px;">
              <p style="margin:0 0 4px;color:#5A6B5D;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
                Dependencia que atendió su caso
              </p>
              <p style="margin:0 0 8px;color:#1a237e;font-size:15px;font-weight:700;">
                ${escapeHtml(p.dependenciaNombre)}
              </p>
              <p style="margin:0;color:#546e7a;font-size:13px;">
                📧 <a href="mailto:${escapeHtml(p.dependenciaEmail)}" style="color:#1a237e;text-decoration:none;">${escapeHtml(p.dependenciaEmail)}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#eceff1;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 4px;color:#5A6B5D;font-size:11px;">
                Este mensaje fue generado automáticamente por el sistema de
              </p>
              <p style="margin:0;color:#546e7a;font-size:12px;font-weight:600;">
                ${INSTITUCION.sistema} · ${INSTITUCION.nombre}, ${INSTITUCION.departamento}, ${INSTITUCION.pais}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildRespuestaCiudadanoSubject(radicadoId: string): string {
  return `Su solicitud ${radicadoId} ha sido respondida – ${INSTITUCION.nombre}`;
}
