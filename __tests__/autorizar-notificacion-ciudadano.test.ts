import { describe, expect, it } from 'vitest';
import {
  autorizarNotificacionCiudadano,
  detectarCamposLibresNotificacion,
  normalizarPayloadNotificacionCiudadano,
  type RadicadoParaNotificacionCiudadano,
  type UsuarioParaNotificacionCiudadano,
} from '@/lib/seguridad/autorizar-notificacion-ciudadano';

const RADICADO_BASE: RadicadoParaNotificacionCiudadano = {
  radicadoId:        '1-WEB-2026-00000001',
  tenantId:          'SEC_GOBIERNO',
  email:             'ciudadano@example.com',
  esAnonimo:         false,
  tipoPresentacion:  'IDENTIFICADA',
};

function user(
  rol: UsuarioParaNotificacionCiudadano['rol'],
  tenantId: UsuarioParaNotificacionCiudadano['tenantId'] = 'SEC_GOBIERNO',
): UsuarioParaNotificacionCiudadano {
  return { uid: `uid-${rol}`, rol, tenantId, activo: true };
}

describe('autorizarNotificacionCiudadano — roles permitidos', () => {
  it('ADMIN puede notificar cualquier radicado', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('ADMIN', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(true);
  });

  it('RECEPCIONISTA puede notificar cualquier radicado', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('RECEPCIONISTA', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(true);
  });

  it('FUNCIONARIO puede notificar radicados de su dependencia', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('FUNCIONARIO', 'SEC_GOBIERNO'),
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(true);
  });
});

describe('autorizarNotificacionCiudadano — bloqueos por rol/dependencia', () => {
  it('FUNCIONARIO no puede notificar otra dependencia', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('FUNCIONARIO', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.motivo).toBe('DEPENDENCIA_NO_AUTORIZADA');
      expect(decision.mensaje).toBe('No tiene permiso para realizar esta acción.');
    }
  });

  it('CONTROL_INTERNO recibe 403', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('CONTROL_INTERNO'),
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.motivo).toBe('ROL_NO_AUTORIZADO');
    }
  });

  it('JEFE_DEPENDENCIA recibe 403', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('JEFE_DEPENDENCIA'),
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.motivo).toBe('ROL_NO_AUTORIZADO');
    }
  });

  it('rol desconocido recibe 403', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('SUPERVISOR_EXTERN0'),
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.status).toBe(403);
  });

  it('usuario sin sesión recibe 401', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: null,
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(401);
      expect(decision.mensaje).toBe('Debe iniciar sesión nuevamente.');
    }
  });

  it('usuario inactivo recibe 403', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: { ...user('FUNCIONARIO'), activo: false },
      radicado: RADICADO_BASE,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.motivo).toBe('USUARIO_INACTIVO');
    }
  });
});

describe('autorizarNotificacionCiudadano — datos del radicado', () => {
  it('radicado inexistente recibe respuesta segura', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('ADMIN'),
      radicado: null,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(404);
      expect(decision.mensaje).toBe('No fue posible localizar el radicado.');
    }
  });

  it('radicado anónimo no genera correo', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('ADMIN'),
      radicado: { ...RADICADO_BASE, esAnonimo: true, tipoPresentacion: 'ANONIMA' },
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(400);
      expect(decision.motivo).toBe('RADICADO_ANONIMO_O_RESERVADO');
    }
  });

  it('radicado con identidad reservada no genera correo desde este endpoint', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('ADMIN'),
      radicado: { ...RADICADO_BASE, tipoPresentacion: 'RESERVADA', identidadReservada: true },
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(400);
      expect(decision.motivo).toBe('RADICADO_ANONIMO_O_RESERVADO');
    }
  });

  it('correo inválido no genera envío', () => {
    const decision = autorizarNotificacionCiudadano({
      usuario: user('ADMIN'),
      radicado: { ...RADICADO_BASE, email: 'no-es-email' },
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(400);
      expect(decision.motivo).toBe('CORREO_INVALIDO');
      expect(decision.mensaje).not.toContain('no-es-email');
    }
  });
});

describe('normalizarPayloadNotificacionCiudadano — no relay arbitrario', () => {
  it('acepta solo radicadoId y acción cerrada', () => {
    expect(normalizarPayloadNotificacionCiudadano({
      radicadoId: '1-WEB-2026-00000001',
      accion:     'REINTENTO_NOTIFICACION',
    })).toEqual({
      ok: true,
      radicadoId: '1-WEB-2026-00000001',
      accion:     'REINTENTO_NOTIFICACION',
    });
  });

  it('rechaza destinatario libre del cliente', () => {
    const decision = normalizarPayloadNotificacionCiudadano({
      radicadoId:        '1-WEB-2026-00000001',
      emailCiudadano:    'atacante@example.com',
      nombreCiudadano:   'Atacante',
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.motivo).toBe('PAYLOAD_NO_PERMITIDO');
      expect(decision.mensaje).not.toContain('atacante@example.com');
    }
  });

  it('rechaza contenido libre del cliente', () => {
    const decision = normalizarPayloadNotificacionCiudadano({
      radicadoId: '1-WEB-2026-00000001',
      asunto:     'Asunto fabricado',
      html:       '<p>contenido arbitrario</p>',
      nota:       'mensaje libre',
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.motivo).toBe('PAYLOAD_NO_PERMITIDO');
      expect(decision.mensaje).toBe('No tiene permiso para realizar esta acción.');
    }
  });

  it('detecta explícitamente campos prohibidos sin filtrar valores', () => {
    expect(detectarCamposLibresNotificacion({
      radicadoId: '1-WEB-2026-00000001',
      correo:     'victima@example.com',
      mensaje:    'hola',
    })).toEqual(['correo', 'mensaje']);
  });
});
