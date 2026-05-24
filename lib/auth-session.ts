'use client';

import { INTERNAL_AUTH_COOKIE } from './auth-cookie';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function markInternalSessionActive() {
  document.cookie = [
    `${INTERNAL_AUTH_COOKIE}=1`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ].join('; ');
}

export function clearInternalSession() {
  document.cookie = `${INTERNAL_AUTH_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
