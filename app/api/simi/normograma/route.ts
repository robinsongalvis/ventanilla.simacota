/**
 * GET /api/simi/normograma  — listar documentos normativos
 * POST /api/simi/normograma — crear documento normativo
 *
 * Solo ADMIN puede crear/editar.
 */

import { NextResponse }         from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { NormativeDocument } from '@/src/types/simi-normograma';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';

export const runtime = 'nodejs';

/* ── GET ── */
export async function GET(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;

  const url    = new URL(request.url);
  const coleccion = url.searchParams.get('coleccion') ?? 'normatividad_nacional';
  const limite  = Math.min(Number(url.searchParams.get('limite') ?? '50'), 100);

  const COLECCIONES_VALIDAS = new Set(['normatividad_municipal', 'normatividad_nacional', 'plantillas_respuesta']);
  if (!COLECCIONES_VALIDAS.has(coleccion)) {
    return NextResponse.json({ error: 'Colección inválida.' }, { status: 400 });
  }

  try {
    const db = getFirebaseAdminDb();
    let q = db.collection(coleccion).orderBy('createdAt', 'desc').limit(limite);
    if (coleccion === 'normatividad_municipal') {
      q = db.collection(coleccion)
        .where('tenantId', '==', usuario.tenantId)
        .orderBy('createdAt', 'desc')
        .limit(limite);
    } else if (coleccion === 'plantillas_respuesta') {
      // El filtro simple mantiene el aislamiento sin exigir un índice nuevo.
      // Como la ruta canónica de plantillas, limita el conjunto consultado.
      q = db.collection(coleccion)
        .where('tenantId', '==', usuario.tenantId)
        .limit(limite);
    }
    const snap = await q.get();
    const docs: Array<Record<string, unknown>> = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    if (coleccion === 'plantillas_respuesta') {
      docs.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
    }
    return NextResponse.json({ ok: true, docs, total: docs.length });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}

/* ── POST ── */
export async function POST(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (usuario.rol !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo el ADMIN puede cargar documentos normativos.' }, { status: 403 });
  }

  let body: Partial<NormativeDocument> & { coleccion?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const { coleccion = 'normatividad_municipal', ...docData } = body;
  const COLECCIONES_VALIDAS = new Set(['normatividad_municipal', 'normatividad_nacional']);
  if (!COLECCIONES_VALIDAS.has(coleccion)) {
    return NextResponse.json({ error: 'Colección inválida.' }, { status: 400 });
  }

  if (!docData.titulo || !docData.tipo_norma) {
    return NextResponse.json({ error: 'Campos requeridos: titulo, tipo_norma.' }, { status: 400 });
  }

  const ahora = new Date().toISOString();
  try {
    const ref = await getFirebaseAdminDb().collection(coleccion).add({
      ...docData,
      tenantId:         coleccion === 'normatividad_municipal' ? usuario.tenantId : undefined,
      nivel_confianza:  docData.nivel_confianza ?? 'medio',
      palabras_clave:   docData.palabras_clave ?? [],
      tema:             docData.tema ?? [],
      dependencia_relacionada: docData.dependencia_relacionada ?? [],
      estado:           docData.estado ?? 'pendiente_verificacion',
      validado_por:     docData.estado === 'interna_validada' ? usuario.uid : undefined,
      fecha_validacion: docData.estado === 'interna_validada' ? ahora : undefined,
      createdAt:        ahora,
      updatedAt:        ahora,
    });

    return NextResponse.json({ ok: true, id: ref.id, mensaje: 'Documento cargado correctamente.' });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}
