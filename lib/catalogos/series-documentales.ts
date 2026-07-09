import type { TenantId } from '@/src/types/radicado';
import type { TipoSolicitudId } from '@/lib/tiempos-radicado';

/**
 * Series documentales de ventanilla — Tablas de Retención Documental.
 *
 * FUENTE: TRD de Simacota, versión 2025 (BORRADOR en proceso de
 * aprobación — decisión del usuario, jul 2026: se implementa ya con el
 * borrador y cuando salga la TRD aprobada se actualiza ESTE archivo;
 * el resto del sistema no cambia).
 *
 * El radicado guarda una FOTO de la serie (código + nombre + fuente)
 * al nacer, así una actualización del catálogo nunca reescribe la
 * clasificación histórica — patrón MIPG de evidencia inmutable.
 *
 * Formato del código: `D.CS[.SUB]` donde D = oficina productora
 * (100-150), CS = serie, SUB = subserie.
 */

export const FUENTE_TRD = 'TRD 2025 (borrador en aprobación)';

/**
 * Código de oficina productora según la TRD por tenant del sistema.
 * Las sub-oficinas heredan el código de su dependencia.
 * NOTA: el borrador nombra la 140 como "Salud"; la estructura vigente
 * es Desarrollo Social (confirmado por el usuario) — el código se
 * conserva y el nombre lo pone el sistema.
 */
export const CODIGO_TRD_DEPENDENCIA: Partial<Record<TenantId, string>> = {
  DESPACHO_ALCALDE:              '100',
  VENTANILLA_UNICA:              '110', // pertenece a Secretaría General y Gobierno
  SEC_GOBIERNO:                  '110',
  SUB_COMISARIA:                 '111',
  SUB_INSPECCION_POLICIA_URBANA: '112',
  SUB_INSPECCION_POLICIA_RURAL:  '112',
  SUB_VICTIMAS:                  '110', // Víctimas opera bajo Gobierno
  SEC_PLANEACION:                '120',
  SUB_SISBEN:                    '120',
  SUB_RIESGOS_GRD:               '120',
  SEC_HACIENDA:                  '130',
  SUB_HACIENDA_YARIGUIES:        '130',
  SEC_DESARROLLO_SOCIAL:         '140',
  SUB_PROGRAMAS:                 '140',
  SEC_AGRICULTURA_UMATA:         '150',
};

export interface SerieDocumentalDef {
  /** Código de serie (CS) en la TRD. */
  cs: string;
  /** Código de subserie cuando aplica. */
  sub?: string;
  nombre: string;
  retencionGestionAnios?: number;
  retencionCentralAnios?: number;
  /** CT conservación total · E eliminación · M medio técnico · S selección. */
  disposicionFinal?: 'CT' | 'E' | 'M' | 'S';
}

/** Subconjunto de la TRD que produce la ventanilla (no el archivo completo). */
export const SERIES_VENTANILLA = {
  DERECHOS_DE_PETICION: {
    cs: '12', nombre: 'Derechos de Petición',
    retencionGestionAnios: 2, retencionCentralAnios: 8, disposicionFinal: 'S',
  },
  ACCION_TUTELA: {
    cs: '01', sub: '03', nombre: 'Acciones Constitucionales — Acción de Tutela',
    retencionGestionAnios: 2, retencionCentralAnios: 18, disposicionFinal: 'S',
  },
  LICENCIA_CONSTRUCCION: {
    cs: '22', sub: '01', nombre: 'Licencias — Licencia de Construcción',
  },
  LICENCIA_SUBDIVISION: {
    cs: '22', sub: '06', nombre: 'Licencias — Licencia de Subdivisión',
  },
  PROCESO_VERBAL_ABREVIADO: {
    cs: '26', sub: '07', nombre: 'Procesos — Proceso Verbal Abreviado Policial',
  },
  DECLARACIONES_TRIBUTARIAS: {
    cs: '11', nombre: 'Declaraciones Tributarias',
  },
} as const satisfies Record<string, SerieDocumentalDef>;

type SerieClave = keyof typeof SERIES_VENTANILLA;

/**
 * Tipo de solicitud → serie documental. Ausencia = la serie se define
 * en archivo (correspondencia informativa, invitaciones, etc.).
 */
const SERIE_POR_TIPO: Partial<Record<TipoSolicitudId, SerieClave>> = {
  PETICION_GENERAL:           'DERECHOS_DE_PETICION',
  PETICION_INFORMACION:       'DERECHOS_DE_PETICION',
  PETICION_INFORMACION_CORTA: 'DERECHOS_DE_PETICION',
  PETICION_DOCUMENTOS:        'DERECHOS_DE_PETICION',
  PETICION_ENTES_CONTROL:     'DERECHOS_DE_PETICION',
  PETICION_ENTRE_AUTORIDADES: 'DERECHOS_DE_PETICION',
  CONSULTA:                   'DERECHOS_DE_PETICION',
  QUEJA:                      'DERECHOS_DE_PETICION',
  RECLAMO:                    'DERECHOS_DE_PETICION',
  SUGERENCIA:                 'DERECHOS_DE_PETICION',
  FELICITACION:               'DERECHOS_DE_PETICION',
  DENUNCIA:                   'DERECHOS_DE_PETICION',
  HABEAS_DATA:                'DERECHOS_DE_PETICION',
  SOLICITUD_SAC:              'DERECHOS_DE_PETICION',
  URGENTE:                    'DERECHOS_DE_PETICION',
  LICENCIA_CONSTRUCCION:      'LICENCIA_CONSTRUCCION',
  SOLICITUD_SUBDIVISION:      'LICENCIA_SUBDIVISION',
  QUERELLA:                   'PROCESO_VERBAL_ABREVIADO',
  DECLARACION_RETENCION_ICA:  'DECLARACIONES_TRIBUTARIAS',
};

/** Foto de la serie que viaja con el radicado (evidencia inmutable). */
export interface SerieDocumentalAsignada {
  /** `D.CS[.SUB]` — p. ej. `110.12` o `120.22.01`. */
  codigo: string;
  nombre: string;
  fuente: string;
}

/**
 * Serie sugerida para un radicado según su tipo y su destino.
 * Devuelve null cuando el tipo no produce serie de ventanilla o el
 * destino no tiene código TRD — en ambos casos clasifica el archivo.
 */
export function sugerirSerieDocumental(
  tipoSolicitudId: TipoSolicitudId | string,
  oficinaDestino: TenantId,
): SerieDocumentalAsignada | null {
  const clave = SERIE_POR_TIPO[tipoSolicitudId as TipoSolicitudId];
  if (!clave) return null;
  const dep = CODIGO_TRD_DEPENDENCIA[oficinaDestino];
  if (!dep) return null;
  const serie: SerieDocumentalDef = SERIES_VENTANILLA[clave];
  const codigo = serie.sub ? `${dep}.${serie.cs}.${serie.sub}` : `${dep}.${serie.cs}`;
  return { codigo, nombre: serie.nombre, fuente: FUENTE_TRD };
}

/** Etiqueta corta para UI: `110.12 · Derechos de Petición`. */
export function labelSerieDocumental(serie: SerieDocumentalAsignada | null | undefined): string {
  if (!serie) return 'Se clasifica en archivo';
  return `${serie.codigo} · ${serie.nombre}`;
}
