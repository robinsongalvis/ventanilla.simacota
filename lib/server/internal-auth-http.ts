import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import {
  InternalAuthError,
  requireActiveInternalUser,
  type InternalUserSession,
} from '@/lib/server/internal-auth';

export type ResultadoAutenticacionInterna =
  | { ok: true; usuario: InternalUserSession }
  | {
      ok: false;
      status: 401 | 403 | 500;
      mensaje: string;
      respuesta: NextResponse;
    };

/**
 * Adapta la sesión interna al contrato HTTP común de los Route Handlers.
 *
 * La identidad y sus invariantes viven en `requireActiveInternalUser`; este
 * adaptador solo normaliza la respuesta pública y conserva como 500 los
 * fallos de infraestructura que no son errores de credencial o permisos.
 */
export async function autenticarUsuarioInterno(): Promise<ResultadoAutenticacionInterna> {
  try {
    return { ok: true, usuario: await requireActiveInternalUser() };
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return {
        ok: false,
        status: error.status,
        mensaje: error.message,
        respuesta: NextResponse.json({ error: error.message }, { status: error.status }),
      };
    }

    logError({
      radicadoId: 'NO_APLICA',
      modulo: 'autenticacion-interna/verificar-sesion',
      error,
    });
    return {
      ok: false,
      status: 500,
      mensaje: 'Ocurrió un error interno. Intente de nuevo.',
      respuesta: NextResponse.json(
        { error: 'Ocurrió un error interno. Intente de nuevo.' },
        { status: 500 },
      ),
    };
  }
}
