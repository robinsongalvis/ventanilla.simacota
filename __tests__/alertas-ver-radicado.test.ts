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

  it('al cerrar el panel elimina radicadoId de la URL para evitar reapertura automática', () => {
    expect(dashboard).toContain('const cerrarPanelDerecho = useCallback(() => {');
    expect(dashboard).toContain("params.delete('radicadoId')");
    expect(dashboard).toContain("router.replace(query ? `/interno/dashboard?${query}` : '/interno/dashboard'");
    expect(dashboard).toContain("dispatch({ type: 'CERRAR_PANEL_DERECHO' })");
    expect(dashboard).toContain('radicadoCerradoDesdeUrlRef.current === radicadoId');
    expect(dashboard).toContain('onCerrar={cerrarPanelDerecho}');
  });

  it('conserva permisos por rol/dependencia usando el stream filtrado', () => {
    expect(dashboard).toContain('todosLosRadicados.find((r) => r.radicadoId === id)');
    // Panel Op Nivel 1: la decisión de alcance vive en el helper puro
    // puedeVerTodosLosTenants (ADMIN, CONTROL_INTERNO y RECEPCIONISTA
    // ven todo; FUNCIONARIO y JEFE_DEPENDENCIA solo su tenant). La
    // política completa se testea en __tests__/alcance-tenants.test.ts.
    expect(hookRadicados).toContain('puedeVerTodosLosTenants(usuario.rol)');
    expect(hookRadicados).toContain('usuario.tenantId');
    expect(hookRadicados).toContain("where('clasificacion.oficinaDestino', '==', effectiveTenant)");
  });

  it('si falta o no está permitido el ID, muestra error seguro y no selecciona', () => {
    expect(dashboard).toContain("setErrorAbrirRadicado('No fue posible abrir el radicado.')");
    expect(dashboard).toContain("console.warn('[dashboard] No fue posible abrir radicado: ID ausente.')");
    expect(dashboard).toContain("console.warn('[dashboard] No fue posible abrir radicado dentro del alcance del usuario.', { radicadoId: id })");
  });

  it('el mensaje de «no encontrado» no revela SI el radicado existe (24-ago-2026)', () => {
    // La misma rama cubre «fuera de la ventana de 180 días» y «fuera de su
    // dependencia». Al añadir la salida útil (búsqueda avanzada) se
    // enuncian AMBAS causas sin confirmar cuál: afirmar la ventana le diría
    // a un funcionario que un radicado ajeno EXISTE. El id tampoco se
    // interpola en el mensaje visible.
    const bloque = dashboard.slice(
      dashboard.indexOf('const radicado = todosLosRadicados.find'),
      dashboard.indexOf('setErrorAbrirRadicado(null)'),
    );
    expect(bloque).toContain('o fuera de su dependencia');
    expect(bloque).toContain('Búsqueda avanzada');
    expect(bloque).not.toMatch(/setErrorAbrirRadicado\(\s*`[^`]*\$\{id\}/);
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
