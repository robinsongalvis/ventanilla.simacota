import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { RadicacionFuncionarioForm } from '@/app/interno/recepcion/components/RadicacionFuncionarioForm';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Sprint Recepción fluida — fix "No aporta documento".

   Bug reportado por la funcionaria: al marcar "No aporta documento
   de identidad" el campo Identificación seguía siendo required y el
   navegador bloqueaba el envío con "Completa este campo".
══════════════════════════════════════════════════════════════ */

function renderForm() {
  render(<RadicacionFuncionarioForm radicadoPreview="1-OFICIO-2026-00000099" />);
  return {
    identificacion: screen.getByLabelText('Identificación') as HTMLInputElement,
    checkbox: screen.getByLabelText(/No aporta documento de identidad/i) as HTMLInputElement,
  };
}

describe('Recepción — radicar sin documento de identidad', () => {
  /* 1 · por defecto la identificación es obligatoria */
  it('la identificación es required cuando no hay marca', () => {
    const { identificacion } = renderForm();
    expect(identificacion.required).toBe(true);
    expect(identificacion.disabled).toBe(false);
  });

  /* 2 · marcar "no aporta" libera y bloquea el campo */
  it('al marcar "No aporta documento" el campo deja de ser required y queda deshabilitado', () => {
    const { identificacion, checkbox } = renderForm();
    fireEvent.click(checkbox);
    expect(identificacion.required).toBe(false);
    expect(identificacion.disabled).toBe(true);
  });

  /* 3 · nunca quedan cédula tecleada y marca al mismo tiempo */
  it('al marcar la casilla se limpia la identificación ya tecleada', () => {
    const { identificacion, checkbox } = renderForm();
    fireEvent.change(identificacion, { target: { value: '1101321226' } });
    expect(identificacion.value).toBe('1101321226');
    fireEvent.click(checkbox);
    expect(identificacion.value).toBe('');
  });

  /* 4 · desmarcar restaura la obligatoriedad */
  it('al desmarcar la casilla el campo vuelve a ser required y editable', () => {
    const { identificacion, checkbox } = renderForm();
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(identificacion.required).toBe(true);
    expect(identificacion.disabled).toBe(false);
  });
});
