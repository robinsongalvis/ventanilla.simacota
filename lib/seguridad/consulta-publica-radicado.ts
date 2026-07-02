import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type {
  EstadoCiudadano,
  LineaTiempoPublica,
  RadicadoPublico,
} from '@/src/types/simi-citizen';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';
import { buildRespuestaPublicaCiudadano } from '@/lib/server/respuesta-publica';

const LEGACY_RADICADO_RE = /^EXT-\d{4}-\d{2}-\d{2}-\d{6}-[A-Z2-9]{4}$/;
const INSTITUCIONAL_RADICADO_RE = /^1-(WEB|OFICIO|EMAIL|PRESENCIAL)-\d{4}-\d{8}$/;

const ACCIONES_PUBLICAS = new Map<string, string>([
  ['RADICACION', 'Solicitud recibida'],
  ['ASIGNACION', 'Asignada a la dependencia competente'],
  ['CAMBIO_ESTADO', 'Estado actualizado'],
  ['DEVOLUCION', 'Se requiere información adicional'],
  ['RESPUESTA_FUNCIONARIO', 'Respuesta oficial registrada'],
]);

export const MENSAJE_CONSULTA_NO_VERIFICADA =
  'No fue posible verificar el radicado con la información suministrada. Revise los datos e intente nuevamente.';

export type MotivoConsultaDenegada =
  | 'DATOS_INVALIDOS'
  | 'NO_ENCONTRADO'
  | 'NO_VERIFICADO'
  | 'SIN_METODO_VERIFICACION';

export type ResultadoVerificacion =
  | { autorizado: true; metodo: 'CORREO' | 'DOCUMENTO' | 'TOKEN' }
  | { autorizado: false; motivo: MotivoConsultaDenegada };

export function normalizarNumeroRadicado(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function esNumeroRadicadoValido(value: string): boolean {
  return INSTITUCIONAL_RADICADO_RE.test(value) || LEGACY_RADICADO_RE.test(value);
}

export function normalizarCorreo(value: string): string {
  return value.trim().toLowerCase();
}

export function generarTokenConsulta(): string {
  return randomBytes(32).toString('base64url');
}

export function hashTokenConsulta(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function hashDatoAuditoria(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

function compararSeguro(a: string, b: string): boolean {
  const aHash = createHash('sha256').update(a, 'utf8').digest();
  const bHash = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(aHash, bHash);
}

function ultimosCuatroDocumento(numeroDocumento: string): string | null {
  const digitos = numeroDocumento.replace(/\D/g, '');
  return digitos.length >= 4 ? digitos.slice(-4) : null;
}

export function verificarDatoConsulta(
  radicado: Pick<
    VentanillaRadicado,
    'esAnonimo' | 'tipoPresentacion' | 'solicitante' | 'consultaTokenHash'
  >,
  datoVerificacion: string,
): ResultadoVerificacion {
  const dato = datoVerificacion.trim();
  if (!dato) return { autorizado: false, motivo: 'DATOS_INVALIDOS' };

  const esAnonimo = radicado.esAnonimo || radicado.tipoPresentacion === 'ANONIMA';
  if (esAnonimo) {
    if (!radicado.consultaTokenHash) {
      compararSeguro(hashTokenConsulta(dato), hashTokenConsulta('token-inexistente'));
      return { autorizado: false, motivo: 'SIN_METODO_VERIFICACION' };
    }

    return compararSeguro(hashTokenConsulta(dato), radicado.consultaTokenHash)
      ? { autorizado: true, metodo: 'TOKEN' }
      : { autorizado: false, motivo: 'NO_VERIFICADO' };
  }

  const correo = radicado.solicitante.email
    ? normalizarCorreo(radicado.solicitante.email)
    : null;
  const ultimos4 = ultimosCuatroDocumento(radicado.solicitante.numeroDocumento ?? '');

  if (!correo && !ultimos4 && radicado.consultaTokenHash) {
    return compararSeguro(hashTokenConsulta(dato), radicado.consultaTokenHash)
      ? { autorizado: true, metodo: 'TOKEN' }
      : { autorizado: false, motivo: 'NO_VERIFICADO' };
  }

  if (!correo && !ultimos4) {
    compararSeguro(normalizarCorreo(dato), 'dato-inexistente');
    return { autorizado: false, motivo: 'SIN_METODO_VERIFICACION' };
  }

  if (correo && compararSeguro(normalizarCorreo(dato), correo)) {
    return { autorizado: true, metodo: 'CORREO' };
  }

  if (ultimos4 && compararSeguro(dato.replace(/\D/g, ''), ultimos4)) {
    return { autorizado: true, metodo: 'DOCUMENTO' };
  }

  return { autorizado: false, motivo: 'NO_VERIFICADO' };
}

export function mapEstadoCiudadano(
  estadoActual: string,
  fueRespondido: boolean,
): EstadoCiudadano {
  if (fueRespondido || ['RESUELTO', 'RECHAZADO'].includes(estadoActual)) return 'respondido';
  switch (estadoActual) {
    case 'PENDIENTE': return 'radicado_recibido';
    case 'ASIGNADO': return 'asignado_dependencia';
    case 'EN_PROCESO': return 'en_proyeccion_respuesta';
    case 'DEVUELTO': return 'requiere_aclaracion';
    case 'PRORROGA': return 'en_proyeccion_respuesta';
    default: return 'en_revision';
  }
}

export function aLineaTiempoPublica(
  entradas: TrazabilidadRadicado[],
): LineaTiempoPublica[] {
  return entradas.flatMap((entrada) => {
    const evento = ACCIONES_PUBLICAS.get(entrada.accion);
    return evento ? [{ fecha: entrada.fecha, evento }] : [];
  });
}

/**
 * Mapper por lista positiva. Nunca propaga campos nuevos del documento fuente.
 *
 * H-03 + Sprint Ventanilla Operativa 1: los siguientes campos internos NO
 * se exponen a consulta pública, y no deben agregarse aquí:
 *   - solicitante.telefonoMovil, telefonoFijo, datosNoAportados
 *   - solicitante.ubicacion.barrio
 *   - control.origenIngreso, control.tipoEntrada
 *   - detalle.numeroAnexos, detalle.observacionesAnexos
 *
 * Si en el futuro se agrega un campo nuevo al documento, evalúalo aquí
 * primero: por defecto, NO se expone al ciudadano.
 */
export function aRadicadoPublico(params: {
  radicado: VentanillaRadicado;
  lineaTiempo?: LineaTiempoPublica[];
  fechaRespuestaSimi?: string;
  canalRespuestaSimi?: string;
}): RadicadoPublico {
  const { radicado } = params;
  const esReservado = Boolean(
    radicado.esAnonimo
    || radicado.identidadReservada
    || radicado.tipoPresentacion === 'ANONIMA'
    || radicado.tipoPresentacion === 'RESERVADA',
  );
  const dependenciaNombre = NOMBRES_TENANT[radicado.clasificacion.oficinaDestino]
    ?? 'Alcaldía de Simacota';
  const respuestaOficialBase = buildRespuestaPublicaCiudadano(radicado, dependenciaNombre);
  const respuestaOficial = respuestaOficialBase
    ? {
        ...respuestaOficialBase,
        dependenciaNombre: esReservado ? 'Alcaldía Municipal de Simacota' : respuestaOficialBase.dependenciaNombre,
      }
    : null;
  const fueRespondido = Boolean(params.fechaRespuestaSimi || respuestaOficial);

  return {
    numeroRadicado: radicado.radicadoId,
    fechaRadicacion: radicado.control.fechaRadicado,
    estadoPublico: mapEstadoCiudadano(radicado.estadoActual, fueRespondido),
    tipoSolicitud: radicado.termino.tipoSolicitudNombre,
    fechaVencimiento: radicado.termino.fechaVencimiento,
    requiereAclaracion: radicado.estadoActual === 'DEVUELTO',
    fueRespondido,
    respuestaDisponible: fueRespondido,
    ...(!esReservado ? { dependencia: dependenciaNombre } : {}),
    ...(params.fechaRespuestaSimi || respuestaOficial?.fecha
      ? { fechaRespuesta: params.fechaRespuestaSimi ?? respuestaOficial?.fecha }
      : {}),
    ...(params.canalRespuestaSimi ? { canalRespuesta: params.canalRespuestaSimi } : {}),
    ...(respuestaOficial ? { respuestaOficial } : {}),
    ...(params.lineaTiempo ? { lineaTiempo: params.lineaTiempo } : {}),
  };
}
