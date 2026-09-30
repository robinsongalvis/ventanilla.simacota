import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/ai/rate-limit';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import { canReadTenant } from '@/lib/server/internal-auth';
import { getRadicadoOrFail, RadicadoActionError } from '@/lib/server/radicados-security';
import { logError } from '@/lib/logger';

const PUNTUACIONES_VALIDAS = new Set(['POSITIVO', 'CORREGIDO', 'NEGATIVO']);

export async function POST(request: Request) {
  /* PT-3 (24-ago-2026): esta era la ÚNICA ruta /api/ai que escribía estado
     de negocio SIN sesión — un anónimo de internet que derivara un
     radicadoId (formato público) podía sembrar feedbackIa en un radicado
     real y contaminar ai_feedback/ai_auditoria sin actor atribuible. La
     sesión va ANTES del rate limit: a un no autenticado no se le regala
     ni el conteo de la ventana. El actor sale de la sesión, no del body —
     un evaluador no puede firmar como otro. */
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  const limite = { maxRequests: 30, windowMs: 60_000 };
  const ip = getClientIp(request);
  const bloqueado = checkRateLimit(`ai:feedback:${ip}`, limite);

  if (bloqueado) {
    return NextResponse.json(
      { error: 'Se recibieron muchas evaluaciones seguidas. Espere un momento e intente nuevamente.' },
      {
        status: 429,
        headers: rateLimitHeaders(limite.maxRequests, bloqueado.retryAfterSeconds),
      },
    );
  }

  // La entrada HTTP no es confiable: se valida antes de construir rutas Firestore.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const {
    radicadoId,
    puntuacion, // 'POSITIVO' | 'CORREGIDO' | 'NEGATIVO'
    motivoCorreccion,
    clasificacionOriginal,
    clasificacionFinal,
    etiquetasIA,
    etiquetasFinales,
    resumenIA,
    resumenEditado,
    confianzaIA,
  } = payload as Record<string, unknown>;

  if (
    typeof radicadoId !== 'string' || !radicadoId.trim() || radicadoId.includes('/')
    || radicadoId === '.' || radicadoId === '..' || Buffer.byteLength(radicadoId) > 1500
    || typeof puntuacion !== 'string' || !PUNTUACIONES_VALIDAS.has(puntuacion)
  ) {
    return NextResponse.json(
      { error: 'Se requiere un radicadoId válido y una puntuación POSITIVO, CORREGIDO o NEGATIVO.' },
      { status: 400 }
    );
  }

  try {
    const radicado = await getRadicadoOrFail(radicadoId);
    const tenantId = radicado.clasificacion.oficinaDestino;
    if (!canReadTenant(usuario, tenantId)) {
      return NextResponse.json({ error: 'No tiene permiso para evaluar este radicado.' }, { status: 403 });
    }
    // Identidad del evaluador: SIEMPRE de la sesión verificada.
    const usuarioId = usuario.uid;
    const actorNombre = usuario.nombre;

    const db = getFirebaseAdminDb();
    const ahora = new Date().toISOString();
    const feedbackRef = db.collection('ai_feedback').doc();
    const feedbackId = feedbackRef.id;
    const batch = db.batch();

    const feedbackDoc = {
      feedbackId,
      radicadoId,
      usuarioId,
      actorNombre,
      tenantId,
      puntuacion,
      motivoCorreccion: motivoCorreccion || null,
      fecha: ahora,
    };
    batch.set(feedbackRef, feedbackDoc);

    batch.update(db.doc(`ventanilla_radicados/${radicadoId}`), {
      feedbackIa: {
        usuarioId,
        actorNombre,
        tenantId,
        puntuacion,
        motivoCorreccion: motivoCorreccion || null,
        fecha: ahora,
      },
    });

    if (puntuacion === 'CORREGIDO' || clasificacionOriginal !== clasificacionFinal) {
      const auditoriaRef = db.collection('ai_auditoria').doc();
      const auditoriaId = auditoriaRef.id;
      const auditoriaDoc = {
        auditoriaId,
        radicadoId,
        tenantId,
        usuarioId,
        actorNombre,
        timestamp: ahora,
        promptVersion: 'simi-classifier-v1.0',
        clasificacionOriginal: clasificacionOriginal || null,
        clasificacionFinal: clasificacionFinal || null,
        confianzaIA: confianzaIA || null,
        resumenIA: resumenIA || null,
        resumenEditado: resumenEditado || null,
        etiquetasIA: etiquetasIA || [],
        etiquetasFinales: etiquetasFinales || [],
        accionFuncionario: puntuacion === 'CORREGIDO' ? 'MODIFICADO' : 'ACEPTADO',
        motivoCorreccion: motivoCorreccion || 'Traslado o re-enrutamiento manual.',
      };
      batch.set(auditoriaRef, auditoriaDoc);
    }

    await batch.commit();
    return NextResponse.json({ exito: true, feedbackId });
  } catch (error: unknown) {
    if (error instanceof RadicadoActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId, modulo: 'ai/feedback', error });
    return NextResponse.json(
      { error: 'Error al registrar feedback de IA.' },
      { status: 500 }
    );
  }
}
