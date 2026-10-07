import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { VistaVentanilla, type VistaVentanillaProps } from '@/app/interno/dashboard/components/ventanilla/VistaVentanilla';

/* ══════════════════════════════════════════════════════════════
   Hub de Ventanilla (decisión del propietario, 23-sep-2026).

   Ventanilla es el centro operativo de la recepción: estado de la operación
   en tarjetas y todas sus herramientas, sin flujos nuevos. Las tarjetas
   MUESTRAN el estado y LLEVAN a donde se gestiona; nunca filtran aquí.
   Cada acción aparece solo si la página la entrega (permiso).
══════════════════════════════════════════════════════════════ */

afterEach(cleanup);

const AHORA = new Date('2026-09-23T15:00:00.000Z');
const RESUMEN = { porAsignar: 3, datosIncompletos: 2, conErrores: 1, porVencer: 4 };

function vista(extra: Partial<VistaVentanillaProps> = {}) {
  return render(
    <VistaVentanilla
      radicados={[]}
      puedeRadicar
      onNuevaRadicacion={vi.fn()}
      onAbrirBusquedaAvanzada={vi.fn()}
      onAbrirRadicado={vi.fn()}
      ahora={AHORA}
      {...extra}
    />,
  );
}

describe('Hub de Ventanilla', () => {
  it('sin resumen es solo el mostrador (compatibilidad)', () => {
    vista();
    expect(screen.queryByRole('group', { name: 'Estado de la operación de recepción' })).toBeNull();
  });

  it('cinco tarjetas de estado; «Radicados hoy» es de lectura y las demás llevan a donde se gestionan', () => {
    const onAbrirBandeja = vi.fn();
    const onVerEnTablero = vi.fn();
    vista({ resumenOperacion: RESUMEN, onAbrirBandeja, onVerEnTablero });
    const grupo = screen.getByRole('group', { name: 'Estado de la operación de recepción' });
    expect(grupo.textContent).toContain('Radicados hoy');
    // Ninguna tarjeta es un filtro.
    expect(grupo.querySelector('[aria-pressed]')).toBeNull();
    const botones = within(grupo).getAllByRole('button');
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Por asignar: 3. En la bandeja de asignación. Abrir la bandeja de asignación',
      'Datos incompletos: 2. Datos no aportados por el solicitante. Ver en el Tablero',
      'Con errores: 1. Notificaciones fallidas. Ver en el Tablero',
      'Por vencer: 4. Próximos a vencer. Ver en el Tablero',
    ]);
    fireEvent.click(botones[0]);
    expect(onAbrirBandeja).toHaveBeenCalledOnce();
    fireEvent.click(botones[1]);
    fireEvent.click(botones[2]);
    fireEvent.click(botones[3]);
    expect(onVerEnTablero.mock.calls.map((c) => c[0])).toEqual(['DATOS_INCOMPLETOS', 'CORREOS_FALLIDOS', 'POR_VENCER']);
  });

  it('sin permiso de una acción, su tarjeta queda de lectura y su botón no aparece', () => {
    vista({ resumenOperacion: RESUMEN });
    const grupo = screen.getByRole('group', { name: 'Estado de la operación de recepción' });
    expect(within(grupo).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Libro de salidas/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Registrar salida/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reparto del día/ })).toBeNull();
  });

  it('todas las herramientas de recepción que ya existen, en la barra de acciones', () => {
    const onAbrirSalidas = vi.fn();
    vista({ resumenOperacion: RESUMEN, onAbrirSalidas, onRegistrarSalida: vi.fn(), onAbrirReparto: vi.fn() });
    for (const nombre of ['Libro de salidas', 'Reparto del día', 'Registrar salida', 'Nueva radicación', 'Búsqueda avanzada']) {
      expect(screen.getByRole('button', { name: nombre })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Libro de salidas' }));
    expect(onAbrirSalidas).toHaveBeenCalledOnce();
  });

  it('la página calcula cada cifra con el mismo filtro que aplica al llegar y deja solo ese filtro', () => {
    const pagina = readFileSync('app/interno/dashboard/page.tsx', 'utf8');
    const resumen = pagina.slice(pagina.indexOf('const resumenOperacionVentanilla'), pagina.indexOf('function verCorreosFallidos'));
    expect(resumen).toContain("porAsignar: radicadosPendientes.length");
    expect(resumen).toContain("filtrarSoloDatosIncompletos(activosTablero)");
    expect(resumen).toContain("aplicarFiltroMIPG(todosLosRadicados, 'CORREOS_FALLIDOS', '')");
    expect(resumen).toContain("aplicarFiltroMIPG(todosLosRadicados, 'POR_VENCER', '')");
    for (const reinicio of ["SET_BUSQUEDA', busqueda: ''", "setFiltroOperativo('NINGUNO')", 'setSoloMios(false)', "SET_VISTA', vista: 'TABLERO'"]) {
      expect(resumen).toContain(reinicio);
    }
    // Cada acceso del hub respeta su permiso.
    expect(pagina).toContain("onAbrirBandeja={tienePermisoBandeja ? () => cambiarVista('BANDEJA') : undefined}");
    expect(pagina).toContain("onAbrirSalidas={puedeVerLibroSalidas ? () => cambiarVista('SALIDAS') : undefined}");
  });
});
