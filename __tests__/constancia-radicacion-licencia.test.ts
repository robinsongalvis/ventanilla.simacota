import { describe, it, expect } from 'vitest';
import {
  buildConstanciaRadicacionLicenciaHtml,
  nombreArchivoConstancia,
} from '@/lib/constancias/constancia-radicacion-licencia';

/**
 * El papel que el ciudadano se lleva en la mano. Acredita un hecho con efectos
 * legales, así que lo que NO puede decir pesa tanto como lo que dice.
 */
const BASE = {
  numeroRadicado: '1-110-202608-00001342',
  solicitanteNombre: 'Ana Lucía Martínez Peña',
  solicitanteDocumento: '37451209',
  tipoDocumento: 'CC',
  descripcionTramite: 'licencia de construcción — obra nueva',
  desdeCuandoCorreElPlazo: '2026-08-18T12:00:00.000Z',
  venceEl: '2026-10-21T12:00:00.000Z',
  requisitosVerificados: 17,
  funcionarioNombre: 'Ing. Planeación',
  expedidaEn: '2026-08-26T12:00:00.000Z',
};

describe('la constancia lleva lo que el ciudadano necesita', () => {
  it('el número del libro, destacado y completo', () => {
    const html = buildConstanciaRadicacionLicenciaHtml(BASE);
    expect(html).toContain('1-110-202608-00001342');
    expect(html).toMatch(/Número de radicado/i);
  });

  it('desde cuándo corre el plazo y cuándo vence, en castellano', () => {
    const html = buildConstanciaRadicacionLicenciaHtml(BASE);
    expect(html).toMatch(/corre desde el/i);
    expect(html).toMatch(/18 de agosto de 2026/);
    expect(html).toMatch(/21 de octubre de 2026/);
    expect(html).toContain('2.2.6.1.2.3.1');
  });

  it('quién declaró la radicación: el acto tiene autor', () => {
    expect(buildConstanciaRadicacionLicenciaHtml(BASE)).toContain('Ing. Planeación');
  });

  it('cuántos requisitos se verificaron', () => {
    expect(buildConstanciaRadicacionLicenciaHtml(BASE)).toMatch(/Requisitos verificados[\s\S]{0,80}17/);
  });

  it('se puede imprimir: trae estilos de impresión y oculta el botón al imprimir', () => {
    const html = buildConstanciaRadicacionLicenciaHtml(BASE);
    expect(html).toContain('@media print');
    expect(html).toMatch(/\.imprimir\{display:none\}/);
  });
});

describe('la constancia — lo que NO puede afirmar', () => {
  it('no dice que la licencia esté concedida ni anticipa la decisión', () => {
    const html = buildConstanciaRadicacionLicenciaHtml(BASE);
    expect(html).toMatch(/No constituye la licencia/i);
    expect(html).not.toMatch(/licencia (concedida|aprobada|otorgada)/i);
  });

  it('no menciona el silencio administrativo positivo', () => {
    expect(buildConstanciaRadicacionLicenciaHtml(BASE).toLowerCase()).not.toContain('silencio administrativo');
  });

  /* Si el término no se pudo proyectar, el papel calla el vencimiento en vez
     de inventar una fecha — pero sigue diciendo desde cuándo corre. */
  it('sin fecha de vencimiento proyectada, no la inventa', () => {
    const html = buildConstanciaRadicacionLicenciaHtml({ ...BASE, venceEl: null });
    expect(html).toMatch(/corre desde el/i);
    expect(html).not.toMatch(/y vence el/i);
  });

  it('escapa los datos del solicitante', () => {
    const html = buildConstanciaRadicacionLicenciaHtml({
      ...BASE,
      solicitanteNombre: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('la constancia es una función pura del hecho', () => {
  /* Reimprimirla en noviembre debe dar EXACTAMENTE el mismo papel que se
     entregó en agosto: acredita un hecho de una fecha, no el presente. */
  it('el mismo insumo produce siempre el mismo documento', () => {
    expect(buildConstanciaRadicacionLicenciaHtml(BASE))
      .toBe(buildConstanciaRadicacionLicenciaHtml({ ...BASE }));
  });

  it('el nombre del archivo lleva el número', () => {
    expect(nombreArchivoConstancia(BASE.numeroRadicado))
      .toBe('constancia-radicacion-1-110-202608-00001342.html');
  });
});
