import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('app/interno/dashboard/page.tsx', 'utf8');
const indicadores = readFileSync('lib/hooks/useIndicadoresModo.ts', 'utf8');
const store = readFileSync('lib/store/ventanillaStore.tsx', 'utf8');

describe('Dashboard — vista amplia de radicados', () => {
  it('por defecto los paneles aparecen normales', () => {
    expect(indicadores).toContain('useState(false)');
    expect(indicadores).toContain("return v === 'compacto' ? 'compacto' : 'normal'");
  });

  it('ofrece un control general para minimizar o restaurar paneles operativos', () => {
    expect(dashboard).toContain('Minimizar paneles');
    expect(dashboard).toContain('Mostrar paneles');
    expect(dashboard).toContain('Minimizar paneles operativos y ampliar la lista de radicados');
    expect(dashboard).toContain('Mostrar Bandeja Operativa y Siguiente Atención');
  });

  it('permite minimizar y mostrar cada tarjeta individualmente', () => {
    expect(dashboard).toContain('bandejaMinimizada ? (');
    expect(dashboard).toContain('siguienteMinimizada ? (');
    expect(dashboard).toContain('onClick={onToggleBandeja}');
    expect(dashboard).toContain('onClick={onToggleSiguiente}');
    expect(dashboard).toContain('Minimizar');
    expect(dashboard).toContain('Mostrar');
  });

  it('mantiene barras compactas y la tabla visible con más espacio', () => {
    expect(dashboard).toContain('min-h-12 rounded-xl');
    expect(dashboard).toContain('{resumen.totalActivos} activos');
    expect(dashboard).toContain('{resumen.vencidos} vencidos');
    expect(dashboard).toContain('<PanelOperacionDependencia');
    expect(dashboard).toContain('<TarjetasMIPG');
    expect(dashboard).toContain('<TablaRadicados');
  });

  it('conserva la preferencia de ambos paneles tras recargar', () => {
    expect(dashboard).toContain('const indicadoresCompactos = indicadoresModo === \'compacto\';');
    expect(dashboard).toContain('onToggleCompacto={toggleIndicadoresModo}');
    expect(indicadores).toContain("dashboardPanelBandejaMinimizada");
    expect(indicadores).toContain("dashboardPanelSiguienteMinimizada");
    expect(indicadores).toContain('window.localStorage.setItem(STORAGE_BANDEJA, String(bandeja))');
    expect(indicadores).toContain('window.localStorage.setItem(STORAGE_SIGUIENTE, String(siguiente))');
  });

  it('convierte Correos fallidos en un acceso al filtro de radicados afectados', () => {
    expect(store).toContain("| 'CORREOS_FALLIDOS'");
    expect(dashboard).toContain("filtro === 'CORREOS_FALLIDOS'");
    expect(dashboard).toContain('onClick={onVerCorreosFallidos}');
    expect(dashboard).toContain("dispatch({ type: 'SET_FILTRO_MIPG', filtro: 'CORREOS_FALLIDOS' })");
    expect(dashboard).toContain("dispatch({ type: 'SET_BUSQUEDA', busqueda: '' })");
  });

  it('mantiene Ver radicado y la selección existentes', () => {
    expect(dashboard).toContain('onVerRadicado={(r) => abrirRadicadoPorId(r.radicadoId)}');
    expect(dashboard).toContain("dispatch({ type: 'SELECCIONAR_RADICADO', radicado })");
    expect(dashboard).toContain('radicadoSeleccionadoId={radicadoSeleccionado?.radicadoId ?? null}');
  });

  it('mantiene Semáforo PQRSD y métricas visibles', () => {
    expect(dashboard).toContain('{esAdmin && (');
    expect(dashboard).toContain('<PqrsdDeadlineDashboard');
    expect(dashboard).toContain('<TarjetasMIPG');
  });

  it('evita desbordamiento horizontal en las barras móviles', () => {
    expect(dashboard).toContain('overflow-hidden');
    expect(dashboard).toContain('min-w-0 truncate text-xs');
    expect(dashboard).toContain('shrink-0 min-h-9');
    expect(dashboard).toContain('grid grid-cols-1 lg:grid-cols');
  });
});
