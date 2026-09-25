/**
 * PATCH /api/simi/normograma/[id] — actualizar estado de un documento
 * DELETE /api/simi/normograma/[id] — eliminar (solo ADMIN)
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';
import type { NormativeDocument } from '@/src/types/simi-normograma';

export const runtime = 'nodejs';

/**
 * Colecciones que estas dos rutas pueden tocar. MISMA lista que las rutas
 * hermanas (`app/api/simi/normograma/route.ts`), que ya la aplicaban — PATCH y
 * DELETE eran las únicas dos que no, y tomaban el nombre de la colección
 * directamente del query string. Con eso, un ADMIN podía escribir o borrar un
 * documento de CUALQUIER colección de Firestore —contadores, radicados,
 * usuarios— pasando su nombre por la URL.
 */
const COLECCIONES_VALIDAS = new Set(['normatividad_municipal', 'normatividad_nacional', 'plantillas_respuesta']);

/**
 * Campos que el cliente PUEDE modificar de un documento normativo.
 *
 * Lista blanca, no lista negra: el PATCH derramaba el cuerpo entero del cliente
 * (`{ ...body }`) dentro del `update`, sin cotejar una sola clave contra
 * `NormativeDocument`. Eso permitía sobrescribir campos de auditoría
 * (`validado_por`, `fecha_validacion`, `createdAt`), plantar `tenantId` ajeno,
 * y crear campos que ningún tipo declara y que nadie volvería a leer.
 *
 * `id` queda FUERA a propósito: es el identificador del documento, no un dato
 * suyo. `validado_por` y `fecha_validacion` también: los pone el servidor
 * cuando corresponde, más abajo, y son precisamente la constancia de quién
 * validó — un dato que el propio validador no debe poder escribir a mano.
 */
const CAMPOS_EDITABLES = [
  'titulo', 'tipo_norma', 'numero', 'anio', 'entidad_emisora',
  'fecha_expedicion', 'fecha_vigencia', 'estado', 'tema',
  'dependencia_relacionada', 'resumen', 'contenido', 'archivo_url',
  'fuente', 'url_fuente', 'palabras_clave', 'nivel_confianza',
] as const satisfies readonly (keyof NormativeDocument)[];

async function verificarAdmin() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false || d.archivado === true) return null;
    const rol = d.rol as RolInterno;
    if (rol !== 'ADMIN') return null;
    return { uid: decoded.uid, nombre: d.nombre as string ?? '', tenantId: d.tenantId as TenantId };
  } catch { return null; }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const admin = await verificarAdmin();
  if (!admin) return NextResponse.json({ error: 'Solo el ADMIN puede modificar documentos normativos.' }, { status: 403 });

  const url = new URL(request.url);
  const coleccion = url.searchParams.get('coleccion') ?? 'normatividad_nacional';
  if (!COLECCIONES_VALIDAS.has(coleccion)) {
    return NextResponse.json({ error: 'Colección inválida.' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  const ahora = new Date().toISOString();
  // Se construye el update campo a campo desde la lista blanca. Lo que el
  // cliente mande y no esté aquí, no llega a Firestore.
  const update: Record<string, unknown> = { updatedAt: ahora };
  for (const campo of CAMPOS_EDITABLES) {
    if (Object.prototype.hasOwnProperty.call(body, campo)) update[campo] = body[campo];
  }

  // Un PATCH que no cambia nada es un error del llamador, no una operación
  // válida: sin esto, escribiría `updatedAt` y nada más.
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'El cuerpo no trae ningún campo modificable.' }, { status: 400 });
  }

  // La constancia de validación la pone el SERVIDOR, nunca el cuerpo.
  if (body.estado === 'interna_validada') {
    update.validado_por     = admin.uid;
    update.fecha_validacion = ahora;
  }

  try {
    await getFirebaseAdminDb().collection(coleccion).doc(id).update(update);
    return NextResponse.json({ ok: true, mensaje: 'Documento actualizado.' });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const url = new URL(_request.url);
  const coleccion = url.searchParams.get('coleccion') ?? 'normatividad_nacional';

  const admin = await verificarAdmin();
  if (!admin) return NextResponse.json({ error: 'Solo el ADMIN puede eliminar documentos.' }, { status: 403 });

  // Un DELETE con la colección tomada del query string borraba documentos de
  // cualquier colección de Firestore. Misma lista blanca que el PATCH.
  if (!COLECCIONES_VALIDAS.has(coleccion)) {
    return NextResponse.json({ error: 'Colección inválida.' }, { status: 400 });
  }

  try {
    await getFirebaseAdminDb().collection(coleccion).doc(id).delete();
    return NextResponse.json({ ok: true, mensaje: 'Documento eliminado.' });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}
