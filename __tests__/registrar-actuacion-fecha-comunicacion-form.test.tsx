import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegistrarActuacionModal } from '@/app/interno/licencias/components/RegistrarActuacionModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Bloque A·A5 — campo opcional "Fecha de comunicación del acta" en
   `RegistrarActuacionModal` (tipo 'acta-observaciones'). El servidor YA
   acepta `fechaComunicacion` en el body (`[id]/actuaciones/route.ts`,
   condición del dictamen: el plazo de 30 días corre desde la comunicación,
   no la expedición) — este test cubre SOLO el campo y lo que el cliente
   envía, no el cálculo del plazo (eso es servidor, `calcularFechaLimite
   RespuestaActa`, `lib/server/expedientes-licencias.ts`).

   `<input type="date">` entrega "YYYY-MM-DD" sin hora — el modal lo ancla
   a mediodía de Bogotá (`T12:00:00-05:00`) ANTES de enviarlo, porque el
   servidor NO re-ancla ese valor (a diferencia de otros flujos, p. ej.
   `app/api/interno/resumen-diario/route.ts`) y un "YYYY-MM-DD" crudo se
   interpretaría como medianoche UTC — un día civil ANTES en Bogotá.
══════════════════════════════════════════════════════════════ */

function mockFetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, actuacion: { id: 'act-1' }, estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES', avisoEnviado: false }),
  });
}

describe('RegistrarActuacionModal — campo "Fecha de comunicación del acta"', () => {
  it('aparece, es opcional y trae la ayuda contextual, solo para acta-observaciones', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <RegistrarActuacionModal expedienteId="exp-1" tipo="acta-observaciones" onCerrar={vi.fn()} onRegistrada={vi.fn()} />,
    );

    const campo = screen.getByLabelText(/Fecha de comunicación del acta/i) as HTMLInputElement;
    expect(campo).toBeTruthy();
    expect(campo.type).toBe('date');
    expect(campo.required).toBe(false);
    expect(
      screen.getByText(
        /si la registra, el aviso al ciudadano incluirá la fecha límite de respuesta; el plazo corre desde la comunicación, no desde la expedición/i,
      ),
    ).toBeTruthy();
  });

  it('NO aparece para respuesta-subsanacion', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <RegistrarActuacionModal expedienteId="exp-1" tipo="respuesta-subsanacion" onCerrar={vi.fn()} onRegistrada={vi.fn()} />,
    );

    expect(screen.queryByLabelText(/Fecha de comunicación del acta/i)).toBeNull();
  });

  it('sin llenarla, el envío procede y el body NO incluye fechaComunicacion', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <RegistrarActuacionModal expedienteId="exp-1" tipo="acta-observaciones" onCerrar={vi.fn()} onRegistrada={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/Observaciones formuladas/i), {
      target: { value: 'Se observan planos estructurales incompletos.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('fechaComunicacion');
    expect(body.tipo).toBe('acta-observaciones');
  });

  it('al llenarla, se envía anclada al mediodía de Bogotá (T12:00:00-05:00)', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <RegistrarActuacionModal expedienteId="exp-1" tipo="acta-observaciones" onCerrar={vi.fn()} onRegistrada={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/Observaciones formuladas/i), {
      target: { value: 'Se observan planos estructurales incompletos.' },
    });
    fireEvent.change(screen.getByLabelText(/Fecha de comunicación del acta/i), { target: { value: '2026-08-10' } });
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.fechaComunicacion).toBe('2026-08-10T12:00:00-05:00');
  });
});
