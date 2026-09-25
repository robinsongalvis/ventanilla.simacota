/**
 * Fase 1 del motor de expedientes — validador de la Definición de Trámite
 * (D4, ADR-0026 §A2 #4).
 *
 * Fixtures DELIBERADAMENTE GENÉRICOS (trámite ficticio "Trámite Genérico de
 * Prueba", claves de contexto inventadas para el test): esta suite valida el
 * MECANISMO estructural del validador, no ninguna regla de negocio de
 * Licencia de Construcción ni de ningún trámite real.
 *
 * Puro — sin Firestore, sin fechas de servidor.
 */
import { describe, it, expect } from 'vitest';
import {
  PROFUNDIDAD_MAXIMA_CONDICION,
  validarDefinicionTramite,
} from '@/lib/motor-expedientes/validar-definicion';
import type {
  ClaveContextoDeclarada,
  CondicionRequisito,
  DefinicionTramite,
  RequisitoDefinicion,
} from '@/lib/motor-expedientes/tipos';

const CLAVES_BASE: ClaveContextoDeclarada[] = [
  { nombre: 'esRepresentante', tipo: 'boolean' },
  { nombre: 'categoria', tipo: 'string', dominio: ['A', 'B', 'C'] },
  { nombre: 'puntaje', tipo: 'number' },
];

/** Definición base válida y mínima: un solo requisito OBLIGATORIO, sin condicionales. Punto de partida para mutar en cada caso de prueba. */
function definicionBase(overrides: Partial<DefinicionTramite> = {}): DefinicionTramite {
  return {
    id: 'tramite-generico-prueba',
    nombre: 'Trámite Genérico de Prueba',
    activo: true,
    terminos: { dias: 10, unidad: 'HABILES' },
    regimenSubsanacion: {
      dias: 5,
      unidad: 'HABILES',
      prorrogaDias: 5,
      ventanaRequerimiento: { dias: 3, unidad: 'HABILES' },
    },
    requiereVisita: false,
    generaResolucion: false,
    clavesContexto: CLAVES_BASE,
    requisitos: [{ id: 'doc-base', nombre: 'Documento base', tipo: 'OBLIGATORIO' }],
    ...overrides,
  };
}

function requisitoCondicional(id: string, condicion: CondicionRequisito): RequisitoDefinicion {
  return { id, nombre: `Requisito ${id}`, tipo: 'CONDICIONAL', condicion };
}

describe('validarDefinicionTramite — Definición válida', () => {
  it('una Definición bien formada, sin condicionales, es válida', () => {
    const resultado = validarDefinicionTramite(definicionBase());
    expect(resultado).toEqual({ valida: true, errores: [] });
  });

  it('una Definición donde algunas clavesContexto declaran pregunta/ayuda/efecto y otras no es válida (opcionalidad aditiva)', () => {
    const definicion = definicionBase({
      clavesContexto: [
        {
          nombre: 'esRepresentante',
          tipo: 'boolean',
          pregunta: '¿Actúa como representante?',
          ayuda: 'Marque "Sí" si quien radica no es el titular.',
          efecto: 'Si responde "Sí", se exige el poder.',
        },
        { nombre: 'categoria', tipo: 'string', dominio: ['A', 'B', 'C'] },
        { nombre: 'puntaje', tipo: 'number' },
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado).toEqual({ valida: true, errores: [] });
  });

  it('una Definición con condicionales correctamente declaradas y coherentes es válida', () => {
    const definicion = definicionBase({
      requisitos: [
        { id: 'doc-base', nombre: 'Documento base', tipo: 'OBLIGATORIO' },
        requisitoCondicional('req-representante', { operador: 'IGUAL', clave: 'esRepresentante', valor: true }),
        requisitoCondicional('req-categoria', { operador: 'EN', clave: 'categoria', valores: ['A', 'B'] }),
        requisitoCondicional('req-compuesto', {
          operador: 'Y',
          condiciones: [
            { operador: 'IGUAL', clave: 'esRepresentante', valor: false },
            { operador: 'DISTINTO', clave: 'categoria', valor: 'C' },
          ],
        }),
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado).toEqual({ valida: true, errores: [] });
  });
});

describe('validarDefinicionTramite — (a) condición Y/O vacía (H1)', () => {
  it('rechaza una condición "Y" con condiciones: [] (veredicto vacuo: siempre CUMPLE)', () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-y-vacio', { operador: 'Y', condiciones: [] })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'CONDICION_VACIA', requisitoId: 'req-y-vacio' }),
    ]);
  });

  it('rechaza una condición "O" con condiciones: [] (veredicto vacuo: nunca CUMPLE)', () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-o-vacio', { operador: 'O', condiciones: [] })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'CONDICION_VACIA', requisitoId: 'req-o-vacio' }),
    ]);
  });

  it('rechaza una condición Y/O vacía anidada dentro de un árbol por lo demás válido', () => {
    const definicion = definicionBase({
      requisitos: [
        requisitoCondicional('req-anidado', {
          operador: 'Y',
          condiciones: [
            { operador: 'IGUAL', clave: 'esRepresentante', valor: true },
            { operador: 'O', condiciones: [] },
          ],
        }),
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'CONDICION_VACIA', requisitoId: 'req-anidado' }),
    ]);
  });
});

describe("validarDefinicionTramite — (a') EN con valores vacíos (GEMELO de H1)", () => {
  it('rechaza una condición "EN" con valores: [] (veredicto: nunca aplica, en silencio)', () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-en-vacio', { operador: 'EN', clave: 'categoria', valores: [] })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'VALORES_VACIOS', requisitoId: 'req-en-vacio' }),
    ]);
  });

  it('rechaza un "EN" vacío anidado dentro de un árbol por lo demás válido', () => {
    const definicion = definicionBase({
      requisitos: [
        requisitoCondicional('req-en-vacio-anidado', {
          operador: 'Y',
          condiciones: [
            { operador: 'IGUAL', clave: 'esRepresentante', valor: true },
            { operador: 'EN', clave: 'categoria', valores: [] },
          ],
        }),
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'VALORES_VACIOS', requisitoId: 'req-en-vacio-anidado' }),
    ]);
  });

  it('acepta una condición "EN" con al menos un valor', () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-en-ok', { operador: 'EN', clave: 'categoria', valores: ['A'] })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(true);
  });
});

describe('validarDefinicionTramite — (b) clave no declarada (typo indistinguible de hecho ausente)', () => {
  it('rechaza una condición que referencia una clave no declarada en clavesContexto', () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-typo', { operador: 'IGUAL', clave: 'esRepresentente', valor: true })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'CLAVE_NO_DECLARADA', requisitoId: 'req-typo' }),
    ]);
  });

  it('reporta cada clave no declarada distinta referenciada por el árbol', () => {
    const definicion = definicionBase({
      requisitos: [
        requisitoCondicional('req-doble-typo', {
          operador: 'Y',
          condiciones: [
            { operador: 'IGUAL', clave: 'noExiste1', valor: true },
            { operador: 'IGUAL', clave: 'noExiste2', valor: true },
          ],
        }),
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores.filter((e) => e.codigo === 'CLAVE_NO_DECLARADA')).toHaveLength(2);
  });

  it('una Definición SIN clavesContexto rechaza cualquier condición (catálogo ausente no es "todo vale")', () => {
    const definicion = definicionBase({
      clavesContexto: undefined,
      requisitos: [requisitoCondicional('req-sin-catalogo', { operador: 'IGUAL', clave: 'esRepresentante', valor: true })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'CLAVE_NO_DECLARADA', requisitoId: 'req-sin-catalogo' }),
    ]);
  });

  it('reporta la MISMA clave no declarada una sola vez aunque el árbol la referencie varias veces', () => {
    const definicion = definicionBase({
      requisitos: [
        requisitoCondicional('req-clave-repetida', {
          operador: 'Y',
          condiciones: [
            { operador: 'IGUAL', clave: 'claveFantasma', valor: true },
            { operador: 'DISTINTO', clave: 'claveFantasma', valor: false },
            { operador: 'EN', clave: 'claveFantasma', valores: ['x'] },
          ],
        }),
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'CLAVE_NO_DECLARADA', requisitoId: 'req-clave-repetida' }),
    ]);
  });
});

describe("validarDefinicionTramite — (b') nombre de clave duplicado en clavesContexto (GEMELO de H2)", () => {
  it('rechaza clavesContexto con el mismo nombre declarado dos veces', () => {
    const definicion = definicionBase({
      clavesContexto: [
        { nombre: 'esRepresentante', tipo: 'boolean' },
        { nombre: 'esRepresentante', tipo: 'string' },
      ],
      requisitos: [{ id: 'doc-base', nombre: 'Documento base', tipo: 'OBLIGATORIO' }],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([expect.objectContaining({ codigo: 'CLAVE_DUPLICADA' })]);
  });

  it('reporta un nombre de clave duplicado una sola vez aunque aparezca 3 o más veces', () => {
    const definicion = definicionBase({
      clavesContexto: [
        { nombre: 'triple', tipo: 'string' },
        { nombre: 'triple', tipo: 'string' },
        { nombre: 'triple', tipo: 'string' },
      ],
      requisitos: [{ id: 'doc-base', nombre: 'Documento base', tipo: 'OBLIGATORIO' }],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.errores.filter((e) => e.codigo === 'CLAVE_DUPLICADA')).toHaveLength(1);
  });

  it('acepta clavesContexto con nombres todos distintos', () => {
    const definicion = definicionBase({
      requisitos: [{ id: 'doc-base', nombre: 'Documento base', tipo: 'OBLIGATORIO' }],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(true);
  });
});

describe('validarDefinicionTramite — (c) profundidad de anidamiento excedida', () => {
  /** Construye `NO(NO(...NO(IGUAL)))` con `n` niveles de `NO` anidados. */
  function condicionAnidada(n: number): CondicionRequisito {
    let condicion: CondicionRequisito = { operador: 'IGUAL', clave: 'esRepresentante', valor: true };
    for (let i = 0; i < n; i++) {
      condicion = { operador: 'NO', condicion };
    }
    return condicion;
  }

  it(`acepta una condición anidada exactamente en el límite (${PROFUNDIDAD_MAXIMA_CONDICION} niveles)`, () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-limite', condicionAnidada(PROFUNDIDAD_MAXIMA_CONDICION - 1))],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(true);
  });

  it(`rechaza una condición que excede la profundidad máxima (${PROFUNDIDAD_MAXIMA_CONDICION} niveles)`, () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-excedido', condicionAnidada(PROFUNDIDAD_MAXIMA_CONDICION + 5))],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'PROFUNDIDAD_EXCEDIDA', requisitoId: 'req-excedido' }),
    ]);
  });
});

describe('validarDefinicionTramite — (d) id de requisito duplicado', () => {
  it('rechaza dos requisitos con el mismo id', () => {
    const definicion = definicionBase({
      requisitos: [
        { id: 'doc-repetido', nombre: 'Primero', tipo: 'OBLIGATORIO' },
        { id: 'doc-repetido', nombre: 'Segundo', tipo: 'OPCIONAL' },
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'REQUISITO_ID_DUPLICADO', requisitoId: 'doc-repetido' }),
    ]);
  });

  it('reporta un id duplicado una sola vez aunque aparezca 3 o más veces', () => {
    const definicion = definicionBase({
      requisitos: [
        { id: 'doc-triple', nombre: 'Uno', tipo: 'OBLIGATORIO' },
        { id: 'doc-triple', nombre: 'Dos', tipo: 'OPCIONAL' },
        { id: 'doc-triple', nombre: 'Tres', tipo: 'OPCIONAL' },
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.errores.filter((e) => e.codigo === 'REQUISITO_ID_DUPLICADO')).toHaveLength(1);
  });
});

describe('validarDefinicionTramite — (e) tipo/valor incoherente con la clave declarada', () => {
  it('rechaza IGUAL con un valor de tipo distinto al declarado (string contra clave boolean)', () => {
    const definicion = definicionBase({
      requisitos: [
        requisitoCondicional('req-tipo-malo', { operador: 'IGUAL', clave: 'esRepresentante', valor: 'true' as unknown as boolean }),
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'TIPO_INCOHERENTE', requisitoId: 'req-tipo-malo' }),
    ]);
  });

  it('rechaza EN con un valor de tipo distinto al declarado dentro del arreglo', () => {
    const definicion = definicionBase({
      requisitos: [
        requisitoCondicional('req-en-malo', {
          operador: 'EN',
          clave: 'puntaje',
          valores: [1, 2, 'tres' as unknown as number],
        }),
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'TIPO_INCOHERENTE', requisitoId: 'req-en-malo' }),
    ]);
  });

  it('rechaza un valor de tipo correcto pero fuera del dominio declarado', () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-fuera-dominio', { operador: 'IGUAL', clave: 'categoria', valor: 'Z' })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([
      expect.objectContaining({ codigo: 'VALOR_FUERA_DE_DOMINIO', requisitoId: 'req-fuera-dominio' }),
    ]);
  });

  it('acepta un valor de tipo correcto y dentro del dominio declarado', () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-dominio-ok', { operador: 'IGUAL', clave: 'categoria', valor: 'B' })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(true);
  });

  it('no reporta incoherencia de tipo para una clave que ya se reportó como no declarada (evita doble error)', () => {
    const definicion = definicionBase({
      requisitos: [requisitoCondicional('req-typo-y-tipo', { operador: 'IGUAL', clave: 'noDeclarada', valor: 123 })],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.errores).toHaveLength(1);
    expect(resultado.errores[0]).toEqual(expect.objectContaining({ codigo: 'CLAVE_NO_DECLARADA' }));
  });
});

describe('validarDefinicionTramite — (f) dominio del catálogo incoherente con el tipo declarado', () => {
  it('rechaza una clave cuyo dominio contiene un valor de tipo distinto al declarado', () => {
    const definicion = definicionBase({
      clavesContexto: [{ nombre: 'categoria', tipo: 'string', dominio: ['A', 'B', 1 as unknown as string] }],
      requisitos: [{ id: 'doc-base', nombre: 'Documento base', tipo: 'OBLIGATORIO' }],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([expect.objectContaining({ codigo: 'DOMINIO_TIPO_INCOHERENTE' })]);
  });

  it('reporta el dominio incoherente del catálogo aunque ninguna condición referencie esa clave', () => {
    const definicion = definicionBase({
      clavesContexto: [{ nombre: 'sinUso', tipo: 'boolean', dominio: ['si' as unknown as boolean] }],
      requisitos: [{ id: 'doc-base', nombre: 'Documento base', tipo: 'OBLIGATORIO' }],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    expect(resultado.errores).toEqual([expect.objectContaining({ codigo: 'DOMINIO_TIPO_INCOHERENTE' })]);
  });

  it('acepta un dominio cuyos valores son todos del tipo declarado', () => {
    const resultado = validarDefinicionTramite(definicionBase());
    expect(resultado.valida).toBe(true);
  });
});

describe('validarDefinicionTramite — acumulación de errores independientes', () => {
  it('reporta TODOS los errores encontrados, no solo el primero', () => {
    const definicion = definicionBase({
      requisitos: [
        { id: 'doc-dup', nombre: 'A', tipo: 'OBLIGATORIO' },
        { id: 'doc-dup', nombre: 'B', tipo: 'OPCIONAL' },
        requisitoCondicional('req-vacio', { operador: 'Y', condiciones: [] }),
        requisitoCondicional('req-typo', { operador: 'IGUAL', clave: 'claveInexistente', valor: true }),
      ],
    });

    const resultado = validarDefinicionTramite(definicion);

    expect(resultado.valida).toBe(false);
    const codigos = resultado.errores.map((e) => e.codigo).sort();
    expect(codigos).toEqual(['CLAVE_NO_DECLARADA', 'CONDICION_VACIA', 'REQUISITO_ID_DUPLICADO'].sort());
  });
});
