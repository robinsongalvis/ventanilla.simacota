import { describe, it, expect } from 'vitest';
import * as planificadores from '@/lib/server/expedientes-licencias';
import { terminoResolucionSigueCorriendo } from '@/lib/motor-expedientes/estados-licencia';
import { derivarEventosTermino } from '@/lib/motor-expedientes/termino';

/**
 * NINGÚN camino de creación puede producir un expediente con término anclado.
 *
 * No «el camino principal»: NINGUNO. La primera vez que hice este cambio corregí
 * una de las dos rutas y la otra siguió creando expedientes con la actuación de
 * radicación — un defecto peor que el original, porque el sistema PARECÍA
 * arreglado y el fallo quedaba en la ruta menos transitada.
 *
 * Por eso los planificadores se descubren SOLOS, recorriendo los exports que
 * empiezan por `planCrear`. Si mañana alguien añade un tercer camino de
 * creación, esta prueba lo cubre sin que nadie se acuerde de añadirlo — que es
 * la única forma de que una enumeración no se quede corta (ADR-0033 §4.6).
 */

const ARGUMENTOS_POR_PLANIFICADOR: Record<string, unknown[]> = {
  planCrearExpedienteDemo: [
    { solicitanteNombre: 'C', solicitanteDocumento: '1', subtipos: ['URBANIZACION'] },
    'SEC_PLANEACION',
    { uid: 'u', nombre: 'F', rol: 'FUNCIONARIO' },
    new Date('2026-08-28T09:00:00.000Z'),
  ],
  planCrearExpedienteDesdeRadicado: [
    { radicadoId: '1-110-202608-00000099', estadoActual: 'PENDIENTE',
      clasificacion: { oficinaDestino: 'SEC_PLANEACION' },
      solicitante: { nombreCompleto: 'C', numeroDocumento: '1' },
      control: { fechaRadicado: '2026-08-24T14:30:00.000Z' } },
    { subtipos: ['URBANIZACION'] },
    'SEC_PLANEACION',
    { uid: 'u', nombre: 'F', rol: 'FUNCIONARIO' },
    new Date('2026-08-28T09:00:00.000Z'),
  ],
};

const planificadores_ = Object.entries(planificadores)
  .filter(([n, v]) => n.startsWith('planCrear') && typeof v === 'function');

describe('ningún camino de creación ancla el término', () => {
  it('los planificadores de creación están todos cubiertos por esta prueba', () => {
    // Si aparece uno nuevo sin argumentos declarados, esta prueba falla en vez
    // de ignorarlo en silencio. Es el punto entero del archivo.
    const sinCubrir = planificadores_
      .map(([n]) => n)
      .filter((n) => !(n in ARGUMENTOS_POR_PLANIFICADOR));
    expect(sinCubrir, `Planificadores de creación sin cubrir: ${sinCubrir.join(', ')}`).toEqual([]);
    expect(planificadores_.length).toBeGreaterThanOrEqual(2);
  });

  it.each(planificadores_.map(([n]) => n))('%s crea en PRESENTADA y SIN término', (nombre) => {
    const fn = planificadores[nombre as keyof typeof planificadores] as (...a: unknown[]) => unknown;
    const plan = fn(...ARGUMENTOS_POR_PLANIFICADOR[nombre]) as {
      expediente: Record<string, unknown>;
      primeraActuacion: { tipo: string };
      status?: number; mensaje?: string;
    };
    if ('status' in plan && plan.status) throw new Error(`${nombre} devolvió error: ${plan.mensaje}`);

    const e = plan.expediente;

    // 1. El estado no afirma completitud.
    expect(e.estadoJuridico, `${nombre}: debe nacer en PRESENTADA`).toBe('PRESENTADA');

    // 2. El espejo del término está vacío: no hay plazo proyectado.
    expect(e.fechaAlertaConservadora, `${nombre}: no debe tener término proyectado`).toBeNull();

    // 3. El reloj no corre en ese estado.
    expect(terminoResolucionSigueCorriendo(e.estadoJuridico as never)).toBe(false);

    // 4. Y la razón de fondo: la primera actuación NO genera evento de
    //    radicación. Se comprueba contra el derivador REAL, no contra el
    //    nombre del slug — así el día que alguien renombre el tipo, esto
    //    sigue midiendo lo que importa.
    const eventos = derivarEventosTermino([plan.primeraActuacion] as never);
    expect(
      eventos.some((ev: { tipo: string }) => ev.tipo === 'RADICACION_DEBIDA_FORMA'),
      `${nombre}: la actuación de apertura NO puede generar el evento que ancla el término`,
    ).toBe(false);
  });
});
