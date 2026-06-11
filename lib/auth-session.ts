'use client';

interface SessionResponse {
  refreshRequired?: boolean;
  error?: string;
  uid?: string;
  email?: string | null;
  rol?: string;
  tenantId?: string;
}

const SESSION_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function createInternalSession(
  idToken: string,
  retryWithFreshToken?: () => Promise<string>,
): Promise<SessionResponse> {
  const response = await fetchWithTimeout('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });

  if (response.status === 409 && retryWithFreshToken) {
    const freshToken = await retryWithFreshToken();
    return createInternalSession(freshToken);
  }

  const data = await response.json().catch(() => null) as SessionResponse | null;

  if (!response.ok) {
    throw new Error(data?.error ?? 'No fue posible crear la sesion interna.');
  }

  return data ?? {};
}

export async function clearInternalSession() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
}
