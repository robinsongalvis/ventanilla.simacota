import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { RolInterno } from '@/lib/hooks/useAuth';

export const runtime = 'nodejs';

async function verificarAdmin() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    const rol = String(d.rol ?? '').toUpperCase() as RolInterno | 'SUPER_ADMIN' | 'DESARROLLADOR';
    if (!['ADMIN', 'SUPER_ADMIN', 'DESARROLLADOR'].includes(rol)) return null;
    return { uid: decoded.uid, rol };
  } catch {
    return null;
  }
}

async function archiveByTestRun(collectionName: string, testRunId: string, deletedBy: string): Promise<number> {
  const db = getFirebaseAdminDb();
  const snap = await db.collection(collectionName)
    .where('testRunId', '==', testRunId)
    .limit(100)
    .get()
    .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));
  const batch = db.batch();
  const deletedAt = new Date().toISOString();
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      estadoTest: 'archived',
      archived: true,
      deletedAt,
      deletedBy,
      updatedAt: deletedAt,
    });
  }
  if (snap.docs.length > 0) await batch.commit();
  return snap.docs.length;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ testRunId: string }> },
): Promise<NextResponse> {
  const usuario = await verificarAdmin();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { testRunId } = await params;
  if (!testRunId.startsWith('e2e_')) {
    return NextResponse.json({ error: 'testRunId inválido.' }, { status: 400 });
  }

  const collections = [
    'ventanilla_radicados',
    'simi_borrador_versiones',
    'simi_aprobaciones_respuesta',
    'simi_respuestas_firma',
    'simi_juridico_auditoria',
    'simi_operational_auditoria',
  ];
  const counts: Record<string, number> = {};

  for (const collectionName of collections) {
    counts[collectionName] = await archiveByTestRun(collectionName, testRunId, usuario.uid);
  }

  await getFirebaseAdminDb().collection('simi_e2e_test_runs').doc(testRunId).set({
    estado: 'archived',
    archived: true,
    deletedAt: new Date().toISOString(),
    deletedBy: usuario.uid,
    updatedAt: new Date().toISOString(),
    cleanupCounts: counts,
  }, { merge: true });

  return NextResponse.json({ ok: true, testRunId, archived: counts });
}
