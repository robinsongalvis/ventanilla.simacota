import { NextResponse }         from 'next/server';
import { cookies }              from 'next/headers';
import { SESSION_COOKIE_NAME }  from '@/lib/auth-cookie';
import {
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from '@/lib/firebase-admin';
import { DIRECTORIO_TENANTS }   from '@/src/types/reglas-negocio';
import type { TenantId }        from '@/src/types/radicado';
import type { RolInterno }      from '@/lib/hooks/useAuth';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   Constantes — mismas que en route.ts padre
══════════════════════════════════════════════════════════════ */

const ROLES_VALIDOS: Set<RolInterno> = new Set([
  'ADMIN', 'RECEPCIONISTA', 'FUNCIONARIO', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO',
]);
const TENANTS_VALIDOS: Set<string> = new Set(Object.keys(DIRECTORIO_TENANTS));

/* ══════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════ */

async function verificarAdmin(): Promise<{ uid: string; nombre: string; rol: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const userSnap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!userSnap.exists) return null;
    const data = userSnap.data()!;
    if (data.rol !== 'ADMIN' || data.activo === false) return null;
    return { uid: decoded.uid, nombre: (data.nombre as string) ?? 'Admin', rol: 'ADMIN' };
  } catch {
    return null;
  }
}

interface RouteContext {
  params: Promise<{ uid: string }>;
}

/* ══════════════════════════════════════════════════════════════
   PATCH /api/admin/usuarios/[uid]
   Editar: nombre, cargo, rol, tenantId, activo.
   Cada cambio genera un evento en admin_auditoria.
══════════════════════════════════════════════════════════════ */

interface PatchPayload {
  nombre?:   string;
  cargo?:    string;
  rol?:      RolInterno;
  tenantId?: TenantId;
  activo?:   boolean;
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const admin = await verificarAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const { uid: targetUid } = await context.params;
  if (!targetUid?.trim()) {
    return NextResponse.json({ error: 'UID requerido.' }, { status: 400 });
  }

  let payload: PatchPayload;
  try {
    payload = await request.json() as PatchPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  // Validar valores si están presentes
  if (payload.rol !== undefined && !ROLES_VALIDOS.has(payload.rol)) {
    return NextResponse.json(
      { error: `Rol inválido: ${payload.rol}. Permitidos: ${[...ROLES_VALIDOS].join(', ')}` },
      { status: 400 },
    );
  }
  if (payload.tenantId !== undefined && !TENANTS_VALIDOS.has(payload.tenantId)) {
    return NextResponse.json({ error: `Dependencia inválida: ${payload.tenantId}.` }, { status: 400 });
  }

  const db   = getFirebaseAdminDb();
  const auth = getFirebaseAdminAuth();
  const ahora = new Date().toISOString();

  // Cargar usuario actual para detectar cambios
  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
  }
  const antes = userSnap.data()!;

  try {
    // Construir update parcial
    const update: Record<string, unknown> = { fechaActualizacion: ahora };
    const eventos: { accion: string; metadata: Record<string, unknown> }[] = [];

    if (payload.nombre !== undefined && payload.nombre.trim() !== antes.nombre) {
      update.nombre = payload.nombre.trim();
      eventos.push({ accion: 'USUARIO_EDITADO', metadata: { campo: 'nombre', antes: antes.nombre, despues: payload.nombre.trim() } });
      // Actualizar displayName en Auth
      await auth.updateUser(targetUid, { displayName: payload.nombre.trim() });
    }

    if (payload.cargo !== undefined && payload.cargo.trim() !== (antes.cargo ?? '')) {
      update.cargo = payload.cargo.trim();
      eventos.push({ accion: 'USUARIO_EDITADO', metadata: { campo: 'cargo', antes: antes.cargo ?? '', despues: payload.cargo.trim() } });
    }

    if (payload.rol !== undefined && payload.rol !== antes.rol) {
      update.rol = payload.rol;
      eventos.push({ accion: 'ROL_CAMBIADO', metadata: { rolAnterior: antes.rol, rolNuevo: payload.rol } });
      // Actualizar custom claims
      const currentClaims = { rol: payload.rol, tenantId: payload.tenantId ?? antes.tenantId };
      await auth.setCustomUserClaims(targetUid, currentClaims);
    }

    if (payload.tenantId !== undefined && payload.tenantId !== antes.tenantId) {
      update.tenantId = payload.tenantId;
      eventos.push({ accion: 'DEPENDENCIA_USUARIO_CAMBIADA', metadata: { tenantAnterior: antes.tenantId, tenantNuevo: payload.tenantId } });
      // Actualizar custom claims
      const currentClaims = { rol: payload.rol ?? antes.rol, tenantId: payload.tenantId };
      await auth.setCustomUserClaims(targetUid, currentClaims);
    }

    if (payload.activo !== undefined && payload.activo !== antes.activo) {
      update.activo = payload.activo;
      const accionActivo = payload.activo ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO';
      eventos.push({ accion: accionActivo, metadata: {} });
      // Deshabilitar/habilitar en Firebase Auth
      await auth.updateUser(targetUid, { disabled: !payload.activo });
      if (!payload.activo) {
        await auth.revokeRefreshTokens(targetUid);
      }
    }

    if (Object.keys(update).length <= 1) {
      // Solo fechaActualizacion — nada cambió realmente
      return NextResponse.json({ ok: true, mensaje: 'Sin cambios.' });
    }

    // Aplicar update en Firestore
    await db.doc(`users/${targetUid}`).update(update);

    // Registrar cada evento en admin_auditoria
    const batch = db.batch();
    for (const ev of eventos) {
      const ref = db.collection('admin_auditoria').doc();
      batch.set(ref, {
        actorUid:             admin.uid,
        actorNombre:          admin.nombre,
        actorRol:             admin.rol,
        accion:               ev.accion,
        usuarioAfectadoUid:   targetUid,
        usuarioAfectadoEmail: antes.email ?? '',
        tenantId:             payload.tenantId ?? antes.tenantId,
        fecha:                ahora,
        metadata:             ev.metadata,
      });
    }
    await batch.commit();

    return NextResponse.json({
      ok:      true,
      mensaje: `Usuario actualizado. ${eventos.length} cambio(s) registrado(s).`,
      cambios: eventos.map((e) => e.accion),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/usuarios/[uid]] Error:', msg);
    return NextResponse.json({ error: 'Error al actualizar usuario.' }, { status: 500 });
  }
}

/* ══════════════════════════════════════════════════════════════
   POST /api/admin/usuarios/[uid]
   Acción: reset-password (genera enlace de restablecimiento).
   Body: { accion: "reset-password" }
══════════════════════════════════════════════════════════════ */

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const admin = await verificarAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const { uid: targetUid } = await context.params;
  let body: { accion?: string };
  try {
    body = await request.json() as { accion?: string };
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  if (body.accion !== 'reset-password') {
    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
  }

  const db   = getFirebaseAdminDb();
  const auth = getFirebaseAdminAuth();
  const ahora = new Date().toISOString();

  // Verificar que el usuario existe
  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
  }
  const userData = userSnap.data()!;
  const email = userData.email as string;

  if (!email) {
    return NextResponse.json({ error: 'El usuario no tiene email registrado.' }, { status: 400 });
  }

  try {
    const link = await auth.generatePasswordResetLink(email);

    // Registrar en auditoría
    await db.collection('admin_auditoria').add({
      actorUid:             admin.uid,
      actorNombre:          admin.nombre,
      actorRol:             admin.rol,
      accion:               'PASSWORD_RESET_SOLICITADO',
      usuarioAfectadoUid:   targetUid,
      usuarioAfectadoEmail: email,
      tenantId:             userData.tenantId ?? '',
      fecha:                ahora,
      metadata:             {},
    });

    return NextResponse.json({
      ok:   true,
      link,
      mensaje: `Enlace de restablecimiento generado para ${email}.`,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/usuarios/[uid]/reset-password] Error:', msg);
    return NextResponse.json({ error: 'Error al generar enlace de restablecimiento.' }, { status: 500 });
  }
}
