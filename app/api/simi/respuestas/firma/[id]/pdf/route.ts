import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import type { InternalUserSession } from '@/lib/server/internal-auth';
import { generateOfficialResponsePdf } from '@/lib/simi-juridico/generateOfficialResponsePdf';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { RespuestaFirma } from '@/src/types/simi-firma';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';

const ROLES_INTERNOS = new Set<RolInterno>(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA', 'FUNCIONARIO']);

function puedeAccederInterno(usuario: InternalUserSession, firma: RespuestaFirma): boolean {
  if (usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO') return true;
  return firma.tenantId === usuario.tenantId;
}

async function auditar(params: {
  firmaId: string;
  radicadoId: string;
  tenantId: string;
  accion: 'PDF_GENERADO' | 'PDF_DESCARGADO';
  resultado: 'ok' | 'rechazado' | 'error';
  usuario?: InternalUserSession | null;
  actor: 'interno' | 'ciudadano';
}) {
  await getFirebaseAdminDb().collection('simi_operational_auditoria').add({
    ...params,
    usuarioUid: params.usuario?.uid ?? null,
    usuarioNombre: params.usuario?.nombre ?? null,
    rol: params.usuario?.rol ?? params.actor,
    fecha: new Date().toISOString(),
  }).catch(() => null);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (!ROLES_INTERNOS.has(usuario.rol)) {
    return NextResponse.json(
      { error: 'No autorizado para descargar este documento.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const db = getFirebaseAdminDb();
  const firmaSnap = await db.collection('simi_respuestas_firma').doc(id).get();

  if (!firmaSnap.exists) {
    return NextResponse.json({ error: 'Firma no encontrada.' }, { status: 404 });
  }

  const firma = { id: firmaSnap.id, ...firmaSnap.data() } as RespuestaFirma;
  const radicadoSnap = await db.doc(`ventanilla_radicados/${firma.radicadoId}`).get();
  const radicado = radicadoSnap.exists ? radicadoSnap.data() as VentanillaRadicado : null;
  // H-03: los datos de verificación nunca viajan por query string. La descarga
  // pública se mantiene cerrada hasta contar con tickets efímeros de un solo uso.
  const autorizado = puedeAccederInterno(usuario, firma);

  if (!autorizado) {
    await auditar({
      firmaId: id,
      radicadoId: firma.radicadoId,
      tenantId: firma.tenantId,
      accion: 'PDF_DESCARGADO',
      resultado: 'rechazado',
      usuario,
      actor: 'interno',
    });
    return NextResponse.json(
      { error: 'No autorizado para descargar este documento.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const dependenciaNombre = NOMBRES_TENANT[firma.dependencia as keyof typeof NOMBRES_TENANT]
      ?? firma.dependencia
      ?? 'Alcaldía Municipal de Simacota';
    const pdf = generateOfficialResponsePdf({
      firmaId: id,
      firma,
      radicado,
      dependenciaNombre,
    });
    const ahora = new Date().toISOString();

    await firmaSnap.ref.update({
      pdfUrl: `/api/simi/respuestas/firma/${id}/pdf`,
      pdfGeneratedAt: ahora,
      pdfHash: pdf.hash,
      updatedAt: ahora,
    });
    await auditar({
      firmaId: id,
      radicadoId: firma.radicadoId,
      tenantId: firma.tenantId,
      accion: firma.pdfGeneratedAt ? 'PDF_DESCARGADO' : 'PDF_GENERADO',
      resultado: 'ok',
      usuario,
      actor: 'interno',
    });

    const body = new Uint8Array(pdf.buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="respuesta-${firma.radicadoId}.pdf"`,
        'X-Document-Hash': pdf.hash,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    await auditar({
      firmaId: id,
      radicadoId: firma.radicadoId,
      tenantId: firma.tenantId,
      accion: 'PDF_GENERADO',
      resultado: 'error',
      usuario,
      actor: 'interno',
    });
    const message = error instanceof Error ? error.message : 'No fue posible generar el PDF.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
