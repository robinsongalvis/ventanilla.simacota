import { readFileSync } from 'node:fs';

/**
 * EL INVENTARIO DE COLECCIONES SE DERIVA DE `firestore.rules`, NO SE ESCRIBE.
 *
 * POR QUÉ EXISTE (26-ago-2026). El verificador del ensayo de restauración
 * comprobaba tres colecciones de una lista escrita a mano: `ventanilla_radicados`,
 * `expedientes` y `counters`. Las reglas declaran veintitantas.
 *
 * Entre las que faltaban estaba `users`. Sin `users`,
 * `requireActiveInternalUser()` no puede autenticar a NADIE: la plataforma
 * restaurada es inservible — y el ensayo firmaba «✔ RESTAURACIÓN VÁLIDA».
 * Comprar confianza falsa sobre un respaldo es peor que no tener ensayo.
 *
 * Una lista escrita a mano envejece en silencio: nadie que añada una colección
 * se acuerda de venir aquí. `firestore.rules` no puede envejecer igual, porque
 * una colección sin regla NO SE PUEDE LEER — es el único inventario que el
 * sistema se ve obligado a mantener al día.
 *
 * ALCANCE DECLARADO (ADR-0033 §4.6-bis) — lo que este inventario NO incluye:
 *  · `{document=**}` — el catch-all de denegación, que no es una colección.
 *  · `databases/{database}/documents` — el envoltorio de la sintaxis.
 * Las dos exclusiones son de sintaxis, no de dominio.
 */

/** Lo que no es una colección aunque aparezca en un `match`. */
const NO_SON_COLECCIONES = new Set(['databases', 'documents']);

/**
 * Lee `firestore.rules` y devuelve el inventario real.
 *
 * @returns {{raiz: string[], subcolecciones: {padre: string, nombre: string, ruta: string}[]}}
 *   `raiz` son las colecciones de primer nivel; `subcolecciones` las anidadas,
 *   con el camino por el que se llega — que es lo que permite comprobarlas sin
 *   inventar la ruta.
 */
export function inventarioDesdeReglas(ruta = 'firestore.rules') {
  const texto = readFileSync(ruta, 'utf8');
  const raiz = new Set();
  const subcolecciones = [];
  const vistas = new Set();

  /* Se recorre manteniendo una PILA de bloques abiertos: en `firestore.rules`
     un `match` anidado expresa una subcolección, y su padre es el bloque que lo
     envuelve. Sin la pila habría que adivinar por indentación, que es frágil. */
  const pila = [];
  for (const linea of texto.split('\n')) {
    const m = linea.match(/match\s+\/(\S+)\s*\{/);
    if (!m) {
      if (linea.trim() === '}') pila.pop();
      continue;
    }
    const indent = linea.length - linea.trimStart().length;
    while (pila.length && pila[pila.length - 1].indent >= indent) pila.pop();

    const camino = m[1];
    if (camino.includes('{document=**}')) {
      pila.push({ nombre: null, indent });
      continue;
    }

    /* Los segmentos PARES de un camino son colecciones; los impares, comodines
       de documento. Se descartan además los envoltorios de la sintaxis. */
    const cols = camino.split('/').filter(Boolean)
      .filter((_, i) => i % 2 === 0)
      .filter((c) => !c.startsWith('{') && !NO_SON_COLECCIONES.has(c));

    if (cols.length === 0) {
      pila.push({ nombre: null, indent });
      continue;
    }

    const cadena = [...pila.map((x) => x.nombre).filter(Boolean), ...cols];
    raiz.add(cadena[0]);
    if (cadena.length > 1) {
      const rutaCompleta = cadena.join('/');
      if (!vistas.has(rutaCompleta)) {
        vistas.add(rutaCompleta);
        subcolecciones.push({
          padre: cadena[cadena.length - 2],
          nombre: cadena[cadena.length - 1],
          ruta: rutaCompleta,
        });
      }
    }
    pila.push({ nombre: cols[cols.length - 1], indent });
  }

  return { raiz: [...raiz].sort(), subcolecciones };
}
