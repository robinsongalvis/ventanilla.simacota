import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  buildRequerimientoHtml,
  buildRequerimientoSubject,
} from '@/lib/email/templates/requerimiento-subsanacion';

/* BM-B33 pieza (4) — plantilla del requerimiento + cableado de las rutas. */

describe('plantilla del requerimiento de subsanación (contenido mínimo Art. 17)', () => {
  const base = {
    radicadoId: '1-110-2026-00000007',
    ciudadanoNombre: 'Juan Pérez',
    motivo: 'Adjuntar copia legible del documento de identidad',
    fechaLimite: '2026-07-03T12:00:00.000Z',
  };

  it('el asunto lleva el radicado', () => {
    expect(buildRequerimientoSubject(base.radicadoId)).toContain('1-110-2026-00000007');
  });

  it('el cuerpo incluye motivo, plazo de 1 mes, prórroga y advertencia de desistimiento', () => {
    const html = buildRequerimientoHtml(base);
    expect(html).toContain('Adjuntar copia legible del documento de identidad');
    expect(html).toContain('un (1) mes');
    expect(html).toContain('prórroga');
    expect(html.toLowerCase()).toContain('desist');
    expect(html).toContain('artículo 17');
  });

  it('escapa el HTML del motivo', () => {
    const html = buildRequerimientoHtml({ ...base, motivo: '<b>x</b>' });
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

describe('cableado de las rutas — permisos y reloj server-side', () => {
  const R = (p: string) => readFileSync(`app/api/radicados/[radicadoId]/${p}/route.ts`, 'utf8');

  it('requerir-subsanacion: funcionario del tenant + decide notificable + reloj server-side', () => {
    const s = R('requerir-subsanacion');
    expect(s).toContain('canOperateTenant');
    expect(s).toContain('planRequerirSubsanacion');
    expect(s).toContain('debeNotificarCiudadano');
    expect(s).toContain('const ahora = new Date()');
  });

  it('desistimiento: exige rol superior (canConfirmarDesistimiento)', () => {
    const s = R('desistimiento');
    expect(s).toContain('canConfirmarDesistimiento');
    expect(s).toContain('planDesistimiento');
  });

  it('desistimiento: notifica el acto solo con consentimiento electrónico (CPACA Art. 56)', () => {
    const s = R('desistimiento');
    expect(s).toContain("canalRespuesta === 'CORREO'");
    expect(s).toContain('requiereNotificacionPersonal');
  });

  it('reactivar-subsanacion: suficiencia explícita (parcial no reactiva)', () => {
    const s = R('reactivar-subsanacion');
    expect(s).toContain('planReactivarSubsanacion');
    expect(s).toContain('suficiente');
  });

  it('las rutas NO toman fechas del reloj legal del body (solo motivo/suficiente)', () => {
    for (const p of ['requerir-subsanacion', 'prorroga-subsanacion', 'reactivar-subsanacion', 'desistimiento']) {
      const s = R(p);
      expect(s).not.toContain('body?.fecha');
      expect(s).not.toContain('diasHabilesRestantes:');
    }
  });
});
