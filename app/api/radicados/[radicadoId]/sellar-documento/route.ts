import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  getRadicadoOrFail,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import { verificarMagicBytes } from '@/lib/seguridad/magic-bytes';
import { sellarPrimeraPagina, SelloPDFError } from '@/lib/sello/generar-sello-pdf';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';
import { cargarLogo } from '@/lib/sello/cargar-logo';
import { logError } from '@/lib/logger';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import type { SelloDocumento } from '@/src/types/ventanilla';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 3 —
   POST /api/radicados/{radicadoId}/sellar-documento

   Descarga el archivo original desde `radicados/{id}/{path}`, aplica
   sello en la primera página, sube copia sellada a
   `sellados/{id}/{timestamp}_{nombre}`, actualiza Firestore con la
   referencia y registra evento `DOCUMENTO_SELLADO` con hashes SHA-256
   de original y sellado como evidencia de cadena de custodia.

   El archivo original NUNCA se modifica ni se sobreescribe.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

interface Payload {
  /** Path del archivo original en Storage (radicados/{id}/{filename}). */
  archivoPath?: string;
}

const ROLES_AUTORIZADOS = new Set(['ADMIN', 'RECEPCIONISTA', 'FUNCIONARIO', 'JEFE_DEPENDENCIA']);

function jsonError(error: unknown): NextResponse {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SelloPDFError) {
    const status = error.codigo === 'CIFRADO' ? 422 : 400;
    return NextResponse.json({ error: error.message, codigo: error.codigo }, { status });
  }
  return NextResponse.json({ error: 'No fue posible sellar el documento.' }, { status: 500 });
}

function sanitizeSelloName(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_.\- ]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'documento.pdf';
}

function sha256Hex(bytes: Uint8Array | Buffer): string {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash('sha256').update(buf).digest('hex');
}


export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!ROLES_AUTORIZADOS.has(usuario.rol)) {
      return NextResponse.json(
        { error: 'Rol sin permisos para sellar documentos.' },
        { status: 403 },
      );
    }

    const { radicadoId } = await context.params;
    const payload = await request.json().catch(() => null) as Payload | null;
    const archivoPath = payload?.archivoPath?.trim();

    if (!archivoPath || !archivoPath.startsWith(`radicados/${radicadoId}/`)) {
      return NextResponse.json(
        { error: 'archivoPath inválido o no pertenece al radicado.' },
        { status: 400 },
      );
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return NextResponse.json(
        { error: 'Storage no configurado en el servidor.' },
        { status: 500 },
      );
    }

    // Validar que el archivo esté referenciado en el radicado (evita
    // que un funcionario selle archivos que no pertenecen al doc).
    const radicado = await getRadicadoOrFail(radicadoId);
    const archivo = (radicado.archivos ?? []).find((a) => a.path === archivoPath);
    if (!archivo) {
      return NextResponse.json(
        { error: 'El archivo no pertenece al radicado.' },
        { status: 404 },
      );
    }
    if (archivo.tipo !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Solo se pueden sellar archivos PDF por ahora.' },
        { status: 400 },
      );
    }

    // Descargar bytes originales.
    const bucket = getFirebaseAdminStorage().bucket(bucketName);
    let bytesOriginal: Buffer;
    try {
      [bytesOriginal] = await bucket.file(archivoPath).download();
    } catch (err) {
      logError({
        radicadoId,
        modulo: 'sello/download-original',
        error:  err,
      });
      return NextResponse.json(
        { error: 'No fue posible leer el documento original desde Storage.' },
        { status: 502 },
      );
    }

    // Defensa: el content-type es falsificable — validamos magic bytes.
    if (!verificarMagicBytes(bytesOriginal, 'application/pdf')) {
      return NextResponse.json(
        { error: 'El archivo original no es un PDF válido.' },
        { status: 400 },
      );
    }

    const hashOriginal = sha256Hex(bytesOriginal);
    const logoPng = await cargarLogo();
    const ahora = new Date();

    // Sellar (puede lanzar SelloPDFError → jsonError lo mapea).
    const resultado = await sellarPrimeraPagina(new Uint8Array(bytesOriginal), {
      radicadoId,
      fechaHoraLegible: formatFechaHoraColombia(ahora),
      logoPng,
    });

    const hashSellado = sha256Hex(resultado.bytes);
    const nombreSellado = `${Date.now()}_${sanitizeSelloName(archivo.nombre)}`;
    const pathSellado = `sellados/${radicadoId}/${nombreSellado}`;

    // Subir copia sellada.
    try {
      await bucket
        .file(pathSellado)
        .save(Buffer.from(resultado.bytes), {
          resumable: false,
          metadata: {
            contentType: 'application/pdf',
            metadata: {
              hashOriginal,
              hashSellado,
              archivoOriginalPath: archivoPath,
              actorUid: usuario.uid,
              radicadoId,
            },
          },
        });
    } catch (err) {
      logError({
        radicadoId,
        modulo: 'sello/upload-sellado',
        error:  err,
      });
      return NextResponse.json(
        { error: 'No fue posible guardar la copia sellada.' },
        { status: 502 },
      );
    }

    const sello: SelloDocumento = {
      path:              pathSellado,
      nombre:            nombreSellado,
      tamanioKB:         Math.max(1, Math.round(resultado.bytes.byteLength / 1024)),
      fecha:             ahora.toISOString(),
      actorUid:          usuario.uid,
      hashOriginal,
      hashSellado,
      paginasEstampadas: resultado.paginasEstampadas,
    };

    // Actualizar `archivos[]` en Firestore: reemplaza solo el sub-campo
    // `sellado` del archivo correspondiente. Usamos transacción para
    // evitar race si dos funcionarias sellan al mismo tiempo.
    try {
      const docRef = getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`);
      await getFirebaseAdminDb().runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) {
          throw new RadicadoActionError('Radicado no encontrado.', 404);
        }
        const data = snap.data() as { archivos?: typeof radicado.archivos };
        const archivosActuales = data.archivos ?? [];
        const archivosNuevos = archivosActuales.map((a) =>
          a.path === archivoPath ? { ...a, sellado: sello } : a,
        );
        tx.update(docRef, removeUndefinedDeep({
          archivos:            archivosNuevos,
          ultimaActualizacion: ahora.toISOString(),
        }));
      });
    } catch (err) {
      if (err instanceof RadicadoActionError) throw err;
      logError({
        radicadoId,
        modulo: 'sello/actualizar-firestore',
        error:  err,
      });
      return NextResponse.json(
        { error: 'No fue posible registrar la copia sellada en el radicado.' },
        { status: 500 },
      );
    }

    // Trazabilidad.
    try {
      await appendTrazabilidadAdmin(radicadoId, {
        fecha:       ahora.toISOString(),
        accion:      'DOCUMENTO_SELLADO',
        actorUid:    usuario.uid,
        actorNombre: usuario.nombre,
        nota:        `Documento "${archivo.nombre}" sellado por Ventanilla.`,
        metadata: {
          archivoOriginalPath: archivoPath,
          archivoSelladoPath:  pathSellado,
          hashOriginal,
          hashSellado,
          paginasEstampadas:   resultado.paginasEstampadas,
          tamanioSelladoKB:    sello.tamanioKB,
        },
      });
    } catch {
      // Trazabilidad nunca interrumpe el flujo principal.
    }

    return NextResponse.json({
      ok: true,
      sello,
    });
  } catch (error) {
    return jsonError(error);
  }
}
