import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import type { InternalUserSession } from '@/lib/server/internal-auth';
import type { ResponsableFuncionario } from '@/lib/actions/asignarRadicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { TenantId } from '@/src/types/radicado';
import type {
  ArchivoRadicado,
  RespuestaOficial,
  TrazabilidadRadicado,
  VentanillaRadicado,
} from '@/src/types/ventanilla';

export class RadicadoActionError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export async function getRadicadoOrFail(radicadoId: string): Promise<VentanillaRadicado> {
  const snap = await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).get();
  if (!snap.exists) {
    throw new RadicadoActionError('Radicado no encontrado.', 404);
  }
  return snap.data() as VentanillaRadicado;
}

export async function appendTrazabilidadAdmin(
  radicadoId: string,
  entrada: Omit<TrazabilidadRadicado, 'eventoId'>,
): Promise<void> {
  await getFirebaseAdminDb()
    .collection(`ventanilla_radicados/${radicadoId}/trazabilidad`)
    .add(removeUndefinedDeep({
      ...entrada,
      eventoId: `ev_${radicadoId}_${Date.now()}`,
    }));
}

export function assertNotClosed(radicado: VentanillaRadicado): void {
  if (['RESUELTO', 'RECHAZADO'].includes(radicado.estadoActual)) {
    throw new RadicadoActionError('El radicado ya está cerrado y no permite esta acción.', 409);
  }
}

export function buildResponsableSnapshot(responsable?: ResponsableFuncionario | null): Record<string, unknown> {
  if (!responsable) return {};

  return {
    'clasificacion.funcionarioResponsableUid': responsable.uid,
    'clasificacion.funcionarioResponsableNombre': responsable.nombre,
    'clasificacion.funcionarioResponsableEmail': responsable.email,
    'clasificacion.funcionarioResponsableRol': responsable.rol,
    ...(responsable.cargo ? { 'clasificacion.funcionarioResponsableCargo': responsable.cargo } : {}),
    'clasificacion.fechaAsignacionResponsable': new Date().toISOString(),
  };
}

export function buildResponsableMetadata(responsable?: ResponsableFuncionario | null): Record<string, unknown> {
  if (!responsable) return {};

  return {
    funcionarioResponsableUid: responsable.uid,
    funcionarioResponsableNombre: responsable.nombre,
    funcionarioResponsableEmail: responsable.email,
    funcionarioResponsableRol: responsable.rol,
    ...(responsable.cargo ? { funcionarioResponsableCargo: responsable.cargo } : {}),
  };
}

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_.\- ]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'archivo.pdf';
}

export async function uploadRespuestaPdfAdmin(
  file: File,
  radicadoId: string,
): Promise<ArchivoRadicado> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new RadicadoActionError('FIREBASE_STORAGE_BUCKET no configurado.', 400);
  }

  if (file.type !== 'application/pdf') {
    throw new RadicadoActionError('El oficio de respuesta debe ser un PDF.', 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new RadicadoActionError('El PDF supera el tamaño máximo permitido de 10 MB.', 400);
  }

  const filename = `${Date.now()}_${sanitizeFilename(file.name)}`;
  const path = `respuestas/${radicadoId}/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await getFirebaseAdminStorage()
    .bucket(bucketName)
    .file(path)
    .save(buffer, {
      resumable: false,
      metadata: { contentType: 'application/pdf' },
    });

  return {
    nombre: file.name,
    url: '',
    path,
    tipo: 'application/pdf',
    tamanioKB: Math.max(1, Math.round(file.size / 1024)),
    orden: 1,
  };
}

export function buildRespuestaOficial(
  archivo: ArchivoRadicado | null,
  nota: string,
  ahora: string,
  usuario: InternalUserSession,
): RespuestaOficial | null {
  if (!archivo) return null;

  return {
    archivoPath: archivo.path,
    archivoNombre: archivo.nombre,
    nota,
    fecha: ahora,
    actorUid: usuario.uid,
    actorNombre: usuario.nombre,
  };
}

export function nombreTenant(tenantId: TenantId): string {
  return NOMBRES_TENANT[tenantId] ?? tenantId;
}
