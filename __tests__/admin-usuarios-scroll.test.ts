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
    expect(vistaAdministracion).toContain('mt-4 shrink-0 px-4 py-3');
  });

  it('limita el scroll vertical al listado de usuarios', () => {
    expect(vistaAdministracion).toContain('min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 py-4');
    expect(vistaAdministracion).toContain('<thead className="sticky top-0 z-10">');
  });

  it('no deforma el panel derecho de SIMI', () => {
    expect(dashboard).toContain('min-w-0 flex-1 overflow-hidden min-h-0');
    expect(dashboard).toContain('hidden xl:flex flex-col w-[420px] shrink-0 border-l');
  });
});
