import { formatFechaColombia, formatHoraColombia } from './fecha-colombia';

export const INSTITUCION = {
  nombre: 'Alcaldía Municipal de Simacota',
  sistema: 'Ventanilla Única Digital',
  contexto: 'Administración Municipal',
  descripcion: 'Sistema institucional para la radicación, gestión y seguimiento de solicitudes ciudadanas',
  municipio: 'Simacota',
  departamento: 'Santander',
  pais: 'Colombia',
  logo: '/brand/logo-alcaldia-simacota.png',
  consultaUrl: 'https://ventanilla-simacota.vercel.app/consulta',
  /** Sprint Ventanilla Operativa 2 — contacto institucional consumido
   *  por comprobantes impresos, correos oficiales y plantillas.
   *  Corrige un typo pre-existente (`simacota-boyaca` → `simacota-santander`).
   */
  telefono: 'PBX 7267100',
  correo: 'ventanilla@simacota-santander.gov.co',
} as const;

export const CANAL_RESPUESTA_LABEL: Record<string, string> = {
  CORREO: 'Correo electrónico',
  TELEFONO: 'Teléfono',
  PRESENCIAL: 'Presencial',
  DIRECCION_FISICA: 'Dirección física',
};

export const MEDIO_RECEPCION_LABEL: Record<string, string> = {
  WEB: 'Web',
  EMAIL: 'Correo electrónico',
  OFICIO: 'Oficio físico',
  OFICIO_FISICO: 'Oficio físico',
  PRESENCIAL: 'Presencial',
  FISICO_ESCANER: 'Ventanilla física',
};

export function labelCanalRespuesta(value?: string | null): string {
  if (!value) return 'No registrado';
  return CANAL_RESPUESTA_LABEL[value] ?? value;
}

export function labelMedioRecepcion(value?: string | null): string {
  if (!value) return 'No registrado';
  return MEDIO_RECEPCION_LABEL[value] ?? value;
}

/**
 * Sprint Fechas Colombia: estos formateadores institucionales delegan
 * al helper centralizado `lib/fecha-colombia.ts` para garantizar que
 * sello, comprobante y constancia muestren la fecha/hora en
 * `America/Bogota` independientemente del navegador o servidor.
 */
export function formatFechaInstitucional(value?: string | Date | null): string {
  return formatFechaColombia(value);
}

export function formatHoraInstitucional(value?: string | Date | null): string {
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value) && !value.includes('T')) {
    // Si ya viene formato "HH:MM" plano (registros antiguos), respétalo.
    return value;
  }
  return formatHoraColombia(value, { fallback: 'No registrada' });
}
