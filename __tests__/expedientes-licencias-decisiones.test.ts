import { describe, expect, it } from 'vitest';
import {
  planCrearExpedienteDemo,
  planRegistrarActuacion,
  evaluarCandadoEmisionReal,
  esErrorExpediente,
  EMISION_REAL_EXPEDIENTES_HABILITADA,
  DETALLE_ACTUACION_MIN,
  type PlanCrearExpedienteDemo,
  type PlanRegistrarActuacion,
  type ErrorExpediente,
} from '@/lib/server/expedientes-licencias';

/* Bloque "Integración UI y demo" — decisiones puras de expedientes de licencias. */

const ACTOR = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO' };
const AHORA = new Date(2026, 7, 10, 12, 0, 0, 0);

function planOk(x: PlanCrearExpedienteDemo | ErrorExpediente): PlanCrearExpedienteDemo {
  if (esErrorExpediente(x)) throw new Error(`esperaba plan, recibí error ${x.status}: ${x.mensaje}`);
  return x;
}
function err(x: unknown): ErrorExpediente {
  if (!esErrorExpediente(x)) throw new Error('esperaba error, recibí plan');
  return x;
}
function actuacionOk(x: PlanRegistrarActuacion | ErrorExpediente): PlanRegistrarActuacion {
  if (esErrorExpediente(x)) throw new Error(`esperaba plan, recibí error ${x.status}: ${x.mensaje}`);
  return x;
}

const INPUT_BASE = { solicitanteNombre: 'Juan Pérez', solicitanteDocumento: '12345678', subtipos: ['CONSTRUCCION'] };

describe('EMISION_REAL_EXPEDIENTES_HABILITADA — candado', () => {
  it('es false (la doctrina R10 no se activa por accidente)', () => {
    expect(EMISION_REAL_EXPEDIENTES_HABILITADA).toBe(false);
  });
});

describe('evaluarCandadoEmisionReal', () => {
  it('con el valor real del módulo (false) → 422', () => {
    const resultado = evaluarCandadoEmisionReal();
    expect(esErrorExpediente(resultado)).toBe(true);
    expect(err(resultado).status).toBe(422);
    expect(err(resultado).mensaje).toMatch(/R10/);
  });

  it('con habilitado:true inyectado (simula autorización futura) → candadoAbierto', () => {
    const resultado = evaluarCandadoEmisionReal(true);
    expect(esErrorExpediente(resultado)).toBe(false);
    expect(resultado).toEqual({ candadoAbierto: true });
  });
});

describe('planCrearExpedienteDemo — validaciones', () => {
  it('crea un plan válido con datos correctos', () => {
    const plan = planOk(planCrearExpedienteDemo(INPUT_BASE, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(plan.expediente.solicitanteNombre).toBe('Juan Pérez');
    expect(plan.expediente.subtipos).toEqual(['CONSTRUCCION']);
    expect(plan.primeraActuacion.tipo).toBe('radicacion-debida-forma');
  });

  it('nombre vacío → 400', () => {
    expect(err(planCrearExpedienteDemo({ ...INPUT_BASE, solicitanteNombre: '  ' }, 'SEC_PLANEACION', ACTOR, AHORA)).status).toBe(400);
  });

  it('documento vacío → 400', () => {
    expect(err(planCrearExpedienteDemo({ ...INPUT_BASE, solicitanteDocumento: '' }, 'SEC_PLANEACION', ACTOR, AHORA)).status).toBe(400);
  });

  it('subtipos vacío → 400', () => {
    expect(err(planCrearExpedienteDemo({ ...INPUT_BASE, subtipos: [] }, 'SEC_PLANEACION', ACTOR, AHORA)).status).toBe(400);
  });

  it('subtipo NO existente en el catálogo → 422', () => {
    const e = err(planCrearExpedienteDemo({ ...INPUT_BASE, subtipos: ['NO_EXISTE'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(e.status).toBe(422);
  });

  it.each(['LA', 'LCR VISR', 'LRC'])('subtipo en cuarentena "%s" (no es código de catálogo) → 422 citando P1′', (codigo) => {
    const e = err(planCrearExpedienteDemo({ ...INPUT_BASE, subtipos: [codigo] }, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(e.status).toBe(422);
    expect(e.mensaje).toContain('P1′');
  });

  it('combinado válido: varios subtipos del catálogo', () => {
    const plan = planOk(planCrearExpedienteDemo({ ...INPUT_BASE, subtipos: ['CONSTRUCCION', 'APROBACION_PH'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(plan.expediente.subtipos).toEqual(['CONSTRUCCION', 'APROBACION_PH']);
  });
});

describe('planCrearExpedienteDemo — forma del documento', () => {
  const plan = planOk(planCrearExpedienteDemo(INPUT_BASE, 'SEC_PLANEACION', ACTOR, AHORA));

  it('esPrueba SIEMPRE true', () => {
    expect(plan.expediente.esPrueba).toBe(true);
  });
  it('estadoJuridico=RADICADA_EN_DEBIDA_FORMA, estado=EN_REVISION', () => {
    expect(plan.expediente.estadoJuridico).toBe('RADICADA_EN_DEBIDA_FORMA');
    expect(plan.expediente.estado).toBe('EN_REVISION');
  });
  it('numeroExpediente.numero tiene el prefijo DEMO- (nunca formato legal puro)', () => {
    expect(plan.expediente.numeroExpediente?.numero).toMatch(/^DEMO-\d{2}-[0-9a-f]{8}$/);
  });
  it('tenantId se propaga al expediente Y a la primera actuación (denormalizado)', () => {
    expect(plan.expediente.tenantId).toBe('SEC_PLANEACION');
    expect(plan.primeraActuacion.tenantId).toBe('SEC_PLANEACION');
  });
  it('la primera actuación referencia el id del expediente', () => {
    expect(plan.primeraActuacion.expedienteId).toBe(plan.expediente.id);
  });
  it('radicadoId es null (handoff pendiente, D2/D3)', () => {
    expect(plan.expediente.radicadoId).toBeNull();
  });
  it('aportes vacío, contexto {} por defecto', () => {
    expect(plan.expediente.aportes).toEqual([]);
    expect(plan.expediente.contexto).toEqual({});
  });

  it('FAIL-CLOSED: el plan NUNCA referencia counters/ ni unicidad_expedientes/ en ningún campo', () => {
    const serializado = JSON.stringify(plan);
    expect(serializado).not.toMatch(/counters\//);
    expect(serializado).not.toMatch(/unicidad_expedientes/);
  });
});

describe('planRegistrarActuacion — guards y transiciones', () => {
  const EXPEDIENTE_ID = 'exp-1';
  const TENANT = 'SEC_PLANEACION';
  const DETALLE_OK = 'Se observó que falta el certificado de tradición y libertad vigente.';

  it('acta-observaciones desde EN_REVISION, sin acta previa → CON_ACTA_DE_OBSERVACIONES', () => {
    const plan = actuacionOk(planRegistrarActuacion(
      'EN_REVISION', [], EXPEDIENTE_ID, TENANT, { tipo: 'acta-observaciones', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));
    expect(plan.nuevoEstadoJuridico).toBe('CON_ACTA_DE_OBSERVACIONES');
    expect(plan.actuacion.tipo).toBe('acta-observaciones');
    expect(plan.actuacion.tenantId).toBe(TENANT);
  });

  it('acta ÚNICA: si ya existe una acta-observaciones → 409, cita el art. 2.2.6.1.2.2.4', () => {
    const e = err(planRegistrarActuacion(
      'EN_REVISION', [{ tipo: 'acta-observaciones' }], EXPEDIENTE_ID, TENANT,
      { tipo: 'acta-observaciones', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));
    expect(e.status).toBe(409);
    expect(e.mensaje).toContain('2.2.6.1.2.2.4');
  });

  it('respuesta-subsanacion desde CON_ACTA_DE_OBSERVACIONES, con acta previa → EN_VIABILIDAD', () => {
    const plan = actuacionOk(planRegistrarActuacion(
      'CON_ACTA_DE_OBSERVACIONES', [{ tipo: 'acta-observaciones' }], EXPEDIENTE_ID, TENANT,
      { tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));
    expect(plan.nuevoEstadoJuridico).toBe('EN_VIABILIDAD');
  });

  it('respuesta-subsanacion SIN acta previa → 409 (nada que responder)', () => {
    const e = err(planRegistrarActuacion(
      'EN_REVISION', [], EXPEDIENTE_ID, TENANT, { tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));
    expect(e.status).toBe(409);
  });

  it('el mapa de estados-licencia.ts es la autoridad: acta-observaciones desde un estado donde el mapa NO lo permite → 409', () => {
    // Desde EN_VIABILIDAD el mapa no tiene EN_VIABILIDAD -> CON_ACTA_DE_OBSERVACIONES.
    const e = err(planRegistrarActuacion(
      'EN_VIABILIDAD', [], EXPEDIENTE_ID, TENANT, { tipo: 'acta-observaciones', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));
    expect(e.status).toBe(409);
  });

  it('tipo no permitido (p. ej. "acto-viabilidad", un TipoEventoTermino pero no una actuación registrable aquí) → 400', () => {
    const e = err(planRegistrarActuacion(
      'EN_REVISION', [], EXPEDIENTE_ID, TENANT, { tipo: 'acto-viabilidad', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));
    expect(e.status).toBe(400);
  });

  it(`detalle corto (< ${DETALLE_ACTUACION_MIN} caracteres) → 400`, () => {
    const e = err(planRegistrarActuacion(
      'EN_REVISION', [], EXPEDIENTE_ID, TENANT, { tipo: 'acta-observaciones', detalle: 'corto' }, ACTOR, AHORA,
    ));
    expect(e.status).toBe(400);
  });

  it('detalle vacío/ausente → 400 (no lanza)', () => {
    const e = err(planRegistrarActuacion(
      'EN_REVISION', [], EXPEDIENTE_ID, TENANT, { tipo: 'acta-observaciones', detalle: '' }, ACTOR, AHORA,
    ));
    expect(e.status).toBe(400);
  });
});
