/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Auditoría semanal de consecutivos legales (A1)

   Identidad institucional (verde #14532D + dorado #D4A017), mismo patrón
   de `lib/email/templates/alerta-vencimiento.ts` — plantilla pura,
   testeable de forma aislada, HTML de email con tablas + estilos inline
   (sin CSS externo ni flexbox, para compatibilidad con Gmail/Outlook).

   Contexto: AGN 060/2001 art. 5 exige UNICIDAD y CONTINUIDAD de las series
   de radicación. `app/api/cron/auditoria-consecutivos/route.ts` (cron
   semanal) barre las 3 series (radicados, salidas, planillas) del año en
   curso y, si encuentra huecos (consecutivo consumido sin documento) o
   duplicados (mismo consecutivo en dos documentos), envía este correo con
   el detalle exacto para que un funcionario lo revise — el sistema NUNCA
   corrige la serie por sí solo (Principio 9: la IA/automatización propone,
   el funcionario decide).
══════════════════════════════════════════════════════════════ */

export interface SerieHallazgoAuditoria {
  /** Nombre corto de la serie: 'radicados' | 'salidas' | 'planillas'. */
  serie:       string;
  coleccion:   string;
  ultimo:      number;
  documentos:  number;
  distintos:   number;
  huecos:      number[];
  duplicados:  number[];
}

export interface TemplateAuditoriaConsecutivosParams {
  anio:            number;
  timestamp:       string;
  series:          SerieHallazgoAuditoria[];
  totalHuecos:     number;
  totalDuplicados: number;
  /**
   * Contadores que se contradicen a sí mismos: declaran haberse abierto en un
   * número y están por debajo. Van APARTE de huecos y duplicados y ARRIBA de
   * ellos porque son de otra naturaleza — un hueco es un síntoma, un contador
   * movido hacia atrás es la causa, y mientras no se arregle sigue produciendo
   * síntomas nuevos cada semana.
   */
  contadoresIncoherentes?: string[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Asunto EXACTO acordado: `[AUDITORÍA] N hallazgo(s) en las series de radicación {año}`. */
export function buildAuditoriaConsecutivosSubject(totalHallazgos: number, anio: number): string {
  return `[AUDITORÍA] ${totalHallazgos} hallazgo(s) en las series de radicación ${anio}`;
}

function filaSerie(s: SerieHallazgoAuditoria): string {
  const tieneHallazgo = s.huecos.length > 0 || s.duplicados.length > 0;
  const colorEstado = tieneHallazgo ? '#B3261E' : '#14532D';
  const textoEstado = tieneHallazgo ? 'CON HALLAZGOS' : 'sin novedad';

  return `
    <tr><td style="padding:16px 22px;border-bottom:1px solid #E3E8E3;">
      <p style="margin:0 0 4px;color:#5A6B5D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
        Serie · ${escapeHtml(s.serie)}
      </p>
      <p style="margin:0 0 8px;color:${colorEstado};font-size:13px;font-weight:800;">${textoEstado}</p>
      <p style="margin:0 0 3px;color:#37474f;font-size:13px;">
        Colección: <code style="background:#F3F6F3;padding:1px 6px;border-radius:3px;">${escapeHtml(s.coleccion)}</code>
      </p>
      <p style="margin:0 0 3px;color:#37474f;font-size:13px;">Contador (último consecutivo confirmado): <strong>${s.ultimo}</strong></p>
      <p style="margin:0 0 3px;color:#37474f;font-size:13px;">Documentos del año leídos: <strong>${s.documentos}</strong> (${s.distintos} consecutivo(s) distinto(s))</p>
      <p style="margin:0 0 3px;color:#37474f;font-size:13px;">
        Huecos (consumidos sin documento): <strong>${s.huecos.length}</strong>${s.huecos.length ? ` — [${s.huecos.join(', ')}]` : ''}
      </p>
      <p style="margin:0;color:#37474f;font-size:13px;">
        Duplicados (mismo consecutivo en 2+ documentos): <strong>${s.duplicados.length}</strong>${s.duplicados.length ? ` — [${s.duplicados.join(', ')}]` : ''}
      </p>
    </td></tr>`;
}

export function buildAuditoriaConsecutivosHtml(p: TemplateAuditoriaConsecutivosParams): string {
  const incoherentes = p.contadoresIncoherentes ?? [];
  const totalHallazgos = p.totalHuecos + p.totalDuplicados + incoherentes.length;
  const fechaFmt = new Date(p.timestamp).toLocaleString('es-CO', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota',
  });

  return /* html */`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Cabecera -->
  <tr><td style="background:#14532D;padding:24px 32px;text-align:left;">
    <img src="https://ventanilla-simacota.vercel.app/brand/logo-alcaldia-simacota.png" alt="Alcaldía de Simacota" height="44" style="height:44px;display:block;margin:0 0 10px;border:0;outline:none;"/>
    <p style="margin:0;color:#FDF6E3;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">ALCALDÍA DE SIMACOTA · VENTANILLA ÚNICA DIGITAL</p>
    <p style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">Auditoría de consecutivos — ${p.anio}</p>
  </td></tr>

  <!-- Cinta de estado -->
  <tr><td style="background:#FDF6E3;padding:14px 32px;">
    <span style="background:#D4A017;color:#1F2933;font-size:11px;font-weight:700;letter-spacing:1px;padding:5px 14px;border-radius:20px;">
      ${totalHallazgos} HALLAZGO${totalHallazgos === 1 ? '' : 'S'}
    </span>
    <span style="color:#5A4A16;font-size:12px;font-weight:600;margin-left:10px;">Barrida: ${fechaFmt}</span>
  </td></tr>

  <!-- Cuerpo -->
  <tr><td style="padding:28px 32px;background:#ffffff;">
    <p style="margin:0 0 16px;color:#37474f;font-size:15px;line-height:1.6;">
      Estimado equipo de <strong style="color:#14532D;">Gestión Documental</strong>:
    </p>
    <p style="margin:0 0 20px;color:#37474f;font-size:15px;line-height:1.6;">
      La barrida semanal automática de continuidad y unicidad de las series de
      radicación (AGN 060 de 2001, artículo 5) encontró
      <strong>${p.totalHuecos} hueco(s)</strong>, <strong>${p.totalDuplicados} duplicado(s)</strong>${
        incoherentes.length ? ` y <strong>${incoherentes.length} contador(es) incoherente(s)</strong>` : ''
      }.
      Este correo es informativo: el sistema <strong>no corrige la serie por sí solo</strong>;
      un funcionario debe revisar el detalle y, si aplica, preparar la constancia de subsanación
      correspondiente.
    </p>

    ${incoherentes.length ? `
    <!-- Contadores incoherentes: primero, y en rojo. Es la causa. -->
    <table width="100%" style="background:#FDECEA;border-left:4px solid #B3261E;border-radius:4px;margin-bottom:22px;border-collapse:collapse;">
      <tr><td style="padding:16px 22px;">
        <p style="margin:0 0 6px;color:#B3261E;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">
          Atención inmediata · ${incoherentes.length} contador(es) incoherente(s)
        </p>
        <p style="margin:0 0 10px;color:#37474f;font-size:13px;line-height:1.6;">
          Un contador movido hacia atrás por fuera del sistema vuelve a proponer números ya
          entregados. La plataforma <strong>no emitirá</strong> mientras siga así — la radicación
          de esa serie está detenida hasta que alguien revise el contador.
        </p>
        ${incoherentes.map((m) => `<p style="margin:0 0 6px;color:#B3261E;font-size:13px;">${escapeHtml(m)}</p>`).join('')}
      </td></tr>
    </table>` : ''}

    <!-- Tarjeta de detalle por serie -->
    <table width="100%" style="background:#F6F9F6;border-left:4px solid #14532D;border-radius:4px;margin-bottom:22px;border-collapse:collapse;">
      ${p.series.map(filaSerie).join('')}
    </table>
  </td></tr>

  <!-- Pie institucional -->
  <tr><td style="background:#F3F6F3;padding:20px 32px;text-align:center;">
    <p style="margin:0 0 4px;color:#5A6B5D;font-size:12px;font-weight:600;">Alcaldía Municipal de Simacota, Santander · Ventanilla Única Digital</p>
    <p style="margin:0 0 4px;color:#5A6B5D;font-size:11px;">Mensaje automático del sistema — por favor no responda a este correo.</p>
    <p style="margin:0;color:#5A6B5D;font-size:11px;">Sus datos personales se tratan conforme a la Ley 1581 de 2012.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`.trim();
}
