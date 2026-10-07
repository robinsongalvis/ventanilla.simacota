import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import { canReadTenant } from '@/lib/server/internal-auth';
import { getRadicadoOrFail, RadicadoActionError } from '@/lib/server/radicados-security';
import { logError } from '@/lib/logger';

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

export async function POST(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;

  // La entrada HTTP requiere validación antes de formar referencias Firestore.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  const { radicadoId, accion, util, motivo, comentario, auditoriaId } = payload as Record<string, unknown>;

  if (
    typeof radicadoId !== 'string' || !radicadoId.trim() || radicadoId.includes('/')
    || radicadoId === '.' || radicadoId === '..' || Buffer.byteLength(radicadoId) > 1500
    || typeof accion !== 'string' || !accion.trim() || typeof util !== 'boolean'
    || (motivo !== undefined && typeof motivo !== 'string')
    || (comentario !== undefined && typeof comentario !== 'string')
    || (auditoriaId !== undefined && (
      typeof auditoriaId !== 'string' || !auditoriaId.trim() || auditoriaId.includes('/')
      || auditoriaId === '.' || auditoriaId === '..' || Buffer.byteLength(auditoriaId) > 1500
    ))
  ) {
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
    const radicado = await getRadicadoOrFail(radicadoId);
    const tenantId = radicado.clasificacion.oficinaDestino;
    if (!canReadTenant(usuario, tenantId)) {
      return NextResponse.json({ error: 'No tiene permiso para evaluar este radicado.' }, { status: 403 });
    }
    const db = getFirebaseAdminDb();
    if (auditoriaId) {
      const auditoria = await db.doc(`simi_auditoria/${auditoriaId}`).get();
      if (!auditoria.exists) {
        return NextResponse.json({ error: 'Auditoría no encontrada.' }, { status: 404 });
      }
      if (auditoria.data()?.radicadoId !== radicadoId) {
        return NextResponse.json({ error: 'La auditoría no corresponde al radicado indicado.' }, { status: 403 });
      }
    }
    const doc: Record<string, unknown> = {
      radicadoId,
      accion,
      usuarioUid: usuario.uid,
      rol:        usuario.rol,
      tenantId,
      util,
      fecha: new Date().toISOString(),
    };
    if (motivo)      doc.motivo      = motivo;
    if (comentario)  doc.comentario  = comentario.trim().slice(0, 500);
    if (auditoriaId) doc.auditoriaId = auditoriaId;

    const ref = await db.collection('simi_feedback').add(doc);
    return NextResponse.json({ ok: true, feedbackId: ref.id });
  } catch (err) {
    if (err instanceof RadicadoActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logError({ radicadoId, modulo: 'simi/feedback', error: err });
    return NextResponse.json(
      { error: 'No se pudo guardar el feedback.' },
      { status: 500 },
    );
  }
}
