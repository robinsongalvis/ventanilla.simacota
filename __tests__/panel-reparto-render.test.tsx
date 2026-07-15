import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { PanelReparto } from '@/app/interno/dashboard/components/reparto/PanelReparto';
import type { PlanillaReparto } from '@/src/types/planilla';

/* ══════════════════════════════════════════════════════════════
   Panel de Reparto — render con fetch mockeado.
══════════════════════════════════════════════════════════════ */

const PENDIENTE = {
  radicadoId: '1-FIS-2026-00000010',
  dependenciaDestino: 'SEC_GOBIERNO',
  asunto: 'Solicitud de certificado',
  fechaRadicado: '2026-07-10T13:00:00.000Z',
  horaRadicado: '08:00',
  numeroFolios: 2,
};

const PLANILLA_ABIERTA: PlanillaReparto = {
  planillaId: 'PL-2026-0007',
  consecutivo: 7,
  anio: 2026,
  fechaGeneracion: '2026-07-10T14:00:00.000Z',
  generadaPor: { uid: 'u1', nombre: 'Funcionaria Ventanilla' },
  estado: 'POR_ENTREGAR',
  filas: [
    {
      radicadoId: '1-FIS-2026-00000010',
      dependenciaDestino: 'SEC_GOBIERNO',
      areaAsignada: null,
      asunto: 'Solicitud de certificado',
      solicitanteNombre: 'Juan Pérez',
      numeroFolios: 2,
      anexosDescripcion: null,
      fechaRadicado: '2026-07-10T13:00:00.000Z',
      horaRadicado: '08:00',
      estado: 'PENDIENTE',
      entrega: null,
    },
    {
      radicadoId: '1-FIS-2026-00000011',
      dependenciaDestino: 'SEC_PLANEACION',
      areaAsignada: null,
      asunto: 'Licencia',
      solicitanteNombre: 'Identidad reservada',
      numeroFolios: 1,
      anexosDescripcion: null,
      fechaRadicado: '2026-07-10T13:30:00.000Z',
      horaRadicado: '08:30',
      estado: 'ENTREGADA',
      entrega: { fecha: '2026-07-10T16:00:00.000Z', recibidoPor: 'Ana Rueda', nota: null },
    },
  ],
  escaneoPath: null,
  escaneoNombre: null,
  cierre: null,
  anulacion: null,
};

function mockFetch(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => payload,
  })) as unknown as typeof fetch);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PanelReparto', () => {
  it('sin planilla abierta: lista pendientes y ofrece generar', async () => {
    mockFetch({ ok: true, pendientes: [PENDIENTE], planillas: [] });
    render(<PanelReparto onCerrar={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Pendientes de entrega')).toBeTruthy();
    });
    expect(screen.getByText('1-FIS-2026-00000010')).toBeTruthy();
    expect(screen.getByRole('button', { name: /generar planilla del día/i })).toBeTruthy();
  });

  it('con planilla en ruta: muestra filas, entrada de recibido y evidencia', async () => {
    mockFetch({ ok: true, pendientes: [], planillas: [PLANILLA_ABIERTA] });
    render(<PanelReparto onCerrar={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('PL-2026-0007').length).toBeGreaterThan(0);
    });
    // Fila pendiente: input para el nombre de quien recibe.
    expect(screen.getByLabelText('Nombre de quien recibió 1-FIS-2026-00000010')).toBeTruthy();
    // Fila entregada: constancia visible, sin input.
    expect(screen.getByText(/Recibió Ana Rueda/)).toBeTruthy();
    // Acciones de la ronda.
    expect(screen.getByRole('button', { name: /imprimir planilla/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /registrar entregas/i })).toBeTruthy();
    // Con una entrega registrada, ya no se puede anular.
    expect(screen.queryByRole('button', { name: /^anular$/i })).toBeNull();
  });

  it('hoja imprimible: formato institucional aprobado, fuera del contenedor print:hidden', async () => {
    mockFetch({ ok: true, pendientes: [], planillas: [PLANILLA_ABIERTA] });
    render(<PanelReparto onCerrar={() => {}} />);

    await waitFor(() => {
      expect(document.getElementById('planilla-reparto-print')).toBeTruthy();
    });

    const hoja = document.getElementById('planilla-reparto-print') as HTMLElement;

    // La hoja imprimible debe ser hija directa de <body> (portal), fuera del
    // contenedor `print:hidden` que causaba la impresión en blanco.
    expect(hoja.parentElement).toBe(document.body);
    expect(hoja.closest('.print\\:hidden')).toBeNull();

    // Formato oficial aprobado del sistema de calidad municipal.
    expect(hoja.textContent).toContain('PLANILLA PARA ENTREGA DE CORRESPONDENCIA');
    expect(hoja.textContent).toContain('F-GSC-8200-238-37-001');
    expect(hoja.textContent).toContain('Alcaldía de SIMACOTA');

    // Columnas de la cuadrícula, en el orden exacto del formato.
    for (const columna of [
      'No.', 'Fecha de Radicado', 'Hora Rad.', 'Número de Radicado',
      'Dependencia Asignada', 'Área Asignada', 'Nombre del Solicitante Natural / Jurídica',
      'Asunto', 'Dirección/Teléfonos', 'Nro. Fol.', 'Anexos',
      'Fecha / Hora de Recibido', 'Devuelta SI / NO', 'Nombre y Firma',
    ]) {
      expect(hoja.textContent).toContain(columna);
    }

    // Protección de datos: la columna Dirección/Teléfonos siempre va en "-",
    // nunca se incorpora PII nueva que el radicado no tenía.
    const filaSolicitante = hoja.querySelector('td[style*="monospace"]')?.closest('tr');
    expect(filaSolicitante?.textContent).toContain('Juan Pérez');
    const celdas = filaSolicitante ? [...filaSolicitante.querySelectorAll('td')] : [];
    // Orden de columnas: 4=radicado, 8=asunto, 9=Dirección/Teléfonos → índice 8.
    expect(celdas[8]?.textContent).toBe('-');
  });

  it('sin pendientes ni planillas: estado vacío honesto', async () => {
    mockFetch({ ok: true, pendientes: [], planillas: [] });
    render(<PanelReparto onCerrar={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/No hay documentos físicos esperando reparto/)).toBeTruthy();
    });
    const generar = screen.getByRole('button', { name: /generar planilla del día/i });
    expect((generar as HTMLButtonElement).disabled).toBe(true);
  });
});
