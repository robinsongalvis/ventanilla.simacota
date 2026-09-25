import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegistrarActuacionModal } from '@/app/interno/licencias/components/RegistrarActuacionModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Revisión QA (8-ago) — visibilizar el "NO enviado" de comunicaciones al
   ciudadano. `POST …/actuaciones` (`app/api/licencias/expedientes/[id]/
   actuaciones/route.ts`) devuelve `avisoEnviado: boolean` SOLO con
   significado real para `tipo === 'acta-observaciones'` (es el único tipo
   para el que la ruta intenta enviar algo) — el modal debe mostrarlo
   explícitamente en una pantalla de confirmación, en vez de cerrarse en
   silencio como antes. Para 'respuesta-subsanacion' la ruta nunca intenta
   enviar nada, así que ese tipo sigue cerrando de inmediato (sin pantalla
   de confirmación ni afirmación de aviso).
══════════════════════════════════════════════════════════════ */

function mockFetchActa(avisoEnviado: boolean) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      actuacion: { id: 'act-1', tipo: 'acta-observaciones' },
      estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES',
      avisoEnviado,
    }),
  });
}

describe('RegistrarActuacionModal — confirmación del aviso al ciudadano (acta-observaciones)', () => {
  it('aviso enviado: muestra "Aviso enviado al ciudadano ✓" y espera a "Continuar" antes de notificar al padre', async () => {
    vi.stubGlobal('fetch', mockFetchActa(true));
    const onRegistrada = vi.fn();
    render(
      <RegistrarActuacionModal expedienteId="exp-1" tipo="acta-observaciones" onCerrar={vi.fn()} onRegistrada={onRegistrada} />,
    );

    fireEvent.change(screen.getByLabelText(/Observaciones formuladas/i), {
      target: { value: 'Se observan planos estructurales incompletos.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/i }));

    await waitFor(() => expect(screen.getByText('Aviso enviado al ciudadano ✓')).toBeTruthy());
    expect(screen.queryByText(/Aviso NO enviado/)).toBeNull();
    expect(onRegistrada).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(onRegistrada).toHaveBeenCalledWith(
      { id: 'act-1', tipo: 'acta-observaciones' },
      'CON_ACTA_DE_OBSERVACIONES',
    );
  });

  it('aviso NO enviado: muestra la advertencia explícita en vez de cerrarse en silencio', async () => {
    vi.stubGlobal('fetch', mockFetchActa(false));
    const onRegistrada = vi.fn();
    render(
      <RegistrarActuacionModal expedienteId="exp-1" tipo="acta-observaciones" onCerrar={vi.fn()} onRegistrada={onRegistrada} />,
    );

    fireEvent.change(screen.getByLabelText(/Observaciones formuladas/i), {
      target: { value: 'Se observan planos estructurales incompletos.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/i }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Aviso NO enviado al ciudadano/));
    expect(screen.queryByText('Aviso enviado al ciudadano ✓')).toBeNull();
    // No se notifica al padre (ni se cierra el modal) hasta que el
    // funcionario reconoce la advertencia con "Continuar".
    expect(onRegistrada).not.toHaveBeenCalled();
  });

  it('respuesta-subsanacion: sigue sin pantalla de confirmación (la ruta nunca envía aviso para este tipo)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        actuacion: { id: 'act-2', tipo: 'respuesta-subsanacion' },
        estadoJuridico: 'EN_VIABILIDAD',
        avisoEnviado: false,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onRegistrada = vi.fn();
    render(
      <RegistrarActuacionModal expedienteId="exp-1" tipo="respuesta-subsanacion" onCerrar={vi.fn()} onRegistrada={onRegistrada} />,
    );

    fireEvent.change(screen.getByLabelText(/Qué aportó o corrigió el solicitante/i), {
      target: { value: 'El solicitante aporta planos corregidos.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/i }));

    await waitFor(() => expect(onRegistrada).toHaveBeenCalledWith(
      { id: 'act-2', tipo: 'respuesta-subsanacion' },
      'EN_VIABILIDAD',
    ));
    expect(screen.queryByText(/Aviso NO enviado/)).toBeNull();
    expect(screen.queryByText(/Aviso enviado al ciudadano/)).toBeNull();
  });
});
