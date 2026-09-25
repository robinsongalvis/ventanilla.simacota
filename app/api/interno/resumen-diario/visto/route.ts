import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { requireActiveInternalUser, InternalAuthError } from '@/lib/server/internal-auth';
import { nowColombia, TIMEZONE_COLOMBIA } from '@/lib/fecha-colombia';

export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma:          'no-cache',
  Expires:         '0',
};

function jsonSeguro(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function getColombiaDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: TIMEZONE_COLOMBIA });
}

interface VistoPayload {
  fecha: string;
  cantidadAlertas?: number;
}

export async function POST(request: Request): Promise<NextResponse> {
  let session;
  try {
    session = await requireActiveInternalUser();
  } catch (err) {
    if (err instanceof InternalAuthError) {
      return jsonSeguro(
        { error: err.status === 401 ? 'Debe iniciar sesión nuevamente.' : 'No tiene permiso para realizar esta acción.' },
        err.status,
      );
    }
    return jsonSeguro({ error: 'Debe iniciar sesión nuevamente.' }, 401);
  }

  let body: VistoPayload;
  try {
    body = (await request.json()) as VistoPayload;
  } catch {
    return jsonSeguro({ error: 'Payload inválido.' }, 400);
  }

  const { fecha, cantidadAlertas } = body;
  if (!fecha || typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return jsonSeguro({ error: 'La fecha es obligatoria y debe ser YYYY-MM-DD.' }, 400);
  }

  try {
    const db = getFirebaseAdminDb();
    const ahora = nowColombia();
    const colombiaTodayStr = getColombiaDateString(ahora);

    // Validación opcional: verificar que la fecha del payload no esté muy distante
    // de la fecha de Colombia. En general, aceptamos la fecha de Colombia.
    if (fecha !== colombiaTodayStr) {
      return jsonSeguro({ error: 'La fecha no corresponde al día actual en Colombia.' }, 400);
    }

    const docId = `${session.uid}_${fecha}`;
    const docRef = db.collection('notificaciones_resumen_diario').doc(docId);

    const vistoData = {
      uid: session.uid,
      fechaColombia: fecha,
      vistoEn: ahora.toISOString(),
      cerradoPorUsuario: true,
      cantidadAlertas: typeof cantidadAlertas === 'number' ? cantidadAlertas : 0,
      versionResumen: '1.0',
    };

    await docRef.set(vistoData, { merge: true });

    return jsonSeguro({ ok: true });
  } catch {
    return jsonSeguro({ error: 'No se pudo guardar el registro de visto.' }, 500);
  }
}
