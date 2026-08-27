import { NextResponse, type NextRequest } from 'next/server';
import {
  LEGACY_INTERNAL_AUTH_COOKIE,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS,
  sessionCookieOptions,
} from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

type RolInterno = 'ADMIN' | 'FUNCIONARIO' | 'RECEPCIONISTA' | 'JEFE_DEPENDENCIA' | 'CONTROL_INTERNO';

interface UsuarioInternoClaims {
  rol: RolInterno;
  tenantId: string;
}

const ROLES_INTERNOS = new Set<string>([
  'ADMIN', 'FUNCIONARIO', 'RECEPCIONISTA', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO',
]);

function isRolInterno(value: unknown): value is RolInterno {
  return typeof value === 'string' && ROLES_INTERNOS.has(value);
}

async function resolveClaims(uid: string, tokenClaims: Record<string, unknown>): Promise<UsuarioInternoClaims | null> {
  const userSnap = await getFirebaseAdminDb().doc(`users/${uid}`).get();
  if (userSnap.exists) {
    const data = userSnap.data();
    if (data?.activo === false || data?.archivado === true) {
      return null;
    }
    if (data && isRolInterno(data.rol) && typeof data.tenantId === 'string') {
      return { rol: data.rol, tenantId: data.tenantId };
    }
  }

  const tokenRol = tokenClaims.rol;
  const tokenTenant = tokenClaims.tenantId;

  if (isRolInterno(tokenRol) && typeof tokenTenant === 'string' && tokenTenant.trim()) {
    return { rol: tokenRol, tenantId: tokenTenant };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { idToken?: unknown } | null;
    const idToken = body?.idToken;

    if (typeof idToken !== 'string' || !idToken.trim()) {
      return NextResponse.json({ error: 'ID token requerido.' }, { status: 400 });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const claims = await resolveClaims(decoded.uid, decoded);

    if (!claims) {
      return NextResponse.json({ error: 'Usuario interno no autorizado.' }, { status: 403 });
    }

    if (decoded.rol !== claims.rol || decoded.tenantId !== claims.tenantId) {
      const user = await auth.getUser(decoded.uid);
      await auth.setCustomUserClaims(decoded.uid, {
        ...user.customClaims,
        rol: claims.rol,
        tenantId: claims.tenantId,
      });

      return NextResponse.json({ refreshRequired: true }, { status: 409 });
    }

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });
    const maxAgeSeconds = Math.floor(SESSION_EXPIRES_IN_MS / 1000);
    const response = NextResponse.json({
      uid: decoded.uid,
      email: decoded.email ?? null,
      rol: claims.rol,
      tenantId: claims.tenantId,
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, sessionCookieOptions(maxAgeSeconds));
    response.cookies.set(LEGACY_INTERNAL_AUTH_COOKIE, '', {
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err) {
    // Este catch aplana a 401 CUALQUIER fallo del servidor: verifyIdToken,
    // la lectura de users/{uid}, createSessionCookie o la red hacia
    // Firebase. Eso está bien para el cliente (no se filtra el porqué a un
    // atacante), pero mudo costó un diagnóstico entero: el 18-ago un
    // FIREBASE_SERVICE_ACCOUNT ilegible en local produjo «contraseña
    // incorrecta» en pantalla y CERO rastro en la terminal — se buscó el
    // fallo en la credencial del usuario cuando era del servidor. logError
    // registra la causa real (mensaje saneado de PII) sin cambiar la
    // respuesta.
    // …pero NO todo fallo aquí es una avería. Este endpoint es público: un
    // token expirado o malformado es ruido esperable (sesión vencida en una
    // pestaña vieja), y mandarlo a Sentry inundaría la bandeja justo cuando
    // se estrene el DSN — un vigilante que grita por todo deja de leerse.
    // Los códigos de token de firebase-admin se registran en consola y NADA
    // más; lo demás (credencial del servidor ilegible, Firestore caído,
    // createSessionCookie roto) sí es avería y va con logError → Sentry.
    const codigo = (err as { code?: string } | null)?.code ?? '';
    const esTokenDelCliente = typeof codigo === 'string' && codigo.startsWith('auth/');
    if (esTokenDelCliente) {
      console.warn('[auth/session] token rechazado:', codigo);
    } else {
      logError({ radicadoId: '', modulo: 'auth/session', error: err });
    }
    return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 });
  }
}
