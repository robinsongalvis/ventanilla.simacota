import type { TenantId } from '@/src/types/radicado';

/**
 * Fase 2 · Dependencia + Área responsable — catálogo de áreas/oficinas
 * de la Alcaldía de Simacota.
 *
 * Curado con conocimiento real de la administración (Laura +
 * capacitación + el equipo, 2026-07-04). Tres clases de área:
 *
 *  - `dependencia`: oficina propia de UNA dependencia (Jurídica es de
 *    Gobierno; Ambiental es de Planeación). Hereda la visibilidad de
 *    su dependencia — no tiene aislamiento propio.
 *  - `transversal`: trabaja para cualquier dependencia (Almacén y
 *    Archivo, Sistemas).
 *  - `tenantPropio`: el área ya existe como destino con aislamiento
 *    propio en el sistema (Comisaría, Sisbén…). Se documenta aquí para
 *    el mapa completo, pero NO aparece en el selector de área: a esas
 *    se llega trasladando el destino, como siempre — su aislamiento
 *    (p. ej. identidad reservada en Comisaría) se preserva.
 *
 * Regla del catálogo (acordada): un área entra SOLO si recibe y
 * trabaja trámites. Agregar una nueva = una entrada aquí.
 */

export interface AreaResponsable {
  areaId:      string;
  nombre:      string;
  /** Dependencia a la que pertenece (ausente si transversal). */
  dependencia?: TenantId;
  /** Trabaja para cualquier dependencia. */
  transversal?: boolean;
  /** Tenant propio ya existente (destino directo, no área asignable). */
  tenantPropio?: TenantId;
}

export const CATALOGO_AREAS: Record<string, AreaResponsable> = {
  /* ── Secretaría de Gobierno ─────────────────────────────────── */
  COMISARIA_FAMILIA: {
    areaId: 'COMISARIA_FAMILIA', nombre: 'Comisaría de Familia',
    dependencia: 'SEC_GOBIERNO', tenantPropio: 'SUB_COMISARIA',
  },
  INSPECCION_POLICIA_URBANA: {
    areaId: 'INSPECCION_POLICIA_URBANA', nombre: 'Inspección de Policía Urbana',
    dependencia: 'SEC_GOBIERNO', tenantPropio: 'SUB_INSPECCION_POLICIA_URBANA',
  },
  INSPECCION_POLICIA_RURAL: {
    areaId: 'INSPECCION_POLICIA_RURAL', nombre: 'Inspección de Policía Rural',
    dependencia: 'SEC_GOBIERNO', tenantPropio: 'SUB_INSPECCION_POLICIA_RURAL',
  },
  ENLACE_VICTIMAS: {
    areaId: 'ENLACE_VICTIMAS', nombre: 'Enlace de Víctimas',
    dependencia: 'SEC_GOBIERNO', tenantPropio: 'SUB_VICTIMAS',
  },
  TALENTO_HUMANO: {
    areaId: 'TALENTO_HUMANO', nombre: 'Talento Humano',
    dependencia: 'SEC_GOBIERNO',
  },
  JURIDICA: {
    areaId: 'JURIDICA', nombre: 'Jurídica',
    dependencia: 'SEC_GOBIERNO',
  },
  ENLACE_JAC: {
    areaId: 'ENLACE_JAC', nombre: 'Enlace JAC',
    dependencia: 'SEC_GOBIERNO',
  },
  CONTRATACION: {
    areaId: 'CONTRATACION', nombre: 'Contratación',
    dependencia: 'SEC_GOBIERNO',
  },
  CONTROL_INTERNO_OFICINA: {
    // La OFICINA pertenece a Gobierno; el ROL de permisos
    // CONTROL_INTERNO del sistema es independiente de esta pertenencia.
    areaId: 'CONTROL_INTERNO_OFICINA', nombre: 'Control Interno',
    dependencia: 'SEC_GOBIERNO',
  },

  /* ── Secretaría de Planeación e Infraestructura ─────────────── */
  SUBSECRETARIA_PLANEACION: {
    areaId: 'SUBSECRETARIA_PLANEACION', nombre: 'Subsecretaría de Planeación',
    dependencia: 'SEC_PLANEACION',
  },
  SISBEN: {
    areaId: 'SISBEN', nombre: 'Sisbén',
    dependencia: 'SEC_PLANEACION', tenantPropio: 'SUB_SISBEN',
  },
  GESTION_RIESGO: {
    areaId: 'GESTION_RIESGO', nombre: 'Gestión del Riesgo',
    dependencia: 'SEC_PLANEACION', tenantPropio: 'SUB_RIESGOS_GRD',
  },
  AMBIENTAL: {
    // El ingeniero ambiental trabaja directamente en Planeación
    // (confirmado de primera mano).
    areaId: 'AMBIENTAL', nombre: 'Ambiental',
    dependencia: 'SEC_PLANEACION',
  },

  /* ── Secretaría de Hacienda y del Tesoro ────────────────────── */
  HACIENDA_YARIGUIES: {
    // Maneja el sector del Bajo Simacota (pertenencia territorial).
    areaId: 'HACIENDA_YARIGUIES', nombre: 'Hacienda Yariguíes',
    dependencia: 'SEC_HACIENDA', tenantPropio: 'SUB_HACIENDA_YARIGUIES',
  },

  /* ── Secretaría de Desarrollo Social ────────────────────────── */
  CULTURA: {
    areaId: 'CULTURA', nombre: 'Cultura',
    dependencia: 'SEC_DESARROLLO_SOCIAL',
  },
  DEPORTES: {
    areaId: 'DEPORTES', nombre: 'Deportes',
    dependencia: 'SEC_DESARROLLO_SOCIAL',
  },
  BIBLIOTECA: {
    areaId: 'BIBLIOTECA', nombre: 'Biblioteca',
    dependencia: 'SEC_DESARROLLO_SOCIAL',
  },
  PROGRAMAS_SOCIALES: {
    areaId: 'PROGRAMAS_SOCIALES', nombre: 'Programas Sociales',
    dependencia: 'SEC_DESARROLLO_SOCIAL', tenantPropio: 'SUB_PROGRAMAS',
  },

  /* ── Despacho del Alcalde ───────────────────────────────────── */
  COMUNICACIONES: {
    // Ubicación por confirmar con el decreto de estructura orgánica.
    areaId: 'COMUNICACIONES', nombre: 'Comunicaciones',
    dependencia: 'DESPACHO_ALCALDE',
  },

  /* ── Transversales — trabajan para cualquier dependencia ───── */
  ALMACEN_ARCHIVO: {
    // Una sola área (decisión de la capacitación).
    areaId: 'ALMACEN_ARCHIVO', nombre: 'Almacén y Archivo',
    transversal: true,
  },
  SISTEMAS: {
    areaId: 'SISTEMAS', nombre: 'Sistemas',
    transversal: true,
  },
};

export function getArea(areaId: string | null | undefined): AreaResponsable | undefined {
  if (!areaId) return undefined;
  return CATALOGO_AREAS[areaId];
}

export function getNombreArea(areaId: string | null | undefined): string {
  return getArea(areaId)?.nombre ?? (areaId ?? '');
}

/**
 * Áreas asignables cuando el destino es `tenant`: las propias de esa
 * dependencia SIN tenant propio (a las que tienen tenant se llega
 * trasladando el destino) + todas las transversales.
 */
export function areasParaDependencia(tenant: TenantId): AreaResponsable[] {
  return Object.values(CATALOGO_AREAS).filter((a) =>
    (a.transversal === true)
    || (a.dependencia === tenant && !a.tenantPropio));
}

/**
 * Validación del endpoint: el área debe existir y ser transversal o
 * propia del destino. Devuelve el mensaje de error o null si es válida.
 */
export function validarAreaParaDestino(
  areaId: string,
  tenantDestino: TenantId,
): string | null {
  const area = getArea(areaId);
  if (!area) return 'Área responsable desconocida.';
  if (area.tenantPropio) {
    return 'Esa oficina tiene destino propio: traslade el radicado a su dependencia.';
  }
  if (!area.transversal && area.dependencia !== tenantDestino) {
    return 'El área no pertenece a la dependencia destino ni es transversal.';
  }
  return null;
}
