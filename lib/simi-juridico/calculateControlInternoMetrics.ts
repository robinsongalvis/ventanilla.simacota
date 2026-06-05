/**
 * calculateControlInternoMetrics — Métricas avanzadas para Control Interno.
 * Cruza datos de radicados, aprobaciones y auditoría SIMI.
 */

import { getFirebaseAdminDb }    from '@/lib/firebase-admin';
import { diasRestantesHabiles }  from '@/lib/tiempos-radicado';
import { NOMBRES_TENANT }        from '@/src/types/reglas-negocio';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { ApprovalFlow }     from '@/src/types/simi-approval';
import type { ControlInternoDashboardData } from '@/src/types/simi-control-interno';
import type { TenantId }         from '@/src/types/radicado';

const ESTADOS_ACTIVOS  = new Set(['PENDIENTE','EN_REVISION','EN_PROCESO','ASIGNADO','DEVUELTO','PRORROGA']);
const ESTADOS_CERRADOS = new Set(['RESUELTO','RECHAZADO']);

export async function calculateControlInternoMetrics(params: {
  tenantId:  TenantId | 'TODOS';
  esAdmin:   boolean;
  desde?:    string;
  hasta?:    string;
}): Promise<ControlInternoDashboardData> {
  const db   = getFirebaseAdminDb();
  const hoy  = new Date().toISOString();
  const desde = params.desde ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hasta = params.hasta ?? hoy.slice(0, 10);

  /* ── Radicados ── */
  let qRadicados = db.collection('ventanilla_radicados').limit(1000);
  if (!params.esAdmin && params.tenantId !== 'TODOS') {
    qRadicados = db.collection('ventanilla_radicados')
      .where('clasificacion.oficinaDestino', '==', params.tenantId)
      .limit(1000);
  }

  const [radSnap, approvalSnap, auditSnap] = await Promise.all([
    qRadicados.get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    db.collection('simi_aprobaciones_respuesta')
      .orderBy('createdAt', 'desc').limit(300)
      .get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    db.collection('simi_juridico_auditoria')
      .orderBy('fechaHora', 'desc').limit(200)
      .get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
  ]);

  const radicados  = radSnap.docs
    .map((d) => d.data() as VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean })
    .filter((r) => !r.isTest && !r.excludeFromMetrics);
  const approvals  = approvalSnap.docs
    .map((d) => d.data() as ApprovalFlow & { isTest?: boolean; excludeFromMetrics?: boolean })
    .filter((a) => !a.isTest && !a.excludeFromMetrics);
  const audits     = auditSnap.docs.filter((d) => {
    const data = d.data() as { isTest?: boolean; excludeFromMetrics?: boolean };
    return !data.isTest && !data.excludeFromMetrics;
  });

  /* ── Filtrar por período ── */
  const radPeriodo = radicados.filter((r) => {
    const f = r.control.fechaRadicado.slice(0, 10);
    return f >= desde && f <= hasta;
  });

  /* ── Métricas principales ── */
  const activos  = radicados.filter((r) => ESTADOS_ACTIVOS.has(r.estadoActual));
  const cerrados = radicados.filter((r) => ESTADOS_CERRADOS.has(r.estadoActual));

  const vencidos = activos.filter((r) => diasRestantesHabiles(r.termino.fechaVencimiento) < 0).length;
  const porVencer = activos.filter((r) => {
    const d = diasRestantesHabiles(r.termino.fechaVencimiento);
    return d >= 0 && d <= 3;
  }).length;

  const respondidosEnTermino = cerrados.filter((r) => r.cumplioTermino === true).length;
  const tasaOportunidadGlobal = cerrados.length > 0
    ? Math.round((respondidosEnTermino / cerrados.length) * 100)
    : 0;

  /* Promedio días de respuesta */
  let promedioDiasRespuesta: number | null = null;
  const conDias = cerrados.filter((r) => r.cumplioTermino !== undefined);
  if (conDias.length > 0) {
    const total = conDias.reduce((acc, r) => {
      const inicio = new Date(r.control.fechaRadicado).getTime();
      const fin    = new Date(r.termino.fechaVencimiento).getTime();
      return acc + Math.max(0, Math.round((fin - inicio) / 86400000));
    }, 0);
    promedioDiasRespuesta = Math.round(total / conDias.length);
  }

  /* ── Aprobaciones ── */
  const aprobados       = approvals.filter((a) => ['aprobado_por_jefe','aprobado_por_juridica','listo_para_envio','enviado'].includes(a.estado)).length;
  const devueltos       = approvals.filter((a) => a.estado === 'devuelto_para_ajustes').length;
  const escaladosJur    = approvals.filter((a) => a.estado === 'pendiente_revision_juridica').length;
  const pendientesJefe  = approvals.filter((a) => a.estado === 'pendiente_revision_jefe').length;
  const pendientesJur   = approvals.filter((a) => a.estado === 'pendiente_revision_juridica').length;

  /* ── Casos especiales ── */
  const casosRiesgoAlto = activos.filter((r) => r.prioridad === 'ROJO').length;
  const solicitudesIncompletas = radicados.filter((r) => r.estadoActual === 'DEVUELTO').length;

  /* ── SIMI ── */
  const alertasSnap = await db.collection('simi_alertas_vencimiento')
    .where('fechaAlerta', '>=', desde)
    .limit(500)
    .get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));

  /* ── Por dependencia ── */
  const depMap = new Map<TenantId, {
    total: number; respondidos: number; vencidos: number; porVencer: number; riesgoAlto: number;
  }>();

  for (const r of radicados) {
    const tid = r.clasificacion.oficinaDestino;
    if (!depMap.has(tid)) depMap.set(tid, { total: 0, respondidos: 0, vencidos: 0, porVencer: 0, riesgoAlto: 0 });
    const stats = depMap.get(tid)!;
    stats.total++;
    if (ESTADOS_CERRADOS.has(r.estadoActual) && r.cumplioTermino === true) stats.respondidos++;
    if (ESTADOS_ACTIVOS.has(r.estadoActual)) {
      const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
      if (dias < 0) stats.vencidos++;
      if (dias >= 0 && dias <= 3) stats.porVencer++;
      if (r.prioridad === 'ROJO') stats.riesgoAlto++;
    }
  }

  const porDependencia = Array.from(depMap.entries()).map(([tid, s]) => ({
    tenantId:       tid,
    nombre:         NOMBRES_TENANT[tid] ?? tid,
    total:          s.total,
    respondidos:    s.respondidos,
    vencidos:       s.vencidos,
    porVencer:      s.porVencer,
    riesgoAlto:     s.riesgoAlto,
    tasaOportunidad: s.total > 0 ? Math.round((s.respondidos / s.total) * 100) : 0,
  })).sort((a, b) => b.vencidos - a.vencidos || b.riesgoAlto - a.riesgoAlto);

  return {
    periodo:                 { desde, hasta },
    totalRecibidos:          radPeriodo.length,
    respondidosEnTermino,
    vencidos,
    porVencer,
    promedioDiasRespuesta,
    tasaOportunidadGlobal,
    borradoresGenerados:     approvals.length,
    aprobadosSinCambios:     aprobados,
    devueltos,
    escaladosJuridica:       escaladosJur,
    pendientesJefe,
    pendientesJuridica:      pendientesJur,
    solicitudesIncompletas,
    trasladosCompetencia:    0,  // requiere campo específico en Firestore
    casosRiesgoAlto,
    consultasSimi:           audits.length,
    alertasGeneradas:        alertasSnap.docs.length,
    porDependencia,
  };
}
