/**
 * Prueba de la lógica pura del detector de consecutivos fantasma (Bloque 2,
 * cierre de H3). La ejecución contra Firestore es solo-lectura y se corre
 * aparte contra Producción; aquí se valida el algoritmo de detección de huecos.
 */
import { describe, it, expect } from 'vitest';
import {
  huecosDe,
  duplicadosDe,
  consecutivoDeId,
  perteneceAlAnio,
} from '@/scripts/laboratorio/detectar-consecutivos-fantasma.mjs';

describe('detector de fantasmas — huecosDe', () => {
  it('cero huecos cuando todos los consecutivos existen', () => {
    expect(huecosDe(3, [1, 2, 3])).toEqual([]);
  });

  it('detecta el hueco exacto (número consumido sin documento)', () => {
    // Contador en 3, pero falta el 2 → fantasma en el 2.
    expect(huecosDe(3, [1, 3])).toEqual([2]);
  });

  it('detecta múltiples huecos en orden ascendente', () => {
    expect(huecosDe(5, [1, 4])).toEqual([2, 3, 5]);
  });

  it('acepta un Set y no cuenta números por encima del contador', () => {
    expect(huecosDe(2, new Set([1, 2, 3]))).toEqual([]);
  });

  it('contador en 0 no reporta huecos', () => {
    expect(huecosDe(0, [])).toEqual([]);
  });
});

describe('detector de fantasmas — duplicadosDe (unicidad AGN 060)', () => {
  it('sin duplicados cuando todos son únicos', () => {
    expect(duplicadosDe([1, 2, 3])).toEqual([]);
  });

  it('detecta un consecutivo repetido (mismo número en dos documentos)', () => {
    expect(duplicadosDe([1, 2, 2, 3])).toEqual([2]);
  });

  it('detecta múltiples duplicados en orden ascendente', () => {
    expect(duplicadosDe([3, 1, 3, 2, 1])).toEqual([1, 3]);
  });

  it('un Set jamás mostraría el duplicado — por eso operamos sobre la lista', () => {
    const lista = [5, 5];
    expect(new Set(lista).size).toBe(1);      // el Set lo oculta
    expect(duplicadosDe(lista)).toEqual([5]);  // la lista lo revela
  });

  it('lista vacía no reporta duplicados', () => {
    expect(duplicadosDe([])).toEqual([]);
  });
});

describe('detector de fantasmas — consecutivoDeId', () => {
  it('extrae el consecutivo del id de radicado', () => {
    expect(consecutivoDeId('1-110-2026-00000042')).toBe(42);
  });

  it('extrae el consecutivo de una planilla', () => {
    expect(consecutivoDeId('PL-2026-0007')).toBe(7);
  });

  it('extrae el consecutivo de una salida', () => {
    expect(consecutivoDeId('2-110-2026-00000005')).toBe(5);
  });

  it('devuelve null para un id no parseable', () => {
    expect(consecutivoDeId('sin-numero-final-x')).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════
   ADR-0024 (2026-07-15) — el tercer segmento del id pasa de {AAAA} a
   {AAAAMM}. El detector NO puede quedar ciego a los ids nuevos: esta
   suite prueba `perteneceAlAnio`, que reemplaza el filtro literal
   `.includes('-{año}-')` para aceptar ambos formatos conviviendo en el
   mismo año.
══════════════════════════════════════════════════════════════ */
describe('detector de fantasmas — perteneceAlAnio (formato viejo y nuevo conviven)', () => {
  it('acepta el formato anterior, solo año (1-110-2026-00000025)', () => {
    expect(perteneceAlAnio('1-110-2026-00000025', 2026)).toBe(true);
  });

  it('acepta el formato nuevo, año+mes (1-110-202607-00001217)', () => {
    expect(perteneceAlAnio('1-110-202607-00001217', 2026)).toBe(true);
  });

  it('acepta salidas nuevas (2-110-202611-00000005) y viejas (2-SAL-2026-00000006)', () => {
    expect(perteneceAlAnio('2-110-202611-00000005', 2026)).toBe(true);
    expect(perteneceAlAnio('2-SAL-2026-00000006', 2026)).toBe(true);
  });

  it('acepta planillas (sin código de oficina, solo año)', () => {
    expect(perteneceAlAnio('PL-2026-0007', 2026)).toBe(true);
  });

  it('rechaza un id de otro año, en cualquiera de los dos formatos', () => {
    expect(perteneceAlAnio('1-110-2025-00000001', 2026)).toBe(false);
    expect(perteneceAlAnio('1-110-202507-00000001', 2026)).toBe(false);
  });

  it('rechaza un mes inválido (13) para no colar falsos positivos', () => {
    expect(perteneceAlAnio('1-110-202613-00000001', 2026)).toBe(false);
  });

  describe('huecos y duplicados correctos con ids mixtos (viejo + nuevo) en el mismo año', () => {
    // Escenario real esperado en 2026: los primeros ~25 radicados nacieron
    // con el formato anterior (sin mes); a partir del cambio, los ids
    // llevan {AAAAMM}. El detector debe tratarlos como UNA sola serie anual.
    const docsDelAnio = [
      '1-110-2026-00000001',
      '1-110-2026-00000002',
      // hueco en el 3
      '1-110-202607-00000004',
      '1-110-202607-00000004', // duplicado del 4
      '1-110-202611-00000005',
    ];

    it('detecta el hueco (3) y el duplicado (4) mezclando ambos formatos', () => {
      const presentesLista = docsDelAnio
        .filter((id) => perteneceAlAnio(id, 2026))
        .map((id) => consecutivoDeId(id));
      const presentes = new Set(presentesLista);

      expect(huecosDe(5, presentes)).toEqual([3]);
      expect(duplicadosDe(presentesLista)).toEqual([4]);
    });

    it('un id de otro año no contamina el conteo del año consultado', () => {
      const conRuido = [...docsDelAnio, '1-110-2025-00000099', '1-110-202701-00000001'];
      const presentesLista = conRuido
        .filter((id) => perteneceAlAnio(id, 2026))
        .map((id) => consecutivoDeId(id));

      expect(presentesLista.length).toBe(5);
    });
  });
});
