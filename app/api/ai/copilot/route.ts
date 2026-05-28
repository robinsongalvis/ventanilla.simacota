import { NextResponse } from 'next/server';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { construirContextoAgente } from '@/lib/ai/context-engine';
import { invocarCopilotoEspecializado } from '@/lib/ai/agents';
import { registrarLogIA } from '@/lib/ai/telemetry';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export async function POST(request: Request) {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

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

    // 2. Consultar el resto de radicados para promedios históricos de dependencias
    const querySnapshot = await getDocs(collection(db, 'ventanilla_radicados'));
    const todosLosRadicados = querySnapshot.docs.map((d) => d.data() as VentanillaRadicado);

    // 3. Consultar las auditorías acumuladas en 'ai_auditoria' para calcular fricción de overrides
    const auditSnapshot = await getDocs(collection(db, 'ai_auditoria'));
    const todosLosAudits = auditSnapshot.docs.map((d) => d.data());

    // 4. Construir el payload de contexto unificado del Radicado (AI Context Engine)
    const contexto = construirContextoAgente(radicadoData, todosLosRadicados, todosLosAudits);

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
