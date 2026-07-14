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
  confirmarConsecutivosLegales,
  leerConsecutivosLegales,
} from '@/lib/server/consecutivo-legal';
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

    // H3 (Bloque 2): consecutivos de ENTRADA y SALIDA + sus documentos en UNA
    // sola transacción → si algo falla, ni los contadores avanzan ni los
    // documentos existen (invariante no-huérfano). Dentro del callback SOLO
    // cómputo puro y tx.set: construirPaqueteExpres es puro; ningún I/O.
    const db = getFirebaseAdminDb();

    const { paquete, ids } = await db.runTransaction(async (tx) => {
      const pendientes = await leerConsecutivosLegales(tx, db, ahora, [
        { serie: 'radicados', formatear: formatearRadicadoInstitucional },
        { serie: 'salidas',   formatear: formatearRadicadoSalida },
      ]);
      const idsTx = {
        consecutivoEntrada: pendientes[0].consecutivo,
        consecutivoSalida:  pendientes[1].consecutivo,
        radicadoId:         pendientes[0].documentoId,
        salidaId:           pendientes[1].documentoId,
      };
      const paqueteTx = construirPaqueteExpres(
        entrada, idsTx, { uid: usuario.uid, nombre: usuario.nombre }, ahora,
      );

      confirmarConsecutivosLegales(tx, ahora, pendientes);
      tx.set(
        db.doc(`ventanilla_radicados/${idsTx.radicadoId}`),
        removeUndefinedDeep(paqueteTx.radicado as unknown as Record<string, unknown>),
      );
      tx.set(
        db.doc(`ventanilla_salidas/${idsTx.salidaId}`),
        removeUndefinedDeep(paqueteTx.salida as unknown as Record<string, unknown>),
      );
      return { paquete: paqueteTx, ids: idsTx };
    });

    // Trazabilidad post-commit. DEUDA declarada (N8-adyacente, fuera del
    // alcance de H3): el evento fundacional no es atómico con el radicado; un
    // fallo aquí deja el radicado válido sin su evento inicial. No introduce
    // fantasma (el consecutivo ya tiene su documento). Ver DEUDA_TECNICA.
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
