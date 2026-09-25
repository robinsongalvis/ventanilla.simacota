import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminStorage } from '@/lib/firebase-admin';
import { verificarMagicBytes } from '@/lib/seguridad/magic-bytes';
import {
  RadicadoActionError,
  sanitizeFilename,
} from '@/lib/server/radicados-security';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { PlanillaReparto } from '@/src/types/planilla';
import { radicadosPendientesDeReparto } from '@/lib/planillas/construir-planilla';

/**
 * Sprint Planilla de reparto — capa server (Admin SDK).
 *
 * La misma mecánica endurecida de salidas: el escaneo firmado solo
 * entra por aquí (solo PDF, 10 MB, magic bytes verificados) y la ruta
 * `planillas/{planillaId}/...` queda cerrada a clientes en
 * storage.rules. Los pendientes se calculan server-side con el mismo
 * helper puro de la UI para que los números nunca se contradigan.
 */

export interface EscaneoPlanillaSubido {
  nombre: string;
  path:   string;
}

export async function uploadEscaneoPlanillaAdmin(
  file: File,
  planillaId: string,
): Promise<EscaneoPlanillaSubido> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new RadicadoActionError('FIREBASE_STORAGE_BUCKET no configurado.', 400);
  }

  if (file.type !== 'application/pdf') {
    throw new RadicadoActionError('El escaneo de la planilla firmada debe ser un PDF.', 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new RadicadoActionError('El PDF supera el tamaño máximo permitido de 10 MB.', 400);
  }

  const filename = `${Date.now()}_${sanitizeFilename(file.name)}`;
  const path = `planillas/${planillaId}/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!verificarMagicBytes(buffer, 'application/pdf')) {
    throw new RadicadoActionError('El escaneo de la planilla no es un PDF válido.', 400);
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

/** Planillas aún abiertas — sus filas PENDIENTE bloquean re-inclusión. */
export async function obtenerPlanillasAbiertas(db: Firestore): Promise<PlanillaReparto[]> {
  const snap = await db
    .collection('ventanilla_planillas')
    .where('estado', '==', 'POR_ENTREGAR')
    .get();
  return snap.docs.map((d) => d.data() as PlanillaReparto);
}

/**
 * Radicados físicos que la funcionaria todavía tiene en ventanilla.
 * Volumen Simacota: la consulta por origen es acotada y el filtrado
 * fino (entregados / en planilla abierta) se hace en memoria con el
 * helper puro compartido con la UI.
 */
export async function obtenerPendientesDeReparto(db: Firestore): Promise<{
  pendientes: VentanillaRadicado[];
  planillasAbiertas: PlanillaReparto[];
}> {
  const [snapRadicados, planillasAbiertas] = await Promise.all([
    db
      .collection('ventanilla_radicados')
      .where('control.origen', '==', 'FISICO_ESCANER')
      .orderBy('control.fechaRadicado', 'desc')
      .limit(500)
      .get(),
    obtenerPlanillasAbiertas(db),
  ]);

  const radicados = snapRadicados.docs.map((d) => d.data() as VentanillaRadicado);
  return {
    pendientes: radicadosPendientesDeReparto(radicados, planillasAbiertas),
    planillasAbiertas,
  };
}
