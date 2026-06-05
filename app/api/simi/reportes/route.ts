/**
 * GET /api/simi/reportes — Exportación de reportes para Control Interno.
 *
 * Query params:
 *   tipo: aprobaciones | metricas | vencimientos
 *   format: csv (default) — xlsx y pdf como próximas fases
 *   desde: fecha ISO (opcional)
 *   hasta: fecha ISO (opcional)
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { ApprovalFlow }   from '@/src/types/simi-approval';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';
import { NOMBRES_TENANT }      from '@/src/types/reglas-negocio';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

export const runtime = 'nodejs';

const ROLES_REPORTE = new Set<RolInterno>(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA']);

async function verificarSesion() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return { uid: decoded.uid, rol: d.rol as RolInterno, tenantId: d.tenantId as TenantId };
  } catch { return null; }
}

/* ── Helpers CSV ── */
function esc(v: unknown): string {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const h = headers.map(esc).join(',');
  const r = rows.map((row) => row.map(esc).join(',')).join('\r\n');
  return `﻿${h}\r\n${r}`;  // BOM para Excel
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-cache',
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   HANDLER
══════════════════════════════════════════════════════════════ */

export async function GET(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!ROLES_REPORTE.has(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permiso para exportar reportes.' }, { status: 403 });
  }

  const url    = new URL(request.url);
  const tipo   = url.searchParams.get('tipo') ?? 'aprobaciones';
  const desde  = url.searchParams.get('desde') ?? undefined;
  const hasta  = url.searchParams.get('hasta') ?? undefined;
  const fecha  = new Date().toISOString().slice(0, 10);
  const db     = getFirebaseAdminDb();

  /* ── 1. Reporte de aprobaciones ── */
  if (tipo === 'aprobaciones') {
    let q = db.collection('simi_aprobaciones_respuesta')
      .orderBy('createdAt', 'desc')
      .limit(500);

    if (usuario.rol !== 'ADMIN') {
      q = db.collection('simi_aprobaciones_respuesta')
        .where('tenantId', '==', usuario.tenantId)
        .orderBy('createdAt', 'desc')
        .limit(500);
    }

    const snap = await q.get();
    let aprobaciones = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as ApprovalFlow & { id: string; isTest?: boolean; excludeFromMetrics?: boolean }))
      .filter((a) => !a.isTest && !a.excludeFromMetrics);

    if (desde) aprobaciones = aprobaciones.filter((a) => (a.createdAt ?? '') >= desde);
    if (hasta) aprobaciones = aprobaciones.filter((a) => (a.createdAt ?? '') <= hasta);

    const headers = [
      'ID', 'Radicado', 'Tenant', 'Estado', 'Riesgo',
      'Requiere Jurídica', 'Aprobado Por', 'Rol Aprobador',
      'Fecha Aprobación', 'Motivos', 'Fecha Creación',
    ];
    const rows = aprobaciones.map((a) => [
      a.id,
      a.radicadoId,
      NOMBRES_TENANT[a.tenantId as keyof typeof NOMBRES_TENANT] ?? a.tenantId,
      a.estado,
      a.nivelRiesgo,
      a.requiereRevisionJuridica ? 'Sí' : 'No',
      a.aprobadoPor ?? '',
      a.aprobadoPorRol ?? '',
      a.fechaAprobacion ?? '',
      (a.motivoRevision ?? []).join(' | '),
      a.createdAt ?? '',
    ]);

    return csvResponse(toCSV(headers, rows), `SIMI_Aprobaciones_${fecha}.csv`);
  }

  /* ── 2. Reporte de vencimientos ── */
  if (tipo === 'vencimientos') {
    let q = db.collection('ventanilla_radicados')
      .where('estadoActual', 'in', ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'DEVUELTO', 'PRORROGA'])
      .limit(500);

    if (usuario.rol !== 'ADMIN') {
      q = db.collection('ventanilla_radicados')
        .where('clasificacion.oficinaDestino', '==', usuario.tenantId)
        .where('estadoActual', 'in', ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'DEVUELTO', 'PRORROGA'])
        .limit(500);
    }

    const snap = await q.get();
    const radicados = snap.docs
      .map((d) => d.data() as VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean })
      .filter((r) => !r.isTest && !r.excludeFromMetrics);

    const headers = [
      'Radicado', 'Asunto', 'Solicitante', 'Dependencia',
      'Estado', 'Prioridad', 'Fecha Radicado', 'Fecha Vencimiento',
      'Días Restantes', 'Semáforo', 'Responsable',
    ];

    const rows = radicados.map((r) => {
      const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
      const semaforo = dias < 0 ? 'VENCIDO' : dias <= 2 ? 'POR VENCER' : 'EN TÉRMINO';
      return [
        r.radicadoId,
        r.detalle.asunto,
        r.esAnonimo ? 'Anónimo' : r.solicitante.nombreCompleto,
        NOMBRES_TENANT[r.clasificacion.oficinaDestino] ?? r.clasificacion.oficinaDestino,
        r.estadoActual,
        r.prioridad,
        r.control.fechaRadicado,
        r.termino.fechaVencimiento,
        dias,
        semaforo,
        r.clasificacion.funcionarioResponsableNombre ?? 'Sin asignar',
      ];
    });

    return csvResponse(toCSV(headers, rows), `SIMI_Vencimientos_${fecha}.csv`);
  }

  /* ── 3. Reporte de métricas (resumen) ── */
  if (tipo === 'metricas') {
    const [auditSnap, approvalSnap] = await Promise.all([
      db.collection('simi_juridico_auditoria').orderBy('fechaHora', 'desc').limit(200).get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
      db.collection('simi_aprobaciones_respuesta')
        .where('tenantId', '==', usuario.tenantId)
        .orderBy('createdAt', 'desc').limit(200).get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    ]);

    const audits   = auditSnap.docs
      .map((d) => d.data() as { isTest?: boolean; excludeFromMetrics?: boolean })
      .filter((a) => !a.isTest && !a.excludeFromMetrics);
    const approvals = approvalSnap.docs
      .map((d) => ({ ...d.data() } as ApprovalFlow & { isTest?: boolean; excludeFromMetrics?: boolean }))
      .filter((a) => !a.isTest && !a.excludeFromMetrics);

    const headers = ['Métrica', 'Valor'];
    const rows: unknown[][] = [
      ['Total consultas SIMI',          audits.length],
      ['Borradores generados',          approvals.length],
      ['Aprobados (jefe o jurídica)',    approvals.filter((a) => ['aprobado_por_jefe','aprobado_por_juridica','listo_para_envio'].includes(a.estado)).length],
      ['Devueltos para ajustes',        approvals.filter((a) => a.estado === 'devuelto_para_ajustes').length],
      ['Pendientes jefe',               approvals.filter((a) => a.estado === 'pendiente_revision_jefe').length],
      ['Pendientes jurídica',           approvals.filter((a) => a.estado === 'pendiente_revision_juridica').length],
      ['Riesgo alto',                   approvals.filter((a) => a.nivelRiesgo === 'alto').length],
      ['Riesgo medio',                  approvals.filter((a) => a.nivelRiesgo === 'medio').length],
      ['Riesgo bajo',                   approvals.filter((a) => a.nivelRiesgo === 'bajo').length],
      ['Fecha exportación',             new Date().toLocaleString('es-CO')],
    ];

    return csvResponse(toCSV(headers, rows), `SIMI_Metricas_${fecha}.csv`);
  }

  return NextResponse.json({ error: `Tipo de reporte no soportado: ${tipo}` }, { status: 400 });
}
