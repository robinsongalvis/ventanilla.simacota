import { describe, it, expect } from 'vitest';
import { planCrearExpedienteDesdeRadicado } from '@/lib/server/expedientes-licencias';

/**
 * El término de 45 días hábiles se ancla en la radicación del CIUDADANO, no en
 * el momento en que Planeación abre el expediente.
 *
 * Sin esta prueba el defecto es invisible: ambos caminos producen un expediente
 * válido y el error solo se nota contando los días que le quedan a alguien.
 */
const actor = { uid: 'u1', nombre: 'Funcionaria', rol: 'FUNCIONARIO' as const };

function radicado(fechaRadicado?: string) {
  return {
    radicadoId: '1-110-202608-00000031',
    estadoActual: 'PENDIENTE',
    clasificacion: { oficinaDestino: 'SEC_PLANEACION' },
    solicitante: { nombreCompleto: 'Ciudadana Ejemplo', numeroDocumento: '123' },
    ...(fechaRadicado ? { control: { fechaRadicado } } : {}),
  };
}

describe('anclaje del término de licencias', () => {
  it('ancla en la fecha en que el CIUDADANO radicó, no en la apertura del expediente', () => {
    const radico = '2026-08-10T14:30:00.000Z';        // el ciudadano radicó el 10
    const abrenExpediente = new Date('2026-08-14T09:00:00.000Z'); // Planeación abre el 14

    const plan = planCrearExpedienteDesdeRadicado(
      radicado(radico) as never, { subtipos: ['URBANIZACION'] }, 'SEC_PLANEACION' as never, actor, abrenExpediente,
    );
    if ('status' in plan) throw new Error(`plan devolvió error: ${plan.mensaje}`);

    // El evento que dispara el reloj lleva la fecha del ciudadano…
    expect(plan.primeraActuacion.fecha).toBe(radico);
    expect(plan.fechaAnclaTermino).toBe(radico);
    // …y NO la de la apertura, que son cuatro días de plazo regalados.
    expect(plan.primeraActuacion.fecha).not.toBe(abrenExpediente.toISOString());
    // La auditoría del expediente sí conserva cuándo se abrió.
    expect(plan.expediente.creadoEn).toBe(abrenExpediente.toISOString());
  });

  it('si el radicado histórico no trae fecha, cae al instante de apertura sin romperse', () => {
    const abren = new Date('2026-08-14T09:00:00.000Z');
    const plan = planCrearExpedienteDesdeRadicado(
      radicado() as never, { subtipos: ['URBANIZACION'] }, 'SEC_PLANEACION' as never, actor, abren,
    );
    if ('status' in plan) throw new Error(`plan devolvió error: ${plan.mensaje}`);
    expect(plan.fechaAnclaTermino).toBe(abren.toISOString());
  });
});
