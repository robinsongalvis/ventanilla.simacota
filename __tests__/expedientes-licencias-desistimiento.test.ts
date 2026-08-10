/**
 * Bloque "Términos y vigencias protectores" (10-ago-2026) — desistimiento
 * SEMICONTROLADO: `evaluarPlazoSubsanacion` (lectura derivada, on-read) +
 * `generarBorradorActoDesistimiento` (proyecto de acto, texto plano).
 * Principio 9: NUNCA automático — se prueba que ninguna de las dos toca la
 * máquina de estados jurídicos ni escribe nada (son funciones PURAS).
 *
 * Incluye la corrección de revisión cruzada (10-ago-2026, bug con
 * consecuencia jurídica): `evaluarPlazoSubsanacion` debe identificar CON
 * CERTEZA la comunicación del ACTA (no cualquier `'comunicacion-enviada'`
 * posterior, que también emite la constancia) — vía primaria
 * `tipoComunicacion` (campo estructurado), fallback por prefijo de
 * `detalle` para documentos antiguos, fail-closed si ninguna aplica.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluarPlazoSubsanacion,
  generarBorradorActoDesistimiento,
  calcularFechaLimiteRespuestaActa,
  construirActuacionComunicacionEnviada,
  TEXTO_RECURSOS_DESISTIMIENTO_TACITO,
  PREFIJO_AVISO_ACTA_COMUNICACION,
  type ActuacionLicenciaDoc,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';

const RADICACION = new Date(2026, 5, 1, 12, 0, 0, 0); // 1-jun-2026
const ACTOR = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO' };

type ActuacionParcial = Pick<ActuacionLicenciaDoc, 'tipo' | 'fecha' | 'tipoComunicacion' | 'detalle'>;

function actuacion(overrides: Partial<ActuacionParcial>): ActuacionParcial {
  return { tipo: 'acta-observaciones', fecha: RADICACION.toISOString(), ...overrides };
}

/** Aviso del acta, tal como lo construye HOY el servidor (vía primaria: `tipoComunicacion`). */
function avisoActa(fecha: Date): ActuacionParcial {
  const real = construirActuacionComunicacionEnviada(
    'exp-1', 'SEC_PLANEACION',
    { tipoComunicacion: 'Aviso de acta de observaciones y correcciones', destinatario: 'x@x.com', asunto: 'Aviso' },
    ACTOR, fecha,
  );
  return { tipo: real.tipo, fecha: real.fecha, tipoComunicacion: real.tipoComunicacion, detalle: real.detalle };
}

/** Constancia de radicación (la OTRA comunicación que comparte `tipo: 'comunicacion-enviada'`), tal como la construye A5. */
function constancia(fecha: Date): ActuacionParcial {
  const real = construirActuacionComunicacionEnviada(
    'exp-1', 'SEC_PLANEACION',
    { tipoComunicacion: 'Constancia de radicación en legal y debida forma', destinatario: 'x@x.com', asunto: 'Constancia' },
    ACTOR, fecha,
  );
  return { tipo: real.tipo, fecha: real.fecha, tipoComunicacion: real.tipoComunicacion, detalle: real.detalle };
}

/** Aviso del acta escrito ANTES de este fix — sin `tipoComunicacion`, solo el prefijo conocido en `detalle` (fallback). */
function avisoActaDocAntiguo(fecha: Date): ActuacionParcial {
  return { tipo: 'comunicacion-enviada', fecha: fecha.toISOString(), detalle: `${PREFIJO_AVISO_ACTA_COMUNICACION} de observaciones y correcciones enviada a x@x.com. Asunto: "Aviso".` };
}

describe('evaluarPlazoSubsanacion — NO_APLICA', () => {
  it('sin ninguna actuación → NO_APLICA', () => {
    expect(evaluarPlazoSubsanacion([], new Date()).resultado).toBe('NO_APLICA');
  });

  it('acta SIN comunicación registrada → NO_APLICA (el plazo no ha empezado a correr, due process)', () => {
    const actuaciones = [actuacion({ tipo: 'acta-observaciones', fecha: RADICACION.toISOString() })];
    expect(evaluarPlazoSubsanacion(actuaciones, new Date(2026, 7, 1)).resultado).toBe('NO_APLICA');
  });

  it('una comunicación ANTERIOR al acta (p. ej. la constancia de creación) NO cuenta como "acta comunicada"', () => {
    const actaFecha = sumarDiasHabiles(RADICACION, 5);
    const actuaciones = [
      constancia(RADICACION), // constancia, ANTES del acta
      actuacion({ tipo: 'acta-observaciones', fecha: actaFecha.toISOString() }),
    ];
    expect(evaluarPlazoSubsanacion(actuaciones, new Date(2026, 9, 1)).resultado).toBe('NO_APLICA');
  });

  it('acta comunicada CON respuesta ya registrada → NO_APLICA', () => {
    const actaFecha = sumarDiasHabiles(RADICACION, 2);
    const comunicacionFecha = sumarDiasHabiles(actaFecha, 1);
    const respuestaFecha = sumarDiasHabiles(comunicacionFecha, 5);
    const actuaciones = [
      actuacion({ tipo: 'acta-observaciones', fecha: actaFecha.toISOString() }),
      avisoActa(comunicacionFecha),
      actuacion({ tipo: 'respuesta-subsanacion', fecha: respuestaFecha.toISOString() }),
    ];
    expect(evaluarPlazoSubsanacion(actuaciones, new Date(2027, 0, 1)).resultado).toBe('NO_APLICA');
  });
});

describe('evaluarPlazoSubsanacion — corrección de revisión cruzada (bug con consecuencia jurídica, 10-ago-2026)', () => {
  const actaFecha = sumarDiasHabiles(RADICACION, 5);

  it('(1) comunicación posterior al acta que NO es el aviso (p. ej. una constancia de otro trámite) → NO_APLICA aunque hayan pasado 60 días', () => {
    const otraComunicacionFecha = sumarDiasHabiles(actaFecha, 1);
    const actuaciones = [
      actuacion({ tipo: 'acta-observaciones', fecha: actaFecha.toISOString() }),
      constancia(otraComunicacionFecha), // NO es el aviso del acta — comparte tipo, pero es otra comunicación
    ];
    const hoy = sumarDiasHabiles(otraComunicacionFecha, 60);
    const resultado = evaluarPlazoSubsanacion(actuaciones, hoy);
    expect(resultado.resultado).toBe('NO_APLICA');
    expect(resultado.fechaVencimientoPlazo).toBeUndefined();
  });

  it('(2) doc ANTIGUO sin el campo tipoComunicacion, identificado por el prefijo de detalle (fallback) → funciona igual que el campo propio', () => {
    const comunicacionFecha = sumarDiasHabiles(actaFecha, 1);
    const actuaciones = [
      actuacion({ tipo: 'acta-observaciones', fecha: actaFecha.toISOString() }),
      avisoActaDocAntiguo(comunicacionFecha), // SIN tipoComunicacion — solo detalle con el prefijo conocido
    ];
    const hoyEnPlazo = evaluarPlazoSubsanacion(actuaciones, sumarDiasHabiles(comunicacionFecha, 10));
    expect(hoyEnPlazo.resultado).toBe('EN_PLAZO');

    const hoyVencido = evaluarPlazoSubsanacion(actuaciones, sumarDiasHabiles(comunicacionFecha, 40));
    expect(hoyVencido.resultado).toBe('POR_ARCHIVAR');
  });

  it('(3) aviso del acta identificado por el campo propio tipoComunicacion → EN_PLAZO/POR_ARCHIVAR según corresponda', () => {
    const comunicacionFecha = sumarDiasHabiles(actaFecha, 1);
    const actuaciones = [
      actuacion({ tipo: 'acta-observaciones', fecha: actaFecha.toISOString() }),
      avisoActa(comunicacionFecha), // CON tipoComunicacion (vía primaria)
    ];
    expect(actuaciones[1]!.tipoComunicacion).toBe('Aviso de acta de observaciones y correcciones');

    expect(evaluarPlazoSubsanacion(actuaciones, sumarDiasHabiles(comunicacionFecha, 10)).resultado).toBe('EN_PLAZO');
    expect(evaluarPlazoSubsanacion(actuaciones, sumarDiasHabiles(comunicacionFecha, 40)).resultado).toBe('POR_ARCHIVAR');
  });

  it('con AMBAS comunicaciones presentes (constancia y aviso, orden real de un caso con handoff): solo el aviso cuenta', () => {
    const constanciaFecha = RADICACION; // constancia siempre en la creación, antes del acta
    const comunicacionAvisoFecha = sumarDiasHabiles(actaFecha, 1);
    const actuaciones = [
      constancia(constanciaFecha),
      actuacion({ tipo: 'acta-observaciones', fecha: actaFecha.toISOString() }),
      avisoActa(comunicacionAvisoFecha),
    ];
    const resultado = evaluarPlazoSubsanacion(actuaciones, sumarDiasHabiles(comunicacionAvisoFecha, 40));
    expect(resultado.resultado).toBe('POR_ARCHIVAR');
    expect(resultado.fechaVencimientoPlazo).toBe(calcularFechaLimiteRespuestaActa(comunicacionAvisoFecha));
  });
});

describe('evaluarPlazoSubsanacion — EN_PLAZO / POR_ARCHIVAR', () => {
  const actaFecha = sumarDiasHabiles(RADICACION, 5);
  const comunicacionFecha = sumarDiasHabiles(actaFecha, 1);
  const actuaciones = [
    actuacion({ tipo: 'acta-observaciones', fecha: actaFecha.toISOString() }),
    avisoActa(comunicacionFecha),
  ];
  const vencimientoEsperado = calcularFechaLimiteRespuestaActa(comunicacionFecha);

  it('acta comunicada, SIN respuesta, hoy DENTRO del plazo de 30 hábiles → EN_PLAZO', () => {
    const hoy = sumarDiasHabiles(comunicacionFecha, 10);
    const resultado = evaluarPlazoSubsanacion(actuaciones, hoy);
    expect(resultado.resultado).toBe('EN_PLAZO');
    expect(resultado.fechaVencimientoPlazo).toBe(vencimientoEsperado);
    expect(resultado.diasHabilesRestantes).toBeGreaterThan(0);
  });

  it('acta comunicada, SIN respuesta, hoy DESPUÉS del vencimiento de 30 hábiles → POR_ARCHIVAR', () => {
    const hoy = sumarDiasHabiles(comunicacionFecha, 40);
    const resultado = evaluarPlazoSubsanacion(actuaciones, hoy);
    expect(resultado.resultado).toBe('POR_ARCHIVAR');
    expect(resultado.fechaVencimientoPlazo).toBe(vencimientoEsperado);
    expect(resultado.diasHabilesRestantes).toBeLessThan(0);
  });

  it('el plazo son 30 días HÁBILES desde la COMUNICACIÓN (reutiliza calcularFechaLimiteRespuestaActa, no reimplementa)', () => {
    const hoy = sumarDiasHabiles(comunicacionFecha, 1);
    const resultado = evaluarPlazoSubsanacion(actuaciones, hoy);
    expect(resultado.fechaVencimientoPlazo).toBe(calcularFechaLimiteRespuestaActa(comunicacionFecha));
  });
});

describe('evaluarPlazoSubsanacion — es una lectura derivada, NUNCA escribe ni decide', () => {
  it('la función es SÍNCRONA y PURA: mismo input siempre da el mismo output, sin efectos secundarios observables', () => {
    const actaFecha = sumarDiasHabiles(RADICACION, 5);
    const comunicacionFecha = sumarDiasHabiles(actaFecha, 1);
    const actuaciones = [
      actuacion({ tipo: 'acta-observaciones', fecha: actaFecha.toISOString() }),
      avisoActa(comunicacionFecha),
    ];
    const hoy = sumarDiasHabiles(comunicacionFecha, 40);
    const r1 = evaluarPlazoSubsanacion(actuaciones, hoy);
    const r2 = evaluarPlazoSubsanacion(actuaciones, hoy);
    expect(r1).toEqual(r2);
  });
});

describe('generarBorradorActoDesistimiento', () => {
  const EXPEDIENTE: Pick<ExpedienteLicenciaDoc, 'id' | 'solicitanteNombre' | 'solicitanteDocumento' | 'numeroExpediente'> = {
    id: 'exp-1',
    solicitanteNombre: 'Juan Pérez',
    solicitanteDocumento: '12345678',
    numeroExpediente: { numero: '68745-0-26-0005', serieId: 'demo', año: 2026 },
  };

  it('resultado NO_APLICA → null (nada que proyectar)', () => {
    expect(generarBorradorActoDesistimiento(EXPEDIENTE, { resultado: 'NO_APLICA' })).toBeNull();
  });

  it('resultado EN_PLAZO → null (el plazo sigue corriendo, aún no hay nada que archivar)', () => {
    expect(generarBorradorActoDesistimiento(EXPEDIENTE, { resultado: 'EN_PLAZO', fechaVencimientoPlazo: '2026-09-01T00:00:00.000Z', diasHabilesRestantes: 5 })).toBeNull();
  });

  it('resultado POR_ARCHIVAR → genera el borrador con los datos del expediente, la cita normativa, la fecha de vencimiento y espacio de firma', () => {
    const borrador = generarBorradorActoDesistimiento(EXPEDIENTE, { resultado: 'POR_ARCHIVAR', fechaVencimientoPlazo: '2026-09-01T00:00:00.000Z', diasHabilesRestantes: -3 });
    expect(borrador).not.toBeNull();
    expect(borrador!.titulo).toContain('68745-0-26-0005');
    expect(borrador!.cuerpo).toContain('68745-0-26-0005');
    expect(borrador!.cuerpo).toContain('Juan Pérez');
    expect(borrador!.cuerpo).toContain('12345678');
    expect(borrador!.cuerpo).toContain('2.2.6.1.2.2.4');
    expect(borrador!.cuerpo).toContain('se entenderá');
    expect(borrador!.cuerpo).toContain('2026-09-01T00:00:00.000Z');
    expect(borrador!.cuerpo).toContain(TEXTO_RECURSOS_DESISTIMIENTO_TACITO);
    expect(borrador!.cuerpo).toMatch(/no produce efecto/i);
    expect(borrador!.cuerpo).toMatch(/Firma del funcionario/);
  });

  it('el texto NO es HTML ni contiene ninguna marca de generación de PDF — texto plano imprimible', () => {
    const borrador = generarBorradorActoDesistimiento(EXPEDIENTE, { resultado: 'POR_ARCHIVAR', fechaVencimientoPlazo: '2026-09-01T00:00:00.000Z' });
    expect(borrador!.cuerpo).not.toMatch(/<[a-z][\s\S]*>/i);
  });

  it('usa el id del expediente como número cuando no hay numeroExpediente asignado (RECONSTRUIDO/demo sin serie)', () => {
    const sinNumero = { ...EXPEDIENTE, numeroExpediente: undefined };
    const borrador = generarBorradorActoDesistimiento(sinNumero, { resultado: 'POR_ARCHIVAR', fechaVencimientoPlazo: '2026-09-01T00:00:00.000Z' });
    expect(borrador!.cuerpo).toContain('exp-1');
  });
});
