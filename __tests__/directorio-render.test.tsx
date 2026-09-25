import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import DirectorioPage from '@/app/directorio/page';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';

/* ══════════════════════════════════════════════════════════════
   Directorio de Dependencias — rediseño identidad institucional
   clara (verde #14532D + dorado + fondos claros).
   Antes: tema oscuro (`bg-obsidian-gradient`) heredado del portal
   público, sin relación con la identidad del resto de la
   plataforma. Este test fija el contrato visual: título, un
   mailto real por dependencia, y ausencia de clases/colores del
   tema oscuro previo.
══════════════════════════════════════════════════════════════ */

afterEach(() => {
  cleanup();
});

describe('DirectorioPage', () => {
  it('muestra el título y la sobrelínea institucional', () => {
    render(<DirectorioPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Directorio de Dependencias' })).toBeTruthy();
    expect(screen.getAllByText('Administración Municipal').length).toBeGreaterThan(0);
  });

  it('lista la Ventanilla Única con su correo real en un enlace mailto', () => {
    render(<DirectorioPage />);
    const ventanilla = DIRECTORIO_TENANTS.VENTANILLA_UNICA;
    expect(screen.getByText(ventanilla.nombreOficial)).toBeTruthy();
    const enlace = screen.getByRole('link', { name: ventanilla.emailOficial });
    expect(enlace.getAttribute('href')).toBe(`mailto:${ventanilla.emailOficial}`);
  });

  it('el enlace de Inicio apunta a la portada', () => {
    render(<DirectorioPage />);
    expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('href')).toBe('/');
  });

  it('no conserva clases ni colores del tema oscuro previo', () => {
    const { container } = render(<DirectorioPage />);
    expect(container.querySelector('.bg-obsidian-gradient')).toBeNull();
    expect(container.innerHTML).not.toContain('text-slate-100');
    expect(container.innerHTML).not.toContain('#0A0A0B');
  });
});
