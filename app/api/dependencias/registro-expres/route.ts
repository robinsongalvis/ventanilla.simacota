import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { RadicadoActionError } from '@/lib/server/radicados-security';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import { formatearRadicadoSalida } from '@/lib/salidas/radicado-salida';
import {
  construirPaqueteExpres,
  validarRegistroExpres,
  type EntradaExpres,
} from '@/lib/dependencias/registro-expres';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import type { TenantId } from '@/src/types/radicado';
import { logError } from '@/lib/logger';

/* ══════════════════════════════════════════════════════════════
   Sprint Registro exprés —
   POST /api/dependencias/registro-expres

   El funcionario declara, DESPUÉS de responder desde el correo
   institucional, qué llegó y qué respondió. Este endpoint genera el
   paquete completo con Admin SDK (entrada resuelta + salida amarrada
   + trazabilidad) — FUNCIONARIO/JEFE no pueden crear radicados por
   reglas y las reglas NO cambian: la mutación es server-side, como
   todas las críticas.

   Alcance: FUNCIONARIO y JEFE_DEPENDENCIA solo registran hacia SU
   dependencia; ADMIN/RECEPCIONISTA hacia cualquiera.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

const ROLES_AUTORIZADOS = new Set(['ADMIN', 'RECEPCIONISTA', 'FUNCIONARIO', 'JEFE_DEPENDENCIA']);

interface Body extends Partial<Omit<EntradaExpres, 'dependencia'>> {
  dependencia?: TenantId;
}

function jsonError(error: unknown): NextResponse {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'No fue posible completar el registro exprés.' },
    { status: 500 },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!ROLES_AUTORIZADOS.has(usuario.rol)) {
      return NextResponse.json(
        { error: 'Su rol no puede usar el registro exprés.' },
        { status: 403 },
      );
    }

    let body: Body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
    }

    // FUNCIONARIO/JEFE registran solo hacia su propia dependencia.
    const esRecepcionOAdmin = usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA';
    const dependencia = esRecepcionOAdmin
      ? body.dependencia
      : usuario.tenantId;
    if (!dependencia || !DIRECTORIO_TENANTS[dependencia]) {
      return NextResponse.json({ error: 'Dependencia inválida.' }, { status: 400 });
    }
    if (!esRecepcionOAdmin && body.dependencia && body.dependencia !== usuario.tenantId) {
      return NextResponse.json(
        { error: 'Solo puede registrar correspondencia de su propia dependencia.' },
        { status: 403 },
      );
    }

    const entrada: EntradaExpres = {
      remitenteNombre:  body.remitenteNombre ?? '',
      remitenteEntidad: body.remitenteEntidad ?? null,
      remitenteEmail:   body.remitenteEmail ?? null,
      tipoSolicitudId:  body.tipoSolicitudId ?? 'PETICION_GENERAL',
      asunto:           body.asunto ?? '',
      descripcion:      body.descripcion ?? '',
      fechaLlegada:     body.fechaLlegada ?? '',
      respuestaResumen: body.respuestaResumen ?? '',
      fechaRespuesta:   body.fechaRespuesta ?? '',
      dependencia,
    };

    const ahora = new Date();
    const errorValidacion = validarRegistroExpres(entrada, ahora);
    if (errorValidacion) {
      return NextResponse.json({ error: errorValidacion }, { status: 400 });
    }

    // Consecutivos de ENTRADA y SALIDA en una sola transacción — el
    // paquete exprés nunca queda a medias por numeración.
    const db = getFirebaseAdminDb();
    const year = ahora.getFullYear();
    const refEntrada = db.doc(`counters/radicados-${year}`);
    const refSalida = db.doc(`counters/salidas-${year}`);

    const ids = await db.runTransaction(async (tx) => {
      const [snapEntrada, snapSalida] = await Promise.all([
        tx.get(refEntrada), tx.get(refSalida),
      ]);
      const consecutivoEntrada = Number(snapEntrada.data()?.ultimo ?? 0) + 1;
      const consecutivoSalida = Number(snapSalida.data()?.ultimo ?? 0) + 1;
      const marca = { anio: year, actualizadoEn: ahora.toISOString() };
      tx.set(refEntrada, { ultimo: consecutivoEntrada, ...marca }, { merge: true });
      tx.set(refSalida, { ultimo: consecutivoSalida, ...marca }, { merge: true });
      return {
        consecutivoEntrada,
        consecutivoSalida,
        radicadoId: formatearRadicadoInstitucional(consecutivoEntrada, 'EMAIL', ahora),
        salidaId:   formatearRadicadoSalida(consecutivoSalida, ahora),
      };
    });

    const paquete = construirPaqueteExpres(
      entrada, ids, { uid: usuario.uid, nombre: usuario.nombre }, ahora,
    );

    await db.doc(`ventanilla_radicados/${ids.radicadoId}`).set(
      removeUndefinedDeep(paquete.radicado as unknown as Record<string, unknown>),
    );
    await db.doc(`ventanilla_salidas/${ids.salidaId}`).set(
      removeUndefinedDeep(paquete.salida as unknown as Record<string, unknown>),
    );
    for (const [i, evento] of paquete.eventosEntrada.entries()) {
      await db.collection(`ventanilla_radicados/${ids.radicadoId}/trazabilidad`).add(
        removeUndefinedDeep({
          ...evento,
          eventoId: `ev_${ids.radicadoId}_EXPRES_${i}`,
        } as Record<string, unknown>),
      );
    }

    return NextResponse.json({
      ok: true,
      radicadoId: ids.radicadoId,
      salidaId:   ids.salidaId,
    });
  } catch (error) {
    logError({ radicadoId: '', modulo: 'dependencias/registro-expres', error });
    return jsonError(error);
  }
}
