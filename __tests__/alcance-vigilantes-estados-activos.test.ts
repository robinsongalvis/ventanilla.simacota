import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESTADOS_ACTIVOS } from '@/lib/radicado-estados';

/**
 * Dos vigilantes de plazos —el cron de alertas PQRSD y el motor predictivo de
 * SIMI— mantenían cada uno su copia local de los estados activos, y ninguna
 * coincidía con la canónica: las dos omitían `EN_SUBSANACION` sin decir si era
 * decisión u olvido.
 *
 * La omisión resultó correcta (en ese estado el término está SUSPENDIDO), pero
 * eso no se sabía leyendo el código — y una lista que se recorre sin declarar
 * quién no está en ella es un vigilante que no sabe qué no está mirando
 * (ADR-0033 §4.6-bis).
 *
 * Ahora ambos DERIVAN del dominio y declaran su exclusión. Esta prueba impide
 * que vuelvan a divergir: añadir un estado activo al dominio lo incorpora a los
 * dos vigilantes solo, y quitar la declaración de la exclusión rompe aquí.
 */
const VIGILANTES = [
  ['cron de alertas de vencimiento PQRSD', 'app/api/cron/alertas-vencimiento/route.ts'],
  ['motor predictivo de SIMI', 'lib/simi-juridico/predictDeadlineAlerts.ts'],
] as const;

describe('los vigilantes de plazos derivan sus estados del dominio', () => {
  it.each(VIGILANTES)('%s importa la lista canónica en vez de reescribirla', (_nombre, ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    expect(fuente).toMatch(/ESTADOS_ACTIVOS as ESTADOS_ACTIVOS_DOMINIO.*radicado-estados/);
    // Ninguna lista literal de estados: eso es lo que se desincronizaba.
    expect(fuente).not.toMatch(/new Set\(\[\s*'PENDIENTE'/);
  });

  it.each(VIGILANTES)('%s declara por escrito lo que deja fuera, con su razón', (_nombre, ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    const m = fuente.match(/EXCLUIDOS_POR_TERMINO_SUSPENDIDO = \{([^}]*)\}/);
    expect(m, 'no declara sus exclusiones').toBeTruthy();
    expect(m![1]).toMatch(/EN_SUBSANACION/);
    // Una razón, no un marcador.
    expect(m![1]).toMatch(/SUSPENDIDO/);
    expect(m![1].length).toBeGreaterThan(60);
  });

  it.each(VIGILANTES)('%s no deja ningún estado del dominio sin cubrir ni sin declarar', (_nombre, ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    const declarados = [...(fuente.match(/EXCLUIDOS_POR_TERMINO_SUSPENDIDO = \{([^}]*)\}/)?.[1] ?? '')
      .matchAll(/^\s*([A-Z_]+):/gm)].map((x) => x[1]);
    /* No hay huérfanos POR CONSTRUCCIÓN: el conjunto se deriva del dominio
       menos los declarados. Lo que sí puede pasar —y es lo que se comprueba—
       es que se declare excluir algo que ya no existe: el paso previo a que la
       derivación deje de coincidir con la realidad. */
    expect(declarados.length, 'no declara ninguna exclusión').toBeGreaterThan(0);
    for (const d of declarados) {
      expect(ESTADOS_ACTIVOS.has(d), `declara excluir '${d}', que no es un estado activo del dominio`).toBe(true);
    }
  });
});
