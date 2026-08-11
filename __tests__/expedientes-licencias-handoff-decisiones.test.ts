import { describe, expect, it } from 'vitest';
import {
  planCrearExpedienteDesdeRadicado,
  debeEnviarComunicacionExpediente,
  calcularFechaLimiteRespuestaActa,
  esErrorExpediente,
  type RadicadoParaHandoff,
  type PlanCrearExpedienteDesdeRadicado,
} from '@/lib/server/expedientes-licencias';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';
import { calcularVencimientoDual, derivarEventosTermino } from '@/lib/motor-expedientes/termino';

/* Bloque A·A4/A5 — decisiones puras del handoff radicado⇄expediente y las comunicaciones. */

const ACTOR = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO' };
const AHORA = new Date(2026, 7, 10, 12, 0, 0, 0);

function radicadoBase(overrides: Partial<RadicadoParaHandoff> = {}): RadicadoParaHandoff {
  return {
    radicadoId: '1-110-202608-00000042',
    estadoActual: 'EN_PROCESO',
    clasificacion: { oficinaDestino: 'SEC_PLANEACION' },
    solicitante: { nombreCompleto: 'Juan Pérez', numeroDocumento: '12345678' },
    vinculoExpediente: null,
    ...overrides,
  };
}
function ok(x: PlanCrearExpedienteDesdeRadicado | ReturnType<typeof planCrearExpedienteDesdeRadicado>) {
  if (esErrorExpediente(x)) throw new Error(`esperaba plan, recibí error ${x.status}: ${x.mensaje}`);
  return x;
}
function err(x: unknown) {
  if (!esErrorExpediente(x)) throw new Error('esperaba error');
  return x;
}

describe('planCrearExpedienteDesdeRadicado — validaciones', () => {
  it('radicado válido de SEC_PLANEACION, abierto, sin vínculo → plan válido', () => {
    const plan = ok(planCrearExpedienteDesdeRadicado(radicadoBase(), { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(plan.expediente.radicadoId).toBe('1-110-202608-00000042');
    expect(plan.expediente.esPrueba).toBe(true);
    expect(plan.vinculoRadicado.expedienteId).toBe(plan.expediente.id);
  });

  it('radicado de OTRA dependencia (no SEC_PLANEACION) → 400', () => {
    const e = err(planCrearExpedienteDesdeRadicado(
      radicadoBase({ clasificacion: { oficinaDestino: 'SEC_HACIENDA' } }), { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA,
    ));
    expect(e.status).toBe(400);
  });

  it('radicado cerrado (RESUELTO) → 409', () => {
    const e = err(planCrearExpedienteDesdeRadicado(
      radicadoBase({ estadoActual: 'RESUELTO' }), { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA,
    ));
    expect(e.status).toBe(409);
  });

  it('VÍNCULO ÚNICO: radicado ya vinculado a un expediente → 409', () => {
    const e = err(planCrearExpedienteDesdeRadicado(
      radicadoBase({ vinculoExpediente: { expedienteId: 'exp-previo', numeroExpediente: 'DEMO-26-aaaa1111', fecha: '2026-08-01T00:00:00.000Z' } }),
      { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA,
    ));
    expect(e.status).toBe(409);
    expect(e.mensaje).toContain('exp-previo');
  });

  it('subtipo en cuarentena (LA) → 422', () => {
    const e = err(planCrearExpedienteDesdeRadicado(radicadoBase(), { subtipos: ['LA'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(e.status).toBe(422);
  });

  it('sin subtipos → 400', () => {
    const e = err(planCrearExpedienteDesdeRadicado(radicadoBase(), { subtipos: [] }, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(e.status).toBe(400);
  });
});

describe('planCrearExpedienteDesdeRadicado — proyección MÍNIMA D2 (sin copiar PII completa)', () => {
  it('el expediente NO tiene ningún campo de email/teléfono — solo nombre y documento', () => {
    const plan = ok(planCrearExpedienteDesdeRadicado(radicadoBase(), { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    const serializado = JSON.stringify(plan.expediente);
    expect(serializado).not.toMatch(/email|correo|telefono/i);
    expect(plan.expediente.solicitanteNombre).toBe('Juan Pérez');
    expect(plan.expediente.solicitanteDocumento).toBe('12345678');
  });

  it('la primera actuación cita el radicado de origen en su detalle', () => {
    const plan = ok(planCrearExpedienteDesdeRadicado(radicadoBase(), { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(plan.primeraActuacion.detalle).toContain('1-110-202608-00000042');
  });

  it('tramiteId referencia la Definición sembrada real (habilita el gate de comunicaciones)', () => {
    const plan = ok(planCrearExpedienteDesdeRadicado(radicadoBase(), { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(plan.expediente.tramiteId).toBe(DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id);
  });

  it('fechaAlertaConservadora (espejo R11): nace poblado y coincide con calcularVencimientoDual sobre la primera actuación', () => {
    const plan = ok(planCrearExpedienteDesdeRadicado(radicadoBase(), { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    const esperado = calcularVencimientoDual(
      derivarEventosTermino([plan.primeraActuacion]),
      45, // PLAZO_DECISION_LICENCIA_DIAS_HABILES — solo como literal de comparación, no reimplementa el cómputo.
    ).fechaAlertaConservadora?.toISOString() ?? null;

    expect(plan.expediente.fechaAlertaConservadora).not.toBeNull();
    expect(plan.expediente.fechaAlertaConservadora).toBe(esperado);
  });
});

describe('debeEnviarComunicacionExpediente — gates (A5, dictamen 8-ago)', () => {
  const tramiteHabilitado = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id;
  const radicadoConEmail = { esAnonimo: false, tipoPresentacion: 'IDENTIFICADA' as const, solicitante: { email: 'juan@example.com' } };

  it('Definición habilitada + email válido + sin marca de no-aporte → debeEnviar:true', () => {
    expect(debeEnviarComunicacionExpediente(tramiteHabilitado, radicadoConEmail)).toEqual({ debeEnviar: true });
  });

  it('Definición NO habilitada (v1: fuera de licencia) → debeEnviar:false', () => {
    const resultado = debeEnviarComunicacionExpediente('otra-definicion', radicadoConEmail);
    expect(resultado.debeEnviar).toBe(false);
  });

  it('sin radicado vinculado (creación sin handoff, sin email disponible) → debeEnviar:false', () => {
    const resultado = debeEnviarComunicacionExpediente(tramiteHabilitado, null);
    expect(resultado.debeEnviar).toBe(false);
  });

  it('marca datosNoAportados.correo → debeEnviar:false', () => {
    const resultado = debeEnviarComunicacionExpediente(tramiteHabilitado, {
      ...radicadoConEmail, solicitante: { ...radicadoConEmail.solicitante, datosNoAportados: { correo: true } },
    });
    expect(resultado.debeEnviar).toBe(false);
  });

  it('presentación ANÓNIMA → debeEnviar:false (aunque haya email)', () => {
    const resultado = debeEnviarComunicacionExpediente(tramiteHabilitado, { ...radicadoConEmail, esAnonimo: true });
    expect(resultado.debeEnviar).toBe(false);
  });

  it('sin email o email inválido → debeEnviar:false', () => {
    expect(debeEnviarComunicacionExpediente(tramiteHabilitado, { ...radicadoConEmail, solicitante: { email: null } }).debeEnviar).toBe(false);
    expect(debeEnviarComunicacionExpediente(tramiteHabilitado, { ...radicadoConEmail, solicitante: { email: 'no-es-email' } }).debeEnviar).toBe(false);
  });
});

describe('calcularFechaLimiteRespuestaActa — 30 días hábiles desde la COMUNICACIÓN', () => {
  it('coincide exactamente con sumarDiasHabiles(fecha, 30)', () => {
    const fechaComunicacion = '2026-06-01T15:00:00.000Z';
    const resultado = calcularFechaLimiteRespuestaActa(fechaComunicacion);
    expect(resultado).toBe(sumarDiasHabiles(fechaComunicacion, 30).toISOString());
  });
});
