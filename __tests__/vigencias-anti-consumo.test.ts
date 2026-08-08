import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * DF-8 (ADR-0029) — contrato anti-consumo: `lib/motor-expedientes/
 * vigencias.ts` es una semilla ⚖️ NO EJECUTABLE (hueco 3 — "ningún valor
 * legal se ejecuta sin ratificación"). Este test es el CANDADO ejecutable
 * de esa regla: falla si CUALQUIER archivo bajo `app/` llega a importar el
 * módulo, sea directamente o vía cualquier forma de import relativo/alias.
 *
 * Mismo estilo que `__tests__/subsanacion-rutas.test.ts` (grep de fuente,
 * no ejecución) — aquí se recorre TODO `app/` en vez de un archivo
 * puntual, porque el contrato es "NADIE en app/", no "esta ruta específica
 * no lo hace".
 */

function archivosFuenteBajo(dir: string): string[] {
  const resultado: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = path.join(dir, entrada);
    const info = statSync(ruta);
    if (info.isDirectory()) {
      resultado.push(...archivosFuenteBajo(ruta));
    } else if (/\.(ts|tsx|mjs|js)$/.test(entrada)) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

describe('vigencias.ts — contrato anti-consumo (⚖️ hueco 3, ADR-0029)', () => {
  it('ningún archivo bajo app/ importa lib/motor-expedientes/vigencias', () => {
    const archivos = archivosFuenteBajo('app');
    const patronImport = /from\s+['"][^'"]*motor-expedientes\/vigencias['"]|require\(\s*['"][^'"]*motor-expedientes\/vigencias['"]\s*\)/;
    const infractores = archivos.filter((f) => patronImport.test(readFileSync(f, 'utf8')));
    expect(infractores, `archivos que importan vigencias.ts (PROHIBIDO): ${infractores.join(', ')}`).toEqual([]);
  });

  it('control negativo: el patrón SÍ detecta un import de ejemplo (evita un test que "pasa" porque el regex está roto)', () => {
    const fuenteDeEjemplo = `import { VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE } from '@/lib/motor-expedientes/vigencias';`;
    const patronImport = /from\s+['"][^'"]*motor-expedientes\/vigencias['"]|require\(\s*['"][^'"]*motor-expedientes\/vigencias['"]\s*\)/;
    expect(patronImport.test(fuenteDeEjemplo)).toBe(true);
  });
});
