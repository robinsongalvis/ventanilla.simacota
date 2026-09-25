import { timingSafeEqual } from 'node:crypto';

export type MotivoCronDenegado =
  | 'CRON_SECRET_NO_CONFIGURADO'
  | 'AUTHORIZATION_REQUERIDO'
  | 'FORMATO_BEARER_INVALIDO'
  | 'TOKEN_INVALIDO';

export type DecisionCron =
  | { ok: true }
  | {
      ok: false;
      status: 503 | 401;
      motivo: MotivoCronDenegado;
      mensaje: string;
    };

export function autorizarCron(params: {
  authorization: string | null;
  secret?: string;
}): DecisionCron {
  const secret = params.secret?.trim();

  if (!secret) {
    return {
      ok: false,
      status: 503,
      motivo: 'CRON_SECRET_NO_CONFIGURADO',
      mensaje: 'Servicio no disponible.',
    };
  }

  const authorization = params.authorization?.trim();
  if (!authorization) {
    return {
      ok: false,
      status: 401,
      motivo: 'AUTHORIZATION_REQUERIDO',
      mensaje: 'No autorizado.',
    };
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      status: 401,
      motivo: 'FORMATO_BEARER_INVALIDO',
      mensaje: 'No autorizado.',
    };
  }

  const token = match[1]?.trim() ?? '';
  if (!compararSeguro(token, secret)) {
    return {
      ok: false,
      status: 401,
      motivo: 'TOKEN_INVALIDO',
      mensaje: 'No autorizado.',
    };
  }

  return { ok: true };
}

function compararSeguro(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    const maxLength = Math.max(aBuffer.length, bBuffer.length, 1);
    const paddedA = Buffer.alloc(maxLength);
    const paddedB = Buffer.alloc(maxLength);
    aBuffer.copy(paddedA);
    bBuffer.copy(paddedB);
    timingSafeEqual(paddedA, paddedB);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}
