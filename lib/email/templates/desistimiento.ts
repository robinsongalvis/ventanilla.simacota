import { INSTITUCION } from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Notificación del acto de desistimiento tácito (BM-B33)

   Contenido (validado por gobierno-digital para Ley 1755/2015 Art. 17): la
   solicitud se archiva por desistimiento tácito mediante acto motivado, y
   contra dicho acto procede el RECURSO DE REPOSICIÓN (CPACA). El `motivo`
   (acto motivado del funcionario) se ESCAPA como HTML.

   `fundamentoLegal` es PARÁMETRO (no hardcodeado): el desistimiento solo se
   confirma sobre una subsanación que, por el gate de
   `planRequerirSubsanacion` (lib/server/subsanacion.ts), ya nació bajo
   régimen Ley 1755 — pero el texto legal se mantiene como dato, coherente
   con la plantilla de requerimiento (`requerimiento-subsanacion.ts`).
   El texto del recurso de reposición (Ley 1437 Arts. 74/76, CPACA) es
   general y no depende del régimen: se mantiene fijo.
══════════════════════════════════════════════════════════════ */

export interface TemplateDesistimientoParams {
  radicadoId:      string;
  ciudadanoNombre: string;
  /** Motivación del acto (texto del funcionario). */
  motivo:          string;
  /** P. ej. 'Ley 1755 de 2015, artículo 17'. */
  fundamentoLegal: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildDesistimientoSubject(radicadoId: string): string {
  return `Archivo por desistimiento — Radicado ${radicadoId}`;
}

export function buildDesistimientoHtml(p: TemplateDesistimientoParams): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#37474f;">
    <p style="margin:0 0 14px;font-size:15px;">
      Estimado/a <strong>${escapeHtml(p.ciudadanoNombre)}</strong>, le informamos que su
      solicitud radicada con el número
      <strong style="color:#1a237e;">${escapeHtml(p.radicadoId)}</strong> ha sido
      <strong>archivada por desistimiento tácito</strong>, al no haberse aportado en el
      plazo legal la información requerida (${escapeHtml(p.fundamentoLegal)}).
    </p>
    <div style="background:#eceff1;border-left:4px solid #607d8b;padding:12px 14px;margin:0 0 16px;font-size:14px;">
      ${escapeHtml(p.motivo)}
    </div>
    <p style="margin:0 0 14px;font-size:14px;">
      Contra el presente acto administrativo procede el <strong>recurso de reposición</strong>,
      que podrá interponer dentro de los <strong>diez (10) días hábiles siguientes a la
      notificación</strong>, ante la misma dependencia que expidió el acto (Ley 1437 de 2011,
      artículos 74 y 76). Podrá presentar una nueva solicitud cuando cuente con la información
      completa.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#5A6B5D;">${escapeHtml(INSTITUCION.nombre)}</p>
  </div>`;
}
