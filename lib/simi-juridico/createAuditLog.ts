/**
 * Auditoría de SIMI Jurídico-Administrativo
 * Colección Firebase: simi_juridico_auditoria
 *
 * Registra cada uso del módulo jurídico para trazabilidad MIPG.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { SimiJuridicoAuditoria } from '@/src/types/simi-juridico';

/**
 * Guarda un registro de auditoría en Firestore.
 * Fire-and-forget: no bloquea la respuesta al usuario.
 */
export async function createAuditLog(
  entry: Omit<SimiJuridicoAuditoria, 'id'>,
): Promise<void> {
  try {
    const db = getFirebaseAdminDb();
    await db.collection('simi_juridico_auditoria').add({
      ...entry,
      _createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Silenciar — la auditoría no debe romper la operación principal
    console.error('[simi-juridico] Error guardando auditoría:', err instanceof Error ? err.message : String(err));
  }
}
