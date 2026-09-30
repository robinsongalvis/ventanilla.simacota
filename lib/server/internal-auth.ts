import { cookies } from 'next/headers';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';

export interface InternalUserSession {
  uid: string;
  email: string;
  nombre: string;
  rol: RolInterno;
  tenantId: TenantId;
  activo: boolean;
  cargo?: string;
}

const ROLES_VALIDOS = new Set<RolInterno>([
  'ADMIN',
  'RECEPCIONISTA',
  'FUNCIONARIO',
  'JEFE_DEPENDENCIA',
  'CONTROL_INTERNO',
]);

const CODIGOS_SESION_INVALIDA = new Set([
  'auth/argument-error',
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
]);

function esTenantId(value: unknown): value is TenantId {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(DIRECTORIO_TENANTS, value);
}

function esErrorDeSesionInvalida(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return typeof error.code === 'string' && CODIGOS_SESION_INVALIDA.has(error.code);
}

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

  const auth = getFirebaseAdminAuth();
  let decoded: DecodedIdToken;
  try {
    decoded = await auth.verifySessionCookie(sessionCookie, true);
  } catch (error) {
    if (esErrorDeSesionInvalida(error)) {
      throw new InternalAuthError('Sesión inválida o expirada.', 401);
    }
    throw error;
  }

  // Esta lectura queda deliberadamente fuera del catch de credenciales: una
  // caída de Firestore es infraestructura, no una supuesta sesión inválida.
  const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();

  if (!snap.exists) {
    throw new InternalAuthError('Usuario interno no registrado.', 403);
  }

  const data = snap.data() ?? {};
  const rol = data.rol;
  const tenantId = data.tenantId;

  if (typeof rol !== 'string' || !ROLES_VALIDOS.has(rol as RolInterno) || !esTenantId(tenantId)) {
    throw new InternalAuthError('Usuario interno sin permisos válidos.', 403);
  }

  if (data.activo === false || data.archivado === true) {
    throw new InternalAuthError('Usuario inactivo o archivado.', 403);
  }

  const cargo = typeof data.cargo === 'string' && data.cargo.trim().length > 0
    ? data.cargo.trim()
    : undefined;

  return {
    uid: decoded.uid,
    email: typeof data.email === 'string' ? data.email : decoded.email ?? '',
    nombre: typeof data.nombre === 'string' ? data.nombre : decoded.email ?? 'Usuario',
    rol: rol as RolInterno,
    tenantId,
    activo: true,
    ...(cargo ? { cargo } : {}),
  };
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

/**
 * BM-B33 — confirmar el desistimiento tácito es un ACTO ADMINISTRATIVO MOTIVADO
 * que extingue el derecho de petición (Ley 1755 Art. 17). A diferencia de una
 * devolución interna (reversible), exige rol superior: ADMIN o JEFE_DEPENDENCIA
 * del tenant. NO lo puede un FUNCIONARIO/RECEPCIONISTA cualquiera.
 */
export function canConfirmarDesistimiento(user: InternalUserSession, tenantId: TenantId): boolean {
  return user.rol === 'ADMIN'
    || (user.rol === 'JEFE_DEPENDENCIA' && user.tenantId === tenantId);
}
