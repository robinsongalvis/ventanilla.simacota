import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  clasificarFrenteAlTermino,
  ESCALONES,
  PLAZO_DECISION_LICENCIA_DIAS_HABILES,
} from '@/lib/motor-expedientes/semaforo-termino';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';

/**
 * UNA SOLA FUNCIÓN DECIDE, Y LA PANTALLA NO INVENTA UMBRALES.
 *
 * El criterio vivía dentro del cron. Cuando la pantalla necesitó el mismo
 * semáforo había dos caminos: copiar los umbrales —y arriesgarse a que la
 * pantalla dijera «en término» mientras el correo decía «crítico»— o compartir
 * la función. Se compartió. Esto lo custodia.
 */

const AHORA = new Date('2026-08-29T12:00:00Z');
const venceEn = (dias: number) => sumarDiasHabiles(AHORA, dias).toISOString();

const exp = (over: Record<string, unknown> = {}) => ({
  id: 'exp-1',
  estadoJuridico: 'EN_REVISION' as const,
  creadoEn: '2026-08-01T12:00:00Z',
  fechaAlertaConservadora: venceEn(40),
  ...over,
});

describe('los escalones son los del vigía, no otros', () => {
  it('vencido, crítico y aviso, en ese orden', () => {
    expect(ESCALONES.map((e) => e.nivel)).toEqual(['VENCIDO', 'CRITICO', 'AVISO']);
    expect(ESCALONES.map((e) => e.hasta)).toEqual([0, 5, 15]);
  });

  it('el plazo de decisión son 45 días hábiles', () => {
    expect(PLAZO_DECISION_LICENCIA_DIAS_HABILES).toBe(45);
  });
});

describe('la clasificación, en la frontera de cada escalón', () => {
  it('con 40 días no hay nivel: en término', () => {
    const f = clasificarFrenteAlTermino(exp(), AHORA);
    expect(f.situacion).toBe('CORRIENDO');
    expect(f.nivel).toBeUndefined();
  });

  it('a 15 días entra en AVISO, a 16 todavía no', () => {
    expect(clasificarFrenteAlTermino(exp({ fechaAlertaConservadora: venceEn(15) }), AHORA).nivel).toBe('AVISO');
    expect(clasificarFrenteAlTermino(exp({ fechaAlertaConservadora: venceEn(16) }), AHORA).nivel).toBeUndefined();
  });

  it('a 5 días pasa a CRÍTICO, a 6 sigue en aviso', () => {
    expect(clasificarFrenteAlTermino(exp({ fechaAlertaConservadora: venceEn(5) }), AHORA).nivel).toBe('CRITICO');
    expect(clasificarFrenteAlTermino(exp({ fechaAlertaConservadora: venceEn(6) }), AHORA).nivel).toBe('AVISO');
  });

  it('en cero o por debajo, VENCIDO', () => {
    expect(clasificarFrenteAlTermino(exp({ fechaAlertaConservadora: venceEn(0) }), AHORA).nivel).toBe('VENCIDO');
  });
});

describe('las situaciones que NO son «corriendo»', () => {
  it('sin ancla no se clasifica el plazo: se cuenta la espera', () => {
    const f = clasificarFrenteAlTermino(exp({ fechaAlertaConservadora: null }), AHORA);
    expect(f.situacion).toBe('SIN_ANCLAR');
    expect(f.nivel).toBeUndefined();
  });

  it('con acta de observaciones el reloj está detenido', () => {
    expect(clasificarFrenteAlTermino(exp({ estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES' }), AHORA).situacion)
      .toBe('SUSPENDIDO');
  });

  it('resuelto no genera alerta: el tiempo ya no corre contra nadie', () => {
    /* Medirlo contra «hoy» convertiría el paso del tiempo en una mora que no
       existe. */
    expect(clasificarFrenteAlTermino(exp({ estadoJuridico: 'CONCEDIDA' }), AHORA).situacion).toBe('RESUELTO');
  });
});

describe('nadie reimplementa el criterio', () => {
  const soloCodigo = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const TARJETA = soloCodigo(readFileSync('app/interno/licencias/components/CabeceraTermino.tsx', 'utf8'));
  const CRON = soloCodigo(readFileSync('app/api/cron/vencimientos-licencias/route.ts', 'utf8'));

  it('la pantalla LLAMA a la función compartida', () => {
    expect(TARJETA).toMatch(/clasificarFrenteAlTermino\(/);
  });

  it('y NO declara umbrales propios', () => {
    /* Si la pantalla escribiera sus propios 5 y 15, podría verse «en término»
       mientras el correo reporta crítico sobre el mismo expediente. */
    expect(TARJETA, 'la pantalla declara escalones propios').not.toMatch(/hasta:\s*\d+/);
    expect(TARJETA).not.toMatch(/ESCALONES\s*=/);
  });

  it('el cron tampoco: la importa', () => {
    expect(CRON).toMatch(/from '@\/lib\/motor-expedientes\/semaforo-termino'/);
    expect(CRON, 'el cron volvió a declarar los escalones').not.toMatch(/const ESCALONES\s*=/);
  });
});
