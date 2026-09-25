/**
 * retrieveLegalContext — RAG jurídico por búsqueda de palabras clave en Firestore.
 *
 * Estrategia de recuperación (sin vector DB):
 * 1. Extraer palabras clave del query.
 * 2. Buscar en normatividad_municipal (con filtro de tenantId).
 * 3. Buscar en normatividad_nacional (sin filtro de tenant).
 * 4. Clasificar fuentes por estado (citables vs. pendientes).
 * 5. Registrar consulta en simi_rag_consultas.
 *
 * Puede evolucionar a embeddings vectoriales en Sprint 3.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { validateNormativeSource, classifySource } from './validateNormativeSource';
import type { RagQueryParams, LegalContextResult, RagSource, RagQueryRecord } from '@/src/types/simi-rag';
import type { NormativeDocument } from '@/src/types/simi-normograma';

const MAX_RESULTS_DEFAULT = 6;

/* ── Tokenizar query ── */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);    // palabras de más de 3 letras
}

/* ── Calcular relevancia ── */
function scoreDocument(doc: NormativeDocument, tokens: string[]): number {
  const haystack = [
    doc.titulo,
    ...(doc.tema ?? []),
    ...(doc.palabras_clave ?? []),
    doc.resumen ?? '',
    doc.contenido?.slice(0, 500) ?? '',
  ].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  return tokens.reduce((score, token) => {
    return score + (haystack.includes(token) ? 1 : 0);
  }, 0);
}

/* ── Buscar en una colección ── */
async function searchCollection(
  collectionName: string,
  tokens: string[],
  filters: { tenantId?: string; dependencia?: string },
  maxResults: number,
): Promise<NormativeDocument[]> {
  try {
    const db = getFirebaseAdminDb();
    let q = db.collection(collectionName)
      .where('estado', 'in', ['vigente', 'parcialmente_vigente', 'interna_validada', 'pendiente_verificacion'])
      .limit(50);

    if (filters.tenantId) {
      q = db.collection(collectionName)
        .where('tenantId', '==', filters.tenantId)
        .where('estado', 'in', ['vigente', 'parcialmente_vigente', 'interna_validada', 'pendiente_verificacion'])
        .limit(50);
    }

    const snap = await q.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NormativeDocument));

    // Puntuar por relevancia y ordenar
    return docs
      .map((doc) => ({ doc, score: scoreDocument(doc, tokens) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ doc }) => doc);
  } catch {
    return [];
  }
}

/* ── Guardar registro RAG (fire-and-forget) ── */
async function saveRagQuery(record: Omit<RagQueryRecord, 'id'>): Promise<void> {
  try {
    await getFirebaseAdminDb().collection('simi_rag_consultas').add({
      ...record,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // silenciar — no crítico
  }
}

/* ── Construir contexto textual ── */
function buildContextText(fuentes: NormativeDocument[]): string {
  if (fuentes.length === 0) return '';

  const lines = fuentes.map((f) => {
    const header = `[${f.titulo}${f.numero ? ` No. ${f.numero}` : ''}${f.anio ? ` de ${f.anio}` : ''} — Estado: ${f.estado}]`;
    const body = f.resumen ?? f.contenido?.slice(0, 400) ?? '';
    return `${header}\n${body}`;
  });

  return [
    '=== BASE DOCUMENTAL JURÍDICA VALIDADA ===',
    'Las siguientes fuentes han sido recuperadas del normograma institucional.',
    'Solo cita como fundamento directo las fuentes con estado vigente, parcialmente_vigente o interna_validada.',
    '',
    ...lines,
    '=== FIN BASE DOCUMENTAL ===',
  ].join('\n');
}

/* ══════════════════════════════════════════════════════════════
   FUNCIÓN PRINCIPAL
══════════════════════════════════════════════════════════════ */

export async function retrieveLegalContext(
  params: RagQueryParams,
): Promise<LegalContextResult> {
  const maxResults = params.maxResults ?? MAX_RESULTS_DEFAULT;
  const tokens     = tokenize(params.query);

  if (tokens.length === 0) {
    return { fuentesValidadas: [], fuentesPendientes: [], contexto: '', advertencias: ['Query sin palabras clave suficientes para búsqueda.'], totalEncontradas: 0 };
  }

  // Buscar en paralelo
  const [municipalDocs, nacionalDocs] = await Promise.all([
    searchCollection(
      'normatividad_municipal',
      tokens,
      { tenantId: params.tenantId, dependencia: params.dependencia },
      Math.ceil(maxResults / 2),
    ),
    searchCollection(
      'normatividad_nacional',
      tokens,
      {},
      Math.ceil(maxResults / 2),
    ),
  ]);

  const allDocs   = [...municipalDocs, ...nacionalDocs].slice(0, maxResults);
  const advertencias: string[] = [];
  const fuentesValidadas: RagSource[] = [];
  const fuentesPendientes: RagSource[] = [];

  for (const doc of allDocs) {
    const validation = validateNormativeSource(doc.estado);
    const citableComo = classifySource(doc.estado);

    const source: RagSource = {
      id:              doc.id,
      titulo:          doc.titulo,
      tipo_norma:      doc.tipo_norma,
      estado:          doc.estado,
      nivel_confianza: doc.nivel_confianza ?? 'medio',
      resumen:         doc.resumen,
      citableComo,
    };

    if (validation.canCite) {
      fuentesValidadas.push(source);
      if (validation.warning) advertencias.push(validation.warning);
    } else {
      fuentesPendientes.push(source);
      if (citableComo === 'referencia_sujeta_validacion') {
        advertencias.push(`"${doc.titulo}" está pendiente de verificación y no puede citarse como fundamento definitivo.`);
      }
    }
  }

  // Construir contexto solo con fuentes válidas
  const contexto = buildContextText(
    allDocs.filter((d) => validateNormativeSource(d.estado).canCite),
  );

  if (fuentesValidadas.length === 0 && allDocs.length === 0) {
    advertencias.push('No se encontraron documentos jurídicos relevantes en el normograma. SIMI responderá sin contexto documental validado.');
  }

  // Guardar registro (fire-and-forget — usuarioId no disponible aquí, se pasa desde la API)
  void saveRagQuery({
    tenantId:               params.tenantId,
    usuarioId:              'system',
    query:                  params.query.slice(0, 300),
    coleccionesConsultadas: ['normatividad_municipal', 'normatividad_nacional'],
    documentosEncontrados:  allDocs.length,
    documentosUsados:       fuentesValidadas.length,
    fuentesUsadas:          fuentesValidadas,
    createdAt:              new Date().toISOString(),
  });

  return {
    fuentesValidadas,
    fuentesPendientes,
    contexto,
    advertencias,
    totalEncontradas: allDocs.length,
  };
}
