/**
 * /api/interno/control/hallazgos/[id]
 *
 * PATCH → agrega observación, cambia estado o cierra.
 *   Body soportado:
 *     - { observacion: string }
 *     - { estado: 'EN_GESTION' | 'CERRADO', justificacion?: string }
 */

import { NextResponse } from 'next/server';
import { autorizarAuditor } from '../../_auth';
import {
  actualizarHallazgo,
  obtenerHallazgo,
  registrarEvento,
} from '@/lib/control-interno/server/datos';
import type { EstadoHallazgo, HallazgoObservacion } from '@/src/types/control-interno';

export const runtime = 'nodejs';

const ESTADOS: EstadoHallazgo[] = ['ABIERTO', 'EN_GESTION', 'CERRADO'];

interface PatchBody {
  observacion?: string;
  estado?:      EstadoHallazgo;
  justificacion?: string;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const existente = await obtenerHallazgo(id);
  if (!existente) return NextResponse.json({ error: 'Hallazgo no encontrado.' }, { status: 404 });

  let body: PatchBody;
  try { body = await req.json() as PatchBody; }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const fecha = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (body.observacion && body.observacion.trim()) {
    const obs: HallazgoObservacion = {
      fecha,
      uid:    auth.data.user.uid,
      nombre: auth.data.user.nombre,
      rol:    auth.data.user.rol,
      texto:  body.observacion.trim(),
    };
    patch.observaciones = [...(existente.observaciones ?? []), obs];
  }

  if (body.estado) {
    if (!ESTADOS.includes(body.estado)) {
      return NextResponse.json({ error: 'estado inválido.' }, { status: 400 });
    }
    patch.estado = body.estado;
    if (body.estado === 'CERRADO') {
      if (!body.justificacion || body.justificacion.trim().length < 10) {
        return NextResponse.json({ error: 'La justificación de cierre debe tener al menos 10 caracteres.' }, { status: 400 });
      }
      patch.cierre = {
        fecha,
        uid:           auth.data.user.uid,
        nombre:        auth.data.user.nombre,
        justificacion: body.justificacion.trim(),
      };
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Sin cambios.' }, { status: 400 });
  }

  await actualizarHallazgo(id, patch);

  await registrarEvento({
    tipo:        body.estado === 'CERRADO' ? 'CONTROL_INTERNO_HALLAZGO_CERRADO' : 'CONTROL_INTERNO_OBSERVACION',
    fecha,
    actorUid:    auth.data.user.uid,
    actorNombre: auth.data.user.nombre,
    actorRol:    auth.data.user.rol,
    radicadoId:  existente.radicadoId ?? null,
    tenantId:    existente.tenantId,
    metadata:    { hallazgoId: id, ...(body.estado ? { estado: body.estado } : {}) },
  });

  return NextResponse.json({ ok: true });
}
