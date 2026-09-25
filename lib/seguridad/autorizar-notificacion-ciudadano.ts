import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';

export type AccionNotificacionCiudadano = 'RESPUESTA_OFICIAL' | 'REINTENTO_NOTIFICACION';

export interface UsuarioParaNotificacionCiudadano {
  uid: string;
  rol: RolInterno | string;
  tenantId: TenantId | string;
  activo?: boolean;
}

export interface RadicadoParaNotificacionCiudadano {
  radicadoId: string;
  tenantId: TenantId | string;
  email?: string | null;
  esAnonimo?: boolean;
  tipoPresentacion?: 'IDENTIFICADA' | 'ANONIMA' | 'RESERVADA' | string | null;
  identidadReservada?: boolean;
}

export type MotivoDecisionNotificacionCiudadano =
  | 'SESION_REQUERIDA'
  | 'USUARIO_INACTIVO'
  | 'ROL_NO_AUTORIZADO'
  | 'DEPENDENCIA_NO_AUTORIZADA'
  | 'RADICADO_NO_ENCONTRADO'
  | 'RADICADO_ANONIMO_O_RESERVADO'
  | 'CORREO_INVALIDO'
  | 'AUTORIZADO';

export type DecisionNotificacionCiudadano =
  | {
      ok: true;
      motivo: 'AUTORIZADO';
    }
  | {
      ok: false;
      status: 401 | 403 | 404 | 400;
      mensaje: string;
      motivo: Exclude<MotivoDecisionNotificacionCiudadano, 'AUTORIZADO'>;
    };

const ROLES_GLOBALES = new Set(['ADMIN', 'RECEPCIONISTA']);
const ROL_FUNCIONARIO = 'FUNCIONARIO';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CAMPOS_CLIENTE_PROHIBIDOS = new Set([
  'destinatario',
  'correo',
  'email',
  'emailCiudadano',
  'to',
  'asunto',
  'subject',
  'mensaje',
  'html',
  'nota',
  'nombre',
  'nombreCiudadano',
  'ciudadanoNombre',
  'tenantId',
  'dependencia',
  'fechaRespuesta',
  'tieneArchivo',
]);

export function detectarCamposLibresNotificacion(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  return Object.keys(payload as Record<string, unknown>)
    .filter((campo) => CAMPOS_CLIENTE_PROHIBIDOS.has(campo));
}

export function normalizarPayloadNotificacionCiudadano(payload: unknown): {
  ok: true;
  radicadoId: string;
  accion: AccionNotificacionCiudadano;
} | {
  ok: false;
  status: 400 | 403;
  motivo: string;
  mensaje: string;
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      status: 400,
      motivo: 'PAYLOAD_INVALIDO',
      mensaje: 'Solicitud inválida.',
    };
  }

  const camposProhibidos = detectarCamposLibresNotificacion(payload);
  if (camposProhibidos.length > 0) {
    return {
      ok: false,
      status: 403,
      motivo: 'PAYLOAD_NO_PERMITIDO',
      mensaje: 'No tiene permiso para realizar esta acción.',
    };
  }

  const data = payload as Record<string, unknown>;
  const radicadoId = typeof data.radicadoId === 'string' ? data.radicadoId.trim() : '';
  if (!radicadoId) {
    return {
      ok: false,
      status: 400,
      motivo: 'RADICADO_ID_REQUERIDO',
      mensaje: 'Solicitud inválida.',
    };
  }

  const accion = typeof data.accion === 'string' ? data.accion.trim() : 'RESPUESTA_OFICIAL';
  if (accion !== 'RESPUESTA_OFICIAL' && accion !== 'REINTENTO_NOTIFICACION') {
    return {
      ok: false,
      status: 400,
      motivo: 'ACCION_NO_PERMITIDA',
      mensaje: 'Solicitud inválida.',
    };
  }

  return { ok: true, radicadoId, accion };
}

export function autorizarNotificacionCiudadano(params: {
  usuario: UsuarioParaNotificacionCiudadano | null;
  radicado: RadicadoParaNotificacionCiudadano | null;
}): DecisionNotificacionCiudadano {
  const { usuario, radicado } = params;

  if (!usuario) {
    return {
      ok: false,
      status: 401,
      motivo: 'SESION_REQUERIDA',
      mensaje: 'Debe iniciar sesión nuevamente.',
    };
  }

  if (usuario.activo === false) {
    return {
      ok: false,
      status: 403,
      motivo: 'USUARIO_INACTIVO',
      mensaje: 'No tiene permiso para realizar esta acción.',
    };
  }

  if (!radicado) {
    return {
      ok: false,
      status: 404,
      motivo: 'RADICADO_NO_ENCONTRADO',
      mensaje: 'No fue posible localizar el radicado.',
    };
  }

  if (ROLES_GLOBALES.has(usuario.rol)) {
    return validarNotificabilidadRadicado(radicado);
  }

  if (usuario.rol === ROL_FUNCIONARIO) {
    if (usuario.tenantId !== radicado.tenantId) {
      return {
        ok: false,
        status: 403,
        motivo: 'DEPENDENCIA_NO_AUTORIZADA',
        mensaje: 'No tiene permiso para realizar esta acción.',
      };
    }
    return validarNotificabilidadRadicado(radicado);
  }

  return {
    ok: false,
    status: 403,
    motivo: 'ROL_NO_AUTORIZADO',
    mensaje: 'No tiene permiso para realizar esta acción.',
  };
}

function validarNotificabilidadRadicado(
  radicado: RadicadoParaNotificacionCiudadano,
): DecisionNotificacionCiudadano {
  if (
    radicado.esAnonimo === true
    || radicado.identidadReservada === true
    || radicado.tipoPresentacion === 'ANONIMA'
    || radicado.tipoPresentacion === 'RESERVADA'
  ) {
    return {
      ok: false,
      status: 400,
      motivo: 'RADICADO_ANONIMO_O_RESERVADO',
      mensaje: 'El radicado no cuenta con un correo válido para notificación.',
    };
  }

  const email = radicado.email?.trim().toLowerCase() ?? '';
  const puedeNotificar = debeNotificarCiudadano({
    esAnonimo: radicado.esAnonimo,
    tipoPresentacion: radicado.tipoPresentacion === 'IDENTIFICADA' ? 'IDENTIFICADA' : undefined,
    solicitante: { email },
  });

  if (!EMAIL_RE.test(email) || !puedeNotificar) {
    return {
      ok: false,
      status: 400,
      motivo: 'CORREO_INVALIDO',
      mensaje: 'El radicado no cuenta con un correo válido para notificación.',
    };
  }

  return { ok: true, motivo: 'AUTORIZADO' };
}
