/**
 * Fase 2 (arranque, PASO 7) — subtipos de trámite como dato (RN-3,
 * `docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`).
 *
 * Fixture genérico (no Licencia de Construcción real) — valida el
 * MECANISMO, no ninguna regla de negocio concreta.
 */
import { describe, it, expect } from 'vitest';
import { validarDefinicionTramite, validarSubtiposExpediente } from '@/lib/motor-expedientes/validar-definicion';
import type { DefinicionTramite, Expediente, SubtipoTramite } from '@/lib/motor-expedientes/tipos';

function definicionBase(overrides: Partial<DefinicionTramite> = {}): DefinicionTramite {
  return {
    id: 'tramite-generico-prueba',
    nombre: 'Trámite Genérico de Prueba',
    activo: true,
    terminos: { dias: 10, unidad: 'HABILES' },
    regimenSubsanacion: {
      dias: 5, unidad: 'HABILES', prorrogaDias: 5,
      ventanaRequerimiento: { dias: 3, unidad: 'HABILES' },
    },
    requiereVisita: false,
    generaResolucion: false,
    requisitos: [{ id: 'doc-base', nombre: 'Documento base', tipo: 'OBLIGATORIO' }],
    ...overrides,
  };
}

const SUBTIPOS_VALIDOS: SubtipoTramite[] = [
  { codigo: 'obra-nueva', nombre: 'Obra Nueva' },
  { codigo: 'ampliacion', nombre: 'Ampliación' },
];

describe('validarDefinicionTramite — subtipos (RN-3)', () => {
  it('sin subtipos declarados → válida (campo opcional)', () => {
    expect(validarDefinicionTramite(definicionBase()).valida).toBe(true);
  });

  it('subtipos válidos, códigos únicos → válida', () => {
    expect(validarDefinicionTramite(definicionBase({ subtipos: SUBTIPOS_VALIDOS })).valida).toBe(true);
  });

  it('código de subtipo vacío → SUBTIPO_CODIGO_VACIO', () => {
    const resultado = validarDefinicionTramite(definicionBase({
      subtipos: [{ codigo: '', nombre: 'Sin código' }],
    }));
    expect(resultado.valida).toBe(false);
    expect(resultado.errores.map((e) => e.codigo)).toContain('SUBTIPO_CODIGO_VACIO');
  });

  it('código de subtipo repetido → SUBTIPO_CODIGO_DUPLICADO (fail-closed, no "el último gana")', () => {
    const resultado = validarDefinicionTramite(definicionBase({
      subtipos: [
        { codigo: 'obra-nueva', nombre: 'Obra Nueva' },
        { codigo: 'obra-nueva', nombre: 'Obra Nueva (otra descripción)' },
      ],
    }));
    expect(resultado.valida).toBe(false);
    expect(resultado.errores.map((e) => e.codigo)).toContain('SUBTIPO_CODIGO_DUPLICADO');
  });
});

describe('validarSubtiposExpediente — Expediente.subtipos contra la Definición publicada', () => {
  const definicion = definicionBase({ subtipos: SUBTIPOS_VALIDOS });

  it('sin subtipos en el expediente → válido (nada que validar)', () => {
    const expediente: Pick<Expediente, 'subtipos'> = {};
    expect(validarSubtiposExpediente(expediente, definicion).valida).toBe(true);
  });

  it('código declarado en la Definición → válido', () => {
    const expediente: Pick<Expediente, 'subtipos'> = { subtipos: ['obra-nueva'] };
    expect(validarSubtiposExpediente(expediente, definicion).valida).toBe(true);
  });

  it('combinado (2 códigos válidos) → válido (RF-3: soporta combinados)', () => {
    const expediente: Pick<Expediente, 'subtipos'> = { subtipos: ['obra-nueva', 'ampliacion'] };
    expect(validarSubtiposExpediente(expediente, definicion).valida).toBe(true);
  });

  it('código NO declarado → SUBTIPO_NO_DECLARADO', () => {
    const expediente: Pick<Expediente, 'subtipos'> = { subtipos: ['inventado'] };
    const resultado = validarSubtiposExpediente(expediente, definicion);
    expect(resultado.valida).toBe(false);
    expect(resultado.errores[0]!.codigo).toBe('SUBTIPO_NO_DECLARADO');
  });

  it('Definición SIN subtipos declarados (undefined) → cualquier código del expediente se rechaza (fail-closed)', () => {
    const definicionSinSubtipos = definicionBase();
    const expediente: Pick<Expediente, 'subtipos'> = { subtipos: ['cualquiera'] };
    expect(validarSubtiposExpediente(expediente, definicionSinSubtipos).valida).toBe(false);
  });
});
