import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';

/**
 * Sprint Radicación dirigida — sugerencia de dependencia destino.
 *
 * Combina dos señales deterministas (SIN IA, decisión aprobada):
 *  1. palabras clave sensibles de Comisaría — ganan siempre;
 *  2. el tipo de trámite elegido, cuando implica dependencia obvia;
 *  3. palabras clave generales en asunto/descripción.
 *
 * SOLO sugiere: la UI muestra un chip y la funcionaria decide aplicarlo
 * o ignorarlo. Nunca cambia el destino automáticamente. El mapa es un
 * punto de partida razonable para afinar con casos reales de recepción.
 *
 * Función pura: sin React, sin Firestore.
 */

export interface SugerenciaDependencia {
  oficina: TenantId;
  /** Nombre legible de la dependencia sugerida. */
  nombre: string;
  /** Qué disparó la sugerencia ("por 'predial'"). */
  razon: string;
}

/** Tipos de trámite con dependencia natural inequívoca. */
const TIPO_A_DEPENDENCIA: Partial<Record<string, TenantId>> = {
  LICENCIA_CONSTRUCCION:           'SEC_PLANEACION',
  DECLARACION_RETENCION_ICA:       'SEC_HACIENDA',
  PERMISO_ESTABLECIMIENTO_PUBLICO: 'SEC_GOBIERNO',
  QUERELLA:                        'SEC_GOBIERNO',
};

/* El orden importa: Comisaría va primero (los casos sensibles ganan
   sobre cualquier otra coincidencia). */
const REGLAS_PALABRAS: { oficina: TenantId; palabras: string[] }[] = [
  { oficina: 'SUB_COMISARIA',  palabras: ['violencia', 'maltrato', 'custodia', 'menor', 'familia'] },
  { oficina: 'SEC_HACIENDA',   palabras: ['predial', 'impuesto', 'paz y salvo'] },
  /* Ambiental pertenece a Planeación (el ingeniero ambiental trabaja
     allí — confirmado por el equipo, Fase 2). */
  { oficina: 'SEC_PLANEACION', palabras: ['licencia', 'construccion', 'urbanismo', 'uso de suelo', 'ambiental', 'medio ambiente', 'contaminacion'] },
  { oficina: 'SEC_GOBIERNO',   palabras: ['contratacion'] },
];

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Coincidencia al inicio de palabra: 'impuesto' matchea "impuestos"
 *  pero 'menor' no matchea "sumenor". */
function contienePalabra(texto: string, palabra: string): boolean {
  return new RegExp(`\\b${palabra}`).test(texto);
}

function armar(oficina: TenantId, razon: string): SugerenciaDependencia {
  return { oficina, nombre: NOMBRES_TENANT[oficina] ?? oficina, razon };
}

export function sugerirDependencia(entrada: {
  tipoSolicitudId?: string | null;
  asunto?: string;
  descripcion?: string;
}): SugerenciaDependencia | null {
  const texto = normalizar(`${entrada.asunto ?? ''} ${entrada.descripcion ?? ''}`);

  // 1 · casos sensibles primero
  const sensible = REGLAS_PALABRAS[0];
  for (const palabra of sensible.palabras) {
    if (contienePalabra(texto, palabra)) return armar(sensible.oficina, `por '${palabra}'`);
  }

  // 2 · tipo de trámite con dependencia obvia
  const porTipo = entrada.tipoSolicitudId
    ? TIPO_A_DEPENDENCIA[entrada.tipoSolicitudId]
    : undefined;
  if (porTipo) return armar(porTipo, 'por el tipo de trámite');

  // 3 · palabras clave generales
  for (const regla of REGLAS_PALABRAS.slice(1)) {
    for (const palabra of regla.palabras) {
      if (contienePalabra(texto, palabra)) return armar(regla.oficina, `por '${palabra}'`);
    }
  }

  return null;
}
