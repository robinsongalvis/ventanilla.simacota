import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const {
      radicadoId,
      endpoint, // 'classify' | 'chat'
      latenciaMs,
      error,
      fallbackActivo,
      promptVersion,
    } = payload;

    if (!endpoint || latenciaMs === undefined) {
      return NextResponse.json(
        { error: 'endpoint y latenciaMs son requeridos.' },
        { status: 400 }
      );
    }

    const db = getFirebaseAdminDb();
    const ahora = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const logDoc = {
      logId,
      radicadoId: radicadoId || null,
      endpoint,
      latenciaMs,
      error: error || null,
      fallbackActivo: fallbackActivo || false,
      promptVersion: promptVersion || 'unknown',
      timestamp: ahora,
    };

    await db.doc(`ai_logs/${logId}`).set(logDoc);

    return NextResponse.json({ exito: true, logId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error en /api/ai/log:', msg);
    return NextResponse.json(
      { error: 'Error al registrar log de IA.', detalles: msg },
      { status: 500 }
    );
  }
}
