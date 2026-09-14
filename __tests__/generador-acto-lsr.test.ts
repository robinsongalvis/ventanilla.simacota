import { describe, expect, it } from 'vitest';
import {
  generarActoLsr, renderTextoActo, type ActoLsrGenerado,
} from '@/lib/motor-expedientes/acto-lsr/generar-acto-lsr';
import { datosVacios, type DatosActoLsr } from '@/lib/motor-expedientes/acto-lsr/datos-acto-lsr';
import {
  DECISIONES_PENDIENTES, SIN_DECIDIR, decisionesQueFaltan, type ParametrosDelActo,
} from '@/lib/motor-expedientes/acto-lsr/decisiones-pendientes';
import {
  RANGOS_UAF, ZONA_UAF_POR_VEREDA, smdlvDeLaLicencia, uafDeLaVereda,
  vencimientoDeLaLicencia, requiereExcepcionUaf, MESES_VIGENCIA_LSR,
} from '@/lib/motor-expedientes/acto-lsr/reglas-acto-lsr';
import {
  impedimentosParaGenerar, datosDesdeExpediente, type ExpedienteParaActo,
} from '@/lib/motor-expedientes/acto-lsr/desde-expediente';
import { ARTICULOS_FIJOS, ENCABEZADO_F_PGJ_002 } from '@/lib/motor-expedientes/acto-lsr/estructura-f-pgj-002';

/* ══════════════════════════════════════════════════════════════
   EL GENERADOR DEL F-PGJ-002 — construido hasta el borde de lo que no decide.

   El acto que entregó el ingeniero (RESOLUCIÓN LSR No. 001 DE 2.025) es el
   modelo. De él salen las partes estructurales, las reglas y la lista de datos
   dinámicos. Cuatro cosas NO salen de él porque el documento real y la norma
   se contradicen, o porque el formato no está estabilizado: la serie del acto,
   el formato del número, el texto de recursos y desde cuándo corre la vigencia.

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: que el generador NO invente ninguna de las cuatro; que se niegue
   a dar por expedible un acto incompleto; que las reglas de negocio calculen
   lo que dice el acto real; y que el flujo previo impida generar sobre un
   expediente que no está en condiciones.

   Esto NO MIRA: la maquetación ni el renderizado a PDF/Word (no existe aún),
   ni la emisión del consecutivo (no se toca hasta que Planeación decida), ni
   los datos de las personas del acto real —que no entran al repositorio—.
══════════════════════════════════════════════════════════════ */

/** Un expediente de subdivisión con todo lo que el acto real trae, sin PII. */
function datosCompletos(): DatosActoLsr {
  const d = datosVacios();
  d.nombrePredio = 'EL MIRADOR';
  d.vereda = 'Vereda de prueba';
  d.matriculaInmobiliaria = '321-99999';
  d.areaTotalTexto = '6 has 3100 M2';
  d.titulares = [{ nombre: 'TITULAR UNO', documento: 'C.C. 1' }, { nombre: 'TITULAR DOS', documento: 'C.C. 2' }];
  d.profesional = { nombre: 'PROFESIONAL DE PRUEBA', clase: 'TOPOGRAFO', matricula: 'L.P. No. 00-0000' };
  d.escritura = { numero: '255', fecha: '2022-02-14T12:00:00.000Z', notaria: 'Notaría Primera', circulo: 'Barrancabermeja' };
  d.lotes = [
    { numero: 1, propietario: 'TITULAR UNO', areaTexto: '1 HA 5775.0 M2', destino: 'Cítricos asociados con plátano.', accesibilidad: 'Carreteable privado.' },
    { numero: 2, propietario: 'TITULAR DOS', areaTexto: '1 HA 5775.0 M2', destino: 'Cítricos asociados con plátano.', accesibilidad: 'Carreteable privado.' },
    { numero: 3, propietario: 'TITULAR UNO', areaTexto: '3 HAS 1550.0 M2', destino: 'Cacao asociado con plátano.', accesibilidad: 'Carreteable privado.' },
  ];
  d.referenciaPagoExpensas = 'M1 00-00000';
  d.fechas = { expedicion: '2025-01-02T12:00:00.000Z', publicacionEdicto: '2025-01-02T12:00:00.000Z', notificacionPersonal: '2025-01-03T12:00:00.000Z', firmeza: '2025-01-20T12:00:00.000Z' };
  d.firmantes = { secretario: { nombre: 'SECRETARIO DE PRUEBA', cargo: 'Secretario de Planeación e Infraestructura' }, notificador: { nombre: 'NOTIFICADOR DE PRUEBA', cargo: 'Subsecretario' } };
  return d;
}

const TODO_DECIDIDO: ParametrosDelActo = {
  numeroResolucion: '001 DE 2.025',
  textoRecursos: 'Texto de recursos pendiente de Jurídica — valor de prueba.',
  origenVigencia: 'EXPEDICION',
};

const textoDe = (a: ActoLsrGenerado) => renderTextoActo(a);
const bloqueantes = (a: ActoLsrGenerado) => a.hallazgos.filter((h) => h.nivel === 'BLOQUEANTE');

describe('el generador NO toma ninguna de las cuatro decisiones', () => {
  it('sin parámetros, las cuatro salen como bloqueantes', () => {
    const acto = generarActoLsr(datosCompletos(), SIN_DECIDIR);
    const ids = decisionesQueFaltan(SIN_DECIDIR).map((d) => d.id);
    expect(ids).toEqual(['SERIE_DEL_ACTO', 'FORMATO_DEL_NUMERO', 'TEXTO_RECURSOS', 'ORIGEN_VIGENCIA']);
    expect(acto.puedeExpedirse).toBe(false);
  });

  it('NUNCA inventa un número de resolución', () => {
    /* El daño concreto: un acto administrativo con un número que no salió de
       ninguna serie. Aquí se comprueba que donde iría el número hay un hueco
       nombrado, no algo verosímil. */
    const acto = generarActoLsr(datosCompletos(), SIN_DECIDIR);
    const texto = textoDe(acto);
    expect(texto).toContain('FALTA: El número de la resolución');
    expect(texto, 'apareció un número de resolución que nadie emitió').not.toMatch(/RESOLUCIÓN LSR No\.\s*\d/);
  });

  it('NUNCA escribe un texto de recursos por su cuenta', () => {
    /* El acto real dice «reposición y apelación»; el sistema redacta «solo
       reposición» en el desistimiento. Elegir uno vicia la notificación. */
    const acto = generarActoLsr(datosCompletos(), { ...TODO_DECIDIDO, textoRecursos: null });
    const texto = textoDe(acto);
    expect(texto).toContain('FALTA: El texto de los recursos');
    expect(texto).not.toMatch(/reposición/i);
    expect(texto).not.toMatch(/apelación/i);
  });

  it('NUNCA fija desde cuándo corre la vigencia', () => {
    const acto = generarActoLsr(datosCompletos(), { ...TODO_DECIDIDO, origenVigencia: null });
    expect(textoDe(acto)).toContain('FALTA: Desde cuándo corren los 12 meses');
    expect(acto.calculado.vencimientoVigencia, 'proyectó un vencimiento sin saber desde cuándo cuenta').toBeNull();
    /* El plazo SÍ se escribe: son 12 meses y eso está verificado contra la
       norma y contra el acto real. Lo que falta es el ancla, no el número. */
    expect(textoDe(acto)).toMatch(/doce \(12\) meses/);
  });

  it('cada decisión declara quién la resuelve y qué bloquea', () => {
    for (const d of DECISIONES_PENDIENTES) {
      expect(d.pregunta.length, `${d.id} sin pregunta`).toBeGreaterThan(20);
      expect(d.evidencia.length, `${d.id} sin evidencia`).toBeGreaterThan(40);
      expect(['PLANEACION', 'JURIDICA', 'PLANEACION_O_JURIDICA']).toContain(d.decide);
    }
  });
});

describe('no se expide un acto incompleto', () => {
  it('con datos vacíos, cada campo obligatorio sale nombrado y con su porqué', () => {
    const acto = generarActoLsr(datosVacios(), TODO_DECIDIDO);
    expect(acto.puedeExpedirse).toBe(false);
    const nombres = bloqueantes(acto).map((h) => h.queFalta);
    for (const esperado of ['Nombre del predio', 'Vereda', 'Matrícula inmobiliaria', 'Titulares de la licencia', 'Lotes resultantes', 'Firmantes']) {
      expect(nombres, `no reclamó «${esperado}»`).toContain(esperado);
    }
    expect(bloqueantes(acto).every((h) => h.porQue.length > 20)).toBe(true);
  });

  it('con todo completo y todo decidido, SÍ se puede expedir', () => {
    /* La prueba en positivo: si nunca pudiera expedirse, las negativas de
       arriba pasarían por el motivo equivocado. Hace falta cargar la zona UAF,
       que es la única regla que el repositorio no puede rellenar solo. */
    const conZona = { ...ZONA_UAF_POR_VEREDA, 'vereda de prueba': 'MAGDALENA_MEDIO' as const };
    const datos = datosCompletos();
    const acto = generarActoLsrConZonas(datos, TODO_DECIDIDO, conZona);
    expect(acto.hallazgos.filter((h) => h.nivel === 'BLOQUEANTE').map((h) => h.queFalta)).toEqual([]);
    expect(acto.puedeExpedirse).toBe(true);
  });

  it('sin zona de UAF cargada, se niega — y explica por qué no la deduce', () => {
    const acto = generarActoLsr(datosCompletos(), TODO_DECIDIDO);
    const uaf = bloqueantes(acto).find((h) => h.queFalta.includes('Unidad Agrícola Familiar'));
    expect(uaf, 'generó sin saber qué UAF aplica').toBeDefined();
    expect(uaf!.porQue).toMatch(/no se deduce del nombre/);
  });
});

/* El reparto de veredas por zona es un dato de Planeación; para probar el
   camino completo se inyecta uno de mentira sin tocar el módulo real. */
function generarActoLsrConZonas(
  datos: DatosActoLsr,
  parametros: ParametrosDelActo,
  zonas: Record<string, 'MAGDALENA_MEDIO' | 'GUANENTA'>,
): ActoLsrGenerado {
  const original = { ...ZONA_UAF_POR_VEREDA };
  Object.assign(ZONA_UAF_POR_VEREDA as Record<string, string>, zonas);
  try {
    return generarActoLsr(datos, parametros);
  } finally {
    for (const k of Object.keys(zonas)) delete (ZONA_UAF_POR_VEREDA as Record<string, string>)[k];
    Object.assign(ZONA_UAF_POR_VEREDA as Record<string, string>, original);
  }
}

describe('las reglas de negocio, contrastadas contra el acto real', () => {
  it('las expensas salen de la cantidad de lotes, no de un número escrito a mano', () => {
    /* Acuerdo 026/2020 art. 194 ítem 10: cinco S.M.D.L.V. por lote. En el acto
       real ese número va a mano y nada lo contrasta contra el cuadro de áreas. */
    expect(smdlvDeLaLicencia(3)).toBe(15);
    expect(smdlvDeLaLicencia(0)).toBe(0);
    expect(generarActoLsr(datosCompletos(), TODO_DECIDIDO).calculado.smdlv).toBe(15);
  });

  it('la vigencia reproduce la del acto real: 12 meses menos un día', () => {
    /* Expedida el 02-ene-2025, vence el 01-ene-2026 según el libro. */
    expect(MESES_VIGENCIA_LSR).toBe(12);
    expect(vencimientoDeLaLicencia('2025-01-02T12:00:00.000Z').slice(0, 10)).toBe('2026-01-01');
  });

  it('las dos zonas de UAF son las que cita el acto', () => {
    expect(RANGOS_UAF.MAGDALENA_MEDIO.desdeHas).toBe(50);
    expect(RANGOS_UAF.MAGDALENA_MEDIO.hastaHas).toBe(68);
    expect(RANGOS_UAF.GUANENTA.desdeHas).toBe(8);
    expect(RANGOS_UAF.GUANENTA.hastaHas).toBe(10);
  });

  it('el reparto de veredas por zona está VACÍO a propósito', () => {
    /* Si alguien lo rellena «por parecido de nombre», este custodio se pone
       rojo y obliga a decir de dónde salió el dato. En el acto real, un predio
       en una vereda llamada «Alta» va por Magdalena Medio. */
    expect(Object.keys(ZONA_UAF_POR_VEREDA)).toEqual([]);
    expect(uafDeLaVereda('Vizcaína Alta')).toBeNull();
  });

  it('por debajo del mínimo de la UAF hace falta la excepción del art. 45 literal C', () => {
    expect(requiereExcepcionUaf([1.57, 1.57, 3.15], RANGOS_UAF.MAGDALENA_MEDIO)).toBe(true);
    expect(requiereExcepcionUaf([60, 55], RANGOS_UAF.MAGDALENA_MEDIO)).toBe(false);
  });
});

describe('lo estructural viene del formato real', () => {
  it('el encabezado es el F-PGJ-002 versión 02', () => {
    expect(ENCABEZADO_F_PGJ_002.codigo).toBe('F-PGJ-002');
    expect(ENCABEZADO_F_PGJ_002.version).toBe('02');
  });

  it('los artículos fijos no llevan ningún dato del expediente', () => {
    /* Si un artículo «fijo» trajera un nombre o una fecha, se copiaría igual en
       todos los actos. La prueba busca los huecos de plantilla que delatarían
       ese error. */
    for (const a of ARTICULOS_FIJOS) {
      expect(a.texto, `el artículo ${a.nombre} lleva un hueco de plantilla`).not.toMatch(/\[.*\]|\{\{|\$\{/);
    }
  });

  it('los artículos salen en orden, y los huecos en el sitio del artículo que falta', () => {
    const acto = generarActoLsr(datosCompletos(), SIN_DECIDIR);
    const ordinales = acto.bloques.filter((b) => b.clase === 'ARTICULO').map((b) => (b as { ordinal: number }).ordinal);
    expect(ordinales).toEqual([...ordinales].sort((a, b) => a - b));
  });
});

describe('el flujo previo impide generar sobre un expediente que no está listo', () => {
  const base: ExpedienteParaActo = {
    id: 'exp-1',
    estadoJuridico: 'EN_VIABILIDAD',
    subtipos: ['SUBDIVISION_RURAL'],
    numeroExpediente: { numero: '68745-0-26-0021', serieId: 'expedientes' },
    numeroRadicadoEntrada: '1-110-202609-00000041',
    completitud: { faltantes: [] },
    fechaRadicacionDebidaForma: '2026-09-01T12:00:00.000Z',
  };

  it('un expediente listo no tiene impedimentos', () => {
    expect(impedimentosParaGenerar(base)).toEqual([]);
  });

  const casos: [string, Record<string, unknown>, string][] = [
    ['en revisión todavía', { estadoJuridico: 'EN_REVISION' }, 'ESTADO_NO_PERMITE_RESOLVER'],
    ['sin radicación en debida forma', { fechaRadicacionDebidaForma: null }, 'SIN_RADICACION_EN_DEBIDA_FORMA'],
    ['con requisitos faltantes', { completitud: { faltantes: ['Plano'] } }, 'DOCUMENTACION_INCOMPLETA'],
    ['con la completitud sin evaluar', { completitud: undefined }, 'COMPLETITUD_SIN_EVALUAR'],
    ['marcado como prueba', { esPrueba: true }, 'EXPEDIENTE_DE_PRUEBA'],
    ['con número de demostración', { numeroExpediente: { numero: 'DEMO-26-a1', serieId: 'demo' } }, 'SIN_NUMERO_LEGAL'],
    ['sin número de expediente', { numeroExpediente: null }, 'SIN_NUMERO_LEGAL'],
    ['sin radicado de entrada', { numeroRadicadoEntrada: null, radicadoId: null }, 'SIN_RADICADO_DE_ENTRADA'],
    ['de otra figura', { subtipos: ['CONSTRUCCION'] }, 'NO_ES_SUBDIVISION'],
  ];

  for (const [nombre, cambio, codigo] of casos) {
    it(`lo impide: ${nombre}`, () => {
      const codigos = impedimentosParaGenerar({ ...base, ...cambio } as ExpedienteParaActo).map((i) => i.codigo);
      expect(codigos).toContain(codigo);
    });
  }

  it('«sin evaluar» NO se trata como «completa»', () => {
    /* La misma distinción que ya custodia la proyección de ventanilla: decir
       que una solicitud está completa cuando nadie la miró es peor que callar. */
    const codigos = impedimentosParaGenerar({ ...base, completitud: undefined }).map((i) => i.codigo);
    expect(codigos).toContain('COMPLETITUD_SIN_EVALUAR');
    expect(codigos).not.toContain('DOCUMENTACION_INCOMPLETA');
  });
});

describe('lo que el expediente todavía no puede dar', () => {
  it('vuelca lo que tiene y deja en null lo que no', () => {
    const datos = datosDesdeExpediente({
      id: 'exp-1',
      estadoJuridico: 'EN_VIABILIDAD',
      solicitanteNombre: 'TITULAR UNO',
      solicitanteDocumento: 'C.C. 1',
      predio: { barrioVereda: 'Vereda de prueba', matriculaInmobiliaria: '321-99999', areaTexto: '6 has 3100 M2' },
    });
    expect(datos.vereda).toBe('Vereda de prueba');
    expect(datos.titulares).toHaveLength(1);
    /* Lo que NO existe en el sistema queda vacío, nunca inventado. */
    expect(datos.nombrePredio).toBeNull();
    expect(datos.escritura).toBeNull();
    expect(datos.profesional).toBeNull();
    expect(datos.lotes).toEqual([]);
    expect(datos.referenciaPagoExpensas).toBeNull();
  });

  it('un expediente real de hoy NO alcanza para expedir, y el acto lo enumera', () => {
    /* Este es el informe de trabajo del intake, ejecutado en vez de escrito. */
    const datos = datosDesdeExpediente({
      id: 'exp-1', estadoJuridico: 'EN_VIABILIDAD',
      solicitanteNombre: 'TITULAR UNO', solicitanteDocumento: 'C.C. 1',
      predio: { barrioVereda: 'Vereda de prueba', matriculaInmobiliaria: '321-99999', areaTexto: '6 has 3100 M2' },
    });
    const acto = generarActoLsr(datos, TODO_DECIDIDO);
    expect(acto.puedeExpedirse).toBe(false);
    expect(bloqueantes(acto).length).toBeGreaterThanOrEqual(5);
  });
});
