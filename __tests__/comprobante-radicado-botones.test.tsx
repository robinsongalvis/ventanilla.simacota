import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComprobanteRadicado } from '@/app/interno/dashboard/components/ComprobanteRadicado';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 2 — botones del comprobante.

   Verifica que el botón "Enviar por correo" solo aparece cuando
   hay correo del solicitante Y el padre pasó el callback
   `onEnviarCorreo`. Sin ninguna de las dos condiciones, no debe
   estar en el DOM.
══════════════════════════════════════════════════════════════ */

const BASE_PROPS = {
  radicadoId:         '1-WEB-2026-00000042',
  solicitanteNombre:  'Juan Pérez',
  numeroDocumento:    '1098765432',
  tipoDocumento:      'CC',
  fechaRadicado:      '2026-07-02T13:00:00.000Z',
  horaRadicado:       '08:00',
  medioRecepcion:     'PRESENCIAL',
  tipoTramite:        'Petición general',
  diasRespuesta:      15,
  unidad:             'HABILES' as const,
  asunto:             'Solicitud de certificado',
  fechaVencimiento:   '2026-07-23T22:00:00.000Z',
  funcionarioNombre:  'Funcionaria X',
  dependencia:        'VENTANILLA_UNICA',
  numeroFolios:       1,
};

describe('Sprint Op 2 — botones del ComprobanteRadicado', () => {
  /* 1 */
  it('NO renderiza "Enviar por correo" si no hay correo del solicitante', () => {
    render(
      <ComprobanteRadicado
        {...BASE_PROPS}
        correoSolicitante={null}
        onEnviarCorreo={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Enviar por correo/i)).toBeNull();
  });

  /* 2 */
  it('NO renderiza "Enviar por correo" si el padre no pasó onEnviarCorreo', () => {
    render(
      <ComprobanteRadicado
        {...BASE_PROPS}
        correoSolicitante="juan@example.com"
      />,
    );
    expect(screen.queryByText(/Enviar por correo/i)).toBeNull();
  });

  /* 3 */
  it('SÍ renderiza "Enviar por correo" con correo válido + callback', () => {
    render(
      <ComprobanteRadicado
        {...BASE_PROPS}
        correoSolicitante="juan@example.com"
        onEnviarCorreo={vi.fn()}
      />,
    );
    expect(screen.getByText(/Enviar por correo a juan@example.com/i)).toBeTruthy();
  });

  /* 4 */
  it('renderiza "Nuevo registro" solo si el padre pasó onNuevoRegistro', () => {
    const { rerender } = render(<ComprobanteRadicado {...BASE_PROPS} />);
    expect(screen.queryByText(/Nuevo registro/i)).toBeNull();

    rerender(<ComprobanteRadicado {...BASE_PROPS} onNuevoRegistro={vi.fn()} />);
    expect(screen.getByText(/Nuevo registro/i)).toBeTruthy();
  });

  /* 5 — estados del envío */
  it('muestra estado "Enviando…" cuando estadoEnvio es enviando', () => {
    render(
      <ComprobanteRadicado
        {...BASE_PROPS}
        correoSolicitante="juan@example.com"
        onEnviarCorreo={vi.fn()}
        estadoEnvio="enviando"
      />,
    );
    expect(screen.getByText(/Enviando/i)).toBeTruthy();
  });

  /* 6 */
  it('muestra estado "Enviada al solicitante" cuando estadoEnvio es enviado', () => {
    render(
      <ComprobanteRadicado
        {...BASE_PROPS}
        correoSolicitante="juan@example.com"
        onEnviarCorreo={vi.fn()}
        estadoEnvio="enviado"
      />,
    );
    expect(screen.getByText(/Enviada al solicitante/i)).toBeTruthy();
  });

  /* 7 — mensaje de error visible cuando estadoEnvio === 'error' */
  it('muestra mensaje de error cuando estadoEnvio es error', () => {
    render(
      <ComprobanteRadicado
        {...BASE_PROPS}
        correoSolicitante="juan@example.com"
        onEnviarCorreo={vi.fn()}
        estadoEnvio="error"
        mensajeEnvioError="No fue posible enviar la constancia."
      />,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/No fue posible enviar/i);
  });
});
