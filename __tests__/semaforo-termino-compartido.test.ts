import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  clasificarFrenteAlTermino,
  ESCALONES,
  PLAZO_DECISION_LICENCIA_DIAS_HABILES,
  ESTADOS_QUE_SUSPENDEN_EL_TERMINO,
} from '@/lib/motor-expedientes/semaforo-termino';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

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

describe('las DOS causas de suspensión que declara la norma (ADR-0038 §9.2)', () => {
  /* Esto era un VALOR ÚNICO, y por eso `EN_VIABILIDAD` salía CORRIENDO:
     durante los días en que el ciudadano reúne los documentos de pago, la
     pantalla y el cron contaban tiempo contra la Secretaría que la norma NO
     cuenta. Misma familia que el rojo con 41 días por delante, pero al revés —
     el sistema apurando a quien la ley no apura. */
  const corriendo = (estado: EstadoJuridicoLicencia) =>
    clasificarFrenteAlTermino(
      {
        id: 'x', estadoJuridico: estado,
        creadoEn: '2026-08-01T12:00:00.000Z',
        fechaAlertaConservadora: sumarDiasHabiles('2026-08-29T12:00:00.000Z', 10).toISOString(),
      } as never,
      new Date('2026-08-29T12:00:00.000Z'),
    );

  it('el acta de observaciones suspende', () => {
    expect(corriendo('CON_ACTA_DE_OBSERVACIONES').situacion).toBe('SUSPENDIDO');
  });

  it('LA VIABILIDAD TAMBIÉN — y antes se contaba como corriendo', () => {
    expect(corriendo('EN_VIABILIDAD').situacion).toBe('SUSPENDIDO');
  });

  it('cada causa trae SU artículo, para poder citarlo en pantalla', () => {
    expect(corriendo('CON_ACTA_DE_OBSERVACIONES').fundamentoSuspension).toMatch(/2\.2\.6\.1\.2\.2\.4/);
    expect(corriendo('EN_VIABILIDAD').fundamentoSuspension).toMatch(/2\.2\.6\.1\.2\.3\.1/);
  });

  it('un estado que NO suspende sigue corriendo', () => {
    expect(corriendo('RADICADA_EN_DEBIDA_FORMA').situacion).toBe('CORRIENDO');
    expect(corriendo('EN_REVISION').situacion).toBe('CORRIENDO');
  });

  it('las causas se declaran con su fundamento: ninguna entra muda', () => {
    /* Añadir una tercera causa sin su artículo dejaría al sistema suspendiendo
       un término sin poder decir por qué. */
    for (const [estado, fundamento] of ESTADOS_QUE_SUSPENDEN_EL_TERMINO) {
      expect(fundamento, `${estado} sin fundamento`).toMatch(/D\.1077\/2015 art\./);
    }
  });
});
