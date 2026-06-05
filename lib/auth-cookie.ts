import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export const SESSION_COOKIE_NAME = '__session';
export const LEGACY_INTERNAL_AUTH_COOKIE = 'vu-auth';
export const SESSION_EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000;

export function sessionCookieOptions(maxAgeSeconds: number): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',   // 'strict' bloquea navegación post-login en iOS Safari / Chrome Android
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function clearSessionCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',   // 'strict' bloquea navegación post-login en iOS Safari / Chrome Android
    path: '/',
    maxAge: 0,
  };
}
