import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';

export interface InternalUserSession {
  uid: string;
  email: string;
  nombre: string;
  rol: RolInterno;
  tenantId: TenantId;
  activo: boolean;
}

const ROLES_VALIDOS = new Set<RolInterno>([
  'ADMIN',
  'RECEPCIONISTA',
  'FUNCIONARIO',
  'JEFE_DEPENDENCIA',
  'CONTROL_INTERNO',
]);

export class InternalAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 401,
  ) {
    super(message);
  }
}

export async function requireActiveInternalUser(): Promise<InternalUserSession> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    throw new InternalAuthError('No autorizado.', 401);
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();

    if (!snap.exists) {
      throw new InternalAuthError('Usuario interno no registrado.', 403);
    }

    const data = snap.data() ?? {};
    const rol = data.rol as RolInterno;
    const tenantId = data.tenantId as TenantId;

    if (!ROLES_VALIDOS.has(rol) || typeof tenantId !== 'string') {
      throw new InternalAuthError('Usuario interno sin permisos válidos.', 403);
    }

    if (data.activo === false || data.archivado === true) {
      throw new InternalAuthError('Usuario inactivo o archivado.', 403);
    }

    return {
      uid: decoded.uid,
      email: typeof data.email === 'string' ? data.email : decoded.email ?? '',
      nombre: typeof data.nombre === 'string' ? data.nombre : decoded.email ?? 'Usuario',
      rol,
      tenantId,
      activo: true,
    };
  } catch (error) {
    if (error instanceof InternalAuthError) throw error;
    throw new InternalAuthError('Sesión inválida o expirada.', 401);
  }
}

export function canReadTenant(user: InternalUserSession, tenantId: TenantId): boolean {
  return user.rol === 'ADMIN'
    || user.rol === 'RECEPCIONISTA'
    || user.rol === 'CONTROL_INTERNO'
    || user.tenantId === tenantId;
}

export function canOperateTenant(user: InternalUserSession, tenantId: TenantId): boolean {
  return user.rol === 'ADMIN'
    || user.rol === 'RECEPCIONISTA'
    || (user.rol === 'FUNCIONARIO' && user.tenantId === tenantId);
}

export function canAssignRadicado(user: InternalUserSession, currentTenant: TenantId): boolean {
  return user.rol === 'ADMIN'
    || user.rol === 'RECEPCIONISTA'
    || (user.rol === 'FUNCIONARIO' && user.tenantId === currentTenant);
}

/**
 * Reclasificación del tipo de solicitud: limitada a RECEPCIONISTA y ADMIN.
 * Otros roles no pueden modificar el tipo legal del radicado para evitar
 * alterar términos de respuesta sin trazabilidad institucional.
 */
export function canReclassifyTipoSolicitud(user: InternalUserSession): boolean {
  return user.rol === 'ADMIN' || user.rol === 'RECEPCIONISTA';
}
