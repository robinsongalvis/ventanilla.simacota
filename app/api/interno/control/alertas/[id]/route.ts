/**
 * PATCH /api/interno/control/alertas/[id]
 *
 * Marca una alerta como GESTIONADA o DESCARTADA.
 * Como las alertas se derivan en vivo (id determinístico), aquí se
 * persiste el cambio para que la próxima carga las muestre como tales.
 */

import { NextResponse } from 'next/server';
import { autorizarAuditor } from '../../_auth';
import {
  marcarAlertaPersistida,
  registrarEvento,
} from '@/lib/control-interno/server/datos';
import type { EstadoAlerta } from '@/src/types/control-interno';

export const runtime = 'nodejs';

const ESTADOS: EstadoAlerta[] = ['ABIERTA', 'GESTIONADA', 'DESCARTADA'];

interface PatchBody {
  estado: EstadoAlerta;
  nota?:  string;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: PatchBody;
  try { body = await req.json() as PatchBody; }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  if (!ESTADOS.includes(body.estado)) {
    return NextResponse.json({ error: 'estado inválido.' }, { status: 400 });
  }

  const fecha = new Date().toISOString();
  await marcarAlertaPersistida(id, {
    estado: body.estado,
    gestionadaPor: {
      uid: auth.data.user.uid,
      nombre: auth.data.user.nombre,
      fecha,
      nota: body.nota?.trim() || undefined,
    },
  });
  await registrarEvento({
    tipo:        'CONTROL_INTERNO_ALERTA_REVISADA',
    fecha,
    actorUid:    auth.data.user.uid,
    actorNombre: auth.data.user.nombre,
    actorRol:    auth.data.user.rol,
    metadata:    { alertaId: id, estado: body.estado },
  });

  return NextResponse.json({ ok: true });
}
