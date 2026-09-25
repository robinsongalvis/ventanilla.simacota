import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado, SuspensionTermino } from '@/src/types/ventanilla';
import {
  debeProponerDesistimiento,
  planPropuestaDesistimiento,
} from '@/lib/server/subsanacion';
import {
  buildDesistimientoHtml,
  buildDesistimientoSubject,
} from '@/lib/email/templates/desistimiento';
import { TEXTOS_SUBSANACION_LEY_1755 } from '@/lib/catalogos/regimen-legal-subsanacion';

/* BM-B33 pieza (5) — cron de desistimiento (solo PROPONE) + plantilla del acto. */

function local(y: number, m1: number, d: number): Date {
  return new Date(y, m1 - 1, d, 12, 0, 0, 0);
}
function suspension(over: Partial<SuspensionTermino> = {}): SuspensionTermino {
  return {
    activa: true, fechaRequerimiento: '', fechaNotificacion: local(2026, 6, 3).toISOString(),
    fechaLimiteSubsanacion: local(2026, 7, 3).toISOString(),
    diasHabilesRestantes: 5, motivo: 'x', requeridoPor: { uid: 'u', nombre: 'M' },
    prorroga: null, desistimientoPropuesto: null, ...over,
  };
}
function mk(estado: string, s: SuspensionTermino | null): VentanillaRadicado {
  return { estadoActual: estado, termino: { suspension: s } } as unknown as VentanillaRadicado;
}

describe('debeProponerDesistimiento (cron solo propone)', () => {
  const vencido = local(2026, 7, 10); // pasó el 3 jul

  it('EN_SUBSANACION + vencido + no propuesto → true', () => {
    expect(debeProponerDesistimiento(mk('EN_SUBSANACION', suspension()), vencido)).toBe(true);
  });
  it('con prórroga vigente (nuevo límite futuro) → false', () => {
    const s = suspension({ prorroga: { solicitada: true, fechaSolicitud: '', nuevaFechaLimite: local(2026, 8, 3).toISOString() } });
    expect(debeProponerDesistimiento(mk('EN_SUBSANACION', s), vencido)).toBe(false);
  });
  it('ya propuesto → false (idempotencia)', () => {
    expect(debeProponerDesistimiento(mk('EN_SUBSANACION', suspension({ desistimientoPropuesto: true })), vencido)).toBe(false);
  });
  it('no vencido aún → false', () => {
    expect(debeProponerDesistimiento(mk('EN_SUBSANACION', suspension()), local(2026, 7, 2))).toBe(false);
  });
  it('no está en subsanación → false', () => {
    expect(debeProponerDesistimiento(mk('EN_PROCESO', suspension({ activa: false })), vencido)).toBe(false);
  });
});

describe('planPropuestaDesistimiento — NO cambia el estado', () => {
  it('marca idempotencia y emite el evento, sin tocar estadoActual', () => {
    const p = planPropuestaDesistimiento(mk('EN_SUBSANACION', suspension()), local(2026, 7, 10));
    expect(p.update['termino.suspension.desistimientoPropuesto']).toBe(true);
    expect(p.update.estadoActual).toBeUndefined();       // NUNCA archiva
    expect(p.evento.accion).toBe('DESISTIMIENTO_TACITO_PROPUESTO');
  });
});

describe('plantilla del acto de desistimiento', () => {
  const base = {
    radicadoId: '1-110-2026-00000009',
    ciudadanoNombre: 'Ana',
    motivo: 'No aportó lo requerido.',
    fundamentoLegal: TEXTOS_SUBSANACION_LEY_1755.fundamentoLegal,
  };
  it('asunto con radicado', () => {
    expect(buildDesistimientoSubject(base.radicadoId)).toContain('1-110-2026-00000009');
  });
  it('menciona desistimiento, Art.17 y recurso de reposición; escapa HTML', () => {
    const html = buildDesistimientoHtml({ ...base, motivo: '<i>x</i>' });
    expect(html.toLowerCase()).toContain('desistimiento');
    expect(html).toContain('artículo 17');
    expect(html.toLowerCase()).toContain('recurso de reposición');
    expect(html).not.toContain('<i>x</i>');
  });
});

/* ALCANCE DECLARADO (ADR-0033 §4.6-bis): este bloque solo LEE EL FUENTE. Que
   una cadena aparezca en el archivo no prueba que el mecanismo funcione: al
   quitar del `.filter(...)` la exclusión de datos de prueba, la palabra
   «isTest» sobrevive en el `.map(...)` de la línea anterior y esto seguía en
   verde. Lo EJECUTABLE —que solo la operación real sale propuesta, y que sin
   credencial el trabajo ni empieza— vive en
   `__tests__/subsanacion-cron-ejecucion.test.ts`. Se conserva porque las
   ausencias (`not.toContain`) sí son concluyentes sobre el texto: afirman que
   algo NO está escrito, y para eso leer el archivo es la herramienta correcta. */
describe('cableado del cron — lectura del FUENTE, no ejecución', () => {
  const s = readFileSync('app/api/cron/desistimiento-tacito/route.ts', 'utf8');
  it('el fuente NOMBRA autorizarCron e isTest (solo eso: no prueba que filtren)', () => {
    expect(s).toContain('autorizarCron');
    expect(s).toContain('isTest');
  });
  it('usa la función pura y NO escribe estado DESISTIDO', () => {
    expect(s).toContain('debeProponerDesistimiento');
    expect(s).toContain('planPropuestaDesistimiento');
    expect(s).not.toContain("'DESISTIDO'");
    expect(s).not.toContain('estadoActual:');
  });
});
