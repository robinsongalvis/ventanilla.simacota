/**
 * /api/interno/control/planes-mejora/[id]
 *
 * PATCH → registra avance, cambia estado o cierra.
 *   - { avance: { texto: string, evidenciaUrl?: string } }     (rol funcionario/jefe/admin)
 *   - { estado: 'EN_EJECUCION' | 'CUMPLIDO' | 'VENCIDO' }        (control interno)
 *   - { cierre: { resultado: 'CUMPLIDO'|'INCUMPLIDO', justificacion: string } } (control interno)
 */

import { NextResponse } from 'next/server';
import { autorizarAuditorOJefe } from '../../_auth';
import {
  actualizarPlan,
  obtenerPlan,
  registrarEvento,
} from '@/lib/control-interno/server/datos';
import type { EstadoPlanMejora, PlanMejoraAvance } from '@/src/types/control-interno';
import {
  puedeCerrarHallazgoOPlan,
  puedeReportarAvancePlan,
} from '@/lib/control-interno/permisos';

export const runtime = 'nodejs';

const ESTADOS_VALIDOS: EstadoPlanMejora[] = ['PENDIENTE', 'EN_EJECUCION', 'CUMPLIDO', 'VENCIDO'];

interface PatchBody {
  avance?: { texto: string; evidenciaUrl?: string | null };
  estado?: EstadoPlanMejora;
  cierre?: { resultado: 'CUMPLIDO' | 'INCUMPLIDO'; justificacion: string };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await autorizarAuditorOJefe();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const plan = await obtenerPlan(id);
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado.' }, { status: 404 });

  // Jefe de Dependencia: solo planes de su tenant.
  if (auth.data.acceso === 'JEFE_DEPENDENCIA' && plan.tenantId !== auth.data.user.tenantId) {
    return NextResponse.json({ error: 'Sin permiso sobre este plan.' }, { status: 403 });
  }

  let body: PatchBody;
  try { body = await req.json() as PatchBody; }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const fecha = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  let tipoEvento: 'CONTROL_INTERNO_PLAN_MEJORA_ACTUALIZADO' | 'CONTROL_INTERNO_PLAN_MEJORA_CERRADO' = 'CONTROL_INTERNO_PLAN_MEJORA_ACTUALIZADO';

  if (body.avance && body.avance.texto?.trim()) {
    if (!puedeReportarAvancePlan(auth.data.user.rol) && !puedeCerrarHallazgoOPlan(auth.data.user.rol)) {
      return NextResponse.json({ error: 'Sin permiso para reportar avance.' }, { status: 403 });
    }
    const avance: PlanMejoraAvance = {
      fecha,
      uid:    auth.data.user.uid,
      nombre: auth.data.user.nombre,
      rol:    auth.data.user.rol,
      texto:  body.avance.texto.trim(),
      evidenciaUrl: body.avance.evidenciaUrl?.trim() || null,
    };
    patch.avances = [...(plan.avances ?? []), avance];
    if (plan.estado === 'PENDIENTE') patch.estado = 'EN_EJECUCION';
  }

  if (body.estado) {
    if (!ESTADOS_VALIDOS.includes(body.estado)) {
      return NextResponse.json({ error: 'estado inválido.' }, { status: 400 });
    }
    if (!puedeCerrarHallazgoOPlan(auth.data.user.rol)) {
      return NextResponse.json({ error: 'Sin permiso para cambiar estado.' }, { status: 403 });
    }
    patch.estado = body.estado;
  }

  if (body.cierre) {
    if (!puedeCerrarHallazgoOPlan(auth.data.user.rol)) {
      return NextResponse.json({ error: 'Solo Control Interno puede cerrar planes.' }, { status: 403 });
    }
    if (!body.cierre.justificacion || body.cierre.justificacion.trim().length < 10) {
      return NextResponse.json({ error: 'La justificación de cierre requiere al menos 10 caracteres.' }, { status: 400 });
    }
    patch.cierre = {
      fecha,
      uid:           auth.data.user.uid,
      nombre:        auth.data.user.nombre,
      resultado:     body.cierre.resultado,
      justificacion: body.cierre.justificacion.trim(),
    };
    patch.estado = body.cierre.resultado === 'CUMPLIDO' ? 'CUMPLIDO' : 'VENCIDO';
    tipoEvento = 'CONTROL_INTERNO_PLAN_MEJORA_CERRADO';
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Sin cambios.' }, { status: 400 });
  }

  await actualizarPlan(id, patch);
  await registrarEvento({
    tipo:        tipoEvento,
    fecha,
    actorUid:    auth.data.user.uid,
    actorNombre: auth.data.user.nombre,
    actorRol:    auth.data.user.rol,
    tenantId:    plan.tenantId,
    metadata:    { planId: id, hallazgoId: plan.hallazgoId, patch: Object.keys(patch) },
  });

  return NextResponse.json({ ok: true });
}
