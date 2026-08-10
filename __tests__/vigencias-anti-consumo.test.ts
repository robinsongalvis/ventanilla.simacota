import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * DF-8 (ADR-0029) — contrato de `lib/motor-expedientes/vigencias.ts`,
 * ACTUALIZADO el 10-ago-2026 (Bloque "Términos y vigencias protectores"):
 * el candado original ("NADIE en `app/` puede importar este módulo") se
 * LEVANTA — ver la procedencia completa (doble fuente + acta de la mesa +
 * aprobación del propietario) en el JSDoc de cabecera de `vigencias.ts`.
 *
 * El contrato que SIGUE VIGENTE, y que este test verifica ahora, es más
 * angosto pero real: "sin inventar valores fuera de la semilla". En
 * concreto, ningún archivo bajo `app/` puede importar las constantes
 * `RegimenVigencias` CRUDAS (`VIGENCIAS_D1783`,
 * `VIGENCIAS_ANTERIORES_D1469`) directamente — el consumo correcto
 * es siempre a través de las funciones puras del propio módulo
 * (`calcularVencimientoVigencia`, `validarSolicitudProrroga`,
 * `seleccionarReglaVigencia`, `regimenAplicable`,
 * `proyectarVencimientoVigencia`), que son las que garantizan que un
 * `ReglaVigencia` usado en producción siempre vino de la semilla real y no
 * de un literal inventado en la ruta. Import del MÓDULO (para las
 * funciones) sigue permitido; import de las constantes de régimen, no.
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

const NOMBRES_SEMILLA_CRUDA = ['VIGENCIAS_D1783', 'VIGENCIAS_ANTERIORES_D1469'];

/** ¿El archivo importa alguna de las constantes de régimen CRUDAS directamente (no solo el módulo)? */
function importaSemillaCruda(contenido: string): boolean {
  return NOMBRES_SEMILLA_CRUDA.some((nombre) => {
    // Import nombrado: `import { ..., NOMBRE, ... } from '.../vigencias'` (con o sin alias).
    const patronImportNombrado = new RegExp(`import\\s*\\{[^}]*\\b${nombre}\\b[^}]*\\}\\s*from\\s*['"][^'"]*motor-expedientes/vigencias['"]`);
    // Uso cualificado tipo `vigencias.NOMBRE` tras un `import * as vigencias`.
    const patronCualificado = new RegExp(`\\.${nombre}\\b`);
    return patronImportNombrado.test(contenido) || (contenido.includes('motor-expedientes/vigencias') && patronCualificado.test(contenido));
  });
}

describe('vigencias.ts — contrato ACTUALIZADO (10-ago-2026): consumo permitido, semilla cruda NO', () => {
  it('ningún archivo bajo app/ importa las constantes de régimen crudas directamente', () => {
    const archivos = archivosFuenteBajo('app');
    const infractores = archivos.filter((f) => importaSemillaCruda(readFileSync(f, 'utf8')));
    expect(infractores, `archivos que importan la semilla cruda de vigencias (PROHIBIDO — usar las funciones puras): ${infractores.join(', ')}`).toEqual([]);
  });

  it('control negativo: el patrón SÍ detecta un import nombrado de ejemplo (evita un test que "pasa" porque el regex está roto)', () => {
    const fuenteDeEjemplo = `import { VIGENCIAS_D1783 } from '@/lib/motor-expedientes/vigencias';`;
    expect(importaSemillaCruda(fuenteDeEjemplo)).toBe(true);
  });

  it('control positivo: importar SOLO las funciones puras (contrato nuevo) NO se marca como infracción', () => {
    const fuenteDeEjemplo = `import { calcularVencimientoVigencia, validarSolicitudProrroga } from '@/lib/motor-expedientes/vigencias';`;
    expect(importaSemillaCruda(fuenteDeEjemplo)).toBe(false);
  });
});
