/* ══════════════════════════════════════════════════════════════
   Categorización de PRESENTACIÓN de los requisitos del checklist.

   Esto NO es dato del motor ni del modelo: es solo la SECCIÓN visual en la
   que aparece cada requisito en la pantalla de documentación. Los estados y
   los contadores SIEMPRE salen de `evaluarCompletitud`
   (`lib/motor-expedientes/completitud.ts`) — este archivo no evalúa nada, no
   toca Firestore y no altera la Definición del Trámite.

   Por qué vive aquí y no en la Definición: el modelo (`RequisitoDefinicion`)
   no tiene un campo `categoria`, y la consigna del rediseño fue "no modificar
   los datos". Un requisito que NO esté mapeado cae en `adicionales` (fallback
   seguro): si Planeación agrega uno nuevo a la Definición, nunca desaparece de
   la pantalla — solo queda en "Documentos adicionales" hasta clasificarlo.
══════════════════════════════════════════════════════════════ */

export type CategoriaDocumentoId = 'solicitante' | 'inmueble' | 'tecnicos' | 'adicionales';

export interface CategoriaDocumento {
  id: CategoriaDocumentoId;
  numero: number;
  nombre: string;
  descripcion: string;
}

/** Secciones en el orden en que se muestran. */
export const CATEGORIAS_DOCUMENTOS: readonly CategoriaDocumento[] = [
  { id: 'solicitante', numero: 1, nombre: 'Documentos del solicitante', descripcion: 'Identificación y autorización del trámite.' },
  { id: 'inmueble', numero: 2, nombre: 'Documentos del inmueble', descripcion: 'Acreditan la propiedad y el estado del predio.' },
  { id: 'tecnicos', numero: 3, nombre: 'Planos y documentos técnicos', descripcion: 'Planos, estudios y firmas profesionales.' },
  { id: 'adicionales', numero: 4, nombre: 'Documentos adicionales', descripcion: 'Otros documentos y trámites del proceso.' },
] as const;

/**
 * Mapa requisito → sección para la Definición de Licencia de Construcción
 * (`lib/motor-expedientes/definiciones/licencia-construccion-parcial.ts`).
 * Las claves son los `id` estables de cada requisito.
 */
const MAPA_REQUISITO_CATEGORIA: Readonly<Record<string, CategoriaDocumentoId>> = {
  // 1 · Documentos del solicitante
  'solicitud-escrita-titular': 'solicitante',
  'formulario-unico-nacional': 'solicitante',
  'poder-apoderado': 'solicitante',
  'identidad-o-representacion-legal': 'solicitante',
  'certificacion-redam': 'solicitante',
  // 2 · Documentos del inmueble
  'certificado-tradicion-libertad': 'inmueble',
  'escritura-publica-predio': 'inmueble',
  'declaracion-impuesto-predial': 'inmueble',
  'paz-y-salvo-municipal': 'inmueble',
  'relacion-colindantes': 'inmueble',
  'acta-colindancia': 'inmueble',
  // 3 · Planos y documentos técnicos
  'planos-hidraulicos-sanitarios-estructurales': 'tecnicos',
  'estudio-suelos-geotecnico': 'tecnicos',
  'proyecto-arquitectonico': 'tecnicos',
  'disponibilidad-servicios-publicos': 'tecnicos',
  'matricula-profesional-experiencia': 'tecnicos',
  'memorial-responsabilidad-profesionales': 'tecnicos',
  // 4 · Documentos adicionales
  'valla-citacion-vecinos': 'adicionales',
  'cancelacion-expensas': 'adicionales',
};

/** Sección de un requisito; `adicionales` como fallback seguro para ids no mapeados. */
export function categoriaDeRequisito(requisitoId: string): CategoriaDocumentoId {
  return MAPA_REQUISITO_CATEGORIA[requisitoId] ?? 'adicionales';
}
