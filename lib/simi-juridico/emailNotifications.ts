/**
 * Notificaciones por email del módulo SIMI Jurídico.
 * Conecta simi_notificaciones con el mailer existente.
 *
 * Fallback silencioso: si el email falla, solo se loguea el error.
 * La operación principal nunca se bloquea por un email fallido.
 */

import { enviarEmail } from '@/lib/email/mailer';
import type { ApprovalStatus } from '@/src/types/simi-approval';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ventanilla.simacota.gov.co';
const FROM_NAME = 'Ventanilla Única — Alcaldía de Simacota';

/* ── Templates HTML minimalistas ──────────────────────────── */

function wrapLayout(titulo: string, cuerpo: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAF7;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #D9E2D9;overflow:hidden;">
    <div style="background:#14532D;padding:20px 24px;">
      <p style="margin:0;color:#F5E8B7;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
        Alcaldía Municipal de Simacota
      </p>
      <p style="margin:4px 0 0;color:#fff;font-size:15px;font-weight:800;">${titulo}</p>
    </div>
    <div style="padding:24px;">
      ${cuerpo}
    </div>
    <div style="padding:16px 24px;background:#F8FAF7;border-top:1px solid #D9E2D9;">
      <p style="margin:0;font-size:10px;color:#94A3B8;line-height:1.5;">
        Este mensaje fue generado automáticamente por SIMI Jurídico-Administrativo.
        No responda directamente a este correo. Para acceder al sistema ingrese a
        <a href="${BASE_URL}/interno/dashboard" style="color:#14532D;">${BASE_URL}</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 0;font-size:12px;color:#667085;white-space:nowrap;padding-right:16px;">${label}:</td>
    <td style="padding:4px 0;font-size:12px;color:#1F2933;font-weight:600;">${value}</td>
  </tr>`;
}

function pill(texto: string, color: string, bg: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${color};background:${bg};">${texto}</span>`;
}

function btnVerde(href: string, texto: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#14532D;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">${texto}</a>`;
}

/* ══════════════════════════════════════════════════════════════
   FUNCIONES DE ENVÍO
══════════════════════════════════════════════════════════════ */

/** Email cuando un borrador queda pendiente de revisión del jefe */
export async function emailPendienteJefe(params: {
  emailJefe:    string;
  nombreJefe:   string;
  radicadoId:   string;
  asunto:       string;
  dependencia:  string;
  nivelRiesgo:  string;
  fechaLimite?: string;
}): Promise<void> {
  try {
    const cuerpo = `
      <p style="font-size:14px;color:#1F2933;margin:0 0 16px;">
        Hola <strong>${params.nombreJefe}</strong>,
      </p>
      <p style="font-size:13px;color:#667085;margin:0 0 16px;">
        Un borrador de respuesta institucional requiere su revisión y aprobación antes de ser enviado al ciudadano.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${row('Radicado', params.radicadoId)}
        ${row('Asunto', params.asunto)}
        ${row('Dependencia', params.dependencia)}
        ${row('Riesgo', params.nivelRiesgo.toUpperCase())}
        ${params.fechaLimite ? row('Fecha límite legal', params.fechaLimite) : ''}
      </table>
      <p style="font-size:12px;color:#667085;margin:0 0 8px;">Acciones disponibles:</p>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:12px;color:#1F2933;">
        <li>Revisar y aprobar el borrador</li>
        <li>Devolver para ajustes con observaciones</li>
        <li>Escalar a asesor jurídico si el caso lo requiere</li>
      </ul>
      ${btnVerde(`${BASE_URL}/interno/dashboard`, 'Ir al panel de aprobaciones')}
      <p style="font-size:11px;color:#94A3B8;margin-top:16px;">
        ⚠️ Ningún borrador puede enviarse al ciudadano sin su aprobación registrada en el sistema.
      </p>
    `;
    await enviarEmail({
      to:      params.emailJefe,
      subject: `[Aprobación requerida] Radicado ${params.radicadoId} — ${params.dependencia}`,
      html:    wrapLayout('Borrador pendiente de revisión', cuerpo),
    });
  } catch (err) {
    console.error('[simi-email] Error enviando email a jefe:', err instanceof Error ? err.message : err);
  }
}

/** Email cuando el caso es escalado a jurídica */
export async function emailEscaladoJuridica(params: {
  emailJuridica: string;
  radicadoId:    string;
  asunto:        string;
  dependencia:   string;
  motivos:       string[];
  escaladoPor:   string;
}): Promise<void> {
  try {
    const motivosList = params.motivos.map((m) => `<li>${m}</li>`).join('');
    const cuerpo = `
      <p style="font-size:14px;color:#DC2626;font-weight:700;margin:0 0 12px;">
        🚨 Revisión jurídica obligatoria
      </p>
      <p style="font-size:13px;color:#667085;margin:0 0 16px;">
        El caso <strong>${params.radicadoId}</strong> ha sido escalado para revisión jurídica.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${row('Radicado', params.radicadoId)}
        ${row('Asunto', params.asunto)}
        ${row('Dependencia', params.dependencia)}
        ${row('Escalado por', params.escaladoPor)}
      </table>
      <p style="font-size:12px;color:#667085;margin:0 0 4px;">Motivos del escalamiento:</p>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:12px;color:#1F2933;">${motivosList}</ul>
      ${btnVerde(`${BASE_URL}/interno/dashboard`, 'Revisar el caso')}
    `;
    await enviarEmail({
      to:      params.emailJuridica,
      subject: `[Revisión Jurídica Obligatoria] Radicado ${params.radicadoId}`,
      html:    wrapLayout('Caso escalado a revisión jurídica', cuerpo),
    });
  } catch (err) {
    console.error('[simi-email] Error enviando email jurídica:', err instanceof Error ? err.message : err);
  }
}

/** Email cuando un borrador es devuelto para ajustes */
export async function emailBorradorDevuelto(params: {
  emailFuncionario: string;
  nombreFuncionario: string;
  radicadoId:       string;
  asunto:           string;
  motivoDevolucion: string;
  devueltoPor:      string;
}): Promise<void> {
  try {
    const cuerpo = `
      <p style="font-size:14px;color:#1F2933;margin:0 0 12px;">
        Hola <strong>${params.nombreFuncionario}</strong>,
      </p>
      <p style="font-size:13px;color:#667085;margin:0 0 16px;">
        El borrador del radicado <strong>${params.radicadoId}</strong> ha sido devuelto para ajustes.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${row('Radicado', params.radicadoId)}
        ${row('Asunto', params.asunto)}
        ${row('Devuelto por', params.devueltoPor)}
      </table>
      <div style="padding:12px;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;margin-bottom:16px;">
        <p style="margin:0;font-size:12px;color:#B45309;font-weight:600;">Motivo de la devolución:</p>
        <p style="margin:6px 0 0;font-size:12px;color:#1F2933;">${params.motivoDevolucion}</p>
      </div>
      ${btnVerde(`${BASE_URL}/interno/dashboard`, 'Ajustar el borrador')}
    `;
    await enviarEmail({
      to:      params.emailFuncionario,
      subject: `[Borrador devuelto] Radicado ${params.radicadoId} — Requiere ajustes`,
      html:    wrapLayout('Borrador devuelto para ajustes', cuerpo),
    });
  } catch (err) {
    console.error('[simi-email] Error enviando email devolución:', err instanceof Error ? err.message : err);
  }
}

/** Email cuando un borrador es aprobado */
export async function emailBorradorAprobado(params: {
  emailFuncionario: string;
  nombreFuncionario: string;
  radicadoId:       string;
  asunto:           string;
  aprobadoPor:      string;
  estadoFinal:      ApprovalStatus;
}): Promise<void> {
  try {
    const esListoEnvio = params.estadoFinal === 'listo_para_envio';
    const cuerpo = `
      <p style="font-size:14px;color:#1F2933;margin:0 0 12px;">
        Hola <strong>${params.nombreFuncionario}</strong>,
      </p>
      <p style="font-size:13px;color:#667085;margin:0 0 16px;">
        ${esListoEnvio
          ? `El borrador del radicado <strong>${params.radicadoId}</strong> ha sido <strong>aprobado y está listo para envío al ciudadano</strong>.`
          : `El borrador del radicado <strong>${params.radicadoId}</strong> ha sido aprobado.`}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${row('Radicado', params.radicadoId)}
        ${row('Asunto', params.asunto)}
        ${row('Aprobado por', params.aprobadoPor)}
        ${row('Estado', params.estadoFinal.replace(/_/g, ' '))}
      </table>
      ${esListoEnvio
        ? `<div style="padding:12px;background:#EEF4EE;border-radius:8px;border:1px solid #D9E2D9;margin-bottom:16px;">
            <p style="margin:0;font-size:12px;color:#14532D;font-weight:700;">✅ Listo para envío oficial</p>
            <p style="margin:6px 0 0;font-size:12px;color:#667085;">La respuesta puede ser enviada al ciudadano. Recuerde registrar el envío en el sistema.</p>
          </div>`
        : ''}
      ${btnVerde(`${BASE_URL}/interno/dashboard`, 'Ver en el dashboard')}
    `;
    await enviarEmail({
      to:      params.emailFuncionario,
      subject: `[${esListoEnvio ? '✅ Listo para envío' : '✓ Aprobado'}] Radicado ${params.radicadoId}`,
      html:    wrapLayout('Borrador aprobado', cuerpo),
    });
  } catch (err) {
    console.error('[simi-email] Error enviando email aprobación:', err instanceof Error ? err.message : err);
  }
}

/** Email de alerta de vencimiento próximo */
export async function emailVencimientoProximo(params: {
  emailFuncionario: string;
  nombreFuncionario: string;
  radicadoId:       string;
  asunto:           string;
  diasRestantes:    number;
  fechaVencimiento: string;
}): Promise<void> {
  try {
    const urgente = params.diasRestantes <= 1;
    const colorAlerta = urgente ? '#DC2626' : '#D97706';
    const bgAlerta = urgente ? '#FEF2F2' : '#FFFBEB';
    const borderAlerta = urgente ? '#FECACA' : '#FDE68A';

    const cuerpo = `
      <p style="font-size:14px;color:#1F2933;margin:0 0 12px;">
        Hola <strong>${params.nombreFuncionario}</strong>,
      </p>
      <div style="padding:12px;background:${bgAlerta};border-radius:8px;border:1px solid ${borderAlerta};margin-bottom:16px;">
        <p style="margin:0;font-size:13px;color:${colorAlerta};font-weight:700;">
          ${urgente ? '🔴 ¡VENCE HOY!' : '⚠️ Próximo a vencer'}
          — ${params.diasRestantes} día(s) hábil(es)
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${row('Radicado', params.radicadoId)}
        ${row('Asunto', params.asunto)}
        ${row('Fecha límite', params.fechaVencimiento)}
        ${row('Días restantes', `${params.diasRestantes} día(s) hábil(es)`)}
      </table>
      <p style="font-size:12px;color:#667085;margin:0 0 8px;">
        De conformidad con la Ley 1755 de 2015, el vencimiento del término legal puede generar
        responsabilidades disciplinarias. Por favor priorice este caso.
      </p>
      ${btnVerde(`${BASE_URL}/interno/dashboard`, 'Atender radicado')}
    `;
    await enviarEmail({
      to:      params.emailFuncionario,
      subject: `[${urgente ? '🔴 VENCE HOY' : '⚠️ Por vencer'}] Radicado ${params.radicadoId} — ${params.diasRestantes}d restante(s)`,
      html:    wrapLayout('Alerta de vencimiento', cuerpo),
    });
  } catch (err) {
    console.error('[simi-email] Error enviando email vencimiento:', err instanceof Error ? err.message : err);
  }
}
