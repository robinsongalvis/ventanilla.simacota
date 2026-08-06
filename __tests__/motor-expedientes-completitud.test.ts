/**
 * Fase 0 del motor de expedientes — evaluador de completitud (D4, ADR-0026).
 *
 * Los fixtures reproducen las reglas condicionales REALES del checklist de
 * Licencia de Construcción · Obra Nueva
 * (`docs/blueprints/requisitos-licencia-construccion-obra-nueva.md`):
 *  - #3  poder/apoderado           → CONDICIONAL si `esApoderado`
 *  - #9  relación de colindantes   → CONDICIONAL salvo predio rodeado de espacio público
 *  - #12 planos estructurales      → CONDICIONAL para categoría Baja/Media
 *  - #13 estudio de suelos         → CONDICIONAL si NO sujeto a Título E NSR-10
 *
 * Puro — sin Firestore, sin fechas de servidor.
 */
import { describe, it, expect } from 'vitest';
import { evaluarCompletitud, evaluarCondicion, requisitoAplica } from '@/lib/motor-expedientes/completitud';
import type {
  AporteRequisito,
  CondicionRequisito,
  ContextoEvaluacionRequisito,
  DefinicionTramite,
} from '@/lib/motor-expedientes/tipos';

/** Definición mínima (subconjunto representativo) de la Licencia de Construcción. */
function tramiteLicencia(): DefinicionTramite {
  return {
    id: 'licencia-construccion-obra-nueva',
    nombre: 'Licencia de Construcción · Obra Nueva',
    activo: true,
    terminos: { dias: 45, unidad: 'HABILES' },
    regimenSubsanacion: {
      dias: 30,
      unidad: 'HABILES',
      prorrogaDias: 15,
      ventanaRequerimiento: { dias: 10, unidad: 'HABILES' },
    },
    requiereVisita: true,
    generaResolucion: true,
    requisitos: [
      { id: 'solicitud-escrita', nombre: 'Solicitud escrita del titular', tipo: 'OBLIGATORIO' },
      { id: 'certificado-tradicion', nombre: 'Certificado de Tradición y Libertad', tipo: 'OBLIGATORIO' },
      { id: 'copia-cedula-arquitecto', nombre: 'Copia de matrícula de arquitecto', tipo: 'OPCIONAL' },
      {
        id: 'poder-apoderado',
        nombre: 'Poder o autorización del apoderado',
        tipo: 'CONDICIONAL',
        condicion: { operador: 'IGUAL', clave: 'esApoderado', valor: true },
      },
      {
        id: 'relacion-colindantes',
        nombre: 'Relación de direcciones de predios colindantes',
        tipo: 'CONDICIONAL',
        condicion: { operador: 'IGUAL', clave: 'predioRodeadoEspacioPublico', valor: false },
      },
      {
        id: 'planos-estructurales',
        nombre: 'Planos hidráulicos, sanitarios y estructurales',
        tipo: 'CONDICIONAL',
        condicion: { operador: 'EN', clave: 'categoriaComplejidad', valores: ['BAJA', 'MEDIA'] },
      },
      {
        id: 'estudio-suelos',
        nombre: 'Estudio de suelos y geotécnico',
        tipo: 'CONDICIONAL',
        condicion: { operador: 'IGUAL', clave: 'sujetoTituloENSR10', valor: false },
      },
    ],
  };
}

const aportado = (requisitoId: string): AporteRequisito => ({
  requisitoId,
  estado: 'APORTADO',
  documentoIds: [`doc-${requisitoId}`],
});
const pendiente = (requisitoId: string): AporteRequisito => ({
  requisitoId,
  estado: 'PENDIENTE',
  documentoIds: [],
});

describe('evaluarCondicion — árbol de expresión de tres valores (CUMPLE/NO_CUMPLE/INDETERMINADO)', () => {
  const contexto: ContextoEvaluacionRequisito = {
    categoriaComplejidad: 'MEDIA',
    esApoderado: false,
    activo: true,
  };

  it('IGUAL', () => {
    expect(evaluarCondicion({ operador: 'IGUAL', clave: 'esApoderado', valor: false }, contexto)).toBe('CUMPLE');
    expect(evaluarCondicion({ operador: 'IGUAL', clave: 'esApoderado', valor: true }, contexto)).toBe('NO_CUMPLE');
  });

  it('DISTINTO', () => {
    expect(evaluarCondicion({ operador: 'DISTINTO', clave: 'esApoderado', valor: true }, contexto)).toBe('CUMPLE');
  });

  it('EN', () => {
    expect(
      evaluarCondicion({ operador: 'EN', clave: 'categoriaComplejidad', valores: ['BAJA', 'MEDIA'] }, contexto),
    ).toBe('CUMPLE');
    expect(
      evaluarCondicion({ operador: 'EN', clave: 'categoriaComplejidad', valores: ['ALTA'] }, contexto),
    ).toBe('NO_CUMPLE');
  });

  it('Y — todas deben cumplirse', () => {
    const c: CondicionRequisito = {
      operador: 'Y',
      condiciones: [
        { operador: 'IGUAL', clave: 'activo', valor: true },
        { operador: 'IGUAL', clave: 'esApoderado', valor: false },
      ],
    };
    expect(evaluarCondicion(c, contexto)).toBe('CUMPLE');
  });

  it('O — al menos una debe cumplirse', () => {
    const c: CondicionRequisito = {
      operador: 'O',
      condiciones: [
        { operador: 'IGUAL', clave: 'esApoderado', valor: true },
        { operador: 'EN', clave: 'categoriaComplejidad', valores: ['MEDIA'] },
      ],
    };
    expect(evaluarCondicion(c, contexto)).toBe('CUMPLE');
  });

  it('NO — invierte el resultado', () => {
    const c: CondicionRequisito = { operador: 'NO', condicion: { operador: 'IGUAL', clave: 'esApoderado', valor: true } };
    expect(evaluarCondicion(c, contexto)).toBe('CUMPLE');
  });

  it('NO — invierte CUMPLE a NO_CUMPLE (dirección faltante anti-mutante, COB-1 del ultrareview)', () => {
    // esApoderado === false en el contexto → IGUAL esApoderado=false es CUMPLE → NO(CUMPLE) = NO_CUMPLE.
    // Sin este caso, un mutante que pierda la negación (devolver siempre CUMPLE) sobreviviría a la suite.
    const c: CondicionRequisito = { operador: 'NO', condicion: { operador: 'IGUAL', clave: 'esApoderado', valor: false } };
    expect(evaluarCondicion(c, contexto)).toBe('NO_CUMPLE');
  });

  it('NO — propaga INDETERMINADO cuando su rama es indeterminada', () => {
    const c: CondicionRequisito = { operador: 'NO', condicion: { operador: 'IGUAL', clave: 'claveAusente', valor: true } };
    expect(evaluarCondicion(c, contexto)).toBe('INDETERMINADO');
  });

  describe('FAIL-CLOSED — clave ausente en el contexto (hallazgo MEDIO #1)', () => {
    it('IGUAL/DISTINTO/EN sobre una clave ausente son INDETERMINADO, no NO_CUMPLE', () => {
      expect(evaluarCondicion({ operador: 'IGUAL', clave: 'noExiste', valor: true }, contexto)).toBe('INDETERMINADO');
      expect(evaluarCondicion({ operador: 'DISTINTO', clave: 'noExiste', valor: true }, contexto)).toBe('INDETERMINADO');
      expect(evaluarCondicion({ operador: 'EN', clave: 'noExiste', valores: ['x'] }, contexto)).toBe('INDETERMINADO');
    });

    it('Y con una rama NO_CUMPLE decidida gana sobre una rama INDETERMINADA (ya se sabe que no cumple)', () => {
      const c: CondicionRequisito = {
        operador: 'Y',
        condiciones: [
          { operador: 'IGUAL', clave: 'esApoderado', valor: true }, // NO_CUMPLE (esApoderado=false)
          { operador: 'IGUAL', clave: 'noExiste', valor: true }, // INDETERMINADO
        ],
      };
      expect(evaluarCondicion(c, contexto)).toBe('NO_CUMPLE');
    });

    it('Y sin ninguna rama NO_CUMPLE pero con una INDETERMINADA es INDETERMINADO', () => {
      const c: CondicionRequisito = {
        operador: 'Y',
        condiciones: [
          { operador: 'IGUAL', clave: 'activo', valor: true }, // CUMPLE
          { operador: 'IGUAL', clave: 'noExiste', valor: true }, // INDETERMINADO
        ],
      };
      expect(evaluarCondicion(c, contexto)).toBe('INDETERMINADO');
    });

    it('O con una rama CUMPLE decidida gana sobre una rama INDETERMINADA (ya está satisfecha)', () => {
      const c: CondicionRequisito = {
        operador: 'O',
        condiciones: [
          { operador: 'IGUAL', clave: 'activo', valor: true }, // CUMPLE
          { operador: 'IGUAL', clave: 'noExiste', valor: true }, // INDETERMINADO
        ],
      };
      expect(evaluarCondicion(c, contexto)).toBe('CUMPLE');
    });

    it('O sin ninguna rama CUMPLE pero con una INDETERMINADA es INDETERMINADO (no se puede descartar)', () => {
      const c: CondicionRequisito = {
        operador: 'O',
        condiciones: [
          { operador: 'IGUAL', clave: 'esApoderado', valor: true }, // NO_CUMPLE
          { operador: 'IGUAL', clave: 'noExiste', valor: true }, // INDETERMINADO
        ],
      };
      expect(evaluarCondicion(c, contexto)).toBe('INDETERMINADO');
    });

    it('NO de una condición INDETERMINADA sigue siendo INDETERMINADA', () => {
      const c: CondicionRequisito = { operador: 'NO', condicion: { operador: 'IGUAL', clave: 'noExiste', valor: true } };
      expect(evaluarCondicion(c, contexto)).toBe('INDETERMINADO');
    });
  });
});

describe('requisitoAplica', () => {
  it('OBLIGATORIO siempre aplica', () => {
    expect(requisitoAplica({ id: 'x', nombre: 'x', tipo: 'OBLIGATORIO' }, {})).toBe('APLICA');
  });

  it('OPCIONAL nunca aplica (no bloquea)', () => {
    expect(requisitoAplica({ id: 'x', nombre: 'x', tipo: 'OPCIONAL' }, {})).toBe('NO_APLICA');
  });

  it('CONDICIONAL depende de su regla', () => {
    const req = {
      id: 'x',
      nombre: 'x',
      tipo: 'CONDICIONAL' as const,
      condicion: { operador: 'IGUAL' as const, clave: 'esApoderado', valor: true },
    };
    expect(requisitoAplica(req, { esApoderado: true })).toBe('APLICA');
    expect(requisitoAplica(req, { esApoderado: false })).toBe('NO_APLICA');
  });

  it('CONDICIONAL cuya clave no está en el contexto es INDETERMINADO (fail-closed), nunca NO_APLICA', () => {
    const req = {
      id: 'x',
      nombre: 'x',
      tipo: 'CONDICIONAL' as const,
      condicion: { operador: 'IGUAL' as const, clave: 'esApoderado', valor: true },
    };
    expect(requisitoAplica(req, {})).toBe('INDETERMINADO');
  });
});

describe('evaluarCompletitud — checklist real de Licencia de Construcción', () => {
  it('incompleto: falta un OBLIGATORIO aunque los condicionales no apliquen', () => {
    const tramite = tramiteLicencia();
    const contexto: ContextoEvaluacionRequisito = {
      esApoderado: false,
      predioRodeadoEspacioPublico: true, // exime colindantes
      categoriaComplejidad: 'ALTA', // exime planos estructurales
      sujetoTituloENSR10: true, // exime estudio de suelos
    };
    const aportes = [aportado('certificado-tradicion')]; // falta solicitud-escrita

    const resultado = evaluarCompletitud(tramite, aportes, contexto);

    expect(resultado.completo).toBe(false);
    expect(resultado.faltantes).toEqual([
      { requisitoId: 'solicitud-escrita', nombre: 'Solicitud escrita del titular', motivo: 'PENDIENTE_OBLIGATORIO' },
    ]);
    expect(resultado.noAplicables.sort()).toEqual(
      ['poder-apoderado', 'relacion-colindantes', 'planos-estructurales', 'estudio-suelos'].sort(),
    );
  });

  it('opcional nunca bloquea la completitud aunque no tenga aporte', () => {
    const tramite = tramiteLicencia();
    const contexto: ContextoEvaluacionRequisito = {
      esApoderado: false,
      predioRodeadoEspacioPublico: true,
      categoriaComplejidad: 'ALTA',
      sujetoTituloENSR10: true,
    };
    const aportes = [aportado('solicitud-escrita'), aportado('certificado-tradicion')];

    const resultado = evaluarCompletitud(tramite, aportes, contexto);

    expect(resultado.completo).toBe(true);
    expect(resultado.faltantes).toEqual([]);
  });

  it('condicional que APLICA (hay apoderado) y no tiene aporte bloquea con motivo PENDIENTE_CONDICIONAL_APLICA', () => {
    const tramite = tramiteLicencia();
    const contexto: ContextoEvaluacionRequisito = {
      esApoderado: true, // aplica poder-apoderado
      predioRodeadoEspacioPublico: true,
      categoriaComplejidad: 'ALTA',
      sujetoTituloENSR10: true,
    };
    const aportes = [aportado('solicitud-escrita'), aportado('certificado-tradicion')];

    const resultado = evaluarCompletitud(tramite, aportes, contexto);

    expect(resultado.completo).toBe(false);
    expect(resultado.faltantes).toEqual([
      { requisitoId: 'poder-apoderado', nombre: 'Poder o autorización del apoderado', motivo: 'PENDIENTE_CONDICIONAL_APLICA' },
    ]);
  });

  it('caso Baja Complejidad + no sujeto a Título E + predio NO rodeado: los 4 condicionales aplican', () => {
    const tramite = tramiteLicencia();
    const contexto: ContextoEvaluacionRequisito = {
      esApoderado: true,
      predioRodeadoEspacioPublico: false,
      categoriaComplejidad: 'BAJA',
      sujetoTituloENSR10: false,
    };
    const aportes = [
      aportado('solicitud-escrita'),
      aportado('certificado-tradicion'),
      aportado('poder-apoderado'),
      aportado('relacion-colindantes'),
      aportado('planos-estructurales'),
      aportado('estudio-suelos'),
    ];

    const resultado = evaluarCompletitud(tramite, aportes, contexto);

    expect(resultado.completo).toBe(true);
    expect(resultado.noAplicables).toEqual([]);
  });

  it('caso Baja Complejidad con condicionales aplicables PENDIENTES: reporta las 4 como faltantes', () => {
    const tramite = tramiteLicencia();
    const contexto: ContextoEvaluacionRequisito = {
      esApoderado: true,
      predioRodeadoEspacioPublico: false,
      categoriaComplejidad: 'BAJA',
      sujetoTituloENSR10: false,
    };
    const aportes = [
      aportado('solicitud-escrita'),
      aportado('certificado-tradicion'),
      pendiente('poder-apoderado'),
      pendiente('relacion-colindantes'),
      pendiente('planos-estructurales'),
      pendiente('estudio-suelos'),
    ];

    const resultado = evaluarCompletitud(tramite, aportes, contexto);

    expect(resultado.completo).toBe(false);
    expect(resultado.faltantes.map((f) => f.requisitoId).sort()).toEqual(
      ['poder-apoderado', 'relacion-colindantes', 'planos-estructurales', 'estudio-suelos'].sort(),
    );
    expect(resultado.faltantes.every((f) => f.motivo === 'PENDIENTE_CONDICIONAL_APLICA')).toBe(true);
  });

  it('sin aporte alguno (aportes vacío) trata todos los aplicables como faltantes', () => {
    const tramite = tramiteLicencia();
    const contexto: ContextoEvaluacionRequisito = {
      esApoderado: false,
      predioRodeadoEspacioPublico: true,
      categoriaComplejidad: 'ALTA',
      sujetoTituloENSR10: true,
    };
    const resultado = evaluarCompletitud(tramite, [], contexto);
    expect(resultado.completo).toBe(false);
    expect(resultado.faltantes.map((f) => f.requisitoId).sort()).toEqual(
      ['solicitud-escrita', 'certificado-tradicion'].sort(),
    );
  });

  describe('FAIL-CLOSED — contexto incompleto (hallazgo MEDIO #1 del Arquitecto)', () => {
    it('contexto SIN la clave "esApoderado": el expediente NO es completo aunque todo lo demás esté aportado', () => {
      const tramite = tramiteLicencia();
      // Contexto deliberadamente incompleto: falta "esApoderado" (afecta a
      // poder-apoderado). El resto de claves sí están, para aislar el efecto.
      const contexto: ContextoEvaluacionRequisito = {
        predioRodeadoEspacioPublico: true,
        categoriaComplejidad: 'ALTA',
        sujetoTituloENSR10: true,
      };
      const aportes = [aportado('solicitud-escrita'), aportado('certificado-tradicion')];

      const resultado = evaluarCompletitud(tramite, aportes, contexto);

      expect(resultado.completo).toBe(false);
      // No aparece como "no aplicable" en silencio: aparece como indeterminado.
      expect(resultado.noAplicables).not.toContain('poder-apoderado');
      expect(resultado.faltantes).toEqual([]); // no es un "faltante" (no sabemos si aplica) — es otra categoría
      expect(resultado.indeterminados).toEqual([
        { requisitoId: 'poder-apoderado', nombre: 'Poder o autorización del apoderado', clavesFaltantes: ['esApoderado'] },
      ]);
    });

    it('contexto totalmente vacío: los 4 condicionales quedan indeterminados, ninguno "no aplicable"', () => {
      const tramite = tramiteLicencia();
      const aportes = [aportado('solicitud-escrita'), aportado('certificado-tradicion')];

      const resultado = evaluarCompletitud(tramite, aportes, {});

      expect(resultado.completo).toBe(false);
      expect(resultado.noAplicables).toEqual([]);
      expect(resultado.indeterminados.map((i) => i.requisitoId).sort()).toEqual(
        ['poder-apoderado', 'relacion-colindantes', 'planos-estructurales', 'estudio-suelos'].sort(),
      );
      for (const i of resultado.indeterminados) {
        expect(i.clavesFaltantes.length).toBeGreaterThan(0);
      }
    });

    it('un requisito indeterminado sigue bloqueando "completo" aunque no haya ningún faltante', () => {
      const tramite = tramiteLicencia();
      // Se aporta TODO lo que se puede aportar sin saber si poder-apoderado aplica.
      const aportes = [
        aportado('solicitud-escrita'),
        aportado('certificado-tradicion'),
        aportado('relacion-colindantes'),
        aportado('planos-estructurales'),
        aportado('estudio-suelos'),
      ];
      const contexto: ContextoEvaluacionRequisito = {
        predioRodeadoEspacioPublico: false,
        categoriaComplejidad: 'BAJA',
        sujetoTituloENSR10: false,
        // esApoderado: ausente a propósito
      };

      const resultado = evaluarCompletitud(tramite, aportes, contexto);

      expect(resultado.faltantes).toEqual([]);
      expect(resultado.indeterminados).toHaveLength(1);
      expect(resultado.completo).toBe(false);
    });
  });

  describe('defensa en profundidad — documento real (hallazgo MEDIO #2 del Arquitecto)', () => {
    it('un aporte APORTADO sin documentoIds NO cuenta como satisfecho', () => {
      const tramite = tramiteLicencia();
      const contexto: ContextoEvaluacionRequisito = {
        esApoderado: false,
        predioRodeadoEspacioPublico: true,
        categoriaComplejidad: 'ALTA',
        sujetoTituloENSR10: true,
      };
      const aportes: AporteRequisito[] = [
        { requisitoId: 'solicitud-escrita', estado: 'APORTADO', documentoIds: [] }, // flag en true, sin respaldo
        aportado('certificado-tradicion'),
      ];

      const resultado = evaluarCompletitud(tramite, aportes, contexto);

      expect(resultado.completo).toBe(false);
      expect(resultado.faltantes).toEqual([
        { requisitoId: 'solicitud-escrita', nombre: 'Solicitud escrita del titular', motivo: 'PENDIENTE_OBLIGATORIO' },
      ]);
    });

    it('con al menos un documentoId sí cuenta como satisfecho (caso normal, sin regresión)', () => {
      const tramite = tramiteLicencia();
      const contexto: ContextoEvaluacionRequisito = {
        esApoderado: false,
        predioRodeadoEspacioPublico: true,
        categoriaComplejidad: 'ALTA',
        sujetoTituloENSR10: true,
      };
      const aportes: AporteRequisito[] = [
        { requisitoId: 'solicitud-escrita', estado: 'APORTADO', documentoIds: ['doc-1'] },
        aportado('certificado-tradicion'),
      ];

      const resultado = evaluarCompletitud(tramite, aportes, contexto);

      expect(resultado.completo).toBe(true);
    });
  });
});
