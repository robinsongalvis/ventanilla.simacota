import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  CODIGO_OFICINA_RADICADORA,
  formatearRadicadoInstitucional,
} from '@/lib/radicado-institucional';

/* ══════════════════════════════════════════════════════════════
   Sprint Número con oficina radicadora — decisión con la ingeniera
   MIPG (jul 2026): el número lleva el código TRD de la oficina
   RADICADORA (110 = Secretaría General y Gobierno, dueña de la
   ventanilla), como el sistema anterior del municipio. No es el
   destino: el número jamás cambia con un traslado (AGN 060/2001
   art. 5 — sin enmiendas ni correcciones; Ley 1755 — términos desde
   la radicación original).
══════════════════════════════════════════════════════════════ */

const FECHA = new Date('2026-07-10T14:00:00.000Z');

describe('formatearRadicadoInstitucional', () => {
  it('produce la serie 1-110-{año}-{consecutivo a 8 dígitos}', () => {
    expect(CODIGO_OFICINA_RADICADORA).toBe('110');
    expect(formatearRadicadoInstitucional(1217, FECHA)).toBe('1-110-2026-00001217');
    expect(formatearRadicadoInstitucional(1, FECHA)).toBe('1-110-2026-00000001');
  });

  it('el año viene de la fecha de radicación (corte anual del consecutivo)', () => {
    expect(formatearRadicadoInstitucional(7, new Date('2027-01-02T12:00:00.000Z')))
      .toBe('1-110-2027-00000007');
  });
});

describe('consulta pública — el validador acepta nuevo y viejo formato', () => {
  const fuente = readFileSync('lib/seguridad/consulta-publica-radicado.ts', 'utf8');
  const re = /\/\^1-\(110\|WEB\|OFICIO\|EMAIL\|PRESENCIAL\)-\\d\{4\}-\\d\{8\}\$\//;

  it('los radicados históricos por canal siguen consultables (nunca se reescriben)', () => {
    expect(fuente).toMatch(re);
  });
});

describe('todas las puertas de entrada usan el formateador canónico', () => {
  it('la API ciudadana web no arma el número a mano', () => {
    const api = readFileSync('app/api/radicacion/route.ts', 'utf8');
    // El formateador canónico ahora se pasa al helper transaccional de
    // consecutivos (Bloque 2, fix H3), no se invoca suelto ni se arma a mano.
    expect(api).toContain('formatear: formatearRadicadoInstitucional');
    expect(api).toContain("serie: 'radicados'");
  });

  it('el registro exprés usa la misma serie', () => {
    const expres = readFileSync('app/api/dependencias/registro-expres/route.ts', 'utf8');
    // El formateador canónico ahora se pasa al helper transaccional de
    // consecutivos (Bloque 2, fix H3) en vez de invocarse suelto; la serie
    // sigue siendo la misma (radicados → 1-110-...).
    expect(expres).toContain('formatear: formatearRadicadoInstitucional');
    expect(expres).toContain("serie: 'radicados'");
  });
});
