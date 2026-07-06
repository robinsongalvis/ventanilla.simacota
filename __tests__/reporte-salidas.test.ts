import { describe, expect, it } from 'vitest';
import type { SalidaOficial } from '@/src/types/salida';
import { filtrarSalidasPorPreset, resumenSalidas } from '@/lib/salidas/reporte-salidas';

/* ══════════════════════════════════════════════════════════════
   Fase B de salidas — la serie 2-SAL en el reporte del período.

   Referencia fija: jueves 2 jul 2026 15:00 UTC → 10:00 Colombia.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');

let n = 0;
function salida(overrides: Partial<SalidaOficial> = {}): SalidaOficial {
  n += 1;
  return {
    salidaId:      `2-SAL-2026-${String(n).padStart(8, '0')}`,
    consecutivo:   n,
    fechaSalida:   '2026-07-01T14:00:00.000Z',
    tipoSalida:    'RESPUESTA',
    radicadoEntradaId: '1-WEB-2026-00000001',
    destinatario:  { nombre: 'Juan Pérez', entidad: null, email: null, direccion: null },
    asunto:        'Respuesta a su solicitud',
    dependenciaOrigen: 'SEC_PLANEACION',
    firmante:      { uid: 'uid-1', nombre: 'Carlos Méndez' },
    medioEnvio:    'CORREO',
    registradoPor: { uid: 'uid-laura', nombre: 'Laura' },
    archivoPath:   null,
    ...overrides,
  };
}

describe('Fase B — filtrarSalidasPorPreset', () => {
  /* 1 · mismo corte colombiano del reporte de entradas */
  it('corta ESTE_MES por fecha de despacho en día colombiano', () => {
    const dentro = salida({ fechaSalida: '2026-07-01T14:00:00.000Z' });
    const fuera  = salida({ fechaSalida: '2026-06-28T14:00:00.000Z' });
    const r = filtrarSalidasPorPreset([dentro, fuera], 'ESTE_MES', 'TODAS', AHORA);
    expect(r.map((s) => s.salidaId)).toEqual([dentro.salidaId]);
  });

  /* 2 · la medianoche colombiana no se confunde con la UTC */
  it('un despacho de las 8 pm Colombia del 30 jun (01:00Z del 1 jul) es de junio', () => {
    const nocturna = salida({ fechaSalida: '2026-07-01T01:00:00.000Z' });
    expect(filtrarSalidasPorPreset([nocturna], 'ESTE_MES', 'TODAS', AHORA)).toEqual([]);
    expect(filtrarSalidasPorPreset([nocturna], 'MES_PASADO', 'TODAS', AHORA)).toHaveLength(1);
  });

  /* 3 · filtro por dependencia que despacha */
  it('filtra por dependenciaOrigen', () => {
    const planeacion = salida();
    const gobierno   = salida({ dependenciaOrigen: 'SEC_GOBIERNO' });
    const r = filtrarSalidasPorPreset([planeacion, gobierno], 'TODO', 'SEC_GOBIERNO', AHORA);
    expect(r.map((s) => s.salidaId)).toEqual([gobierno.salidaId]);
  });

  /* 4 · TODO no corta nada */
  it('TODO devuelve el libro completo', () => {
    const vieja = salida({ fechaSalida: '2025-01-15T14:00:00.000Z' });
    expect(filtrarSalidasPorPreset([vieja, salida()], 'TODO', 'TODAS', AHORA)).toHaveLength(2);
  });
});

describe('Fase B — resumenSalidas', () => {
  /* 5 · total = respuestas + oficios */
  it('cuadra respuestas y oficios independientes', () => {
    const r = resumenSalidas([
      salida(),
      salida(),
      salida({ tipoSalida: 'OFICIO_INDEPENDIENTE', radicadoEntradaId: null }),
    ]);
    expect(r.total).toBe(3);
    expect(r.respuestas).toBe(2);
    expect(r.oficios).toBe(1);
  });

  /* 6 · desglose por medio, el más usado primero, sin medios en cero */
  it('agrupa por medio de envío ordenado por cantidad', () => {
    const r = resumenSalidas([
      salida({ medioEnvio: 'FISICO' }),
      salida({ medioEnvio: 'FISICO' }),
      salida({ medioEnvio: 'CORREO' }),
    ]);
    expect(r.porMedio).toEqual([
      { medio: 'FISICO', cantidad: 2 },
      { medio: 'CORREO', cantidad: 1 },
    ]);
  });

  /* 7 · sin salidas: resumen en ceros limpio */
  it('con libro vacío devuelve ceros y sin medios', () => {
    const r = resumenSalidas([]);
    expect(r).toEqual({ total: 0, respuestas: 0, oficios: 0, porMedio: [] });
  });
});
