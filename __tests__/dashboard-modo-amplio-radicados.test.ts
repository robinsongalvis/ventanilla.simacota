import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('app/interno/dashboard/page.tsx', 'utf8');
const indicadores = readFileSync('lib/hooks/useIndicadoresModo.ts', 'utf8');

describe('Dashboard — vista amplia de radicados', () => {
  it('ofrece un control visible para ocultar o restaurar paneles operativos', () => {
    expect(dashboard).toContain('Vista amplia');
    expect(dashboard).toContain('Mostrar paneles');
    expect(dashboard).toContain('Ocultar paneles operativos y ampliar la lista de radicados');
    expect(dashboard).toContain('Mostrar Bandeja Operativa y Siguiente Atención');
  });

  it('oculta Bandeja Operativa y Siguiente Atención sin desmontar filtros ni tabla', () => {
    expect(dashboard).toContain('{!indicadoresCompactos && (');
    expect(dashboard).toContain('<PanelOperacionDependencia');
    expect(dashboard).toContain('<TarjetasMIPG');
    expect(dashboard).toContain('<TablaRadicados');
  });

  it('reutiliza la preferencia persistente existente sin crear lógica nueva de negocio', () => {
    expect(dashboard).toContain('const indicadoresCompactos = indicadoresModo === \'compacto\';');
    expect(dashboard).toContain('onToggleCompacto={toggleIndicadoresModo}');
    expect(indicadores).toContain("window.localStorage.setItem(STORAGE_KEY, next)");
  });
});
