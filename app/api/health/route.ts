import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

export async function GET() {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  const nodeVersion = process.version;
  const memoryUsage = process.memoryUsage();

  let firestoreStatus = 'unknown';
  let firestoreLatenciaMs = 0;
  let firestoreDetalles = '';

  // 1. Validar Conectividad con Firestore via Admin SDK (bypasea security rules)
  try {
    const adminDb = getFirebaseAdminDb();
    const currentYear = new Date().getFullYear();

    const dbStart = Date.now();
    await adminDb.collection('counters').doc(`radicados-${currentYear}`).get();

    firestoreLatenciaMs = Date.now() - dbStart;
    firestoreStatus = 'connected';
  } catch (error: unknown) {
    firestoreStatus = 'disconnected';
    firestoreDetalles = error instanceof Error ? error.message : String(error);
    console.error('Health Check - Falló conexión a Firestore:', firestoreDetalles);
  }

  // 2. Validar Estado del Motor de IA (Gemini)
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  const aiEngineStatus = hasApiKey ? 'active (gemini-2.5-flash)' : 'fallback (local mock classifier)';

  // 3. Estimar Estado General (Health Score)
  const isHealthy = firestoreStatus === 'connected';
  const overallStatus = isHealthy ? 'healthy' : 'degraded';
  const httpStatus = isHealthy ? 200 : 503;

  const responseBody = {
    status: overallStatus,
    timestamp,
    durationMs: Date.now() - start,
    environment: process.env.NODE_ENV || 'production',
    system: {
      uptime,
      nodeVersion,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      }
    },
    services: {
      firestore: {
        status: firestoreStatus,
        latencyMs: firestoreLatenciaMs,
        ...(firestoreDetalles ? { error: firestoreDetalles } : {})
      },
      ai_engine: {
        status: aiEngineStatus,
        configured: hasApiKey
      }
    }
  };

  return NextResponse.json(responseBody, { status: httpStatus });
}
