import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/ai/rate-limit';

export async function POST(request: Request) {
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

  try {
    const payload = await request.json();
    const {
      radicadoId,
      usuarioId,
      actorNombre,
      puntuacion, // 'POSITIVO' | 'CORREGIDO' | 'NEGATIVO'
      motivoCorreccion,
      clasificacionOriginal,
      clasificacionFinal,
      etiquetasIA,
      etiquetasFinales,
      resumenIA,
      resumenEditado,
      confianzaIA,
    } = payload;

    if (!radicadoId || !usuarioId || !puntuacion) {
      return NextResponse.json(
        { error: 'radicadoId, usuarioId y puntuacion son requeridos.' },
        { status: 400 }
      );
    }

    const db = getFirebaseAdminDb();
    const ahora = new Date().toISOString();
    const feedbackId = `fb_${radicadoId}_${Date.now()}`;

    const feedbackDoc = {
      feedbackId,
      radicadoId,
      usuarioId,
      actorNombre: actorNombre || 'Funcionario',
      puntuacion,
      motivoCorreccion: motivoCorreccion || null,
      fecha: ahora,
    };
    await db.doc(`ai_feedback/${feedbackId}`).set(feedbackDoc);

    await db.doc(`ventanilla_radicados/${radicadoId}`).update({
      feedbackIa: {
        usuarioId,
        actorNombre: actorNombre || 'Funcionario',
        puntuacion,
        motivoCorreccion: motivoCorreccion || null,
        fecha: ahora,
      },
    });

    if (puntuacion === 'CORREGIDO' || clasificacionOriginal !== clasificacionFinal) {
      const auditoriaId = `aud_${radicadoId}_${Date.now()}`;
      const auditoriaDoc = {
        auditoriaId,
        radicadoId,
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
      await db.doc(`ai_auditoria/${auditoriaId}`).set(auditoriaDoc);
    }

    return NextResponse.json({ exito: true, feedbackId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error en /api/ai/feedback:', msg);
    return NextResponse.json(
      { error: 'Error al registrar feedback de IA.', detalles: msg },
      { status: 500 }
    );
  }
}
