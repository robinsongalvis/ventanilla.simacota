import { describe, expect, it } from 'vitest';
import {
  construirDocSalida,
  construirNotaSalida,
  validarSalida,
  type EntradaSalida,
} from '@/lib/salidas/construir-salida';

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — construcción y validación.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-04T15:00:00.000Z');

function entrada(overrides: Partial<EntradaSalida> = {}): EntradaSalida {
  return {
    tipoSalida:        'RESPUESTA',
    radicadoEntradaId: '1-WEB-2026-00000045',
    destinatario:      { nombre: 'María Rincón' },
    asunto:            'Respuesta a petición sobre impuesto predial',
    dependenciaOrigen: 'SEC_HACIENDA',
    medioEnvio:        'CORREO',
    firmanteNombre:    'Secretario de Hacienda',
    ...overrides,
  };
}

describe('Radicación de salida — validarSalida', () => {
  /* 1 · la entrada válida pasa */
  it('acepta una respuesta completa', () => {
    expect(validarSalida(entrada())).toBeNull();
  });

  /* 2 · respuesta sin amarre es inválida */
  it('exige radicado de entrada en tipo RESPUESTA', () => {
    expect(validarSalida(entrada({ radicadoEntradaId: '' })))
      .toMatch(/radicado de entrada/i);
  });

  /* 3 · oficio independiente no lleva amarre */
  it('rechaza radicado de entrada en OFICIO_INDEPENDIENTE', () => {
    expect(validarSalida(entrada({ tipoSalida: 'OFICIO_INDEPENDIENTE' })))
      .toMatch(/no lleva radicado/i);
    expect(validarSalida(entrada({
      tipoSalida: 'OFICIO_INDEPENDIENTE',
      radicadoEntradaId: null,
    }))).toBeNull();
  });

  /* 4 · destinatario y asunto obligatorios */
  it('exige destinatario y asunto', () => {
    expect(validarSalida(entrada({ destinatario: { nombre: '  ' } })))
      .toMatch(/destinatario/i);
    expect(validarSalida(entrada({ asunto: '' }))).toMatch(/asunto/i);
  });
});

describe('Radicación de salida — construirDocSalida', () => {
  /* 5 · el doc queda completo, con null explícito en opcionales */
  it('arma el documento con amarre y sin undefined', () => {
    const doc = construirDocSalida(
      entrada(),
      '2-SAL-2026-00000012',
      12,
      { uid: 'uid-laura', nombre: 'Laura' },
      AHORA,
    );
    expect(doc.salidaId).toBe('2-SAL-2026-00000012');
    expect(doc.radicadoEntradaId).toBe('1-WEB-2026-00000045');
    expect(doc.destinatario.entidad).toBeNull();
    expect(doc.registradoPor.nombre).toBe('Laura');
    expect(doc.firmante.nombre).toBe('Secretario de Hacienda');
    expect(doc.archivoPath).toBeNull();
    expect(JSON.stringify(doc)).not.toContain('undefined');
  });

  /* 6 · el oficio independiente queda sin amarre */
  it('OFICIO_INDEPENDIENTE persiste radicadoEntradaId null', () => {
    const doc = construirDocSalida(
      entrada({ tipoSalida: 'OFICIO_INDEPENDIENTE', radicadoEntradaId: null }),
      '2-SAL-2026-00000013',
      13,
      { uid: 'u', nombre: 'Laura' },
      AHORA,
    );
    expect(doc.radicadoEntradaId).toBeNull();
  });
});

describe('Radicación de salida — construirNotaSalida', () => {
  /* 7 · el amarre legible en la trazabilidad de la entrada */
  it('arma la nota con salida, destinatario y dependencia', () => {
    expect(construirNotaSalida('2-SAL-2026-00000012', 'María Rincón', 'SEC_HACIENDA'))
      .toBe('Despachado oficio de salida 2-SAL-2026-00000012 para María Rincón · Secretaría de Hacienda');
  });
});
