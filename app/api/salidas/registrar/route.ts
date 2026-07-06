import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { RadicadoActionError } from '@/lib/server/radicados-security';
import { uploadOficioSalidaAdmin } from '@/lib/server/salidas-security';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { formatearRadicadoSalida } from '@/lib/salidas/radicado-salida';
import {
  construirDocSalida,
  construirNotaSalida,
  validarSalida,
  type EntradaSalida,
} from '@/lib/salidas/construir-salida';
import type { MedioEnvioSalida, TipoSalida } from '@/src/types/salida';
import type { TenantId } from '@/src/types/radicado';
import { logError } from '@/lib/logger';

/* ══════════════════════════════════════════════════════════════
   Fase B · PDF adjunto — POST /api/salidas/registrar

   El registro de salidas pasa del cliente al servidor para poder
   adjuntar el oficio firmado en el mismo paso: el documento del libro
   nace COMPLETO (con su archivoPath si trae PDF) y jamás se actualiza
   después — el libro sigue siendo inmutable de verdad.

   Mismo gate de las reglas: solo ADMIN/RECEPCIONISTA registran
   salidas (ventanilla única también de salida). El PDF es opcional.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

function jsonError(error: unknown): NextResponse {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'No fue posible registrar la salida.' },
    { status: 500 },
  );
}

function campo(formData: FormData, nombre: string): string {
  const valor = formData.get(nombre);
  return typeof valor === 'string' ? valor.trim() : '';
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'RECEPCIONISTA') {
      return NextResponse.json(
        { error: 'Su rol no puede registrar salidas.' },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const tipoSalida = campo(formData, 'tipoSalida') as TipoSalida;
    if (tipoSalida !== 'RESPUESTA' && tipoSalida !== 'OFICIO_INDEPENDIENTE') {
      return NextResponse.json({ error: 'Tipo de salida inválido.' }, { status: 400 });
    }

    const entrada: EntradaSalida = {
      tipoSalida,
      radicadoEntradaId: campo(formData, 'radicadoEntradaId') || null,
      destinatario: {
        nombre:    campo(formData, 'destinatarioNombre'),
        entidad:   campo(formData, 'destinatarioEntidad') || null,
        email:     campo(formData, 'destinatarioEmail') || null,
        direccion: campo(formData, 'destinatarioDireccion') || null,
      },
      asunto:            campo(formData, 'asunto'),
      dependenciaOrigen: campo(formData, 'dependenciaOrigen') as TenantId,
      medioEnvio:        (campo(formData, 'medioEnvio') || 'CORREO') as MedioEnvioSalida,
      firmanteNombre:    campo(formData, 'firmanteNombre'),
    };

    const errorValidacion = validarSalida(entrada);
    if (errorValidacion) {
      return NextResponse.json({ error: errorValidacion }, { status: 400 });
    }

    const db = getFirebaseAdminDb();

    // Endurecimiento server-side: una RESPUESTA debe amarrar a una
    // entrada que exista de verdad.
    if (entrada.tipoSalida === 'RESPUESTA' && entrada.radicadoEntradaId) {
      const snapEntrada = await db
        .doc(`ventanilla_radicados/${entrada.radicadoEntradaId}`)
        .get();
      if (!snapEntrada.exists) {
        return NextResponse.json(
          { error: 'El radicado de entrada indicado no existe.' },
          { status: 404 },
        );
      }
    }

    // Consecutivo 2-SAL transaccional (misma mecánica del registro exprés).
    const ahora = new Date();
    const year = ahora.getFullYear();
    const refCounter = db.doc(`counters/salidas-${year}`);
    const { consecutivo, salidaId } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(refCounter);
      const siguiente = Number(snap.data()?.ultimo ?? 0) + 1;
      tx.set(refCounter, {
        ultimo: siguiente,
        anio: year,
        actualizadoEn: ahora.toISOString(),
      }, { merge: true });
      return {
        consecutivo: siguiente,
        salidaId: formatearRadicadoSalida(siguiente, ahora),
      };
    });

    // PDF opcional — se sube ANTES de crear el doc, para que el libro
    // nazca completo y nunca haya que actualizarlo.
    const archivo = formData.get('archivo');
    const oficio = archivo instanceof File && archivo.size > 0
      ? await uploadOficioSalidaAdmin(archivo, salidaId)
      : null;

    const salida = {
      ...construirDocSalida(entrada, salidaId, consecutivo, {
        uid: usuario.uid, nombre: usuario.nombre,
      }, ahora),
      archivoPath:   oficio?.path ?? null,
      archivoNombre: oficio?.nombre ?? null,
    };

    await db.doc(`ventanilla_salidas/${salidaId}`).set(
      removeUndefinedDeep(salida as unknown as Record<string, unknown>),
    );

    // El amarre: la historia del radicado de entrada muestra el despacho.
    if (salida.radicadoEntradaId) {
      await db
        .collection(`ventanilla_radicados/${salida.radicadoEntradaId}/trazabilidad`)
        .add(removeUndefinedDeep({
          eventoId: `ev_${salida.radicadoEntradaId}_SALIDA_${consecutivo}`,
          fecha: ahora.toISOString(),
          accion: 'OFICIO_SALIDA_REGISTRADO',
          actorUid: usuario.uid,
          actorNombre: usuario.nombre,
          nota: construirNotaSalida(
            salidaId,
            salida.destinatario.nombre,
            salida.dependenciaOrigen,
          ),
          metadata: { salidaId, conArchivo: Boolean(oficio) },
        } as Record<string, unknown>));
    }

    return NextResponse.json({ ok: true, salidaId, consecutivo, salida });
  } catch (error) {
    logError({ radicadoId: '', modulo: 'salidas/registrar', error });
    return jsonError(error);
  }
}
