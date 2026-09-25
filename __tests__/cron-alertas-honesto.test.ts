/**
 * PT-2 (24-ago-2026) — el cron de alertas legales no puede reportar verde
 * cuando el 100% de los envíos falla.
 *
 * Escenario real de la auditoría: con SMTP sin configurar, cada
 * enviarEmail lanzaba, el catch contaba errores y la ruta devolvía
 * ok:true — el panel de crons mostraba «sano» mientras cero avisos de
 * vencimiento (Ley 1755) llegaban a nadie. Guardas de FORMA sobre la ruta:
 * el contrato del 500 por fracaso total queda fijado en el código.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync(join(process.cwd(), 'app/api/cron/alertas-vencimiento/route.ts'), 'utf8');

describe('cron alertas-vencimiento — honestidad del veredicto (PT-2)', () => {
  it('define el fracaso total: hubo errores y cero envíos', () => {
    expect(fuente).toContain('errores > 0 && enviados === 0');
  });

  it('el fracaso total responde 500, no 200', () => {
    expect(fuente).toContain('status: fracasoTotal ? 500 : 200');
  });

  it('y deja rastro en stderr con las cifras', () => {
    expect(fuente).toContain('FRACASO TOTAL');
  });
});
