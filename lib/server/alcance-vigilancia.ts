/**
 * ALCANCE DECLARADO DE UN INSTRUMENTO DE VIGILANCIA — regla operativa del
 * ADR-0033 §4.6, elevada tras su sexta aparición (26-ago-2026).
 *
 * LA REGLA, en las palabras del propietario:
 *
 *   «Una lista que se recorre sin declarar quién no está en ella es un
 *    vigilante que no sabe qué no está mirando.»
 *
 * POR QUÉ EXISTE ESTE MÓDULO. La regla se enunció seis veces y se incumplió
 * seis veces, dos de ellas sobre la MISMA serie y en la MISMA semana: primero
 * el vigilante y el escritor no coincidieron en dónde vivía el dato
 * (`apertura` contra `abiertaEn`), después el vigilante recorrió una lista de
 * la que faltaba la serie que más importaba (`expedientes` fuera de
 * `COLECCION_POR_SERIE`). En ambos casos el instrumento compiló, pasó las
 * pruebas y no se quejó — porque el silencio de un vigilante es
 * indistinguible de «todo en orden».
 *
 * Depender de que alguien lo recuerde es lo que ya falló. Esto lo convierte
 * en algo que una prueba puede comprobar: el instrumento declara contra qué
 * corre Y qué deja fuera, con su razón, y `elementosNoDeclarados` verifica que
 * entre las dos listas no quede ni un caso huérfano.
 *
 * NO impide excluir. Excluir es legítimo y a veces obligatorio — lo que deja
 * de ser posible es excluir SIN DARSE CUENTA. La diferencia entre las dos es
 * exactamente la diferencia entre una decisión y un descuido.
 */

export interface AlcanceVigilancia<T extends string> {
  /** Elementos del dominio que este instrumento SÍ vigila. */
  readonly cubiertos: readonly T[];
  /**
   * Elementos que NO vigila, cada uno con la razón por la que queda fuera.
   * La razón es para quien lea el informe dentro de un año, no para el
   * compilador: «se audita en su propia rama» es una razón; «TODO» no.
   *
   * Tipado como `Partial<Record<T, string>>` a propósito: el compilador
   * rechaza una clave que no pertenezca al dominio, así que una serie mal
   * escrita en la exclusión no puede hacerse pasar por declarada.
   */
  readonly excluidos: Readonly<Partial<Record<T, string>>>;
}

/**
 * Los elementos del dominio que el instrumento NO vigila y TAMPOCO declaró
 * como excluidos — sus puntos ciegos.
 *
 * Devuelve una lista, no lanza: quien la use decide si es un fallo de prueba,
 * una entrada de informe o una alarma. Vacía significa que el instrumento sabe
 * qué está mirando y qué no.
 */
export function elementosNoDeclarados<T extends string>(
  dominio: readonly T[],
  alcance: AlcanceVigilancia<T>,
): T[] {
  const cubiertos = new Set<string>(alcance.cubiertos);
  const excluidos = new Set<string>(Object.keys(alcance.excluidos));
  return dominio.filter((x) => !cubiertos.has(x) && !excluidos.has(x));
}

/**
 * Lo contrario: elementos declarados que ya NO existen en el dominio.
 *
 * Un instrumento que dice vigilar algo inexistente es tan sospechoso como uno
 * que olvida algo real — normalmente significa que el dominio cambió de nombre
 * y la declaración se quedó atrás, que es el paso previo a quedarse ciego.
 */
export function elementosFantasma<T extends string>(
  dominio: readonly T[],
  alcance: AlcanceVigilancia<T>,
): string[] {
  const real = new Set<string>(dominio);
  return [...alcance.cubiertos, ...Object.keys(alcance.excluidos)].filter((x) => !real.has(x));
}
