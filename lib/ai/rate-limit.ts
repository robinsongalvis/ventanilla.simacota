interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitBlocked {
  retryAfterSeconds: number;
}

const buckets = new Map<string, RateLimitEntry>();

function cleanupExpired(now: number, windowMs: number) {
  for (const [key, entry] of buckets.entries()) {
    if (now - entry.windowStart >= windowMs) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitBlocked | null {
  const now = Date.now();
  cleanupExpired(now, options.windowMs);

  const entry = buckets.get(key);

  if (!entry) {
    buckets.set(key, { count: 1, windowStart: now });
    return null;
  }

  entry.count += 1;

  if (entry.count <= options.maxRequests) {
    return null;
  }

  const retryAfterMs = Math.max(options.windowMs - (now - entry.windowStart), 0);
  return { retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'unknown';
}

export function rateLimitHeaders(
  maxRequests: number,
  retryAfterSeconds?: number,
): HeadersInit {
  return {
    'X-RateLimit-Limit': String(maxRequests),
    ...(retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {}),
  };
}
