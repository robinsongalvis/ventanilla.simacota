import { ref, uploadBytesResumable } from 'firebase/storage';
import { getStorage } from './firebase';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

export interface UploadResult {
  nombre:     string;
  url:        string;
  tipo:       string;
  tamanioKB:  number;
  path:       string;   // Ruta en Storage: radicados/{radicadoId}/{filename}
}

export interface UploadProgress {
  archivo:    string;
  porcentaje: number;   // 0–100
  estado:     'subiendo' | 'completado' | 'error';
  error?:     string;
}

/* ══════════════════════════════════════════════════════════════
   UPLOAD INDIVIDUAL
══════════════════════════════════════════════════════════════ */

/**
 * Sube un archivo a Firebase Storage.
 * Ruta: radicados/{radicadoId}/{timestamp}_{nombreArchivo}
 *
 * El timestamp previene colisiones si el ciudadano sube dos archivos con el
 * mismo nombre en el mismo radicado.
 *
 * Las reglas reales y vigentes viven en `storage.rules` (raíz del repo,
 * función `isAllowedRadicadoFile`) — este comentario es solo referencia
 * rápida, no la fuente de verdad. Actualmente permite, hasta 10 MB:
 * imágenes (`image/.*`), PDF, y los 3 formatos Office modernos (OOXML)
 * DOCX/XLSX/PPTX. Los formatos Office antiguos (OLE: .doc/.xls/.ppt) NO
 * se admiten — ver exclusión documentada en lib/seguridad/magic-bytes.ts.
 */
export type StoragePrefijo = 'radicados' | 'respuestas';

export function subirArchivo(
  archivo:     File,
  radicadoId:  string,
  onProgress?: (progreso: UploadProgress) => void,
  prefijo:     StoragePrefijo = 'radicados',
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const storage  = getStorage();
    const filename = `${Date.now()}_${archivo.name}`;
    const path     = `${prefijo}/${radicadoId}/${filename}`;
    const storageRef = ref(storage, path);

    const task = uploadBytesResumable(storageRef, archivo, {
      contentType: archivo.type,
    });

    task.on(
      'state_changed',
      (snapshot) => {
        const porcentaje = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        onProgress?.({ archivo: archivo.name, porcentaje, estado: 'subiendo' });
      },
      (error) => {
        onProgress?.({
          archivo:    archivo.name,
          porcentaje: 0,
          estado:     'error',
          error:      error.message,
        });
        reject(error);
      },
      async () => {
        onProgress?.({ archivo: archivo.name, porcentaje: 100, estado: 'completado' });
        resolve({
          nombre:    archivo.name,
          url:       '',
          tipo:      archivo.type,
          tamanioKB: Math.round(archivo.size / 1024),
          path,
        });
      },
    );
  });
}

/* ══════════════════════════════════════════════════════════════
   UPLOAD MÚLTIPLE
══════════════════════════════════════════════════════════════ */

/**
 * Sube múltiples archivos en paralelo con progreso individual.
 * Si alguno falla, los demás continúan — los fallidos se reportan al final.
 */
export async function subirArchivos(
  archivos:    File[],
  radicadoId:  string,
  onProgress?: (progresos: UploadProgress[]) => void,
  prefijo:     StoragePrefijo = 'radicados',
): Promise<{
  exitosos:  UploadResult[];
  fallidos:  { nombre: string; error: string }[];
}> {
  // Estado de progreso por archivo (índice → UploadProgress)
  const progresos: UploadProgress[] = archivos.map((a) => ({
    archivo:    a.name,
    porcentaje: 0,
    estado:     'subiendo' as const,
  }));

  function notificar(idx: number, p: UploadProgress) {
    progresos[idx] = p;
    onProgress?.([...progresos]);
  }

  const resultados = await Promise.allSettled(
    archivos.map((archivo, idx) =>
      subirArchivo(archivo, radicadoId, (p) => notificar(idx, p), prefijo),
    ),
  );

  const exitosos: UploadResult[]                          = [];
  const fallidos: { nombre: string; error: string }[]    = [];

  resultados.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      exitosos.push(r.value);
    } else {
      fallidos.push({
        nombre: archivos[idx].name,
        error:  r.reason?.message ?? 'Error desconocido',
      });
    }
  });

  return { exitosos, fallidos };
}
