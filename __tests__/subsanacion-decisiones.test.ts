import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado, SuspensionTermino } from '@/src/types/ventanilla';
import {
  planRequerirSubsanacion,
  planProrrogaSubsanacion,
  planReactivarSubsanacion,
  planDesistimiento,
  esError,
  type PlanSubsanacion,
  type ErrorSubsanacion,
} from '@/lib/server/subsanacion';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

/* BM-B33 pieza (4) — decisiones puras de los endpoints de subsanación. */

const ACTOR = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO' };
function local(y: number, m1: number, d: number): Date {
  return new Date(y, m1 - 1, d, 12, 0, 0, 0);
}
function mk(opts: {
  estado?: string;
  fechaRadicado?: Date;
  fechaVencimiento?: Date;
  suspension?: Partial<SuspensionTermino> | null;
}): VentanillaRadicado {
  return {
    estadoActual: opts.estado ?? 'EN_PROCESO',
    control: { fechaRadicado: (opts.fechaRadicado ?? local(2026, 6, 1)).toISOString() },
    termino: {
      fechaVencimiento: (opts.fechaVencimiento ?? local(2026, 6, 22)).toISOString(),
      suspension: opts.suspension === null ? null : (opts.suspension as SuspensionTermino | undefined),
    },
  } as unknown as VentanillaRadicado;
}
function plan(x: PlanSubsanacion | ErrorSubsanacion): PlanSubsanacion {
  if (esError(x)) throw new Error(`esperaba plan, recibí error ${x.status}: ${x.mensaje}`);
  return x;
}
function err(x: PlanSubsanacion | ErrorSubsanacion): ErrorSubsanacion {
  if (!esError(x)) throw new Error('esperaba error, recibí plan');
  return x;
}

describe('requerir subsanación', () => {
  const ahora = local(2026, 6, 3); // 2 hábiles tras radicación (dentro de 10)

  it('rechaza motivo demasiado corto (400)', () => {
    expect(err(planRequerirSubsanacion(mk({}), ACTOR, 'falta', ahora, true)).status).toBe(400);
  });

  it('rechaza si ya está en subsanación (409)', () => {
    const r = mk({ suspension: { activa: true } as SuspensionTermino });
    expect(err(planRequerirSubsanacion(r, ACTOR, 'Falta el documento de identidad legible', ahora, true)).status).toBe(409);
  });

  it('rechaza fuera de la ventana de 10 días hábiles (409)', () => {
    const tarde = local(2026, 7, 15);
    expect(err(planRequerirSubsanacion(mk({}), ACTOR, 'Falta el documento de identidad legible', tarde, true)).status).toBe(409);
  });

  it('notificable → ancla la suspensión con reloj server-side y pasa a EN_SUBSANACION', () => {
    const r = mk({ fechaVencimiento: local(2026, 6, 22) });
    const p = plan(planRequerirSubsanacion(r, ACTOR, 'Falta el documento de identidad legible', ahora, true));
    const s = p.update['termino.suspension'] as SuspensionTermino;
    expect(s.activa).toBe(true);
    expect(s.fechaNotificacion).toBe(ahora.toISOString());
    // reloj capturado server-side = días hábiles restantes AL NOTIFICAR
    expect(s.diasHabilesRestantes).toBe(diasRestantesHabiles(r.termino!.fechaVencimiento, ahora));
    expect(String(s.fechaLimiteSubsanacion)).toContain('2026-07-03'); // +1 mes
    expect(p.update.estadoActual).toBe('EN_SUBSANACION');
    expect(p.evento.accion).toBe('SUBSANACION_NOTIFICADA');
  });

  it('NO notificable (ANONIMA) → registra requerimiento SIN anclar (término sigue corriendo)', () => {
    const p = plan(planRequerirSubsanacion(mk({}), ACTOR, 'Falta el documento de identidad legible', ahora, false));
    const s = p.update['termino.suspension'] as SuspensionTermino;
    expect(s.activa).toBe(false);
    expect(s.fechaNotificacion).toBeNull();
    expect(p.update.estadoActual).toBeUndefined();
    expect(p.evento.accion).toBe('REQUERIMIENTO_SUBSANACION');
    expect(p.evento.metadata.notificado).toBe(false);
  });
});

describe('prórroga', () => {
  const base: SuspensionTermino = {
    activa: true, fechaRequerimiento: local(2026, 6, 3).toISOString(),
    fechaNotificacion: local(2026, 6, 3).toISOString(),
    fechaLimiteSubsanacion: local(2026, 7, 3).toISOString(),
    diasHabilesRestantes: 10, motivo: 'x', requeridoPor: { uid: 'u1', nombre: 'M' }, prorroga: null,
  };

  it('sin subsanación activa → 409', () => {
    expect(err(planProrrogaSubsanacion(mk({ suspension: null }), ACTOR, local(2026, 6, 20))).status).toBe(409);
  });
  it('extemporánea (después del límite) → 409', () => {
    expect(err(planProrrogaSubsanacion(mk({ suspension: base }), ACTOR, local(2026, 7, 4))).status).toBe(409);
  });
  it('ya prorrogada → 409', () => {
    const conProrroga = { ...base, prorroga: { solicitada: true, fechaSolicitud: '', nuevaFechaLimite: '' } };
    expect(err(planProrrogaSubsanacion(mk({ suspension: conProrroga }), ACTOR, local(2026, 6, 20))).status).toBe(409);
  });
  it('oportuna (mismo día, inclusive) → concede +1 mes', () => {
    const p = plan(planProrrogaSubsanacion(mk({ suspension: base }), ACTOR, local(2026, 7, 3)));
    const pr = p.update['termino.suspension.prorroga'] as { nuevaFechaLimite: string };
    expect(pr.nuevaFechaLimite).toContain('2026-08-03');
    expect(p.evento.accion).toBe('PRORROGA_SUBSANACION');
  });
});

describe('reactivar', () => {
  const susp: SuspensionTermino = {
    activa: true, fechaRequerimiento: '', fechaNotificacion: local(2026, 6, 3).toISOString(),
    fechaLimiteSubsanacion: local(2026, 7, 3).toISOString(),
    diasHabilesRestantes: 5, motivo: 'x', requeridoPor: { uid: 'u1', nombre: 'M' }, prorroga: null,
  };

  it('sin subsanación activa → 409', () => {
    expect(err(planReactivarSubsanacion(mk({ suspension: null }), ACTOR, local(2026, 6, 25), true)).status).toBe(409);
  });
  it('subsanación parcial (no suficiente) → 400 y NO reactiva', () => {
    expect(err(planReactivarSubsanacion(mk({ estado: 'EN_SUBSANACION', suspension: susp }), ACTOR, local(2026, 6, 25), false)).status).toBe(400);
  });
  it('suficiente → nuevo vencimiento (5 hábiles desde el día siguiente) y EN_PROCESO', () => {
    const aporte = local(2026, 6, 25);
    const p = plan(planReactivarSubsanacion(mk({ estado: 'EN_SUBSANACION', suspension: susp }), ACTOR, aporte, true));
    const nuevoVenc = p.update['termino.fechaVencimiento'] as string;
    expect(diasRestantesHabiles(nuevoVenc, aporte)).toBe(5); // no reinicia, día siguiente
    expect(p.update['termino.suspension.activa']).toBe(false);
    expect(p.update.estadoActual).toBe('EN_PROCESO');
    expect(p.evento.accion).toBe('SUBSANACION_RECIBIDA');
  });
});

describe('desistimiento (acto humano)', () => {
  const vencida: SuspensionTermino = {
    activa: true, fechaRequerimiento: '', fechaNotificacion: local(2026, 6, 3).toISOString(),
    fechaLimiteSubsanacion: local(2026, 7, 3).toISOString(),
    diasHabilesRestantes: 5, motivo: 'x', requeridoPor: { uid: 'u1', nombre: 'M' }, prorroga: null,
  };

  it('motivo corto → 400', () => {
    expect(err(planDesistimiento(mk({ estado: 'EN_SUBSANACION', suspension: vencida }), ACTOR, 'no', local(2026, 7, 10))).status).toBe(400);
  });
  it('no vencido aún → 409 (no se archiva antes de tiempo)', () => {
    expect(err(planDesistimiento(mk({ estado: 'EN_SUBSANACION', suspension: vencida }), ACTOR, 'El ciudadano no aportó lo requerido en el plazo legal.', local(2026, 7, 2))).status).toBe(409);
  });
  it('vencido + en subsanación → DESISTIDO', () => {
    const p = plan(planDesistimiento(mk({ estado: 'EN_SUBSANACION', suspension: vencida }), ACTOR, 'El ciudadano no aportó lo requerido en el plazo legal.', local(2026, 7, 10)));
    expect(p.update.estadoActual).toBe('DESISTIDO');
    expect(p.update['termino.suspension.activa']).toBe(false);
    expect(p.evento.accion).toBe('DESISTIMIENTO_TACITO_CONFIRMADO');
  });
  it('con prórroga vigente NO procede desistimiento (usa la nueva fecha límite)', () => {
    const conProrroga = { ...vencida, prorroga: { solicitada: true, fechaSolicitud: '', nuevaFechaLimite: local(2026, 8, 3).toISOString() } };
    // 10 jul ya pasó el límite original (3 jul) pero NO la prórroga (3 ago).
    expect(err(planDesistimiento(mk({ estado: 'EN_SUBSANACION', suspension: conProrroga }), ACTOR, 'El ciudadano no aportó lo requerido en el plazo legal.', local(2026, 7, 10))).status).toBe(409);
  });
});
