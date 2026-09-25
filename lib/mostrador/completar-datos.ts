import type { DatosNoAportados, SolicitanteRadicado } from '@/src/types/ventanilla';

/**
 * Sprint Cierre del mostrador — completar los datos que el solicitante
 * no aportó al radicar.
 *
 * Caso real: el ciudadano vuelve con su teléfono o correo. La marca
 * `datosNoAportados` se escribía al radicar pero no existía forma de
 * resolverla. Este helper calcula el cambio: SOLO datos de contacto
 * (whitelist: correo, teléfonos, dirección) — nombre y número de
 * documento son la identidad del radicado y NO se tocan por aquí.
 *
 * Función pura: sin Firestore, sin React. El endpoint la usa para
 * armar el update con Admin SDK.
 */

export interface DatosContactoAportados {
  email?:         string;
  telefonoMovil?: string;
  telefonoFijo?:  string;
  direccion?:     string;
}

export interface ResultadoCompletarDatos {
  /** Campos del solicitante a actualizar (solo los aportados, ya con trim). */
  cambios: Partial<Pick<SolicitanteRadicado, 'email' | 'telefonoMovil' | 'telefonoFijo' | 'direccion'>>;
  /** Marcas recalculadas; null = no queda ninguna (borrar el campo). */
  datosNoAportados: DatosNoAportados | null;
  /** Nombres humanos de lo aportado, para la nota (NUNCA los valores). */
  camposAportados: string[];
}

/**
 * Devuelve el cambio a aplicar, o null si no se aportó ningún dato
 * válido (todo vacío o fuera de la whitelist).
 */
export function aplicarDatosCompletados(
  marcasActuales: DatosNoAportados | undefined,
  aportados: DatosContactoAportados,
): ResultadoCompletarDatos | null {
  const cambios: ResultadoCompletarDatos['cambios'] = {};
  const camposAportados: string[] = [];

  const email = (aportados.email ?? '').trim();
  if (email) { cambios.email = email; camposAportados.push('correo'); }

  const movil = (aportados.telefonoMovil ?? '').trim();
  if (movil) { cambios.telefonoMovil = movil; camposAportados.push('teléfono móvil'); }

  const fijo = (aportados.telefonoFijo ?? '').trim();
  if (fijo) { cambios.telefonoFijo = fijo; camposAportados.push('teléfono fijo'); }

  const direccion = (aportados.direccion ?? '').trim();
  if (direccion) { cambios.direccion = direccion; camposAportados.push('dirección'); }

  if (camposAportados.length === 0) return null;

  // Recalcular marcas: lo aportado apaga su marca; documento no se toca.
  const marcas: DatosNoAportados = {
    documento: marcasActuales?.documento === true,
    correo:    marcasActuales?.correo    === true && !cambios.email,
    telefono:  marcasActuales?.telefono  === true && !cambios.telefonoMovil && !cambios.telefonoFijo,
    direccion: marcasActuales?.direccion === true && !cambios.direccion,
  };
  const quedaAlguna = marcas.documento || marcas.correo || marcas.telefono || marcas.direccion;

  return {
    cambios,
    datosNoAportados: quedaAlguna ? marcas : null,
    camposAportados,
  };
}

/** Nota de trazabilidad: dice QUÉ se aportó, nunca los valores. */
export function construirNotaDatosCompletados(camposAportados: string[]): string {
  return `El ciudadano aportó posteriormente: ${camposAportados.join(', ')}.`;
}
