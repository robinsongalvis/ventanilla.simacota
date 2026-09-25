import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  CODIGO_OFICINA_RADICADORA,
  formatearRadicadoInstitucional,
} from '@/lib/radicado-institucional';
import { esNumeroRadicadoValido } from '@/lib/seguridad/consulta-publica-radicado';

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

/* ══════════════════════════════════════════════════════════════
   ADR-0024 (2026-07-15) — decisión del propietario: el tercer segmento
   pasa de {AAAA} a {AAAAMM} para alinear el id con el formato del sistema
   legado municipal (continuidad institucional; evidencia = planilla física
   real). El consecutivo SIGUE SIENDO ANUAL — solo cambia la máscara del id,
   no el contador (`counters/radicados-{año}`) ni el helper transaccional.
══════════════════════════════════════════════════════════════ */

describe('formatearRadicadoInstitucional', () => {
  it('produce la serie 1-110-{AAAAMM}-{consecutivo a 8 dígitos}', () => {
    expect(CODIGO_OFICINA_RADICADORA).toBe('110');
    expect(formatearRadicadoInstitucional(1217, FECHA)).toBe('1-110-202607-00001217');
    expect(formatearRadicadoInstitucional(1, FECHA)).toBe('1-110-202607-00000001');
  });

  it('el año y el mes vienen de la fecha de radicación (corte anual del consecutivo, mes solo informativo)', () => {
    expect(formatearRadicadoInstitucional(7, new Date('2027-01-02T12:00:00.000Z')))
      .toBe('1-110-202701-00000007');
  });

  it('aplica padding de dos dígitos al mes (julio → 07, noviembre → 11)', () => {
    expect(formatearRadicadoInstitucional(1, new Date('2026-07-15T12:00:00.000Z')))
      .toBe('1-110-202607-00000001');
    expect(formatearRadicadoInstitucional(1, new Date('2026-11-03T12:00:00.000Z')))
      .toBe('1-110-202611-00000001');
  });

  it('conserva el consecutivo a 8 dígitos con padding', () => {
    expect(formatearRadicadoInstitucional(5, FECHA)).toBe('1-110-202607-00000005');
    expect(formatearRadicadoInstitucional(12345678, FECHA)).toBe('1-110-202607-12345678');
  });
});

describe('consulta pública — el validador acepta nuevo y viejo formato', () => {
  const fuente = readFileSync('lib/seguridad/consulta-publica-radicado.ts', 'utf8');
  const re = /\/\^1-\(110\|WEB\|OFICIO\|EMAIL\|PRESENCIAL\)-\\d\{4\}\(\?:0\[1-9\]\|1\[0-2\]\)\?-\\d\{8\}\$\//;

  it('los radicados históricos por canal siguen consultables (nunca se reescriben)', () => {
    expect(fuente).toMatch(re);
  });

  it('un id viejo (sin mes) y uno nuevo (con mes AAAAMM) son ambos válidos', () => {
    expect(esNumeroRadicadoValido('1-110-2026-00000025')).toBe(true);
    expect(esNumeroRadicadoValido('1-110-202607-00001217')).toBe(true);
    expect(esNumeroRadicadoValido('1-OFICIO-2026-00000018')).toBe(true);
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
