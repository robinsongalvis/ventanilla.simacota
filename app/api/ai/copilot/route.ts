import { NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import { canReadTenant } from '@/lib/server/internal-auth';
import { getRadicadoOrFail, RadicadoActionError } from '@/lib/server/radicados-security';
import { checkRateLimit, rateLimitHeaders } from '@/lib/ai/rate-limit';
import { construirContextoAgente } from '@/lib/ai/context-engine';
import { invocarCopilotoEspecializado } from '@/lib/ai/agents';
import { registrarLogIA } from '@/lib/ai/telemetry';
import { esDatoDePrueba, soloOperacionReal } from '@/lib/radicados/dato-de-prueba';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';

export async function POST(request: Request) {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  const autenticacion = await autenticarUsuarioInterno();

  if (!autenticacion.ok) return autenticacion.respuesta;
  const sesion = autenticacion.usuario;

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

    if (typeof radicadoId !== 'string' || !radicadoId.trim() || radicadoId.includes('/')) {
      return NextResponse.json(
        { error: 'El parámetro radicadoId es requerido.' },
        { status: 400 }
      );
    }

    // Autorizar ANTES de recopilar contexto o invocar cualquier proveedor IA.
    const radicadoData = await getRadicadoOrFail(radicadoId);
    if (!canReadTenant(sesion, radicadoData.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Sin acceso a este radicado.' }, { status: 403 });
    }
    if (esDatoDePrueba(radicadoData)) {
      return NextResponse.json({ error: 'Radicado no disponible para operación.' }, { status: 404 });
    }
    const db = getDb();
    const trazSnap = await getDocs(collection(db, 'ventanilla_radicados', radicadoId, 'trazabilidad'));
    const trazabilidad = trazSnap.docs
      .map((d) => d.data() as TrazabilidadRadicado)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // 2. Consultar el resto de radicados para promedios históricos de dependencias
    const querySnapshot = await getDocs(query(collection(db, 'ventanilla_radicados'),
      where('clasificacion.oficinaDestino', '==', radicadoData.clasificacion.oficinaDestino)));
    const todosLosRadicados = soloOperacionReal(
      querySnapshot.docs.map((d) => d.data() as VentanillaRadicado),
    );

    // 3. Consultar las auditorías acumuladas en 'ai_auditoria' para calcular fricción de overrides
    const auditSnapshot = await getDocs(query(collection(db, 'ai_auditoria'),
      where('radicadoId', '==', radicadoId)));
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
    if (error instanceof RadicadoActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
      { error: 'Error al procesar la sugerencia del Copiloto IA.' },
      { status: 500 }
    );
  }
}
