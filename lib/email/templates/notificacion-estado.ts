import { INSTITUCION } from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Cambio de estado de un radicado al ciudadano
   Cubre eventos progresivos visibles al ciudadano:
     - ASIGNADO  → "Tu solicitud fue asignada a {dependencia}"
     - PRORROGA  → "Plazo extendido. Nueva fecha límite: {fecha}"
   El template es genérico y parametrizable. NO incluye eventos
   internos como EN_TRAMITE para no saturar la bandeja del ciudadano.
══════════════════════════════════════════════════════════════ */

export type EventoEstadoCiudadano = 'ASIGNADO' | 'PRORROGA';

export interface TemplateNotificacionEstadoParams {
  radicadoId:        string;
  ciudadanoNombre:   string;
  evento:            EventoEstadoCiudadano;
  /** Nombre de la dependencia destino — requerido cuando `evento === 'ASIGNADO'` */
  dependenciaNombre?: string;
  /** Email institucional de la dependencia — opcional, se muestra como contacto */
  dependenciaEmail?:  string;
  /** Nueva fecha de vencimiento ISO — requerido cuando `evento === 'PRORROGA'` */
  nuevaFechaLimite?:  string;
  /** Días aplicados a la prórroga — informativo */
  diasProrroga?:      number;
  /** Motivo de la prórroga capturado por el funcionario — opcional */
  motivo?:            string;
  /** ISO timestamp del momento del cambio de estado */
  fechaEvento:        string;
}

import { formatFechaLargaColombia } from '@/lib/fecha-colombia';

function formatearFechaLarga(iso: string): string {
  return formatFechaLargaColombia(iso, { fallback: iso });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface ConfigEvento {
  badgeLabel:   string;
  badgeBgColor: string;
  badgeFgColor: string;
  banderaBg:    string;
  banderaBorde: string;
  banderaTexto: string;
  titulo:       string;
  introHtml:    string;
  detalleHtml:  string;
}

function resolverConfigEvento(p: TemplateNotificacionEstadoParams): ConfigEvento {
  if (p.evento === 'ASIGNADO') {
    const dependencia = p.dependenciaNombre ?? 'una dependencia de la Alcaldía';
    return {
      badgeLabel:   '→ ASIGNADO',
      badgeBgColor: '#1565c0',
      badgeFgColor: '#ffffff',
      banderaBg:    '#e3f2fd',
      banderaBorde: '#90caf9',
      banderaTexto: '#0d47a1',
      titulo:       'Tu solicitud fue asignada',
      introHtml: `
        Tu solicitud fue asignada a <strong style="color:#1a237e;">${escapeHtml(dependencia)}</strong>
        para su trámite. Te informaremos por este mismo canal cuando exista una respuesta oficial.
      `,
      detalleHtml: `
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border:1px solid #e3e8ff;border-radius:8px;margin-bottom:24px;">
          <tr><td style="padding:18px 22px;">
            <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Dependencia responsable</p>
            <p style="margin:0 0 14px;color:#1a237e;font-size:15px;font-weight:700;">${escapeHtml(dependencia)}</p>
            ${p.dependenciaEmail ? `
              <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Contacto institucional</p>
              <p style="margin:0;color:#37474f;font-size:13px;">
                <a href="mailto:${escapeHtml(p.dependenciaEmail)}" style="color:#1a237e;text-decoration:none;">${escapeHtml(p.dependenciaEmail)}</a>
              </p>
            ` : ''}
          </td></tr>
        </table>
      `,
    };
  }

  // PRORROGA
  const nuevaFecha = p.nuevaFechaLimite ? formatearFechaLarga(p.nuevaFechaLimite) : 'una nueva fecha';
  const diasTexto = p.diasProrroga
    ? `<strong>${p.diasProrroga} día${p.diasProrroga === 1 ? '' : 's'} hábiles</strong>`
    : 'tiempo adicional';
  return {
    badgeLabel:   '⏳ PRÓRROGA',
    badgeBgColor: '#ef6c00',
    badgeFgColor: '#ffffff',
    banderaBg:    '#fff8e1',
    banderaBorde: '#ffe082',
    banderaTexto: '#bf360c',
    titulo:       'Se extendió el plazo de respuesta',
    introHtml: `
      La Alcaldía aplicó una prórroga al plazo de respuesta de tu solicitud, ampliando ${diasTexto} hábiles
      al término inicial. Esto está previsto por la ley para casos que requieren información adicional o
      consulta especializada.
    `,
    detalleHtml: `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;margin-bottom:24px;">
        <tr><td style="padding:18px 22px;">
          <p style="margin:0 0 4px;color:#e65100;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Nueva fecha límite de respuesta</p>
          <p style="margin:0 0 ${p.motivo ? '14' : '0'}px;color:#bf360c;font-size:16px;font-weight:800;">${escapeHtml(nuevaFecha)}</p>
          ${p.motivo ? `
            <p style="margin:0 0 4px;color:#e65100;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Motivo</p>
            <p style="margin:0;color:#37474f;font-size:13px;line-height:1.5;">${escapeHtml(p.motivo)}</p>
          ` : ''}
        </td></tr>
      </table>
    `,
  };
}

export function buildNotificacionEstadoHtml(
  p: TemplateNotificacionEstadoParams,
): string {
  const cfg = resolverConfigEvento(p);
  const fechaEventoFmt = formatearFechaLarga(p.fechaEvento);

  return /* html */`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(cfg.titulo)} – ${INSTITUCION.nombre}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:#1a237e;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">
                ${INSTITUCION.nombre} · ${INSTITUCION.departamento}
              </p>
              <p style="margin:6px 0 0;color:#c7d2fe;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">
                ${INSTITUCION.sistema}
              </p>
              <p style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3;">
                ${escapeHtml(cfg.titulo)}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:${cfg.banderaBg};padding:16px 32px;border-bottom:1px solid ${cfg.banderaBorde};">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${cfg.badgeBgColor};border-radius:20px;padding:6px 16px;">
                    <span style="color:${cfg.badgeFgColor};font-size:12px;font-weight:700;letter-spacing:1px;">${cfg.badgeLabel}</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:${cfg.banderaTexto};font-size:12px;font-weight:600;">${escapeHtml(fechaEventoFmt)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">

              <p style="margin:0 0 18px;color:#37474f;font-size:15px;line-height:1.6;">
                Estimado/a <strong style="color:#1a237e;">${escapeHtml(p.ciudadanoNombre)}</strong>,
              </p>

              <p style="margin:0 0 24px;color:#37474f;font-size:15px;line-height:1.6;">
                ${cfg.introHtml.trim()}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border:1px solid #e3e8ff;border-radius:8px;margin-bottom:20px;">
                <tr><td style="padding:18px 22px;">
                  <p style="margin:0 0 4px;color:#5c6bc0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Número de radicado</p>
                  <p style="margin:0;color:#1a237e;font-size:18px;font-weight:800;font-family:monospace;">${escapeHtml(p.radicadoId)}</p>
                </td></tr>
              </table>

              ${cfg.detalleHtml.trim()}

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

              <p style="margin:0;color:#78909c;font-size:12px;line-height:1.6;text-align:center;">
                Este mensaje es una notificación informativa del estado de tu solicitud.<br/>
                Para preguntas, comunícate con la ${INSTITUCION.nombre}.
              </p>

            </td>
          </tr>

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

export function buildNotificacionEstadoSubject(
  radicadoId: string,
  evento: EventoEstadoCiudadano,
): string {
  if (evento === 'ASIGNADO') {
    return `Tu radicado ${radicadoId} fue asignado – ${INSTITUCION.nombre}`;
  }
  return `Plazo extendido para tu radicado ${radicadoId} – ${INSTITUCION.nombre}`;
}
