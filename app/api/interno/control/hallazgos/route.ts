/**
 * /api/interno/control/hallazgos
 *
 * GET  → lista hallazgos (Control Interno y Admin ven todo; Jefe ve su tenant)
 * POST → crea un hallazgo (solo Control Interno o Admin)
 *
 * Cada creación deja evento en control_interno_eventos.
 */

import { NextResponse } from 'next/server';
import { autorizarAuditor, autorizarAuditorOJefe } from '../_auth';
import {
  crearHallazgo,
  listarHallazgos,
  registrarEvento,
} from '@/lib/control-interno/server/datos';
import type {
  HallazgoControlInterno,
  NivelRiesgo,
  TipoHallazgo,
} from '@/src/types/control-interno';
import type { TenantId } from '@/src/types/radicado';

export const runtime = 'nodejs';

const TIPOS_VALIDOS: TipoHallazgo[] = [
  'INCUMPLIMIENTO_TERMINO', 'FALTA_TRAZABILIDAD', 'FALTA_RESPONSABLE',
  'RESPUESTA_INCOMPLETA', 'SOPORTE_INSUFICIENTE',
  'NOTIFICACION_FALLIDA_NO_GESTIONADA', 'CLASIFICACION_INCORRECTA',
  'DEPENDENCIA_RIESGO_OPERATIVO', 'REINCIDENCIA', 'OTRO',
];
const NIVELES_VALIDOS: NivelRiesgo[] = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'];

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await autorizarAuditorOJefe();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const tenantParam = url.searchParams.get('tenantId') as TenantId | null;
  const estado = url.searchParams.get('estado') ?? undefined;

  // Jefe de dependencia: forzar su tenant.
  const tenantId = auth.data.acceso === 'JEFE_DEPENDENCIA'
    ? auth.data.user.tenantId
    : tenantParam ?? undefined;

  const hallazgos = await listarHallazgos({ tenantId, estado });
  return NextResponse.json({ ok: true, hallazgos });
}

interface CrearHallazgoBody {
  radicadoId?:        string | null;
  tenantId:           TenantId;
  responsableUid?:    string | null;
  responsableNombre?: string | null;
  tipo:               TipoHallazgo;
  nivel:              NivelRiesgo;
  descripcion:        string;
  evidencia?:         string | null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  let body: CrearHallazgoBody;
  try {
    body = await req.json() as CrearHallazgoBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!body.tenantId) return NextResponse.json({ error: 'tenantId requerido.' }, { status: 400 });
  if (!TIPOS_VALIDOS.includes(body.tipo)) return NextResponse.json({ error: 'tipo inválido.' }, { status: 400 });
  if (!NIVELES_VALIDOS.includes(body.nivel)) return NextResponse.json({ error: 'nivel inválido.' }, { status: 400 });
  if (!body.descripcion || body.descripcion.trim().length < 10) {
    return NextResponse.json({ error: 'La descripción debe tener al menos 10 caracteres.' }, { status: 400 });
  }

  const fecha = new Date().toISOString();
  const hallazgo: Omit<HallazgoControlInterno, 'id'> = {
    radicadoId:        body.radicadoId ?? null,
    tenantId:          body.tenantId,
    responsableUid:    body.responsableUid ?? null,
    responsableNombre: body.responsableNombre ?? null,
    tipo:              body.tipo,
    nivel:             body.nivel,
    descripcion:       body.descripcion.trim(),
    evidencia:         body.evidencia?.trim() || null,
    fecha,
    creadoPor: {
      uid:    auth.data.user.uid,
      nombre: auth.data.user.nombre,
      rol:    auth.data.user.rol,
    },
    estado:        'ABIERTO',
    observaciones: [],
    planMejoraId:  null,
    cierre:        null,
  };

  try {
    const id = await crearHallazgo(hallazgo);
    await registrarEvento({
      tipo:        'CONTROL_INTERNO_HALLAZGO_CREADO',
      fecha,
      actorUid:    auth.data.user.uid,
      actorNombre: auth.data.user.nombre,
      actorRol:    auth.data.user.rol,
      radicadoId:  body.radicadoId ?? null,
      tenantId:    body.tenantId,
      metadata:    { hallazgoId: id, tipo: body.tipo, nivel: body.nivel },
    });
    return NextResponse.json({ ok: true, id, hallazgo: { ...hallazgo, id } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al crear hallazgo.' },
      { status: 500 },
    );
  }
}
