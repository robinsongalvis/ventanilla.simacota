import { INSTITUCION } from '@/lib/institucion';
import { formatFechaLargaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Requerimiento de subsanación al ciudadano (BM-B33)

   Ley 1755/2015 Art. 17. Contenido mínimo (validado por gobierno-digital):
   qué debe subsanar + plazo de 1 mes + derecho a prórroga + advertencia de
   desistimiento tácito. El texto del "motivo" lo redacta el funcionario (o
   SIMI como apoyo) y se ESCAPA como HTML.
══════════════════════════════════════════════════════════════ */

export interface TemplateRequerimientoParams {
  radicadoId:        string;
  ciudadanoNombre:   string;
  /** Qué debe aportar/aclarar el ciudadano (texto del funcionario). */
  motivo:            string;
  /** ISO — fecha límite para subsanar (1 mes desde hoy). */
  fechaLimite:       string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildRequerimientoSubject(radicadoId: string): string {
  return `Requerimiento de información — Radicado ${radicadoId}`;
}

export function buildRequerimientoHtml(p: TemplateRequerimientoParams): string {
  const limite = formatFechaLargaColombia(p.fechaLimite, { fallback: p.fechaLimite });
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#37474f;">
    <p style="margin:0 0 14px;font-size:15px;">
      Estimado/a <strong>${escapeHtml(p.ciudadanoNombre)}</strong>, en relación con su
      solicitud radicada con el número
      <strong style="color:#1a237e;">${escapeHtml(p.radicadoId)}</strong>, la administración
      requiere que <strong>complete o aclare</strong> lo siguiente:
    </p>
    <div style="background:#fff8e1;border-left:4px solid #f9a825;padding:12px 14px;margin:0 0 16px;font-size:14px;">
      ${escapeHtml(p.motivo)}
    </div>
    <p style="margin:0 0 12px;font-size:14px;">
      Cuenta con <strong>un (1) mes</strong>, hasta el <strong>${escapeHtml(limite)}</strong>,
      para aportar lo requerido. Puede <strong>solicitar una prórroga</strong> por un término
      igual, siempre que lo pida antes del vencimiento.
    </p>
    <p style="margin:0 0 14px;font-size:14px;color:#bf360c;">
      Si no aporta la información en el plazo señalado, se entenderá que ha
      <strong>desistido</strong> de su solicitud y esta será archivada mediante acto
      administrativo motivado (Ley 1755 de 2015, artículo 17).
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#90a4ae;">${escapeHtml(INSTITUCION.nombre)}</p>
  </div>`;
}
