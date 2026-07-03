import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { RadicacionFuncionarioForm } from '@/app/interno/recepcion/components/RadicacionFuncionarioForm';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación dirigida — selector de dependencia destino en
   el formulario de Radicación Rápida.
══════════════════════════════════════════════════════════════ */

describe('Radicación dirigida — selector de dependencia destino', () => {
  /* 1 · el selector existe y arranca en Ventanilla Única */
  it('muestra "Dependencia destino" con Ventanilla Única por defecto', () => {
    render(<RadicacionFuncionarioForm radicadoPreview="1-OFICIO-2026-00000099" />);
    const select = screen.getByLabelText('Dependencia destino') as HTMLSelectElement;
    expect(select.value).toBe('VENTANILLA_UNICA');
  });

  /* 2 · ofrece las dependencias del directorio institucional */
  it('incluye Planeación, Hacienda y Comisaría entre las opciones', () => {
    render(<RadicacionFuncionarioForm radicadoPreview="1-OFICIO-2026-00000099" />);
    const select = screen.getByLabelText('Dependencia destino') as HTMLSelectElement;
    const valores = Array.from(select.options).map((o) => o.value);
    expect(valores).toContain('SEC_PLANEACION');
    expect(valores).toContain('SEC_HACIENDA');
    expect(valores).toContain('SUB_COMISARIA');
  });

  /* 3 · Laura puede dirigirlo a otra dependencia */
  it('permite cambiar el destino a otra dependencia', () => {
    render(<RadicacionFuncionarioForm radicadoPreview="1-OFICIO-2026-00000099" />);
    const select = screen.getByLabelText('Dependencia destino') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'SEC_PLANEACION' } });
    expect(select.value).toBe('SEC_PLANEACION');
  });
});
