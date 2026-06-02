/**
 * Historial de versiones de borradores.
 * Colección: simi_borrador_versiones
 *
 * Cada vez que un borrador es editado (por SIMI o por humano)
 * se guarda una nueva versión para auditoría MIPG completa.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';

export interface BorradorVersion {
  id?:                string;
  radicadoId:         string;
  approvalId?:        string;
  tenantId:           string;
  version:            number;
  contenido:          string;
  generadoPorSimi:    boolean;
  editadoPorHumano:   boolean;
  usuarioId:          string;
  usuarioNombre:      string;
  usuarioRol:         string;
  modoSimi?:          string;
  motivoCambio?:      string;
  estadoAprobacion?:  string;
  fuentesUsadas?:     string[];
  createdAt:          string;
}

/**
 * Guardar una nueva versión del borrador.
 * Calcula automáticamente el número de versión siguiente.
 */
export async function guardarVersionBorrador(
  params: Omit<BorradorVersion, 'id' | 'version' | 'createdAt'>,
): Promise<{ versionId: string; numeroVersion: number }> {
  const db = getFirebaseAdminDb();

  // Obtener el número de versión actual para este radicado
  const countSnap = await db
    .collection('simi_borrador_versiones')
    .where('radicadoId', '==', params.radicadoId)
    .orderBy('version', 'desc')
    .limit(1)
    .get()
    .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[], empty: true }));

  const ultimaVersion = countSnap.empty ? 0 : (countSnap.docs[0].data().version as number ?? 0);
  const nuevaVersion = ultimaVersion + 1;

  const ref = await db.collection('simi_borrador_versiones').add({
    ...params,
    version:   nuevaVersion,
    createdAt: new Date().toISOString(),
  });

  return { versionId: ref.id, numeroVersion: nuevaVersion };
}

/**
 * Obtener el historial de versiones de un radicado.
 */
export async function getVersionesBorrador(radicadoId: string): Promise<BorradorVersion[]> {
  try {
    const snap = await getFirebaseAdminDb()
      .collection('simi_borrador_versiones')
      .where('radicadoId', '==', radicadoId)
      .orderBy('version', 'desc')
      .limit(20)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BorradorVersion));
  } catch {
    return [];
  }
}

/**
 * Obtener la última versión del borrador de un radicado.
 */
export async function getUltimaVersion(radicadoId: string): Promise<BorradorVersion | null> {
  try {
    const snap = await getFirebaseAdminDb()
      .collection('simi_borrador_versiones')
      .where('radicadoId', '==', radicadoId)
      .orderBy('version', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as BorradorVersion;
  } catch {
    return null;
  }
}
