import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
  type InternalUserSession,
} from '@/lib/server/internal-auth';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { esDatoDePrueba } from '@/lib/radicados/dato-de-prueba';
import { verificarMagicBytes } from '@/lib/seguridad/magic-bytes';
import { validarSoportesPendientes, type GestionAdjuntosRadicado } from '@/lib/recepcion/contingencia-storage';
import { logError } from '@/lib/logger';
import type { ArchivoRadicado, TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Margen conservador para el multipart del runtime serverless de esta entrega.
const MAX_PDF_BYTES = 3 * 1024 * 1024;
const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };

class RegularizacionAdjuntosError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409 | 503) {
    super(message);
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function autorizarRadicado(radicado: VentanillaRadicado, usuario: InternalUserSession): GestionAdjuntosRadicado {
  if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
    throw new RegularizacionAdjuntosError('No tienes permisos sobre este radicado.', 403);
  }
  if (esDatoDePrueba(radicado)) {
    throw new RegularizacionAdjuntosError('Los datos de prueba o anulados no admiten regularización operativa.', 409);
  }
  const gestion = radicado.gestionAdjuntos;
  if (!gestion || gestion.version !== 1
    || (gestion.estado !== 'PENDIENTE_STORAGE' && gestion.estado !== 'COMPLETO')
    || !validarSoportesPendientes(JSON.stringify(gestion.soportesPendientes)).ok) {
    throw new RegularizacionAdjuntosError('Este radicado no tiene un inventario de contingencia válido.', 409);
  }
  if (!Array.isArray(radicado.archivos)) {
    throw new RegularizacionAdjuntosError('El inventario digital del radicado requiere revisión antes de regularizar.', 409);
  }
  return gestion;
}

/**
 * Regulariza un inventario completo en un PDF consolidado. El funcionario confirma
 * su correspondencia con los originales. Bytes inmutables (ifGenerationMatch=0),
 * lectura de generación verificada y tx de referencias+auditoría impiden éxito
 * aparente. SHA-256 identifica el reintento: jamás reemplaza un soporte existente.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ radicadoId: string }> },
): Promise<NextResponse> {
  let radicadoIdActual = '';
  try {
    const usuario = await requireActiveInternalUser();
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'RECEPCIONISTA') {
      return NextResponse.json({ error: 'Solo administración o recepción puede regularizar los soportes.' }, { status: 403 });
    }
    const limited = checkRateLimit(`regularizar-adjuntos:${usuario.uid}`, RATE_LIMIT);
    if (limited) {
      return NextResponse.json({ error: 'Espera un momento antes de volver a regularizar soportes.' }, {
        status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) },
      });
    }
    const { radicadoId } = await context.params;
    if (!/^1-110-\d{6}-\d{8}$/.test(radicadoId)) {
      return NextResponse.json({ error: 'Identificador de radicado no válido.' }, { status: 400 });
    }
    radicadoIdActual = radicadoId;
    const formData = await request.formData();
    const archivos = Array.from(formData.entries()).filter(([, value]) => typeof value !== 'string');
    const entrada = archivos[0];
    if (archivos.length !== 1 || entrada[0] !== 'archivo' || typeof entrada[1] === 'string') {
      return NextResponse.json({ error: 'Adjunta un único PDF consolidado en el campo archivo.' }, { status: 400 });
    }
    if (formData.get('confirmacionIntegridad') !== 'true') {
      return NextResponse.json({ error: 'Confirma que el PDF contiene íntegramente todos los soportes inventariados.' }, { status: 400 });
    }
    const archivo = entrada[1];
    if (archivo.type !== 'application/pdf' || archivo.size === 0 || archivo.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'El soporte consolidado debe ser un PDF de hasta 3 MB.' }, { status: 400 });
    }
    const bytes = Buffer.from(await archivo.arrayBuffer());
    if (!verificarMagicBytes(bytes, 'application/pdf')) {
      return NextResponse.json({ error: 'El archivo no tiene una firma PDF válida.' }, { status: 400 });
    }
    const db = getFirebaseAdminDb();
    const ref = db.doc(`ventanilla_radicados/${radicadoId}`);
    const inicial = await ref.get();
    if (!inicial.exists) throw new RegularizacionAdjuntosError('Radicado no encontrado.', 404);
    const gestionInicial = autorizarRadicado(inicial.data() as VentanillaRadicado, usuario);
    const hash = sha256(bytes);
    // Mantener los tres segmentos que acepta el autorizador de descarga actual.
    const path = `radicados/${radicadoId}/regularizados_${hash}.pdf`;
    if (gestionInicial.estado === 'COMPLETO'
      && (gestionInicial.regularizacion.sha256 !== hash || gestionInicial.regularizacion.archivoPath !== path)) {
      throw new RegularizacionAdjuntosError('El inventario ya fue completado con otro soporte. No se reemplazó ningún archivo.', 409);
    }

    // Un único objeto por contenido. No se usa move, delete, signed URL ni overwrite.
    let generation: string;
    try {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      if (!bucketName) throw new Error('Storage no configurado.');
      const bucket = getFirebaseAdminStorage().bucket(bucketName);
      const objeto = bucket.file(path);
      if (gestionInicial.estado === 'PENDIENTE_STORAGE') {
        try {
          await objeto.save(bytes, {
            resumable: false,
            preconditionOpts: { ifGenerationMatch: 0 },
            metadata: { contentType: 'application/pdf' },
          });
        } catch (error) {
          // unknown de catch: solo 412 permite reutilizar un objeto ya creado.
          if (!(error && typeof error === 'object' && 'code' in error && Number(error.code) === 412)) throw error;
        }
      }
      const [metadata] = await objeto.getMetadata();
      generation = String(metadata.generation ?? '');
      if (!/^\d+$/.test(generation) || Number(metadata.size) !== bytes.length
        || metadata.contentType !== 'application/pdf') throw new Error('Metadatos de objeto inconsistentes.');
      const [recuperado] = await bucket.file(path, { generation }).download();
      if (recuperado.length !== bytes.length || sha256(recuperado) !== hash) throw new Error('Integridad de objeto inconsistente.');
      if (gestionInicial.estado === 'COMPLETO' && gestionInicial.regularizacion.generation !== generation) {
        throw new Error('La generación no coincide con la evidencia registrada.');
      }
    } catch {
      // No propagamos URLs, metadatos del proveedor ni secretos en mensajes/logs.
      logError({ radicadoId, modulo: 'regularizar-adjuntos/storage', error: new Error('STORAGE_NO_VERIFICADO: no se confirmó almacenamiento e integridad de los soportes.') });
      throw new RegularizacionAdjuntosError('No fue posible guardar y verificar los soportes en Storage. No se cambió el estado del radicado; conserva los originales y reintenta cuando el servicio esté disponible.', 503);
    }

    const ahora = new Date().toISOString();
    const repetida = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new RegularizacionAdjuntosError('Radicado no encontrado.', 404);
      const radicado = snap.data() as VentanillaRadicado;
      const gestion = autorizarRadicado(radicado, usuario);
      if (gestion.estado === 'COMPLETO') {
        if (gestion.regularizacion.sha256 !== hash || gestion.regularizacion.archivoPath !== path
          || gestion.regularizacion.generation !== generation) {
          throw new RegularizacionAdjuntosError('Otro proceso completó este inventario con un soporte distinto. No se reemplazó.', 409);
        }
        if (!radicado.archivos.some((a) => a.path === path)) {
          throw new RegularizacionAdjuntosError('La referencia digital no coincide con la regularización. Requiere revisión.', 409);
        }
        return true;
      }
      if (JSON.stringify(gestion) !== JSON.stringify(gestionInicial)) {
        throw new RegularizacionAdjuntosError('El inventario cambió durante la verificación. Revísalo antes de reintentar.', 409);
      }
      const soporte: ArchivoRadicado = {
        nombre: 'soportes-consolidados.pdf', url: '', path, tipo: 'application/pdf',
        tamanioKB: Math.max(1, Math.round(bytes.length / 1024)), orden: radicado.archivos.length + 1,
      };
      const completa: GestionAdjuntosRadicado = {
        ...gestion,
        estado: 'COMPLETO',
        regularizacion: {
          archivoPath: path, sha256: hash, generation, completadoEn: ahora,
          completadoPor: { uid: usuario.uid, nombre: usuario.nombre }, confirmacionIntegridad: true,
        },
      };
      const eventoId = `ev_${radicadoId}_ADJUNTOS_REGULARIZADOS_STORAGE`;
      const evento: TrazabilidadRadicado = {
        eventoId, fecha: ahora, accion: 'ADJUNTOS_REGULARIZADOS_STORAGE',
        actorUid: usuario.uid, actorNombre: usuario.nombre,
        oficinaDestino: radicado.clasificacion.oficinaDestino,
        nota: 'Soportes inventariados regularizados: PDF consolidado verificado en Storage y referencias persistidas.',
        metadata: { archivoPath: path, sha256: hash, generation, cantidadSoportes: gestion.soportesPendientes.cantidad },
      };
      tx.update(ref, { gestionAdjuntos: completa, archivos: [...radicado.archivos, soporte], ultimaActualizacion: ahora });
      tx.create(db.doc(`ventanilla_radicados/${radicadoId}/trazabilidad/${eventoId}`), evento);
      return false;
    });
    return NextResponse.json({ ok: true, estadoAdjuntos: 'COMPLETO', repetida, mensaje: 'Soportes verificados y regularización registrada.' });
  } catch (error) {
    if (error instanceof InternalAuthError || error instanceof RegularizacionAdjuntosError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId: radicadoIdActual, modulo: 'regularizar-adjuntos', error: new Error('Falló la persistencia de la regularización; no se confirmó éxito.') });
    return NextResponse.json({ error: 'No se pudo confirmar la regularización. El soporte no se borró ni se reemplazó; revisa el estado y reintenta con el mismo PDF.' }, { status: 500 });
  }
}
