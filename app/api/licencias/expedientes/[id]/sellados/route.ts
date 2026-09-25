/**
 * GET /api/licencias/expedientes/[id]/sellados
 *
 * EL PAQUETE: un solo PDF con la constancia de radicación como primera hoja y
 * todos los documentos del expediente, cada página con su sello. Definido por
 * el propietario el 1-sep-2026, en el hueco exacto que este path ocupaba: la
 * fila «Descargar documentos con sello» enlazó aquí desde su primer día, y
 * esta ruta NUNCA había existido («pintado y nunca construido», custodiado
 * por `__tests__/acciones-papel-alcanzables.test.ts`).
 *
 * MISMAS REGLAS QUE EL SELLO POR DOCUMENTO (ruta hermana, `.../sellado`):
 *   · sin número de la serie legal no se sella — un `DEMO-` estampado sería
 *     peor que nada;
 *   · sin actuación de radicación no hay constancia que poner de primera
 *     hoja, así que no hay paquete;
 *   · copia DERIVADA DESECHABLE bajo `sellados/` (excluida del respaldo),
 *     materializada la primera vez y servida por URL firmada después;
 *   · la clave de materialización lleva el hash de la COMPOSICIÓN: cambia un
 *     documento, cambia la clave — imposible servir un paquete viejo.
 *
 * LA COMPOSICIÓN (qué entra y qué se lista aparte) vive en
 * `lib/sello/paquete-sellado.ts`, pura sobre bytes y custodiada allá.
 */
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { TenantId } from '@/src/types/radicado';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  idActuacionRadicacion,
  type ActuacionLicenciaDoc,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { describirTramiteDesdeSubtipos } from '@/lib/motor-expedientes/describir-tramite';
import {
  construirPaqueteSellado,
  PaqueteSelladoError,
  type DocumentoParaPaquete,
} from '@/lib/sello/paquete-sellado';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';
import { cargarEscudo, cargarLogo } from '@/lib/sello/cargar-logo';
import { numeroDeEntrada } from '@/lib/motor-expedientes/numeros-del-expediente';
import { VERSION_RENDER_SELLO } from '@/lib/sello/generar-sello-pdf';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const URL_EXPIRA_MS = 10 * 60 * 1000;
/** Mismo árbol que el sello por documento: derivado regenerable, sin respaldo. */
const PREFIJO_PAQUETES = 'sellados/expedientes';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const sesion = await requireActiveInternalUser();
    const db = getFirebaseAdminDb();

    const expedienteRef = db.doc(`expedientes/${id}`);
    const [expSnap, actSnap] = await Promise.all([
      expedienteRef.get(),
      expedienteRef.collection('actuaciones').doc(idActuacionRadicacion(id)).get(),
    ]);
    if (!expSnap.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = expSnap.data() as ExpedienteLicenciaDoc;
    if (!canOperateTenant(sesion, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'No tiene permiso sobre este expediente.' }, { status: 403 });
    }

    const numero = expediente.numeroExpediente?.numero;
    if (!numero || expediente.numeroExpediente?.serieId === 'demo') {
      return NextResponse.json(
        {
          error:
            'Este expediente todavía no tiene número de la serie legal, así que no hay número que '
            + 'estampar. El paquete sellado se puede generar una vez radicado en debida forma.',
          motivo: 'SIN_NUMERO_LEGAL',
        },
        { status: 409 },
      );
    }
    if (!actSnap.exists) {
      return NextResponse.json(
        {
          error:
            'Este expediente todavía no está radicado en legal y debida forma, así que no hay '
            + 'constancia que poner de primera hoja. El paquete se genera desde la radicación.',
          motivo: 'SIN_RADICACION',
        },
        { status: 409 },
      );
    }
    const act = actSnap.data() as ActuacionLicenciaDoc;

    const docsSnap = await expedienteRef.collection('documentos').get();
    const documentosDocs = docsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<DocumentoExpedienteDoc>) }));

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      logError({ radicadoId: id, modulo: 'sellados-paquete/config', error: new Error('FIREBASE_STORAGE_BUCKET ausente') });
      return NextResponse.json({ error: 'Almacenamiento no configurado en el servidor.' }, { status: 500 });
    }
    const bucket = getFirebaseAdminStorage().bucket(bucketName);

    /* La clave de la copia = hash de la COMPOSICIÓN: número, fecha jurídica y
       (id, hash de la versión vigente) de cada documento, ordenados. */
    /* La versión del RENDER entra a la clave: una mejora visual (el escudo de
       la carátula, p. ej.) debe regenerar el paquete aunque la composición de
       documentos no cambie — sin esto, el arreglo del 1-sep habría seguido
       sirviendo la carátula vieja para siempre. Es la constante COMPARTIDA del
       dibujo del sello: se sube allá y todas las rutas regeneran a la vez. */
    const VERSION_RENDER = VERSION_RENDER_SELLO;
    /* La ESQUINA de la marca la elige quien descarga (selector de 4 chips, el
       patrón del «Sello de recibido» de ventanilla). Entra a la clave: cada
       esquina es una copia derivada distinta. */
    const ESQUINAS_VALIDAS = new Set(['SUP_IZQ', 'SUP_DER', 'INF_IZQ', 'INF_DER']);
    const esquinaCruda = new URL(request.url).searchParams.get('esquina') ?? 'SUP_IZQ';
    const esquina = (ESQUINAS_VALIDAS.has(esquinaCruda) ? esquinaCruda : 'SUP_IZQ') as import('@/lib/sello/posicion-sello').EsquinaSello;
    /* EL NÚMERO ESTAMPADO ENTRA A LA CLAVE (ADR-0041 paso 1). Antes bastaba
       con `numero` porque era también el que se estampaba. Ahora se estampa el
       de ENTRADA, y ese SÍ puede cambiar después de materializado el paquete:
       un expediente huérfano al que se le vincula su radicado más tarde
       (`planVincularRadicado`) pasa de estampar un valor a estampar otro. Sin
       esto, se le seguiría sirviendo el paquete viejo para siempre — la misma
       familia de «cachear su propia degradación» que ya nos costó una vez. */
    const numeroEntrada = numeroDeEntrada(expediente) ?? numero;
    const huella = createHash('sha256');
    huella.update(VERSION_RENDER);
    huella.update(esquina);
    huella.update(numero);
    huella.update(numeroEntrada);
    huella.update(act.fecha ?? '');
    for (const d of [...documentosDocs].sort((a, b) => a.id.localeCompare(b.id))) {
      huella.update(`${d.id}:${d.versionVigente?.hashSha256 ?? 'sin-version'};`);
    }
    const clave = huella.digest('hex');
    const archivoPaquete = bucket.file(`${PREFIJO_PAQUETES}/${id}/paquete/${clave}.pdf`);

    const [yaExistia] = await archivoPaquete.exists();
    if (!yaExistia) {
      /* DESCARGAS EN SERIE Y CON REINTENTO — lección del 1-sep-2026: 18
         descargas en paralelo sin reintento fallaron 7 por transitorios, el
         paquete salió degradado («sin archivo legible» para archivos SANOS) y
         encima QUEDÓ CACHEADO como si fuera la verdad. Un transitorio no es
         un hecho del expediente: se reintenta, y si persiste, se responde
         error — jamás se materializa un paquete a medias. `SIN_ARCHIVO` queda
         reservado para lo que de verdad no tiene binario (sin storagePath). */
      const fallidas: string[] = [];
      const paraPaquete: DocumentoParaPaquete[] = [];
      for (const d of documentosDocs) {
        const nombre = d.nombre ?? d.id;
        const path = d.versionVigente?.storagePath;
        if (!path) {
          paraPaquete.push({ documentoId: d.id, nombre, mimeType: d.versionVigente?.mimeType ?? null, bytes: null });
          continue;
        }
        let bytes: Uint8Array | null = null;
        for (let intento = 1; intento <= 3 && !bytes; intento++) {
          try {
            const [buf] = await bucket.file(path).download();
            bytes = new Uint8Array(buf);
          } catch (error) {
            if (intento === 3) {
              logError({ radicadoId: id, modulo: 'sellados-paquete/descarga-original', error });
              fallidas.push(nombre);
            }
          }
        }
        if (bytes) paraPaquete.push({ documentoId: d.id, nombre, mimeType: d.versionVigente?.mimeType ?? null, bytes });
      }
      if (fallidas.length > 0) {
        return NextResponse.json(
          {
            error:
              `No fue posible leer ${fallidas.length} documento(s) del expediente (${fallidas.slice(0, 3).join('; ')}`
              + `${fallidas.length > 3 ? '…' : ''}). Es un fallo de lectura, no del expediente: intente de nuevo en un momento.`,
            motivo: 'DESCARGA_FALLIDA',
          },
          { status: 503 },
        );
      }

      /* Se estampa el número de ENTRADA, no el del expediente: el sello dice
         «RECIBIDO POR VENTANILLA ÚNICA». Hoy dan el mismo valor (el pivote del
         26-ago dejó el 1-110 en `numeroExpediente`), así que no cambia un solo
         papel; el día que el expediente lleve su 68745, este sitio ya pide el
         correcto. La caída cubre al histórico sin vínculo — su etiquetado
         llega en el paso 2, cuando el papel muestre los DOS números. */
      const resultado = await construirPaqueteSellado({
        constancia: {
          numeroRadicado: numeroEntrada,
          numeroExpediente: numero !== numeroEntrada ? numero : null,
          solicitanteNombre: expediente.solicitanteNombre,
          solicitanteDocumento: expediente.solicitanteDocumento,
          descripcionTramite: describirTramiteDesdeSubtipos(expediente.subtipos, expediente.modalidadesConstruccion),
          desdeCuandoCorreElPlazo: act.fecha,
          requisitosVerificados: act.evidenciaRadicacion?.requisitosAplicables ?? 0,
          funcionarioNombre: act.actorNombre,
          expedidaEnLegible: formatFechaHoraColombia(act.fecha),
        },
        documentos: paraPaquete,
        sello: {
          radicadoId: numeroEntrada,
          /* La línea «Exp.» solo cuando es un número DISTINTO del de entrada:
             hoy coinciden y el sello no repite el mismo dato dos veces. */
          numeroExpediente: numero !== numeroEntrada ? numero : null,
          fechaHoraLegible: formatFechaHoraColombia(expediente.fechaRadicacionDebidaForma ?? act.fecha),
          logoPng: await cargarEscudo(),
          esquina,
        },
        logoPortadaPng: await cargarLogo(),
      });

      await archivoPaquete.save(Buffer.from(resultado.bytes), {
        contentType: 'application/pdf',
        resumable: false,
        metadata: { metadata: { derivadoDe: `expedientes/${id}`, regenerable: 'true' } },
      });
    }

    const [url] = await archivoPaquete.getSignedUrl({
      action: 'read',
      expires: Date.now() + URL_EXPIRA_MS,
      responseDisposition: `attachment; filename="paquete-sellado-${numero}.pdf"`,
    });
    /* Redirección y no JSON: la fila del detalle es un <a> — el navegador debe
       terminar DESCARGANDO, que es lo que la etiqueta promete. */
    return NextResponse.redirect(url, 302);
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof PaqueteSelladoError) {
      return NextResponse.json({ error: error.message, motivo: error.codigo }, { status: 422 });
    }
    logError({ radicadoId: id, modulo: 'sellados-paquete', error });
    return NextResponse.json({ error: 'No fue posible generar el paquete sellado.' }, { status: 500 });
  }
}
