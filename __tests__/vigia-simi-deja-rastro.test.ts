import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';

/**
 * EL 27-AGO-2026 SE AGENDÓ EL QUINTO CRON Y NO SE PUDO SABER QUÉ HIZO.
 *
 * Corrió dos veces en producción, devolvió 200 las dos, y los logs de Vercel
 * guardaron el estado, la duración y la memoria — pero NO el cuerpo de la
 * respuesta, que es donde iban los números. Una corrida que analizó 500
 * radicados y una que no encontró ninguno se veían EXACTAMENTE igual.
 *
 * Es la regla de siempre en la capa de observabilidad: el silencio de un
 * vigilante tiene que poder distinguirse de «no hizo nada». Averiguarlo exigió
 * el secreto de producción, que no todo el mundo tiene ni debe tener.
 */
const RUTA = 'app/api/cron/simi/alertas-vencimiento/route.ts';
const FUENTE = readFileSync(RUTA, 'utf8');

describe('el vigía de SIMI deja rastro de lo que hizo', () => {
  it('registra un evento de negocio al terminar bien', () => {
    expect(FUENTE).toMatch(/registrarEventoNegocio\(\{[\s\S]*?resultado:\s*'ok'/);
  });

  it('y también cuando falla, con el error saneado', () => {
    expect(FUENTE).toMatch(/registrarEventoNegocio\(\{[\s\S]*?resultado:\s*'error'/);
  });

  /* Los tres números que responden «¿qué hizo?». Sin ellos el evento diría
     que corrió, que es justo lo que los logs ya decían. */
  it('el rastro lleva los números, no solo que corrió', () => {
    expect(FUENTE).toMatch(/docsLeidos:\s*result\.radicadosAnalizados/);
    expect(FUENTE).toMatch(/alertasCreadas:\s*result\.alertasCreadas/);
    expect(FUENTE).toMatch(/alertasOmitidas:\s*result\.alertasOmitidas/);
  });
});

describe('el evento sale con los números y sin ruido', () => {
  it('incluye los tres campos cuando se le pasan', () => {
    const e = registrarEventoNegocio({
      operacion: 'alertas_vencimiento_simi',
      resultado: 'ok',
      latenciaMs: 476,
      radicadoId: null,
      actorRol: 'CRON',
      tenant: 'VENTANILLA_UNICA',
      docsLeidos: 312,
      alertasCreadas: 4,
      alertasOmitidas: 308,
    });
    expect(e.docsLeidos).toBe(312);
    expect(e.alertasCreadas).toBe(4);
    expect(e.alertasOmitidas).toBe(308);
  });

  /* Cero no es lo mismo que ausente: «creó 0 alertas» es una respuesta, y
     omitir el campo la borraría. */
  it('un cero se registra, no se omite', () => {
    const e = registrarEventoNegocio({
      operacion: 'alertas_vencimiento_simi',
      resultado: 'ok',
      latenciaMs: 12,
      radicadoId: null,
      actorRol: 'CRON',
      tenant: 'VENTANILLA_UNICA',
      docsLeidos: 0,
      alertasCreadas: 0,
      alertasOmitidas: 0,
    });
    expect(e.alertasCreadas).toBe(0);
    expect(e).toHaveProperty('alertasCreadas');
  });

  it('los campos no aparecen en operaciones que no los tienen', () => {
    const e = registrarEventoNegocio({
      operacion: 'radicacion',
      resultado: 'ok',
      latenciaMs: 40,
      radicadoId: '1-110-202608-00000027',
      actorRol: 'RECEPCIONISTA',
      tenant: 'VENTANILLA_UNICA',
    });
    expect(e).not.toHaveProperty('alertasCreadas');
    expect(e).not.toHaveProperty('alertasOmitidas');
  });
});
