import { INSTITUCION } from '@/lib/institucion';
import { formatFechaLargaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Constancia de radicación en legal y debida forma — expediente
   de licencias (Bloque A·A5). Textos EXACTOS del dictamen de
   gobierno-digital (8-ago-2026, VINCULANTE) — este archivo transcribe ese
   dictamen, no lo redacta. Estructura visual: mismo patrón institucional
   de `constancia-radicacion.ts` (tabla, encabezado, bloque destacado, pie).

   Condiciones no negociables del dictamen:
   - Se emite SOLO en el acto de CREACIÓN del expediente — la creación ES
     la marca expresa del funcionario de "radicada en legal y debida
     forma" (Principio 9: la IA/el sistema no decide, el funcionario ya
     decidió al crear el expediente; este correo documenta esa decisión
     humana, no la sustituye). JAMÁS retroactiva ni reenviada — no existe
     ninguna función de reenvío en este módulo, a propósito.
   - `fechaRadicacionLegal` = fecha de CREACIÓN del expediente (día civil
     de Bogotá, `atLocalNoon`), NUNCA la fecha del radicado de ventanilla
     que pudo haberle dado origen (D2) — son eventos jurídicos distintos.
   - SIN fecha de vencimiento calculada (DF-7 sigue inerte, ⚖️ hueco 1):
     este template NO recibe ni imprime ningún campo de vencimiento.
   - PROHIBIDO mencionar silencio administrativo positivo.
══════════════════════════════════════════════════════════════ */

export interface TemplateConstanciaExpedienteParams {
  numeroExpedienteFUN: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  tipoDocumento: string;
  /** P. ej. "licencia de construcción — obra nueva". */
  descripcionTramite: string;
  /** ISO — fecha de CREACIÓN del expediente (día civil Bogotá). */
  fechaRadicacionLegal: string;
  /** Radicado de ventanilla del que se originó el expediente (D2), si existe. */
  radicadoVentanillaId?: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildConstanciaExpedienteSubject(numeroExpedienteFUN: string): string {
  return `Constancia de radicación en legal y debida forma · Expediente ${numeroExpedienteFUN} · Alcaldía Municipal de Simacota`;
}

export function buildConstanciaExpedienteHtml(p: TemplateConstanciaExpedienteParams): string {
  const fechaFmt = formatFechaLargaColombia(p.fechaRadicacionLegal);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(buildConstanciaExpedienteSubject(p.numeroExpedienteFUN))}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF7;font-family:Arial,Helvetica,sans-serif;color:#1F2933;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #D9E2D9;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="padding:20px 24px 8px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#1F2933;">
                CONSTANCIA DE RADICACIÓN EN LEGAL Y DEBIDA FORMA
              </p>
              <p style="margin:6px 0 0 0;font-size:12px;color:#667085;">
                Licencias urbanísticas y actuaciones conexas — Secretaría de Planeación
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0;font-size:14px;line-height:1.5;color:#1F2933;">
                Estimado(a) <strong>${escapeHtml(p.solicitanteNombre)}</strong>:
              </p>
              <p style="margin:8px 0 0 0;font-size:14px;line-height:1.6;color:#1F2933;">
                La Alcaldía Municipal de Simacota — Secretaría de Planeación le informa que su
                solicitud de ${escapeHtml(p.descripcionTramite)} quedó radicada en legal y debida
                forma el ${escapeHtml(fechaFmt)}, por haberse aportado la totalidad de los
                documentos exigidos, aun cuando estos puedan estar sujetos a posteriores
                correcciones (artículo 2.2.6.1.2.1.1, parágrafo 1, del Decreto 1077 de 2015).
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF4EE;border:1px solid #D9E2D9;border-radius:8px;">
                <tr>
                  <td style="padding:16px;text-align:center;">
                    <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#5A6B5D;">N.° DE EXPEDIENTE</p>
                    <p style="margin:6px 0 0 0;font-size:22px;font-weight:bold;letter-spacing:2px;color:#14532D;font-family:'Courier New',monospace;">
                      ${escapeHtml(p.numeroExpedienteFUN)}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 14px 16px;">
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#1F2933;text-align:center;">
                      Este número identifica su trámite de manera única y permanente: corresponde a
                      la solicitud, al acto administrativo que la resuelva y al expediente en el
                      archivo municipal (Formulario Único Nacional, Resolución 0463 de 2017 de
                      MinVivienda, numeral 0.2 de su guía).
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#5A6B5D;">
                Datos del solicitante
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#1F2933;">
                <tr>
                  <td width="160" style="padding:4px 0;color:#667085;">Nombre:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.solicitanteNombre)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#667085;">${escapeHtml(p.tipoDocumento)}:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.solicitanteDocumento)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#5A6B5D;">
                Datos del trámite
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#1F2933;">
                <tr>
                  <td width="160" style="padding:4px 0;color:#667085;">Trámite:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.descripcionTramite)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#667085;">Fecha de radicación:</td>
                  <td style="padding:4px 0;">${escapeHtml(fechaFmt)}</td>
                </tr>
                ${p.radicadoVentanillaId ? `
                <tr>
                  <td style="padding:4px 0;color:#667085;">Radicado de ventanilla asociado:</td>
                  <td style="padding:4px 0;">${escapeHtml(p.radicadoVentanillaId)}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF7;border:1px solid #D9E2D9;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#1F2933;">
                      A partir de la fecha de radicación en legal y debida forma, la administración
                      cuenta con cuarenta y cinco (45) días hábiles para pronunciarse sobre su
                      solicitud (artículo 2.2.6.1.2.3.1 del Decreto 1077 de 2015). Este término
                      podrá prorrogarse por una sola vez, hasta por la mitad del término inicial,
                      mediante decisión que le será comunicada (mismo artículo). Durante el trámite
                      pueden presentarse actuaciones previstas en la ley — como el acta de
                      observaciones y correcciones — que inciden en el cómputo de este término; de
                      producirse, le será informado oportunamente por este medio.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF7;border:1px solid #D9E2D9;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#5A6B5D;">
                      Consulta pública
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.4;color:#1F2933;">
                      Puede consultar el estado de su trámite en cualquier momento en:<br />
                      <a href="${escapeHtml(INSTITUCION.consultaUrl)}" style="color:#14532D;font-weight:bold;text-decoration:underline;">${escapeHtml(INSTITUCION.consultaUrl)}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px 20px 24px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#667085;">
                Esta constancia es el acuse institucional de la radicación de su solicitud;
                consérvela junto con el número de expediente. Este mensaje es informativo y no
                constituye notificación de acto administrativo. Sus datos personales se tratan
                conforme a la Ley 1581 de 2012, en ejercicio de las funciones públicas de la
                entidad; puede ejercer sus derechos de conocer, actualizar y rectificar sus datos
                escribiendo a ${escapeHtml(INSTITUCION.correo)}.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 24px;background:#F8FAF7;border-top:1px solid #D9E2D9;text-align:center;">
              <p style="margin:0;font-size:11px;color:#667085;">
                ${escapeHtml(INSTITUCION.nombre)} · Secretaría de Planeación
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
