import { buildAlertaVencimientoHtml } from '@/lib/email/templates/alerta-vencimiento';
import { buildAsignacionInternaHtml } from '@/lib/email/templates/asignacion-interna';
import { buildAuditoriaConsecutivosHtml } from '@/lib/email/templates/auditoria-consecutivos';
import { buildAvisoActaHtml } from '@/lib/email/templates/aviso-acta-observaciones';
import { buildConfirmacionRadicacionHtml } from '@/lib/email/templates/confirmacion-radicacion';
import { buildAcuseReciboExpedienteHtml } from '@/lib/email/templates/acuse-recibo-expediente-licencia';
import { buildConstanciaRadicacionHtml } from '@/lib/email/templates/constancia-radicacion';
import { buildDesistimientoHtml } from '@/lib/email/templates/desistimiento';
import { buildNotificacionEstadoHtml } from '@/lib/email/templates/notificacion-estado';
import { buildRequerimientoHtml } from '@/lib/email/templates/requerimiento-subsanacion';
import { buildResetPasswordHtml } from '@/lib/email/templates/reset-password';
import { buildRespuestaCiudadanoHtml } from '@/lib/email/templates/respuesta-ciudadano';
import { TEXTOS_SUBSANACION_LEY_1755 } from '@/lib/catalogos/regimen-legal-subsanacion';


/**
 * Un correo RENDERIZABLE por variante. Vive aparte del test porque lo usan
 * tanto el barrido automático como los informes puntuales, y duplicarlo
 * dejaría dos verdades sobre qué correos existen.
 *
 * Cada rama que cambia colores va como entrada propia: las ramas esconden
 * fallos — el «¡VENCE HOY!» incumplía y estaba en la que nadie medía.
 */
const ISO = '2026-08-14T15:00:00.000Z';

/** Cada entrada es una VARIANTE renderizable — las ramas se prueban aparte. */
export const CORREOS: { nombre: string; html: () => string }[] = [
  {
    nombre: 'alerta-vencimiento · urgente (VENCE HOY)',
    html: () => buildAlertaVencimientoHtml({
      radicadoId: '1-110-202608-00000042', funcionarioNombre: 'Funcionaria de Planeación',
      asunto: 'Solicitud de licencia de construcción', ciudadanoNombre: 'María Fernanda López',
      dependenciaNombre: 'Secretaría de Planeación', diasRestantes: 1, fechaVencimiento: ISO,
      tipoSolicitud: 'Licencia urbanística', enlaceUrl: 'https://ejemplo.gov.co',
    }),
  },
  {
    nombre: 'alerta-vencimiento · varios días',
    html: () => buildAlertaVencimientoHtml({
      radicadoId: '1-110-202608-00000042', funcionarioNombre: 'Funcionaria de Planeación',
      asunto: 'Solicitud de licencia de construcción', ciudadanoNombre: 'María Fernanda López',
      dependenciaNombre: 'Secretaría de Planeación', diasRestantes: 3, fechaVencimiento: ISO,
      tipoSolicitud: 'Licencia urbanística', enlaceUrl: 'https://ejemplo.gov.co',
    }),
  },
  {
    nombre: 'asignacion-interna',
    html: () => buildAsignacionInternaHtml({
      radicadoId: '1-110-202608-00000042', dependenciaNombre: 'Secretaría de Planeación',
      asunto: 'Solicitud de licencia', tipoSolicitudNombre: 'Derecho de petición',
      fechaVencimiento: ISO, asignadoPor: 'Recepción',
    }),
  },
  {
    nombre: 'auditoria-consecutivos · con hallazgos',
    html: () => buildAuditoriaConsecutivosHtml({
      anio: 2026, timestamp: ISO, totalHuecos: 2, totalDuplicados: 1,
      series: [{ serie: 'radicados', coleccion: 'ventanilla_radicados', ultimo: 42, documentos: 40, distintos: 40, huecos: [7, 19], duplicados: [33] }],
    }),
  },
  {
    nombre: 'auditoria-consecutivos · sin novedad',
    html: () => buildAuditoriaConsecutivosHtml({
      anio: 2026, timestamp: ISO, totalHuecos: 0, totalDuplicados: 0,
      series: [{ serie: 'radicados', coleccion: 'ventanilla_radicados', ultimo: 42, documentos: 42, distintos: 42, huecos: [], duplicados: [] }],
    }),
  },
  {
    nombre: 'aviso-acta-observaciones',
    html: () => buildAvisoActaHtml({
      numeroExpedienteFUN: '68745-0-26-0042', solicitanteNombre: 'María Fernanda López',
      fechaLimiteRespuesta: ISO,
    }),
  },
  {
    nombre: 'confirmacion-radicacion',
    html: () => buildConfirmacionRadicacionHtml({
      radicadoId: '1-110-202608-00000042', ciudadanoNombre: 'María Fernanda López',
      tipoSolicitud: 'Derecho de petición', fechaRadicado: ISO, fechaVencimiento: ISO,
      canalRespuesta: 'CORREO', descripcionCorta: 'Solicitud de certificado de estratificación.',
    }),
  },
  {
    nombre: 'acuse-recibo-expediente-licencia',
    html: () => buildAcuseReciboExpedienteHtml({
      numeroExpediente: 'DEMO-26-abc12345',
      solicitanteNombre: 'Juan Pérez',
      solicitanteDocumento: '1098765432',
      tipoDocumento: 'CC',
      descripcionTramite: 'licencia de construcción — obra nueva',
      fechaRecepcion: '2026-08-26T12:00:00.000Z',
      documentosEntregados: ['Certificado de Tradición y Libertad'],
      documentosFaltantes: [{ nombre: 'Paz y salvo municipal', motivo: 'SIN_APORTE' }],
      requisitosAplicables: 19,
      radicadoVentanillaId: '1-110-202608-00000042',
    }),
  },
  {
    nombre: 'constancia-radicacion',
    html: () => buildConstanciaRadicacionHtml({
      radicadoId: '1-110-202608-00000042', solicitanteNombre: 'María Fernanda López',
      tipoDocumento: 'CC', numeroDocumento: '1098765432', correoSolicitante: 'ciudadano@ejemplo.com',
      telefonoSolicitante: '3001234567', asunto: 'Solicitud de certificado', tipoTramite: 'Derecho de petición',
      fechaRadicado: ISO, fechaVencimiento: ISO, medioRecepcion: 'PRESENCIAL', canalRespuesta: 'CORREO',
      dependenciaNombre: 'Secretaría de Planeación', funcionarioNombre: 'Funcionaria de Ventanilla', numeroFolios: 3,
    }),
  },
  {
    nombre: 'desistimiento',
    html: () => buildDesistimientoHtml({
      radicadoId: '1-110-202608-00000042', ciudadanoNombre: 'María Fernanda López',
      motivo: 'No se aportó la documentación requerida.', fundamentoLegal: 'Ley 1755 de 2015, artículo 17',
    }),
  },
  {
    nombre: 'notificacion-estado · ASIGNADO',
    html: () => buildNotificacionEstadoHtml({
      radicadoId: '1-110-202608-00000042', ciudadanoNombre: 'María Fernanda López',
      evento: 'ASIGNADO', dependenciaNombre: 'Secretaría de Planeación',
      dependenciaEmail: 'planeacion@simacota.gov.co', fechaEvento: ISO,
    }),
  },
  {
    nombre: 'notificacion-estado · PRORROGA',
    html: () => buildNotificacionEstadoHtml({
      radicadoId: '1-110-202608-00000042', ciudadanoNombre: 'María Fernanda López',
      evento: 'PRORROGA', dependenciaNombre: 'Secretaría de Planeación',
      dependenciaEmail: 'planeacion@simacota.gov.co', nuevaFechaLimite: ISO, diasProrroga: 15,
      motivo: 'Se requiere concepto técnico adicional.', fechaEvento: ISO,
    }),
  },
  {
    nombre: 'requerimiento-subsanacion',
    html: () => buildRequerimientoHtml({
      radicadoId: '1-110-202608-00000042', ciudadanoNombre: 'María Fernanda López',
      motivo: 'Falta copia del certificado de tradición.', fechaLimite: ISO,
      textos: TEXTOS_SUBSANACION_LEY_1755,
    }),
  },
  {
    nombre: 'reset-password',
    html: () => buildResetPasswordHtml({
      destinatarioNombre: 'Funcionaria de Planeación',
      resetLink: 'https://ejemplo.gov.co/reset?token=abc', solicitadoPor: 'Administrador',
    }),
  },
  {
    nombre: 'respuesta-ciudadano',
    html: () => buildRespuestaCiudadanoHtml({
      radicadoId: '1-110-202608-00000042', ciudadanoNombre: 'María Fernanda López',
      asunto: 'Solicitud de certificado', nota: 'Se adjunta la respuesta de fondo.',
      dependenciaNombre: 'Secretaría de Planeación', dependenciaEmail: 'planeacion@simacota.gov.co',
      fechaRespuesta: ISO, tieneArchivo: true,
    }),
  },
];

