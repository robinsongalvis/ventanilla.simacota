/**
 * PT-7 (24-ago-2026) — el panel de Supervisión IA no finge control.
 *
 * Los cuatro «interruptores» de módulos de IA solo movían un useState local:
 * un ADMIN que «apagara» el chat SIMI creía haberlo apagado y el widget
 * seguía vivo para los ciudadanos. Peor que no tener un control es
 * fingirlo. Ahora son indicadores de solo lectura sobre la constante real,
 * con la verdad al pie: cambiarlos requiere despliegue.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync(
  join(process.cwd(), 'app/interno/dashboard/components/analytics/VistaSupervisionIA.tsx'),
  'utf8',
);
const codigo = fuente.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

describe('Supervisión IA — indicadores honestos (PT-7)', () => {
  it('no queda ningún interruptor falso (toggleFlag/onToggle/setFlags)', () => {
    expect(codigo).not.toContain('toggleFlag');
    expect(codigo).not.toContain('onToggle');
    expect(codigo).not.toContain('setFlags');
  });

  it('los indicadores leen la constante real, no un estado local', () => {
    expect(codigo).toContain('activo={AI_FEATURE_FLAGS.ENABLE_SIMI_CHAT}');
  });

  it('la cabecera dice la verdad: solo lectura, cambiar exige despliegue', () => {
    expect(fuente).toContain('solo lectura');
    expect(fuente).not.toContain('sin re-desplegar');
  });
});
