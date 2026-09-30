/**
 * POST /api/simi/respuestas/firma — Crear firma final de respuesta.
 * Requiere aprobación humana previa. Registra la versión exacta enviada.
 */

import { NextResponse }         from 'next/server';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import { createFinalSignature, FirmaValidationError } from '@/lib/simi-juridico/createFinalSignature';
import type { RolInterno }      from '@/lib/hooks/useAuth';
import type { CanalEnvio }      from '@/src/types/simi-firma';

export const runtime = 'nodejs';

const PUEDE_FIRMAR = new Set<RolInterno>(['ADMIN', 'JEFE_DEPENDENCIA']);

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0 && valor.length <= 1500
    && !valor.includes('/') && valor !== '.' && valor !== '..';
}

export async function POST(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (!PUEDE_FIRMAR.has(usuario.rol)) {
    return NextResponse.json({ error: 'Su rol no tiene permiso para firmar respuestas.' }, { status: 403 });
  }

  let body: {
    radicadoId:           string;
    aprobacionId:         string;
    textoRespuestaFinal?: string;
    canalEnvio?:          CanalEnvio;
    emailCiudadano?:      string;
    borradorVersionId?:   string;
    dependencia?:         string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  if (!body || typeof body !== 'object' || Array.isArray(body)
    || !esIdValido(body.radicadoId) || !esIdValido(body.aprobacionId)
    || (body.borradorVersionId !== undefined && !esIdValido(body.borradorVersionId))
    || (body.textoRespuestaFinal !== undefined && typeof body.textoRespuestaFinal !== 'string')
    || (body.emailCiudadano !== undefined && typeof body.emailCiudadano !== 'string')
    || (body.canalEnvio !== undefined && !['email', 'fisico', 'whatsapp', 'portal', 'otro'].includes(body.canalEnvio))) {
    return NextResponse.json({ error: 'Campos requeridos: radicadoId, aprobacionId.' }, { status: 400 });
  }

  try {
    const result = await createFinalSignature({
      radicadoId:          body.radicadoId,
      aprobacionId:        body.aprobacionId,
      firmadoPor:          usuario.nombre,
      firmadoPorCargo:     usuario.cargo || undefined,
      // Estos campos se conservan por compatibilidad del helper servidor;
      // la dependencia efectiva se deriva del radicado dentro de la transacción.
      dependencia:         usuario.tenantId,
      tenantId:            usuario.tenantId,
      actor:               usuario,
      textoRespuestaFinal: body.textoRespuestaFinal,
      canalEnvio:          body.canalEnvio,
      emailCiudadano:      body.emailCiudadano,
      borradorVersionId:   body.borradorVersionId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof FirmaValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[simi/firma]', err);
    return NextResponse.json({ error: 'No fue posible registrar la firma. Intente de nuevo.' }, { status: 500 });
  }
}
