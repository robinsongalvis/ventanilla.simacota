import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { razonDeContraste, CONTRASTE_MINIMO_AA } from './utiles/contraste-accesibilidad';

/* ══════════════════════════════════════════════════════════════
   El bloque «Análisis Asistido IA» del panel de detalle.

   POR QUÉ EXISTE ESTE TEST. El bloque se escribió el 28-may-2026, cuando
   todo el flujo interno usaba tema OSCURO. La unificación visual del
   1-jun-2026 migró el panel a tema claro y se saltó este bloque, que
   siguió pintando `bg-slate-950/40` y `text-slate-300`. El resultado no
   era un gris de diseño sino una capa oscura sobre fondo claro: el
   resumen quedaba a 1,94:1 y las etiquetas a 1,03:1, contra los 4,5:1
   que exige WCAG AA. Estuvo así casi tres meses sin que nadie lo notara,
   porque no había nada que lo comprobara.

   Lo que más pesa no es el número: es QUÉ bloque era. El Principio 9
   dice que la IA propone y el funcionario decide — y el funcionario no
   puede decidir sobre un texto que no puede leer.

   Este test es un control estático, no un render: comprueba que el
   bloque no vuelva a usar clases de la paleta oscura. Es deliberadamente
   modesto — no prueba que el panel se vea bien, prueba que no reincida
   en la causa concreta que ya ocurrió una vez.
══════════════════════════════════════════════════════════════ */

const RUTA_PANEL = join(process.cwd(), 'app/interno/dashboard/page.tsx');

/** Extrae el bloque `{radicado.analisisIa && ( … )}` por conteo de llaves. */
function bloqueAnalisisIa(fuente: string): string {
  const inicio = fuente.indexOf('{radicado.analisisIa && (');
  if (inicio === -1) throw new Error('No se encontró el bloque de análisis IA en el panel.');
  let profundidad = 0;
  for (let i = inicio; i < fuente.length; i += 1) {
    if (fuente[i] === '{') profundidad += 1;
    else if (fuente[i] === '}') {
      profundidad -= 1;
      if (profundidad === 0) return fuente.slice(inicio, i + 1);
    }
  }
  throw new Error('El bloque de análisis IA no cierra: el extractor quedó desbalanceado.');
}

/* Clases de la paleta OSCURA. Su presencia en un panel claro es el defecto
   exacto que se corrigió; no son "poco recomendables", son ilegibles allí. */
const CLASES_DE_TEMA_OSCURO = [
  'bg-slate-950',
  'bg-slate-900',
  'bg-slate-800',
  'text-slate-300',
  'text-slate-500',
  'border-white/',
  'text-indigo-400',
  'text-indigo-300',
  'text-emerald-400',
  'text-amber-400',
  'text-rose-400',
];

describe('panel de detalle · bloque «Análisis Asistido IA»', () => {
  const bloque = bloqueAnalisisIa(readFileSync(RUTA_PANEL, 'utf8'));

  it('el extractor encontró un bloque de tamaño creíble (guardia anti-falso-verde)', () => {
    // Sin esto, un cambio de estructura que dejara el bloque vacío haría
    // pasar en verde todas las comprobaciones de abajo sin mirar nada.
    expect(bloque.length).toBeGreaterThan(1500);
    expect(bloque).toContain('Análisis Asistido IA');
    expect(bloque).toContain('Resumen Ejecutivo IA');
  });

  it.each(CLASES_DE_TEMA_OSCURO)('no reincide en la clase de tema oscuro «%s»', (clase) => {
    expect(bloque).not.toContain(clase);
  });

  it('usa los tokens de texto del ADR-0030 para calificar la sugerencia', () => {
    expect(bloque).toContain('var(--color-success-text)');
    expect(bloque).toContain('var(--color-warning-text)');
    expect(bloque).toContain('var(--color-danger-text)');
  });
});

describe('los colores del bloque cumplen WCAG AA', () => {
  /* Las parejas que de verdad se pintan tras el cambio. Se declaran aquí
     para que el umbral quede demostrado con números, no afirmado. */
  const PAREJAS: ReadonlyArray<readonly [string, string, string]> = [
    ['resumen ejecutivo', '#1F2933', '#FFFFFF'], // --text-primary sobre tarjeta blanca
    ['etiquetas de sección', '#667085', '#FFFFFF'], // --text-secondary
    ['chips semánticos', '#4338CA', '#EEF2FF'], // indigo-700 sobre indigo-50
    ['insignia de confianza', '#4338CA', '#EEF2FF'],
    ['calificación POSITIVO', '#117937', '#ECFDF5'], // --color-success-text
    ['calificación CORREGIDO', '#8E5C06', '#FFFBEB'], // --color-warning-text
    ['calificación NEGATIVO', '#B91C1C', '#FFF1F2'], // --color-danger-text
  ];

  it.each(PAREJAS)('%s alcanza el mínimo AA', (_nombre, texto, fondo) => {
    expect(razonDeContraste(texto, fondo)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
  });

  it('el tema oscuro sobre el panel claro SÍ fallaba (el defecto era real)', () => {
    // #020617 al 40% sobre #F8FAF7 da #96989D — la «capa gris» reportada.
    expect(razonDeContraste('#CBD5E1', '#96989D')).toBeLessThan(CONTRASTE_MINIMO_AA);
  });
});
