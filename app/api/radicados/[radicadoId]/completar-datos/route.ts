import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  getRadicadoOrFail,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  aplicarDatosCompletados,
  construirNotaDatosCompletados,
  type DatosContactoAportados,
} from '@/lib/mostrador/completar-datos';
import { logError } from '@/lib/logger';

/* ══════════════════════════════════════════════════════════════
   Sprint Cierre del mostrador —
   POST /api/radicados/{radicadoId}/completar-datos

   El ciudadano vuelve con los datos de contacto que no aportó al
   radicar. Firestore bloquea todo update desde el cliente
   (`allow update: if false`), así que la mutación pasa por aquí con
   Admin SDK. Whitelist estricta: correo, teléfonos y dirección —
   nombre y documento son la identidad del radicado y NO se tocan.

   Registra evento DATOS_COMPLETADOS con la lista de campos
   aportados, nunca sus valores.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

/** Completar datos es tarea de recepción. */
const ROLES_AUTORIZADOS = new Set(['ADMIN', 'RECEPCIONISTA']);

const REGEX_EMAIL = /^\S+@\S+\.\S+$/;

function jsonError(error: unknown): NextResponse {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'No fue posible completar los datos del solicitante.' },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  let radicadoId = '';
  try {
    const usuario = await requireActiveInternalUser();
    if (!ROLES_AUTORIZADOS.has(usuario.rol)) {
      return NextResponse.json(
        { error: 'Su rol no puede completar datos del solicitante.' },
        { status: 403 },
      );
    }

    radicadoId = (await context.params).radicadoId;

    let body: DatosContactoAportados;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
    }

    const email = (body.email ?? '').trim();
    if (email && !REGEX_EMAIL.test(email)) {
      return NextResponse.json(
        { error: 'El correo aportado no tiene un formato válido.' },
        { status: 400 },
      );
    }

    const radicado = await getRadicadoOrFail(radicadoId);

    // Whitelist explícita: solo estos cuatro campos entran al helper.
    const resultado = aplicarDatosCompletados(radicado.solicitante?.datosNoAportados, {
      email:         body.email,
      telefonoMovil: body.telefonoMovil,
      telefonoFijo:  body.telefonoFijo,
      direccion:     body.direccion,
    });
    if (!resultado) {
      return NextResponse.json(
        { error: 'No se aportó ningún dato válido.' },
        { status: 400 },
      );
    }

    const ahora = new Date();
    const update: Record<string, unknown> = {
      ultimaActualizacion: ahora.toISOString(),
      'solicitante.datosNoAportados': resultado.datosNoAportados ?? FieldValue.delete(),
    };
    for (const [campo, valor] of Object.entries(resultado.cambios)) {
      update[`solicitante.${campo}`] = valor;
    }

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update(update);

    await appendTrazabilidadAdmin(radicadoId, {
      fecha:       ahora.toISOString(),
      accion:      'DATOS_COMPLETADOS',
      actorUid:    usuario.uid,
      actorNombre: usuario.nombre,
      nota:        construirNotaDatosCompletados(resultado.camposAportados),
    });

    return NextResponse.json({ ok: true, camposActualizados: resultado.camposAportados });
  } catch (error) {
    logError({
      radicadoId,
      modulo: 'mostrador/completar-datos',
      error,
    });
    return jsonError(error);
  }
}
