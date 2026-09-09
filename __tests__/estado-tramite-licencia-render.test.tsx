import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { EstadoTramiteLicencia } from '@/app/interno/dashboard/components/pqrs/EstadoTramiteLicencia';
import { PLAZO_SIN_EMPEZAR } from '@/lib/server/proyeccion-ventanilla';

/**
 * El bloque que ventanilla lee en voz alta.
 *
 * El caso que motiva el módulo entero: el ciudadano pregunta en ventanilla y la
 * respuesta era «suba a Planeación». Estas pruebas sostienen que la funcionaria
 * puede responder las cuatro preguntas SIN LEVANTARSE — y que no ve nada más.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const proyeccion = (over: Record<string, unknown> = {}) => ({
  numeroExpediente: '1-110-202608-00000123',
  estadoJuridico: 'PRESENTADA',
  estadoLegible: 'Presentada',
  fechaRadicacionDebidaForma: null,
  venceEl: null,
  avisoPlazo: PLAZO_SIN_EMPEZAR,
  faltantes: [],
  completitudSinEvaluar: false,
  ...over,
});

function responder(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

describe('un radicado que no es licencia', () => {
  it('no pinta nada — la mayoría de radicados no lo son', () => {
    responder({ tieneExpediente: false });
    const { container } = render(<EstadoTramiteLicencia radicadoId="rad-1" />);
    expect(container.textContent).toBe('');
  });
});

describe('el plazo todavía no corre', () => {
  it('lo dice con la frase EXACTA, no con un guion', async () => {
    /* La funcionaria tiene que poder leérselo tal cual. Un guion la obliga a
       interpretar, y lo que interprete será suyo y no del sistema. */
    responder({ tieneExpediente: true, proyeccion: proyeccion() });
    render(<EstadoTramiteLicencia radicadoId="rad-1" />);
    await waitFor(() =>
      expect(document.body.textContent).toContain('El plazo aún no ha empezado a correr.'),
    );
    expect(document.body.textContent, 'un guion no le sirve para hablar').not.toMatch(/:\s*—/);
  });
});

describe('el plazo corre', () => {
  /* Las fechas van en DD/MM/AAAA, el MISMO formato de la tarjeta de Planeación
     (`formatFechaColombia`). No es cosmética: el 9-sep-2026 el propietario pidió
     que las dos pantallas concuerden, y comparar «24/10/2026» con «24 de octubre
     de 2026» obliga a la funcionaria a traducir mentalmente delante del
     ciudadano. */
  const corriendo = () => ({
    tieneExpediente: true,
    proyeccion: proyeccion({
      estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA',
      estadoLegible: 'Radicada en debida forma',
      fechaRadicacionDebidaForma: '2026-08-20T12:00:00Z',
      venceEl: '2026-10-24T12:00:00Z',
      avisoPlazo: null,
    }),
  });

  it('da las dos fechas: desde cuándo y hasta cuándo', async () => {
    responder(corriendo());
    render(<EstadoTramiteLicencia radicadoId="rad-1" />);
    await waitFor(() => expect(document.body.textContent).toMatch(/20\/08\/2026/));
    expect(document.body.textContent).toMatch(/24\/10\/2026/);
    expect(document.body.textContent).toMatch(/Radicada en debida forma/);
  });

  it('y dice cuántos días faltan — la pregunta que el ciudadano hace de verdad', async () => {
    /* Hasta el 9-sep-2026 este bloque daba las fechas y nada más, mientras
       Planeación mostraba la cuenta atrás. La funcionaria del mostrador tenía
       que restar días hábiles de cabeza, con festivos incluidos. */
    responder(corriendo());
    render(<EstadoTramiteLicencia radicadoId="rad-1" />);
    await waitFor(() =>
      expect(document.body.textContent).toMatch(/Quedan \d+ días hábiles · día \d+ de 45/),
    );
  });
});

describe('los documentos que faltan', () => {
  it('los lista por su nombre', async () => {
    responder({
      tieneExpediente: true,
      proyeccion: proyeccion({ faltantes: ['Proyecto arquitectónico', 'Paz y salvo municipal'] }),
    });
    render(<EstadoTramiteLicencia radicadoId="rad-1" />);
    await waitFor(() => expect(document.body.textContent).toMatch(/Proyecto arquitectónico/));
    expect(document.body.textContent).toMatch(/Paz y salvo municipal/);
  });

  it('«nadie los ha revisado» NO se dice como «no falta ninguno»', async () => {
    /* Decirle al ciudadano que su solicitud está completa cuando nadie la miró
       es peor que no decirle nada. */
    responder({ tieneExpediente: true, proyeccion: proyeccion({ completitudSinEvaluar: true }) });
    render(<EstadoTramiteLicencia radicadoId="rad-1" />);
    await waitFor(() => expect(document.body.textContent).toMatch(/todavía no han sido revisados/i));
    expect(document.body.textContent).not.toMatch(/no falta ningún documento/i);
  });
});

describe('el recorte del ADR-0034, en pantalla', () => {
  it('no ofrece NINGÚN control de escritura: ventanilla informa, Planeación decide', async () => {
    responder({ tieneExpediente: true, proyeccion: proyeccion({ faltantes: ['X'] }) });
    const { container } = render(<EstadoTramiteLicencia radicadoId="rad-1" />);
    await waitFor(() => expect(container.textContent).toMatch(/Estado del trámite/));
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0);
  });

  it('remite a Planeación para lo que deliberadamente no muestra', async () => {
    /* El costo aceptado en el ADR: ventanilla no puede decir POR QUÉ se rechazó
       un documento ni QUÉ dice un acta. Remitirlas es mejor que contestarlas mal. */
    responder({ tieneExpediente: true, proyeccion: proyeccion() });
    render(<EstadoTramiteLicencia radicadoId="rad-1" />);
    await waitFor(() => expect(document.body.textContent).toMatch(/Secretaría de Planeación/));
  });
});
