/**
 * GET /api/simi/plantillas  — listar plantillas del tenant
 * POST /api/simi/plantillas — crear plantilla (ADMIN) o sembrar base
 */

import { NextResponse }        from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { seedBaseTemplates }   from '@/lib/simi-juridico/baseTemplates';
import type { ResponseTemplate } from '@/src/types/simi-normograma';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;

  const url        = new URL(request.url);
  const modoSimi   = url.searchParams.get('modo') ?? undefined;
  const dependencia = url.searchParams.get('dependencia') ?? undefined;

  try {
    const db = getFirebaseAdminDb();
    const q = db.collection('plantillas_respuesta')
      .where('tenantId', '==', usuario.tenantId)
      .where('estado', '==', 'activa')
      .limit(50);

    const snap = await q.get();
    let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResponseTemplate));

    // Filtrar en memoria para evitar índices compuestos
    if (modoSimi)    docs = docs.filter((d) => d.modo_simi === modoSimi || d.modo_simi === 'TODOS');
    if (dependencia) docs = docs.filter((d) => d.dependencia === dependencia || d.dependencia === 'TODAS');

    return NextResponse.json({ ok: true, plantillas: docs, total: docs.length });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (usuario.rol !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo el ADMIN puede crear plantillas.' }, { status: 403 });
  }

  let body: Partial<ResponseTemplate> & { accion?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  // Acción especial: sembrar plantillas base
  if (body.accion === 'seed_base_templates') {
    const result = await seedBaseTemplates(usuario.tenantId, usuario.uid);
    return NextResponse.json({ ok: true, ...result, mensaje: `${result.cargadas} plantillas base cargadas.` });
  }

  // Crear plantilla nueva
  const docData = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== 'accion'),
  ) as Partial<ResponseTemplate>;
  if (!docData.nombre || !docData.contenido) {
    return NextResponse.json({ error: 'Campos requeridos: nombre, contenido.' }, { status: 400 });
  }

  const ahora = new Date().toISOString();
  try {
    const ref = await getFirebaseAdminDb().collection('plantillas_respuesta').add({
      ...docData,
      tenantId:         usuario.tenantId,
      estado:           docData.estado ?? 'activa',
      version:          docData.version ?? '1.0',
      variables:        docData.variables ?? [],
      riesgo_aplicable: docData.riesgo_aplicable ?? 'todos',
      requiere_revision_juridica: docData.requiere_revision_juridica ?? false,
      validado_por:     usuario.uid,
      fecha_validacion: ahora,
      createdAt:        ahora,
      updatedAt:        ahora,
    });
    return NextResponse.json({ ok: true, id: ref.id, mensaje: 'Plantilla creada correctamente.' });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}
