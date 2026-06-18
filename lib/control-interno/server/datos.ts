/**
 * Acceso de datos server-side para Control Interno (Admin SDK).
 *
 * Centraliza las queries a Firestore para que los endpoints sean delgados
 * y testeables. Nunca expone Admin SDK al cliente.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import type {
  AlertaControlInterno,
  EventoControlInterno,
  HallazgoControlInterno,
  PlanMejora,
} from '@/src/types/control-interno';

const COL_RADICADOS = 'ventanilla_radicados';
const COL_HALLAZGOS = 'control_interno_hallazgos';
const COL_PLANES    = 'control_interno_planes_mejora';
const COL_ALERTAS   = 'control_interno_alertas';
const COL_EVENTOS   = 'control_interno_eventos';

interface RangoFechas {
  desde?: string;
  hasta?: string;
}

/* ══════════════════════════════════════════════════════════════
   RADICADOS — vista institucional para Control Interno
══════════════════════════════════════════════════════════════ */

export async function listarRadicadosParaControl(
  rango: RangoFechas = {},
): Promise<VentanillaRadicado[]> {
  const db = getFirebaseAdminDb();
  let query = db.collection(COL_RADICADOS).limit(2000) as FirebaseFirestore.Query;

  if (rango.desde) {
    query = query.where('control.fechaRadicado', '>=', rango.desde);
  }
  if (rango.hasta) {
    query = query.where('control.fechaRadicado', '<=', `${rango.hasta}T23:59:59.999Z`);
  }

  const snap = await query.get();
  return snap.docs.map((d) => d.data() as VentanillaRadicado);
}

/* ══════════════════════════════════════════════════════════════
   HALLAZGOS
══════════════════════════════════════════════════════════════ */

export async function listarHallazgos(filtros: {
  tenantId?: TenantId;
  estado?:   string;
  limite?:   number;
} = {}): Promise<HallazgoControlInterno[]> {
  const db = getFirebaseAdminDb();
  let q = db.collection(COL_HALLAZGOS) as FirebaseFirestore.Query;
  if (filtros.tenantId) q = q.where('tenantId', '==', filtros.tenantId);
  if (filtros.estado)   q = q.where('estado', '==', filtros.estado);
  q = q.limit(filtros.limite ?? 200);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as HallazgoControlInterno) }));
}

export async function crearHallazgo(payload: Omit<HallazgoControlInterno, 'id'>): Promise<string> {
  const db = getFirebaseAdminDb();
  const ref = await db.collection(COL_HALLAZGOS).add(payload);
  return ref.id;
}

export async function actualizarHallazgo(id: string, patch: Partial<HallazgoControlInterno>): Promise<void> {
  const db = getFirebaseAdminDb();
  await db.collection(COL_HALLAZGOS).doc(id).update(patch);
}

export async function obtenerHallazgo(id: string): Promise<HallazgoControlInterno | null> {
  const db = getFirebaseAdminDb();
  const snap = await db.collection(COL_HALLAZGOS).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as HallazgoControlInterno) };
}

/* ══════════════════════════════════════════════════════════════
   PLANES DE MEJORA
══════════════════════════════════════════════════════════════ */

export async function listarPlanes(filtros: {
  tenantId?: TenantId;
  estado?:   string;
  limite?:   number;
} = {}): Promise<PlanMejora[]> {
  const db = getFirebaseAdminDb();
  let q = db.collection(COL_PLANES) as FirebaseFirestore.Query;
  if (filtros.tenantId) q = q.where('tenantId', '==', filtros.tenantId);
  if (filtros.estado)   q = q.where('estado', '==', filtros.estado);
  q = q.limit(filtros.limite ?? 200);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as PlanMejora) }));
}

export async function crearPlan(payload: Omit<PlanMejora, 'id'>): Promise<string> {
  const db = getFirebaseAdminDb();
  const ref = await db.collection(COL_PLANES).add(payload);
  return ref.id;
}

export async function actualizarPlan(id: string, patch: Partial<PlanMejora>): Promise<void> {
  const db = getFirebaseAdminDb();
  await db.collection(COL_PLANES).doc(id).update(patch);
}

export async function obtenerPlan(id: string): Promise<PlanMejora | null> {
  const db = getFirebaseAdminDb();
  const snap = await db.collection(COL_PLANES).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as PlanMejora) };
}

/* ══════════════════════════════════════════════════════════════
   ALERTAS — persistencia opcional (los endpoints derivan en vivo)
══════════════════════════════════════════════════════════════ */

export async function listarAlertasPersistidas(filtros: {
  tenantId?: TenantId;
  estado?:   string;
  limite?:   number;
} = {}): Promise<AlertaControlInterno[]> {
  const db = getFirebaseAdminDb();
  let q = db.collection(COL_ALERTAS) as FirebaseFirestore.Query;
  if (filtros.tenantId) q = q.where('tenantId', '==', filtros.tenantId);
  if (filtros.estado)   q = q.where('estado', '==', filtros.estado);
  q = q.limit(filtros.limite ?? 200);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AlertaControlInterno) }));
}

export async function marcarAlertaPersistida(
  id: string,
  patch: Partial<AlertaControlInterno>,
): Promise<void> {
  const db = getFirebaseAdminDb();
  await db.collection(COL_ALERTAS).doc(id).set(patch, { merge: true });
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS DE TRAZABILIDAD
══════════════════════════════════════════════════════════════ */

export async function registrarEvento(evento: Omit<EventoControlInterno, 'id'>): Promise<void> {
  const db = getFirebaseAdminDb();
  await db.collection(COL_EVENTOS).add(evento);
}

/* ══════════════════════════════════════════════════════════════
   AGREGACIÓN: hallazgos / planes abiertos por tenant
══════════════════════════════════════════════════════════════ */

export async function contarHallazgosAbiertosPorTenant(): Promise<Map<TenantId, number>> {
  const db = getFirebaseAdminDb();
  const snap = await db.collection(COL_HALLAZGOS).where('estado', 'in', ['ABIERTO', 'EN_GESTION']).get();
  const m = new Map<TenantId, number>();
  for (const doc of snap.docs) {
    const t = (doc.data() as HallazgoControlInterno).tenantId;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

export async function contarPlanesAbiertosPorTenant(): Promise<Map<TenantId, number>> {
  const db = getFirebaseAdminDb();
  const snap = await db.collection(COL_PLANES).where('estado', 'in', ['PENDIENTE', 'EN_EJECUCION', 'VENCIDO']).get();
  const m = new Map<TenantId, number>();
  for (const doc of snap.docs) {
    const t = (doc.data() as PlanMejora).tenantId;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}
