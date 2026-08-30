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
  type ActuacionLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { calcularVencimientoTermino, derivarEventosTermino } from '@/lib/motor-expedientes/termino';

/* Bloque "Integración UI y demo" — decisiones puras de expedientes de licencias. */

const ACTOR = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO' };
const AHORA = new Date(2026, 7, 10, 12, 0, 0, 0);
/** Plazo real del módulo (`PLAZO_DECISION_LICENCIA_DIAS_HABILES`) — duplicado aquí solo como literal de comparación en las aserciones de anti-divergencia, nunca reimplementa el cómputo. */
const PLAZO_DIAS = 45;

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

/** Fixture de actuación EXISTENTE completa (id/tenantId/fecha/origen…) — desde el bloque "Términos y vigencias protectores" `planRegistrarActuacion` exige la actuación COMPLETA, no solo `tipo`, para recalcular el espejo `fechaAlertaConservadora`. */
function actuacionExistente(over: Partial<ActuacionLicenciaDoc>): ActuacionLicenciaDoc {
  return {
    id: 'a-existente',
    expedienteId: 'exp-1',
    tenantId: 'SEC_PLANEACION',
    tipo: 'acta-observaciones',
    etapa: 'revision',
    actorUid: 'u0',
    actorNombre: 'Otro Funcionario',
    actorRol: 'FUNCIONARIO',
    fecha: '2026-07-01T12:00:00.000Z',
    origen: 'REAL',
    ...over,
  };
}

const INPUT_BASE = {
  /* La creación EXIGE decidir sobre el correo desde el 29-ago-2026: o se
     registra, o se declara que no lo tiene. Estas pruebas miran otra cosa,
     así que traen el dato para poder llegar hasta donde prueban. */
  contacto: { correo: 'solicitante@ejemplo.com' }, solicitanteNombre: 'Juan Pérez', solicitanteDocumento: '12345678', subtipos: ['CONSTRUCCION'] };

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
    // ADR-0033: la primera actuación es la APERTURA, no la radicación. El slug
    // no está en SLUG_A_TIPO_EVENTO, y por eso no arranca el término.
    expect(plan.primeraActuacion.tipo).toBe('apertura-expediente');
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
  it('estadoJuridico=PRESENTADA (ADR-0033: ya NO nace en debida forma), estado=EN_REVISION', () => {
    // Antes afirmaba RADICADA_EN_DEBIDA_FORMA. El cambio es el punto entero del
    // ADR-0033: nacer en debida forma era afirmar una verificación que nadie hizo.
    expect(plan.expediente.estadoJuridico).toBe('PRESENTADA');
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
      'EN_REVISION', [actuacionExistente({ tipo: 'acta-observaciones' })], EXPEDIENTE_ID, TENANT,
      { tipo: 'acta-observaciones', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));
    expect(e.status).toBe(409);
    expect(e.mensaje).toContain('2.2.6.1.2.2.4');
  });

  it('respuesta-subsanacion desde CON_ACTA_DE_OBSERVACIONES, con acta previa → EN_VIABILIDAD', () => {
    const plan = actuacionOk(planRegistrarActuacion(
      'CON_ACTA_DE_OBSERVACIONES', [actuacionExistente({ tipo: 'acta-observaciones' })], EXPEDIENTE_ID, TENANT,
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

  /* CAMBIO DELIBERADO (ADR-0038 §9.1). Esta prueba usaba `acto-viabilidad`
     como EJEMPLO de algo que el motor del término conocía y que NO era una
     actuación registrable — y esa asimetría era precisamente el defecto R19:
     un expediente limpio no tenía cómo llegar a viabilidad, y como CONCEDIDA y
     NEGADA solo se alcanzan desde ahí, no podía resolverse.

     Ahora SÍ es registrable, con el fundamento del art. 2.2.6.1.2.3.1 par. 1.
     El ejemplo de «tipo no permitido» pasa a ser uno que de verdad no existe. */
  it('acto-viabilidad SÍ se registra: es el acto de trámite que faltaba (R19)', () => {
    const plan = planRegistrarActuacion(
      'EN_REVISION', [], EXPEDIENTE_ID, TENANT, { tipo: 'acto-viabilidad', detalle: DETALLE_OK }, ACTOR, AHORA,
    ) as { nuevoEstadoJuridico: string };
    expect(plan.nuevoEstadoJuridico).toBe('EN_VIABILIDAD');
  });

  it('un tipo inexistente sigue rechazándose con 400', () => {
    const e = err(planRegistrarActuacion(
      'EN_REVISION', [], EXPEDIENTE_ID, TENANT, { tipo: 'no-existe-esta-actuacion', detalle: DETALLE_OK } as never, ACTOR, AHORA,
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

/* ──────────────────────────────────────────────
   fechaAlertaConservadora — espejo denormalizado (R11, Bloque "Términos y
   vigencias protectores"). `planCrearExpedienteDemo` y `planRegistrarActuacion`
   son 2 de los 3 puntos que lo calculan (el tercero, `planCrearExpedienteDesdeRadicado`,
   se prueba en `expedientes-licencias-handoff-decisiones.test.ts`, que ya
   trae su propio fixture de radicado). Todas las aserciones aquí comparan
   contra `calcularVencimientoTermino(derivarEventosTermino(...))` invocado
   DIRECTAMENTE en el test — anti-divergencia: el valor que persiste el plan
   debe coincidir EXACTAMENTE con el cómputo on-read para la misma serie.
────────────────────────────────────────────── */
describe('planCrearExpedienteDemo — fechaAlertaConservadora (espejo R11)', () => {
  it('nace VACÍO — y sigue coincidiendo con lo que calcula el motor', () => {
    /* ADR-0033 §0 — el contrato CAMBIÓ a propósito: el expediente ya no nace en
       debida forma. Esta prueba afirmaba el comportamiento anterior y ahora
       afirma el nuevo. NO se invirtió la aserción sin más: el invariante que
       protegía —que el espejo coincide con lo que calcula el motor— se conserva
       intacto; lo que cambió es que ahora ambos valen null, porque no hay
       término que proyectar hasta la transición a debida forma. */
    const plan = planOk(planCrearExpedienteDemo(INPUT_BASE, 'SEC_PLANEACION', ACTOR, AHORA));
    const esperado = calcularVencimientoTermino(
      derivarEventosTermino([plan.primeraActuacion]),
      PLAZO_DIAS,
    ).vencimiento?.toISOString() ?? null;

    // El invariante que importa, intacto: espejo === calculador.
    expect(plan.expediente.fechaAlertaConservadora).toBe(esperado);
    // Y lo que cambió: ambos valen null, porque no hay término que proyectar.
    expect(esperado).toBeNull();
    expect(plan.expediente.fechaAlertaConservadora).toBeNull();
  });
});

describe('planRegistrarActuacion — fechaAlertaConservadora (espejo R11)', () => {
  const EXPEDIENTE_ID = 'exp-1';
  const TENANT = 'SEC_PLANEACION';
  const DETALLE_OK = 'Se observó que falta el certificado de tradición y libertad vigente.';
  const RADICACION_REAL = actuacionExistente({
    tipo: 'radicacion-debida-forma', etapa: 'radicacion', fecha: '2026-06-01T12:00:00.000Z', origen: 'REAL',
  });

  it('se recalcula sobre existentes + la actuación nueva — coincide con el cómputo on-read de la MISMA serie', () => {
    const existentes = [RADICACION_REAL];
    const plan = actuacionOk(planRegistrarActuacion(
      'EN_REVISION', existentes, EXPEDIENTE_ID, TENANT, { tipo: 'acta-observaciones', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));

    const esperado = calcularVencimientoTermino(
      derivarEventosTermino([...existentes, plan.actuacion]),
      PLAZO_DIAS,
    ).vencimiento?.toISOString() ?? null;

    expect(plan.fechaAlertaConservadora).not.toBeNull();
    expect(plan.fechaAlertaConservadora).toBe(esperado);
  });

  it('se ACTUALIZA al registrar una segunda actuación (respuesta-subsanacion tras el acta) — distinto del valor tras la primera', () => {
    const trasActa = actuacionOk(planRegistrarActuacion(
      'EN_REVISION', [RADICACION_REAL], EXPEDIENTE_ID, TENANT, { tipo: 'acta-observaciones', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));
    const existentesTrasActa = [RADICACION_REAL, trasActa.actuacion];

    const fechaRespuesta = new Date(2026, 7, 20, 12, 0, 0, 0); // varios días hábiles después del acta
    const trasRespuesta = actuacionOk(planRegistrarActuacion(
      'CON_ACTA_DE_OBSERVACIONES', existentesTrasActa, EXPEDIENTE_ID, TENANT,
      { tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }, ACTOR, fechaRespuesta,
    ));

    expect(trasRespuesta.fechaAlertaConservadora).not.toBe(trasActa.fechaAlertaConservadora);

    const esperado = calcularVencimientoTermino(
      derivarEventosTermino([...existentesTrasActa, trasRespuesta.actuacion]),
      PLAZO_DIAS,
    ).vencimiento?.toISOString() ?? null;
    expect(trasRespuesta.fechaAlertaConservadora).toBe(esperado);
  });

  it('R9: si TODAS las actuaciones relevantes (incl. la radicación) son RECONSTRUIDO → null, sin ancla REAL que proyectar', () => {
    const radicacionReconstruida = actuacionExistente({
      tipo: 'radicacion-debida-forma', etapa: 'radicacion', fecha: '2020-01-10T12:00:00.000Z', origen: 'RECONSTRUIDO',
    });
    const actaReconstruida = actuacionExistente({
      tipo: 'acta-observaciones', etapa: 'revision', fecha: '2020-02-01T12:00:00.000Z', origen: 'RECONSTRUIDO',
    });

    const plan = actuacionOk(planRegistrarActuacion(
      'CON_ACTA_DE_OBSERVACIONES', [radicacionReconstruida, actaReconstruida], EXPEDIENTE_ID, TENANT,
      { tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }, ACTOR, AHORA,
    ));

    // Sin RADICACION_DEBIDA_FORMA real que ancle la proyección (R9 excluye
    // las RECONSTRUIDO), calcularVencimiento no tiene desde dónde proyectar
    // — null bajo AMBAS políticas, exactamente igual que on-read.
    expect(plan.fechaAlertaConservadora).toBeNull();
  });
});
