import { NextResponse }          from 'next/server';
import { cookies }               from 'next/headers';
import { SESSION_COOKIE_NAME }   from '@/lib/auth-cookie';
import {
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from '@/lib/firebase-admin';
import type { VentanillaRadicado, TrazabilidadRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import type { RolInterno } from '@/lib/hooks/useAuth';
import { SIMI_PROMPT_MAESTRO } from '@/lib/simi/prompt-institucional';
import { construirContextoSimi } from '@/lib/simi/contexto-radicado';
import {
  ACCIONES_SIMI_VALIDAS,
  instruccionParaAccion,
  pareceSalidaTruncada,
  requiereEstructuraCompleta,
  type AccionSimi,
} from '@/lib/simi/instrucciones-acciones';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   POST /api/simi/radicado

   Endpoint principal del asistente SIMI para funcionarios.
   Combina:
   - Prompt maestro institucional (lib/simi/prompt-institucional).
   - Contexto sanitizado del radicado (lib/simi/contexto-radicado),
     que incluye evaluación automática de competencia.
   - Instrucción por acción (lib/simi/instrucciones-acciones).
   - Llamada a Gemini con maxOutputTokens elevado.
   - Detección de truncamiento + auditoría persistida.

   Devuelve también la evaluación de competencia para que la UI
   la muestre directamente sin esperar la salida del modelo.
══════════════════════════════════════════════════════════════ */

interface SimiPayload {
  radicadoId:          string;
  accion:              AccionSimi;
  mensajeUsuario?:     string;
  respuestaBorrador?:  string;
  /** Texto previo de SIMI cuando la acción es CONTINUAR_RESPUESTA. */
  ultimaSalidaPrevia?: string;
}

async function verificarSesion(): Promise<{
  uid: string; nombre: string; rol: RolInterno; tenantId: TenantId;
} | null> {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, false);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
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

function puedeAccederRadicado(
  usuario: { rol: RolInterno; tenantId: TenantId },
  radicado: VentanillaRadicado,
): boolean {
  if (usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO') return true;
  return radicado.clasificacion.oficinaDestino === usuario.tenantId;
}

interface GeminiResultado {
  texto:        string;
  finishReason: string | null;
  modelo:       string;
}

async function llamarGemini(
  systemPrompt: string,
  userPrompt: string,
  accion: AccionSimi,
): Promise<GeminiResultado> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      texto: '[SIMI no disponible — GEMINI_API_KEY no configurada en el entorno.]',
      finishReason: 'NO_API_KEY',
      modelo: 'mock',
    };
  }

  const modelo = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  // Acciones que requieren estructura completa o redactan oficio: más espacio.
  const maxOutputTokens = requiereEstructuraCompleta(accion) ? 4096 : 1536;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature:      0.25,
        maxOutputTokens,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidato     = data.candidates?.[0];
  const texto         = candidato?.content?.parts?.[0]?.text ?? '';
  const finishReason  = candidato?.finishReason ?? null;

  if (!texto) {
    throw new Error('Gemini devolvió respuesta vacía.');
  }

  return { texto, finishReason, modelo };
}

export async function POST(request: Request): Promise<NextResponse> {
  const inicio = Date.now();
  const usuario = await verificarSesion();
  if (!usuario) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let payload: SimiPayload;
  try {
    payload = await request.json() as SimiPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const { radicadoId, accion, mensajeUsuario, respuestaBorrador, ultimaSalidaPrevia } = payload;

  if (!radicadoId || !accion) {
    return NextResponse.json({ error: 'Campos requeridos: radicadoId, accion.' }, { status: 400 });
  }
  if (!ACCIONES_SIMI_VALIDAS.has(accion)) {
    return NextResponse.json({ error: `Acción inválida: ${accion}` }, { status: 400 });
  }
  if (accion === 'CONTINUAR_RESPUESTA' && !ultimaSalidaPrevia?.trim()) {
    return NextResponse.json(
      { error: 'CONTINUAR_RESPUESTA requiere ultimaSalidaPrevia.' },
      { status: 400 },
    );
  }
  if (
    (accion === 'MEJORAR_RESPUESTA' || accion === 'VERIFICAR_CALIDAD' || accion === 'VALIDAR_RESPUESTA')
    && !respuestaBorrador?.trim()
  ) {
    return NextResponse.json(
      { error: `${accion} requiere respuestaBorrador con la respuesta del funcionario.` },
      { status: 400 },
    );
  }

  const db = getFirebaseAdminDb();

  const radSnap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
  if (!radSnap.exists) {
    return NextResponse.json({ error: 'Radicado no encontrado.' }, { status: 404 });
  }
  const radicado = radSnap.data() as VentanillaRadicado;

  if (!puedeAccederRadicado(usuario, radicado)) {
    return NextResponse.json(
      { error: 'No tienes permiso para consultar este radicado.' },
      { status: 403 },
    );
  }

  const trazSnap = await db
    .collection(`ventanilla_radicados/${radicadoId}/trazabilidad`)
    .orderBy('fecha', 'asc')
    .limit(40)
    .get();
  const trazabilidad = trazSnap.docs.map((d) => d.data() as TrazabilidadRadicado);

  // Contexto sanitizado + evaluación de competencia
  const contexto = construirContextoSimi({
    radicado,
    trazabilidad,
    usuario: { rol: usuario.rol, tenantId: usuario.tenantId, nombre: usuario.nombre },
  });

  const instruccion = instruccionParaAccion({
    accion,
    mensajeUsuario,
    respuestaBorrador,
    ultimaSalidaPrevia,
  });

  const userPrompt = `${contexto.bloqueTexto}\n\n${instruccion}`;

  try {
    const { texto, finishReason, modelo } = await llamarGemini(SIMI_PROMPT_MAESTRO, userPrompt, accion);
    const truncadoPorTokens = finishReason === 'MAX_TOKENS';
    const truncadoHeuristica = pareceSalidaTruncada(texto);
    const truncado = truncadoPorTokens || truncadoHeuristica;

    // Advertencias contextuales para la UI
    const advertencias: string[] = [];
    if (contexto.meta.estadoTermino === 'VENCIDO') {
      advertencias.push(`Este radicado está VENCIDO hace ${Math.abs(contexto.meta.diasRestantes)} días hábiles.`);
    } else if (contexto.meta.estadoTermino === 'POR_VENCER') {
      advertencias.push(`Este radicado vence en ${contexto.meta.diasRestantes} día(s) hábil(es).`);
    }
    if (contexto.meta.responsable === 'No asignado') {
      advertencias.push('No hay funcionario responsable asignado.');
    }
    if (contexto.meta.evaluacionCompetencia.requiereEscalamiento) {
      advertencias.push(`Posible reasignación: ${contexto.meta.evaluacionCompetencia.razon}`);
    }
    if (contexto.meta.evaluacionCompetencia.requiereRevisionJuridica) {
      advertencias.push('La solicitud sugiere riesgo jurídico — recomendable validación jurídica antes de responder.');
    }
    if (truncado) {
      advertencias.push('La respuesta parece haberse cortado. Puedes pedir "Continuar respuesta".');
    }

    const fuentesUsadas = [
      `Radicado ${radicadoId}`,
      `Trazabilidad: ${contexto.trazabilidadResumida.length} eventos resumidos`,
      `Dependencia: ${contexto.meta.dependenciaActual}`,
      `Competencia: ${contexto.meta.evaluacionCompetencia.nivelConfianza}`,
    ];

    // Auditoría persistida (await — ya no fire-and-forget)
    const auditoriaId = await db.collection('simi_auditoria').add({
      actorUid:    usuario.uid,
      actorNombre: usuario.nombre,
      actorRol:    usuario.rol,
      tenantId:    usuario.tenantId,
      radicadoId,
      dependenciaRadicado: contexto.meta.dependenciaActual,
      accion,
      fecha:       new Date().toISOString(),
      modelo,
      finishReason,
      truncado,
      latenciaMs:  Date.now() - inicio,
      resumenEntrada: instruccion.slice(0, 300),
      resumenSalida:  texto.slice(0, 300),
      evaluacionCompetenciaNivel: contexto.meta.evaluacionCompetencia.nivelConfianza,
    }).then((ref) => ref.id).catch(() => null);

    return NextResponse.json({
      ok: true,
      accion,
      resultado: texto,
      truncado,
      finishReason,
      advertencias,
      fuentesUsadas,
      competenciaEvaluada: contexto.meta.evaluacionCompetencia,
      auditoriaId,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[simi/radicado] Error:', msg);

    // Registrar el fallo en auditoría
    await db.collection('simi_auditoria').add({
      actorUid:    usuario.uid,
      actorNombre: usuario.nombre,
      actorRol:    usuario.rol,
      tenantId:    usuario.tenantId,
      radicadoId,
      dependenciaRadicado: contexto.meta.dependenciaActual,
      accion,
      fecha:       new Date().toISOString(),
      modelo:      'gemini-2.5-flash',
      latenciaMs:  Date.now() - inicio,
      error:       msg.slice(0, 500),
    }).catch(() => {});

    return NextResponse.json(
      {
        error: 'SIMI no pudo completar la respuesta en este momento. Puedes intentar nuevamente o continuar editando manualmente.',
        detalle: msg.slice(0, 200),
      },
      { status: 502 },
    );
  }
}
