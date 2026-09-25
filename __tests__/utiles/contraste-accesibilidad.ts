/**
 * Medición de contraste WCAG 2.x sobre HTML ya renderizado.
 *
 * POR QUÉ EXISTE: los correos institucionales son, muchas veces, la única
 * cara del municipio que ve el ciudadano — la constancia de su radicado, el
 * aviso de que su trámite vence, la respuesta a su petición. Y a diferencia
 * de la aplicación, un correo no se arregla en caliente: una vez enviado
 * queda en el buzón tal como salió. Convertir eso en un control ejecutable
 * es más barato que revisarlo a ojo cada vez que alguien toca una plantilla.
 *
 * Es utillaje de PRUEBAS, no API de producto: hoy no tiene ningún llamador
 * en `app/` ni en `lib/`, y `barrerContraste` necesita un DOM (jsdom). Si
 * algún día se usa en un gate de CI o en una herramienta propia, se mueve —
 * mientras tanto vive junto a quien lo usa.
 *
 * MÉTODO: se mide sobre el HTML RENDERIZADO, resolviendo color y fondo
 * EFECTIVOS hacia arriba por los ancestros. Un barrido de texto plano sobre
 * el fuente no sirve: empareja cada color con el `background` más cercano
 * hacia atrás —que casi nunca es el suyo— y no ve lo heredado. Medido el
 * 13-ago-2026, sobre el fuente salían 47 "hallazgos", la mayoría inventados.
 *
 * Marco normativo: WCAG 2.1 criterio 1.4.3 (AA), exigible a entidades
 * públicas colombianas por NTC 5854 y la Resolución MinTIC 1519 de 2020.
 */

/** Umbral AA para texto normal. */
export const CONTRASTE_MINIMO_AA = 4.5;

/** Umbral AA para texto grande (≥24 px, o ≥18,66 px en negrita). */
export const CONTRASTE_MINIMO_AA_GRANDE = 3;

/**
 * Canales 0-255 desde `#rgb`, `#rrggbb` o `rgb(r, g, b)`.
 *
 * Acepta las dos formas porque el DOM NORMALIZA los estilos en línea a
 * `rgb(...)`: una versión anterior de este analizador solo aceptaba
 * hexadecimal y, al descartar todos los elementos, daba verde sin medir
 * absolutamente nada. De ahí también la guarda `inspeccionados`.
 */
export function canalesDeColor(color: string): [number, number, number] | null {
  const limpio = color.trim();
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(limpio);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.exec(limpio);
  if (!hex) return null;
  const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminancia relativa (WCAG 2.x, fórmula oficial). */
export function luminanciaRelativa(color: string): number {
  const canales = canalesDeColor(color);
  if (!canales) throw new Error(`Color no reconocido: ${color}`);
  const lineal = canales.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2];
}

/** Razón de contraste entre dos colores, de 1 (nulo) a 21 (negro sobre blanco). */
export function razonDeContraste(texto: string, fondo: string): number {
  const a = luminanciaRelativa(texto);
  const b = luminanciaRelativa(fondo);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Un texto que no alcanza su umbral. */
export interface TextoIlegible {
  /** Primeros caracteres del texto afectado, para poder localizarlo. */
  texto: string;
  color: string;
  fondo: string;
  razon: number;
  tamPx: number;
  /** `true` si aplica el umbral relajado de texto grande (3:1). */
  grande: boolean;
  umbral: number;
}

export interface ResultadoBarrido {
  ilegibles: TextoIlegible[];
  /** Cuántos textos se llegaron a medir — guarda contra el falso verde. */
  inspeccionados: number;
}

/** Sube por los ancestros hasta el primer valor declarado de `propiedad`. */
function heredado(el: Element, leer: (estilo: CSSStyleDeclaration) => string | undefined): string | null {
  let nodo: Element | null = el;
  while (nodo) {
    const valor = leer((nodo as HTMLElement).style);
    if (valor && valor.trim()) return valor.trim();
    nodo = nodo.parentElement;
  }
  return null;
}

/**
 * Recorre el HTML y devuelve los textos que no alcanzan su umbral WCAG AA.
 *
 * Solo evalúa nodos con texto PROPIO (no el heredado de sus hijos), para no
 * contar dos veces al mismo ancestro. Sin `font-size` declarado se asume
 * 16 px, el defecto de los clientes de correo — el criterio conservador.
 *
 * @param html    HTML completo, tal como se enviaría.
 * @param lienzo  Fondo del contenedor exterior (el del cliente de correo).
 */
export function barrerContraste(html: string, lienzo = '#FFFFFF'): ResultadoBarrido {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ilegibles: TextoIlegible[] = [];
  let inspeccionados = 0;

  for (const el of Array.from(doc.querySelectorAll('*'))) {
    const propio = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    if (!propio) continue;

    const color = heredado(el, (s) => s?.color);
    if (!color || !canalesDeColor(color)) continue;

    const fondoDeclarado = heredado(el, (s) => (canalesDeColor(s?.backgroundColor ?? '') ? s.backgroundColor : s?.background));
    const fondo = fondoDeclarado && canalesDeColor(fondoDeclarado) ? fondoDeclarado : lienzo;
    inspeccionados++;

    const tam = heredado(el, (s) => s?.fontSize);
    const tamPx = tam && /px$/.test(tam) ? parseFloat(tam) : 16;
    const pesoTexto = heredado(el, (s) => s?.fontWeight);
    const peso = pesoTexto ? (/bold/i.test(pesoTexto) ? 700 : Number(pesoTexto) || 400) : 400;

    const grande = tamPx >= 24 || (tamPx >= 18.66 && peso >= 700);
    const umbral = grande ? CONTRASTE_MINIMO_AA_GRANDE : CONTRASTE_MINIMO_AA;
    const razon = razonDeContraste(color, fondo);

    if (razon < umbral) {
      ilegibles.push({ texto: propio.slice(0, 44), color, fondo, razon: Number(razon.toFixed(2)), tamPx, grande, umbral });
    }
  }

  return { ilegibles, inspeccionados };
}
