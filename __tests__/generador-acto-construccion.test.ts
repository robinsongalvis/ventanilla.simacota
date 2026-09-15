import { describe, expect, it } from 'vitest';
import {
  generarActoConstruccion, renderTextoActoConstruccion,
} from '@/lib/motor-expedientes/acto-construccion/generar-acto-construccion';
import {
  datosVaciosConstruccion, type DatosActoConstruccion,
} from '@/lib/motor-expedientes/acto-construccion/datos-acto-construccion';
import {
  SIN_DECIDIR_CONSTRUCCION, pendientesQueFaltan, PENDIENTES_CONSTRUCCION,
  type ParametrosActoConstruccion,
} from '@/lib/motor-expedientes/acto-construccion/decisiones-pendientes-construccion';
import {
  vigenciaDeLaConstruccion, TARIFA_EXPENSAS_CONSTRUCCION,
  TERMINO_CONSTRUCCION, SUBSANACION_CONSTRUCCION,
} from '@/lib/motor-expedientes/acto-construccion/reglas-acto-construccion';
import {
  ESTADO_REQUISITOS_POR_MODALIDAD, requisitosDisponiblesPara,
} from '@/lib/motor-expedientes/acto-construccion/requisitos-por-modalidad';
import {
  impedimentosParaGenerarConstruccion, datosDesdeExpedienteConstruccion,
  CAMPOS_SIN_ORIGEN_CONSTRUCCION, type ExpedienteParaConstruccion,
} from '@/lib/motor-expedientes/acto-construccion/desde-expediente-construccion';
import { tramosPendientesDeFormato } from '@/lib/motor-expedientes/acto-construccion/estructura-acto-construccion';
import { MODALIDADES_CONSTRUCCION } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';

/* ══════════════════════════════════════════════════════════════
   EL GENERADOR DE LA RESOLUCIÓN DE CONSTRUCCIÓN — construido hasta el borde de
   un formato que Planeación todavía no ha entregado.

   A diferencia de subdivisión, no hay acto real que transcribir. Por eso lo
   estructural es la ARQUITECTURA del acto (sus tramos y su orden) con la prosa
   marcada como pendiente, y el generador NUNCA da un acto por expedible
   mientras falte el formato.

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: que el generador se niegue a expedir sin formato; que enumere lo
   que falta del expediente y de Planeación/Jurídica; que las reglas
   respaldadas (vigencia desde firmeza, término, subsanación) se reutilicen sin
   reescribirse; que las 9 modalidades queden separadas por estado; y que el
   informe de campos inexistentes sea completo.

   Esto NO MIRA: la maquetación ni el render a PDF/Word (no existe), ni la
   emisión del consecutivo (serie LC decidida, sin abrir), ni datos de personas
   reales (no entran al repositorio).
══════════════════════════════════════════════════════════════ */

/** Un expediente de construcción «tan completo como hoy se puede», sin PII. */
function datosCasiCompletos(): DatosActoConstruccion {
  const d = datosVaciosConstruccion();
  d.modalidades = ['obra-nueva'];
  d.nombrePredio = 'PREDIO DE PRUEBA';
  d.direccion = 'Calle de prueba 1-23';
  d.barrioVereda = 'Centro';
  d.matriculaInmobiliaria = '321-99999';
  d.areaPredioTexto = '300 m2';
  d.titulares = [{ nombre: 'TITULAR DE PRUEBA', documento: 'C.C. 1' }];
  d.profesional = { nombre: 'PROFESIONAL DE PRUEBA', clase: 'ARQUITECTO', matricula: 'A.P. No. 68-0000' };
  d.obra = { areaIntervenidaTexto: '120 m2', numeroPisos: 2, usoDestino: 'Vivienda', valorObraTexto: '$100.000.000', sistemaEstructural: 'Mampostería confinada' };
  d.referenciaPagoExpensas = 'M1 00-00000';
  d.fechas = { expedicion: '2026-09-15T12:00:00.000Z', notificacionPersonal: null, firmeza: '2026-10-01T12:00:00.000Z' };
  d.firmantes = { secretario: { nombre: 'SECRETARIO DE PRUEBA', cargo: 'Secretario de Planeación e Infraestructura' }, notificador: { nombre: 'NOTIFICADOR DE PRUEBA', cargo: 'Subsecretario' } };
  return d;
}

const CON_FORMATO: ParametrosActoConstruccion = {
  numeroResolucion: 'LC No. 009-2026',
  textoRecursos: 'Contra la presente Resolución procede únicamente el recurso de reposición.',
  formatoEntregado: true,
};

describe('El generador se niega a expedir mientras falte el formato', () => {
  it('sin formato NO es expedible, aunque el expediente esté completo', () => {
    const acto = generarActoConstruccion(datosCasiCompletos(), SIN_DECIDIR_CONSTRUCCION);
    expect(acto.puedeExpedirse).toBe(false);
    expect(acto.hallazgos.some((h) => h.nivel === 'BLOQUEANTE' && /formato/i.test(h.queFalta))).toBe(true);
  });

  it('el formato es condición NECESARIA: con datos completos pero sin formato, sigue sin poder expedirse', () => {
    // Datos completos + número + recursos, pero formatoEntregado:false.
    const acto = generarActoConstruccion(datosCasiCompletos(), { ...CON_FORMATO, formatoEntregado: false });
    expect(acto.puedeExpedirse).toBe(false);
    expect(acto.hallazgos.some((h) => /formato/i.test(h.queFalta))).toBe(true);
  });

  it('aun CON formato, hoy no es expedible: falta la tarifa de expensas de construcción', () => {
    const acto = generarActoConstruccion(datosCasiCompletos(), CON_FORMATO);
    expect(acto.puedeExpedirse).toBe(false);
    expect(acto.hallazgos.some((h) => h.nivel === 'BLOQUEANTE' && /expensas/i.test(h.queFalta))).toBe(true);
  });
});

describe('El generador enumera lo que falta del expediente', () => {
  it('un expediente vacío bloquea por cada campo obligatorio ausente', () => {
    const acto = generarActoConstruccion(datosVaciosConstruccion(), CON_FORMATO);
    const bloqueantes = acto.hallazgos.filter((h) => h.nivel === 'BLOQUEANTE').map((h) => h.queFalta);
    expect(bloqueantes).toContain('Modalidad(es) de la licencia');
    expect(bloqueantes).toContain('Área a construir / intervenir');
    expect(bloqueantes).toContain('Número de pisos');
    expect(bloqueantes).toContain('Titulares de la licencia');
  });

  it('el esqueleto vuelca los datos que el expediente SÍ tiene, y deja huecos rotulados donde faltan', () => {
    const acto = generarActoConstruccion(datosCasiCompletos(), CON_FORMATO);
    const datos = acto.esqueleto.filter((b) => b.clase === 'DATO');
    // El área a construir aparece como DATO colocado, no como hueco.
    expect(datos.some((b) => b.clase === 'DATO' && /120 m2/.test(b.valor))).toBe(true);
    // Y hay secciones del esqueleto presentes en orden.
    const secciones = acto.esqueleto.filter((b) => b.clase === 'SECCION').map((b) => b.clase === 'SECCION' && b.clave);
    expect(secciones).toContain('RESUELVE');
    expect(secciones).toContain('ARTICULO_RECURSOS');
  });
});

describe('Las modalidades sin requisitos verificados bloquean una resolución correcta', () => {
  it('una modalidad distinta de obra nueva bloquea por falta de requisitos', () => {
    const d = datosCasiCompletos();
    d.modalidades = ['demolicion'];
    const acto = generarActoConstruccion(d, CON_FORMATO);
    expect(acto.calculado.modalidadesSinRequisitos).toContain('demolicion');
    expect(acto.hallazgos.some((h) => h.nivel === 'BLOQUEANTE' && /Requisitos de la modalidad/.test(h.queFalta))).toBe(true);
  });

  it('obra nueva NO bloquea por requisitos: es la única con definición verificada', () => {
    const acto = generarActoConstruccion(datosCasiCompletos(), CON_FORMATO);
    expect(acto.calculado.modalidadesSinRequisitos).toEqual([]);
  });
});

describe('Reglas respaldadas — reutilizadas, no reescritas', () => {
  it('la vigencia de obra nueva son 36 meses desde la FIRMEZA (no la expedición)', () => {
    const r = vigenciaDeLaConstruccion('2026-10-01T12:00:00.000Z', ['obra-nueva']);
    expect(r.estado).toBe('CALCULADA');
    if (r.estado === 'CALCULADA') {
      expect(r.meses).toBe(36);
      // 36 meses desde 2026-10-01 → 2029-10-01.
      expect(r.vencimientoIso.startsWith('2029-10-01')).toBe(true);
    }
  });

  it('una modalidad distinta de obra nueva son 24 meses', () => {
    const r = vigenciaDeLaConstruccion('2026-10-01T12:00:00.000Z', ['adecuacion']);
    expect(r.estado === 'CALCULADA' && r.meses).toBe(24);
  });

  it('NO desambigua una combinación de modalidades: lo declara, no elige', () => {
    const r = vigenciaDeLaConstruccion('2026-10-01T12:00:00.000Z', ['obra-nueva', 'demolicion']);
    expect(r.estado).toBe('COMBINACION_SIN_DESAMBIGUAR');
  });

  it('sin firmeza no calcula vigencia', () => {
    expect(vigenciaDeLaConstruccion(null, ['obra-nueva']).estado).toBe('FALTA_FIRMEZA');
  });

  it('término y subsanación se leen de la Definición (45 hábiles; 30+15)', () => {
    expect(TERMINO_CONSTRUCCION.dias).toBe(45);
    expect(SUBSANACION_CONSTRUCCION.dias).toBe(30);
    expect(SUBSANACION_CONSTRUCCION.prorrogaDias).toBe(15);
  });

  it('la tarifa de expensas de construcción NO existe en el repositorio: es null, no un valor plausible', () => {
    expect(TARIFA_EXPENSAS_CONSTRUCCION).toBeNull();
  });
});

describe('Las 9 modalidades quedan separadas por estado', () => {
  it('son exactamente 9 y solo obra nueva tiene requisitos verificados', () => {
    expect(ESTADO_REQUISITOS_POR_MODALIDAD).toHaveLength(9);
    const verificadas = ESTADO_REQUISITOS_POR_MODALIDAD.filter((e) => e.requisitos === 'VERIFICADO');
    expect(verificadas.map((e) => e.codigo)).toEqual(['obra-nueva']);
  });

  it('solo «demolición» tiene el nombre confirmado por norma', () => {
    const conNombre = ESTADO_REQUISITOS_POR_MODALIDAD.filter((e) => e.nombreVerificado);
    expect(conNombre.map((e) => e.codigo)).toEqual(['demolicion']);
  });

  it('la matriz cubre TODAS las modalidades del catálogo, sin inventar ni omitir', () => {
    expect(ESTADO_REQUISITOS_POR_MODALIDAD.map((e) => e.codigo).sort())
      .toEqual(MODALIDADES_CONSTRUCCION.map((m) => m.codigo).sort());
  });

  it('requisitosDisponiblesPara: obra nueva sí; cualquier otra, no', () => {
    expect(requisitosDisponiblesPara(['obra-nueva'])).toBe(true);
    expect(requisitosDisponiblesPara(['ampliacion'])).toBe(false);
    expect(requisitosDisponiblesPara(['obra-nueva', 'demolicion'])).toBe(false);
    expect(requisitosDisponiblesPara([])).toBe(false);
  });
});

describe('El puente y el informe de campos inexistentes', () => {
  it('reporta como inexistentes los datos técnicos de la obra', () => {
    const campos = CAMPOS_SIN_ORIGEN_CONSTRUCCION.map((c) => c.campo);
    expect(campos).toContain('Área a construir / intervenir');
    expect(campos).toContain('Número de pisos');
    expect(campos).toContain('Uso / destino de la edificación');
    expect(campos).toContain('Valor de la obra');
    expect(campos).toContain('Sistema estructural');
    expect(campos).toContain('Profesional responsable (nombre, clase, matrícula)');
  });

  it('el puente vuelca lo que el expediente da y deja el resto vacío, sin inventar', () => {
    const exp: ExpedienteParaConstruccion = {
      id: 'x', estadoJuridico: 'EN_VIABILIDAD',
      subtipos: ['CONSTRUCCION'], modalidadesConstruccion: ['obra-nueva'],
      solicitanteNombre: 'ALGUIEN', solicitanteDocumento: 'C.C. 9',
      predio: { matriculaInmobiliaria: '321-1', barrioVereda: 'Centro' },
      actoFinal: { fechaFirmeza: '2026-10-01T12:00:00.000Z' },
    };
    const d = datosDesdeExpedienteConstruccion(exp);
    expect(d.modalidades).toEqual(['obra-nueva']);
    expect(d.matriculaInmobiliaria).toBe('321-1');
    expect(d.fechas.firmeza).toBe('2026-10-01T12:00:00.000Z');
    expect(d.titulares).toHaveLength(1);
    // Lo que no existe queda vacío, jamás relleno.
    expect(d.obra.areaIntervenidaTexto).toBeNull();
    expect(d.profesional).toBeNull();
  });

  it('impedimentos de flujo: figura equivocada, sin modalidad, estado incorrecto', () => {
    const subdiv = impedimentosParaGenerarConstruccion({ id: 'x', estadoJuridico: 'EN_VIABILIDAD', subtipos: ['SUBDIVISION_RURAL'] });
    expect(subdiv.some((i) => i.codigo === 'NO_ES_CONSTRUCCION')).toBe(true);

    const sinModalidad = impedimentosParaGenerarConstruccion({ id: 'x', estadoJuridico: 'EN_VIABILIDAD', subtipos: ['CONSTRUCCION'], modalidadesConstruccion: [] });
    expect(sinModalidad.some((i) => i.codigo === 'SIN_MODALIDAD')).toBe(true);

    const malEstado = impedimentosParaGenerarConstruccion({ id: 'x', estadoJuridico: 'BORRADOR', subtipos: ['CONSTRUCCION'], modalidadesConstruccion: ['obra-nueva'] });
    expect(malEstado.some((i) => i.codigo === 'ESTADO_NO_PERMITE_RESOLVER')).toBe(true);
  });
});

describe('Los pendientes y el esqueleto son datos consultables', () => {
  it('pendientesQueFaltan enumera los huecos de dominio abiertos hoy', () => {
    const faltan = pendientesQueFaltan(SIN_DECIDIR_CONSTRUCCION).map((p) => p.id);
    expect(faltan).toContain('FORMATO_RESOLUCION');
    expect(faltan).toContain('TARIFA_EXPENSAS_CONSTRUCCION');
    expect(faltan).toContain('REQUISITOS_MODALIDADES');
    // Catálogo completo, sin duplicados.
    expect(new Set(PENDIENTES_CONSTRUCCION.map((p) => p.id)).size).toBe(PENDIENTES_CONSTRUCCION.length);
  });

  it('el esqueleto declara qué tramos siguen pendientes del formato', () => {
    const claves = tramosPendientesDeFormato().map((t) => t.clave);
    expect(claves).toContain('ARTICULOS_RESOLUTIVOS');
    expect(claves).toContain('CONSIDERANDOS_CUERPO');
    // El rótulo «RESUELVE» es estructural conocido: NO está pendiente.
    expect(claves).not.toContain('RESUELVE');
  });

  it('renderTextoActoConstruccion marca NO EXPEDIBLE mientras falte algo', () => {
    const acto = generarActoConstruccion(datosCasiCompletos(), SIN_DECIDIR_CONSTRUCCION);
    expect(renderTextoActoConstruccion(acto)).toMatch(/NO EXPEDIBLE/);
  });
});
