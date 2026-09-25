import { describe, expect, it } from 'vitest';
import {
  resolverDestinatario,
  debeAdvertirSinDestinatario,
} from '@/lib/motor-expedientes/destinatario-expediente';

/**
 * A QUIÉN SE LE ESCRIBE — UNA FUENTE, CON PRECEDENCIA.
 *
 * El expediente de licencias guardaba nombre y documento y nada más: todo el
 * sistema de avisos se construyó sobre un dato que el expediente nunca tuvo.
 *
 * ── ALCANCE (ADR-0033 §4.6-bis) ─────────────────────────────────────────
 * QUÉ MIRA: el ORDEN de precedencia y que la captura propia nunca supla a un
 * radicado vinculado; que «declara no tener» sea un hecho y no un vacío; y que
 * cuando no hay destinatario se diga por qué.
 * QUÉ NO MIRA: si un correo concreto es notificable — eso lo decide
 * `debeNotificarCiudadano`, que este módulo REUTILIZA en vez de reimplementar.
 * Tampoco mira el envío: aquí no se manda nada.
 */

const CAPTURA = { correo: 'ciudadano@ejemplo.com', celular: '3001234567', capturadoEn: '2026-08-29T12:00:00.000Z' };

describe('el radicado vinculado manda, siempre', () => {
  it('con radicado, el destinatario es el suyo aunque haya captura propia', () => {
    const d = resolverDestinatario({
      radicado: { solicitante: { email: 'delradicado@ejemplo.com' } },
      capturaPropia: CAPTURA,
    });
    expect(d.correo).toBe('delradicado@ejemplo.com');
    expect(d.origen).toBe('RADICADO_VINCULADO');
  });

  it('y la captura propia queda marcada como DESPLAZADA, no borrada', () => {
    /* Un dato que fue cierto no se destruye: se le retira la autoridad. La
       pantalla lo enseña como histórico de lo recogido en mostrador. */
    const d = resolverDestinatario({
      radicado: { solicitante: { email: 'delradicado@ejemplo.com' } },
      capturaPropia: CAPTURA,
    });
    expect(d.capturaPropiaDesplazada).toBe(true);
  });

  it('SIN correo en el radicado NO se cae a la captura propia', () => {
    /* Caerse sería tener dos fuentes disfrazadas de una — exactamente lo que
       esta precedencia existe para impedir. */
    const d = resolverDestinatario({
      radicado: { solicitante: { email: '' } },
      capturaPropia: CAPTURA,
    });
    expect(d.correo).toBeNull();
    expect(d.motivo).toMatch(/lo manda el radicado: actualícelo allí/);
  });

  it('anónimo o reservado tampoco recibe, aunque traiga correo', () => {
    const d = resolverDestinatario({
      radicado: { esAnonimo: true, solicitante: { email: 'x@ejemplo.com' } },
    });
    expect(d.correo).toBeNull();
  });
});

describe('sin radicado, manda la captura propia', () => {
  it('el expediente huérfano usa su propio correo', () => {
    const d = resolverDestinatario({ capturaPropia: CAPTURA });
    expect(d.correo).toBe('ciudadano@ejemplo.com');
    expect(d.origen).toBe('CAPTURA_PROPIA');
  });

  it('«declara no tener» es un HECHO REGISTRADO, no un vacío', () => {
    const d = resolverDestinatario({ capturaPropia: { datosNoAportados: { correo: true } } });
    expect(d.origen).toBe('DECLARADO_SIN_CORREO');
    expect(d.motivo).toMatch(/manifestó no tener correo/);
  });

  it('un correo mal formado no pasa: se valida con el criterio de ventanilla', () => {
    const d = resolverDestinatario({ capturaPropia: { correo: 'esto-no-es-un-correo' } });
    expect(d.correo).toBeNull();
    expect(d.origen).toBe('SIN_DATOS');
  });
});

describe('cuando no hay a quién escribirle, se dice por qué', () => {
  it('sin nada de nada, el motivo nombra la consecuencia', () => {
    const d = resolverDestinatario({});
    expect(d.origen).toBe('SIN_DATOS');
    expect(d.motivo).toMatch(/no recibirá ningún aviso automático/);
  });

  it('se advierte en pantalla exactamente cuando no se puede escribir', () => {
    expect(debeAdvertirSinDestinatario(resolverDestinatario({}))).toBe(true);
    expect(debeAdvertirSinDestinatario(resolverDestinatario({ capturaPropia: { datosNoAportados: { correo: true } } }))).toBe(true);
    expect(debeAdvertirSinDestinatario(resolverDestinatario({ capturaPropia: CAPTURA }))).toBe(false);
  });

  it('el silencio nunca se confunde con una declaración', () => {
    /* Vacío sin declarar y «declara no tener» son estados DISTINTOS: el
       primero es un descuido que hay que corregir, el segundo un hecho del
       expediente. Colapsarlos escondería el descuido. */
    expect(resolverDestinatario({}).origen).toBe('SIN_DATOS');
    expect(resolverDestinatario({ capturaPropia: { datosNoAportados: { correo: true } } }).origen)
      .toBe('DECLARADO_SIN_CORREO');
  });
});

/* ══════════════════════════════════════════════════════════════
   LA CAPTURA EN EL NACIMIENTO — no se puede callar.
══════════════════════════════════════════════════════════════ */
import { planCrearExpedienteDemo } from '@/lib/server/expedientes-licencias';

const ACTOR = { uid: 'u1', nombre: 'Funcionaria', rol: 'FUNCIONARIO' as const };
const AHORA = new Date('2026-08-29T15:00:00.000Z');
const BASE = {
  solicitanteNombre: 'María Ospina',
  solicitanteDocumento: '37845219',
  subtipos: ['CONSTRUCCION'],
};
const err = (x: unknown) => x as { status: number; mensaje: string };

describe('un expediente sin radicado no puede nacer sin decidir el correo', () => {
  it('sin correo y sin declararlo → 400, y el motivo dice la consecuencia', () => {
    const e = err(planCrearExpedienteDemo(BASE as never, 'SEC_PLANEACION', ACTOR, AHORA));
    expect(e.status).toBe(400);
    expect(e.mensaje).toMatch(/no podrá recibir ningún aviso/);
  });

  it('con correo, nace y lo guarda', () => {
    const plan = planCrearExpedienteDemo(
      { ...BASE, contacto: { correo: 'maria@ejemplo.com', celular: '3001234567' } } as never,
      'SEC_PLANEACION', ACTOR, AHORA,
    ) as { expediente: { solicitanteContacto?: { correo?: string; celular?: string; capturadoEn?: string } } };
    expect(plan.expediente.solicitanteContacto?.correo).toBe('maria@ejemplo.com');
    expect(plan.expediente.solicitanteContacto?.celular).toBe('3001234567');
    expect(plan.expediente.solicitanteContacto?.capturadoEn).toBeTruthy();
  });

  it('declarando que NO tiene, también nace — y queda la constancia', () => {
    const plan = planCrearExpedienteDemo(
      { ...BASE, contacto: { datosNoAportados: { correo: true } } } as never,
      'SEC_PLANEACION', ACTOR, AHORA,
    ) as { expediente: { solicitanteContacto?: { datosNoAportados?: { correo?: boolean }; correo?: string } } };
    expect(plan.expediente.solicitanteContacto?.datosNoAportados?.correo).toBe(true);
    expect(plan.expediente.solicitanteContacto?.correo).toBeUndefined();
  });

  it('no se puede declarar que no tiene Y registrar uno', () => {
    const e = err(planCrearExpedienteDemo(
      { ...BASE, contacto: { correo: 'x@ejemplo.com', datosNoAportados: { correo: true } } } as never,
      'SEC_PLANEACION', ACTOR, AHORA,
    ));
    expect(e.status).toBe(400);
  });

  it('EL CELULAR SE GUARDA aunque WhatsApp/SMS estén aplazados', () => {
    /* Decidido para PQRSD y aplicado aquí: capturarlo desde ya evita perseguir
       después a ciudadanos ya atendidos. */
    const plan = planCrearExpedienteDemo(
      { ...BASE, contacto: { datosNoAportados: { correo: true }, celular: '3009998877' } } as never,
      'SEC_PLANEACION', ACTOR, AHORA,
    ) as { expediente: { solicitanteContacto?: { celular?: string } } };
    expect(plan.expediente.solicitanteContacto?.celular).toBe('3009998877');
  });
});

describe('la declaración manda sobre el campo, también en el radicado', () => {
  /* REGRESIÓN REAL, introducida al unificar la cadena de condiciones el
     29-ago-2026 y cazada por la prueba que ya existía en
     `expedientes-licencias-handoff-decisiones.test.ts`.

     Un radicado puede traer correo en el campo Y la marca de que el ciudadano
     NO lo aportó. Escribirle sería pasar por encima de lo que él dijo — y
     `debeNotificarCiudadano` no lo impide: valida el campo, no las
     declaraciones. */
  it('con correo en el campo pero «no aporta» declarado, NO se le escribe', () => {
    const d = resolverDestinatario({
      radicado: {
        solicitante: { email: 'quedo-escrito@ejemplo.com', datosNoAportados: { correo: true } },
      },
    });
    expect(d.correo).toBeNull();
    expect(d.origen).toBe('DECLARADO_SIN_CORREO');
    expect(d.motivo).toMatch(/al radicar en ventanilla/);
  });
});
