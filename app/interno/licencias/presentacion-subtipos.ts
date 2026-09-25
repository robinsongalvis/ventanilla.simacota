/**
 * Traduce un código de `CATALOGO_FIGURAS_NORMATIVAS`
 * (`lib/motor-expedientes/catalogo-subtipos-normativo.ts`, DF-4) a su
 * nombre legible — usado por la Bandeja, el Detalle y el formulario de
 * radicación para no repetir el `Object.fromEntries` en cada componente.
 */
import { CATALOGO_FIGURAS_NORMATIVAS } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';

const NOMBRE_POR_CODIGO = new Map(CATALOGO_FIGURAS_NORMATIVAS.map((f) => [f.codigo, f.nombre]));

/** Nombre legible de un código de subtipo; si el código no está en el catálogo (dato legado sin migrar), devuelve el código tal cual. */
export function nombreSubtipo(codigo: string): string {
  return NOMBRE_POR_CODIGO.get(codigo) ?? codigo;
}
