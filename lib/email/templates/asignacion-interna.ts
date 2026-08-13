import { INSTITUCION } from '@/lib/institucion';
import { formatFechaLargaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   TEMPLATE: Correo interno de "Asignación de solicitud" (BM-B17)

   Aviso a la dependencia asignada de que tiene un radicado nuevo para
   trabajar. Fuente oficial: M-GSC-8200-170-002 (Paso 16, correo
   "ASIGNACIÓN DE SOLICITUD").

   Es un HEADS-UP interno: NO incluye datos del solicitante (identidad
   reservada/anónimos protegidos por diseño); la dependencia abre el
   panel para trabajar el caso. Basta radicado, asunto, tipo y término.
══════════════════════════════════════════════════════════════ */

export interface TemplateAsignacionInternaParams {
  radicadoId:          string;
  /** Nombre oficial de la dependencia asignada. */
  dependenciaNombre:   string;
  /** Asunto del radicado (sin datos personales del solicitante). */
  asunto:              string;
  /** Nombre del tipo de solicitud. */
  tipoSolicitudNombre?: string;
  /** Fecha de vencimiento ISO — se muestra si existe (los "sin término" no la tienen). */
  fechaVencimiento?:   string | null;
  /** Quién realizó la asignación. */
  asignadoPor:         string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildAsignacionInternaSubject(radicadoId: string): string {
  return `Asignación de solicitud — ${radicadoId}`;
}

export function buildAsignacionInternaHtml(p: TemplateAsignacionInternaParams): string {
  const vencimiento = p.fechaVencimiento
    ? formatFechaLargaColombia(p.fechaVencimiento, { fallback: p.fechaVencimiento })
    : 'Sin término legal';
  const tipo = p.tipoSolicitudNombre ? escapeHtml(p.tipoSolicitudNombre) : 'No especificado';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#37474f;">
    <p style="margin:0 0 14px;font-size:15px;">
      <strong style="color:#1a237e;">${escapeHtml(p.dependenciaNombre)}</strong>: se le ha
      asignado una nueva solicitud para su gestión.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px;">
      <tr><td style="padding:6px 0;color:#5A6B5D;">Radicado</td>
          <td style="padding:6px 0;font-weight:700;color:#1a237e;">${escapeHtml(p.radicadoId)}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6B5D;">Asunto</td>
          <td style="padding:6px 0;">${escapeHtml(p.asunto)}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6B5D;">Tipo</td>
          <td style="padding:6px 0;">${tipo}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6B5D;">Vence</td>
          <td style="padding:6px 0;font-weight:700;">${escapeHtml(vencimiento)}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6B5D;">Asignado por</td>
          <td style="padding:6px 0;">${escapeHtml(p.asignadoPor)}</td></tr>
    </table>
    <p style="margin:0 0 6px;font-size:13px;color:#5A6B5D;">
      Ingrese al panel de la Ventanilla Única para atender la solicitud dentro del término.
    </p>
    <p style="margin:18px 0 0;font-size:12px;color:#5A6B5D;">${escapeHtml(INSTITUCION.nombre)}</p>
  </div>`;
}
