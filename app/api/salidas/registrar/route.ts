import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { RadicadoActionError } from '@/lib/server/radicados-security';
import { moverOficioSalida, uploadOficioSalidaAdmin } from '@/lib/server/salidas-security';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { formatearRadicadoSalida } from '@/lib/salidas/radicado-salida';
import {
  confirmarConsecutivosLegales,
  leerConsecutivosLegales,
} from '@/lib/server/consecutivo-legal';
import { randomUUID } from 'node:crypto';
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

    // H3 (Bloque 2): staging → transacción → finalize.
    // 1) PDF opcional a STAGING: valida y sube ANTES de consumir el consecutivo
    //    (un PDF inválido no crea salida ni gasta número).
    const ahora = new Date();
    const requestId = randomUUID();
    const archivo = formData.get('archivo');
    const oficioStaged = archivo instanceof File && archivo.size > 0
      ? await uploadOficioSalidaAdmin(archivo, `salidas/_pendientes/${requestId}`)
      : null;

    // 2) Consecutivo 2-SAL + documento del libro en UNA transacción (atómico).
    //    El libro nace COMPLETO (con su archivoPath final) y nunca se actualiza.
    //    Dentro del callback SOLO cómputo puro y tx.set; ningún I/O.
    const { consecutivo, salidaId, salida } = await db.runTransaction(async (tx) => {
      const [consec] = await leerConsecutivosLegales(tx, db, ahora, [
        { serie: 'salidas', formatear: formatearRadicadoSalida },
      ]);
      const salidaId = consec.documentoId;
      const consecutivo = consec.consecutivo;
      const salida = {
        ...construirDocSalida(entrada, salidaId, consecutivo, {
          uid: usuario.uid, nombre: usuario.nombre,
        }, ahora),
        archivoPath:   oficioStaged ? `salidas/${salidaId}/${oficioStaged.filename}` : null,
        archivoNombre: oficioStaged?.nombre ?? null,
      };
      confirmarConsecutivosLegales(tx, ahora, [consec]);
      tx.set(
        db.doc(`ventanilla_salidas/${salidaId}`),
        removeUndefinedDeep(salida as unknown as Record<string, unknown>),
      );
      return { consecutivo, salidaId, salida };
    });

    // 3) Finalize: mover el oficio de staging a su ruta final (post-commit; la
    //    salida ya es válida — un fallo de move NO crea fantasma; N8 concilia
    //    luego, deuda declarada).
    if (oficioStaged) {
      await moverOficioSalida(
        oficioStaged.path,
        `salidas/${salidaId}/${oficioStaged.filename}`,
      ).catch((error) => logError({ radicadoId: '', modulo: 'salidas/finalize-oficio', error }));
    }

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
          metadata: { salidaId, conArchivo: Boolean(oficioStaged) },
        } as Record<string, unknown>));
    }

    return NextResponse.json({ ok: true, salidaId, consecutivo, salida });
  } catch (error) {
    logError({ radicadoId: '', modulo: 'salidas/registrar', error });
    return jsonError(error);
  }
}
