import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAlertaVencimientoHtml } from '@/lib/email/templates/alerta-vencimiento';

/* ══════════════════════════════════════════════════════════════
   Contraste de los AVISOS DE TÉRMINO por correo.

   Por qué existe esta prueba: un correo que anuncia el vencimiento de un
   término legal y que el destinatario no puede leer no cumple su única
   función. Medido el 12-ago-2026, la cinta que dice «VENCE HOY» rendía
   2,38:1 y el aviso «Próximo a vencer» 3,07:1 — la mitad de lo que exige
   WCAG 1.4.3 AA (4,5:1 para texto normal).

   Se comprueba en dos capas: aserciones sobre el fuente (rápidas, fijan el
   contrato) y una medición sobre el HTML RENDERIZADO en jsdom, que resuelve
   el fondo heredado y es la que de verdad cazaría un tono nuevo puesto en
   otro sitio.

   Los colores van como hex literal a propósito: los clientes de correo
   (Gmail, Outlook) no resuelven variables CSS, así que ésta es la única
   excepción legítima a "sin estilos paralelos" del ADR-0030.
══════════════════════════════════════════════════════════════ */

/**
 * Canales 0-255 desde `#rgb`, `#rrggbb` o `rgb(r, g, b)`. Acepta las dos
 * formas porque jsdom NORMALIZA los estilos en línea a `rgb(...)`: una
 * versión anterior de esta prueba solo aceptaba hex y, al descartar todos
 * los elementos, pasaba en verde sin medir absolutamente nada.
 */
function canales(color: string): [number, number, number] | null {
  const limpio = color.trim();
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(limpio);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.exec(limpio);
  if (!hex) return null;
  const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminancia relativa (WCAG 2.x). */
function luminancia(color: string): number {
  const c = canales(color);
  if (!c) throw new Error(`Color no reconocido: ${color}`);
  const lineal = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2];
}

function contraste(texto: string, fondo: string): number {
  const a = luminancia(texto);
  const b = luminancia(fondo);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const MINIMO_AA = 4.5;

function leer(ruta: string): string {
  return readFileSync(join(process.cwd(), ruta), 'utf8');
}

describe('contraste — la fórmula WCAG que usa esta prueba', () => {
  it('reproduce valores conocidos', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // El caso que motivó todo: el ámbar de alerta sobre su caja tintada.
    expect(contraste('#D97706', '#FFFBEB')).toBeCloseTo(3.07, 1);
  });
});

describe('emailNotifications — avisos de término legibles', () => {
  const FUENTE = leer('lib/simi-juridico/emailNotifications.ts');

  it('los colores de alerta van como HEX LITERAL, nunca var() (Gmail/Outlook no resuelven variables CSS)', () => {
    expect(FUENTE).toMatch(/const COLOR_TEXTO_PELIGRO = '#B91C1C';/);
    expect(FUENTE).toMatch(/const COLOR_TEXTO_ADVERTENCIA = '#8E5C06';/);
    expect(FUENTE).not.toMatch(/color:\s*var\(--/);
  });

  it('AMBAS ramas de la alerta de vencimiento cumplen AA sobre su propia caja', () => {
    // No solo la de «Próximo a vencer» (3,07): la de «¡VENCE HOY!» también
    // incumplía, con 4,41 — y es la más urgente de las dos.
    expect(contraste('#B91C1C', '#FEF2F2')).toBeGreaterThanOrEqual(MINIMO_AA); // vence hoy
    expect(contraste('#8E5C06', '#FFFBEB')).toBeGreaterThanOrEqual(MINIMO_AA); // próximo a vencer
  });

  it('ya no queda ninguno de los tonos que incumplían', () => {
    for (const tono of ['#D97706', '#DC2626', '#B45309']) {
      expect(FUENTE).not.toContain(tono);
    }
  });
});

describe('plantillas de alerta de vencimiento — la cinta de urgencia se lee', () => {
  const PLANTILLAS = ['lib/email/templates/alerta-vencimiento.ts', 'lib/email/templates/auditoria-consecutivos.ts'];

  it('la insignia dorada lleva texto oscuro, no blanco (blanco sobre #D4A017 = 2,38:1)', () => {
    // Se conserva el dorado institucional de la insignia: lo que cambia es
    // el texto. Blanco sobre ese dorado era el peor contraste de todo el
    // correo, y caía justo en el elemento que dice «VENCE HOY».
    expect(contraste('#FFFFFF', '#D4A017')).toBeLessThan(MINIMO_AA);
    expect(contraste('#1F2933', '#D4A017')).toBeGreaterThanOrEqual(MINIMO_AA);

    for (const ruta of PLANTILLAS) {
      expect(leer(ruta)).not.toMatch(/background:#D4A017;color:#fff/);
      expect(leer(ruta)).toMatch(/background:#D4A017;color:#1F2933/);
    }
  });

  it('las etiquetas y el pie cumplen sobre sus fondos tintados', () => {
    expect(contraste('#6B7A6E', '#F6F9F6')).toBeLessThan(MINIMO_AA); // el anterior
    expect(contraste('#5A6B5D', '#F6F9F6')).toBeGreaterThanOrEqual(MINIMO_AA); // tarjeta
    expect(contraste('#5A6B5D', '#F3F6F3')).toBeGreaterThanOrEqual(MINIMO_AA); // pie

    for (const ruta of PLANTILLAS) {
      expect(leer(ruta)).not.toContain('#6B7A6E');
    }
  });
});


/* ── Medición sobre el correo RENDERIZADO ─────────────────────────
   Las comprobaciones de arriba leen el fuente, que es frágil: no ven el
   fondo heredado ni el anidamiento real. Esto monta el HTML del correo en
   jsdom y recorre cada texto resolviendo su fondo efectivo hacia arriba —
   el mismo método con el que se midió la aplicación en el navegador. Es lo
   que habría cazado el 2,38:1 de la cinta aunque el hex hubiera cambiado
   de sitio. ────────────────────────────────────────────────────── */

/** Fondo EFECTIVO: el primero declarado subiendo por los ancestros. */
function fondoEfectivo(el: Element): string {
  let nodo: Element | null = el;
  while (nodo) {
    const estilo = (nodo as HTMLElement).style;
    for (const declarado of [estilo?.backgroundColor, estilo?.background]) {
      if (declarado && canales(declarado)) return declarado;
    }
    nodo = nodo.parentElement;
  }
  return '#FFFFFF';
}

describe('correo de alerta de vencimiento — medido sobre el HTML renderizado', () => {
  const html = buildAlertaVencimientoHtml({
    radicadoId: '1-110-202608-00000042',
    funcionarioNombre: 'Funcionaria de Planeación',
    asunto: 'Solicitud de licencia de construcción — obra nueva',
    ciudadanoNombre: 'María Fernanda López Ortiz',
    dependenciaNombre: 'Secretaría de Planeación',
    diasRestantes: 1,
    fechaVencimiento: '2026-08-14T12:00:00-05:00',
    tipoSolicitud: 'Licencia urbanística',
    enlaceUrl: 'https://ventanilla-simacota.vercel.app/interno/dashboard',
  });

  function textosInspeccionados(): number {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('*')).filter((el) => {
      const color = (el as HTMLElement).style?.color?.trim();
      const propio = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
      return Boolean(color && canales(color) && propio);
    }).length;
  }

  function textosPorDebajoDelUmbral() {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fallos: string[] = [];
    for (const el of Array.from(doc.querySelectorAll('*'))) {
      const color = (el as HTMLElement).style?.color?.trim();
      if (!color || !canales(color)) continue;
      // Solo nodos con texto PROPIO (no heredado de los hijos).
      const propio = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!propio) continue;
      const fondo = fondoEfectivo(el);
      const ratio = contraste(color, fondo);
      if (ratio < MINIMO_AA) fallos.push(`«${propio.slice(0, 34)}» ${color} sobre ${fondo} = ${ratio.toFixed(2)}`);
    }
    return fallos;
  }

  it('mide de verdad: encuentra textos coloreados que inspeccionar', () => {
    // Guardia contra el falso verde: si el filtro deja de reconocer el
    // formato de color que produce jsdom, esta prueba avisa en vez de pasar
    // vacía. Ya ocurrió una vez, aceptando solo hex cuando jsdom da rgb().
    expect(textosInspeccionados()).toBeGreaterThan(10);
  });

  it('ningún texto del correo queda por debajo de 4,5:1', () => {
    expect(textosPorDebajoDelUmbral()).toEqual([]);
  });

  it('la cinta de urgencia («VENCE HOY») sale con texto oscuro sobre el dorado institucional', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const insignia = Array.from(doc.querySelectorAll('span')).find((s) =>
      (s.getAttribute('style') ?? '').includes('#D4A017'),
    );
    expect(insignia).toBeTruthy();
    expect(insignia!.getAttribute('style')).toContain('color:#1F2933');
    expect(insignia!.textContent?.trim()).toBeTruthy();
  });
});
