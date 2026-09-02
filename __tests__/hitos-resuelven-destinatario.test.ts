import { describe, expect, it } from 'vitest';
import { debeEnviarComunicacionExpediente } from '@/lib/server/expedientes-licencias';

/**
 * LOS CORREOS DE HITOS RESUELVEN EL DESTINATARIO CON LA PRECEDENCIA NUEVA.
 *
 * Antes, la decisión de comunicar tenía su propia cadena de condiciones y la
 * primera era literal: «no se copia email al expediente, proyección mínima
 * D2». Un expediente sin radicado NO TENÍA A QUIÉN ESCRIBIRLE, nunca, por
 * diseño — y todo el sistema de avisos se apoyaba en eso sin saberlo.
 *
 * Ahora consulta `resolverDestinatario`. Estas pruebas verifican que el correo
 * y la pantalla usan EL MISMO criterio: una fuente, dos salidas.
 *
 * ── ALCANCE (ADR-0033 §4.6-bis) ─────────────────────────────────────────
 * QUÉ MIRA: que la puerta del correo respete la precedencia, incluidos el
 * candado DEMO y la Definición habilitada, que son anteriores a ella.
 * QUÉ NO MIRA: el envío en sí, ni la maqueta del correo.
 */

const TRAMITE = 'licencia-construccion-obra-nueva';
/* Objeto, no string, desde el ADR-0041: el gate ya no pregunta «¿empieza por
   DEMO-?» sino «¿es de una serie legal?», y eso lo dice el `serieId`. */
const NUM = { numero: '1-110-202608-00000040', serieId: 'radicados' };

describe('con radicado vinculado, manda el radicado', () => {
  it('con correo válido, se envía', () => {
    const g = debeEnviarComunicacionExpediente(
      TRAMITE,
      { solicitante: { email: 'ciudadano@ejemplo.com' } } as never,
      NUM,
    );
    expect(g.debeEnviar).toBe(true);
  });

  it('sin correo en el radicado NO se cae a la captura propia del expediente', () => {
    /* La regla que sostiene la precedencia: caerse sería tener dos fuentes
       disfrazadas de una. */
    const g = debeEnviarComunicacionExpediente(
      TRAMITE,
      { solicitante: { email: '' } } as never,
      NUM,
      { correo: 'capturado@ejemplo.com' },
    );
    expect(g.debeEnviar).toBe(false);
    expect(g.motivo).toMatch(/lo manda el radicado/);
  });
});

describe('sin radicado, manda la captura propia — que antes no existía', () => {
  it('el expediente huérfano con correo capturado SÍ recibe', () => {
    const g = debeEnviarComunicacionExpediente(TRAMITE, null, NUM, { correo: 'huerfano@ejemplo.com' });
    expect(g.debeEnviar).toBe(true);
  });

  it('sin nada, no se envía y el motivo nombra la consecuencia', () => {
    const g = debeEnviarComunicacionExpediente(TRAMITE, null, NUM);
    expect(g.debeEnviar).toBe(false);
    expect(g.motivo).toMatch(/no recibirá ningún aviso automático/);
  });

  it('«declara no tener» corta el envío, y lo dice como hecho y no como falta', () => {
    const g = debeEnviarComunicacionExpediente(TRAMITE, null, NUM, { datosNoAportados: { correo: true } });
    expect(g.debeEnviar).toBe(false);
    expect(g.motivo).toMatch(/manifestó no tener correo/);
  });
});

describe('los cortes anteriores a la precedencia siguen mandando', () => {
  it('un número DEMO no se le comunica a nadie, aunque haya correo', () => {
    const g = debeEnviarComunicacionExpediente(
      TRAMITE,
      { solicitante: { email: 'ciudadano@ejemplo.com' } } as never,
      { numero: 'DEMO-26-130e665c', serieId: 'demo' },
    );
    expect(g.debeEnviar).toBe(false);
    expect(g.motivo).toMatch(/DEMOSTRACIÓN/);
  });

  it('una Definición no habilitada tampoco, aunque el destinatario exista', () => {
    const g = debeEnviarComunicacionExpediente(
      'tramite-que-no-existe',
      { solicitante: { email: 'ciudadano@ejemplo.com' } } as never,
      NUM,
    );
    expect(g.debeEnviar).toBe(false);
  });
});
