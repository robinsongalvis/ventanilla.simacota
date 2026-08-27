/**
 * lib/email/templates/vigilancia-termino-licencias.ts
 *
 * Los dos correos del vigía del término de licencias. PUROS: reciben datos y
 * devuelven texto. No leen Firestore, no envían nada, no conocen destinatario.
 *
 * ── POR QUÉ SON DOS Y NO UNO ──────────────────────────────────────────────
 *
 * 1. NOVEDADES — solo cuando algo CAMBIÓ. El cron de vencimientos de PQRSD
 *    reenvía su alerta en cada corrida mientras el radicado siga en el umbral:
 *    un correo diario con los mismos seis vencidos se filtra en una semana, y
 *    entonces la alarma deja de funcionar justo cuando hace falta.
 *
 * 2. RESUMEN SEMANAL — un día fijo, el lunes, con la foto completa. Sale
 *    SIEMPRE, incluso cuando no hay nada que vigilar, porque el propietario lo
 *    pidió así: que Planeación aprenda a esperarlo, para que su AUSENCIA
 *    también informe. Un correo que solo llega cuando hay malas noticias no
 *    distingue «todo en orden» de «el sistema se cayó».
 */
import type { NivelVigilancia, ResumenCorrida, Transicion } from '@/lib/server/vigilancia-termino';

export interface NovedadesParams {
  /** Entradas y agravamientos: lo que empeoró. */
  entraron: Transicion[];
  agravaron: Transicion[];
  fechaCorridaIso: string;
  enlaceBandeja: string;
}

export interface ResumenSemanalParams {
  resumen: ResumenCorrida;
  enlaceBandeja: string;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Cómo se llama cada nivel de cara a una persona.
 *
 * `ESPERA_EXCESIVA` se nombra por lo que HAY QUE HACER, no por su código: es la
 * única categoría que Planeación resuelve el mismo día, y el correo tiene que
 * dejar claro que la acción está en su mano.
 */
const ETIQUETA: Record<NivelVigilancia, string> = {
  VENCIDO: 'Término vencido',
  CRITICO: 'Vence en 5 días hábiles o menos',
  AVISO: 'Vence en 15 días hábiles o menos',
  ESPERA_EXCESIVA: 'Presentada hace demasiado y todavía sin radicar',
};

const COLOR: Record<NivelVigilancia, string> = {
  VENCIDO: '#B42318',
  CRITICO: '#B54708',
  AVISO: '#5A4A16',
  ESPERA_EXCESIVA: '#5A4A16',
};

function fechaLegible(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'long',
      timeZone: 'America/Bogota',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function cascaron(titulo: string, cinta: string, cuerpo: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:#14532D;padding:24px 32px;text-align:left;">
    <p style="margin:0;color:#FDF6E3;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">ALCALDÍA DE SIMACOTA · SECRETARÍA DE PLANEACIÓN</p>
    <p style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">${escapeHtml(titulo)}</p>
  </td></tr>
  <tr><td style="background:#FDF6E3;padding:14px 32px;">
    <span style="color:#5A4A16;font-size:12px;font-weight:600;">${cinta}</span>
  </td></tr>
  <tr><td style="padding:28px 32px;background:#ffffff;">${cuerpo}</td></tr>
  <tr><td style="background:#F6F9F6;padding:18px 32px;">
    <p style="margin:0;color:#5A6B5D;font-size:11px;line-height:1.5;">
      Mensaje automático de la Ventanilla Única Digital. El plazo de 45 días hábiles
      corre desde la radicación en legal y debida forma (Decreto 1077 de 2015).
      No responda a este correo.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function filaExpediente(t: Transicion): string {
  const nivel = t.actual;
  const etiqueta = nivel ? ETIQUETA[nivel] : 'Sin nivel';
  const color = nivel ? COLOR[nivel] : '#37474f';
  /* Un expediente sin número todavía se identifica por su id: omitirlo lo
     dejaría fuera del correo justo por ser el caso incompleto. */
  const identificador = t.numeroExpediente ?? `(sin número aún · ${t.expedienteId})`;
  const desde = t.anterior ? ` <span style="color:#5A6B5D;">— antes: ${escapeHtml(ETIQUETA[t.anterior])}</span>` : '';
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #E4E7EC;">
    <p style="margin:0 0 2px;color:#14532D;font-size:14px;font-weight:800;font-family:monospace;word-break:break-word;">${escapeHtml(identificador)}</p>
    <p style="margin:0;color:${color};font-size:13px;font-weight:600;">${escapeHtml(etiqueta)}${desde}</p>
  </td></tr>`;
}

export function buildNovedadesVigilanciaSubject(entraron: number, agravaron: number): string {
  const total = entraron + agravaron;
  return `[Licencias] ${total} expediente${total === 1 ? '' : 's'} requiere${total === 1 ? '' : 'n'} atención`;
}

export function buildNovedadesVigilanciaHtml(p: NovedadesParams): string {
  const filas = [...p.agravaron, ...p.entraron].map(filaExpediente).join('');
  const cuerpo = `
    <p style="margin:0 0 16px;color:#37474f;font-size:15px;line-height:1.6;">
      Estos expedientes <strong>cambiaron de situación</strong> desde la última revisión.
      Solo se avisa de lo que cambió: la relación completa llega los lunes.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">${filas}</table>
    <p style="margin:0;">
      <a href="${escapeHtml(p.enlaceBandeja)}" style="background:#14532D;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:6px;display:inline-block;">Abrir la bandeja de licencias</a>
    </p>`;
  return cascaron(
    'Novedades del término',
    `Revisión del ${escapeHtml(fechaLegible(p.fechaCorridaIso))}`,
    cuerpo,
  );
}

export function buildResumenSemanalSubject(r: ResumenCorrida): string {
  if (r.conjuntoVacio) return '[Licencias] Resumen semanal — ningún expediente en vigilancia';
  const criticos = r.porNivel.VENCIDO + r.porNivel.CRITICO;
  return criticos > 0
    ? `[Licencias] Resumen semanal — ${criticos} requiere${criticos === 1 ? '' : 'n'} atención inmediata`
    : '[Licencias] Resumen semanal — sin vencimientos próximos';
}

export function buildResumenSemanalHtml(p: ResumenSemanalParams): string {
  const r = p.resumen;

  /* EL CONJUNTO VACÍO SE DICE, NO SE INSINÚA CON CEROS. Hoy es el caso normal:
     el vigía excluye los expedientes de demostración, y con el candado de
     emisión real cerrado todos lo son. Un correo con cuatro ceros dejaría a
     quien lo lee sin saber si el sistema miró o se rompió. */
  const cuerpo = r.conjuntoVacio
    ? `<p style="margin:0 0 16px;color:#37474f;font-size:15px;line-height:1.6;">
         La revisión semanal se ejecutó con normalidad y
         <strong>no hay ningún expediente bajo vigilancia de término</strong>.
       </p>
       <p style="margin:0 0 16px;color:#5A6B5D;font-size:14px;line-height:1.6;">
         Esto no indica una falla. Este correo llega todos los lunes: si algún
         lunes no llega, es que la revisión no se ejecutó, y eso sí hay que mirarlo.
       </p>`
    : `<p style="margin:0 0 16px;color:#37474f;font-size:15px;line-height:1.6;">
         Situación de los expedientes de licencia frente al término legal, a la
         fecha de esta revisión.
       </p>
       <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
         ${(['VENCIDO', 'CRITICO', 'ESPERA_EXCESIVA', 'AVISO'] as NivelVigilancia[])
           .map(
             (n) => `<tr>
               <td style="padding:9px 0;border-bottom:1px solid #E4E7EC;color:${COLOR[n]};font-size:14px;font-weight:600;">${escapeHtml(ETIQUETA[n])}</td>
               <td style="padding:9px 0;border-bottom:1px solid #E4E7EC;text-align:right;color:#1F2933;font-size:16px;font-weight:800;">${r.porNivel[n]}</td>
             </tr>`,
           )
           .join('')}
       </table>`;

  /* Que la revisión no pudiera mirarlo todo NO se omite del correo: presentar
     un mínimo como si fuera el total es la mentira que este vigía evita. */
  const advertencia = r.lecturaCompleta
    ? ''
    : `<p style="margin:0 0 16px;padding:12px 16px;background:#FEF3F2;border-left:4px solid #B42318;color:#B42318;font-size:13px;line-height:1.5;">
         <strong>La revisión no alcanzó a mirar todos los expedientes</strong> (tocó su techo de
         lectura). Las cifras de arriba son un mínimo, no un total.
       </p>`;

  const pie = `<p style="margin:0;">
      <a href="${escapeHtml(p.enlaceBandeja)}" style="background:#14532D;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:6px;display:inline-block;">Abrir la bandeja de licencias</a>
    </p>`;

  return cascaron(
    'Resumen semanal del término',
    `Revisión del ${escapeHtml(fechaLegible(r.corridaIso))} · ${r.revisados} expediente${r.revisados === 1 ? '' : 's'} revisado${r.revisados === 1 ? '' : 's'}`,
    cuerpo + advertencia + pie,
  );
}
