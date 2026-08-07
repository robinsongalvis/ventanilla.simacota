/**
 * Fase 0 del motor de expedientes — reloj de subsanación parametrizado por
 * régimen (D5, ADR-0026).
 *
 * Objetivo central de esta suite: probar que el MISMO motor
 * (`calcularLimiteSubsanacion` / `calcularLimiteConProrroga` /
 * `calcularFinVentanaRequerimiento` / `dentroVentanaRequerimientoRegimen`)
 * produce, solo cambiando el dato `RegimenSubsanacion`, tanto:
 *  - el régimen de Licencia de Construcción (Decreto 1077: 30 días hábiles
 *    + prórroga de 15 días hábiles), como
 *  - el régimen de Ley 1755 (1 mes calendario + prórroga de 1 mes, ventana
 *    de 10 días hábiles) — verificado por EQUIVALENCIA con el reloj BM-B33
 *    ya existente y probado (`plazoSubsanacion`/`plazoConProrroga` de
 *    `lib/tiempos-radicado.ts`).
 * Ningún número de ninguno de los dos regímenes está hardcodeado en el
 * módulo bajo prueba — viven solo en los fixtures de este archivo.
 *
 * Estilo de verificación de días hábiles: contrato RELACIONAL con
 * `diasRestantesHabiles` (mismo estilo que `__tests__/reloj-subsanacion.test.ts`),
 * no conteo manual de calendario — evita fragilidad ante festivos móviles.
 */
import { describe, expect, it } from 'vitest';
import {
  diasRestantesHabiles,
  esDiaHabil,
  plazoConProrroga,
  plazoSubsanacion,
} from '@/lib/tiempos-radicado';
import {
  calcularFinVentanaRequerimiento,
  calcularLimiteConProrroga,
  calcularLimiteSubsanacion,
  dentroVentanaRequerimientoRegimen,
} from '@/lib/motor-expedientes/subsanacion-regimen';
import type { RegimenSubsanacion } from '@/lib/motor-expedientes/tipos';

function local(y: number, m1: number, d: number): Date {
  return new Date(y, m1 - 1, d, 12, 0, 0, 0);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Régimen de Licencia de Construcción — Decreto 1077 de 2015 (30 días
 * hábiles + prórroga de 15 días hábiles). `ventanaRequerimiento` es un
 * PLACEHOLDER técnico para ejercitar el motor — el Decreto 1077 NO define
 * esta ventana (el acta de observaciones opera dentro de la revisión, no
 * como una ventana posterior de 10 días); valor real pendiente de
 * ratificación de Jurídica. NO copiar como semilla de configuración real.
 */
const REGIMEN_LICENCIA_D1077_PLACEHOLDER: RegimenSubsanacion = {
  dias: 30,
  unidad: 'HABILES',
  prorrogaDias: 15,
  ventanaRequerimiento: { dias: 10, unidad: 'HABILES' }, // placeholder, ver comentario arriba
};

/** Régimen de derecho de petición — Ley 1755 de 2015, Art. 17. */
const REGIMEN_LEY_1755: RegimenSubsanacion = {
  dias: 1,
  unidad: 'MESES',
  prorrogaDias: 1,
  ventanaRequerimiento: { dias: 10, unidad: 'HABILES' },
};

describe('calcularLimiteSubsanacion — régimen Licencia (30 días hábiles, Decreto 1077)', () => {
  it('vence exactamente 30 días hábiles después de la notificación, en día hábil', () => {
    const notificacion = local(2026, 6, 2);
    const limite = calcularLimiteSubsanacion(REGIMEN_LICENCIA_D1077_PLACEHOLDER, notificacion);
    expect(esDiaHabil(limite)).toBe(true);
    expect(diasRestantesHabiles(limite, notificacion)).toBe(30);
  });

  it('atraviesa un festivo (20 de julio) sin contarlo', () => {
    const notificacion = local(2026, 7, 10);
    const limite = calcularLimiteSubsanacion(REGIMEN_LICENCIA_D1077_PLACEHOLDER, notificacion);
    expect(diasRestantesHabiles(limite, notificacion)).toBe(30);
  });

  it('acepta fechas como string ISO: produce EXACTAMENTE el mismo resultado que la fecha local(...) equivalente (RS-3, ultrareview — antes solo se aseveraba esDiaHabil, tautológico bajo HABILES: cualquier salida de un régimen HABILES es, por construcción, día hábil)', () => {
    const notificacionIso = '2026-06-02T00:00:00.000Z';
    // Equivalente LITERAL bajo el anclaje a America/Bogota (deuda #15,
    // ADR-0026): este instante es el 1-jun a las 19:00 hora Bogotá, así que
    // su día civil colombiano es el 1-jun EN CUALQUIER entorno de ejecución.
    // (Antes se derivaba con los getters de TZ del entorno — pasaba en
    // máquinas UTC-5 y fallaba en CI/UTC: la clase exacta de ±1 día que el
    // anclaje eliminó.)
    const equivalenteLocal = local(2026, 6, 1);

    const limiteDesdeString = calcularLimiteSubsanacion(REGIMEN_LICENCIA_D1077_PLACEHOLDER, notificacionIso);
    const limiteDesdeLocal = calcularLimiteSubsanacion(REGIMEN_LICENCIA_D1077_PLACEHOLDER, equivalenteLocal);

    // Contrato EXACTO (getTime), no solo "cae en día hábil": si la rama de
    // parseo de string de `atLocalNoon` divergiera de la rama de `Date`
    // (p. ej. no extrajera año/mes/día en hora LOCAL antes de fijar el
    // mediodía), este assert lo detecta; `esDiaHabil` por sí solo no podía.
    expect(limiteDesdeString.getTime()).toBe(limiteDesdeLocal.getTime());
    expect(esDiaHabil(limiteDesdeString)).toBe(true);
  });

  describe('festivosExtra (RS-3, ultrareview) — hoy nunca se ejercita con un valor no vacío', () => {
    it('un festivo adicional NO oficial desplaza el límite un día hábil más, bajo HABILES', () => {
      // Setiembre de 2026 no tiene ningún festivo del calendario colombiano
      // (fijo ni trasladado a lunes), así que el único festivo en juego es
      // el declarado en `festivosExtra`.
      const notificacion = local(2026, 9, 1); // martes
      const regimenUnDiaHabil: RegimenSubsanacion = {
        dias: 1,
        unidad: 'HABILES',
        prorrogaDias: 0,
        ventanaRequerimiento: { dias: 1, unidad: 'HABILES' },
      };

      const sinFestivoExtra = calcularLimiteSubsanacion(regimenUnDiaHabil, notificacion);
      const conFestivoExtra = calcularLimiteSubsanacion(regimenUnDiaHabil, notificacion, ['2026-09-02']);

      expect(ymd(sinFestivoExtra)).toBe('2026-09-02');
      // Con el 2 de septiembre marcado como festivo adicional, el único día
      // hábil se corre al 3 — si `festivosExtra` no se usara realmente en
      // `sumarPlazo`, este resultado sería idéntico al de arriba.
      expect(ymd(conFestivoExtra)).toBe('2026-09-03');
      expect(conFestivoExtra.getTime()).toBeGreaterThan(sinFestivoExtra.getTime());
    });
  });
});

describe('calcularLimiteConProrroga — régimen Licencia (15 días hábiles)', () => {
  it('la prórroga son exactamente 15 días hábiles después del límite vigente', () => {
    const notificacion = local(2026, 6, 2);
    const limiteInicial = calcularLimiteSubsanacion(REGIMEN_LICENCIA_D1077_PLACEHOLDER, notificacion);
    const conProrroga = calcularLimiteConProrroga(REGIMEN_LICENCIA_D1077_PLACEHOLDER, limiteInicial);
    expect(diasRestantesHabiles(conProrroga, limiteInicial)).toBe(15);
    expect(conProrroga.getTime()).toBeGreaterThan(limiteInicial.getTime());
  });
});

describe('calcularLimiteSubsanacion — régimen Ley 1755 (1 mes calendario, Art. 17)', () => {
  it('coincide exactamente con el reloj BM-B33 ya probado (plazoSubsanacion)', () => {
    const notificacion = local(2026, 1, 31);
    const delMotor = calcularLimiteSubsanacion(REGIMEN_LEY_1755, notificacion);
    const delRelojExistente = plazoSubsanacion(notificacion);
    expect(ymd(delMotor)).toBe('2026-02-28');
    expect(delMotor.getTime()).toBe(delRelojExistente.getTime());
  });

  it('respeta el clamping de fin de mes (30 dic 2026 + 1 mes → 30 ene 2027)', () => {
    const notificacion = local(2026, 12, 30);
    expect(ymd(calcularLimiteSubsanacion(REGIMEN_LEY_1755, notificacion))).toBe('2027-01-30');
  });
});

describe('calcularLimiteConProrroga — régimen Ley 1755 (mismo término, 1 mes)', () => {
  it('coincide exactamente con el reloj BM-B33 ya probado (plazoConProrroga)', () => {
    const limiteActual = local(2026, 1, 31);
    const delMotor = calcularLimiteConProrroga(REGIMEN_LEY_1755, limiteActual);
    const delRelojExistente = plazoConProrroga(limiteActual);
    expect(ymd(delMotor)).toBe('2026-02-28');
    expect(delMotor.getTime()).toBe(delRelojExistente.getTime());
  });
});

describe('calcularFinVentanaRequerimiento + dentroVentanaRequerimientoRegimen — ventana de 10 días hábiles (compartida por ambos regímenes)', () => {
  const radicacion = local(2026, 6, 1);

  it('el fin de ventana está exactamente 10 días hábiles después de la radicación', () => {
    const fin = calcularFinVentanaRequerimiento(REGIMEN_LICENCIA_D1077_PLACEHOLDER, radicacion);
    expect(diasRestantesHabiles(fin, radicacion)).toBe(10);
  });

  it('al 10.º día hábil sigue dentro de la ventana (inclusive)', () => {
    const fin = calcularFinVentanaRequerimiento(REGIMEN_LICENCIA_D1077_PLACEHOLDER, radicacion);
    expect(dentroVentanaRequerimientoRegimen(REGIMEN_LICENCIA_D1077_PLACEHOLDER, radicacion, fin)).toBe(true);
  });

  it('un día hábil después del fin de ventana queda fuera', () => {
    const fin = calcularFinVentanaRequerimiento(REGIMEN_LICENCIA_D1077_PLACEHOLDER, radicacion);
    const finMasUnHabil = calcularLimiteSubsanacion({ ...REGIMEN_LICENCIA_D1077_PLACEHOLDER, dias: 1 }, fin);
    expect(dentroVentanaRequerimientoRegimen(REGIMEN_LICENCIA_D1077_PLACEHOLDER, radicacion, finMasUnHabil)).toBe(false);
  });

  it('el mismo cálculo de ventana aplica igual para el régimen Ley 1755 (comparten forma, no valores)', () => {
    const fin = calcularFinVentanaRequerimiento(REGIMEN_LEY_1755, radicacion);
    expect(diasRestantesHabiles(fin, radicacion)).toBe(10);
    expect(dentroVentanaRequerimientoRegimen(REGIMEN_LEY_1755, radicacion, fin)).toBe(true);
  });
});

describe('sumarPlazo — rama CALENDARIO (régimen hipotético, cobertura de las 3 unidades)', () => {
  const REGIMEN_CALENDARIO: RegimenSubsanacion = {
    dias: 20,
    unidad: 'CALENDARIO',
    prorrogaDias: 10,
    ventanaRequerimiento: { dias: 5, unidad: 'CALENDARIO' },
  };

  it('suma días de calendario puros (incluye fines de semana y festivos)', () => {
    const notificacion = local(2026, 6, 1);
    const limite = calcularLimiteSubsanacion(REGIMEN_CALENDARIO, notificacion);
    expect(ymd(limite)).toBe('2026-06-21'); // 1 jun + 20 días calendario
  });
});

describe('mismo motor, datos distintos (D5) — resumen de equivalencia', () => {
  it.each([
    // `ymdEsperado` es el resultado EXACTO de `calcularLimiteSubsanacion` para
    // esta `notificacion` fija (2026-03-02) — verificado de forma independiente
    // contra `diasRestantesHabiles`/`sumarMesCalendario` antes de fijarlo aquí.
    { nombre: 'Licencia (Decreto 1077)', regimen: REGIMEN_LICENCIA_D1077_PLACEHOLDER, diasEsperados: 30, unidadEsperada: 'HABILES', ymdEsperado: '2026-04-16' },
    { nombre: 'Ley 1755', regimen: REGIMEN_LEY_1755, diasEsperados: 1, unidadEsperada: 'MESES', ymdEsperado: '2026-04-02' },
  ])('$nombre: el régimen declara $diasEsperados $unidadEsperada sin que el reloj los tenga hardcodeados', ({ regimen, diasEsperados, unidadEsperada, ymdEsperado }) => {
    expect(regimen.dias).toBe(diasEsperados);
    expect(regimen.unidad).toBe(unidadEsperada);
    // COB-4 (ultrareview): antes la única aserción sobre el cálculo era
    // `getTime > getTime`, trivialmente cierta para cualquier plazo positivo
    // (incluso uno mal calculado). Se compara contra el valor ESPECÍFICO
    // esperado de cada régimen, no solo contra "es posterior".
    const notificacion = local(2026, 3, 2);
    const limite = calcularLimiteSubsanacion(regimen, notificacion);
    expect(ymd(limite)).toBe(ymdEsperado);
    if (unidadEsperada === 'HABILES') {
      expect(diasRestantesHabiles(limite, notificacion)).toBe(diasEsperados);
    }
  });
});
