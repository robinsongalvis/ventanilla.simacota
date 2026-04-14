import type { TenantId, ZonaGeografica } from './radicado';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

export interface TenantConfig {
  tenantId:       TenantId;
  nombreOficial:  string;
  emailOficial:   string;
  celularOficial: string;        // 10 dígitos sin espacios: "3502956401"
  responsable:    string;
  activo:         boolean;
  zonaExclusiva?: ZonaGeografica;
}

/* ══════════════════════════════════════════════════════════════
   DIRECTORIO OFICIAL — Fuente única de verdad
   Alcaldía Municipal de Simacota, Santander
══════════════════════════════════════════════════════════════ */

export const DIRECTORIO_TENANTS: Record<TenantId, TenantConfig> = {
  VENTANILLA_UNICA: {
    tenantId:       'VENTANILLA_UNICA',
    nombreOficial:  'Ventanilla Única',
    emailOficial:   'contactenos@simacota-santander.gov.co',
    celularOficial: '3502956401',
    responsable:    '',
    activo:         true,
  },
  DESPACHO_ALCALDE: {
    tenantId:       'DESPACHO_ALCALDE',
    nombreOficial:  'Despacho del Alcalde',
    emailOficial:   'alcaldia@simacota-santander.gov.co',
    celularOficial: '3502956389',
    responsable:    '',
    activo:         true,
  },
  SEC_GOBIERNO: {
    tenantId:       'SEC_GOBIERNO',
    nombreOficial:  'Secretaría de Gobierno',
    emailOficial:   'gobierno@simacota-santander.gov.co',
    celularOficial: '3502956394',
    responsable:    '',
    activo:         true,
  },
  SEC_PLANEACION: {
    tenantId:       'SEC_PLANEACION',
    nombreOficial:  'Secretaría de Planeación',
    emailOficial:   'planeacion@simacota-santander.gov.co',
    celularOficial: '3502956396',
    responsable:    '',
    activo:         true,
  },
  SEC_DESARROLLO_SOCIAL: {
    tenantId:       'SEC_DESARROLLO_SOCIAL',
    nombreOficial:  'Secretaría de Desarrollo Social',
    emailOficial:   'desarrollosocial@simacota-santander.gov.co',
    celularOficial: '3502956398',
    responsable:    '',
    activo:         true,
  },
  SEC_HACIENDA: {
    tenantId:       'SEC_HACIENDA',
    nombreOficial:  'Secretaría de Hacienda',
    emailOficial:   'tesoreria@simacota-santander.gov.co',
    celularOficial: '3502956397',
    responsable:    '',
    activo:         true,
  },
  SEC_AGRICULTURA_UMATA: {
    tenantId:       'SEC_AGRICULTURA_UMATA',
    nombreOficial:  'Secretaría de Agricultura (UMATA)',
    emailOficial:   'umata@simacota-santander.gov.co',
    celularOficial: '3502956388',
    responsable:    '',
    activo:         true,
  },
  SUB_COMISARIA: {
    tenantId:       'SUB_COMISARIA',
    nombreOficial:  'Comisaría de Familia',
    emailOficial:   'comisariadefamilia@simacota-santander.gov.co',
    celularOficial: '3502956386',
    responsable:    '',
    activo:         true,
  },
  SUB_INSPECCION_POLICIA_URBANA: {
    tenantId:       'SUB_INSPECCION_POLICIA_URBANA',
    nombreOficial:  'Inspección de Policía',
    emailOficial:   'inspecciondepolicia@simacota-santander.gov.co',
    celularOficial: '3502956387',
    responsable:    '',
    activo:         true,
  },
  SUB_INSPECCION_POLICIA_RURAL: {
    tenantId:       'SUB_INSPECCION_POLICIA_RURAL',
    nombreOficial:  'Inspección de Policía Yariguíes',
    emailOficial:   'inspecciondepoliciarural@simacota-santander.gov.co',
    celularOficial: '3502956385',
    responsable:    '',
    activo:         true,
    zonaExclusiva:  'ZONA_YARIGUIES',
  },
  SUB_VICTIMAS: {
    tenantId:       'SUB_VICTIMAS',
    nombreOficial:  'Enlace de Víctimas',
    emailOficial:   'enlacevictimas@simacota-santander.gov.co',
    celularOficial: '3502956399',
    responsable:    '',
    activo:         true,
  },
  SUB_SISBEN: {
    tenantId:       'SUB_SISBEN',
    nombreOficial:  'SISBEN',
    emailOficial:   'sisben@simacota-santander.gov.co',
    celularOficial: '3502956393',
    responsable:    '',
    activo:         true,
  },
  SUB_RIESGOS_GRD: {
    tenantId:       'SUB_RIESGOS_GRD',
    nombreOficial:  'Gestión del Riesgo de Desastres',
    emailOficial:   'grd@simacota-santander.gov.co',
    celularOficial: '3183921847',
    responsable:    '',
    activo:         true,
  },
  SUB_PROGRAMAS: {
    tenantId:       'SUB_PROGRAMAS',
    nombreOficial:  'Programas Sociales',
    emailOficial:   'programassociales@simacota-santander.gov.co',
    celularOficial: '3502956392',
    responsable:    '',
    activo:         true,
  },
  SUB_HACIENDA_YARIGUIES: {
    tenantId:       'SUB_HACIENDA_YARIGUIES',
    nombreOficial:  'Oficina Hacienda Yariguíes',
    emailOficial:   'haciendayariguies@simacota-santander.gov.co',
    celularOficial: '3502956400',
    responsable:    '',
    activo:         true,
    zonaExclusiva:  'ZONA_YARIGUIES',
  },
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

/** Nombre legible de la dependencia para mostrar en UI. */
export function getNombreTenant(id: TenantId): string {
  return DIRECTORIO_TENANTS[id]?.nombreOficial ?? id;
}

/** Email oficial de contacto de la dependencia. */
export function getEmailTenant(id: TenantId): string {
  return DIRECTORIO_TENANTS[id]?.emailOficial ?? '';
}

/** Celular oficial (10 dígitos, sin espacios). */
export function getCelularTenant(id: TenantId): string {
  return DIRECTORIO_TENANTS[id]?.celularOficial ?? '';
}

/**
 * Detecta la zona geográfica predominante de una dependencia.
 * Dependencias con zonaExclusiva atienden únicamente esa zona;
 * el resto atiende el casco urbano por defecto.
 */
export function detectarZonaGeografica(tenantId: TenantId): ZonaGeografica {
  return DIRECTORIO_TENANTS[tenantId]?.zonaExclusiva ?? 'CASCO_URBANO';
}

/**
 * Mapa plano TenantId → nombreOficial.
 * Útil en componentes que necesitan un Record<TenantId, string>
 * sin importar el directorio completo.
 */
export const NOMBRES_TENANT = Object.fromEntries(
  (Object.entries(DIRECTORIO_TENANTS) as [TenantId, TenantConfig][]).map(
    ([id, cfg]) => [id, cfg.nombreOficial]
  )
) as Record<TenantId, string>;
