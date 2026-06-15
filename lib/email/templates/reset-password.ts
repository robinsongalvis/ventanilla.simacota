import { INSTITUCION } from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Reset de contraseña — Funcionario interno
   Activado desde POST /api/admin/usuarios/[uid] con
   accion: "reset-password".
   Diseño institucional idéntico al resto de plantillas.
══════════════════════════════════════════════════════════════ */

export interface TemplateResetPasswordParams {
  destinatarioNombre: string;
  resetLink:          string;
  solicitadoPor:      string;   // nombre del admin que solicitó el reset
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildResetPasswordHtml(
  p: TemplateResetPasswordParams,
): string {
  return /* html */`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restablecimiento de contraseña – ${INSTITUCION.nombre}</title>
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
                ${INSTITUCION.sistema} · Acceso de Funcionarios
              </p>
              <p style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3;">
                Restablecimiento de contraseña
              </p>
            </td>
          </tr>

          <!-- Aviso de seguridad -->
          <tr>
            <td style="background:#fff8e1;padding:14px 32px;border-bottom:1px solid #ffe082;">
              <p style="margin:0;color:#e65100;font-size:12px;font-weight:600;">
                🔒 Enlace de uso único — Expira en 1 hora
              </p>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:32px;">

              <p style="margin:0 0 20px;color:#37474f;font-size:15px;line-height:1.6;">
                Estimado/a <strong style="color:#1a237e;">${escapeHtml(p.destinatarioNombre)}</strong>,
              </p>

              <p style="margin:0 0 16px;color:#37474f;font-size:15px;line-height:1.6;">
                El administrador <strong>${escapeHtml(p.solicitadoPor)}</strong> ha solicitado el
                restablecimiento de su contraseña para el acceso al Panel Interno de la
                ${INSTITUCION.nombre}.
              </p>

              <p style="margin:0 0 24px;color:#37474f;font-size:15px;line-height:1.6;">
                Haga clic en el botón a continuación para crear una nueva contraseña:
              </p>

              <!-- Botón de reset -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(p.resetLink)}"
                       style="display:inline-block;padding:14px 32px;background:#1a237e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.5px;">
                      Crear nueva contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Advertencia de seguridad -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.6;">
                      <strong>⚠️ Si usted NO solicitó este restablecimiento:</strong><br/>
                      Ignore este correo y notifique inmediatamente al administrador del sistema.
                      Su cuenta permanece segura.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#78909c;font-size:12px;line-height:1.6;text-align:center;">
                Por razones de seguridad, este enlace es de uso único y expira en 1 hora.<br/>
                Nunca comparta este enlace con terceros.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#eceff1;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 4px;color:#90a4ae;font-size:11px;">
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

export function buildResetPasswordSubject(): string {
  return `Restablecimiento de contraseña – ${INSTITUCION.sistema}`;
}
