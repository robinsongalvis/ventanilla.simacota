import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompletarDatosSolicitante } from '@/app/interno/dashboard/components/CompletarDatosSolicitante';
import type { DatosNoAportados, VentanillaRadicado } from '@/src/types/ventanilla';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Sprint Cierre del mostrador — UI de completar datos en el detalle.
══════════════════════════════════════════════════════════════ */

function radicado(datosNoAportados?: DatosNoAportados): VentanillaRadicado {
  return {
    radicadoId:          '1-WEB-2026-00000010',
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: '2026-07-02T15:00:00.000Z',
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1101321226',
      nombreCompleto:  'Robinson David Galvis',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
      datosNoAportados,
    },
    control: {
      radicadoId:     '1-WEB-2026-00000010',
      consecutivo:    10,
      fechaRadicado:  '2026-07-02T15:00:00.000Z',
      horaRadicado:   '10:00',
      medioRecepcion: 'PRESENCIAL',
      origen:         'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    '2026-07-20T09:00:00.000Z',
      prorrogasAplicadas:  0,
    },
    clasificacion: { oficinaDestino: 'VENTANILLA_UNICA', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Solicitud', descripcion: 'Descripción', numeroFolios: 1 },
    archivos: [],
  };
}

describe('Cierre del mostrador — CompletarDatosSolicitante', () => {
  /* 1 · sin marcas no hay bloque */
  it('sin datosNoAportados no renderiza nada', () => {
    const { container } = render(<CompletarDatosSolicitante radicado={radicado()} />);
    expect(container.innerHTML).toBe('');
  });

  /* 2 · solo aparecen los campos marcados */
  it('con marca de correo muestra solo el input de correo', () => {
    render(<CompletarDatosSolicitante radicado={radicado({ correo: true })} />);
    expect(screen.getByText('Datos pendientes del solicitante')).toBeTruthy();
    expect(screen.getByLabelText('Correo electrónico')).toBeTruthy();
    expect(screen.queryByLabelText('Dirección')).toBeNull();
  });

  /* 3 · guardar se habilita solo cuando hay algo escrito */
  it('el botón se habilita al escribir un dato', () => {
    render(<CompletarDatosSolicitante radicado={radicado({ correo: true })} />);
    const boton = screen.getByRole('button', { name: /Guardar datos aportados/i }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'ciudadano@example.com' },
    });
    expect(boton.disabled).toBe(false);
  });

  /* 4 · guardar llama al endpoint y confirma */
  it('guardar hace POST al endpoint y muestra confirmación', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, camposActualizados: ['correo'] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompletarDatosSolicitante radicado={radicado({ correo: true })} />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'ciudadano@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos aportados/i }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Datos guardados/i));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/radicados/1-WEB-2026-00000010/completar-datos',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  /* 5 · el error del servidor se muestra tal cual */
  it('muestra el mensaje de error del endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'El correo aportado no tiene un formato válido.' }),
    }));

    render(<CompletarDatosSolicitante radicado={radicado({ correo: true })} />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'malcorreo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos aportados/i }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/formato válido/i));
  });

  /* 6 · el documento no se completa por esta vía */
  it('con marca de documento avisa que no se completa aquí', () => {
    render(<CompletarDatosSolicitante radicado={radicado({ documento: true })} />);
    expect(screen.getByText(/no se completa por esta vía/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Guardar/i })).toBeNull();
  });
});
