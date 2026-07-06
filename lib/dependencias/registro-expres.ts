import type { TenantId } from '@/src/types/radicado';
import type {
  TrazabilidadRadicado,
  VentanillaRadicado,
} from '@/src/types/ventanilla';
import type { SalidaOficial } from '@/src/types/salida';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import {
  calcularFechaVencimiento,
  resolverTipoSolicitud,
  type TipoSolicitudId,
} from '@/lib/tiempos-radicado';
import { formatFechaHoraColombia, formatHoraColombia } from '@/lib/fecha-colombia';
import { construirDocSalida, construirNotaSalida } from '@/lib/salidas/construir-salida';

/**
 * Sprint Registro exprés de dependencia.
 *
 * Caso real (el correo del banco a Hacienda): la correspondencia llega
 * DIRECTO al correo institucional de la oficina y se responde de
 * inmediato — hoy nada queda en el sistema. El registro exprés deja
 * que el funcionario declare, DESPUÉS de responder, qué llegó y qué
 * respondió; este helper arma el paquete completo:
 *
 *  - entrada 1-EMAIL-... dirigida a SU dependencia, nacida RESUELTA
 *    con respuestaOficial;
 *  - salida 2-SAL amarrada (la respuesta que ya envió);
 *  - los eventos de trazabilidad con las fechas REALES declaradas.
 *
 * Decisiones aprobadas: la fecha del radicado es la del REGISTRO
 * (serie limpia); las fechas reales de llegada y respuesta quedan en
 * el documento y las notas. El cumplimiento de término se calcula
 * honesto: vencimiento desde la llegada real, comparado con la
 * respuesta real.
 *
 * Función pura: sin Firestore, sin React. El endpoint la usa con los
 * consecutivos ya generados.
 */

export interface EntradaExpres {
  remitenteNombre:  string;
  remitenteEntidad?: string | null;
  remitenteEmail?:  string | null;
  tipoSolicitudId:  TipoSolicitudId;
  asunto:           string;
  /** Qué pedía el correo. */
  descripcion:      string;
  /** ISO — cuándo llegó realmente el correo. */
  fechaLlegada:     string;
  /** Qué se respondió (resumen). */
  respuestaResumen: string;
  /** ISO — cuándo se respondió realmente. */
  fechaRespuesta:   string;
  /** Dependencia que recibió y respondió. */
  dependencia:      TenantId;
}

export interface IdsExpres {
  radicadoId:         string;
  consecutivoEntrada: number;
  salidaId:           string;
  consecutivoSalida:  number;
}

export interface PaqueteExpres {
  radicado:       VentanillaRadicado;
  salida:         SalidaOficial;
  eventosEntrada: Omit<TrazabilidadRadicado, 'eventoId'>[];
}

/** Valida la declaración; devuelve el mensaje de error o null. */
export function validarRegistroExpres(e: EntradaExpres, ahora: Date): string | null {
  if (!e.remitenteNombre?.trim()) return 'El remitente es obligatorio.';
  if (!e.asunto?.trim())          return 'El asunto es obligatorio.';
  if (!e.descripcion?.trim())     return 'Describa qué pedía el correo.';
  if (!e.respuestaResumen?.trim()) return 'Describa qué se respondió.';

  const llegada = new Date(e.fechaLlegada);
  const respuesta = new Date(e.fechaRespuesta);
  if (Number.isNaN(llegada.getTime()))   return 'La fecha de llegada no es válida.';
  if (Number.isNaN(respuesta.getTime())) return 'La fecha de respuesta no es válida.';
  if (respuesta.getTime() < llegada.getTime()) {
    return 'La respuesta no puede ser anterior a la llegada del correo.';
  }
  if (respuesta.getTime() > ahora.getTime()) {
    return 'La fecha de respuesta no puede estar en el futuro.';
  }
  return null;
}

export function construirPaqueteExpres(
  e: EntradaExpres,
  ids: IdsExpres,
  actor: { uid: string; nombre: string },
  ahora: Date,
): PaqueteExpres {
  const tipo = resolverTipoSolicitud(e.tipoSolicitudId);
  // Cumplimiento honesto: el término corre desde la LLEGADA real.
  const vencimiento = calcularFechaVencimiento(e.fechaLlegada, e.tipoSolicitudId);
  const cumplioTermino =
    new Date(e.fechaRespuesta).getTime() <= new Date(vencimiento.fechaVencimiento).getTime();

  const entidad = e.remitenteEntidad?.trim() || null;
  const nombreDependencia = NOMBRES_TENANT[e.dependencia] ?? e.dependencia;

  const radicado: VentanillaRadicado = {
    radicadoId:          ids.radicadoId,
    estadoActual:        'RESUELTO',
    ultimaActualizacion: ahora.toISOString(),
    prioridad:           tipo.prioridadSugerida,
    cumplioTermino,
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     entidad ? 'JURIDICA' : 'NATURAL',
      tipoDocumento:   'OTRO',
      numeroDocumento: '',
      nombreCompleto:  e.remitenteNombre.trim(),
      razonSocial:     entidad,
      email:           e.remitenteEmail?.trim() || null,
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
      // El correo directo no trae documento — marca honesta, resoluble
      // después con "completar datos" si el remitente vuelve.
      datosNoAportados: { documento: true },
    },
    control: {
      radicadoId:     ids.radicadoId,
      consecutivo:    ids.consecutivoEntrada,
      // Decisión aprobada: la serie usa el momento del REGISTRO; la
      // llegada real queda en la trazabilidad.
      fechaRadicado:  ahora.toISOString(),
      horaRadicado:   formatHoraColombia(ahora),
      medioRecepcion: 'EMAIL',
      origen:         'FISICO_ESCANER',
      origenIngreso:  'CORREO_INSTITUCIONAL',
      tipoEntrada:    'CORRESPONDENCIA_RECIBIDA',
    },
    termino: {
      tipoSolicitudId:     e.tipoSolicitudId,
      tipoSolicitudNombre: tipo.nombre,
      diasRespuesta:       vencimiento.diasRespuesta,
      unidad:              vencimiento.unidad,
      fechaVencimiento:    vencimiento.fechaVencimiento,
      prorrogasAplicadas:  0,
    },
    clasificacion: {
      oficinaDestino:               e.dependencia,
      zonaGeografica:               'CASCO_URBANO',
      funcionarioResponsableUid:    actor.uid,
      funcionarioResponsableNombre: actor.nombre,
      fechaAsignacionResponsable:   ahora.toISOString(),
    },
    detalle: {
      asunto:       e.asunto.trim(),
      descripcion:  e.descripcion.trim(),
      numeroFolios: 0,
    },
    archivos: [],
    respuestaOficial: {
      archivoPath:   null,
      archivoNombre: null,
      nota:          e.respuestaResumen.trim(),
      fecha:         e.fechaRespuesta,
      actorUid:      actor.uid,
      actorNombre:   actor.nombre,
    },
  };

  const salida = construirDocSalida(
    {
      tipoSalida:        'RESPUESTA',
      radicadoEntradaId: ids.radicadoId,
      destinatario: {
        nombre:  e.remitenteNombre.trim(),
        entidad,
        email:   e.remitenteEmail?.trim() || null,
      },
      asunto:            `Respuesta: ${e.asunto.trim()}`,
      dependenciaOrigen: e.dependencia,
      medioEnvio:        'CORREO',
      firmanteNombre:    actor.nombre,
    },
    ids.salidaId,
    ids.consecutivoSalida,
    actor,
    ahora,
  );

  const eventosEntrada: Omit<TrazabilidadRadicado, 'eventoId'>[] = [
    {
      fecha: ahora.toISOString(),
      accion: 'RADICACION',
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      oficinaDestino: e.dependencia,
      nota: `Recibido por correo institucional el ${formatFechaHoraColombia(e.fechaLlegada)} · registro exprés por ${actor.nombre} · Dirigido a: ${nombreDependencia}`,
      metadata: { registroExpres: true, fechaLlegadaReal: e.fechaLlegada },
    },
    {
      fecha: ahora.toISOString(),
      accion: 'RESPUESTA_FUNCIONARIO',
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      nota: `Respondido el ${formatFechaHoraColombia(e.fechaRespuesta)} desde el correo institucional (registro exprés)`,
      metadata: { registroExpres: true, fechaRespuestaReal: e.fechaRespuesta },
    },
    {
      fecha: ahora.toISOString(),
      accion: 'OFICIO_SALIDA_REGISTRADO',
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      nota: construirNotaSalida(ids.salidaId, e.remitenteNombre.trim(), e.dependencia),
      metadata: { salidaId: ids.salidaId, registroExpres: true },
    },
  ];

  return { radicado, salida, eventosEntrada };
}
