import { NextResponse, type NextRequest } from 'next/server';
import {
  clearSessionCookieOptions,
  LEGACY_INTERNAL_AUTH_COOKIE,
  SESSION_COOKIE_NAME,
} from '@/lib/auth-cookie';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie);
      await getFirebaseAdminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
    }
  }

  response.cookies.set(SESSION_COOKIE_NAME, '', clearSessionCookieOptions());
  response.cookies.set(LEGACY_INTERNAL_AUTH_COOKIE, '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
