import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { razonDeContraste, CONTRASTE_MINIMO_AA } from './utiles/contraste-accesibilidad';

/* ══════════════════════════════════════════════════════════════
   Tema claro / oscuro del Tablero (ADR-0043).

   Tres garantías que el ojo no puede sostener sobre ~300 reemplazos:
   1. El modo CLARO es idéntico: cada `--tema-<rol>-<hex>` vale en `:root`
      exactamente el hex de su nombre, el literal que reemplazó.
   2. Ningún token usado queda sin valor oscuro (resolvería al claro y
      aparecería un parche blanco en medio del tema oscuro).
   3. Todo texto oscuro cumple WCAG AA (4,5:1) sobre las superficies
      oscuras donde se pinta — la misma vara de ADR-0030 para el claro.
══════════════════════════════════════════════════════════════ */

const CSS = readFileSync('app/globals.css', 'utf8');
/** Todo archivo de la app que pinte con tokens de tema (ADR-0045: todas las pantallas). */
function archivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivosTsx(ruta);
    return /\.(tsx|ts)$/.test(n) ? [ruta] : [];
  });
}
const ARCHIVOS_MIGRADOS = archivosTsx('app');

function bloque(selector: string): Map<string, string> {
  const inicio = CSS.indexOf(`${selector} {`, CSS.indexOf('TEMA CLARO / OSCURO DEL PANEL INTERNO'));
  const fin = CSS.indexOf('}', inicio);
  const cuerpo = CSS.slice(inicio, fin);
  return new Map([...cuerpo.matchAll(/(--tema-[a-z]+-[0-9a-f]{6}):\s*(#[0-9A-Fa-f]{6});/g)].map((m) => [m[1], m[2]]));
}

const claro = bloque(':root,\n[data-tema="oscuro"] .isla-clara');
const oscuro = bloque('[data-tema="oscuro"]');
const usados = new Set(
  ARCHIVOS_MIGRADOS.flatMap((ruta) =>
    [...readFileSync(ruta, 'utf8').matchAll(/var\((--tema-[a-z]+-[0-9a-f]{6})\)/g)].map((m) => m[1])),
);

/** Superficies oscuras sobre las que se pinta texto en el Tablero. */
const SUPERFICIES_OSCURAS = ['--tema-fondo-ffffff', '--tema-fondo-f7f9fb', '--tema-fondo-f4f9f6'];

/** Texto de estado ↔ fondo tintado de su propia tarjeta/chip. */
const PAREJAS_ESTADO: Array<[texto: string, fondo: string]> = [
  ['--tema-texto-d81e1e', '--tema-fondo-fef2f2'],
  ['--tema-texto-b91c1c', '--tema-fondo-fef2f2'],
  ['--tema-texto-991b1b', '--tema-fondo-fef2f2'],
  ['--tema-texto-d97706', '--tema-fondo-fffbeb'],
  ['--tema-texto-b45309', '--tema-fondo-fffbeb'],
  ['--tema-texto-92400e', '--tema-fondo-fffbeb'],
  ['--tema-texto-854d0e', '--tema-fondo-fefce8'],
  ['--tema-texto-78350f', '--tema-fondo-fefce8'],
  ['--tema-texto-006b45', '--tema-fondo-f0fdf4'],
  ['--tema-texto-007049', '--tema-fondo-f0fdf4'],
  ['--tema-texto-1d4ed8', '--tema-fondo-eff6ff'],
  ['--tema-texto-334155', '--tema-fondo-f8fafc'],
  ['--tema-texto-7c3aed', '--tema-fondo-f5f3ff'],
  ['--tema-texto-2563eb', '--tema-fondo-eff6ff'],
];

describe('tokens de tema del Tablero', () => {
  it('se leyeron tokens (guardia anti-falso-verde)', () => {
    expect(claro.size).toBeGreaterThanOrEqual(30);
    expect(usados.size).toBeGreaterThanOrEqual(30);
  });

  it('en claro cada token vale exactamente el hex de su nombre', () => {
    for (const [nombre, valor] of claro) {
      expect(valor.toLowerCase(), nombre).toBe(`#${nombre.slice(-6)}`);
    }
  });

  it('todo token usado está declarado en claro y en oscuro', () => {
    for (const nombre of usados) {
      expect(claro.has(nombre), `${nombre} sin valor claro`).toBe(true);
      expect(oscuro.has(nombre), `${nombre} sin valor oscuro`).toBe(true);
    }
  });

  it.each([...claro.keys()].filter((n) => n.startsWith('--tema-texto-')))(
    '%s cumple AA sobre las superficies oscuras',
    (nombre) => {
      for (const superficie of SUPERFICIES_OSCURAS) {
        expect(
          razonDeContraste(oscuro.get(nombre)!, oscuro.get(superficie)!),
          `${nombre} sobre ${superficie}`,
        ).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
      }
    },
  );

  it.each(PAREJAS_ESTADO)('%s cumple AA sobre su fondo de estado %s', (texto, fondo) => {
    expect(razonDeContraste(oscuro.get(texto)!, oscuro.get(fondo)!)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
  });
});

describe('alcance del tema oscuro', () => {
  const layout = readFileSync('app/interno/layout.tsx', 'utf8');

  it('el tema se aplica a TODO el panel interno desde <html>, no por pantalla', () => {
    expect(layout).toContain('raiz.dataset.tema = tema;');
    // Se retira al salir de /interno: el portal ciudadano no tiene tema oscuro.
    expect(layout).toContain('delete raiz.dataset.tema;');
    expect(layout).toContain('if (esLogin) return;');
    // Ninguna pantalla fija su propio atributo: un solo punto de verdad.
    const conAtributoPropio = ARCHIVOS_MIGRADOS.filter((f) => /data-tema=\{/.test(readFileSync(f, 'utf8')));
    expect(conAtributoPropio).toEqual([]);
  });

  it('los documentos oficiales impresos quedan fuera del tema', () => {
    for (const doc of [
      'app/components/institucional/SelloRadicado.tsx',
      'app/components/institucional/ConstanciaRadicacion.tsx',
      'app/interno/dashboard/components/SelloRecibido.tsx',
      'app/interno/dashboard/components/ComprobanteRadicado.tsx',
      'app/interno/dashboard/components/salidas/SelloDespacho.tsx',
    ]) {
      expect(readFileSync(doc, 'utf8'), doc).not.toContain('var(--tema-');
    }
  });

  it('los valores oscuros viven solo bajo [data-tema="oscuro"], nunca en un @media global', () => {
    expect(CSS).not.toMatch(/prefers-color-scheme:\s*dark\)\s*\{[^}]*--tema-/);
  });
});
