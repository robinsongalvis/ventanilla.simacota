import type { TrazabilidadRadicado } from '@/src/types/ventanilla';

/**
 * Panel Operativo Fase 1 — traduce `AccionAuditoria` a texto humano
 * corto y calcula una fecha relativa ("hace 15 min", "hace 3 h") para
 * mostrar en el bloque "Última actuación" del resumen ejecutivo.
 *
 * Funciones puras: cero side effects, cero acceso a Firestore.
 */

const LABELS_ULTIMA_ACTUACION: Record<string, string> = {
  RADICACION:                          'Radicado recibido',
  CLASIFICACION_IA:                    'Clasificación asistida por IA',
  ASIGNACION:                          'Asignada a dependencia',
  CAMBIO_ESTADO:                       'Estado actualizado',
  RESPUESTA_FUNCIONARIO:               'Respuesta oficial registrada',
  DEVOLUCION:                          'Devuelto al ciudadano para aclaración',
  RECLASIFICACION:                     'Reclasificado',
  TIPO_SOLICITUD_RECLASIFICADO:        'Tipo de solicitud actualizado',
  NOTIFICACION_WHATSAPP:               'Notificación WhatsApp enviada',
  NOTIFICACION_CORREO_ENVIADA:         'Correo enviado al ciudadano',
  NOTIFICACION_CORREO_FALLIDA:         'Correo institucional falló',
  NOTIFICACION_OMITIDA_DUPLICADA:      'Correo omitido por duplicado',
  NOTIFICACION_GESTIONADA_MANUALMENTE: 'Notificación gestionada manualmente',
  DATOS_NO_APORTADOS_MARCADOS:         'Datos no aportados registrados',
  DATOS_COMPLETADOS:                   'Datos del solicitante completados',
  CONSTANCIA_ENVIADA_CORREO:           'Constancia enviada por correo',
  DOCUMENTO_SELLADO:                   'Documento sellado',
  TRASLADO:                            'Trasladado a otra dependencia',
  PRORROGA:                            'Prórroga registrada',
};

export interface UltimaActuacionResumen {
  label:         string;
  fechaRelativa: string;
  fechaIso:      string;
  accionRaw:     string;
}

/**
 * Convierte una fecha ISO a un string relativo legible:
 *   "hace 5 min", "hace 3 h", "hace 2 días", "ahora".
 *
 * Fechas en el futuro (por reloj adelantado o test) devuelven "ahora"
 * para no confundir al operador.
 */
export function formatFechaRelativa(iso: string, ahora: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const deltaMs = Math.max(0, ahora.getTime() - t);
  const minutos = Math.floor(deltaMs / 60_000);
  if (minutos < 1)      return 'ahora';
  if (minutos < 60)     return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24)       return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30)        return `hace ${dias} día${dias === 1 ? '' : 's'}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12)       return `hace ${meses} mes${meses === 1 ? '' : 'es'}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anios} año${anios === 1 ? '' : 's'}`;
}

/**
 * Etiqueta el evento de trazabilidad para mostrar como "última
 * actuación". Si la acción no está en el diccionario conocido, se
 * muestra el string tal cual para no perder información en casos
 * legacy.
 */
export function etiquetarUltimaActuacion(
  evento: TrazabilidadRadicado,
  ahora: Date = new Date(),
): UltimaActuacionResumen {
  const accionRaw = String(evento.accion);
  const label = LABELS_ULTIMA_ACTUACION[accionRaw] ?? accionRaw;
  return {
    label,
    fechaRelativa: formatFechaRelativa(evento.fecha, ahora),
    fechaIso:      evento.fecha,
    accionRaw,
  };
}
