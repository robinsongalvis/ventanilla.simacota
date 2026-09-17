/**
 * app/interno/licencias/categorias-documentos.ts
 *
 * CATEGORÍAS 01–06 de la vista «Documentos del trámite» — capa de PRESENTACIÓN.
 *
 * ── QUÉ ES Y QUÉ NO ES ────────────────────────────────────────────────────
 *
 * Es una CLASIFICACIÓN VISUAL: agrupa los requisitos en seis bloques que una
 * persona reconoce, para no tener 19 tarjetas verticales sueltas. NO toca el
 * evaluador (`lib/motor-expedientes/completitud.ts`): la categoría no cambia si
 * un requisito se exige, aplica o está aportado — eso lo sigue decidiendo
 * `evaluarCompletitud`, y esta capa solo decide DÓNDE se pinta cada fila.
 *
 * ── DE DÓNDE SALE EL MAPEO ────────────────────────────────────────────────
 *
 * Los 19 requisitos del F-PGD-009 (obra nueva) repartidos por afinidad. Es una
 * propuesta que Planeación debe confirmar; hay tres casos deliberadamente
 * dudosos, marcados abajo. Un requisito SIN mapa cae en «06 Otros documentos»
 * —el default seguro—: una Definición futura con requisitos propios no rompe la
 * vista, simplemente los agrupa al final hasta que se les asigne categoría.
 */

export interface CategoriaDocumento {
  /** «01»… «06» — el rótulo numérico que encabeza el bloque. */
  numero: string;
  titulo: string;
  descripcion: string;
}

export const CATEGORIAS_DOCUMENTOS: readonly CategoriaDocumento[] = [
  { numero: '01', titulo: 'Identificación y solicitud', descripcion: 'Documentos del solicitante o representante legal.' },
  { numero: '02', titulo: 'Propiedad del inmueble', descripcion: 'Documentos que acreditan la propiedad del predio.' },
  { numero: '03', titulo: 'Documentación tributaria', descripcion: 'Impuestos y paz y salvo.' },
  { numero: '04', titulo: 'Estudios y documentación técnica', descripcion: 'Planos, estudios y memorias técnicas.' },
  { numero: '05', titulo: 'Servicios y entorno', descripcion: 'Disponibilidad de servicios públicos y vecindario.' },
  { numero: '06', titulo: 'Otros documentos', descripcion: 'Documentos adicionales según el tipo de proyecto.' },
];

/** El default cuando un requisito no está mapeado — nunca se pierde una fila. */
export const CATEGORIA_POR_DEFECTO = '06';

/**
 * requisito.id → número de categoría. Propuesta pendiente de confirmar con
 * Planeación en los tres casos marcados con ⚠.
 */
const CATEGORIA_POR_REQUISITO: Readonly<Record<string, string>> = {
  // 01 · Identificación y solicitud
  'solicitud-escrita-titular': '01',
  'formulario-unico-nacional': '01',
  'poder-apoderado': '01',
  'identidad-o-representacion-legal': '01',
  // 02 · Propiedad del inmueble
  'certificado-tradicion-libertad': '02',
  'escritura-publica-predio': '02',
  // 03 · Documentación tributaria
  'declaracion-impuesto-predial': '03',
  'paz-y-salvo-municipal': '03',
  'cancelacion-expensas': '03', // ⚠ ¿03 tributaria o 06 otros? (es un pago)
  // 04 · Estudios y documentación técnica
  'planos-hidraulicos-sanitarios-estructurales': '04',
  'estudio-suelos-geotecnico': '04',
  'proyecto-arquitectonico': '04',
  'matricula-profesional-experiencia': '04', // ⚠ ¿04 técnica o 01 identificación? (credencial del profesional)
  'memorial-responsabilidad-profesionales': '04',
  // 05 · Servicios y entorno
  'relacion-colindantes': '05',
  'acta-colindancia': '05',
  'disponibilidad-servicios-publicos': '05',
  'valla-citacion-vecinos': '05',
  // 06 · Otros documentos
  'certificacion-redam': '06', // ⚠ ¿06 otros o 01 identificación? (chequeo personal del titular)
};

/** La categoría (número) de un requisito; los no mapeados van a «06 Otros documentos». */
export function categoriaDeRequisito(requisitoId: string): string {
  return CATEGORIA_POR_REQUISITO[requisitoId] ?? CATEGORIA_POR_DEFECTO;
}
