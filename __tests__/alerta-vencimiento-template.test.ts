import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  buildAlertaVencimientoHtml,
  buildAlertaVencimientoSubject,
  type TemplateAlertaVencimientoParams,
} from '@/lib/email/templates/alerta-vencimiento';

/* Correo de alerta de vencimiento — rediseño institucional (verde/dorado)
   + saludo digno (nunca "No registrado") + horario de cron a las 8:00 a.m. */

function base(over: Partial<TemplateAlertaVencimientoParams> = {}): TemplateAlertaVencimientoParams {
  return {
    radicadoId:        '1-110-2026-00000042',
    funcionarioNombre: 'Ana María Rueda',
    asunto:            'Solicitud de copia de historia laboral',
    ciudadanoNombre:   'Carlos Pérez',
    dependenciaNombre: 'Secretaría de Gobierno',
    diasRestantes:     1,
    fechaVencimiento:  new Date(2026, 6, 20, 12, 0, 0).toISOString(),
    tipoSolicitud:     'Derecho de petición',
    enlaceUrl:         'https://ventanilla-simacota.vercel.app/interno/dashboard',
    ...over,
  };
}

describe('buildAlertaVencimientoHtml — identidad institucional', () => {
  it('usa el título "Alerta de vencimiento"', () => {
    expect(buildAlertaVencimientoHtml(base())).toContain('Alerta de vencimiento');
  });

  it('usa el verde institucional #14532D y el dorado #D4A017 (no la paleta índigo anterior)', () => {
    const html = buildAlertaVencimientoHtml(base());
    expect(html).toContain('#14532D');
    expect(html).toContain('#D4A017');
    expect(html).not.toContain('#1a237e');
    expect(html).not.toContain('#5c6bc0');
  });

  it('incluye la referencia a la Ley 1581 de 2012 en el pie institucional', () => {
    expect(buildAlertaVencimientoHtml(base())).toContain('Ley 1581 de 2012');
  });

  it('incluye la referencia a la Ley 1755 de 2015 en el cuerpo', () => {
    expect(buildAlertaVencimientoHtml(base())).toContain('Ley 1755 de 2015');
  });

  it('nunca trunca el radicado y lo muestra completo', () => {
    const html = buildAlertaVencimientoHtml(base({ radicadoId: '1-110-2026-00000042' }));
    expect(html).toContain('1-110-2026-00000042');
  });

  it('conserva los datos que ya mostraba la plantilla previa (ciudadano y tipo de solicitud)', () => {
    const html = buildAlertaVencimientoHtml(base());
    expect(html).toContain('Carlos Pérez');
    expect(html).toContain('Derecho de petición');
  });

  it('incluye el botón CTA hacia el enlace del radicado', () => {
    const html = buildAlertaVencimientoHtml(base());
    expect(html).toContain('Abrir el radicado en la Ventanilla');
    expect(html).toContain('https://ventanilla-simacota.vercel.app/interno/dashboard');
  });

  it('escapa HTML en campos dinámicos (asunto, ciudadano, dependencia, radicado)', () => {
    const html = buildAlertaVencimientoHtml(base({ asunto: '<script>alert(1)</script>' }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('buildAlertaVencimientoHtml — saludo digno', () => {
  it('con nombre real, saluda "Estimado/a {nombre}"', () => {
    const html = buildAlertaVencimientoHtml(base({ funcionarioNombre: 'Ana María Rueda' }));
    expect(html).toContain('Estimado/a');
    expect(html).toContain('Ana María Rueda');
    expect(html).not.toContain('No registrado');
  });

  it('con nombre vacío, saluda "Estimado equipo de {dependencia}" y NUNCA imprime "No registrado"', () => {
    const html = buildAlertaVencimientoHtml(base({ funcionarioNombre: '', dependenciaNombre: 'Secretaría de Gobierno' }));
    expect(html).toContain('Estimado equipo de');
    expect(html).toContain('Secretaría de Gobierno');
    expect(html).not.toContain('No registrado');
  });

  it('con funcionarioNombre literal "No registrado", saluda a la dependencia y NUNCA imprime "No registrado"', () => {
    const html = buildAlertaVencimientoHtml(base({ funcionarioNombre: 'No registrado', dependenciaNombre: 'Secretaría de Planeación' }));
    expect(html).toContain('Estimado equipo de');
    expect(html).toContain('Secretaría de Planeación');
    expect(html).not.toContain('No registrado');
  });

  it('con nombre en blanco (solo espacios), saluda a la dependencia', () => {
    const html = buildAlertaVencimientoHtml(base({ funcionarioNombre: '   ', dependenciaNombre: 'Secretaría de Hacienda' }));
    expect(html).toContain('Estimado equipo de');
    expect(html).not.toContain('No registrado');
  });
});

describe('buildAlertaVencimientoHtml — niveles de urgencia', () => {
  it('vence hoy → "VENCE HOY"', () => {
    expect(buildAlertaVencimientoHtml(base({ diasRestantes: 0 }))).toContain('VENCE HOY');
  });

  it('vence en 1 día → "VENCE EN 1 DÍA HÁBIL" (singular)', () => {
    expect(buildAlertaVencimientoHtml(base({ diasRestantes: 1 }))).toContain('VENCE EN 1 DÍA HÁBIL');
  });

  it('vence en 2 días → "VENCE EN 2 DÍAS HÁBILES" (plural)', () => {
    expect(buildAlertaVencimientoHtml(base({ diasRestantes: 2 }))).toContain('VENCE EN 2 DÍAS HÁBILES');
  });
});

describe('buildAlertaVencimientoSubject', () => {
  it('vence hoy → asunto URGENTE', () => {
    expect(buildAlertaVencimientoSubject('1-110-2026-00000042', 0)).toContain('URGENTE');
  });

  it('vence en N días → asunto ALERTA con el radicado', () => {
    const s = buildAlertaVencimientoSubject('1-110-2026-00000042', 2);
    expect(s).toContain('ALERTA');
    expect(s).toContain('1-110-2026-00000042');
  });
});

describe('cableado del cron — no toca lógica funcional', () => {
  const s = readFileSync('app/api/cron/alertas-vencimiento/route.ts', 'utf8');

  it('sigue autorizando con autorizarCron y filtrando isTest/excludeFromMetrics', () => {
    expect(s).toContain('autorizarCron');
    expect(s).toContain('isTest');
    expect(s).toContain('excludeFromMetrics');
  });

  it('conserva el umbral de 2 días hábiles y los estados activos', () => {
    expect(s).toContain('UMBRAL_DIAS = 2');
    expect(s).toContain('PENDIENTE');
    expect(s).toContain('PRORROGA');
  });

  it('usa la plantilla extraída en vez de HTML inline', () => {
    expect(s).toContain('buildAlertaVencimientoHtml');
    expect(s).toContain('buildAlertaVencimientoSubject');
  });
});

describe('vercel.json — horario del cron de alertas', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    crons: { path: string; schedule: string }[];
  };

  it('alertas-vencimiento corre a las 8:00 a.m. Colombia (13:00 UTC), lunes a viernes', () => {
    const cron = cfg.crons.find((c) => c.path === '/api/cron/alertas-vencimiento');
    expect(cron?.schedule).toBe('0 13 * * 1-5');
  });

  it('desistimiento-tacito no fue tocado', () => {
    const cron = cfg.crons.find((c) => c.path === '/api/cron/desistimiento-tacito');
    expect(cron?.schedule).toBe('0 6 * * *');
  });
});
