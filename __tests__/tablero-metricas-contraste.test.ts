import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { razonDeContraste, CONTRASTE_MINIMO_AA } from './utiles/contraste-accesibilidad';

/* ══════════════════════════════════════════════════════════════
   Contraste de la barra de métricas del tablero (MetricsSummary).

   POR QUÉ EXISTE ESTE TEST. Cada KPI del tablero declara DOS colores a
   propósito: `rielColor`, el tono que lo identifica, y `textoColor`, la
   variante legible sobre fondo claro. El 18-ago-2026 el componente nuevo
   `MetricsSummary` pintó el texto con `rielColor` y descartó `textoColor`:
   «Devueltas / Prórroga» cayó a 2,75:1 y «Por Vencer» a 2,95:1, contra los
   4,5:1 de WCAG AA. En la versión anterior del tablero esos mismos rótulos
   cumplían (4,78–7,51:1), así que fue una regresión, no una carencia.

   Lo que pesa no es el número: son los avisos de VENCIMIENTO DE TÉRMINOS
   (Ley 1755/2015). Si la funcionaria no puede leer cuántos radicados están
   por vencer, el sistema deja de cumplir su función más básica.

   Es la tercera vez que este proyecto tropieza con lo mismo — ADR-0030 se
   escribió por las dos anteriores. Por eso además de este test, el tipo
   `MetricaItem` declara `colorTexto` como OBLIGATORIO: que lo impida el
   compilador y no solo la revisión humana.
══════════════════════════════════════════════════════════════ */

const RUTA_PAGE = join(process.cwd(), 'app/interno/dashboard/page.tsx');
const RUTA_COMPONENTE = join(process.cwd(), 'app/components/design-system/MetricsSummary.tsx');

interface Kpi { label: string; riel: string; texto: string }

/** Lee los KPIs del propio código: si alguien añade uno, queda cubierto solo. */
function kpisDelTablero(): Kpi[] {
  const src = readFileSync(RUTA_PAGE, 'utf8');
  return [...src.matchAll(
    /label:\s*'([^']+)',[\s\S]{0,400}?rielColor:\s*'(#[0-9A-Fa-f]{6})',[\s\S]{0,120}?textoColor:\s*'(#[0-9A-Fa-f]{6})'/g,
  )].map((m) => ({ label: m[1], riel: m[2], texto: m[3] }));
}

/** Replica el fondo real del chip: `${color}12` compuesto sobre blanco. */
function fondoDelChip(hex: string, alfaHex = 0x12): string {
  const a = alfaHex / 255;
  const canal = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const mezcla = (v: number) => Math.round(v * a + 255 * (1 - a));
  return '#' + [mezcla(canal(1)), mezcla(canal(3)), mezcla(canal(5))]
    .map((v) => v.toString(16).padStart(2, '0')).join('');
}

describe('MetricsSummary · el texto no se pinta con el color del riel', () => {
  const componente = readFileSync(RUTA_COMPONENTE, 'utf8');

  it('usa colorTexto para el texto, nunca color', () => {
    expect(componente).toContain('color: m.colorTexto');
    expect(componente).not.toContain('color: m.color,');
  });

  it('mantiene colorTexto como campo OBLIGATORIO del tipo', () => {
    // Un `colorTexto?:` opcional devolvería el defecto a ser posible en
    // silencio: el compilador dejaría de exigirlo a los llamadores.
    expect(componente).toMatch(/\bcolorTexto:\s*string;/);
    expect(componente).not.toMatch(/\bcolorTexto\?:/);
  });

  it('sigue usando el tono del KPI para el FONDO (no se perdió la identidad visual)', () => {
    expect(componente).toContain('background: `${m.color}12`');
    expect(componente).toContain('background: `${m.color}08`');
  });
});

describe('contraste de cada KPI del tablero', () => {
  const kpis = kpisDelTablero();

  it('se leyeron KPIs del código (guardia anti-falso-verde)', () => {
    // Si el formato cambia y la extracción devuelve 0, todas las
    // comprobaciones de abajo pasarían sin medir absolutamente nada.
    expect(kpis.length).toBeGreaterThanOrEqual(8);
  });

  it.each(kpisDelTablero())('«$label» cumple AA con textoColor sobre su chip', ({ riel, texto }) => {
    expect(razonDeContraste(texto, fondoDelChip(riel))).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
  });

  it('el defecto era real: con rielColor como texto, al menos un KPI incumplía', () => {
    const incumplen = kpisDelTablero()
      .filter((k) => razonDeContraste(k.riel, fondoDelChip(k.riel)) < CONTRASTE_MINIMO_AA);
    expect(incumplen.length).toBeGreaterThan(0);
  });
});
