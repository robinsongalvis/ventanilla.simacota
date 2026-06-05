/**
 * Tipos del flujo de Firma y Aprobación Final — Sprint 5
 * Colección: simi_respuestas_firma
 */

export type EstadoFirma =
  | 'pendiente_firma'
  | 'firmado'
  | 'enviado_ciudadano'
  | 'notificado'
  | 'cerrado';

export type CanalEnvio = 'email' | 'fisico' | 'whatsapp' | 'portal' | 'otro';

export interface RespuestaFirma {
  id?:                    string;
  radicadoId:             string;
  borradorVersionId?:     string;
  aprobacionId:           string;
  aprobadoPor:            string;
  aprobadoPorRol:         string;
  firmadoPor?:            string;
  firmadoPorCargo?:       string;
  dependencia:            string;
  estado:                 EstadoFirma;
  textoRespuestaFinal?:   string;   // Versión exacta enviada al ciudadano
  hashDocumento?:         string;   // SHA-256 del texto final (trazabilidad)
  fechaFirma?:            string;
  fechaEnvio?:            string;
  canalEnvio?:            CanalEnvio;
  emailCiudadano?:        string;   // Solo si se notificó por email
  notificadoWhatsApp?:    boolean;
  tenantId:               string;
  createdAt?:             string;
  updatedAt?:             string;
}

export const ESTADO_FIRMA_LABELS: Record<EstadoFirma, string> = {
  pendiente_firma:    'Pendiente de firma',
  firmado:            'Firmado',
  enviado_ciudadano:  'Enviado al ciudadano',
  notificado:         'Ciudadano notificado',
  cerrado:            'Caso cerrado',
};
