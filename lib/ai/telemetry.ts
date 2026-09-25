import { getFirebaseAdminDb } from '@/lib/firebase-admin';

interface LogAiParams {
  radicadoId?: string;
  endpoint: 'classify' | 'chat' | 'scan-doc';
  latenciaMs: number;
  error?: string | null;
  fallbackActivo?: boolean;
  promptVersion?: string;
}

export async function registrarLogIA({
  radicadoId,
  endpoint,
  latenciaMs,
  error = null,
  fallbackActivo = false,
  promptVersion = 'unknown',
}: LogAiParams) {
  try {
    const db = getFirebaseAdminDb();
    const ahora = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const logDoc = {
      logId,
      radicadoId: radicadoId || null,
      endpoint,
      latenciaMs,
      error,
      fallbackActivo,
      promptVersion,
      timestamp: ahora,
    };

    await db.doc(`ai_logs/${logId}`).set(logDoc);
  } catch (err) {
    console.error('Error al registrar log de IA en telemetría:', err);
  }
}
