/* ══════════════════════════════════════════════════════════════
   lib/catalogos/tipos-solicitud.ts

   Catálogo institucional centralizado de tipos de solicitud para
   la Ventanilla Única Digital de la Alcaldía Municipal de Simacota.

   Esta es la fuente única de verdad para:
   - Términos legales (hábiles / calendario).
   - Visibilidad ciudadana vs interna.
   - Reglas de presentación anónima.
   - Marcado de validación jurídica y herencia del sistema actual.
   - Cálculo de vencimientos, MIPG, Excel, SIMI, consulta pública.

   Fuente: tipos del sistema actual de la Alcaldía + tipos PQRSD
   ya soportados por la plataforma digital (Ley 1755/2015, CPACA).
══════════════════════════════════════════════════════════════ */

import type { TenantId } from '@/src/types/radicado';

/* ──────────────────────────────────────────────────────────────
   Tipos del modelo
────────────────────────────────────────────────────────────── */

export type CategoriaSolicitud =
  | 'PQRSD'
  | 'TRAMITE'
  | 'INTERNO'
  | 'ESPECIAL';

export type TipoDiasTermino = 'HABILES' | 'CALENDARIO';

export type PrioridadSugerida = 'ROJO' | 'NARANJA' | 'AMARILLO';

export interface TipoSolicitudCatalogo {
  id: string;
  nombre: string;
  nombreCorto: string;
  categoria: CategoriaSolicitud;
  terminoDias: number;
  tipoDias: TipoDiasTermino;
  visibleCiudadano: boolean;
  visibleInterno: boolean;
  permiteAnonimo: boolean;
  requiereAnexo?: boolean;
  dependenciaSugerida?: TenantId;
  descripcion: string;
  fundamento?: string;
  activo: boolean;
  requiereValidacionJuridica?: boolean;
  heredadoSistemaActual?: boolean;
  prioridadSugerida?: PrioridadSugerida;
}

/* ──────────────────────────────────────────────────────────────
   Fundamentos comunes
────────────────────────────────────────────────────────────── */

const FUNDAMENTO_PQRSD = 'Constitución Política art. 23 · Ley 1755 de 2015 · Ley 1437 de 2011 (CPACA).';
const FUNDAMENTO_HABEAS = 'Ley 1581 de 2012 (Habeas Data) · Decreto 1377 de 2013.';
const FUNDAMENTO_HEREDADO = 'Tipo heredado del sistema actual. Validar jurídicamente/institucionalmente antes de go-live oficial.';

/* ──────────────────────────────────────────────────────────────
   Catálogo principal

   Identificadores nuevos siguen convención SCREAMING_SNAKE_CASE.
   Se conservan los IDs de tipos ya soportados por la plataforma
   (compatibilidad hacia atrás con `lib/tiempos-radicado.ts`).
────────────────────────────────────────────────────────────── */

export const CATALOGO_TIPOS_SOLICITUD: readonly TipoSolicitudCatalogo[] = [
  /* ── PQRSD visibles al ciudadano ──────────────────────────── */
  {
    id: 'PETICION_GENERAL',
    nombre: 'Petición general (Derecho de petición)',
    nombreCorto: 'Petición general',
    categoria: 'PQRSD',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: true,
    descripcion:
      'Solicitud genérica del ciudadano para que la administración municipal realice un acto, atienda una petición o se pronuncie sobre un asunto de su competencia.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    prioridadSugerida: 'NARANJA',
  },
  {
    id: 'PETICION_INFORMACION',
    nombre: 'Petición de información',
    nombreCorto: 'Petición de información',
    categoria: 'PQRSD',
    terminoDias: 10,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: true,
    descripcion:
      'Solicitud para acceder a información que reposa en la Alcaldía y no se considera reservada.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'PETICION_DOCUMENTOS',
    nombre: 'Petición de documentos',
    nombreCorto: 'Petición de documentos',
    categoria: 'PQRSD',
    terminoDias: 10,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: false,
    requiereAnexo: false,
    descripcion:
      'Solicitud de copias o expedición de documentos en custodia de la administración municipal.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'CONSULTA',
    nombre: 'Petición para elevar una consulta',
    nombreCorto: 'Consulta',
    categoria: 'PQRSD',
    terminoDias: 30,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: true,
    descripcion:
      'Consulta formal sobre materias a cargo de la administración para que se emita concepto.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'NARANJA',
  },
  {
    id: 'QUEJA',
    nombre: 'Queja',
    nombreCorto: 'Queja',
    categoria: 'PQRSD',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: true,
    descripcion:
      'Manifestación de inconformidad por la conducta de un servidor público o por la prestación de un servicio.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    prioridadSugerida: 'NARANJA',
  },
  {
    id: 'RECLAMO',
    nombre: 'Reclamo',
    nombreCorto: 'Reclamo',
    categoria: 'PQRSD',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: true,
    descripcion:
      'Manifestación de inconformidad por la suspensión, omisión o incorrecta prestación de un servicio a cargo de la Alcaldía.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    prioridadSugerida: 'NARANJA',
  },
  {
    id: 'SUGERENCIA',
    nombre: 'Sugerencia',
    nombreCorto: 'Sugerencia',
    categoria: 'PQRSD',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: true,
    descripcion:
      'Propuesta del ciudadano para mejorar un proceso, trámite o servicio de la administración municipal.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'FELICITACION',
    nombre: 'Felicitación',
    nombreCorto: 'Felicitación',
    categoria: 'PQRSD',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: true,
    descripcion:
      'Reconocimiento del ciudadano por la actuación de un servidor o por la prestación de un servicio.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'DENUNCIA',
    nombre: 'Denuncia',
    nombreCorto: 'Denuncia',
    categoria: 'PQRSD',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: true,
    descripcion:
      'Comunicación al ente competente sobre presuntos hechos irregulares o conductas que puedan generar responsabilidad disciplinaria, fiscal o penal.',
    fundamento: FUNDAMENTO_PQRSD,
    activo: true,
    prioridadSugerida: 'ROJO',
  },
  {
    id: 'HABEAS_DATA',
    nombre: 'Solicitud de datos personales (Habeas Data)',
    nombreCorto: 'Habeas Data',
    categoria: 'PQRSD',
    terminoDias: 10,
    tipoDias: 'HABILES',
    visibleCiudadano: true,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Solicitud relacionada con el tratamiento de datos personales: acceso, actualización, rectificación o supresión.',
    fundamento: FUNDAMENTO_HABEAS,
    activo: true,
    prioridadSugerida: 'NARANJA',
  },

  /* ── Tipos internos (Ventanilla y dependencias) ───────────── */
  {
    id: 'DECLARACION_RETENCION_ICA',
    nombre: 'Declaración de Retención de Industria y Comercio',
    nombreCorto: 'Retención ICA',
    categoria: 'TRAMITE',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    requiereAnexo: true,
    dependenciaSugerida: 'SEC_HACIENDA',
    descripcion:
      'Trámite tributario asociado a la retención de Industria y Comercio. Uso interno de Hacienda.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    requiereValidacionJuridica: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'INFORMATIVO',
    nombre: 'Informativo',
    nombreCorto: 'Informativo',
    categoria: 'INTERNO',
    terminoDias: 10,
    tipoDias: 'CALENDARIO',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Comunicación interna o de carácter informativo recibida por la entidad; no requiere respuesta sustantiva sino registro y archivo.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'INVITACION',
    nombre: 'Invitación',
    nombreCorto: 'Invitación',
    categoria: 'INTERNO',
    terminoDias: 15,
    tipoDias: 'CALENDARIO',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Invitación dirigida a la administración municipal a participar en eventos, comités o reuniones.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'LICENCIA_CONSTRUCCION',
    nombre: 'Licencia de construcción',
    nombreCorto: 'Licencia construcción',
    categoria: 'TRAMITE',
    terminoDias: 45,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    requiereAnexo: true,
    dependenciaSugerida: 'SEC_PLANEACION',
    descripcion:
      'Trámite urbanístico para autorizar la construcción, ampliación, modificación o demolición de edificaciones.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    requiereValidacionJuridica: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'PERMISO_ESTABLECIMIENTO_PUBLICO',
    nombre: 'Permiso para establecimientos públicos',
    nombreCorto: 'Permiso establecimiento',
    categoria: 'TRAMITE',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    requiereAnexo: true,
    dependenciaSugerida: 'SEC_GOBIERNO',
    descripcion:
      'Permisos especiales para el funcionamiento de establecimientos abiertos al público (eventos, horarios extendidos, etc.).',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'PETICION_INFORMACION_CORTA',
    nombre: 'Petición de información (término corto)',
    nombreCorto: 'Información corta',
    categoria: 'INTERNO',
    terminoDias: 5,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Petición de información con término reducido por reglamento interno o por especial urgencia. Uso interno; el ciudadano radica como Petición de información estándar.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    requiereValidacionJuridica: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'NARANJA',
  },
  {
    id: 'PETICION_ENTES_CONTROL',
    nombre: 'Petición de entes de control',
    nombreCorto: 'Entes de control',
    categoria: 'ESPECIAL',
    terminoDias: 5,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Requerimiento de organismos de control (Procuraduría, Contraloría, Personería, Defensoría) que la administración debe atender en término corto.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    requiereValidacionJuridica: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'ROJO',
  },
  {
    id: 'PETICION_ENTRE_AUTORIDADES',
    nombre: 'Petición entre autoridades',
    nombreCorto: 'Entre autoridades',
    categoria: 'ESPECIAL',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Comunicación oficial entre entidades públicas en ejercicio de sus competencias.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'NARANJA',
  },
  {
    id: 'QUERELLA',
    nombre: 'Querella',
    nombreCorto: 'Querella',
    categoria: 'ESPECIAL',
    terminoDias: 5,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Acción policiva o procesal con término reducido, generalmente vinculada a la jurisdicción de policía o autoridades de control.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    requiereValidacionJuridica: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'ROJO',
  },
  {
    id: 'RESPUESTA_A_SOLICITUD',
    nombre: 'Respuesta a solicitud',
    nombreCorto: 'Respuesta a solicitud',
    categoria: 'INTERNO',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Documento que ingresa como respuesta a una solicitud previamente formulada por la entidad o por un tercero.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'SOLICITUD_SUBDIVISION',
    nombre: 'Solicitud de subdivisión',
    nombreCorto: 'Subdivisión',
    categoria: 'TRAMITE',
    terminoDias: 45,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    requiereAnexo: true,
    dependenciaSugerida: 'SEC_PLANEACION',
    descripcion:
      'Trámite urbanístico para la subdivisión de predios; uso interno de Planeación.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    requiereValidacionJuridica: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'SOLICITUD_SAC',
    nombre: 'Solicitud SAC',
    nombreCorto: 'SAC',
    categoria: 'INTERNO',
    terminoDias: 15,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Solicitud canalizada por el Sistema de Atención al Ciudadano (SAC) institucional. Trazabilidad interna.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'AMARILLO',
  },
  {
    id: 'URGENTE',
    nombre: 'Urgente',
    nombreCorto: 'Urgente',
    categoria: 'ESPECIAL',
    terminoDias: 2,
    tipoDias: 'HABILES',
    visibleCiudadano: false,
    visibleInterno: true,
    permiteAnonimo: false,
    descripcion:
      'Categoría especial de uso interno cuando se requiere atención inmediata por riesgo, urgencia o impacto institucional.',
    fundamento: FUNDAMENTO_HEREDADO,
    activo: true,
    requiereValidacionJuridica: true,
    heredadoSistemaActual: true,
    prioridadSugerida: 'ROJO',
  },
];

/* ──────────────────────────────────────────────────────────────
   Tipo identificador derivado del catálogo
────────────────────────────────────────────────────────────── */

export type TipoSolicitudCatalogoId = (typeof CATALOGO_TIPOS_SOLICITUD)[number]['id'];

/** ID por defecto cuando un tipo no existe o no se pudo resolver. */
export const TIPO_SOLICITUD_FALLBACK_ID = 'PETICION_GENERAL';

/* ──────────────────────────────────────────────────────────────
   Índice por id para acceso O(1)
────────────────────────────────────────────────────────────── */

const INDICE_CATALOGO: ReadonlyMap<string, TipoSolicitudCatalogo> = new Map(
  CATALOGO_TIPOS_SOLICITUD.map((t) => [t.id, t] as const),
);

/* ──────────────────────────────────────────────────────────────
   Helpers públicos del catálogo (Fase 5)
────────────────────────────────────────────────────────────── */

/** Devuelve la definición completa de un tipo por id, o undefined si no existe. */
export function getTipoSolicitudById(id: string | null | undefined): TipoSolicitudCatalogo | undefined {
  if (!id) return undefined;
  return INDICE_CATALOGO.get(id);
}

/** Lista de tipos visibles en el formulario ciudadano (`/radicacion`). */
export function getTiposSolicitudCiudadano(): TipoSolicitudCatalogo[] {
  return CATALOGO_TIPOS_SOLICITUD.filter((t) => t.visibleCiudadano && t.activo);
}

/** Lista de tipos disponibles para clasificación interna (Ventanilla / dependencias). */
export function getTiposSolicitudInternos(): TipoSolicitudCatalogo[] {
  return CATALOGO_TIPOS_SOLICITUD.filter((t) => t.visibleInterno && t.activo);
}

/** Lista de tipos activos (ciudadanos + internos). */
export function getTiposSolicitudActivos(): TipoSolicitudCatalogo[] {
  return CATALOGO_TIPOS_SOLICITUD.filter((t) => t.activo);
}

/** Devuelve el término (en días y unidad) de un tipo de solicitud, con fallback. */
export function getTerminoTipoSolicitud(id: string | null | undefined): { dias: number; unidad: TipoDiasTermino } {
  const tipo = getTipoSolicitudById(id) ?? getTipoSolicitudById(TIPO_SOLICITUD_FALLBACK_ID)!;
  return { dias: tipo.terminoDias, unidad: tipo.tipoDias };
}

/** Indica si el tipo es de uso exclusivamente interno (no visible al ciudadano). */
export function esTipoSolicitudInterno(id: string | null | undefined): boolean {
  const tipo = getTipoSolicitudById(id);
  if (!tipo) return false;
  return tipo.visibleInterno && !tipo.visibleCiudadano;
}

/** Indica si el tipo requiere validación jurídica/institucional adicional. */
export function requiereValidacionJuridica(id: string | null | undefined): boolean {
  return getTipoSolicitudById(id)?.requiereValidacionJuridica === true;
}

/** Etiqueta amigable para mostrar en interfaces (nombre + término + unidad). */
export function getLabelTipoSolicitud(id: string | null | undefined): string {
  const tipo = getTipoSolicitudById(id);
  if (!tipo) return 'Tipo no registrado';
  const unidadLegible = tipo.tipoDias === 'HABILES' ? 'días hábiles' : 'días calendario';
  return `${tipo.nombre} · ${tipo.terminoDias} ${unidadLegible}`;
}

/** Etiqueta extendida para el selector interno (incluye categoría y validación). */
export function getLabelInternoTipoSolicitud(id: string | null | undefined): string {
  const tipo = getTipoSolicitudById(id);
  if (!tipo) return 'Tipo no registrado';
  const unidad = tipo.tipoDias === 'HABILES' ? 'hábiles' : 'calendario';
  const partes = [
    tipo.nombre,
    tipo.categoria === 'PQRSD' ? 'PQRSD' : tipo.categoria === 'TRAMITE' ? 'TRÁMITE' : tipo.categoria === 'INTERNO' ? 'INTERNO' : 'ESPECIAL',
    `${tipo.terminoDias} días ${unidad}`,
  ];
  if (tipo.requiereValidacionJuridica) partes.push('Validar jurídicamente');
  return partes.join(' · ');
}

/* ──────────────────────────────────────────────────────────────
   Constantes derivadas (compatibilidad con consumidores existentes)
────────────────────────────────────────────────────────────── */

/** Ids ciudadanos en el orden recomendado de presentación. */
export const TIPOS_SOLICITUD_CIUDADANO_IDS: readonly string[] = getTiposSolicitudCiudadano().map((t) => t.id);

/** Ids internos en el orden recomendado de presentación. */
export const TIPOS_SOLICITUD_INTERNOS_IDS: readonly string[] = getTiposSolicitudInternos().map((t) => t.id);
