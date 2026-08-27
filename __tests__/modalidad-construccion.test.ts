import { describe, it, expect } from 'vitest';
import {
  FIGURA_CON_MODALIDAD,
  exigeModalidadConstruccion,
  validarModalidadesConstruccion,
  describirModalidades,
} from '@/lib/motor-expedientes/modalidad-construccion';
import {
  MODALIDADES_CONSTRUCCION,
  CATALOGO_FIGURAS_NORMATIVAS,
} from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { planCrearExpedienteDemo } from '@/lib/server/expedientes-licencias';

/**
 * La MODALIDAD de construcción, capturada por fin como dato.
 *
 * Prerequisito de la matriz de requisitos por modalidad: sin este campo, la
 * matriz no tiene contra qué aplicarse. Lo que estas pruebas sostienen es la
 * frontera del campo — a qué figura pertenece, qué valores admite, y sobre
 * todo QUÉ PASA CUANDO NO ESTÁ, que es el caso de todos los expedientes
 * creados antes de que existiera.
 */

describe('a qué figura pertenece la pregunta', () => {
  it('la exige la construcción, y ninguna otra figura del catálogo', () => {
    expect(exigeModalidadConstruccion(['CONSTRUCCION'])).toBe(true);

    /* Las otras ocho NO la exigen — recorridas desde el catálogo, para que una
       figura nueva entre en esta prueba sin que nadie la añada a mano. */
    const otras = CATALOGO_FIGURAS_NORMATIVAS
      .map((f) => f.codigo)
      .filter((c) => c !== FIGURA_CON_MODALIDAD);
    for (const codigo of otras) {
      expect(exigeModalidadConstruccion([codigo]), `${codigo} no tiene eje de modalidad`).toBe(false);
    }
  });

  it('la subdivisión ya trae sus modalidades como figuras, y por eso no se pregunta', () => {
    /* Rural, urbana y reloteo están modeladas como tres FIGURAS agrupadas por
       `claseDe: 'SUBDIVISION'`. Preguntarle la modalidad a una subdivisión
       sería preguntar dos veces lo mismo. */
    const subdivisiones = CATALOGO_FIGURAS_NORMATIVAS.filter((f) => f.claseDe === 'SUBDIVISION');
    expect(subdivisiones.length).toBeGreaterThan(1);
    for (const f of subdivisiones) {
      expect(exigeModalidadConstruccion([f.codigo])).toBe(false);
    }
  });

  it('en una solicitud combinada basta con que la construcción esté', () => {
    expect(exigeModalidadConstruccion(['URBANIZACION', 'CONSTRUCCION'])).toBe(true);
  });
});

describe('qué valores admite', () => {
  it('las nueve del catálogo, todas', () => {
    for (const m of MODALIDADES_CONSTRUCCION) {
      expect(
        validarModalidadesConstruccion(['CONSTRUCCION'], [m.codigo]),
        `${m.codigo} está en el catálogo y debe admitirse`,
      ).toBeNull();
    }
  });

  it('varias a la vez: el art. 2.2.6.1.1.7 par. 1 permite combinarlas', () => {
    expect(validarModalidadesConstruccion(['CONSTRUCCION'], ['ampliacion', 'demolicion'])).toBeNull();
  });

  it('rechaza un código que el catálogo no declara', () => {
    const error = validarModalidadesConstruccion(['CONSTRUCCION'], ['obra-nuevita']);
    expect(error).toContain('obra-nuevita');
    expect(error, 'el mensaje dice dónde mirar').toMatch(/2\.2\.6\.1\.1\.7|catálogo/i);
  });

  it('rechaza una modalidad puesta en una figura que no la tiene', () => {
    const error = validarModalidadesConstruccion(['SUBDIVISION_RURAL'], ['demolicion']);
    expect(error).toMatch(/CONSTRUCCION/);
  });

  it('rechaza repetidas', () => {
    expect(validarModalidadesConstruccion(['CONSTRUCCION'], ['demolicion', 'demolicion']))
      .toMatch(/repetida/i);
  });
});

describe('la ausencia, que es el caso de todos los expedientes viejos', () => {
  it('no capturar NO es un error', () => {
    expect(validarModalidadesConstruccion(['CONSTRUCCION'], undefined)).toBeNull();
    expect(validarModalidadesConstruccion(['CONSTRUCCION'], [])).toBeNull();
  });

  it('describirModalidades devuelve null, no una cadena vacía', () => {
    /* `null` obliga al llamador a decidir qué dice ante la ausencia. Una cadena
       vacía se concatena sola y produce «licencia de construcción · » sin que
       nadie lo note. */
    expect(describirModalidades(undefined)).toBeNull();
    expect(describirModalidades([])).toBeNull();
  });

  it('el expediente NO nace con una modalidad por defecto', () => {
    const plan = planCrearExpedienteDemo(
      {
        solicitanteNombre: 'Ana Ruiz',
        solicitanteDocumento: '1098765432',
        subtipos: ['CONSTRUCCION'],
      },
      'SEC_PLANEACION',
      { uid: 'u1', nombre: 'Funcionaria', rol: 'FUNCIONARIO' },
      new Date('2026-08-27T12:00:00Z'),
    );
    const exp = 'expediente' in plan ? plan.expediente : null;
    expect(exp, 'el plan debía crearse').not.toBeNull();
    expect(
      exp?.modalidadesConstruccion,
      'sin capturar significa AUSENTE; rellenarlo con obra-nueva sería inventar el dato',
    ).toBeUndefined();
  });
});

describe('cómo se nombra', () => {
  it('una sola, por su nombre del catálogo', () => {
    expect(describirModalidades(['demolicion'])).toBe('demolición');
  });

  it('varias, todas — omitir una sería describir de menos', () => {
    const texto = describirModalidades(['ampliacion', 'demolicion']);
    expect(texto).toContain('ampliación');
    expect(texto).toContain('demolición');
  });

  it('un código desconocido se transcribe en vez de desaparecer', () => {
    expect(describirModalidades(['modalidad-historica-x'])).toContain('modalidad-historica-x');
  });
});
