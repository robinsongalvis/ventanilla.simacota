/**
 * GET /api/simi/reportes/trazabilidad/[radicadoId]?format=csv
 * Trazabilidad completa de un radicado para Control Interno.
 */

import { NextResponse }        from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import { canReadTenant } from '@/lib/server/internal-auth';
import { getRadicadoOrFail, RadicadoActionError } from '@/lib/server/radicados-security';
import type { RolInterno }     from '@/lib/hooks/useAuth';

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
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (!ROLES_PERMITIDOS.has(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  }

  try {
    const radicado = await getRadicadoOrFail(radicadoId);
    if (!canReadTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Sin acceso a la dependencia de este radicado.' }, { status: 403 });
    }
  } catch (error) {
    if (error instanceof RadicadoActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/trazabilidad]', error);
    return NextResponse.json({ error: 'No fue posible consultar el radicado.' }, { status: 500 });
  }

  try {
    const db = getFirebaseAdminDb();
    const fecha = new Date().toISOString().slice(0, 10);

    // Un error de cualquiera de las fuentes impide emitir un CSV incompleto
    // como si fuera la trazabilidad completa (incluye índices no disponibles).
    const [trazSnap, versionesSnap, approvalSnap, firmaSnap, auditSnap] = await Promise.all([
      db.collection('ventanilla_radicados').doc(radicadoId)
        .collection('trazabilidad').orderBy('fecha').get(),
      db.collection('simi_borrador_versiones').where('radicadoId', '==', radicadoId)
        .orderBy('version').get(),
      db.collection('simi_aprobaciones_respuesta').where('radicadoId', '==', radicadoId).get(),
      db.collection('simi_respuestas_firma').where('radicadoId', '==', radicadoId).get(),
      db.collection('simi_juridico_auditoria').where('radicadoId', '==', radicadoId).get(),
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
  } catch (error) {
    console.error('[api/trazabilidad]', error);
    return NextResponse.json({ error: 'No fue posible obtener la trazabilidad completa del radicado.' }, { status: 500 });
  }
}
