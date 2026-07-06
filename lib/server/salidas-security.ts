import { getFirebaseAdminStorage } from '@/lib/firebase-admin';
import { verificarMagicBytes } from '@/lib/seguridad/magic-bytes';
import {
  RadicadoActionError,
  sanitizeFilename,
} from '@/lib/server/radicados-security';

/**
 * Fase B · PDF adjunto — subida del oficio de salida vía Admin SDK.
 *
 * Gemelo de uploadRespuestaPdfAdmin con las mismas garantías: solo PDF,
 * máximo 10 MB, nombre saneado y verificación de la firma real del
 * archivo (H-N01: el Content-Type es falsificable). La ruta
 * `salidas/{salidaId}/...` está cerrada a clientes en storage.rules —
 * este helper es la única puerta de escritura.
 */

export interface OficioSalidaSubido {
  nombre: string;
  path:   string;
}

export async function uploadOficioSalidaAdmin(
  file: File,
  salidaId: string,
): Promise<OficioSalidaSubido> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new RadicadoActionError('FIREBASE_STORAGE_BUCKET no configurado.', 400);
  }

  if (file.type !== 'application/pdf') {
    throw new RadicadoActionError('El oficio despachado debe ser un PDF.', 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new RadicadoActionError('El PDF supera el tamaño máximo permitido de 10 MB.', 400);
  }

  const filename = `${Date.now()}_${sanitizeFilename(file.name)}`;
  const path = `salidas/${salidaId}/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!verificarMagicBytes(buffer, 'application/pdf')) {
    throw new RadicadoActionError('El oficio despachado no es un PDF válido.', 400);
  }

  await getFirebaseAdminStorage()
    .bucket(bucketName)
    .file(path)
    .save(buffer, {
      resumable: false,
      metadata: { contentType: 'application/pdf' },
    });

  return { nombre: file.name, path };
}
