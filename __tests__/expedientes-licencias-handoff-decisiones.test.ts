import { describe, expect, it } from 'vitest';
import {
  planCrearExpedienteDesdeRadicado,
  debeEnviarComunicacionExpediente,
  calcularFechaLimiteRespuestaActa,
  esErrorExpediente,
  type RadicadoParaHandoff,
  type PlanCrearExpedienteDesdeRadicado,
  planVincularRadicado,
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

  it('fechaAlertaConservadora (espejo R11): nace VACÍO — y sigue coincidiendo con lo que calcula el motor', () => {
    const plan = ok(planCrearExpedienteDesdeRadicado(radicadoBase(), { subtipos: ['CONSTRUCCION'] }, 'SEC_PLANEACION', ACTOR, AHORA));
    const esperado = calcularVencimientoDual(
      derivarEventosTermino([plan.primeraActuacion]),
      45, // PLAZO_DECISION_LICENCIA_DIAS_HABILES — solo como literal de comparación, no reimplementa el cómputo.
    ).fechaAlertaConservadora?.toISOString() ?? null;

    /* ADR-0033 §0 — el contrato CAMBIÓ a propósito: el expediente ya no nace en
       debida forma. Esta prueba afirmaba el comportamiento anterior y ahora
       afirma el nuevo. NO se invirtió la aserción sin más: el invariante que
       protegía —que el espejo coincide con lo que calcula el motor— se conserva
       intacto; lo que cambió es que ahora ambos valen null, porque no hay
       término que proyectar hasta la transición a debida forma. */
    expect(plan.expediente.fechaAlertaConservadora).toBe(esperado);
    expect(esperado).toBeNull();
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

describe('constancia al ciudadano — NUNCA con un número de demostración', () => {
  // Hallazgo del 13-ago-2026, verificando el flujo de punta a punta antes de
  // una demostración: la plantilla de la constancia afirma al ciudadano que
  // el número "identifica su trámite de manera única y permanente", y no
  // distingue el origen del número. Con el candado R10 cerrado, todo
  // expediente nace con `DEMO-{AA}-{8hex}`. Demostrar «Crear desde radicado»
  // en producción con el radicado de un ciudadano real le habría enviado, con
  // membrete de la Alcaldía, una constancia oficial de un número falso — y no
  // hay ruta de reenvío ni de corrección.
  const radicadoConCorreo = {
    solicitante: { email: 'ciudadano@ejemplo.com', tipoDocumento: 'CC', datosNoAportados: {} },
  } as unknown as Parameters<typeof debeEnviarComunicacionExpediente>[1];

  it('con número DEMO no se envía, y el motivo lo dice', () => {
    const gate = debeEnviarComunicacionExpediente(
      'licencia-construccion-obra-nueva',
      radicadoConCorreo,
      'DEMO-26-a1b2c3d4',
    );
    expect(gate.debeEnviar).toBe(false);
    expect(gate.motivo).toMatch(/DEMOSTRACIÓN/i);
  });

  it('el corte es ANTES que cualquier otra condición: ni siquiera mira el trámite', () => {
    // Un trámite no habilitado y un número demo darían ambos `false`; lo que
    // se fija aquí es CUÁL manda, para que el día que se habiliten más
    // trámites el demo siga cortando primero.
    const gate = debeEnviarComunicacionExpediente('tramite-cualquiera', radicadoConCorreo, 'DEMO-26-ffffffff');
    expect(gate.motivo).toMatch(/DEMOSTRACIÓN/i);
  });

  it('sin número (llamador antiguo) el comportamiento no cambia', () => {
    const conNumero = debeEnviarComunicacionExpediente('licencia-construccion-obra-nueva', radicadoConCorreo, '68745-0-26-0020');
    const sinNumero = debeEnviarComunicacionExpediente('licencia-construccion-obra-nueva', radicadoConCorreo);
    expect(sinNumero.debeEnviar).toBe(conNumero.debeEnviar);
  });

  it('con un número LEGAL sí se envía', () => {
    expect(
      debeEnviarComunicacionExpediente('licencia-construccion-obra-nueva', radicadoConCorreo, '68745-0-26-0020').debeEnviar,
    ).toBe(true);
  });
});

describe('planVincularRadicado — el expediente huérfano deja de ser un callejón sin salida', () => {
  // Hasta el 13-ago-2026, un expediente creado con «Radicar solicitud»
  // nacía con radicadoId null y NO había forma de vincularlo después. El
  // botón que lo creaba estaba al lado del correcto, en la misma barra:
  // equivocarse era irreversible y el expediente no podía llegar a ser un
  // trámite real.
  const ACTOR = { uid: 'u1', nombre: 'Funcionaria', rol: 'FUNCIONARIO' };
  const AHORA = new Date('2026-08-14T15:00:00.000Z');

  function expedienteHuerfano(overrides: Record<string, unknown> = {}) {
    return {
      id: 'exp-1',
      tenantId: 'SEC_PLANEACION',
      radicadoId: null,
      numeroExpediente: { numero: 'DEMO-26-aaaa1111', serieId: 'demo', año: 2026 },
      ...overrides,
    } as Parameters<typeof planVincularRadicado>[0];
  }

  function radicadoElegible(overrides: Record<string, unknown> = {}) {
    return {
      radicadoId: '1-110-202608-00000042',
      estadoActual: 'RADICADO',
      clasificacion: { oficinaDestino: 'SEC_PLANEACION' },
      solicitante: { nombreCompleto: 'Juan Pérez', numeroDocumento: '91234567' },
      ...overrides,
    } as Parameters<typeof planVincularRadicado>[1];
  }

  it('vincula: devuelve el vínculo del radicado y la actuación que lo deja trazado', () => {
    const plan = planVincularRadicado(expedienteHuerfano(), radicadoElegible(), ACTOR, AHORA);
    expect(esErrorExpediente(plan)).toBe(false);
    if (esErrorExpediente(plan)) return;
    expect(plan.vinculoRadicado).toMatchObject({ expedienteId: 'exp-1', numeroExpediente: 'DEMO-26-aaaa1111' });
    expect(plan.actuacion.tipo).toBe('vinculacion-radicado');
    expect(plan.actuacion.origen).toBe('REAL');
    expect(plan.actuacion.detalle).toContain('1-110-202608-00000042');
  });

  it('un expediente que YA tiene radicado no se re-vincula', () => {
    const plan = planVincularRadicado(
      expedienteHuerfano({ radicadoId: '1-110-202608-00000001' }),
      radicadoElegible(),
      ACTOR,
      AHORA,
    );
    expect(esErrorExpediente(plan)).toBe(true);
    if (!esErrorExpediente(plan)) return;
    expect(plan.status).toBe(409);
  });

  it('APLICA LA MISMA elegibilidad que el handoff: otra dependencia, cerrado, o ya vinculado', () => {
    // Es lo que impide que la unicidad del vínculo dependa de por dónde se
    // entró: las dos puertas comparten `verificarRadicadoVinculable`.
    const otraOficina = planVincularRadicado(
      expedienteHuerfano(), radicadoElegible({ clasificacion: { oficinaDestino: 'SEC_SALUD' } }), ACTOR, AHORA);
    expect(esErrorExpediente(otraOficina) && otraOficina.status).toBe(400);

    const yaVinculado = planVincularRadicado(
      expedienteHuerfano(),
      radicadoElegible({ vinculoExpediente: { expedienteId: 'otro', numeroExpediente: 'X', fecha: '2026-01-01' } }),
      ACTOR, AHORA);
    expect(esErrorExpediente(yaVinculado) && yaVinculado.status).toBe(409);
  });

  it('sin numeroExpediente cae al id, nunca deja el vínculo sin identificar', () => {
    const plan = planVincularRadicado(expedienteHuerfano({ numeroExpediente: undefined }), radicadoElegible(), ACTOR, AHORA);
    expect(esErrorExpediente(plan)).toBe(false);
    if (esErrorExpediente(plan)) return;
    expect(plan.vinculoRadicado.numeroExpediente).toBe('exp-1');
  });
});
