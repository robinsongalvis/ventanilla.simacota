import { NextResponse } from 'next/server';
import { cookies }      from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import {
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from '@/lib/firebase-admin';
import type { TenantId } from '@/src/types/radicado';
import type { RolInterno } from '@/lib/hooks/useAuth';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   POST /api/simi/feedback
   Guarda el feedback de utilidad de una respuesta SIMI.

   Colección: simi_feedback
   {
     radicadoId, accion, usuarioUid, rol, tenantId,
     util, motivo?, comentario?, fecha, auditoriaId?
   }
══════════════════════════════════════════════════════════════ */

const MOTIVOS_VALIDOS = new Set([
  'RESPUESTA_INCOMPLETA',
  'NO_ENTENDIO_SOLICITUD',
  'NO_TUVO_EN_CUENTA_DEPENDENCIA',
  'NO_INSTITUCIONAL',
  'INVENTO_INFORMACION',
  'FALTA_PROFUNDIDAD',
  'OTRO',
]);

interface FeedbackPayload {
  radicadoId:   string;
  accion:       string;
  auditoriaId?: string;
  util:         boolean;
  motivo?:      string;
  comentario?:  string;
}

async function verificarSesion(): Promise<{
  uid: string; nombre: string; rol: RolInterno; tenantId: TenantId;
} | null> {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, false);
    const snap    = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false || d.archivado === true) return null;
    return {
      uid:      decoded.uid,
      nombre:   d.nombre as string ?? '',
      rol:      d.rol as RolInterno ?? 'FUNCIONARIO',
      tenantId: d.tenantId as TenantId ?? 'VENTANILLA_UNICA',
    };
  } catch { return null; }
}

export async function POST(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let payload: FeedbackPayload;
  try {
    payload = await request.json() as FeedbackPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const { radicadoId, accion, util, motivo, comentario, auditoriaId } = payload;

  if (!radicadoId || !accion || typeof util !== 'boolean') {
    return NextResponse.json(
      { error: 'Campos requeridos: radicadoId, accion, util (boolean).' },
      { status: 400 },
    );
  }

  if (!util && motivo && !MOTIVOS_VALIDOS.has(motivo)) {
    return NextResponse.json(
      { error: `Motivo inválido: ${motivo}` },
      { status: 400 },
    );
  }

  try {
    const db = getFirebaseAdminDb();
    const doc: Record<string, unknown> = {
      radicadoId,
      accion,
      usuarioUid: usuario.uid,
      rol:        usuario.rol,
      tenantId:   usuario.tenantId,
      util,
      fecha: new Date().toISOString(),
    };
    if (motivo)      doc.motivo      = motivo;
    if (comentario)  doc.comentario  = comentario.trim().slice(0, 500);
    if (auditoriaId) doc.auditoriaId = auditoriaId;

    const ref = await db.collection('simi_feedback').add(doc);
    return NextResponse.json({ ok: true, feedbackId: ref.id });
  } catch (err) {
    console.error('[simi/feedback]', err);
    return NextResponse.json(
      { error: 'No se pudo guardar el feedback.' },
      { status: 500 },
    );
  }
}
