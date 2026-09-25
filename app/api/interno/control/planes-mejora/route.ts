/**
 * /api/interno/control/planes-mejora
 *
 * GET  → lista planes de mejora (filtros: tenantId, estado)
 * POST → crea plan (solo Control Interno o Admin); requiere hallazgoId existente
 */

import { NextResponse } from 'next/server';
import { autorizarAuditor, autorizarAuditorOJefe } from '../_auth';
import {
  crearPlan,
  listarPlanes,
  obtenerHallazgo,
  actualizarHallazgo,
  registrarEvento,
} from '@/lib/control-interno/server/datos';
import type { PlanMejora } from '@/src/types/control-interno';
import type { TenantId } from '@/src/types/radicado';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await autorizarAuditorOJefe();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const tenantParam = url.searchParams.get('tenantId') as TenantId | null;
  const estado = url.searchParams.get('estado') ?? undefined;

  const tenantId = auth.data.acceso === 'JEFE_DEPENDENCIA'
    ? auth.data.user.tenantId
    : tenantParam ?? undefined;

  const planes = await listarPlanes({ tenantId, estado });
  return NextResponse.json({ ok: true, planes });
}

interface CrearPlanBody {
  hallazgoId:         string;
  accionCorrectiva:   string;
  responsableUid:     string;
  responsableNombre:  string;
  fechaCompromiso:    string;
  evidenciaRequerida: string;
  observaciones?:     string | null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  let body: CrearPlanBody;
  try { body = await req.json() as CrearPlanBody; }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  if (!body.hallazgoId) return NextResponse.json({ error: 'hallazgoId requerido.' }, { status: 400 });
  if (!body.accionCorrectiva || body.accionCorrectiva.trim().length < 10) {
    return NextResponse.json({ error: 'La acción correctiva debe tener al menos 10 caracteres.' }, { status: 400 });
  }
  if (!body.responsableUid || !body.responsableNombre) {
    return NextResponse.json({ error: 'Responsable requerido.' }, { status: 400 });
  }
  if (!body.fechaCompromiso || !/^\d{4}-\d{2}-\d{2}$/.test(body.fechaCompromiso)) {
    return NextResponse.json({ error: 'fechaCompromiso debe ser YYYY-MM-DD.' }, { status: 400 });
  }
  if (!body.evidenciaRequerida || body.evidenciaRequerida.trim().length < 5) {
    return NextResponse.json({ error: 'evidenciaRequerida requerida.' }, { status: 400 });
  }

  const hallazgo = await obtenerHallazgo(body.hallazgoId);
  if (!hallazgo) return NextResponse.json({ error: 'Hallazgo origen no existe.' }, { status: 404 });

  const fecha = new Date().toISOString();
  const plan: Omit<PlanMejora, 'id'> = {
    hallazgoId:          body.hallazgoId,
    tenantId:            hallazgo.tenantId,
    accionCorrectiva:    body.accionCorrectiva.trim(),
    responsableUid:      body.responsableUid,
    responsableNombre:   body.responsableNombre,
    fechaCompromiso:     body.fechaCompromiso,
    estado:              'PENDIENTE',
    evidenciaRequerida:  body.evidenciaRequerida.trim(),
    observaciones:       body.observaciones?.trim() || null,
    fechaCreacion:       fecha,
    creadoPor:           { uid: auth.data.user.uid, nombre: auth.data.user.nombre, rol: auth.data.user.rol },
    avances:             [],
    cierre:              null,
  };

  const id = await crearPlan(plan);

  // Vincular plan al hallazgo
  await actualizarHallazgo(body.hallazgoId, {
    planMejoraId: id,
    estado: hallazgo.estado === 'ABIERTO' ? 'EN_GESTION' : hallazgo.estado,
  });

  await registrarEvento({
    tipo:        'CONTROL_INTERNO_PLAN_MEJORA_SOLICITADO',
    fecha,
    actorUid:    auth.data.user.uid,
    actorNombre: auth.data.user.nombre,
    actorRol:    auth.data.user.rol,
    radicadoId:  hallazgo.radicadoId ?? null,
    tenantId:    hallazgo.tenantId,
    metadata:    { planId: id, hallazgoId: body.hallazgoId, fechaCompromiso: body.fechaCompromiso },
  });

  return NextResponse.json({ ok: true, id, plan: { ...plan, id } });
}
