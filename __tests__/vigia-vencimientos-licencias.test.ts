import { describe, it, expect } from 'vitest';
import { clasificarFrenteAlTermino } from '@/app/api/cron/vencimientos-licencias/route';

/** Un expediente que sí ancló su término, venciendo en `vence`. */
const conTermino = (estado: string, vence: string) => ({
  id: 'e1', estadoJuridico: estado, creadoEn: '2026-08-01T12:00:00.000Z',
  numeroExpediente: { numero: '68745-0-26-0001' }, fechaAlertaConservadora: vence,
}) as never;

const AHORA = new Date('2026-09-01T12:00:00.000Z'); // martes

describe('el vigía distingue las tres situaciones, no dos', () => {
  it('sin fecha anclada NO se ignora: es SIN_ANCLAR y cuenta su espera', () => {
    const f = clasificarFrenteAlTermino(
      { id: 'e2', estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA', creadoEn: '2026-08-03T12:00:00.000Z' } as never,
      AHORA,
    );
    expect(f.situacion).toBe('SIN_ANCLAR');
    expect(f.diasHabilesEnEspera).toBeGreaterThan(5); // supera la edad máxima
  });

  it('con acta de observaciones es SUSPENDIDO, no CORRIENDO', () => {
    // Regresión: `terminoResolucionSigueCorriendo` responde «¿ya se resolvió?»,
    // no «¿está suspendido?». Confundirlas metía este caso en CORRIENDO.
    expect(clasificarFrenteAlTermino(
      conTermino('CON_ACTA_DE_OBSERVACIONES', '2026-09-02T12:00:00.000Z'), AHORA,
    ).situacion).toBe('SUSPENDIDO');
  });

  it('un expediente ya resuelto sale del alcance del vigía', () => {
    expect(clasificarFrenteAlTermino(
      conTermino('EN_FIRME', '2026-04-01T12:00:00.000Z'), AHORA,
    ).situacion).toBe('RESUELTO');
  });

  it.each([
    ['2027-01-15T12:00:00.000Z', undefined],   // lejos: sin nivel
    ['2026-09-18T12:00:00.000Z', 'AVISO'],     // ~13 hábiles
    ['2026-09-07T12:00:00.000Z', 'CRITICO'],   // ~4 hábiles
    ['2026-08-20T12:00:00.000Z', 'VENCIDO'],   // ya pasó
  ])('escalona la alerta según los días que queden (%s → %s)', (vence, nivel) => {
    const f = clasificarFrenteAlTermino(conTermino('EN_REVISION', vence as string), AHORA);
    expect(f.situacion).toBe('CORRIENDO');
    expect(f.nivel).toBe(nivel);
  });
});
