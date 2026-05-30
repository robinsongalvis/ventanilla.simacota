import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';

async function hasValidInternalSession(request: NextRequest): Promise<boolean> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return false;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    return typeof decoded.tenantId === 'string' && typeof decoded.rol === 'string';
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

  if (isLogin) {
    return validSession
      ? NextResponse.redirect(new URL('/interno/dashboard', request.url))
      : NextResponse.next();
  }

  if (!validSession) {
    const loginUrl = new URL('/interno/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/interno/:path*', '/api/interno/:path*'],
};
