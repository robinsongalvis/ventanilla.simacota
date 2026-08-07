import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  planRequerirSubsanacion,
  planDesistimiento,
  esError,
  type PlanSubsanacion,
  type ErrorSubsanacion,
} from '@/lib/server/subsanacion';
import { getRegimenLegalSubsanacion } from '@/lib/catalogos/regimen-legal-subsanacion';
import { CATALOGO_TIPOS_SOLICITUD } from '@/lib/catalogos/tipos-solicitud';
import {
  buildRequerimientoHtml,
  type TemplateRequerimientoParams,
} from '@/lib/email/templates/requerimiento-subsanacion';
import { buildDesistimientoHtml, type TemplateDesistimientoParams } from '@/lib/email/templates/desistimiento';

/* Hallazgo severidad ALTA (6-ago-2026) — el requerimiento estándar de
   subsanación (Ley 1755 Art. 17) NO aplica a cualquier tipo de solicitud.
   Este archivo cubre el gate de régimen legal en `planRequerirSubsanacion`,
   la parametrización de las plantillas por `textos`/`fundamentoLegal`, y la
   advertencia de transición en `planDesistimiento`.

   Clasificación (incluida la reclasificación de HABEAS_DATA y
   PETICION_ENTES_CONTROL) validada por dictamen de gobierno-digital del
   6-ago-2026 — ver `lib/catalogos/regimen-legal-subsanacion.ts`. */

const ACTOR = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO' };
function local(y: number, m1: number, d: number): Date {
  return new Date(y, m1 - 1, d, 12, 0, 0, 0);
}
function mk(tipoSolicitudId: string | undefined): VentanillaRadicado {
  return {
    estadoActual: 'EN_PROCESO',
    control: { fechaRadicado: local(2026, 6, 1).toISOString() },
    termino: {
      tipoSolicitudId,
      fechaVencimiento: local(2026, 6, 22).toISOString(),
      suspension: null,
    },
  } as unknown as VentanillaRadicado;
}
/** Radicado EN_SUBSANACION con suspensión activa y plazo YA VENCIDO (para desistimiento). */
function mkConSuspensionVencida(tipoSolicitudId: string | undefined): VentanillaRadicado {
  return {
    estadoActual: 'EN_SUBSANACION',
    control: { fechaRadicado: local(2026, 6, 1).toISOString() },
    termino: {
      tipoSolicitudId,
      fechaVencimiento: local(2026, 6, 22).toISOString(),
      suspension: {
        activa: true,
        fechaRequerimiento: local(2026, 6, 3).toISOString(),
        fechaNotificacion: local(2026, 6, 3).toISOString(),
        fechaLimiteSubsanacion: local(2026, 7, 3).toISOString(),
        diasHabilesRestantes: 5,
        motivo: 'x',
        requeridoPor: { uid: 'u1', nombre: 'M' },
        prorroga: null,
      },
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

// 2 días hábiles tras radicación (2026-06-01) — dentro de la ventana de 10.
const AHORA = local(2026, 6, 3);
// Después del límite de subsanación (2026-07-03) — para desistimiento.
const AHORA_VENCIDO = local(2026, 7, 10);
const MOTIVO_SUFICIENTE = 'Falta el documento de identidad legible';
const MOTIVO_DESISTIMIENTO = 'El ciudadano no aportó lo requerido en el plazo legal.';

describe('gate de régimen legal — ESPECIAL_NO_HABILITADO (422, régimen propio no habilitado)', () => {
  it.each([
    'LICENCIA_CONSTRUCCION',
    'SOLICITUD_SUBDIVISION',
    'DECLARACION_RETENCION_ICA',
    'PERMISO_ESTABLECIMIENTO_PUBLICO',
    'QUERELLA',
    'URGENTE',
    'HABEAS_DATA',
    'PETICION_ENTES_CONTROL',
  ])('%s → 422', (tipoId) => {
    const e = err(planRequerirSubsanacion(mk(tipoId), ACTOR, MOTIVO_SUFICIENTE, AHORA, true));
    expect(e.status).toBe(422);
  });

  it('LICENCIA_CONSTRUCCION menciona el Decreto 1077 en el mensaje', () => {
    const e = err(planRequerirSubsanacion(mk('LICENCIA_CONSTRUCCION'), ACTOR, MOTIVO_SUFICIENTE, AHORA, true));
    expect(e.mensaje).toContain('Decreto 1077');
  });

  it('HABEAS_DATA menciona la Ley 1581 en el mensaje (dictamen 6-ago-2026)', () => {
    const e = err(planRequerirSubsanacion(mk('HABEAS_DATA'), ACTOR, MOTIVO_SUFICIENTE, AHORA, true));
    expect(e.mensaje).toContain('1581');
  });

  it('PETICION_ENTES_CONTROL menciona las potestades de vigilancia y control (dictamen 6-ago-2026)', () => {
    const e = err(planRequerirSubsanacion(mk('PETICION_ENTES_CONTROL'), ACTOR, MOTIVO_SUFICIENTE, AHORA, true));
    expect(e.mensaje).toContain('vigilancia y control');
  });

  it('el mensaje advierte que la plataforma NO suspenderá el término', () => {
    const e = err(planRequerirSubsanacion(mk('LICENCIA_CONSTRUCCION'), ACTOR, MOTIVO_SUFICIENTE, AHORA, true));
    expect(e.mensaje).toContain('NO suspenderá el término');
  });
});

describe('gate de régimen legal — NO_APLICA (422, tipo documental interno)', () => {
  it.each(['INFORMATIVO', 'INVITACION', 'RESPUESTA_A_SOLICITUD', 'SOLICITUD_SAC'])('%s → 422, no constituye petición ciudadana', (tipoId) => {
    const e = err(planRequerirSubsanacion(mk(tipoId), ACTOR, MOTIVO_SUFICIENTE, AHORA, true));
    expect(e.status).toBe(422);
    expect(e.mensaje).toContain('no constituye una petición ciudadana');
  });
});

describe('gate de régimen legal — LEY_1755 (plan válido, no bloquea)', () => {
  it.each(['PETICION_GENERAL', 'PETICION_ENTRE_AUTORIDADES', 'PETICION_INFORMACION_CORTA'])('%s → plan válido', (tipoId) => {
    const p = plan(planRequerirSubsanacion(mk(tipoId), ACTOR, MOTIVO_SUFICIENTE, AHORA, true));
    expect(p.evento.accion).toBe('SUBSANACION_NOTIFICADA');
    expect(p.nuevoEstado).toBe('EN_SUBSANACION');
  });

  it('radicado legacy SIN tipoSolicitudId → fallback LEY_1755, plan válido', () => {
    const p = plan(planRequerirSubsanacion(mk(undefined), ACTOR, MOTIVO_SUFICIENTE, AHORA, true));
    expect(p.evento.accion).toBe('SUBSANACION_NOTIFICADA');
  });
});

describe('cobertura del catálogo — todo tipo tiene régimen clasificado', () => {
  it('getRegimenLegalSubsanacion(t.id).clase está definida para todos los tipos del catálogo', () => {
    for (const t of CATALOGO_TIPOS_SOLICITUD) {
      const regimen = getRegimenLegalSubsanacion(t.id);
      expect(regimen.clase, `tipo sin clasificar: ${t.id}`).toBeDefined();
      expect(['LEY_1755', 'ESPECIAL_NO_HABILITADO', 'NO_APLICA']).toContain(regimen.clase);
    }
  });
});

describe('propiedad global — SOLO régimen LEY_1755 pasa el gate de planRequerirSubsanacion', () => {
  it('para CADA tipo del catálogo, clase !== LEY_1755 produce 422 y clase === LEY_1755 produce plan válido (independiente de cualquier fixture del motor de expedientes)', () => {
    for (const t of CATALOGO_TIPOS_SOLICITUD) {
      const regimen = getRegimenLegalSubsanacion(t.id);
      const resultado = planRequerirSubsanacion(mk(t.id), ACTOR, MOTIVO_SUFICIENTE, AHORA, true);
      if (regimen.clase === 'LEY_1755') {
        expect(esError(resultado), `tipo ${t.id} (régimen ${regimen.clase}) debería producir un plan válido`).toBe(false);
      } else {
        expect(esError(resultado), `tipo ${t.id} (régimen ${regimen.clase}) debería bloquearse con 422`).toBe(true);
        if (esError(resultado)) expect(resultado.status).toBe(422);
      }
    }
  });
});

describe('planDesistimiento — advertencia de transición (dictamen 6-ago-2026)', () => {
  it('tipo bloqueado (régimen en revisión, p. ej. HABEAS_DATA) con subsanación ya abierta y vencida → plan válido CON advertenciaRegimen', () => {
    const p = plan(planDesistimiento(mkConSuspensionVencida('HABEAS_DATA'), ACTOR, MOTIVO_DESISTIMIENTO, AHORA_VENCIDO));
    expect(p.update.estadoActual).toBe('DESISTIDO');
    expect(p.evento.metadata.advertenciaRegimen).toBeDefined();
    expect(String(p.evento.metadata.advertenciaRegimen)).toContain('revisión jurídica');
  });

  it('tipo LEY_1755 (p. ej. PETICION_GENERAL) → plan válido SIN advertenciaRegimen', () => {
    const p = plan(planDesistimiento(mkConSuspensionVencida('PETICION_GENERAL'), ACTOR, MOTIVO_DESISTIMIENTO, AHORA_VENCIDO));
    expect(p.update.estadoActual).toBe('DESISTIDO');
    expect(p.evento.metadata.advertenciaRegimen).toBeUndefined();
  });

  it('radicado legacy SIN tipoSolicitudId (fallback LEY_1755) → sin advertenciaRegimen', () => {
    const p = plan(planDesistimiento(mkConSuspensionVencida(undefined), ACTOR, MOTIVO_DESISTIMIENTO, AHORA_VENCIDO));
    expect(p.evento.metadata.advertenciaRegimen).toBeUndefined();
  });
});

describe('plantillas — el fundamento/plazo pasado por parámetro aparece escapado', () => {
  it('buildRequerimientoHtml incluye los textos sintéticos pasados por parámetro', () => {
    const params: TemplateRequerimientoParams = {
      radicadoId: '1-110-2026-00000099',
      ciudadanoNombre: 'Prueba <Sintética>',
      motivo: 'motivo de prueba',
      fechaLimite: '2026-07-03T12:00:00.000Z',
      textos: {
        plazoDescripcion: 'dos (2) meses <sintéticos>',
        prorrogaDescripcion: 'hasta por un término <sintético>',
        fundamentoLegal: 'Régimen Sintético de Prueba <Art. 0>',
      },
    };
    const html = buildRequerimientoHtml(params);
    expect(html).toContain('dos (2) meses &lt;sintéticos&gt;');
    expect(html).toContain('hasta por un término &lt;sintético&gt;');
    expect(html).toContain('Régimen Sintético de Prueba &lt;Art. 0&gt;');
    expect(html).not.toContain('<sintéticos>');
  });

  it('buildDesistimientoHtml incluye el fundamentoLegal pasado por parámetro', () => {
    const params: TemplateDesistimientoParams = {
      radicadoId: '1-110-2026-00000099',
      ciudadanoNombre: 'Prueba',
      motivo: 'motivo de prueba',
      fundamentoLegal: 'Régimen Sintético de Prueba <Art. 0>',
    };
    const html = buildDesistimientoHtml(params);
    expect(html).toContain('Régimen Sintético de Prueba &lt;Art. 0&gt;');
    expect(html).not.toContain('<Art. 0>');
  });
});
