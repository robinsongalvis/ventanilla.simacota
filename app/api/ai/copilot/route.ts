import { NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, rateLimitHeaders } from '@/lib/ai/rate-limit';
import { construirContextoAgente } from '@/lib/ai/context-engine';
import { invocarCopilotoEspecializado } from '@/lib/ai/agents';
import { registrarLogIA } from '@/lib/ai/telemetry';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';

async function verificarSesionInterna(request: Request): Promise<DecodedIdToken | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = cookieHeader.split(';').map((item) => item.trim());
  const sessionCookie = cookies
    .find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (!sessionCookie) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists || snap.data()?.activo === false) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  const sesion = await verificarSesionInterna(request);

  if (!sesion) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const limite = { maxRequests: 20, windowMs: 60_000 };
  const bloqueado = checkRateLimit(`ai:copilot:${sesion.uid}`, limite);

  if (bloqueado) {
    return NextResponse.json(
      { error: 'Ha realizado muchas consultas al Copiloto IA. Espere un momento e intente nuevamente.' },
      {
        status: 429,
        headers: rateLimitHeaders(limite.maxRequests, bloqueado.retryAfterSeconds),
      },
    );
  }

  try {
    const { radicadoId } = await request.json();

    if (!radicadoId) {
      return NextResponse.json(
        { error: 'El parámetro radicadoId es requerido.' },
        { status: 400 }
      );
    }

    const db = getDb();

    // 1. Consultar el radicado específico en 'ventanilla_radicados'
    const radDocRef = doc(db, 'ventanilla_radicados', radicadoId);
    const radDocSnap = await getDoc(radDocRef);

    if (!radDocSnap.exists()) {
      return NextResponse.json(
        { error: `El radicado con ID ${radicadoId} no existe en el sistema.` },
        { status: 404 }
      );
    }

    const radicadoData = radDocSnap.data() as VentanillaRadicado;
    const trazSnap = await getDocs(collection(db, 'ventanilla_radicados', radicadoId, 'trazabilidad'));
    const trazabilidad = trazSnap.docs
      .map((d) => d.data() as TrazabilidadRadicado)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // 2. Consultar el resto de radicados para promedios históricos de dependencias
    const querySnapshot = await getDocs(collection(db, 'ventanilla_radicados'));
    const todosLosRadicados = querySnapshot.docs.map((d) => d.data() as VentanillaRadicado);

    // 3. Consultar las auditorías acumuladas en 'ai_auditoria' para calcular fricción de overrides
    const auditSnapshot = await getDocs(collection(db, 'ai_auditoria'));
    const todosLosAudits = auditSnapshot.docs.map((d) => d.data());

    // 4. Construir el payload de contexto unificado del Radicado (AI Context Engine)
    const contexto = construirContextoAgente(radicadoData, todosLosRadicados, todosLosAudits, trazabilidad);

    // 5. Invocar al copiloto especializado correspondiente según la secretaría
    const recomendacion = await invocarCopilotoEspecializado(contexto, apiKey);

    // 6. Registrar telemetría de latencias y estado de fallback
    const latenciaMs = Date.now() - start;
    await registrarLogIA({
      endpoint: 'chat', // Registrado como telemetría conversacional/agente
      latenciaMs,
      fallbackActivo: !apiKey,
      promptVersion: recomendacion.promptVersion,
    });

    return NextResponse.json(recomendacion);
  } catch (error: unknown) {
    const latenciaMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error en /api/ai/copilot:', msg);

    // Registrar log de error
    await registrarLogIA({
      endpoint: 'chat',
      latenciaMs,
      error: msg,
      fallbackActivo: !apiKey,
      promptVersion: 'copilot-agent-error',
    });

    return NextResponse.json(
      { error: 'Error al procesar la sugerencia del Copiloto IA.', detalles: msg },
      { status: 500 }
    );
  }
}
