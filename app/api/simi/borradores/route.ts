/**
 * GET /api/simi/borradores?radicadoId=xxx  — historial de versiones
 * POST /api/simi/borradores                — guardar nueva versión
 */

import { NextResponse }        from 'next/server';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import { canReadTenant } from '@/lib/server/internal-auth';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { getRadicadoOrFail, RadicadoActionError } from '@/lib/server/radicados-security';
import {
  guardarVersionBorrador,
  getVersionesBorrador,
} from '@/lib/simi-juridico/borradorVersiones';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;

  const url = new URL(request.url);
  const radicadoId = url.searchParams.get('radicadoId');
  if (!radicadoId?.trim() || radicadoId.includes('/')) {
    return NextResponse.json({ error: 'Se requiere un radicadoId válido.' }, { status: 400 });
  }

  try {
    const radicado = await getRadicadoOrFail(radicadoId);
    if (!canReadTenant(autenticacion.usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Sin acceso a este radicado.' }, { status: 403 });
    }
    const versiones = await getVersionesBorrador(radicadoId);
    return NextResponse.json({ ok: true, versiones, total: versiones.length });
  } catch (error) {
    return responderError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;

  let body: {
    radicadoId:      string;
    contenido:       string;
    approvalId?:     string;
    generadoPorSimi?: boolean;
    modoSimi?:       string;
    motivoCambio?:   string;
    estadoAprobacion?: string;
    fuentesUsadas?:  string[];
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  if (!body || typeof body.radicadoId !== 'string' || !body.radicadoId.trim()
    || body.radicadoId.includes('/') || typeof body.contenido !== 'string' || !body.contenido.trim()
    || (body.approvalId !== undefined && (typeof body.approvalId !== 'string'
      || !body.approvalId.trim() || body.approvalId.includes('/')))) {
    return NextResponse.json({ error: 'Campos requeridos: radicadoId, contenido.' }, { status: 400 });
  }

  try {
    const radicado = await getRadicadoOrFail(body.radicadoId);
    const tenantId = radicado.clasificacion.oficinaDestino;
    if (!canReadTenant(usuario, tenantId)) {
      return NextResponse.json({ error: 'Sin acceso a este radicado.' }, { status: 403 });
    }
    if (body.approvalId) {
      const aprobacion = await getFirebaseAdminDb().collection('simi_aprobaciones_respuesta')
        .doc(body.approvalId).get();
      if (!aprobacion.exists) {
        return NextResponse.json({ error: 'Aprobación no encontrada.' }, { status: 404 });
      }
      if (aprobacion.data()?.radicadoId !== body.radicadoId) {
        return NextResponse.json({ error: 'La aprobación no corresponde al radicado.' }, { status: 403 });
      }
    }
    const result = await guardarVersionBorrador({
      radicadoId:      body.radicadoId,
      approvalId:      body.approvalId,
      tenantId,
      contenido:       body.contenido,
      generadoPorSimi: body.generadoPorSimi ?? false,
      editadoPorHumano: !body.generadoPorSimi,
      usuarioId:       usuario.uid,
      usuarioNombre:   usuario.nombre,
      usuarioRol:      usuario.rol,
      modoSimi:        body.modoSimi,
      motivoCambio:    body.motivoCambio,
      estadoAprobacion: body.estadoAprobacion,
      fuentesUsadas:   body.fuentesUsadas,
    });

    return NextResponse.json({ ok: true, ...result, mensaje: `Versión ${result.numeroVersion} guardada.` });
  } catch (error) {
    return responderError(error);
  }
}

function responderError(error: unknown): NextResponse {
  if (error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[simi/borradores]', error);
  return NextResponse.json({ error: 'No fue posible procesar el borrador.' }, { status: 500 });
}
