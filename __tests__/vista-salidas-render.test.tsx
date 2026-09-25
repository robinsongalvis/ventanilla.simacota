import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { VistaSalidas } from '@/app/interno/dashboard/components/salidas/VistaSalidas';
import type { SalidaOficial } from '@/src/types/salida';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — libro de salidas.
══════════════════════════════════════════════════════════════ */

function salida(overrides: Partial<SalidaOficial> = {}): SalidaOficial {
  return {
    salidaId:          '2-SAL-2026-00000012',
    consecutivo:       12,
    fechaSalida:       '2026-07-04T15:00:00.000Z',
    tipoSalida:        'RESPUESTA',
    radicadoEntradaId: '1-WEB-2026-00000045',
    destinatario:      { nombre: 'María Rincón', entidad: null, email: null, direccion: null },
    asunto:            'Respuesta sobre impuesto predial',
    dependenciaOrigen: 'SEC_HACIENDA',
    firmante:          { uid: 'u1', nombre: 'Secretario de Hacienda' },
    medioEnvio:        'CORREO',
    registradoPor:     { uid: 'uid-laura', nombre: 'Laura' },
    archivoPath:       null,
    ...overrides,
  };
}

function props(overrides = {}) {
  return {
    salidas:        [salida()],
    cargando:       false,
    error:          null,
    onAbrirEntrada: vi.fn(),
    onNuevaSalida:  vi.fn(),
    ...overrides,
  };
}

describe('Radicación de salida — VistaSalidas', () => {
  /* 1 · la fila del libro trae número, tipo, destinatario y firma */
  it('muestra la salida con su número, chip de tipo y datos del despacho', () => {
    render(<VistaSalidas {...props()} />);
    expect(screen.getByText('Libro de salidas')).toBeTruthy();
    expect(screen.getByText('2-SAL-2026-00000012')).toBeTruthy();
    expect(screen.getByText('Respuesta')).toBeTruthy();
    expect(screen.getByText(/María Rincón/)).toBeTruthy();
    expect(screen.getByText(/Firma: Secretario de Hacienda/)).toBeTruthy();
  });

  /* 2 · el amarre abre el radicado de entrada */
  it('clic en la entrada amarrada llama onAbrirEntrada', () => {
    const onAbrir = vi.fn();
    render(<VistaSalidas {...props({ onAbrirEntrada: onAbrir })} />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir radicado de entrada 1-WEB-2026-00000045/i }));
    expect(onAbrir).toHaveBeenCalledWith('1-WEB-2026-00000045');
  });

  /* 3 · la búsqueda filtra por destinatario sin tildes */
  it('buscar por destinatario filtra el libro', () => {
    const otra = salida({
      salidaId: '2-SAL-2026-00000013',
      consecutivo: 13,
      tipoSalida: 'OFICIO_INDEPENDIENTE',
      radicadoEntradaId: null,
      destinatario: { nombre: 'Gobernación de Santander', entidad: null, email: null, direccion: null },
      asunto: 'Solicitud de recursos',
    });
    render(<VistaSalidas {...props({ salidas: [salida(), otra] })} />);
    fireEvent.change(screen.getByLabelText('Buscar en el libro de salidas'), {
      target: { value: 'gobernacion' },
    });
    expect(screen.getByText('2-SAL-2026-00000013')).toBeTruthy();
    expect(screen.queryByText('2-SAL-2026-00000012')).toBeNull();
  });

  /* 4 · libro vacío con mensaje amable y botón de registro */
  it('sin salidas muestra el estado vacío y el botón Registrar salida', () => {
    const onNueva = vi.fn();
    render(<VistaSalidas {...props({ salidas: [], onNuevaSalida: onNueva })} />);
    expect(screen.getByText(/Aún no hay salidas registradas/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Registrar salida/i }));
    expect(onNueva).toHaveBeenCalledOnce();
  });
});
