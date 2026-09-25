import { NextResponse } from 'next/server';
import { autorizarAuditor } from '../_auth';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import type { TenantId } from '@/src/types/radicado';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const ROLES_RESPONSABLES = new Set(['FUNCIONARIO', 'JEFE_DEPENDENCIA', 'RECEPCIONISTA']);

interface PerfilResponsable {
  uid:        string;
  nombre?:    unknown;
  cargo?:     unknown;
  email?:     unknown;
  rol?:       unknown;
  activo?:    unknown;
  archivado?: unknown;
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  const tenantId = new URL(request.url).searchParams.get('tenantId') as TenantId | null;
  if (!tenantId || !(tenantId in DIRECTORIO_TENANTS)) {
    return NextResponse.json({ error: 'Seleccione una dependencia válida.' }, { status: 400 });
  }

  try {
    const snap = await getFirebaseAdminDb()
      .collection('users')
      .where('tenantId', '==', tenantId)
      .limit(100)
      .get();

    const responsables = snap.docs
      .map((doc): PerfilResponsable => ({
        uid: doc.id,
        ...(doc.data() as Omit<PerfilResponsable, 'uid'>),
      }))
      .filter((user) => user.activo !== false && user.archivado !== true && ROLES_RESPONSABLES.has(String(user.rol)))
      .map((user) => ({
        uid: user.uid,
        nombre: typeof user.nombre === 'string' ? user.nombre : 'Usuario sin nombre',
        cargo: typeof user.cargo === 'string' ? user.cargo : null,
        email: typeof user.email === 'string' ? user.email : '',
        rol: String(user.rol),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return NextResponse.json({ ok: true, responsables });
  } catch (err) {
    // PT-2/D5 (24-ago-2026): antes este catch devolvía 500 sin dejar UN solo
    // rastro — si Control Interno fallaba en producción, no había ni una
    // línea para diagnosticar (y el error atrapado tampoco llega a Sentry
    // por onRequestError). logError registra estructurado Y reporta a
    // Sentry cuando el DSN esté vivo; el cliente recibe mensaje genérico.
    logError({ radicadoId: '', modulo: 'control-interno/responsables', error: err });
    return NextResponse.json(
      { error: 'No fue posible cargar los responsables de la dependencia.' },
      { status: 500 },
    );
  }
}
