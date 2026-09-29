import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const vistaAdministracion = readFileSync('app/interno/dashboard/components/admin/VistaAdministracion.tsx', 'utf8');
const dashboard = readFileSync('app/interno/dashboard/page.tsx', 'utf8');

describe('Usuarios Internos — layout con scroll vertical', () => {
  it('usa una columna flex con altura contenida para no recortar la lista', () => {
    expect(vistaAdministracion).toContain('flex h-full min-h-0 flex-1 flex-col overflow-hidden');
  });

  it('mantiene encabezado y mensajes fuera del área desplazable', () => {
    expect(vistaAdministracion).toContain('<SectionHeader');
    // Ola 3 (ADR-0046): mensajes con los gutters del Tablero, fuera del scroll.
    expect(vistaAdministracion).toContain('mx-3 mt-2 shrink-0 px-4 py-3');
  });

  it('limita el scroll vertical al listado de usuarios', () => {
    expect(vistaAdministracion).toContain('min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 lg:px-6');
    // La cabecera fija la pone la primitiva compartida (sticky top-0, ver su contrato).
    expect(vistaAdministracion).toContain('<CabeceraTablaSticky');
  });

  it('no deforma el panel derecho de SIMI en pantallas anchas', () => {
    expect(dashboard).toContain('min-w-0 flex-1 overflow-hidden min-h-0');
    expect(dashboard).toContain('xl:flex flex-col w-full xl:w-[420px] shrink-0 xl:border-l');
  });

  it('por debajo de 1280 px la gobernanza SIMI sigue alcanzable (pestañas)', () => {
    // Antes era `hidden xl:flex` sin alternativa: inaccesible en portátiles y tabletas.
    expect(dashboard).toContain('<div className="xl:hidden shrink-0 px-3 pt-2 sm:px-4 lg:px-6">');
    expect(dashboard).toContain("{ id: 'GOBERNANZA' as const, etiqueta: 'Gobernanza SIMI' }");
  });
});
