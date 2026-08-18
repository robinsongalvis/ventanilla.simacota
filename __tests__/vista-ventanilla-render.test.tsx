import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { VistaVentanilla } from '@/app/interno/dashboard/components/ventanilla/VistaVentanilla';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Ventanilla · módulo de mostrador — render de VistaVentanilla.
══════════════════════════════════════════════════════════════ */

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
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
      numeroDocumento: '1098765432',
      nombreCompleto:  'María Rincón',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
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
    clasificacion: {
      oficinaDestino: 'SEC_PLANEACION',
      zonaGeografica: 'CASCO_URBANO',
    },
    detalle: {
      asunto:       'Solicitud de certificado',
      descripcion:  'Descripción',
      numeroFolios: 1,
    },
    archivos: [],
    ...overrides,
  };
}

function props(overrides = {}) {
  return {
    radicados:               [radicado()],
    puedeRadicar:            true,
    onNuevaRadicacion:       vi.fn(),
    onAbrirBusquedaAvanzada: vi.fn(),
    onAbrirRadicado:         vi.fn(),
    ...overrides,
  };
}

describe('Mostrador — VistaVentanilla', () => {
  /* 1 · header propio del mostrador */
  it('muestra el header "Atención al ciudadano" con su eyebrow', () => {
    render(<VistaVentanilla {...props()} />);
    expect(screen.getByRole('heading', { name: /Atención al ciudadano/i })).toBeTruthy();
    expect(screen.getByText(/Ventanilla · Atención al ciudadano/i)).toBeTruthy();
  });

  /* 2 · la acción primaria respeta el permiso de radicar */
  it('Nueva radicación dispara el callback y desaparece sin permiso', () => {
    const onNueva = vi.fn();
    render(<VistaVentanilla {...props({ onNuevaRadicacion: onNueva })} />);
    fireEvent.click(screen.getByRole('button', { name: /Nueva radicación/i }));
    expect(onNueva).toHaveBeenCalledOnce();

    cleanup();
    render(<VistaVentanilla {...props({ puedeRadicar: false })} />);
    expect(screen.queryByRole('button', { name: /Nueva radicación/i })).toBeNull();
  });

  /* 3 · buscar por cédula muestra el resultado y lo abre al clic */
  it('buscar por cédula lista la coincidencia y clic abre el radicado', () => {
    const onAbrir = vi.fn();
    render(<VistaVentanilla {...props({ onAbrirRadicado: onAbrir })} />);
    fireEvent.change(screen.getByLabelText(/Buscar radicado/i), {
      target: { value: '1098765432' },
    });
    expect(screen.getByText(/1 coincidencia/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Abrir radicado 1-WEB-2026-00000010/i }));
    expect(onAbrir).toHaveBeenCalledWith('1-WEB-2026-00000010');
  });

  /* 4 · Enter con radicado completo abre el detalle directo */
  it('Enter con el radicado exacto llama onAbrirRadicado', () => {
    const onAbrir = vi.fn();
    render(<VistaVentanilla {...props({ onAbrirRadicado: onAbrir })} />);
    const input = screen.getByLabelText(/Buscar radicado/i);
    fireEvent.change(input, { target: { value: '1-WEB-2026-00000010' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAbrir).toHaveBeenCalledWith('1-WEB-2026-00000010');
  });

  /* 5 · acceso a la búsqueda avanzada */
  it('el enlace de búsqueda avanzada dispara su callback', () => {
    const onAvanzada = vi.fn();
    render(<VistaVentanilla {...props({ onAbrirBusquedaAvanzada: onAvanzada })} />);
    fireEvent.click(screen.getByRole('button', { name: /Búsqueda avanzada/i }));
    expect(onAvanzada).toHaveBeenCalledOnce();
  });

  /* 6 · identidad reservada: el resultado nunca muestra el nombre */
  it('con identidad reservada muestra "Identidad protegida" y no el nombre', () => {
    const reservado = radicado({ identidadReservada: true });
    render(<VistaVentanilla {...props({ radicados: [reservado] })} />);
    fireEvent.change(screen.getByLabelText(/Buscar radicado/i), {
      target: { value: '1-WEB-2026' },
    });
    expect(screen.getByText(/Identidad protegida/i)).toBeTruthy();
    expect(screen.queryByText(/María Rincón/i)).toBeNull();
  });
});
