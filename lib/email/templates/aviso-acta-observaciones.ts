import { INSTITUCION } from '@/lib/institucion';
import { formatFechaLargaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Aviso de acta de observaciones y correcciones — expediente
   de licencias (Bloque A·A5). Textos EXACTOS del dictamen de
   gobierno-digital (8-ago-2026, VINCULANTE) — este archivo transcribe ese
   dictamen, no lo redacta.

   `fechaLimiteRespuesta` (30 días hábiles desde la COMUNICACIÓN del acta,
   no su expedición) SOLO se imprime si el funcionario registró
   `fechaComunicacion` al registrar la actuación — condición explícita del
   dictamen ("el plazo corre desde la comunicación, no la expedición"). Se
   calcula en el CALLER (`lib/server/expedientes-licencias.ts`, reutiliza
   `sumarDiasHabiles`) y llega aquí YA resuelta — este template no hace
   aritmética de fechas, solo decide si la imprime (según que llegue o no).

   FÓRMULA NEUTRA del efecto del acta sobre el término, por DEFECTO — ⚖️
   hueco 1 del ADR-0029 sigue sin default (`lib/motor-expedientes/
   termino.ts`, política dual). `VARIANTE_B_SUSPENSION` es una constante
   PARAMETRIZADA (mismo patrón que `TextosLegalesSubsanacion`,
   `lib/catalogos/regimen-legal-subsanacion.ts`) que existe únicamente
   como DATO documentado — `buildAvisoActaHtml` NO tiene ningún parámetro
   para seleccionarla: conmutarla exige tocar código (este archivo) cuando
   exista el concepto ESCRITO de Jurídica, nunca un flag en runtime.
══════════════════════════════════════════════════════════════ */

export interface TemplateAvisoActaParams {
  numeroExpedienteFUN: string;
  solicitanteNombre: string;
  /** ISO — fecha límite de respuesta (30 días hábiles desde la comunicación), YA calculada por el caller. `undefined` si no se registró `fechaComunicacion`. */
  fechaLimiteRespuesta?: string;
}

/**
 * Texto alternativo del efecto del acta bajo la hipótesis de SUSPENSIÓN
 * (texto literal del art. 2.2.6.1.2.2.4, D.1783/2021 art. 19) —
 * BLOQUEADO: ningún código de este módulo lo consume. Se documenta aquí
 * para que, cuando el concepto escrito de Jurídica resuelva el hueco 1
 * (⚖️ ADR-0029), activarlo sea sustituir la llamada a la fórmula neutra
 * por este texto — un cambio de UNA línea en `buildAvisoActaHtml`, con
 * revisión cruzada, no una redacción nueva.
 */
export const VARIANTE_B_SUSPENSION =
  'Durante este plazo se suspende el término para la expedición de la licencia, el cual, salvo ' +
  'renuncia expresa de su parte al plazo restante, se reanudará el día hábil siguiente al ' +
  'vencimiento del plazo máximo con que usted cuenta (artículo 2.2.6.1.2.2.4 del Decreto 1077 de 2015).';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildAvisoActaSubject(numeroExpedienteFUN: string): string {
  return `Acta de observaciones y correcciones · Expediente ${numeroExpedienteFUN} · Alcaldía Municipal de Simacota`;
}

export function buildAvisoActaHtml(p: TemplateAvisoActaParams): string {
  const fechaLimiteFmt = p.fechaLimiteRespuesta ? formatFechaLargaColombia(p.fechaLimiteRespuesta) : null;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(buildAvisoActaSubject(p.numeroExpedienteFUN))}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF7;font-family:Arial,Helvetica,sans-serif;color:#1F2933;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #D9E2D9;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="padding:20px 24px 8px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#1F2933;">
                Acta de observaciones y correcciones
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0;font-size:14px;line-height:1.5;color:#1F2933;">
                Estimado(a) <strong>${escapeHtml(p.solicitanteNombre)}</strong>:
              </p>
              <p style="margin:8px 0 0 0;font-size:14px;line-height:1.6;color:#1F2933;">
                Le informamos que, dentro del trámite del expediente
                <strong>${escapeHtml(p.numeroExpedienteFUN)}</strong>, la Secretaría de Planeación
                expidió — por una sola vez, como lo prevé la ley — un acta de observaciones y
                correcciones (artículo 2.2.6.1.2.2.4 del Decreto 1077 de 2015, modificado por el
                artículo 19 del Decreto 1783 de 2021). El contenido completo del acta le es
                comunicado por los medios previstos en la ley; este mensaje es un aviso informativo
                del sistema y no reemplaza dicha comunicación ni constituye notificación.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E1;border:1px solid #F0D98C;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#1F2933;">
                      Usted cuenta con <strong>treinta (30) días hábiles</strong> para dar respuesta
                      a las observaciones, y puede solicitar una ampliación hasta por
                      <strong>quince (15) días hábiles</strong> adicionales (artículo 2.2.6.1.2.2.4
                      del Decreto 1077 de 2015).
                    </p>
                    ${fechaLimiteFmt ? `
                    <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;color:#1F2933;">
                      Según la comunicación del acta, su plazo vence el
                      <strong>${escapeHtml(fechaLimiteFmt)}</strong>.
                    </p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#B71C1C;">
                Si no da respuesta dentro del plazo, la solicitud se entenderá desistida y se
                ordenará su archivo mediante acto administrativo, contra el cual procede
                únicamente el recurso de reposición (artículo 2.2.6.1.2.2.4 del Decreto 1077 de
                2015; concordante con el artículo 2.2.6.1.2.3.4).
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#1F2933;">
                La expedición del acta afecta el cómputo del término para resolver su solicitud, en
                los términos del artículo 2.2.6.1.2.2.4 del Decreto 1077 de 2015: mientras esté en
                curso su plazo para responder, dicho término no continúa corriendo de manera
                ordinaria. Una vez definido el cómputo aplicable a su expediente, la información
                actualizada del trámite le será comunicada por este mismo medio.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px 20px 24px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#667085;">
                Este mensaje es informativo y no constituye notificación de acto administrativo. Sus
                datos personales se tratan conforme a la Ley 1581 de 2012, en ejercicio de las
                funciones públicas de la entidad; puede ejercer sus derechos de conocer, actualizar
                y rectificar sus datos escribiendo a ${escapeHtml(INSTITUCION.correo)}.
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
              <p style="margin:6px 0 0 0;font-size:10px;color:#94A3B8;">
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
