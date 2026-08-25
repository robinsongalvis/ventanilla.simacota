/* ══════════════════════════════════════════════════════════════
   POST /api/licencias/expedientes/[id]/documentos

   Sube un documento (D7, Bloque A·A2) — multipart: `archivo` +
   `requisitoId?` + `nombre?`. Flujo INV del contrato A1
   (`lib/server/expedientes-documentos-tipos.ts`): staging → transacción
   (versión `vNNNN` determinista + espejo del doc lógico + aporte
   `APORTADO`) → move post-commit (patrón H3, `app/api/radicacion/route.ts`).

   Validación 100% en SERVIDOR (storage.rules queda en `if false` —
   el server es la única defensa, contrato A1): allowlist MIME +
   magic-bytes, 10MB, `sanitizeFilename`, hash SHA-256 sobre los bytes.
══════════════════════════════════════════════════════════════ */

import { calcularCompletitudExpediente } from '@/lib/server/completitud-expediente';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { TenantId } from '@/src/types/radicado';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import {
  validarYPrepararArchivoDocumento,
  validarRequisitoIdContraDefinicion,
  validarRequisitoAplicaContraContexto,
  planSubirDocumento,
} from '@/lib/server/expedientes-documentos';
import { construirStoragePathStaging } from '@/lib/server/expedientes-documentos-tipos';
import { esErrorExpediente, type ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible subir el documento.' }, { status: 500 });
}

function bucketStorage() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error('FIREBASE_STORAGE_BUCKET no configurado.');
  return getFirebaseAdminStorage().bucket(bucketName);
}

/** H3: guarda los bytes en una ruta de Storage (staging previo a la transacción). */
async function guardarEnStorage(buffer: Buffer, path: string, contentType: string): Promise<void> {
  await bucketStorage().file(path).save(buffer, { resumable: false, metadata: { contentType } });
}

/** H3: mueve un objeto de staging a su ruta final tras confirmar la transacción (N8: fallo de move NO revierte metadatos). */
async function moverEnStorage(origen: string, destino: string): Promise<void> {
  await bucketStorage().file(origen).move(destino);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  try {
    const usuario = await requireActiveInternalUser();

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const doc = await expedienteRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = doc.data() as ExpedienteLicenciaDoc;

    if (!canOperateTenant(usuario, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'Tu rol no permite subir documentos a este expediente.' }, { status: 403 });
    }
    if (expediente.estadoJuridico === 'EN_FIRME') {
      return NextResponse.json({ error: 'El expediente está cerrado (EN_FIRME); no admite nuevos documentos.' }, { status: 409 });
    }

    const formData = await request.formData().catch(() => null);
    const archivo = formData?.get('archivo');
    if (!(archivo instanceof File) || archivo.size === 0) {
      return NextResponse.json({ error: 'Debe adjuntar un archivo.' }, { status: 400 });
    }
    if (archivo.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el tamaño máximo de 10 MB.' }, { status: 400 });
    }
    const requisitoIdRaw = formData?.get('requisitoId');
    const requisitoId = typeof requisitoIdRaw === 'string' && requisitoIdRaw.trim() ? requisitoIdRaw.trim() : undefined;
    const nombreRaw = formData?.get('nombre');
    const nombre = typeof nombreRaw === 'string' && nombreRaw.trim() ? nombreRaw.trim() : undefined;

    // requisitoId contra la Definición sembrada (Bloque A·A2 — placeholder
    // hasta que exista resolución de Definición por tramiteId, Fase 1).
    const errorRequisito = validarRequisitoIdContraDefinicion(requisitoId, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL);
    if (errorRequisito) {
      return NextResponse.json({ error: errorRequisito.mensaje }, { status: errorRequisito.status });
    }

    // Defensa en profundidad (endurecimiento pre-reunión, hallazgo QA): si
    // el requisito es CONDICIONAL y su condición evalúa NO_APLICA contra
    // los hechos YA registrados en `expediente.contexto`, el server
    // rechaza — la UI ya lo bloquea, pero no es la única defensa.
    const errorNoAplica = validarRequisitoAplicaContraContexto(requisitoId, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL, expediente.contexto ?? {});
    if (errorNoAplica) {
      return NextResponse.json({ error: errorNoAplica.mensaje }, { status: errorNoAplica.status });
    }

    // H-08: allowlist MIME + magic-bytes + tamaño + sanea nombre + hash
    // SERVER-SIDE — PURA sobre el buffer ya leído.
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const archivoValidado = validarYPrepararArchivoDocumento({
      buffer,
      mimeTypeDeclarado: archivo.type || 'application/octet-stream',
      nombreOriginal: archivo.name,
    });
    if (esErrorExpediente(archivoValidado)) {
      return NextResponse.json({ error: archivoValidado.mensaje }, { status: archivoValidado.status });
    }

    // 1) Staging — ANTES de la transacción (H3): un fallo de subida no
    //    crea versión ni mueve el checklist.
    const requestId = randomUUID();
    const stagingPath = construirStoragePathStaging(requestId, archivoValidado.filenameSaneado);
    await guardarEnStorage(archivoValidado.buffer, stagingPath, archivoValidado.mimeType);

    // 2) Transacción: versión + espejo del doc lógico + aporte, atómico.
    const ahora = new Date();
    const resultado = await db.runTransaction(async (tx) => {
      return planSubirDocumento(
        tx,
        db,
        id,
        expediente.tenantId,
        expediente.aportes ?? [],
        { archivo: archivoValidado, requisitoId, nombre },
        { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol },
        ahora,
      );
    });

    if (resultado.aportesActualizados) {
      // La completitud se recalcula EN EL SERVIDOR con cada cambio de aportes y
      // se guarda junto al expediente. Antes solo existía como etiqueta en una
      // pantalla: dependía de quién estuviera mirando. No bloquea nada todavía
      // —eso lo decide el ADR-0033— pero deja de ser una opinión del navegador.
      await expedienteRef.update({
        aportes: resultado.aportesActualizados,
        completitud: calcularCompletitudExpediente(
          resultado.aportesActualizados,
          expediente.contexto ?? {},
          ahora,
        ),
        actualizadoEn: ahora.toISOString(),
      });
    } else {
      await expedienteRef.update({ actualizadoEn: ahora.toISOString() });
    }

    // 3) Move post-commit (N8: si falla, la versión ya es válida en
    //    Firestore; el binario queda pendiente de conciliación — se
    //    documenta como deuda compartida, ver reporte del bloque).
    try {
      await moverEnStorage(stagingPath, resultado.storagePathFinal);
    } catch (moveErr) {
      logError({ radicadoId: id, modulo: 'licencias/expedientes/documentos/move', error: moveErr });
    }

    return NextResponse.json({
      ok: true,
      documentoId: resultado.documentoId,
      numeroVersion: resultado.numeroVersion,
      documentoNuevo: resultado.documentoNuevo,
      storagePath: resultado.storagePathFinal,
      hashSha256: archivoValidado.hashSha256,
    }, { status: 201 });
  } catch (error) {
    logError({ radicadoId: id, modulo: 'licencias/expedientes/[id]/documentos/POST', error });
    return jsonError(error);
  }
}
