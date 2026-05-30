'use client';

interface SessionResponse {
  refreshRequired?: boolean;
  error?: string;
}

export async function createInternalSession(idToken: string, retryWithFreshToken?: () => Promise<string>) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (response.status === 409 && retryWithFreshToken) {
    const freshToken = await retryWithFreshToken();
    return createInternalSession(freshToken);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null) as SessionResponse | null;
    throw new Error(data?.error ?? 'No fue posible crear la sesion interna.');
  }
}

export async function clearInternalSession() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
}
