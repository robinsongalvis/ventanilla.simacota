import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('app/interno/dashboard/page.tsx', 'utf8');
const vistaAlertas = readFileSync('app/interno/dashboard/components/analytics/VistaAlertas.tsx', 'utf8');
const hookRadicados = readFileSync('lib/hooks/useVentanillaRadicados.ts', 'utf8');

describe('Panel de Alertas Predictivas — navegación Ver radicado', () => {
  it('el botón entrega el radicado completo al callback existente', () => {
    expect(vistaAlertas).toContain('onVerRadicado: (r: VentanillaRadicado) => void');
    expect(vistaAlertas).toContain('onVerRadicado={onVerRadicado}');
    expect(vistaAlertas).toContain('onClick={() => onVerRadicado(r)}');
  });

  it('la integración usa radicadoId interno y no numeroRadicado', () => {
    expect(dashboard).toContain('onVerRadicado={(r) => abrirRadicadoPorId(r.radicadoId)}');
    expect(dashboard).not.toContain('abrirRadicadoPorId(r.numeroRadicado)');
  });

  it('reutiliza la selección existente del dashboard para abrir el detalle', () => {
    expect(dashboard).toContain("dispatch({ type: 'SELECCIONAR_RADICADO', radicado })");
  });

  it('navega con query param sanitizado para soportar recarga o apertura directa', () => {
    expect(dashboard).toContain("router.push(`/interno/dashboard?radicadoId=${encodeURIComponent(id)}`");
    expect(dashboard).toContain("searchParams.get('radicadoId')");
    expect(dashboard).toContain('abrirRadicadoPorId(radicadoId, false)');
  });

  it('cambia a TABLERO para que el panel derecho sí se renderice', () => {
    expect(dashboard).toContain("dispatch({ type: 'SET_VISTA', vista: 'TABLERO' })");
    expect(dashboard).toContain('panelDerechoAbierto');
  });

  it('conserva permisos por rol/dependencia usando el stream filtrado', () => {
    expect(dashboard).toContain('todosLosRadicados.find((r) => r.radicadoId === id)');
    expect(hookRadicados).toContain("usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO'");
    expect(hookRadicados).toContain('usuario.tenantId');
    expect(hookRadicados).toContain("where('clasificacion.oficinaDestino', '==', effectiveTenant)");
  });

  it('si falta o no está permitido el ID, muestra error seguro y no selecciona', () => {
    expect(dashboard).toContain("setErrorAbrirRadicado('No fue posible abrir el radicado.')");
    expect(dashboard).toContain("console.warn('[dashboard] No fue posible abrir radicado: ID ausente.')");
    expect(dashboard).toContain("console.warn('[dashboard] No fue posible abrir radicado dentro del alcance del usuario.', { radicadoId: id })");
  });

  it('no altera filtros MIPG ni recalcula el Panel de Alertas', () => {
    const bloqueAlertas = dashboard.slice(
      dashboard.indexOf("vistaActual === 'ALERTAS'"),
      dashboard.indexOf("vistaActual === 'REPORTES'"),
    );
    expect(bloqueAlertas).not.toContain("SET_FILTRO_MIPG");
    expect(vistaAlertas).toContain('const { alertas } = useAnalytics(');
  });
});
