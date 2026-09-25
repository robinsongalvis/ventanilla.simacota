/**
 * PT-2/D5 (24-ago-2026) — las rutas de Control Interno no callan ni filtran.
 *
 * La auditoría del go-live encontró 6 rutas que devolvían 500 sin dejar UN
 * rastro (ni consola ni Sentry: el error atrapado no llega a onRequestError)
 * y 5 de ellas filtraban err.message crudo al cliente. Guardas de forma:
 * cada catch terminal debe registrar con logError y responder genérico.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RUTAS = ['responsables', 'reportes', 'resumen-diario', 'alertas', 'panorama', 'hallazgos'] as const;

describe.each(RUTAS)('control-interno/%s — errores con rastro y sin fuga', (ruta) => {
  const fuente = readFileSync(join(process.cwd(), `app/api/interno/control/${ruta}/route.ts`), 'utf8');
  const codigo = fuente.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it('registra el error con logError (estructurado + Sentry cuando viva)', () => {
    expect(codigo).toContain(`logError({ radicadoId: '', modulo: 'control-interno/${ruta}'`);
  });

  it('no filtra err.message al cliente', () => {
    expect(codigo).not.toContain('err.message');
  });
});
