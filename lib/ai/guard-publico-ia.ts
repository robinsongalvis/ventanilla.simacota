/**
 * Guard de acceso para los endpoints públicos de IA (C-1).
 *
 * Combina dos defensas antes de gastar una llamada a Gemini:
 *   1. Origen: si la petición trae `Origin` de un sitio distinto al
 *      nuestro, se rechaza (ataque cross-site desde el navegador). Las
 *      llamadas legítimas de la SPA son del mismo origen; las de
 *      apps/servidores no traen `Origin` y no se bloquean por esto —
 *      para ellas manda el rate limit.
 *   2. Rate limit compartido en Firestore (verificarRateLimitIA), que
 *      sí funciona en serverless.
 *
 * Devuelve un resultado neutro; cada endpoint decide cómo renderizar el
 * 403/429 (el chat usa forma de mensaje; los demás, JSON) — así no se
 * rompe el contrato de respuesta de ninguno.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { getClientIp } from '@/lib/ai/rate-limit';
import { hashDatoAuditoria } from '@/lib/seguridad/consulta-publica-radicado';
import { verificarRateLimitIA, REGLAS_IA } from '@/lib/ai/rate-limit-compartido';

export type ClaveIA = 'chat' | 'classify' | 'scan-doc';

export interface ResultadoGuardIA {
  permitido:          boolean;
  status?:            403 | 429;
  retryAfterSeconds?: number;
  motivo?:            'ORIGEN' | 'RATE_LIMIT';
}

function hashSecret(): string {
  return process.env.CONSULTA_HASH_SECRET
    ?? process.env.FIREBASE_SERVICE_ACCOUNT
    ?? 'ventanilla-ia-runtime';
}

function origenPermitido(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // sin Origin (apps, curl, server): el rate limit cubre el abuso

  // Mismo host que la petición → siempre permitido (la SPA propia).
  const host = request.headers.get('host');
  try {
    if (host && new URL(origin).host === host) return true;
  } catch {
    return false; // Origin malformado
  }

  const permitidos = [
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(',') ?? []),
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  return permitidos.some((p) => {
    try { return new URL(p).origin === new URL(origin).origin; } catch { return false; }
  });
}

export async function evaluarAccesoIA(request: Request, clave: ClaveIA): Promise<ResultadoGuardIA> {
  if (!origenPermitido(request)) {
    return { permitido: false, status: 403, motivo: 'ORIGEN' };
  }

  const ipHash = hashDatoAuditoria(getClientIp(request), hashSecret());
  const limite = await verificarRateLimitIA({
    db: getFirebaseAdminDb(),
    clave,
    ipHash,
    regla: REGLAS_IA[clave],
  });

  if (limite.bloqueado) {
    return { permitido: false, status: 429, retryAfterSeconds: limite.retryAfterSeconds, motivo: 'RATE_LIMIT' };
  }
  return { permitido: true };
}
