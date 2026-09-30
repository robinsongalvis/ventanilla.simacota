import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, rateLimitHeaders } from '@/lib/ai/rate-limit';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import type { InternalUserSession } from '@/lib/server/internal-auth';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import {
  construirAiLogSeguro,
  validarTamanoPayloadAiLog,
} from '@/lib/seguridad/ai-log-seguro';

export const runtime = 'nodejs';

const ROLES_AUTORIZADOS = new Set(['ADMIN', 'CONTROL_INTERNO']);
const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma:          'no-cache',
  Expires:         '0',
};

function jsonSeguro(body: Record<string, unknown>, status = 200, headers: HeadersInit = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...NO_STORE_HEADERS, ...headers } });
}

async function registrarIntentoAiLog(params: {
  usuario?: InternalUserSession | null;
  motivo: string;
  radicadoId?: string | null;
}): Promise<void> {
  try {
    await getFirebaseAdminDb().collection('seguridad_ai_log_auditoria').add(removeUndefinedDeep({
      tipo:        'AI_LOG_DENEGADO',
      actorUid:    params.usuario?.uid ?? null,
      actorRol:    params.usuario?.rol ?? null,
      actorTenant: params.usuario?.tenantId ?? null,
      radicadoId:  params.radicadoId ?? null,
      motivo:      params.motivo,
      fecha:       new Date().toISOString(),
    }));
  } catch {
    // La auditoría de denegados no debe revelar detalles ni bloquear la respuesta.
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) {
    const { status } = autenticacion;
    await registrarIntentoAiLog({
      motivo: status === 401
        ? 'SESION_REQUERIDA'
        : status === 403
          ? 'USUARIO_NO_AUTORIZADO'
          : 'FALLO_INFRAESTRUCTURA_AUTENTICACION',
    });
    return jsonSeguro(
      {
        error: status === 401
          ? 'Debe iniciar sesión nuevamente.'
          : status === 403
            ? 'No tiene permiso para realizar esta acción.'
            : autenticacion.mensaje,
      },
      status,
    );
  }
  const usuario = autenticacion.usuario;

  if (!ROLES_AUTORIZADOS.has(usuario.rol)) {
    await registrarIntentoAiLog({ usuario, motivo: 'ROL_NO_AUTORIZADO' });
    return jsonSeguro({ error: 'No tiene permiso para realizar esta acción.' }, 403);
  }

  const bloqueado = checkRateLimit(`ai-log:${usuario.uid}`, RATE_LIMIT);
  if (bloqueado) {
    await registrarIntentoAiLog({ usuario, motivo: 'RATE_LIMIT' });
    return jsonSeguro(
      { error: 'Ha realizado demasiadas solicitudes. Intente nuevamente más tarde.' },
      429,
      rateLimitHeaders(RATE_LIMIT.maxRequests, bloqueado.retryAfterSeconds),
    );
  }

  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    await registrarIntentoAiLog({ usuario, motivo: 'BODY_INVALIDO' });
    return jsonSeguro({ error: 'Payload inválido.' }, 400);
  }

  const tamano = validarTamanoPayloadAiLog(rawBody);
  if (tamano) {
    await registrarIntentoAiLog({ usuario, motivo: tamano.motivo });
    return jsonSeguro({ error: tamano.mensaje }, 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await registrarIntentoAiLog({ usuario, motivo: 'JSON_INVALIDO' });
    return jsonSeguro({ error: 'Payload inválido.' }, 400);
  }

  const resultado = construirAiLogSeguro(payload);
  if (!resultado.ok) {
    await registrarIntentoAiLog({ usuario, motivo: resultado.motivo });
    return jsonSeguro({ error: resultado.mensaje }, 400);
  }

  try {
    const db = getFirebaseAdminDb();
    const ahora = new Date().toISOString();
    const logRef = db.collection('ai_logs').doc();

    await logRef.set({
      ...resultado.data,
      logId:     logRef.id,
      actorUid:  usuario.uid,
      actorRol:  usuario.rol,
      timestamp: ahora,
    });

    return jsonSeguro({ exito: true, logId: logRef.id });
  } catch {
    await registrarIntentoAiLog({
      usuario,
      motivo:     'FIRESTORE_ERROR',
      radicadoId: resultado.data.radicadoId,
    });
    return jsonSeguro({ error: 'No fue posible registrar el log de IA.' }, 500);
  }
}
