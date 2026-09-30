/**
 * El consecutivo de radicación solo puede AVANZAR.
 *
 * CONTEXTO: la Alcaldía releva el software anterior, que sigue emitiendo
 * radicados hasta el día del corte. Cuál será el último no se sabe por
 * adelantado —hay días sin nada y días en que el número salta decenas—, así que
 * el dato lo declara la funcionaria el día del relevo, con su libro delante.
 *
 * LO QUE SE CUSTODIA es la asimetría: avanzar siempre se permite, retroceder
 * jamás. Un hueco se explica en una línea del acta; un número repetido son dos
 * expedientes con la misma identidad legal, y el ciudadano ya se fue con su
 * constancia en la mano — no hay forma de recuperarla ni de decidir cuál de las
 * dos vale.
 */
import { describe, expect, it } from 'vitest';
import {
  MAXIMO_CONSECUTIVO_RAZONABLE,
  describirEstado,
  validarAjusteConsecutivo,
} from '@/lib/server/ajuste-consecutivo-radicacion';

describe('validarAjusteConsecutivo — solo se avanza', () => {
  it('permite avanzar: es el caso real del relevo (27 → 1779)', () => {
    expect(validarAjusteConsecutivo(27, 1779)).toBeNull();
  });

  it('permite un salto pequeño — el software anterior avanza a diario', () => {
    expect(validarAjusteConsecutivo(1744, 1780)).toBeNull();
  });

  it('RECHAZA retroceder — reemitiría radicados ya entregados', () => {
    const e = validarAjusteConsecutivo(1780, 1750);
    expect(e?.status).toBe(409);
    expect(e?.mensaje).toContain('solo puede avanzar');
  });

  it('rechaza dejarlo igual: no hay nada que cambiar', () => {
    expect(validarAjusteConsecutivo(1744, 1744)?.status).toBe(409);
  });

  it('rechaza lo que no es un entero: un consecutivo con decimales no existe', () => {
    expect(validarAjusteConsecutivo(10, 15.5)?.status).toBe(400);
    expect(validarAjusteConsecutivo(10, '1779')?.status).toBe(400);
    expect(validarAjusteConsecutivo(10, null)?.status).toBe(400);
    expect(validarAjusteConsecutivo(10, NaN)?.status).toBe(400);
  });

  it('rechaza negativos y cifras absurdas — un dedo torpe no puede saltar el contador al infinito', () => {
    expect(validarAjusteConsecutivo(10, -1)?.status).toBe(400);
    expect(validarAjusteConsecutivo(10, MAXIMO_CONSECUTIVO_RAZONABLE + 1)?.status).toBe(400);
  });

  it('acepta 0 como punto de partida cuando aún no se ha emitido nada', () => {
    expect(validarAjusteConsecutivo(0, 1)).toBeNull();
  });
});

describe('describirEstado — lo que se confirma antes de guardar', () => {
  it('muestra el radicado que saldrá, no solo el número', () => {
    /* Quien ajusta debe ver el identificador COMPLETO antes de aceptar: es la
       única forma de que note un dedazo antes de que sea la identidad legal de
       un trámite. */
    const fecha = new Date('2026-09-29T12:00:00-05:00');
    const estado = describirEstado(2026, 1779, fecha);
    expect(estado.ultimo).toBe(1779);
    expect(estado.proximoRadicado).toBe('1-110-202609-00001780');
  });

  it('rellena a 8 dígitos — la forma canónica del sistema', () => {
    const fecha = new Date('2026-09-29T12:00:00-05:00');
    expect(describirEstado(2026, 0, fecha).proximoRadicado).toBe('1-110-202609-00000001');
  });
});
