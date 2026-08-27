import { describe, it, expect } from 'vitest';
import { SERIES_CONSECUTIVO } from '@/lib/server/consecutivo-legal';
import { elementosNoDeclarados, elementosFantasma } from '@/lib/server/alcance-vigilancia';
import { ALCANCE_BARRIDA_CONTINUIDAD } from '@/app/api/cron/auditoria-consecutivos/route';
import { COLECCION_POR_SERIE } from '@/scripts/laboratorio/detectar-consecutivos-fantasma.mjs';

/**
 * SEXTA APARICIÓN DE LA REGLA, Y LA PRIMERA QUE SE COMPRUEBA SOLA.
 *
 * «El instrumento que vigila el silencio no puede filtrar por el campo que
 * falta justo en los casos que más importan» (ADR-0033 §4.6). Dos veces sobre
 * la misma serie y en la misma semana: primero el escritor y el lector no
 * coincidieron en dónde vivía el dato (`abiertaEn` contra `apertura.abiertoEn`),
 * después el vigilante recorrió una lista de la que faltaba `expedientes`.
 *
 * Las dos veces el instrumento compiló, pasó las pruebas y no se quejó. El
 * silencio de un vigilante es indistinguible de «todo en orden», y por eso no
 * puede depender de que alguien se acuerde.
 *
 * Esta prueba no comprueba que el cron funcione: comprueba que SABE qué está
 * mirando y qué no. Añadir una serie al dominio sin decidir qué hace el cron
 * con ella la rompe.
 */

describe('alcance declarado del cron de auditoría de consecutivos', () => {
  it('ninguna serie del dominio queda sin cubrir ni sin declarar como excluida', () => {
    const huerfanas = elementosNoDeclarados(SERIES_CONSECUTIVO, ALCANCE_BARRIDA_CONTINUIDAD);
    expect(
      huerfanas,
      `Estas series no las vigila el cron y tampoco están declaradas como excluidas: ${huerfanas.join(', ')}. ` +
        'Decida qué hace el cron con ellas y escríbalo — excluir es legítimo, excluir sin darse cuenta no.',
    ).toEqual([]);
  });

  it('no declara vigilar ni excluir series que ya no existen', () => {
    expect(elementosFantasma(SERIES_CONSECUTIVO, ALCANCE_BARRIDA_CONTINUIDAD)).toEqual([]);
  });

  it('cada exclusión trae una razón que un tercero pueda leer, no un marcador', () => {
    for (const [serie, razon] of Object.entries(ALCANCE_BARRIDA_CONTINUIDAD.excluidos)) {
      expect(typeof razon, serie).toBe('string');
      expect((razon as string).length, `la razón de excluir '${serie}' es demasiado corta para explicar nada`)
        .toBeGreaterThan(40);
      expect(razon as string, `'${serie}' está excluida con un marcador, no con una razón`)
        .not.toMatch(/^(TODO|FIXME|pendiente|por definir)/i);
    }
  });

  /* El alcance declarado tiene que corresponderse con lo que el cron REALMENTE
     recorre. Si alguien añade una colección al mapa y no toca la declaración,
     el vigilante vuelve a no saber qué mira — solo que ahora al revés. */
  it('lo declarado como cubierto coincide con las series que el barrido recorre de verdad', () => {
    expect([...ALCANCE_BARRIDA_CONTINUIDAD.cubiertos].sort())
      .toEqual(Object.keys(COLECCION_POR_SERIE).sort());
  });
});

describe('el mecanismo caza de verdad el defecto que lo motivó', () => {
  /* Un guard que no se ha visto fallar no es un guard, es una esperanza.
     Se reproduce aquí el alcance EXACTO que tenía el cron antes del
     26-ago-2026 —las tres series del mapa, sin declarar nada sobre la
     cuarta— y se comprueba que el mecanismo lo señala. */
  it('el alcance que el cron tenía antes habría fallado esta prueba', () => {
    const comoEstabaAntes = {
      cubiertos: ['radicados', 'salidas', 'planillas'],
      excluidos: {},
    } as const;
    expect(elementosNoDeclarados(SERIES_CONSECUTIVO, comoEstabaAntes)).toEqual(['expedientes']);
  });

  it('declarar la exclusión con el nombre mal escrito tampoco pasa', () => {
    // `Partial<Record<T, string>>` lo rechaza en compilación; en ejecución,
    // el elemento sigue apareciendo como no declarado.
    const conErrata = {
      cubiertos: ['radicados', 'salidas', 'planillas'],
      excluidos: { expediente: 'falta la s' },
    } as never;
    expect(elementosNoDeclarados(SERIES_CONSECUTIVO, conErrata)).toEqual(['expedientes']);
    expect(elementosFantasma(SERIES_CONSECUTIVO, conErrata)).toEqual(['expediente']);
  });
});
