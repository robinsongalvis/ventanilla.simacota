import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminStorage } from '@/lib/firebase-admin';

const ALLOWED_PATH_PATTERN = /^(radicados|respuestas)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.\- ]+$/;
const SIGNED_URL_EXPIRES_MS = 15 * 60 * 1000;

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, false);
  } catch {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path || !ALLOWED_PATH_PATTERN.test(path)) {
    return NextResponse.json({ error: 'Ruta inválida.' }, { status: 400 });
  }

  try {
    const bucket = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucket) throw new Error('FIREBASE_STORAGE_BUCKET no configurado.');

    const [signedUrl] = await getFirebaseAdminStorage()
      .bucket(bucket)
      .file(path)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + SIGNED_URL_EXPIRES_MS,
      });

    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[archivo] Error generando URL firmada:', msg);
    return NextResponse.json({ error: 'No se pudo acceder al archivo.' }, { status: 500 });
  }
}
