import { INSTITUCION } from '@/lib/institucion';
import { formatFechaColombia, formatFechaLargaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Constancia de radicación (envío manual desde Ventanilla)

   Sprint Ventanilla Operativa 2 — la funcionaria envía este correo
   como acuse de recibo institucional cuando el solicitante aportó
   correo válido y no marcó `noAportaCorreo`.

   Diferencia con `confirmacion-radicacion.ts`: aquel es automático
   tras radicación desde el portal ciudadano. Este es manual,
   controlado por la funcionaria desde la constancia impresa en
   pantalla, con formato de acuse de recibo más detallado.
══════════════════════════════════════════════════════════════ */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ventanilla.simacota.gov.co';

export interface TemplateConstanciaParams {
  radicadoId:          string;
  solicitanteNombre:   string;
  tipoDocumento:       string;
  numeroDocumento:     string;
  correoSolicitante:   string;
  telefonoSolicitante?: string | null;
  asunto:              string;
  tipoTramite:         string;
  fechaRadicado:       string;   // ISO
  fechaVencimiento:    string;   // ISO
  medioRecepcion:      string;
  canalRespuesta?:     string | null;
  dependenciaNombre:   string;
  funcionarioNombre:   string;
  numeroFolios?:       number;
}

const CANAL_RESPUESTA_LABEL: Record<string, string> = {
  CORREO:           'Correo electrónico',
  TELEFONO:         'Teléfono',
  PRESENCIAL:       'Presencial',
  DIRECCION_FISICA: 'Dirección física',
};

const MEDIO_RECEPCION_LABEL: Record<string, string> = {
  PRESENCIAL:         'Presencial',
  VERBAL_PRESENCIAL:  'Verbal presencial',
  VERBAL_TELEFONICO:  'Verbal telefónica',
  EMAIL:              'Correo electrónico',
  WEB:                'Portal web',
  OFICIO_FISICO:      'Oficio físico',
  OFICIO:             'Oficio',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildConstanciaRadicacionSubject(radicadoId: string): string {
  return `Constancia de radicación · ${radicadoId} · ${INSTITUCION.nombre}`;
}

export function buildConstanciaRadicacionHtml(p: TemplateConstanciaParams): string {
  const fechaRadicadoFmt   = formatFechaLargaColombia(p.fechaRadicado);
  const fechaVencimientoFmt = formatFechaColombia(p.fechaVencimiento);
  const canalLabel  = p.canalRespuesta ? (CANAL_RESPUESTA_LABEL[p.canalRespuesta] ?? p.canalRespuesta) : null;
  const medioLabel  = MEDIO_RECEPCION_LABEL[p.medioRecepcion] ?? p.medioRecepcion;
  const logoUrl     = `${BASE_URL}${INSTITUCION.logo}`;
  const consultaUrl = INSTITUCION.consultaUrl;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(buildConstanciaRadicacionSubject(p.radicadoId))}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF7;font-family:Arial,Helvetica,sans-serif;color:#1F2933;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #D9E2D9;border-radius:12px;overflow:hidden;">

          <!-- Encabezado institucional -->
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #D9E2D9;background:#FFFFFF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="60" valign="middle">
                    <img src="${logoUrl}" alt="Escudo de la ${escapeHtml(INSTITUCION.nombre)}" width="50" height="50" style="display:block;border:0;" />
                  </td>
                  <td valign="middle" style="padding-left:12px;">
                    <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#14532D;">
                      ${escapeHtml(INSTITUCION.nombre)}
                    </p>
                    <p style="margin:2px 0 0 0;font-size:11px;color:#667085;">
                      ${escapeHtml(INSTITUCION.sistema)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Título -->
          <tr>
            <td style="padding:20px 24px 8px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#1F2933;">
                Constancia de Radicación
              </p>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:0 24px 12px 24px;">
              <p style="margin:0;font-size:14px;line-height:1.5;color:#1F2933;">
                Estimado(a) <strong>${escapeHtml(p.solicitanteNombre)}</strong>:
              </p>
              <p style="margin:8px 0 0 0;font-size:14px;line-height:1.5;color:#1F2933;">
                La ${escapeHtml(INSTITUCION.nombre)} confirma el recibo de su solicitud en la
                ${escapeHtml(INSTITUCION.sistema)} el ${escapeHtml(fechaRadicadoFmt)}.
              </p>
            </td>
          </tr>

          <!-- Número de radicado destacado -->
          <tr>
            <td style="padding:12px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF4EE;border:1px solid #D9E2D9;border-radius:8px;">
                <tr>
                  <td style="padding:16px;text-align:center;">
                    <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#5A6B5D;">N.° de Radicado</p>
                    <p style="margin:6px 0 0 0;font-size:22px;font-weight:bold;letter-spacing:2px;color:#14532D;font-family:'Courier New',monospace;">
                      ${escapeHtml(p.radicadoId)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Datos del solicitante -->
          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#5A6B5D;">
                Datos del solicitante
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#1F2933;">
                <tr>
                  <td width="140" style="padding:4px 0;color:#667085;">Nombre:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.solicitanteNombre)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#667085;">${escapeHtml(p.tipoDocumento)}:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.numeroDocumento)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#667085;">Correo:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.correoSolicitante)}</td>
                </tr>
                ${p.telefonoSolicitante ? `
                <tr>
                  <td style="padding:4px 0;color:#667085;">Teléfono:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.telefonoSolicitante)}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Datos del radicado -->
          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#5A6B5D;">
                Datos del radicado
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#1F2933;">
                <tr>
                  <td width="140" style="padding:4px 0;color:#667085;">Asunto:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.asunto)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#667085;">Tipo de trámite:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.tipoTramite)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#667085;">Medio de recepción:</td>
                  <td style="padding:4px 0;">${escapeHtml(medioLabel)}</td>
                </tr>
                ${canalLabel ? `
                <tr>
                  <td style="padding:4px 0;color:#667085;">Medio de respuesta:</td>
                  <td style="padding:4px 0;">${escapeHtml(canalLabel)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:4px 0;color:#667085;">Dependencia:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.dependenciaNombre)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#667085;">Fecha límite respuesta:</td>
                  <td style="padding:4px 0;"><strong>${escapeHtml(fechaVencimientoFmt)}</strong></td>
                </tr>
                ${typeof p.numeroFolios === 'number' ? `
                <tr>
                  <td style="padding:4px 0;color:#667085;">Folios:</td>
                  <td style="padding:4px 0;">${p.numeroFolios}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Consulta pública -->
          <tr>
            <td style="padding:12px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF7;border:1px solid #D9E2D9;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#5A6B5D;">
                      Consulta pública
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.4;color:#1F2933;">
                      Puede consultar el estado de su radicado en cualquier momento en:<br />
                      <a href="${escapeHtml(consultaUrl)}" style="color:#14532D;font-weight:bold;text-decoration:underline;">${escapeHtml(consultaUrl)}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Nota legal -->
          <tr>
            <td style="padding:12px 24px 20px 24px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#667085;">
                Este correo constituye acuse de recibo institucional. Conserve el número de radicado
                para el seguimiento de su solicitud.
              </p>
            </td>
          </tr>

          <!-- Pie institucional -->
          <tr>
            <td style="padding:16px 24px;background:#F8FAF7;border-top:1px solid #D9E2D9;text-align:center;">
              <p style="margin:0;font-size:11px;color:#667085;">
                Radicado por <strong>${escapeHtml(p.funcionarioNombre)}</strong> · Ventanilla Única
              </p>
              <p style="margin:6px 0 0 0;font-size:11px;color:#667085;">
                ${escapeHtml(INSTITUCION.telefono)} · <a href="mailto:${escapeHtml(INSTITUCION.correo)}" style="color:#14532D;text-decoration:none;">${escapeHtml(INSTITUCION.correo)}</a>
              </p>
              <p style="margin:6px 0 0 0;font-size:10px;color:#5A6B5D;">
                ${escapeHtml(INSTITUCION.municipio)}, ${escapeHtml(INSTITUCION.departamento)} · ${escapeHtml(INSTITUCION.pais)}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
