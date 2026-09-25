/**
 * getOfficialTemplate — Buscar plantilla oficial por dependencia, tipo y modo.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { ResponseTemplate } from '@/src/types/simi-normograma';

interface TemplateQuery {
  tenantId:       string;
  dependencia?:   string;
  tipoSolicitud?: string;
  modoSimi?:      string;
  nivelRiesgo?:   'bajo' | 'medio' | 'alto';
}

export async function getOfficialTemplate(
  params: TemplateQuery,
): Promise<ResponseTemplate | null> {
  try {
    const db = getFirebaseAdminDb();

    // 1. Buscar plantilla específica (dependencia + tipo + modo)
    if (params.dependencia && params.tipoSolicitud && params.modoSimi) {
      const q = await db.collection('plantillas_respuesta')
        .where('tenantId', '==', params.tenantId)
        .where('dependencia', '==', params.dependencia)
        .where('tipo_solicitud', '==', params.tipoSolicitud)
        .where('modo_simi', '==', params.modoSimi)
        .where('estado', '==', 'activa')
        .limit(1)
        .get();

      if (!q.empty) {
        return { id: q.docs[0].id, ...q.docs[0].data() } as ResponseTemplate;
      }
    }

    // 2. Buscar plantilla por dependencia + modo (sin tipo específico)
    if (params.dependencia && params.modoSimi) {
      const q = await db.collection('plantillas_respuesta')
        .where('tenantId', '==', params.tenantId)
        .where('dependencia', '==', params.dependencia)
        .where('modo_simi', '==', params.modoSimi)
        .where('estado', '==', 'activa')
        .limit(1)
        .get();

      if (!q.empty) {
        return { id: q.docs[0].id, ...q.docs[0].data() } as ResponseTemplate;
      }
    }

    // 3. Buscar plantilla general por modo (riesgo_aplicable = 'todos')
    if (params.modoSimi) {
      const q = await db.collection('plantillas_respuesta')
        .where('tenantId', '==', params.tenantId)
        .where('modo_simi', '==', params.modoSimi)
        .where('riesgo_aplicable', '==', 'todos')
        .where('estado', '==', 'activa')
        .limit(1)
        .get();

      if (!q.empty) {
        return { id: q.docs[0].id, ...q.docs[0].data() } as ResponseTemplate;
      }
    }

    // No se encontró plantilla
    return null;
  } catch {
    return null;
  }
}

/**
 * Listar plantillas disponibles para un tenant.
 */
export async function listTemplates(tenantId: string): Promise<ResponseTemplate[]> {
  try {
    const snap = await getFirebaseAdminDb()
      .collection('plantillas_respuesta')
      .where('tenantId', '==', tenantId)
      .where('estado', '==', 'activa')
      .orderBy('nombre')
      .limit(50)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResponseTemplate));
  } catch {
    return [];
  }
}
