/**
 * Helpers de autorización compartidos por los endpoints /api/interno/control/*.
 *
 * El alcance privilegia Control Interno y Admin como roles primarios.
 * Jefe de Dependencia tiene acceso limitado a planes/avances de su tenant.
 */

import { NextResponse } from 'next/server';
import { requireActiveInternalUser, InternalAuthError, type InternalUserSession } from '@/lib/server/internal-auth';

export type AccesoControlInterno = 'AUDITOR' | 'JEFE_DEPENDENCIA';

export interface ResultadoAuth {
  user: InternalUserSession;
  acceso: AccesoControlInterno;
}

/**
 * Resuelve el usuario actual y devuelve el modo de acceso.
 * Devuelve { error } cuando no está autorizado.
 */
export async function autorizarAuditor(): Promise<{ ok: true; data: ResultadoAuth } | { ok: false; response: NextResponse }> {
  try {
    const user = await requireActiveInternalUser();
    if (user.rol === 'CONTROL_INTERNO' || user.rol === 'ADMIN') {
      return { ok: true, data: { user, acceso: 'AUDITOR' } };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Su rol permite gestionar radicados, pero esta sección de seguimiento corresponde a Control Interno.' },
        { status: 403 },
      ),
    };
  } catch (err) {
    if (err instanceof InternalAuthError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: err.status === 403
            ? 'Su usuario no tiene acceso al Centro de Control Interno.'
            : 'Su sesión terminó. Ingrese nuevamente al panel.' },
          { status: err.status },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No fue posible verificar su sesión. Ingrese nuevamente al panel.' },
        { status: 401 },
      ),
    };
  }
}

/** Variante que permite además a Jefe de Dependencia. */
export async function autorizarAuditorOJefe(): Promise<{ ok: true; data: ResultadoAuth } | { ok: false; response: NextResponse }> {
  try {
    const user = await requireActiveInternalUser();
    if (user.rol === 'CONTROL_INTERNO' || user.rol === 'ADMIN') {
      return { ok: true, data: { user, acceso: 'AUDITOR' } };
    }
    if (user.rol === 'JEFE_DEPENDENCIA') {
      return { ok: true, data: { user, acceso: 'JEFE_DEPENDENCIA' } };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Su rol permite revisar y hacer seguimiento, pero no realizar esta acción.' },
        { status: 403 },
      ),
    };
  } catch (err) {
    if (err instanceof InternalAuthError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: err.status === 403
            ? 'Su rol permite revisar información, pero no realizar esta acción.'
            : 'Su sesión terminó. Ingrese nuevamente al panel.' },
          { status: err.status },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No fue posible verificar su sesión. Ingrese nuevamente al panel.' },
        { status: 401 },
      ),
    };
  }
}
