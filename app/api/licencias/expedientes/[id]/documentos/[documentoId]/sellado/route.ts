/**
 * GET /api/licencias/expedientes/[id]/documentos/[documentoId]/sellado
 *
 * Devuelve una URL firmada a la COPIA SELLADA de un documento del expediente:
 * el número de radicado y la fecha estampados en cada página, como el sello
 * físico sobre la copia que el ciudadano se lleva del mostrador.
 *
 * ── EL ORIGINAL NO SE TOCA ────────────────────────────────────────────────
 *
 * `sellarTodasLasPaginas` trabaja sobre los bytes en memoria y devuelve otros;
 * el archivo original en Storage no se abre para escritura en ningún momento.
 * La copia vive en un prefijo aparte, `sellados/`.
 *
 * ── MATERIALIZACIÓN PEREZOSA, Y POR QUÉ NO LAS OTRAS DOS ──────────────────
 *
 * Hoy la descarga normal es un `302` a una URL firmada: los bytes van de
 * Storage al navegador SIN pasar por el servidor. Sellar «al vuelo» obligaría a
 * meter cada descarga por la función —hasta 10 MB de entrada más 10 MB de
 * salida, cada vez—, rompiendo ese patrón. Materializar SIEMPRE duplicaría el
 * almacenamiento de documentos que nadie va a imprimir.
 *
 * Así que se sella la PRIMERA vez que alguien lo pide y se guarda; a partir de
 * ahí es un `302` como cualquier otro.
 *
 * ── LA COPIA ES UN DERIVADO DESECHABLE ────────────────────────────────────
 *
 * El original es el expediente y es lo único que se respalda: `sellados/` está
 * EXCLUIDO del respaldo de adjuntos, como exclusión declarada con su razón. Si
 * se pierde, se regenera pidiéndola otra vez. Nunca es prueba de nada que el
 * original no diga.
 *
 * La ruta de la copia lleva el HASH de la versión (`{hash}.pdf`), no un nombre
 * fijo: una versión nueva del documento produce una copia nueva, y es imposible
 * servir un sello viejo sobre un contenido que cambió.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * QUÉ SELLA: PDF, y nada más.
 * QUÉ NO, Y SE DICE EN LA RESPUESTA: JPG, PNG, WEBP, DOCX, XLSX y PPTX — el
 * expediente los admite y el sello no existe para ellos. Se responde 415 con el
 * motivo escrito, para que la pantalla pueda explicarlo en vez de ofrecer un
 * botón que aparece y desaparece sin razón visible.
 */
import { NextResponse } from 'next/server';
import type { TenantId } from '@/src/types/radicado';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { sellarTodasLasPaginas, SelloPDFError } from '@/lib/sello/generar-sello-pdf';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const MIME_SELLABLE = 'application/pdf';
const URL_EXPIRA_MS = 10 * 60 * 1000;

/** Prefijo de las copias selladas. EXCLUIDO del respaldo: derivado regenerable. */
export const PREFIJO_SELLADOS = 'sellados/expedientes';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentoId: string }> },
): Promise<NextResponse> {
  const { id, documentoId } = await params;
  try {
    const sesion = await requireActiveInternalUser();
    const db = getFirebaseAdminDb();

    const expSnap = await db.doc(`expedientes/${id}`).get();
    if (!expSnap.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = expSnap.data() as ExpedienteLicenciaDoc;
    if (!canOperateTenant(sesion, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'No tiene permiso sobre este expediente.' }, { status: 403 });
    }

    const docSnap = await db.doc(`expedientes/${id}/documentos/${documentoId}`).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }
    const documento = docSnap.data() as {
      storagePath?: string;
      mimeType?: string;
      hashSha256?: string;
      nombreOriginal?: string;
    };

    /* EL ALCANCE, DICHO AL LLAMADOR. No un botón que desaparece: un motivo. */
    if (documento.mimeType !== MIME_SELLABLE) {
      return NextResponse.json(
        {
          error:
            'El sello solo puede estamparse sobre archivos PDF. ' +
            `Este documento es ${documento.mimeType ?? 'de tipo desconocido'}, ` +
            'y para imágenes y ofimática no existe un sello equivalente.',
          motivo: 'TIPO_NO_SELLABLE',
          mimeType: documento.mimeType ?? null,
        },
        { status: 415 },
      );
    }
    if (!documento.storagePath || !documento.hashSha256) {
      return NextResponse.json(
        { error: 'El documento no tiene un archivo asociado que se pueda sellar.' },
        { status: 409 },
      );
    }

    /* EL NÚMERO QUE SE ESTAMPA es el del expediente, que desde #252 ES el del
       libro de ventanilla. Sin número legal no se sella: estampar un `DEMO-` en
       el papel que se lleva el ciudadano sería peor que no sellarlo. */
    const numero = expediente.numeroExpediente?.numero;
    if (!numero || expediente.numeroExpediente?.serieId === 'demo') {
      return NextResponse.json(
        {
          error:
            'Este expediente todavía no tiene número de la serie legal, así que no hay ' +
            'número que estampar. El sello se puede generar una vez radicado en debida forma.',
          motivo: 'SIN_NUMERO_LEGAL',
        },
        { status: 409 },
      );
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      logError({ radicadoId: id, modulo: 'sello-expediente/config', error: new Error('FIREBASE_STORAGE_BUCKET ausente') });
      return NextResponse.json({ error: 'Almacenamiento no configurado en el servidor.' }, { status: 500 });
    }
    const bucket = getFirebaseAdminStorage().bucket(bucketName);

    /* La ruta lleva el HASH de la versión: contenido distinto ⇒ copia distinta.
       Es imposible servir un sello viejo sobre un documento que cambió. */
    const pathSellado = `${PREFIJO_SELLADOS}/${id}/${documentoId}/${documento.hashSha256}.pdf`;
    const archivoSellado = bucket.file(pathSellado);

    const [yaExistia] = await archivoSellado.exists();
    let paginasEstampadas: number | null = null;
    let paginasSinSello: number[] = [];
    let totalPaginas: number | null = null;

    if (!yaExistia) {
      let bytesOriginal: Buffer;
      try {
        [bytesOriginal] = await bucket.file(documento.storagePath).download();
      } catch (error) {
        logError({ radicadoId: id, modulo: 'sello-expediente/descarga-original', error });
        return NextResponse.json(
          { error: 'No fue posible leer el documento original.' },
          { status: 502 },
        );
      }

      try {
        const resultado = await sellarTodasLasPaginas(new Uint8Array(bytesOriginal), {
          radicadoId: numero,
          fechaHoraLegible: formatFechaHoraColombia(
            expediente.fechaRadicacionDebidaForma ?? expediente.creadoEn,
          ),
        });
        paginasEstampadas = resultado.paginasEstampadas;
        paginasSinSello = resultado.paginasSinSello;
        totalPaginas = resultado.totalPaginas;

        await archivoSellado.save(Buffer.from(resultado.bytes), {
          contentType: MIME_SELLABLE,
          resumable: false,
          metadata: {
            /* Marcado como derivado para que nadie lo confunda con el original
               al mirar el bucket. */
            metadata: { derivadoDe: documento.storagePath, regenerable: 'true' },
          },
        });
      } catch (error) {
        if (error instanceof SelloPDFError) {
          return NextResponse.json({ error: error.message, motivo: error.codigo }, { status: 422 });
        }
        logError({ radicadoId: id, modulo: 'sello-expediente/sellado', error });
        return NextResponse.json({ error: 'No fue posible sellar el documento.' }, { status: 500 });
      }
    }

    const [url] = await archivoSellado.getSignedUrl({
      action: 'read',
      expires: Date.now() + URL_EXPIRA_MS,
    });

    console.info('[ventanilla:audit]', JSON.stringify({
      evento: 'DOCUMENTO_SELLADO_ENTREGADO',
      expedienteId: id,
      documentoId,
      generadoAhora: !yaExistia,
      actorUid: sesion.uid,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json(
      {
        url,
        nombreSugerido: `sellado-${documento.nombreOriginal ?? 'documento.pdf'}`,
        /* `null` cuando la copia ya existía: no se volvió a sellar, así que no
           se sabe —ni se inventa— cuántas páginas se estamparon entonces. */
        paginasEstampadas,
        totalPaginas,
        paginasSinSello,
        yaExistia,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId: id, modulo: 'sello-expediente', error });
    return NextResponse.json({ error: 'No fue posible preparar el documento sellado.' }, { status: 500 });
  }
}
