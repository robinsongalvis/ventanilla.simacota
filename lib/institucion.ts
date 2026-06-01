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

export function formatFechaInstitucional(value?: string | Date | null): string {
  if (!value) return 'No registrada';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No registrada';
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatHoraInstitucional(value?: string | Date | null): string {
  if (!value) return 'No registrada';
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No registrada';
  return date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
