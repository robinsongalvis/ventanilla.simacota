/**
 * POST /api/simi/juridico
 * Módulo SIMI Jurídico-Administrativo — Ventanilla Única de Simacota
 *
 * Requiere sesión de funcionario válida.
 * No reemplaza al abogado ni al funcionario competente.
 * Todo resultado es un borrador sujeto a revisión humana.
 */

import { NextResponse }           from 'next/server';
import { cookies }                from 'next/headers';
import { SESSION_COOKIE_NAME }    from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/ai/rate-limit';
import { callGeminiJuridico }        from '@/lib/simi-juridico/callGemini';
import { createAuditLog }            from '@/lib/simi-juridico/createAuditLog';
import { generateWithRagContext }    from '@/lib/simi-juridico/generateWithRagContext';
import { createApprovalFlow }            from '@/lib/simi-juridico/createApprovalFlow';
import type { ApprovalFlowResult }   from '@/src/types/simi-approval';
import type { RagSource }            from '@/src/types/simi-rag';
import {
  SIMI_JURIDICO_SYSTEM_PROMPT,
  buildClassifyPrompt,
  buildDraftPrompt,
  buildReviewPrompt,
  buildPlainLanguagePrompt,
  buildRiskPrompt,
  buildTransferPrompt,
  buildClarificationPrompt,
  buildPersonalDataPrompt,
} from '@/lib/simi-juridico/prompts';
import type {
  SimiJuridicoPayload,
  SimiJuridicoResponse,
  SimiModoJuridico,
  NivelRiesgoJuridico,
  SimiAnalisisJuridico,
  SimiRevisionBorrador,
  SimiLenguajeClaro,
} from '@/src/types/simi-juridico';
import type { TenantId }          from '@/src/types/radicado';
import type { RolInterno }        from '@/lib/hooks/useAuth';
import { NOMBRES_TENANT }         from '@/src/types/reglas-negocio';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';

/* ── Frase final obligatoria ── */
const FRASE_FINAL =
  'SIMI Jurídico-Administrativo analiza, orienta, proyecta y advierte riesgos, ' +
  'pero no reemplaza la revisión, aprobación ni firma del funcionario competente.';

const MODOS_VALIDOS = new Set<SimiModoJuridico>([
  'analizar_solicitud', 'proyectar_respuesta', 'revisar_borrador',
  'fundamento_normativo', 'riesgo_juridico', 'lenguaje_claro',
  'checklist_mipg', 'traslado_competencia', 'solicitud_aclaracion',
  'datos_personales', 'escalar_juridica',
]);

/* ══════════════════════════════════════════════════════════════
   VERIFICAR SESIÓN
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
      nombre:   (d.nombre as string) ?? 'Funcionario',
      rol:      (d.rol as RolInterno) ?? 'FUNCIONARIO',
      tenantId: (d.tenantId as TenantId) ?? 'VENTANILLA_UNICA',
    };
  } catch { return null; }
}

/* ══════════════════════════════════════════════════════════════
   OBTENER RADICADO
══════════════════════════════════════════════════════════════ */

async function obtenerRadicado(radicadoId: string): Promise<VentanillaRadicado | null> {
  try {
    const snap = await getFirebaseAdminDb()
      .doc(`ventanilla_radicados/${radicadoId}`)
      .get();
    if (!snap.exists) return null;
    return snap.data() as VentanillaRadicado;
  } catch { return null; }
}

function formatRadicadoContext(r: VentanillaRadicado): string {
  return [
    `Radicado: ${r.radicadoId}`,
    `Estado: ${r.estadoActual}`,
    `Tipo solicitud: ${r.termino.tipoSolicitudNombre}`,
    `Dependencia: ${NOMBRES_TENANT[r.clasificacion.oficinaDestino] ?? r.clasificacion.oficinaDestino}`,
    `Fecha radicado: ${r.control.fechaRadicado}`,
    `Fecha vencimiento: ${r.termino.fechaVencimiento}`,
    `Solicitante: ${r.esAnonimo ? 'Anónimo' : r.solicitante.nombreCompleto}`,
    `Asunto: ${r.detalle.asunto}`,
  ].join('\n');
}

/* ══════════════════════════════════════════════════════════════
   HANDLER PRINCIPAL
══════════════════════════════════════════════════════════════ */

export async function POST(request: Request): Promise<NextResponse> {
  /* 1. Rate limiting */
  const ip = getClientIp(request);
  const limite = { maxRequests: 20, windowMs: 60_000 };
  const bloqueado = checkRateLimit(`simi-juridico:${ip}`, limite);
  if (bloqueado) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Espere un momento e intente de nuevo.' },
      { status: 429, headers: rateLimitHeaders(limite.maxRequests, bloqueado.retryAfterSeconds) },
    );
  }

  /* 2. Autenticación */
  const usuario = await verificarSesion();
  if (!usuario) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  /* 3. Parsear payload */
  let payload: SimiJuridicoPayload;
  try {
    payload = await request.json() as SimiJuridicoPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const {
    radicadoId, modo, textoSolicitud, borrador, contexto,
    useRag = false, createApproval = false,
  } = payload as typeof payload & { useRag?: boolean; createApproval?: boolean };

  if (!radicadoId || !modo || !MODOS_VALIDOS.has(modo)) {
    return NextResponse.json(
      { error: 'Parámetros requeridos: radicadoId y modo válido.' },
      { status: 400 },
    );
  }

  /* 4. Obtener radicado */
  const radicado = await obtenerRadicado(radicadoId);
  if (!radicado) {
    return NextResponse.json({ error: 'Radicado no encontrado.' }, { status: 404 });
  }

  /* 5. Verificar acceso al radicado */
  const tieneAcceso =
    usuario.rol === 'ADMIN' ||
    usuario.rol === 'CONTROL_INTERNO' ||
    radicado.clasificacion.oficinaDestino === usuario.tenantId;
  if (!tieneAcceso) {
    return NextResponse.json({ error: 'Sin acceso a este radicado.' }, { status: 403 });
  }

  /* 6. Determinar texto de solicitud */
  const textoBase = textoSolicitud || radicado.detalle.descripcion || radicado.detalle.asunto;
  const datosRadicado = formatRadicadoContext(radicado);
  const dependencia = NOMBRES_TENANT[radicado.clasificacion.oficinaDestino] ?? radicado.clasificacion.oficinaDestino;

  /* 7. Ejecutar el modo solicitado */
  let resultadoBruto: unknown;
  let nivelRiesgo: NivelRiesgoJuridico | null = null;
  let advertencias: string[] = [];
  let requiereRevisionJuridica = false;
  let fuentesRag: RagSource[] = [];
  let approvalResult: ApprovalFlowResult | null = null;

  /* Helper RAG: llama con contexto o sin él según `useRag` */
  const usuarioActual = usuario;        // captura para closure tipado
  const radicadoActual = radicado;      // captura para closure tipado
  async function invocarGemini<T>(userPrompt: string, expectJson: boolean): Promise<T> {
    if (useRag) {
      const rag = await generateWithRagContext<T>({
        userPrompt,
        expectJson,
        ragParams: {
          tenantId:       usuarioActual.tenantId,
          query:          textoBase,
          dependencia,
          tipoSolicitud:  radicadoActual.termino.tipoSolicitudNombre,
          modo,
          maxResults:     6,
        },
      });
      fuentesRag    = rag.fuentesUsadas;
      advertencias  = [...advertencias, ...rag.advertencias];
      return rag.resultado;
    }
    return callGeminiJuridico<T>({ systemPrompt: SIMI_JURIDICO_SYSTEM_PROMPT, userPrompt, expectJson });
  }

  try {
    switch (modo) {

      case 'analizar_solicitud': {
        const userPrompt = buildClassifyPrompt({
          textoSolicitud: textoBase,
          datosRadicado,
        });
        resultadoBruto = await invocarGemini<SimiAnalisisJuridico>(userPrompt, true);
        const r = resultadoBruto as SimiAnalisisJuridico;
        nivelRiesgo = r.nivelRiesgo ?? 'medio';
        requiereRevisionJuridica = r.requiereRevisionJuridica ?? false;
        if (r.advertenciasPersonalData?.length) {
          advertencias = [...advertencias, ...r.advertenciasPersonalData];
        }
        if (nivelRiesgo === 'alto') {
          advertencias.push('Este caso requiere revisión jurídica obligatoria antes de emitir respuesta oficial.');
        }
        break;
      }

      case 'proyectar_respuesta': {
        if (!textoBase) {
          return NextResponse.json({ error: 'Se requiere texto de la solicitud.' }, { status: 400 });
        }
        const draftPrompt = buildDraftPrompt({ textoSolicitud: textoBase, datosRadicado, dependencia, contexto });
        resultadoBruto = await invocarGemini<string>(draftPrompt, false);
        nivelRiesgo = 'medio';
        advertencias = [...advertencias, 'Borrador generado. Debe revisarse, ajustarse y aprobarse antes del envío oficial.', 'Validar fundamento normativo antes de firma.'];
        requiereRevisionJuridica = true;
        break;
      }

      case 'revisar_borrador': {
        if (!borrador?.trim()) {
          return NextResponse.json({ error: 'Se requiere el texto del borrador a revisar.' }, { status: 400 });
        }
        resultadoBruto = await invocarGemini<SimiRevisionBorrador>(buildReviewPrompt(borrador), true);
        const rv = resultadoBruto as SimiRevisionBorrador;
        nivelRiesgo = rv.nivelRiesgo ?? 'medio';
        requiereRevisionJuridica = rv.requiereRevisionJuridica ?? false;
        break;
      }

      case 'lenguaje_claro': {
        const textoLC = borrador || textoBase;
        if (!textoLC) return NextResponse.json({ error: 'Se requiere texto para convertir.' }, { status: 400 });
        resultadoBruto = await invocarGemini<SimiLenguajeClaro>(buildPlainLanguagePrompt(textoLC), true);
        advertencias = [...advertencias, 'Verificar que el texto en lenguaje claro conserve el sentido jurídico antes de usar.'];
        break;
      }

      case 'riesgo_juridico': {
        resultadoBruto = await invocarGemini<{ nivel: NivelRiesgoJuridico; mensaje: string; factores: string[] }>(
          buildRiskPrompt({ textoSolicitud: textoBase, contexto }), true,
        );
        const rr = resultadoBruto as { nivel: NivelRiesgoJuridico; mensaje: string; factores: string[] };
        nivelRiesgo = rr.nivel;
        if (nivelRiesgo === 'alto') {
          advertencias.push('Este caso requiere revisión jurídica obligatoria.');
          requiereRevisionJuridica = true;
        }
        break;
      }

      case 'traslado_competencia': {
        resultadoBruto = await invocarGemini<string>(buildTransferPrompt({ textoSolicitud: textoBase, datosRadicado }), false);
        advertencias = [...advertencias, 'Validar la entidad competente con el manual de funciones antes de ejecutar el traslado.'];
        nivelRiesgo = 'medio';
        break;
      }

      case 'solicitud_aclaracion': {
        resultadoBruto = await invocarGemini<string>(buildClarificationPrompt({ textoSolicitud: textoBase, datosRadicado }), false);
        advertencias = [...advertencias, 'Revisar que la comunicación sea respetuosa y no se perciba como una negativa.'];
        break;
      }

      case 'datos_personales': {
        const textoDp = borrador || textoBase;
        resultadoBruto = await invocarGemini<{ detectados: string[]; advertencia: string }>(buildPersonalDataPrompt(textoDp), true);
        const dp = resultadoBruto as { detectados: string[]; advertencia: string };
        if (dp.detectados?.length) {
          advertencias.push('Se detectó posible información personal o sensible. Validar tratamiento conforme a Ley 1581 de 2012.');
        }
        break;
      }

      case 'checklist_mipg': {
        const analisis = await invocarGemini<SimiAnalisisJuridico>(buildClassifyPrompt({ textoSolicitud: textoBase, datosRadicado }), true);
        resultadoBruto = analisis.checklistMipg;
        requiereRevisionJuridica = analisis.requiereRevisionJuridica ?? false;
        break;
      }

      case 'fundamento_normativo': {
        const analisis = await invocarGemini<SimiAnalisisJuridico>(buildClassifyPrompt({ textoSolicitud: textoBase, datosRadicado }), true);
        resultadoBruto = analisis.fundamentosNormativos;
        advertencias = [...advertencias, 'Verificar vigencia y aplicabilidad de cada norma antes de citar en respuesta oficial.'];
        break;
      }

      case 'escalar_juridica': {
        resultadoBruto = {
          motivo: 'El caso presenta características que requieren revisión jurídica especializada.',
          instrucciones: `
Por favor notifique al asesor jurídico o jefe de dependencia con la siguiente información:
- Radicado: ${radicadoId}
- Dependencia: ${dependencia}
- Solicitud: ${radicado.detalle.asunto}
- Estado actual: ${radicado.estadoActual}
- Fecha vencimiento: ${radicado.termino.fechaVencimiento}

SIMI ha detectado que este caso requiere análisis jurídico especializado. No genere respuesta oficial sin la aprobación del asesor competente.
          `.trim(),
        };
        nivelRiesgo = 'alto';
        requiereRevisionJuridica = true;
        advertencias = ['Este caso ha sido marcado para revisión jurídica obligatoria.'];
        break;
      }

      default:
        return NextResponse.json({ error: 'Modo no soportado.' }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[simi-juridico/${modo}] Error:`, msg);
    return NextResponse.json(
      { error: `Error al procesar la consulta jurídica: ${msg}` },
      { status: 500 },
    );
  }

  /* 8b. Crear flujo de aprobación si se solicita */
  if (createApproval && nivelRiesgo) {
    try {
      approvalResult = await createApprovalFlow({
        radicadoId,
        tenantId:      usuario.tenantId,
        usuarioId:     usuario.uid,
        usuarioNombre: usuario.nombre,
        usuarioRol:    usuario.rol,
        rules: {
          nivelRiesgo:              nivelRiesgo,
          tieneDatosSensibles:      advertencias.some((a) => a.toLowerCase().includes('datos')),
          tieneMenoresEdad:         false,
          esEnteControl:            false,
          esTutela:                 false,
          esRespuestaNegativa:      modo === 'proyectar_respuesta' && nivelRiesgo === 'alto',
          afectaDerechosFundamentales: nivelRiesgo === 'alto',
        },
      });
      if (approvalResult.requiereRevisionJuridica) {
        advertencias.push('Se creó flujo de aprobación. REVISIÓN JURÍDICA OBLIGATORIA antes del envío oficial.');
      }
    } catch {
      advertencias.push('No se pudo crear el flujo de aprobación. Continuar con revisión manual.');
    }
  }

  /* 8. Guardar auditoría (fire-and-forget) */
  const resumenResultado = typeof resultadoBruto === 'string'
    ? (resultadoBruto as string).slice(0, 300)
    : JSON.stringify(resultadoBruto).slice(0, 300);

  void createAuditLog({
    radicadoId,
    usuarioId:                usuario.uid,
    usuarioNombre:            usuario.nombre,
    rol:                      usuario.rol,
    fechaHora:                new Date().toISOString(),
    modo,
    nivelRiesgo,
    requiereRevisionJuridica,
    dependenciaSugerida:      dependencia,
    fuentesConsultadas:       [],
    resultadoResumen:         resumenResultado,
    usadoEnRespuestaFinal:    false,
    editadoPorFuncionario:    false,
    aprobado:                 false,
  });

  /* 9. Respuesta */
  const response = {
    ok:              true,
    modo,
    resultado:       resultadoBruto as SimiJuridicoResponse['resultado'],
    nivelRiesgo:     nivelRiesgo ?? undefined,
    advertencias,
    fraseFinal:      FRASE_FINAL,
    fuentesRag:      fuentesRag.length > 0 ? fuentesRag : undefined,
    aprobacion:      approvalResult ?? undefined,
    usedRag:         useRag,
  };

  return NextResponse.json(response);
}
