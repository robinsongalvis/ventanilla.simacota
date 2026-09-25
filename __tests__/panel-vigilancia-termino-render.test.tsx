import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { PanelVigilanciaTermino } from '@/app/interno/licencias/components/PanelVigilanciaTermino';

/**
 * LOS TRES SILENCIOS NO SON EL MISMO, y un panel que los pinta igual es el
 * fallo PT-2 llevado a la pantalla: el cron de PQRSD reportaba verde mientras
 * CERO avisos llegaban a nadie.
 *
 *   · nunca ha corrido → avería: nadie ha mirado.
 *   · conjunto vacío   → miró y no hay nada que vigilar (hoy, lo normal).
 *   · todo en cero     → hay vigilados y ninguno en alerta.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function responder(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

const corrida = (extra: Record<string, unknown> = {}) => ({
  corridaIso: '2026-08-27T12:30:00Z',
  revisados: 12,
  lecturaCompleta: true,
  conjuntoVacio: false,
  porNivel: { AVISO: 0, CRITICO: 0, VENCIDO: 0, ESPERA_EXCESIVA: 0 },
  transiciones: { entraron: 0, agravaron: 0, cambiaron: 0, salieron: 0 },
  salidasNoCalculables: false,
  ...extra,
});

describe('el vigía nunca ha corrido', () => {
  it('lo dice, y dice que eso NO significa que no haya vencimientos', async () => {
    responder({ ultimaCorrida: null, nuncaHaCorrido: true });
    render(<PanelVigilanciaTermino />);
    const aviso = await screen.findByRole('status');
    expect(aviso.textContent).toMatch(/no ha corrido/i);
    expect(
      aviso.textContent,
      'un panel que solo dice «0» deja creer que alguien miró',
    ).toMatch(/nadie ha mirado/i);
  });
});

describe('corrió y el conjunto está vacío', () => {
  it('dice que revisó y que no hay nada que vigilar — no un cero pelado', async () => {
    responder({ ultimaCorrida: corrida({ conjuntoVacio: true, revisados: 0 }), nuncaHaCorrido: false });
    render(<PanelVigilanciaTermino />);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/no hay ningún expediente que vigilar/i);
    });
    expect(document.body.textContent, 'no puede confundirse con la avería').not.toMatch(/no ha corrido/i);
  });
});

describe('hay expedientes en alerta', () => {
  it('muestra el recuento por nivel, incluida la cuarta categoría', async () => {
    responder({
      ultimaCorrida: corrida({ porNivel: { AVISO: 4, CRITICO: 2, VENCIDO: 1, ESPERA_EXCESIVA: 3 } }),
      nuncaHaCorrido: false,
    });
    render(<PanelVigilanciaTermino />);
    await waitFor(() => expect(document.body.textContent).toMatch(/Vencidos: 1/));
    expect(document.body.textContent).toMatch(/Críticos: 2/);
    expect(document.body.textContent).toMatch(/En aviso: 4/);
    /* La que Planeación puede resolver el mismo día: presentadas que nunca
       llegaron a radicarse. */
    expect(document.body.textContent).toMatch(/Sin radicar hace demasiado: 3/);
  });
});

describe('la lectura tocó su techo', () => {
  it('avisa de que las cifras son un mínimo, no un total', async () => {
    responder({
      ultimaCorrida: corrida({ lecturaCompleta: false, salidasNoCalculables: true, porNivel: { AVISO: 0, CRITICO: 0, VENCIDO: 9, ESPERA_EXCESIVA: 0 } }),
      nuncaHaCorrido: false,
    });
    render(<PanelVigilanciaTermino />);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toMatch(/no se miraron/i);
    expect(alerta.textContent, 'presentar un mínimo como total es la mentira que se evita').toMatch(/mínimo, no un total/i);
  });
});
