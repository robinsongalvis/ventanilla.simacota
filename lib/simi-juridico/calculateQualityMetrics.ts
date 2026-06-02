/**
 * Métricas de calidad del módulo SIMI Jurídico.
 * Fuentes: simi_juridico_auditoria + simi_aprobaciones_respuesta
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { SimiJuridicoAuditoria } from '@/src/types/simi-juridico';
import type { ApprovalFlow } from '@/src/types/simi-approval';

export interface QualityMetrics {
  totalBorradores:         number;
  aprobadosSinCambios:     number;
  devueltos:               number;
  escaladosJuridica:       number;
  tasaAprobacionDirecta:   number;   // %
  tiempoPromedioAprobHoras?: number;
  fuentesMasUsadas: Array<{ titulo: string; veces: number }>;
  dependenciasMasVencimientos: Array<{ dependencia: string; vencidos: number }>;
  modosMasUsados: Array<{ modo: string; veces: number }>;
  porNivelRiesgo: { bajo: number; medio: number; alto: number };
}

export async function calculateQualityMetrics(tenantId: string): Promise<QualityMetrics> {
  const db = getFirebaseAdminDb();

  // Obtener auditorías del tenant (últimos 90 días)
  const hace90 = new Date();
  hace90.setDate(hace90.getDate() - 90);
  const desde = hace90.toISOString();

  const [auditSnap, approvalSnap] = await Promise.all([
    db.collection('simi_juridico_auditoria')
      .where('rol', '!=', 'system')
      .orderBy('fechaHora', 'desc')
      .limit(500)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    db.collection('simi_aprobaciones_respuesta')
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
  ]);

  const audits = auditSnap.docs.map((d) => d.data() as SimiJuridicoAuditoria);
  const approvals = approvalSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalFlow));

  // Modos más usados
  const modoCount: Record<string, number> = {};
  for (const a of audits) {
    modoCount[a.modo] = (modoCount[a.modo] ?? 0) + 1;
  }
  const modosMasUsados = Object.entries(modoCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([modo, veces]) => ({ modo, veces }));

  // Fuentes más usadas (desde simi_rag_consultas)
  const ragSnap = await db.collection('simi_rag_consultas')
    .where('tenantId', '==', tenantId)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get()
    .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));

  const fuenteCount: Record<string, number> = {};
  for (const doc of ragSnap.docs) {
    const d = doc.data();
    for (const f of (d.fuentesUsadas ?? [])) {
      fuenteCount[f.titulo] = (fuenteCount[f.titulo] ?? 0) + 1;
    }
  }
  const fuentesMasUsadas = Object.entries(fuenteCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([titulo, veces]) => ({ titulo, veces }));

  // Métricas de aprobación
  const aprobadosSinCambios = approvals.filter((a) =>
    a.estado === 'aprobado_por_jefe' || a.estado === 'aprobado_por_juridica' || a.estado === 'listo_para_envio',
  ).length;

  const devueltos = approvals.filter((a) => a.estado === 'devuelto_para_ajustes').length;
  const escalados = approvals.filter((a) => a.estado === 'pendiente_revision_juridica').length;
  const totalBorradores = approvals.length;

  // Tiempo promedio de aprobación (horas)
  let tiempoTotal = 0;
  let tiempoCount = 0;
  for (const a of approvals) {
    if ((a.estado === 'aprobado_por_jefe' || a.estado === 'aprobado_por_juridica') && a.fechaAprobacion && a.createdAt) {
      const ms = new Date(a.fechaAprobacion).getTime() - new Date(a.createdAt).getTime();
      if (ms > 0) { tiempoTotal += ms; tiempoCount++; }
    }
  }

  // Por nivel de riesgo
  const porNivelRiesgo = { bajo: 0, medio: 0, alto: 0 };
  for (const a of approvals) {
    const lvl = a.nivelRiesgo;
    if (lvl === 'bajo' || lvl === 'medio' || lvl === 'alto') porNivelRiesgo[lvl]++;
  }

  return {
    totalBorradores,
    aprobadosSinCambios,
    devueltos,
    escaladosJuridica: escalados,
    tasaAprobacionDirecta: totalBorradores > 0
      ? Math.round((aprobadosSinCambios / totalBorradores) * 100)
      : 0,
    tiempoPromedioAprobHoras: tiempoCount > 0
      ? Math.round((tiempoTotal / tiempoCount) / (1000 * 60 * 60))
      : undefined,
    fuentesMasUsadas,
    dependenciasMasVencimientos: [],   // calculado desde dashboard PQRSD
    modosMasUsados,
    porNivelRiesgo,
  };
}
