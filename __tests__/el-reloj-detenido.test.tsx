import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  proyectarComputo,
  calcularVencimientoTermino,
  type EventoTermino,
  type PoliticaTermino,
} from '@/lib/motor-expedientes/termino';
import { leerElTermino } from '@/lib/motor-expedientes/lectura-del-termino';
import { CabeceraTermino } from '@/app/interno/licencias/components/CabeceraTermino';
import { derivarQueSigue } from '@/app/interno/licencias/que-sigue';
import { PLAZO_DECISION_LICENCIA_DIAS_HABILES } from '@/lib/motor-expedientes/semaforo-termino';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';
import type { EvaluacionPlazoSubsanacion } from '@/app/interno/licencias/tipos-computos';

/* ══════════════════════════════════════════════════════════════
   EL RELOJ DETENIDO, CON SUS NÚMEROS.

   EL DEFECTO. `calcularVencimiento` congelaba los días que quedaban al llegar
   el acta —`diasRestantesGuardados`— y acto seguido los TIRABA: devolvía solo
   una fecha. Por eso la tarjeta decía «Reloj detenido» sin un solo número, y su
   propio comentario lo reconocía: «el servidor todavía no manda ese dato».

   El dato existía desde siempre dentro del algoritmo. Lo que faltaba era
   devolverlo.

   Lo pidió el propietario: que se vea el tiempo que lleva parado, lo que
   quedará al arrancar de nuevo, y el plazo que corre contra el ciudadano
   mientras tanto.

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: que el motor DEVUELVA la suspensión vigente y solo cuando sigue
   vigente; que la lectura compartida cuente los días parados; que la tarjeta
   los pinte; que el plazo del ciudadano se lea en esa misma tarjeta; que
   cuando el servidor NO acredita días la pantalla lo diga en vez de estampar un
   cero; y que el botón de reanudar siga ofrecido.

   Esto NO MIRA: la aritmética de días hábiles (festivos incluidos), que ya
   custodia `tiempos-radicado`; ni la maquetación; ni lo que ve ventanilla, que
   sigue mostrando la situación sin la cuenta — nunca la inventa.
══════════════════════════════════════════════════════════════ */

afterEach(cleanup);

const POLITICA: PoliticaTermino = {
  plazoDias: PLAZO_DECISION_LICENCIA_DIAS_HABILES,
  computo: 'HABILES',
  anclaje: 'RADICACION_EN_DEBIDA_FORMA',
  efectoSubsanacion: 'SUSPENSION_REANUDACION',
};

const dia = (iso: string) => new Date(iso);
const RADICACION = '2026-06-01T12:00:00.000Z';
const ACTA = '2026-06-15T12:00:00.000Z';

const evento = (tipo: EventoTermino['tipo'], iso: string): EventoTermino => ({ tipo, fecha: dia(iso) });

describe('el motor devuelve los días congelados, en vez de tirarlos', () => {
  it('con acta sin responder, dice DESDE CUÁNDO y CUÁNTOS quedaban', () => {
    const { relojDetenido } = proyectarComputo(
      [evento('RADICACION_DEBIDA_FORMA', RADICACION), evento('ACTA_OBSERVACIONES', ACTA)],
      POLITICA,
    );

    expect(relojDetenido, 'el motor volvió a tirar los días congelados').not.toBeNull();
    expect(relojDetenido!.desdeIso).toBe(dia(ACTA).toISOString());
    /* Los días que quedaban ENTRE el acta y el vencimiento vigente — no los 45
       del plazo: el tiempo gastado antes del acta nunca se recupera. */
    expect(relojDetenido!.diasHabilesGuardados).toBeGreaterThan(0);
    expect(relojDetenido!.diasHabilesGuardados).toBeLessThan(PLAZO_DECISION_LICENCIA_DIAS_HABILES);
  });

  it('lo que se congela es lo que se restaura: la cuenta cuadra con el vencimiento', () => {
    const eventos = [evento('RADICACION_DEBIDA_FORMA', RADICACION), evento('ACTA_OBSERVACIONES', ACTA)];
    const { relojDetenido } = proyectarComputo(eventos, POLITICA);
    const respuesta = '2026-08-03T12:00:00.000Z';

    const { vencimiento } = proyectarComputo([...eventos, evento('RESPUESTA_SUBSANACION', respuesta)], POLITICA);

    /* El vencimiento tras reanudar = la respuesta + los días guardados. Si el
       número que la pantalla anuncia («al reanudar quedarán N») no fuera el
       mismo que el motor usa al reanudar, la tarjeta prometería un plazo que
       luego no se cumple. */
    expect(vencimiento!.toISOString()).toBe(sumarDiasHabiles(respuesta, relojDetenido!.diasHabilesGuardados).toISOString());
  });

  it('tras la respuesta YA NO hay suspensión vigente: es el estado de hoy, no un hecho histórico', () => {
    const { relojDetenido } = proyectarComputo(
      [
        evento('RADICACION_DEBIDA_FORMA', RADICACION),
        evento('ACTA_OBSERVACIONES', ACTA),
        evento('RESPUESTA_SUBSANACION', '2026-08-03T12:00:00.000Z'),
      ],
      POLITICA,
    );
    expect(relojDetenido).toBeNull();
  });

  it('sin acta no hay nada que describir', () => {
    const { relojDetenido } = proyectarComputo([evento('RADICACION_DEBIDA_FORMA', RADICACION)], POLITICA);
    expect(relojDetenido).toBeNull();
  });

  it('el contrato del servidor la lleva', () => {
    const r = calcularVencimientoTermino(
      [evento('RADICACION_DEBIDA_FORMA', RADICACION), evento('ACTA_OBSERVACIONES', ACTA)],
      PLAZO_DECISION_LICENCIA_DIAS_HABILES,
    );
    expect(r.relojDetenido).not.toBeNull();
  });
});

describe('la lectura compartida cuenta los días parados', () => {
  it('cuenta hábiles desde que se detuvo hasta hoy', () => {
    const lectura = leerElTermino(
      {
        expedienteId: 'exp-1',
        estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES',
        venceIso: '2026-08-01T12:00:00.000Z',
        desdeIso: RADICACION,
        relojDetenido: { desdeIso: '2026-06-16T12:00:00.000Z', diasHabilesGuardados: 23 },
      },
      new Date('2026-06-26T23:00:00.000Z'),
    );

    expect(lectura.situacion).toBe('SUSPENDIDO');
    if (lectura.situacion !== 'SUSPENDIDO') throw new Error('inalcanzable');
    expect(lectura.diasHabilesGuardados).toBe(23);
    /* Del martes 16 al viernes 26 de junio de 2026: ocho días hábiles
       COMPLETOS (17, 18, 19, 22, 23, 24, 25 y 26 — los fines de semana no
       cuentan y el festivo del 29 cae fuera). Se cuenta con la misma función
       que usa el vigía para la espera, `diasHabilesTranscurridos`. */
    expect(lectura.diasHabilesDetenido).toBe(8);
  });

  it('sin datos del servidor NO inventa un cero', () => {
    /* El caso vivo: `EN_VIABILIDAD`. Ese acto sigue inerte en el cómputo, así
       que no llegan números — y un cero diría «lleva cero días parado», que es
       falso y además tranquilizador. */
    const lectura = leerElTermino({
      expedienteId: 'exp-1',
      estadoJuridico: 'EN_VIABILIDAD',
      venceIso: '2026-08-01T12:00:00.000Z',
      desdeIso: RADICACION,
    });

    if (lectura.situacion !== 'SUSPENDIDO') throw new Error('inalcanzable');
    expect(lectura.diasHabilesDetenido).toBeUndefined();
    expect(lectura.diasHabilesGuardados).toBeUndefined();
  });
});

describe('la tarjeta lo pinta', () => {
  const plazoCiudadano = (over: Partial<EvaluacionPlazoSubsanacion> = {}): EvaluacionPlazoSubsanacion => ({
    resultado: 'EN_PLAZO',
    diasHabilesRestantes: 22,
    fechaVencimientoPlazo: '2026-07-29T12:00:00.000Z',
    ...over,
  });

  function pintarDetenida(over: Partial<Parameters<typeof CabeceraTermino>[0]> = {}) {
    return render(
      <CabeceraTermino
        expedienteId="exp-1"
        estadoJuridico="CON_ACTA_DE_OBSERVACIONES"
        venceIso={sumarDiasHabiles(new Date(), 20).toISOString()}
        desdeIso={RADICACION}
        relojDetenido={{ desdeIso: '2026-06-15T12:00:00.000Z', diasHabilesGuardados: 23 }}
        plazoCiudadano={plazoCiudadano()}
        {...over}
      />,
    );
  }

  it('dice DESDE CUÁNDO está parado y CUÁNTO quedará al reanudar', () => {
    const { container } = pintarDetenida();
    const texto = (container.textContent ?? '').replace(/\s+/g, ' ');

    expect(texto).toContain('Reloj detenido');
    expect(texto).toContain('Detenido desde el 15/06/2026');
    expect(texto).toContain('al reanudar quedarán 23 días hábiles');
  });

  it('el anillo lleva los días parados, no el símbolo de pausa', () => {
    /* Hasta hoy el anillo era mudo a propósito, porque el dato no llegaba. */
    const { container } = pintarDetenida();
    const textos = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(textos).toContain('DÍAS PARADO');
    expect(textos.some((t) => /^\d+$/.test(t ?? '')), 'el anillo no lleva número').toBe(true);
  });

  it('y el plazo del CIUDADANO se lee en la misma tarjeta', () => {
    /* Cuando el reloj de la Secretaría está parado, el único que corre es ese.
       Vivía en una línea suelta más arriba de la pantalla. */
    const { container } = pintarDetenida();
    const texto = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(texto).toContain('Le quedan 22 días hábiles');
    expect(texto).toContain('vence el 29/07/2026');
  });

  it('si el plazo del ciudadano ya venció, lo grita', () => {
    pintarDetenida({ plazoCiudadano: plazoCiudadano({ resultado: 'POR_ARCHIVAR', diasHabilesRestantes: -4 }) });
    const alerta = screen.getAllByRole('alert').map((n) => n.textContent ?? '').join(' ');
    expect(alerta).toContain('ya venció sin respuesta');
  });

  it('sin días acreditados AVISA de que no se están descontando, en vez de pintar un cero', () => {
    /* El hueco vivo del ADR-0029: mientras el acto de viabilidad siga inerte,
       los días de esa pausa se los come la Secretaría. Quien mira la pantalla
       tiene derecho a saberlo. */
    const { container } = render(
      <CabeceraTermino
        expedienteId="exp-1"
        estadoJuridico="EN_VIABILIDAD"
        venceIso={sumarDiasHabiles(new Date(), 20).toISOString()}
        desdeIso={RADICACION}
      />,
    );
    const texto = (container.textContent ?? '').replace(/\s+/g, ' ');

    expect(texto).toContain('no se están descontando');
    expect(texto, 'pintó un cero donde no hay dato').not.toContain('DÍAS PARADO');
  });
});

describe('el botón de reanudar sigue ofrecido', () => {
  it('con acta, la acción PRINCIPAL es registrar la respuesta de subsanación', () => {
    /* No se construye un botón nuevo: ya existía. Esto lo custodia — si alguien
       lo bajara de rango o lo filtrara, el reloj quedaría parado sin forma de
       arrancarlo desde la pantalla, que es el callejón que el #328 produjo en
       la cadena de cierre. */
    const queSigue = derivarQueSigue({ estado: 'CON_ACTA_DE_OBSERVACIONES', yaHuboActa: true, motivos: {} });

    expect(
      queSigue.principal?.tipo,
      'reanudar dejó de ser la acción del momento con un acta sin responder',
    ).toBe('respuesta-subsanacion');
    expect(queSigue.principal?.nota).toContain('reanuda el término donde se detuvo');
  });
});
