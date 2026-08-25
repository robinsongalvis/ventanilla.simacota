import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  buildAuditoriaConsecutivosHtml,
  buildAuditoriaConsecutivosSubject,
  type TemplateAuditoriaConsecutivosParams,
  type SerieHallazgoAuditoria,
} from '@/lib/email/templates/auditoria-consecutivos';

/* A1 — auditoría AGN automática semanal: plantilla del correo de alerta
   (solo se envía cuando hay hallazgos) + cableado de la ruta cron. */

function serie(over: Partial<SerieHallazgoAuditoria> = {}): SerieHallazgoAuditoria {
  return {
    serie: 'radicados',
    coleccion: 'ventanilla_radicados',
    ultimo: 5,
    documentos: 4,
    distintos: 4,
    huecos: [3],
    duplicados: [],
    ...over,
  };
}

function base(over: Partial<TemplateAuditoriaConsecutivosParams> = {}): TemplateAuditoriaConsecutivosParams {
  return {
    anio: 2026,
    timestamp: new Date(2026, 6, 20, 8, 0, 0).toISOString(),
    series: [serie()],
    totalHuecos: 1,
    totalDuplicados: 0,
    ...over,
  };
}

describe('buildAuditoriaConsecutivosSubject', () => {
  it('formato exacto acordado: "[AUDITORÍA] N hallazgo(s) en las series de radicación {año}"', () => {
    expect(buildAuditoriaConsecutivosSubject(3, 2026)).toBe(
      '[AUDITORÍA] 3 hallazgo(s) en las series de radicación 2026',
    );
  });

  it('funciona igual con 1 solo hallazgo (no pluraliza el texto fijo)', () => {
    expect(buildAuditoriaConsecutivosSubject(1, 2026)).toBe(
      '[AUDITORÍA] 1 hallazgo(s) en las series de radicación 2026',
    );
  });
});

describe('buildAuditoriaConsecutivosHtml — identidad institucional', () => {
  it('usa el verde institucional #14532D y el dorado #D4A017 (misma identidad que alerta-vencimiento)', () => {
    const html = buildAuditoriaConsecutivosHtml(base());
    expect(html).toContain('#14532D');
    expect(html).toContain('#D4A017');
  });

  it('incluye la referencia a la Ley 1581 de 2012 en el pie institucional', () => {
    expect(buildAuditoriaConsecutivosHtml(base())).toContain('Ley 1581 de 2012');
  });

  it('referencia AGN 060 de 2001 (continuidad y unicidad de las series)', () => {
    expect(buildAuditoriaConsecutivosHtml(base())).toContain('AGN 060 de 2001');
  });

  it('menciona explícitamente que el sistema no corrige por sí solo (Principio 9)', () => {
    const html = buildAuditoriaConsecutivosHtml(base());
    expect(html.toLowerCase()).toContain('no corrige la serie por sí solo');
  });

  it('muestra el detalle por serie: nombre, colección, contador, huecos y duplicados', () => {
    const html = buildAuditoriaConsecutivosHtml(base({
      series: [serie({ serie: 'salidas', coleccion: 'ventanilla_salidas', ultimo: 7, huecos: [2, 5], duplicados: [6] })],
      totalHuecos: 2,
      totalDuplicados: 1,
    }));
    expect(html).toContain('salidas');
    expect(html).toContain('ventanilla_salidas');
    expect(html).toContain('[2, 5]');
    expect(html).toContain('[6]');
  });

  it('con varias series, incluye el detalle de cada una', () => {
    const html = buildAuditoriaConsecutivosHtml(base({
      series: [
        serie({ serie: 'radicados', coleccion: 'ventanilla_radicados' }),
        serie({ serie: 'planillas', coleccion: 'ventanilla_planillas', huecos: [], duplicados: [] }),
      ],
    }));
    expect(html).toContain('radicados');
    expect(html).toContain('planillas');
  });

  it('escapa HTML defensivamente (aunque el nombre de serie es de origen del sistema)', () => {
    const html = buildAuditoriaConsecutivosHtml(base({
      series: [serie({ serie: '<script>alert(1)</script>' })],
    }));
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('cableado del cron — solo lectura, reutiliza el detector, nunca corrige', () => {
  const s = readFileSync('app/api/cron/auditoria-consecutivos/route.ts', 'utf8');

  it('autoriza con autorizarCron', () => {
    expect(s).toContain("from '@/lib/seguridad/autorizar-cron'");
    expect(s).toContain('autorizarCron');
  });

  it('reutiliza las funciones puras del detector — no duplica el algoritmo', () => {
    expect(s).toContain("from '@/scripts/laboratorio/detectar-consecutivos-fantasma.mjs'");
    expect(s).toContain('huecosDe');
    expect(s).toContain('duplicadosDe');
    expect(s).toContain('consecutivoDeId');
    expect(s).toContain('perteneceAlAnio');
    expect(s).toContain('COLECCION_POR_SERIE');
  });

  it('barre las 3 series (radicados, salidas, planillas) vía el registro compartido, sin listarlas a mano', () => {
    expect(s).toContain('Object.entries(COLECCION_POR_SERIE)');
  });

  it('nunca escribe sobre counters ni colecciones de negocio (solo lectura absoluta)', () => {
    expect(s).not.toMatch(/\.set\(/);
    expect(s).not.toMatch(/\.update\(/);
    expect(s).not.toMatch(/\.delete\(/);
  });

  it('sin hallazgos no envía correo (silencio = todo bien) y con hallazgos sí', () => {
    expect(s).toContain('totalHallazgos === 0');
    expect(s).toContain('enviarEmail');
  });

  it('usa la plantilla extraída en vez de HTML inline', () => {
    expect(s).toContain('buildAuditoriaConsecutivosHtml');
    expect(s).toContain('buildAuditoriaConsecutivosSubject');
  });
});

describe('vercel.json — cron de auditoría de consecutivos', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    crons: { path: string; schedule: string }[];
  };

  it('corre lunes 8:00 a.m. Colombia (13:00 UTC)', () => {
    const cron = cfg.crons.find((c) => c.path === '/api/cron/auditoria-consecutivos');
    expect(cron?.schedule).toBe('0 13 * * 1');
  });

  it('no tocó los otros 2 crons existentes', () => {
    const alertas = cfg.crons.find((c) => c.path === '/api/cron/alertas-vencimiento');
    const desistimiento = cfg.crons.find((c) => c.path === '/api/cron/desistimiento-tacito');
    expect(alertas?.schedule).toBe('0 13 * * 1-5');
    expect(desistimiento?.schedule).toBe('0 6 * * *');
  });

  /* Antes esto era `toHaveLength(3)`: un número suelto que solo decía CUÁNTOS
     y no CUÁLES. Al añadir el vigía de licencias falló sin explicar nada —
     había que ir a git a averiguar si el cron nuevo era legítimo o un descuido.
     Enumerar el conjunto exacto conserva la protección (nadie añade ni quita un
     trabajo programado sin que esta prueba lo cante) y además dice, en el propio
     mensaje de fallo, qué apareció o qué desapareció. */
  it('los trabajos programados son EXACTAMENTE estos cuatro', () => {
    expect(cfg.crons.map((c) => c.path).sort()).toEqual([
      '/api/cron/alertas-vencimiento',
      '/api/cron/auditoria-consecutivos',
      '/api/cron/desistimiento-tacito',
      '/api/cron/vencimientos-licencias',
    ]);
  });

  it('el vigía de licencias corre en días hábiles, antes de la jornada', () => {
    const vigia = cfg.crons.find((c) => c.path === '/api/cron/vencimientos-licencias');
    expect(vigia?.schedule).toBe('30 12 * * 1-5'); // 7:30 de Bogotá, lunes a viernes
  });
});
