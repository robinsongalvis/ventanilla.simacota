import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { generateOfficialResponsePdf } from '@/lib/simi-juridico/generateOfficialResponsePdf';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { RespuestaFirma } from '@/src/types/simi-firma';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';

const ESTADOS_PUBLICOS = new Set<RespuestaFirma['estado']>(['enviado_ciudadano', 'notificado', 'cerrado']);
const ROLES_INTERNOS = new Set<RolInterno>(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA', 'FUNCIONARIO']);

interface UsuarioPdf {
  uid: string;
  nombre: string;
  rol: RolInterno;
  tenantId: TenantId;
}

async function verificarSesion(): Promise<UsuarioPdf | null> {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false) return null;
    const rol = d.rol as RolInterno;
    if (!ROLES_INTERNOS.has(rol)) return null;
    return {
      uid: decoded.uid,
      nombre: d.nombre as string ?? decoded.email ?? 'Usuario interno',
      rol,
      tenantId: d.tenantId as TenantId,
    };
  } catch {
    return null;
  }
}

function puedeAccederInterno(usuario: UsuarioPdf, firma: RespuestaFirma): boolean {
  if (usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO') return true;
  return firma.tenantId === usuario.tenantId;
}

function verificarCiudadano(request: Request, firma: RespuestaFirma, radicado: VentanillaRadicado | null): boolean {
  if (!ESTADOS_PUBLICOS.has(firma.estado)) return false;

  const url = new URL(request.url);
  const radicadoParam = (url.searchParams.get('radicado') ?? '').trim().toUpperCase();
  if (radicadoParam !== firma.radicadoId.toUpperCase()) return false;

  if (!radicado || radicado.esAnonimo || radicado.identidadReservada) return true;

  const verificacion = (url.searchParams.get('verificacion') ?? '').replace(/\D/g, '');
  if (!verificacion) return false;

  const documento = radicado.solicitante.numeroDocumento.replace(/\D/g, '');
  return documento.slice(-4) === verificacion;
}

async function auditar(params: {
  firmaId: string;
  radicadoId: string;
  tenantId: string;
  accion: 'PDF_GENERADO' | 'PDF_DESCARGADO';
  resultado: 'ok' | 'rechazado' | 'error';
  usuario?: UsuarioPdf | null;
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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const db = getFirebaseAdminDb();
  const firmaSnap = await db.collection('simi_respuestas_firma').doc(id).get();

  if (!firmaSnap.exists) {
    return NextResponse.json({ error: 'Firma no encontrada.' }, { status: 404 });
  }

  const firma = { id: firmaSnap.id, ...firmaSnap.data() } as RespuestaFirma;
  const radicadoSnap = await db.doc(`ventanilla_radicados/${firma.radicadoId}`).get();
  const radicado = radicadoSnap.exists ? radicadoSnap.data() as VentanillaRadicado : null;
  const usuario = await verificarSesion();
  const actor = usuario ? 'interno' : 'ciudadano';
  const autorizado = usuario
    ? puedeAccederInterno(usuario, firma)
    : verificarCiudadano(request, firma, radicado);

  if (!autorizado) {
    await auditar({
      firmaId: id,
      radicadoId: firma.radicadoId,
      tenantId: firma.tenantId,
      accion: 'PDF_DESCARGADO',
      resultado: 'rechazado',
      usuario,
      actor,
    });
    return NextResponse.json({ error: 'No autorizado para descargar este documento.' }, { status: usuario ? 403 : 401 });
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
      actor,
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
      actor,
    });
    const message = error instanceof Error ? error.message : 'No fue posible generar el PDF.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
