import { INSTITUCION } from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Confirmación de radicación al ciudadano
   Activado cuando el servidor genera exitosamente el radicado
   en POST /api/radicacion.
══════════════════════════════════════════════════════════════ */

export interface TemplateConfirmacionRadicacionParams {
  radicadoId:        string;
  ciudadanoNombre:   string;
  tipoSolicitud:     string;
  fechaRadicado:     string;   // ISO — se formatea internamente
  fechaVencimiento:  string;   // ISO — se formatea internamente
  canalRespuesta:    string;   // ej. "CORREO", "PRESENCIAL", etc.
  descripcionCorta:  string;   // primeros ~90 chars de la descripción
}

import { formatFechaColombia, formatFechaLargaColombia } from '@/lib/fecha-colombia';

function formatearFecha(iso: string): string {
  return formatFechaLargaColombia(iso);
}

function formatearFechaCorta(iso: string): string {
  return formatFechaColombia(iso);
}

const CANAL_LABEL: Record<string, string> = {
  CORREO:           'Correo electrónico',
  TELEFONO:         'Teléfono',
  PRESENCIAL:       'Presencial en la Alcaldía',
  DIRECCION_FISICA: 'Dirección física / correspondencia',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildConfirmacionRadicacionHtml(
  p: TemplateConfirmacionRadicacionParams,
): string {
  const fechaRadicadoFmt   = formatearFecha(p.fechaRadicado);
  const fechaVencimientoFmt = formatearFechaCorta(p.fechaVencimiento);
  const canalLabel          = CANAL_LABEL[p.canalRespuesta] ?? p.canalRespuesta;

  return /* html */`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Radicado ${escapeHtml(p.radicadoId)} confirmado – ${INSTITUCION.nombre}</title>
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
                Su solicitud fue radicada exitosamente
              </p>
            </td>
          </tr>

          <!-- Badge de estado -->
          <tr>
            <td style="background:#e8f5e9;padding:16px 32px;border-bottom:1px solid #c8e6c9;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#2e7d32;border-radius:20px;padding:6px 16px;">
                    <span style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;">✓ RADICADO</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#1b5e20;font-size:12px;font-weight:600;">${fechaRadicadoFmt}</span>
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
                Hemos recibido su solicitud en la <strong>${INSTITUCION.nombre}</strong>.
                Su radicado fue registrado oficialmente en el sistema de la Ventanilla Única Digital.
              </p>

              <!-- Tarjeta del radicado -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border:1px solid #e3e8ff;border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                      Número de radicado
                    </p>
                    <p style="margin:0 0 16px;color:#1a237e;font-size:20px;font-weight:800;font-family:monospace;">
                      ${escapeHtml(p.radicadoId)}
                    </p>
                    <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                      Tipo de solicitud
                    </p>
                    <p style="margin:0 0 16px;color:#37474f;font-size:14px;font-weight:600;">
                      ${escapeHtml(p.tipoSolicitud)}
                    </p>
                    <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                      Descripción
                    </p>
                    <p style="margin:0 0 16px;color:#546e7a;font-size:13px;line-height:1.5;">
                      ${escapeHtml(p.descripcionCorta)}
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:50%;padding-right:8px;">
                          <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Fecha de radicación</p>
                          <p style="margin:0;color:#37474f;font-size:13px;font-weight:600;">${formatearFechaCorta(p.fechaRadicado)}</p>
                        </td>
                        <td style="width:50%;padding-left:8px;">
                          <p style="margin:0 0 4px;color:#C24400;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Fecha límite de respuesta</p>
                          <p style="margin:0;color:#bf360c;font-size:13px;font-weight:700;">${fechaVencimientoFmt}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Canal de respuesta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#C24400;font-size:13px;line-height:1.5;">
                      <strong>📬 Canal de respuesta seleccionado:</strong><br/>
                      <span style="color:#bf360c;">${escapeHtml(canalLabel)}</span>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Enlace de consulta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${INSTITUCION.consultaUrl}?radicadoId=${encodeURIComponent(p.radicadoId)}"
                       style="display:inline-block;padding:12px 28px;background:#1a237e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.5px;">
                      Consultar estado de mi solicitud
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#5A6B5D;font-size:12px;line-height:1.6;text-align:center;">
                Guarde este número de radicado para hacer seguimiento a su solicitud.<br/>
                Si tiene preguntas, puede comunicarse con la Alcaldía Municipal de Simacota.
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

export function buildConfirmacionRadicacionSubject(radicadoId: string): string {
  return `Radicado ${radicadoId} confirmado – ${INSTITUCION.nombre}`;
}
