import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { destinoTrasLogin } from '@/lib/auth/destino-tras-login';

async function hasValidInternalSession(request: NextRequest): Promise<boolean> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return false;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    if (typeof decoded.tenantId !== 'string' || typeof decoded.rol !== 'string') {
      return false;
    }

    const userSnap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    const data = userSnap.data();
    return userSnap.exists && data?.activo !== false && data?.archivado !== true;
  } catch {
    return false;
  }
}

function unauthorizedApi() {
  return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/interno/login';
  const isInternalApi = pathname.startsWith('/api/interno/');
  const validSession = await hasValidInternalSession(request);

  if (isInternalApi) {
    return validSession ? NextResponse.next() : unauthorizedApi();
  }

  // Enlaces directos (ADR-0046 §7): con sesión, el login devuelve al `next`
  // validado (solo rutas de /interno/, `lib/auth/destino-tras-login.ts`).
  if (isLogin) {
    return validSession
      ? NextResponse.redirect(new URL(destinoTrasLogin(request.nextUrl.searchParams.get('next')), request.url))
      : NextResponse.next();
  }

  // Sin sesión, el retorno conserva los parámetros
  // (`?vista=licencias&expediente=…`, `?radicadoId=…`), no solo la ruta.
  if (!validSession) {
    const loginUrl = new URL('/interno/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/interno/:path*', '/api/interno/:path*'],
};
