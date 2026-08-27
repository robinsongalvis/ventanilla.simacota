import { INSTITUCION } from '@/lib/institucion';
import { formatFechaLargaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Acuse de recibo de solicitud de licencia.

   POR QUÉ EXISTE, Y QUÉ SUSTITUYE. Hasta el 26-ago-2026 este momento —la
   apertura del expediente en el mostrador— disparaba una «Constancia de
   radicación en legal y debida forma» fechada el día en que se abrió la
   carpeta. Desde el ADR-0033 el expediente NACE en `PRESENTADA`: la
   radicación en legal y debida forma es un hito POSTERIOR, que ocurre
   cuando la documentación está completa y verificada. La constancia
   certificaba por escrito un hecho que no había ocurrido — y de ahí salen
   nulidades.

   El dictamen de gobierno-digital del 8-ago-2026 que ordenó aquella
   constancia partía de una premisa que el ADR-0033 derogó: que «la creación
   ES la marca expresa del funcionario de radicada en legal y debida forma».
   Ya no lo es. Este template reemplaza aquel, no lo complementa.

   QUÉ AFIRMA Y QUÉ NO:
   - AFIRMA: la Alcaldía recibió la solicitud, tiene estos documentos en su
     poder, y le faltan estos otros. Hechos verificables el mismo día.
   - NO AFIRMA: ninguna radicación, ninguna fecha con efecto de plazo,
     ningún término corriendo. Lo dice EXPRESAMENTE, no por omisión: el
     ciudadano tiene derecho a saber que el reloj todavía no arrancó, y a
     saber qué lo hace arrancar.
   - NO PROMETE UN AVISO QUE EL SISTEMA NO PUEDE ENVIAR. La primera versión
     decía «la Alcaldía se lo comunicará por este mismo medio»: no existe hoy
     ninguna plantilla ni ninguna ruta que envíe ese aviso cuando se declara la
     radicación en debida forma. Prometerlo repetía, en pequeño, el defecto que
     este archivo vino a corregir. El texto apunta a donde el ciudadano SÍ puede
     preguntar. Cuando el aviso exista, se cambia aquí.
   - NO enlaza la consulta pública. `/consulta` resuelve radicados de
     ventanilla, no expedientes de licencias: prometer un enlace que no
     encuentra su trámite sería el mismo defecto que este archivo corrige,
     con otro disfraz. Cuando la consulta cubra licencias, se añade aquí.
   - PROHIBIDO mencionar silencio administrativo positivo (se mantiene la
     condición del dictamen anterior, que sigue vigente en este punto).
══════════════════════════════════════════════════════════════ */

export interface TemplateAcuseReciboExpedienteParams {
  numeroExpediente: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  tipoDocumento: string;
  /** P. ej. "licencia de construcción — obra nueva". */
  descripcionTramite: string;
  /** ISO — día en que la Alcaldía recibió la solicitud (apertura del expediente). */
  fechaRecepcion: string;
  /** Nombres legibles de los documentos que el ciudadano YA entregó. */
  documentosEntregados: string[];
  /** Lo que falta. Vacío si la documentación está completa. */
  documentosFaltantes: { nombre: string; motivo: string }[];
  /** Cuántos requisitos aplican de verdad a este caso. */
  requisitosAplicables: number;
  /** Radicado de ventanilla asociado, si lo hay. */
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

export function buildAcuseReciboExpedienteSubject(numeroExpediente: string): string {
  return `Acuse de recibo de su solicitud · Expediente ${numeroExpediente} · Alcaldía Municipal de Simacota`;
}

function filaDato(etiqueta: string, valor: string): string {
  return `
                <tr>
                  <td style="padding:4px 0;color:#667085;">${escapeHtml(etiqueta)}</td>
                  <td style="padding:4px 0;">${escapeHtml(valor)}</td>
                </tr>`;
}

function listaDocumentos(items: string[]): string {
  return items
    .map(
      (n) => `
                      <li style="margin:0 0 4px 0;">${escapeHtml(n)}</li>`,
    )
    .join('');
}

export function buildAcuseReciboExpedienteHtml(p: TemplateAcuseReciboExpedienteParams): string {
  const fechaFmt = formatFechaLargaColombia(p.fechaRecepcion);
  const completa = p.documentosFaltantes.length === 0;
  const entregados = p.documentosEntregados.length;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(buildAcuseReciboExpedienteSubject(p.numeroExpediente))}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <tr><td style="background:#14532D;padding:24px;">
    <p style="margin:0;color:#FDF6E3;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">
      ALCALDÍA MUNICIPAL DE SIMACOTA · SECRETARÍA DE PLANEACIÓN
    </p>
    <p style="margin:8px 0 0 0;color:#ffffff;font-size:21px;font-weight:bold;">Acuse de recibo de su solicitud</p>
  </td></tr>

  <tr><td style="padding:22px 24px 8px 24px;">
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#1F2933;">
      Señor(a) <strong>${escapeHtml(p.solicitanteNombre)}</strong>:
    </p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#1F2933;">
      La Alcaldía Municipal de Simacota <strong>recibió su solicitud</strong> de
      ${escapeHtml(p.descripcionTramite)} y abrió el expediente
      <strong>${escapeHtml(p.numeroExpediente)}</strong>. ${
        entregados > 0
          ? 'Este mensaje deja constancia de qué documentos quedaron en poder de la administración y cuáles faltan.'
          : 'Este mensaje le indica qué documentos debe entregar para que su solicitud quede completa.'
      }
    </p>
  </td></tr>

  <tr><td style="padding:12px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#1F2933;">
      ${filaDato('Expediente:', p.numeroExpediente)}
      ${filaDato('Solicitante:', `${p.solicitanteNombre} — ${p.tipoDocumento} ${p.solicitanteDocumento}`)}
      ${filaDato('Trámite:', p.descripcionTramite)}
      ${filaDato('Fecha de recepción:', fechaFmt)}
      ${p.radicadoVentanillaId ? filaDato('Radicado de ventanilla asociado:', p.radicadoVentanillaId) : ''}
    </table>
  </td></tr>

  ${
    entregados > 0
      ? `<tr><td style="padding:12px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF7;border:1px solid #D9E2D9;border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 8px 0;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#5A6B5D;">
          Documentos recibidos (${entregados} de ${p.requisitosAplicables})
        </p>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.55;color:#1F2933;">${listaDocumentos(p.documentosEntregados)}
        </ul>
      </td></tr>
    </table>
  </td></tr>`
      : ''
  }

  ${
    completa
      ? `<tr><td style="padding:12px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF7;border:1px solid #D9E2D9;border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#1F2933;">
          <strong>Según nuestro registro, usted entregó todos los documentos que su trámite exige.</strong>
          La Secretaría de Planeación los verificará y, cuando declare la radicación en legal y
          debida forma, quedará fijada la fecha desde la cual corre el plazo legal. Puede consultarla
          en la Secretaría indicando el número de expediente.
        </p>
      </td></tr>
    </table>
  </td></tr>`
      : `<tr><td style="padding:12px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6E3;border:1px solid #E8D9A8;border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 8px 0;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#7A5D0A;">
          Documentos pendientes (${p.documentosFaltantes.length})
        </p>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.55;color:#1F2933;">${listaDocumentos(
          p.documentosFaltantes.map((f) => f.nombre),
        )}
        </ul>
        <p style="margin:10px 0 0 0;font-size:13px;line-height:1.5;color:#1F2933;">
          Puede entregarlos en la Secretaría de Planeación indicando el número de expediente.
        </p>
      </td></tr>
    </table>
  </td></tr>`
  }

  <!-- EL BLOQUE QUE NO PUEDE FALTAR: el plazo todavía no corre, y por qué. -->
  <tr><td style="padding:12px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid #14532D;border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 6px 0;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#14532D;">
          El plazo legal aún no ha empezado a correr
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#1F2933;">
          Este mensaje <strong>no es una constancia de radicación en legal y debida forma</strong> y
          no acredita que su solicitud esté radicada. El plazo con que cuenta la administración para
          pronunciarse empieza a contarse desde que la solicitud queda
          <strong>radicada en legal y debida forma</strong>, lo que ocurre cuando la documentación
          está completa y así lo verifica la Secretaría de Planeación
          ${completa ? '' : '— es decir, cuando usted entregue los documentos pendientes '}(artículo
          2.2.6.1.2.1.1, parágrafo 1, del Decreto 1077 de 2015). Puede verificar en cualquier momento
          en la Secretaría de Planeación si su solicitud ya quedó radicada y desde qué fecha corre el
          plazo.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:12px 24px 20px 24px;">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#667085;">
      Para cualquier consulta sobre este expediente puede comunicarse con la Secretaría de
      Planeación o acercarse a la ventanilla única indicando el número
      <strong>${escapeHtml(p.numeroExpediente)}</strong>.
    </p>
  </td></tr>

  <tr><td style="background:#F8FAF7;padding:16px 24px;border-top:1px solid #E3E8E3;">
    <p style="margin:0;font-size:11px;line-height:1.5;color:#667085;">
      ${escapeHtml(INSTITUCION.nombre)} · ${escapeHtml(INSTITUCION.municipio)}, ${escapeHtml(INSTITUCION.departamento)}<br />
      Mensaje generado automáticamente. No responda a este correo.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
