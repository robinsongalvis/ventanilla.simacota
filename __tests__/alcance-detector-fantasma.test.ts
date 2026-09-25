import { describe, it, expect } from 'vitest';
import { SERIES_CONSECUTIVO } from '@/lib/server/consecutivo-legal';
import { elementosNoDeclarados, elementosFantasma } from '@/lib/server/alcance-vigilancia';
import { COLECCION_POR_SERIE, ALCANCE_DETECTOR } from '@/scripts/laboratorio/detectar-consecutivos-fantasma.mjs';

/**
 * El detector de consecutivos fantasma es el guion que se corre A MANO contra
 * producción para levantar las constancias del AGN. Recorría tres series y la
 * cuarta —`expedientes`, la única con un libro de papel detrás— no estaba en su
 * mapa ni en ninguna declaración: imprimía «CERO HUECOS Y CERO DUPLICADOS —
 * cierre limpio» sin haberla mirado.
 *
 * Es el segundo sitio del defecto que se dio por cerrado el 26-ago habiendo
 * arreglado solo el cron.
 */
describe('el detector de consecutivos fantasma sabe qué no está mirando', () => {
  it('ninguna serie del dominio queda sin cubrir ni sin declarar', () => {
    const huerfanas = elementosNoDeclarados(SERIES_CONSECUTIVO, ALCANCE_DETECTOR);
    expect(
      huerfanas,
      `Sin cubrir y sin declarar: ${huerfanas.join(', ')}. Excluir es legítimo; excluir sin darse cuenta no.`,
    ).toEqual([]);
  });

  it('no declara series que ya no existen', () => {
    expect(elementosFantasma(SERIES_CONSECUTIVO, ALCANCE_DETECTOR)).toEqual([]);
  });

  it('cada exclusión trae una razón legible, no un marcador', () => {
    for (const [serie, razon] of Object.entries(ALCANCE_DETECTOR.excluidos)) {
      expect((razon as string).length, `la razón de excluir '${serie}' no explica nada`).toBeGreaterThan(40);
      expect(razon as string).not.toMatch(/^(TODO|FIXME|pendiente|por definir)/i);
    }
  });

  it('lo declarado como cubierto coincide con lo que el guion recorre de verdad', () => {
    expect([...ALCANCE_DETECTOR.cubiertos].sort()).toEqual(Object.keys(COLECCION_POR_SERIE).sort());
  });
});
