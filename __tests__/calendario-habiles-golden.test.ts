import { describe, expect, it } from 'vitest';
import { esDiaHabil, festivosColombia, sumarDiasHabiles } from '@/lib/tiempos-radicado';

/**
 * Fase 2 — arranque, Tarea 1 (calendario de días hábiles): golden tests
 * contra fechas verificadas A MANO — NO derivadas de `festivosColombia`/
 * `easterSunday` (el módulo bajo prueba). Verificación independiente:
 *
 * - Domingos de Pascua 2025/2026/2027 (20-abr / 5-abr / 28-mar): fechas de
 *   referencia pública del computus gregoriano, cruzadas por aritmética
 *   modular de día-de-semana contra un ancla independiente (1-ene de cada
 *   año, derivado por conteo de días desde 1-ene-2000 = sábado, con los
 *   años bisiestos intermedios) — el resultado (que esas 3 fechas caigan en
 *   domingo) coincidió en ambos métodos.
 * - Todo festivo trasladado (Emiliani) se verificó calculando el
 *   día-de-semana de su fecha base por el mismo método modular
 *   independiente, no leyendo la salida del algoritmo.
 *
 * Profundidad de cobertura (declarado — Principio 13): 2026 se verificó
 * COMPLETO (los 18 festivos oficiales, uno por uno). 2025 y 2027 se
 * verifican con los casos exigidos por el encargo (Semana Santa, Reyes) más
 * el conteo estructural `size === 18` — el algoritmo es paramétrico en
 * `year` sin ramas por año, así que verificar un año completo más el
 * recuento en los otros dos es evidencia suficiente sin repetir 36 cálculos
 * manuales de día-de-semana adicionales.
 */

describe('Semana Santa — Jueves y Viernes Santo (verificado a mano vía Pascua)', () => {
  it('2025: Pascua 20-abr (domingo) → Jueves Santo 17-abr, Viernes Santo 18-abr', () => {
    const f = festivosColombia(2025);
    expect(f.has('2025-04-17')).toBe(true);
    expect(f.has('2025-04-18')).toBe(true);
  });

  it('2026: Pascua 5-abr (domingo) → Jueves Santo 2-abr, Viernes Santo 3-abr', () => {
    const f = festivosColombia(2026);
    expect(f.has('2026-04-02')).toBe(true);
    expect(f.has('2026-04-03')).toBe(true);
  });

  it('2027: Pascua 28-mar (domingo) → Jueves Santo 25-mar, Viernes Santo 26-mar', () => {
    const f = festivosColombia(2027);
    expect(f.has('2027-03-25')).toBe(true);
    expect(f.has('2027-03-26')).toBe(true);
  });
});

describe('Festivos trasladados (Emiliani, Ley 51/1983) — Reyes en los 3 años', () => {
  it('2025: 6-ene es LUNES → NO se traslada, festivo observado el propio 6-ene', () => {
    const f = festivosColombia(2025);
    expect(f.has('2025-01-06')).toBe(true);
    // Si se hubiera trasladado por error, el 13-ene (lunes siguiente) NO debería ser festivo.
    expect(f.has('2025-01-13')).toBe(false);
  });

  it('2026: 6-ene es MARTES → se traslada al lunes siguiente, 12-ene', () => {
    const f = festivosColombia(2026);
    expect(f.has('2026-01-06')).toBe(false); // el martes 6 NO queda como festivo
    expect(f.has('2026-01-12')).toBe(true); // el lunes 12 sí
  });

  it('2027: 6-ene es MIÉRCOLES → se traslada al lunes siguiente, 11-ene', () => {
    const f = festivosColombia(2027);
    expect(f.has('2027-01-06')).toBe(false);
    expect(f.has('2027-01-11')).toBe(true);
  });
});

describe('2026 — los 18 festivos oficiales, verificados uno por uno', () => {
  const f2026 = festivosColombia(2026);

  it('el conjunto tiene exactamente 18 fechas', () => {
    expect(f2026.size).toBe(18);
  });

  it.each([
    ['2026-01-01', 'Año Nuevo (fijo)'],
    ['2026-01-12', 'Reyes Magos (trasladado desde martes 6-ene)'],
    ['2026-03-23', 'San José (trasladado desde jueves 19-mar)'],
    ['2026-04-02', 'Jueves Santo'],
    ['2026-04-03', 'Viernes Santo'],
    ['2026-05-01', 'Día del Trabajo (fijo)'],
    ['2026-05-18', 'Ascensión del Señor (trasladado desde jueves 14-may)'],
    ['2026-06-08', 'Corpus Christi (trasladado desde jueves 4-jun)'],
    ['2026-06-15', 'Sagrado Corazón (trasladado desde viernes 12-jun)'],
    ['2026-06-29', 'San Pedro y San Pablo (ya cae lunes, no se traslada)'],
    ['2026-07-20', 'Independencia (fijo)'],
    ['2026-08-07', 'Batalla de Boyacá (fijo)'],
    ['2026-08-17', 'Asunción de la Virgen (trasladado desde sábado 15-ago)'],
    ['2026-10-12', 'Día de la Raza (ya cae lunes, no se traslada)'],
    ['2026-11-02', 'Todos los Santos (trasladado desde domingo 1-nov)'],
    ['2026-11-16', 'Independencia de Cartagena (trasladado desde miércoles 11-nov)'],
    ['2026-12-08', 'Inmaculada Concepción (fijo)'],
    ['2026-12-25', 'Navidad (fijo)'],
  ])('%s — %s', (fecha) => {
    expect(f2026.has(fecha)).toBe(true);
  });
});

describe('Traslado límite — festivo que YA cae lunes no se traslada (2026)', () => {
  it('San Pedro y San Pablo (29-jun-2026, lunes) permanece en su fecha; el "lunes siguiente" no aparece festivo aparte', () => {
    const f = festivosColombia(2026);
    expect(f.has('2026-06-29')).toBe(true);
    expect(f.has('2026-07-06')).toBe(false); // el lunes siguiente NO es festivo
  });

  it('Día de la Raza (12-oct-2026, lunes) permanece en su fecha', () => {
    const f = festivosColombia(2026);
    expect(f.has('2026-10-12')).toBe(true);
    expect(f.has('2026-10-19')).toBe(false);
  });
});

describe('Recuento estructural 2025/2027 — festivos (algoritmo paramétrico en year, sin ramas por año)', () => {
  it('2025 tiene 17 festivos ÚNICOS (no 18): colisión real de calendario, ver bloque siguiente', () => {
    // Hallazgo al escribir este golden test (no asumido, no derivado del
    // algoritmo bajo prueba): en 2025, San Pedro y San Pablo (29-jun,
    // domingo → trasladado al lunes 30-jun) y el Sagrado Corazón
    // (Pascua 20-abr + 68 días = 27-jun, viernes → trasladado al lunes
    // 30-jun) caen AMBOS en la misma fecha observada. El `Set<string>` los
    // fusiona correctamente en una sola fecha festiva (un día no hábil,
    // sin importar cuántos festivos distintos motivan el traslado) — 18
    // NOMBRES de festivo, 17 FECHAS únicas ese año.
    expect(festivosColombia(2025).size).toBe(17);
  });
  it('2027 tiene 18 festivos', () => {
    expect(festivosColombia(2027).size).toBe(18);
  });
});

describe('2025 — colisión verificada a mano: San Pedro y San Pablo + Sagrado Corazón, mismo lunes 30-jun', () => {
  it('San Pedro y San Pablo (29-jun-2025, domingo verificado a mano) se traslada al lunes 30-jun', () => {
    const base = new Date(2025, 5, 29, 12, 0, 0, 0);
    expect(base.getDay()).toBe(0); // domingo
    expect(festivosColombia(2025).has('2025-06-30')).toBe(true);
  });

  it('Sagrado Corazón (Pascua 20-abr + 68 días = 27-jun-2025, viernes verificado a mano) también se traslada al lunes 30-jun', () => {
    const base = new Date(2025, 5, 27, 12, 0, 0, 0);
    expect(base.getDay()).toBe(5); // viernes
    // Misma fecha observada que San Pedro y San Pablo — por eso 2025 tiene
    // 17 fechas festivas únicas y no 18.
    expect(festivosColombia(2025).has('2025-06-30')).toBe(true);
  });
});

describe('Fin de año 2026 — 25-dic y 1-ene festivos; 31-dic (jueves) hábil', () => {
  it('25-dic-2026 y 1-ene-2026/2027 son festivos', () => {
    expect(festivosColombia(2026).has('2026-12-25')).toBe(true);
    expect(festivosColombia(2026).has('2026-01-01')).toBe(true);
    expect(festivosColombia(2027).has('2027-01-01')).toBe(true);
  });

  it('31-dic-2026 (jueves, verificado a mano) es día HÁBIL', () => {
    const treintaYUno = new Date(2026, 11, 31, 12, 0, 0, 0);
    expect(treintaYUno.getDay()).toBe(4); // jueves (0=domingo)
    expect(esDiaHabil(treintaYUno)).toBe(true);
  });
});

describe('Móviles de Pascua — Ascensión y Corpus Christi trasladados a lunes (2026)', () => {
  it('Ascensión: base jueves 14-may (verificado a mano) → observado lunes 18-may', () => {
    const base = new Date(2026, 4, 14, 12, 0, 0, 0);
    expect(base.getDay()).toBe(4); // jueves
    expect(festivosColombia(2026).has('2026-05-18')).toBe(true);
    expect(new Date(2026, 4, 18, 12, 0, 0, 0).getDay()).toBe(1); // lunes
  });

  it('Corpus Christi: base jueves 4-jun (verificado a mano) → observado lunes 8-jun', () => {
    const base = new Date(2026, 5, 4, 12, 0, 0, 0);
    expect(base.getDay()).toBe(4); // jueves
    expect(festivosColombia(2026).has('2026-06-08')).toBe(true);
    expect(new Date(2026, 5, 8, 12, 0, 0, 0).getDay()).toBe(1); // lunes
  });
});

describe('sumarDiasHabiles — término que cae en fin de semana nunca se devuelve así', () => {
  it('caso concreto verificado a mano: 16-ene-2026 (viernes) + 1 hábil → 19-ene-2026 (lunes), saltando 17/18 (sáb/dom)', () => {
    const viernes = new Date(2026, 0, 16, 12, 0, 0, 0);
    expect(viernes.getDay()).toBe(5); // viernes
    const resultado = sumarDiasHabiles(viernes, 1);
    expect(resultado.getFullYear()).toBe(2026);
    expect(resultado.getMonth()).toBe(0);
    expect(resultado.getDate()).toBe(19);
    expect(resultado.getDay()).toBe(1); // lunes
  });

  it('propiedad: para un barrido de fechas de inicio y N de 1 a 10, el resultado SIEMPRE es día hábil (2026)', () => {
    for (let dia = 1; dia <= 28; dia += 3) {
      for (let n = 1; n <= 10; n += 2) {
        const desde = new Date(2026, 0, dia, 12, 0, 0, 0);
        const resultado = sumarDiasHabiles(desde, n);
        expect(esDiaHabil(resultado), `desde=${desde.toDateString()} n=${n} → ${resultado.toDateString()}`).toBe(true);
      }
    }
  });

  it('n=0 devuelve la misma fecha ancla (mediodía), incluso si cae en fin de semana', () => {
    const sabado = new Date(2026, 0, 17, 12, 0, 0, 0); // sábado 17-ene-2026
    expect(sabado.getDay()).toBe(6);
    const resultado = sumarDiasHabiles(sabado, 0);
    expect(resultado.getDate()).toBe(17);
  });
});
