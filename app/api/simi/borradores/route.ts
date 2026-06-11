/**
 * GET /api/simi/borradores?radicadoId=xxx  — historial de versiones
 * POST /api/simi/borradores                — guardar nueva versión
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  guardarVersionBorrador,
  getVersionesBorrador,
} from '@/lib/simi-juridico/borradorVersiones';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';

async function verificarSesion() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false) return null;
    return {
      uid:      decoded.uid,
      nombre:   d.nombre as string ?? '',
      rol:      d.rol as RolInterno,
      tenantId: d.tenantId as TenantId,
    };
  } catch { return null; }
}

export async function GET(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const url = new URL(request.url);
  const radicadoId = url.searchParams.get('radicadoId');
  if (!radicadoId) return NextResponse.json({ error: 'Se requiere radicadoId.' }, { status: 400 });

  const versiones = await getVersionesBorrador(radicadoId);
  return NextResponse.json({ ok: true, versiones, total: versiones.length });
}

export async function POST(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

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

  if (!body.radicadoId || !body.contenido) {
    return NextResponse.json({ error: 'Campos requeridos: radicadoId, contenido.' }, { status: 400 });
  }

  const result = await guardarVersionBorrador({
    radicadoId:      body.radicadoId,
    approvalId:      body.approvalId,
    tenantId:        usuario.tenantId,
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
}
