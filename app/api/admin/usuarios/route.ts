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
   Constantes de validación — roles y tenants cerrados
══════════════════════════════════════════════════════════════ */

const ROLES_VALIDOS: Set<RolInterno> = new Set([
  'ADMIN', 'RECEPCIONISTA', 'FUNCIONARIO', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO',
]);

const TENANTS_VALIDOS: Set<string> = new Set(Object.keys(DIRECTORIO_TENANTS));
const TIPOS_USUARIO_VALIDOS = new Set(['INSTITUCIONAL', 'UAT', 'PRUEBA']);
const DOMINIOS_INSTITUCIONALES = ['@simacota-santander.gov.co', '@simacota.gov.co'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ══════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════ */

/** Verifica sesión + rol ADMIN. Retorna uid/nombre del admin o null. */
async function verificarAdmin(): Promise<{ uid: string; nombre: string; rol: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    // checkRevoked=false: la cookie httpOnly ya es suficiente garantía.
    // El check de revocación causa falsos 401 tras revokeRefreshTokens en logout.
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, false);
    const uid = decoded.uid;

    const userSnap = await getFirebaseAdminDb().doc(`users/${uid}`).get();
    if (!userSnap.exists) return null;

    const data = userSnap.data()!;
    if (data.rol !== 'ADMIN' || data.activo === false || data.archivado === true) return null;

    return { uid, nombre: (data.nombre as string) ?? 'Admin', rol: data.rol as string };
  } catch (err) {
    console.error('[verificarAdmin]', err instanceof Error ? err.message : String(err));
    return null;
  }
}


/* ══════════════════════════════════════════════════════════════
   GET /api/admin/usuarios — Listar usuarios internos
   Solo ADMIN.
══════════════════════════════════════════════════════════════ */

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await verificarAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const incluirArchivados = url.searchParams.get('incluirArchivados') === '1';
    const snap = await getFirebaseAdminDb().collection('users').get();
    const usuarios = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid:                 d.id,
        nombre:              data.nombre    ?? '',
        email:               data.email     ?? '',
        cargo:               data.cargo     ?? '',
        rol:                 data.rol       ?? 'FUNCIONARIO',
        tenantId:            data.tenantId  ?? 'VENTANILLA_UNICA',
        activo:              data.activo    ?? true,
        archivado:           data.archivado ?? false,
        tipoUsuario:         data.tipoUsuario ?? (data.esPrueba ? 'PRUEBA' : 'INSTITUCIONAL'),
        esPrueba:            data.esPrueba ?? false,
        ultimoAcceso:         data.ultimoAcceso ?? null,
        fechaCreacion:       data.fechaCreacion       ?? null,
        fechaActualizacion:  data.fechaActualizacion  ?? null,
      };
    }).filter((u) => incluirArchivados || !u.archivado);

    return NextResponse.json({ usuarios });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/usuarios] Error al listar:', msg);
    return NextResponse.json({ error: 'Error al listar usuarios.' }, { status: 500 });
  }
}

/* ══════════════════════════════════════════════════════════════
   POST /api/admin/usuarios — Crear usuario interno
   Solo ADMIN. Crea en Firebase Auth + Firestore + auditoría.
══════════════════════════════════════════════════════════════ */

interface CrearUsuarioPayload {
  nombre:    string;
  email:     string;
  cargo:     string;
  rol:       RolInterno;
  tenantId:  TenantId;
  password:  string;
  tipoUsuario?: 'INSTITUCIONAL' | 'UAT' | 'PRUEBA';
  activo?: boolean;
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await verificarAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  // Parsear payload
  let payload: CrearUsuarioPayload;
  try {
    payload = await request.json() as CrearUsuarioPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const { nombre, email, cargo, rol, tenantId, password } = payload;
  const tipoUsuario = payload.tipoUsuario ?? 'INSTITUCIONAL';
  const activo = payload.activo ?? true;
  const emailNormalizado = email?.trim().toLowerCase();
  const emailInstitucional = DOMINIOS_INSTITUCIONALES.some((dominio) => emailNormalizado?.endsWith(dominio));

  // Validaciones
  if (!nombre?.trim() || !email?.trim() || !rol || !tenantId || !password) {
    return NextResponse.json(
      { error: 'Campos requeridos: nombre, email, rol, tenantId, password.' },
      { status: 400 },
    );
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
  }

  if (!ROLES_VALIDOS.has(rol)) {
    return NextResponse.json(
      { error: `Rol inválido: ${rol}. Permitidos: ${[...ROLES_VALIDOS].join(', ')}` },
      { status: 400 },
    );
  }

  if (!TENANTS_VALIDOS.has(tenantId)) {
    return NextResponse.json(
      { error: `Dependencia inválida: ${tenantId}.` },
      { status: 400 },
    );
  }

  if (!TIPOS_USUARIO_VALIDOS.has(tipoUsuario)) {
    return NextResponse.json(
      { error: `Tipo de usuario inválido: ${tipoUsuario}.` },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres.' },
      { status: 400 },
    );
  }

  const auth = getFirebaseAdminAuth();
  const db   = getFirebaseAdminDb();
  const ahora = new Date().toISOString();

  try {
    // 1. Crear en Firebase Auth
    const userRecord = await auth.createUser({
      email:       emailNormalizado,
      password,
      displayName: nombre.trim(),
      disabled:    !activo,
    });

    const uid = userRecord.uid;

    // 2. Set custom claims
    await auth.setCustomUserClaims(uid, { rol, tenantId });

    // 3. Crear documento en Firestore /users/{uid}
    await db.doc(`users/${uid}`).set({
      uid,
      nombre:           nombre.trim(),
      email:            email.trim().toLowerCase(),
      cargo:            cargo?.trim() ?? '',
      rol,
      tenantId,
      activo,
      archivado:        false,
      tipoUsuario,
      esPrueba:         tipoUsuario !== 'INSTITUCIONAL',
      emailInstitucional,
      fechaCreacion:    ahora,
      creadoPorUid:     admin.uid,
      creadoPorNombre:  admin.nombre,
    });

    // 4. Registrar en admin_auditoria
    await db.collection('admin_auditoria').add({
      actorUid:             admin.uid,
      actorNombre:          admin.nombre,
      actorRol:             admin.rol,
      accion:               'USUARIO_CREADO',
      usuarioAfectadoUid:   uid,
      usuarioAfectadoEmail: emailNormalizado,
      tenantId,
      fecha:                ahora,
      metadata: {
        rolNuevo:            rol,
        dependenciaNueva:    tenantId,
        tipoUsuario,
        activo,
        emailInstitucional,
        cargo:               cargo?.trim() ?? '',
      },
    });

    return NextResponse.json({
      ok:  true,
      uid,
      mensaje: `Usuario ${nombre.trim()} creado exitosamente.`,
      advertencia: emailInstitucional ? null : 'El correo no parece institucional. Verifique que sea autorizado para UAT.',
    });

  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err?.code;
    console.error('[admin/usuarios] Error al crear:', err);

    if (
      code === 'auth/email-already-exists' ||
      msg.includes('email-already-exists') ||
      msg.includes('EMAIL_EXISTS') ||
      msg.includes('already in use')
    ) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese correo electrónico.' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: 'Error al crear el usuario. Intente nuevamente.' },
      { status: 500 },
    );
  }
}
