/**
 * GET /api/simi/reportes/trazabilidad/[radicadoId]?format=csv
 * Trazabilidad completa de un radicado para Control Interno.
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';
const ROLES_PERMITIDOS = new Set<RolInterno>(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA']);

function esc(v: unknown): string { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function toCSV(h: string[], rows: unknown[][]): string {
  return `﻿${h.map(esc).join(',')}\r\n${rows.map((r) => r.map(esc).join(',')).join('\r\n')}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ radicadoId: string }> },
): Promise<NextResponse> {
  const { radicadoId } = await params;
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
  if (!snap.exists) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
  const d   = snap.data()!;
  const rol = d.rol as RolInterno;
  if (!ROLES_PERMITIDOS.has(rol)) return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });

  const db   = getFirebaseAdminDb();
  const fecha = new Date().toISOString().slice(0, 10);

  // Obtener todos los registros de trazabilidad del radicado
  const [trazSnap, versionesSnap, approvalSnap, firmaSnap, auditSnap] = await Promise.all([
    db.collection('ventanilla_radicados').doc(radicadoId)
      .collection('trazabilidad').orderBy('fecha').get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    db.collection('simi_borrador_versiones').where('radicadoId', '==', radicadoId)
      .orderBy('version').get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    db.collection('simi_aprobaciones_respuesta').where('radicadoId', '==', radicadoId)
      .get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    db.collection('simi_respuestas_firma').where('radicadoId', '==', radicadoId)
      .get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    db.collection('simi_juridico_auditoria').where('radicadoId', '==', radicadoId)
      .get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
  ]);

  const headers = ['Tipo', 'Fecha', 'Usuario/Actor', 'Rol', 'Descripción', 'Estado', 'Observación'];
  const rows: unknown[][] = [];

  // Trazabilidad del radicado
  for (const doc of trazSnap.docs) {
    const t = doc.data();
    rows.push(['Trazabilidad', t.fecha ?? '', t.actorNombre ?? '', t.accionFuncionario ?? '', t.accion ?? '', '', t.nota ?? '']);
  }
  // Versiones del borrador
  for (const doc of versionesSnap.docs) {
    const v = doc.data();
    rows.push(['Borrador v' + v.version, v.createdAt ?? '', v.usuarioNombre ?? '', v.usuarioRol ?? '',
      v.generadoPorSimi ? 'Generado por SIMI' : 'Editado por funcionario', '', v.motivoCambio ?? '']);
  }
  // Aprobaciones
  for (const doc of approvalSnap.docs) {
    const a = doc.data();
    rows.push(['Aprobación', a.createdAt ?? '', a.aprobadoPor ?? '', a.aprobadoPorRol ?? '',
      `Flujo de aprobación`, a.estado ?? '', (a.motivoRevision ?? []).join(' | ')]);
  }
  // Firma final
  for (const doc of firmaSnap.docs) {
    const f = doc.data();
    rows.push(['Firma final', f.fechaFirma ?? f.createdAt ?? '', f.firmadoPor ?? '', f.firmadoPorCargo ?? '',
      `Firma/envío oficial`, f.estado ?? '', f.hashDocumento ?? '']);
  }
  // SIMI
  for (const doc of auditSnap.docs) {
    const s = doc.data();
    rows.push(['SIMI Jurídico', s.fechaHora ?? '', s.usuarioNombre ?? '', s.rol ?? '',
      s.modo ?? '', s.nivelRiesgo ?? '', s.resultadoResumen ?? '']);
  }

  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

  const csv = toCSV(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Trazabilidad_${radicadoId}_${fecha}.csv"`,
    },
  });
}
