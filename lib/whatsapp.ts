import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import type { EstadoRadicado, TenantId } from '@/src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   EMOJIS Y ETIQUETAS POR ESTADO
══════════════════════════════════════════════════════════════ */

const EMOJI_ESTADO: Record<EstadoRadicado, string> = {
  PENDIENTE:   '⏳',
  EN_REVISION: '🔍',
  EN_PROCESO:  '⚙️',
  RESUELTO:    '✅',
  DEVUELTO:    '↩️',
  RECHAZADO:   '❌',
};

const LABEL_ESTADO: Record<EstadoRadicado, string> = {
  PENDIENTE:   'PENDIENTE',
  EN_REVISION: 'EN REVISIÓN',
  EN_PROCESO:  'EN PROCESO',
  RESUELTO:    'RESUELTO',
  DEVUELTO:    'DEVUELTO',
  RECHAZADO:   'RECHAZADO',
};

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

export interface WhatsAppReportParams {
  radicadoId:           string;
  ciudadanoNombre:      string;
  ciudadanoTelefono:    string;
  tenantId:             TenantId;
  estadoNuevo:          EstadoRadicado;
  respuestaFuncionario: string;
  fechaRadicacion:      string;
}

export interface WhatsAppReport {
  telefono: string;   // Número con código de país: "573XXXXXXXXX"
  mensaje:  string;   // Texto formateado con markdown de WhatsApp
  linkWaMe: string;   // https://wa.me/57XXXXXXXXXX?text=...
}

/* ══════════════════════════════════════════════════════════════
   FUNCIONES AUXILIARES
══════════════════════════════════════════════════════════════ */

/**
 * Normaliza un número colombiano al formato wa.me (57 + 10 dígitos).
 * Acepta formatos: "3101234567", "57 310 123 4567", "+57310123...", etc.
 */
function normalizarTelefono(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '');
  if (soloDigitos.startsWith('57') && soloDigitos.length === 12) return soloDigitos;
  if (soloDigitos.length === 10 && soloDigitos.startsWith('3'))  return `57${soloDigitos}`;
  return `57${soloDigitos}`;
}

function formatearFecha(isoString: string): string {
  return new Date(isoString).toLocaleDateString('es-CO', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });
}

/* ══════════════════════════════════════════════════════════════
   FUNCIÓN PRINCIPAL
══════════════════════════════════════════════════════════════ */

/**
 * Genera el reporte de WhatsApp para notificar al ciudadano.
 *
 * Los datos de la dependencia se leen directamente de DIRECTORIO_TENANTS
 * (src/types/reglas-negocio.ts) — fuente única de verdad.
 *
 * IMPORTANTE: Esta función solo genera el mensaje y el link wa.me.
 * NO realiza fetch ni abre el link automáticamente.
 * La integración con la API de WhatsApp Business / n8n es una fase futura.
 */
export function generateWhatsAppReport(params: WhatsAppReportParams): WhatsAppReport {
  const {
    radicadoId,
    ciudadanoNombre,
    ciudadanoTelefono,
    tenantId,
    estadoNuevo,
    respuestaFuncionario,
    fechaRadicacion,
  } = params;

  const dep      = DIRECTORIO_TENANTS[tenantId];
  const telefono = normalizarTelefono(ciudadanoTelefono);
  const emoji    = EMOJI_ESTADO[estadoNuevo];
  const label    = LABEL_ESTADO[estadoNuevo];
  const fecha    = formatearFecha(fechaRadicacion);

  // Format celular for display: "3502956394" → "350 295 6394"
  const celularDisplay = dep.celularOficial.replace(
    /^(\d{3})(\d{3})(\d{4})$/,
    '$1 $2 $3'
  );

  const mensaje = [
    '🏛️ *ALCALDÍA DE SIMACOTA*',
    '_Ventanilla Única Digital_',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    `📋 *Radicado:* ${radicadoId}`,
    `📅 *Fecha de radicación:* ${fecha}`,
    '',
    `Estimado(a) *${ciudadanoNombre}*,`,
    '',
    'Le informamos que su solicitud ha sido actualizada:',
    '',
    `📌 *Estado actual:* ${emoji} ${label}`,
    `💬 *Respuesta:* ${respuestaFuncionario}`,
    '',
    `🏢 *Dependencia:* ${dep.nombreOficial}`,
    `📧 ${dep.emailOficial}`,
    `📱 ${celularDisplay}`,
    '',
    '━━━━━━━━━━━━━━━━━━━',
    '_Este mensaje fue generado automáticamente por el sistema de Ventanilla Única Digital de la Alcaldía de Simacota._',
    '_Para consultas adicionales, comuníquese con la dependencia indicada._',
  ].join('\n');

  const linkWaMe = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

  return { telefono, mensaje, linkWaMe };
}
