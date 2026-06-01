import { NextResponse }          from 'next/server';
import { cookies }               from 'next/headers';
import { SESSION_COOKIE_NAME }   from '@/lib/auth-cookie';
import {
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from '@/lib/firebase-admin';
import { DIRECTORIO_TENANTS, NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import type { VentanillaRadicado, TrazabilidadRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import type { RolInterno } from '@/lib/hooks/useAuth';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

type AccionSimi =
  | 'RESUMIR_RADICADO'
  | 'EXPLICAR_ESTADO'
  | 'REVISAR_TERMINO'
  | 'SUGERIR_DEPENDENCIA'
  | 'SUGERIR_RESPUESTA'
  | 'VALIDAR_RESPUESTA'
  | 'GENERAR_BORRADOR_OFICIO'
  | 'RESUMIR_TRAZABILIDAD';

const ACCIONES_VALIDAS = new Set<AccionSimi>([
  'RESUMIR_RADICADO', 'EXPLICAR_ESTADO', 'REVISAR_TERMINO',
  'SUGERIR_DEPENDENCIA', 'SUGERIR_RESPUESTA', 'VALIDAR_RESPUESTA',
  'GENERAR_BORRADOR_OFICIO', 'RESUMIR_TRAZABILIDAD',
]);

interface SimiPayload {
  radicadoId:         string;
  accion:             AccionSimi;
  mensajeUsuario?:    string;
  respuestaBorrador?: string;
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

async function verificarSesion(): Promise<{
  uid: string; nombre: string; rol: RolInterno; tenantId: TenantId;
} | null> {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
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

/* ══════════════════════════════════════════════════════════════
   PROMPT BUILDER
══════════════════════════════════════════════════════════════ */

function buildPrompt(params: {
  accion:    AccionSimi;
  radicado:  VentanillaRadicado;
  trazabilidad: TrazabilidadRadicado[];
  usuario:   { nombre: string; rol: RolInterno; tenantId: TenantId };
  diasRestantes: number;
  mensajeUsuario?: string;
  respuestaBorrador?: string;
}): string {
  const { accion, radicado: r, trazabilidad, usuario, diasRestantes } = params;
  const depNombre = NOMBRES_TENANT[r.clasificacion.oficinaDestino] ?? r.clasificacion.oficinaDestino;
  const respNombre = r.clasificacion.funcionarioResponsableNombre ?? 'No asignado';

  const contexto = `
CONTEXTO DEL RADICADO:
- Número: ${r.radicadoId}
- Solicitante: ${r.solicitante.nombreCompleto} (${r.solicitante.tipoDocumento} ${r.solicitante.numeroDocumento})
- Email ciudadano: ${r.solicitante.email ?? 'No proporcionado'}
- Asunto: ${r.detalle.asunto}
- Descripción: ${r.detalle.descripcion}
- Tipo solicitud: ${r.termino.tipoSolicitudNombre} (${r.termino.diasRespuesta} días ${r.termino.unidad.toLowerCase()})
- Estado actual: ${r.estadoActual}
- Dependencia asignada: ${depNombre}
- Responsable funcional: ${respNombre}
- Fecha radicación: ${r.control.fechaRadicado}
- Fecha vencimiento: ${r.termino.fechaVencimiento}
- Días hábiles restantes: ${diasRestantes} ${diasRestantes < 0 ? '(VENCIDO)' : diasRestantes <= 2 ? '(PRÓXIMO A VENCER)' : ''}
- Prórrogas aplicadas: ${r.termino.prorrogasAplicadas}
- Archivos adjuntos: ${r.archivos.length > 0 ? r.archivos.map(a => a.nombre).join(', ') : 'Ninguno'}
${r.respuestaOficial ? `- Respuesta registrada: ${r.respuestaOficial.nota}\n- Oficio: ${r.respuestaOficial.archivoNombre ?? 'Sin oficio'}` : '- Sin respuesta aún'}

TRAZABILIDAD (${trazabilidad.length} eventos):
${trazabilidad.slice(0, 10).map(t => `  ${t.fecha.slice(0, 10)} | ${t.accion} | ${t.actorNombre} | ${t.nota}`).join('\n')}

USUARIO QUE CONSULTA:
- Nombre: ${usuario.nombre}
- Rol: ${usuario.rol}
- Dependencia: ${NOMBRES_TENANT[usuario.tenantId] ?? usuario.tenantId}
`.trim();

  const instrucciones: Record<AccionSimi, string> = {
    RESUMIR_RADICADO: 'Genera un resumen ejecutivo del radicado. Incluye: quién lo presentó, qué solicita, cuándo fue radicado, a qué dependencia fue asignado, y cuál es su estado actual. Máximo 200 palabras.',
    EXPLICAR_ESTADO: 'Explica el estado actual del radicado en lenguaje institucional claro. Indica qué significa este estado, qué acciones se esperan, y quién es responsable. Si está vencido o próximo a vencer, destácalo.',
    REVISAR_TERMINO: 'Analiza el cumplimiento del término legal. Indica: fecha de radicación, fecha de vencimiento, días hábiles restantes, si hay prórrogas, y recomendaciones para cumplir el plazo. Si está vencido, indica las implicaciones MIPG.',
    SUGERIR_DEPENDENCIA: 'Basándote en el asunto y la descripción de la solicitud, sugiere cuál dependencia debería atender este caso. Justifica brevemente. Lista las dependencias posibles y la más adecuada.',
    SUGERIR_RESPUESTA: `Sugiere una respuesta preliminar para esta solicitud. La respuesta debe ser institucional, respetuosa y completa. ${params.mensajeUsuario ? `\nIndicación adicional del funcionario: ${params.mensajeUsuario}` : ''}\nIMPORTANTE: Esto es un borrador para revisión del funcionario, NO una respuesta oficial.`,
    VALIDAR_RESPUESTA: `El funcionario ha preparado la siguiente respuesta borrador:\n"${params.respuestaBorrador ?? '(no proporcionada)'}"\n\nRevisa si esta respuesta: 1) Aborda la solicitud del ciudadano, 2) Es completa y clara, 3) Cumple con el tono institucional, 4) Incluye la información necesaria. Señala lo que falta o podría mejorarse.`,
    GENERAR_BORRADOR_OFICIO: `Genera un borrador de oficio de respuesta formal para este radicado. Debe incluir: encabezado institucional (Alcaldía Municipal de Simacota), número de radicado, datos del destinatario, cuerpo de respuesta, despedida y pie institucional. ${params.mensajeUsuario ? `\nIndicación del funcionario: ${params.mensajeUsuario}` : ''}`,
    RESUMIR_TRAZABILIDAD: 'Genera un resumen cronológico de la trazabilidad del radicado. Para cada evento relevante, explica qué ocurrió, quién lo hizo, y cuándo. Destaca tiempos entre eventos y posibles demoras.',
  };

  return `${contexto}\n\nINSTRUCCIÓN: ${instrucciones[accion]}`;
}

/* ══════════════════════════════════════════════════════════════
   GEMINI CALL
══════════════════════════════════════════════════════════════ */

async function llamarGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '[SIMI no disponible — GEMINI_API_KEY no configurada]';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[Sin respuesta del modelo]';
}

/* ══════════════════════════════════════════════════════════════
   POST /api/simi/radicado
══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Eres SIMI, asistente institucional de la Ventanilla Única Digital de la Alcaldía Municipal de Simacota, Santander, Colombia.

Debes ayudar a funcionarios públicos a comprender y gestionar radicados de manera clara, responsable y alineada con el Modelo Integrado de Planeación y Gestión (MIPG).

REGLAS ABSOLUTAS:
- No tomas decisiones oficiales.
- No envías respuestas al ciudadano.
- No modificas radicados.
- No inventas información que no esté en el contexto proporcionado.
- Solo generas análisis, resúmenes, sugerencias y borradores que deben ser revisados por un funcionario autorizado.
- Respeta el rol del usuario, la dependencia, la trazabilidad y el estado del trámite.
- Si falta información, dilo claramente.
- Usa lenguaje institucional, claro y respetuoso.
- Cuando generes borradores de oficio, indica claramente que es un BORRADOR para revisión.
- Las fechas y plazos deben seguir el calendario colombiano (días hábiles excluyen fines de semana y festivos).`;

export async function POST(request: Request): Promise<NextResponse> {
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

  const { radicadoId, accion, mensajeUsuario, respuestaBorrador } = payload;

  if (!radicadoId || !accion) {
    return NextResponse.json({ error: 'Campos requeridos: radicadoId, accion.' }, { status: 400 });
  }

  if (!ACCIONES_VALIDAS.has(accion)) {
    return NextResponse.json({ error: `Acción inválida: ${accion}` }, { status: 400 });
  }

  const db = getFirebaseAdminDb();

  // Cargar radicado
  const radSnap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
  if (!radSnap.exists) {
    return NextResponse.json({ error: 'Radicado no encontrado.' }, { status: 404 });
  }
  const radicado = radSnap.data() as VentanillaRadicado;

  // Verificar acceso por rol/tenant
  if (!puedeAccederRadicado(usuario, radicado)) {
    return NextResponse.json(
      { error: 'No tienes permiso para consultar este radicado.' },
      { status: 403 },
    );
  }

  // Cargar trazabilidad
  const trazSnap = await db
    .collection(`ventanilla_radicados/${radicadoId}/trazabilidad`)
    .orderBy('fecha', 'asc')
    .limit(20)
    .get();
  const trazabilidad = trazSnap.docs.map(d => d.data() as TrazabilidadRadicado);

  const diasRestantes = diasRestantesHabiles(radicado.termino.fechaVencimiento);

  // Construir prompt y llamar a Gemini
  try {
    const userPrompt = buildPrompt({
      accion, radicado, trazabilidad, usuario, diasRestantes,
      mensajeUsuario, respuestaBorrador,
    });

    const resultado = await llamarGemini(SYSTEM_PROMPT, userPrompt);

    // Advertencias contextuales
    const advertencias: string[] = [];
    if (diasRestantes < 0) advertencias.push(`Este radicado está VENCIDO hace ${Math.abs(diasRestantes)} días hábiles.`);
    else if (diasRestantes <= 2) advertencias.push(`Este radicado vence en ${diasRestantes} día(s) hábil(es).`);
    if (!radicado.clasificacion.funcionarioResponsableNombre) advertencias.push('No hay funcionario responsable asignado.');

    // Fuentes usadas
    const fuentesUsadas = [
      `Radicado ${radicadoId}`,
      `Trazabilidad: ${trazabilidad.length} eventos`,
      `Dependencia: ${NOMBRES_TENANT[radicado.clasificacion.oficinaDestino] ?? radicado.clasificacion.oficinaDestino}`,
    ];

    // Auditoría
    await db.collection('simi_auditoria').add({
      actorUid:    usuario.uid,
      actorNombre: usuario.nombre,
      actorRol:    usuario.rol,
      tenantId:    usuario.tenantId,
      radicadoId,
      accion,
      fecha:       new Date().toISOString(),
      modelo:      'gemini-2.5-flash',
      resultadoResumen: resultado.slice(0, 200),
    }).catch(() => {}); // Fire-and-forget

    return NextResponse.json({
      ok: true,
      accion,
      resultado,
      advertencias: advertencias.length > 0 ? advertencias : undefined,
      fuentesUsadas,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[simi/radicado] Error:', msg);
    return NextResponse.json({ error: 'Error al procesar la consulta SIMI.' }, { status: 500 });
  }
}
