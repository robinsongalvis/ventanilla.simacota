import { describe, expect, it } from 'vitest';
import { atLocalNoon } from '@/lib/tiempos-radicado';

/**
 * RS-1 (ADR-0026 §A2, deuda #15) — `atLocalNoon` debe anclar al día CIVIL de
 * Bogotá (America/Bogota, UTC−5), no al día que leerían los getters locales
 * nativos si el PROCESO corriera en otra zona (Vercel, por defecto, corre en
 * UTC salvo que se fije `TZ`). Dictamen jurídico: `docs/planes/DICTAMEN_TZ_DIA_CIVIL.md`.
 *
 * Cómo se verificó SIN cambiar `process.env.TZ` (vitest no lo soporta de
 * forma limpia por test, y el entorno de este repo/CI corre en
 * America/Bogota — ver nota más abajo): `atLocalNoon` usa
 * `Intl.DateTimeFormat` con `timeZone: 'America/Bogota'` EXPLÍCITO, así que
 * su resultado NO depende de la zona del proceso bajo ninguna circunstancia
 * — probarlo con el proceso en Bogotá ya ejercita la misma rama de código
 * que correría en un proceso UTC. Lo que estos tests demuestran
 * adicionalmente es que el resultado CORRECTO (día civil de Bogotá)
 * diverge del resultado que habría dado el código VIEJO en un proceso UTC —
 * comparando contra `getUTCFullYear/Month/Date()`, que son independientes
 * de la zona del proceso y equivalen exactamente a lo que `getFullYear()`
 * etc. habrían devuelto en un proceso configurado en UTC (el escenario real
 * de Vercel que causaba el bug).
 *
 * Nota de entorno: `Intl.DateTimeFormat().resolvedOptions().timeZone` en
 * esta máquina de desarrollo/CI YA es `America/Bogota` (verificado con
 * `node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)"`
 * → `America/Bogota`). Por eso el código VIEJO (getters locales nativos) no
 * falla EN ESTE ENTORNO — el bug solo se manifiesta cuando la zona del
 * proceso difiere de Bogotá. La comparación contra los getters UTC de abajo
 * es la forma determinista de demostrar la divergencia sin depender de la
 * zona real de la máquina que ejecute el test.
 */

describe('atLocalNoon — ancla al día civil de Bogotá, no al día UTC (RS-1)', () => {
  it('instante 23:30 hora Bogotá del 6-ago-2026 (04:30 UTC del 7-ago) → día civil 6-ago (NO 7-ago)', () => {
    const instanteIso = '2026-08-06T23:30:00-05:00'; // 23:30 hora Colombia
    const instanteUtcEquivalente = '2026-08-07T04:30:00.000Z'; // el MISMO instante

    // Confirma que ambas representaciones son literalmente el mismo instante.
    expect(new Date(instanteIso).getTime()).toBe(new Date(instanteUtcEquivalente).getTime());

    const resultado = atLocalNoon(instanteIso);
    expect(resultado.getFullYear()).toBe(2026);
    expect(resultado.getMonth()).toBe(7); // agosto (0-index)
    expect(resultado.getDate()).toBe(6); // día civil CORRECTO de Bogotá

    // Lo que un proceso configurado en UTC habría leído con los getters
    // LOCALES nativos (bug original) — equivalente exacto vía getUTCDate(),
    // independiente de la zona de la máquina que corre este test.
    const diaSiElProcesoFueraUTC = new Date(instanteUtcEquivalente).getUTCDate();
    expect(diaSiElProcesoFueraUTC).toBe(7); // el bug habría producido el 7
    expect(resultado.getDate()).not.toBe(diaSiElProcesoFueraUTC); // el fix NO coincide con el bug
  });

  it('idéntico resultado si la entrada llega como Date ya construido a partir del ISO con offset', () => {
    const desdeString = atLocalNoon('2026-08-06T23:30:00-05:00');
    const desdeDate = atLocalNoon(new Date('2026-08-06T23:30:00-05:00'));
    expect(desdeString.getTime()).toBe(desdeDate.getTime());
    expect(desdeDate.getDate()).toBe(6);
  });

  it('instante ANTES de las 19:00 Bogotá no cruza medianoche UTC: día civil coincide con el día UTC (caso no problemático, control)', () => {
    // 10:00 Bogotá del 6-ago = 15:00 UTC del mismo 6-ago — aquí el bug
    // original NUNCA se manifestaba (ambas lecturas ya coincidían).
    const instanteIso = '2026-08-06T10:00:00-05:00';
    const resultado = atLocalNoon(instanteIso);
    expect(resultado.getDate()).toBe(6);
    expect(new Date('2026-08-06T15:00:00.000Z').getUTCDate()).toBe(6);
  });

  it('medianoche exacta Bogotá (00:00, límite del día civil): pertenece al día que empieza, no al anterior', () => {
    const medianoche = '2026-08-06T00:00:00-05:00';
    const resultado = atLocalNoon(medianoche);
    expect(resultado.getDate()).toBe(6);
  });

  it('fecha inválida se propaga como Invalid Date sin lanzar (no rompe a sumarMesCalendario y otros consumidores)', () => {
    expect(() => atLocalNoon('no-es-una-fecha')).not.toThrow();
    expect(Number.isNaN(atLocalNoon('no-es-una-fecha').getTime())).toBe(true);
  });
});
