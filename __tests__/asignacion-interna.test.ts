import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  buildAsignacionInternaHtml,
  buildAsignacionInternaSubject,
} from '@/lib/email/templates/asignacion-interna';

/* ══════════════════════════════════════════════════════════════
   BM-B17 — Correo interno de "Asignación de solicitud".
   Fuente oficial: M-GSC-8200-170-002 (Paso 16). Ortogonal a H3.
══════════════════════════════════════════════════════════════ */

describe('BM-B17 — plantilla de correo interno de asignación', () => {
  const base = {
    radicadoId: '1-110-2026-00000042',
    dependenciaNombre: 'Secretaría de Hacienda',
    asunto: 'Solicitud de paz y salvo de predial',
    tipoSolicitudNombre: 'Petición general',
    fechaVencimiento: '2026-08-01T09:00:00.000Z',
    asignadoPor: 'María García',
  };

  it('el asunto lleva el radicado', () => {
    expect(buildAsignacionInternaSubject(base.radicadoId))
      .toBe('Asignación de solicitud — 1-110-2026-00000042');
  });

  it('el cuerpo muestra radicado, asunto, tipo, dependencia y quién asignó', () => {
    const html = buildAsignacionInternaHtml(base);
    expect(html).toContain('1-110-2026-00000042');
    expect(html).toContain('Solicitud de paz y salvo de predial');
    expect(html).toContain('Petición general');
    expect(html).toContain('Secretaría de Hacienda');
    expect(html).toContain('María García');
  });

  it('un radicado sin término se muestra como "Sin término legal"', () => {
    const html = buildAsignacionInternaHtml({ ...base, fechaVencimiento: null });
    expect(html).toContain('Sin término legal');
  });

  it('escapa el HTML del asunto (no inyecta markup)', () => {
    const html = buildAsignacionInternaHtml({ ...base, asunto: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('es un aviso interno: no incluye campos de identidad del solicitante', () => {
    // La plantilla no recibe datos del solicitante por diseño (identidad
    // reservada/anónimos protegidos). Verificamos que su contrato no los admite.
    const html = buildAsignacionInternaHtml(base);
    expect(html).not.toContain('solicitante');
    expect(html).not.toContain('cedula');
  });
});

describe('BM-B17 — la asignación dispara el correo interno a la dependencia', () => {
  it('la ruta envía ASIGNACION_INTERNA al email oficial de la dependencia', () => {
    const route = readFileSync('app/api/radicados/[radicadoId]/asignar/route.ts', 'utf8');
    expect(route).toContain('buildAsignacionInternaSubject');
    expect(route).toContain("tipoNotificacion: 'ASIGNACION_INTERNA'");
    expect(route).toContain('dependenciaDestino.emailOficial');
  });
});
