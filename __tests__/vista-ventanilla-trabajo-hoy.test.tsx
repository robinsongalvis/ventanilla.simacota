import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { VistaVentanilla } from '@/app/interno/dashboard/components/ventanilla/VistaVentanilla';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Ventanilla · módulo de mostrador — lista "Trabajo de hoy".

   `ahora` se inyecta fija para que "hoy" sea determinista.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-WEB-2026-00000010',
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: AHORA.toISOString(),
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
      fechaRadicado:  AHORA.toISOString(),
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

const pdfSinSellar = {
  nombre:    'oficio.pdf',
  path:      'radicados/x/oficio.pdf',
  tipo:      'application/pdf',
  tamanioKB: 100,
  orden:     1,
};

function segundo(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return radicado({
    radicadoId: '1-WEB-2026-00000011',
    control: {
      radicadoId:     '1-WEB-2026-00000011',
      consecutivo:    11,
      fechaRadicado:  '2026-07-02T16:00:00.000Z',
      horaRadicado:   '11:00',
      medioRecepcion: 'PRESENCIAL',
      origen:         'FISICO_ESCANER',
    },
    ...overrides,
  });
}

function props(overrides = {}) {
  return {
    radicados:               [radicado()],
    puedeRadicar:            true,
    onNuevaRadicacion:       vi.fn(),
    onAbrirBusquedaAvanzada: vi.fn(),
    onAbrirRadicado:         vi.fn(),
    ahora:                   AHORA,
    ...overrides,
  };
}

describe('Mostrador — Trabajo de hoy', () => {
  /* 1 · filas de hoy con sus chips de pendiente; ayer no entra */
  it('lista los radicados de hoy con chips y excluye los de ayer', () => {
    const hoyConSello = radicado({ archivos: [pdfSinSellar] });
    const deAyer = segundo({
      radicadoId: '1-WEB-2026-00000009',
      control: {
        radicadoId:     '1-WEB-2026-00000009',
        consecutivo:    9,
        fechaRadicado:  '2026-07-01T14:00:00.000Z',
        horaRadicado:   '09:00',
        medioRecepcion: 'PRESENCIAL',
        origen:         'FISICO_ESCANER',
      },
    });

    render(<VistaVentanilla {...props({ radicados: [hoyConSello, deAyer] })} />);
    expect(screen.getByText('Trabajo de hoy')).toBeTruthy();
    expect(screen.getByText('1-WEB-2026-00000010')).toBeTruthy();
    expect(screen.getByText('PDF sin sellar')).toBeTruthy();
    expect(screen.queryByText('1-WEB-2026-00000009')).toBeNull();
  });

  /* 2 · el chip de filtro reduce la lista a su pendiente */
  it('el chip "Correo fallido" filtra las filas', () => {
    const conSello  = radicado({ archivos: [pdfSinSellar] });
    const conCorreo = segundo({ alertaNotificacionFallida: true });

    render(<VistaVentanilla {...props({ radicados: [conSello, conCorreo] })} />);
    fireEvent.click(screen.getByRole('button', { name: /Filtrar trabajo de hoy: Correo fallido/i }));
    expect(screen.getByText('1-WEB-2026-00000011')).toBeTruthy();
    expect(screen.queryByText('1-WEB-2026-00000010')).toBeNull();
  });

  /* 3 · abrir una fila lleva al detalle */
  it('clic en la fila llama onAbrirRadicado con su id', () => {
    const onAbrir = vi.fn();
    render(<VistaVentanilla {...props({ onAbrirRadicado: onAbrir })} />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir radicado 1-WEB-2026-00000010/i }));
    expect(onAbrir).toHaveBeenCalledWith('1-WEB-2026-00000010');
  });

  /* 4 · día sin radicaciones muestra estado vacío amable */
  it('sin radicados hoy muestra el estado vacío', () => {
    render(<VistaVentanilla {...props({ radicados: [] })} />);
    expect(screen.getByText(/Hoy no se han radicado documentos/i)).toBeTruthy();
  });

  /* 5 · identidad reservada: chip sí, nombre jamás */
  it('marca identidad reservada sin exponer el nombre', () => {
    const reservado = radicado({ identidadReservada: true });
    render(<VistaVentanilla {...props({ radicados: [reservado] })} />);
    expect(screen.getByText('Identidad reservada')).toBeTruthy();
    expect(screen.queryByText(/María Rincón/i)).toBeNull();
  });

  /* 6 · mientras se busca, la lista cede el lugar a los resultados */
  it('oculta Trabajo de hoy cuando hay una consulta activa', () => {
    render(<VistaVentanilla {...props()} />);
    fireEvent.change(screen.getByLabelText(/Buscar radicado/i), {
      target: { value: '1098' },
    });
    expect(screen.queryByText('Trabajo de hoy')).toBeNull();
    expect(screen.getByText(/1 coincidencia/i)).toBeTruthy();
  });
});
