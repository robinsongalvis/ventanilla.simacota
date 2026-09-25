import { describe, expect, it } from 'vitest';
import {
  aplicarDatosCompletados,
  construirNotaDatosCompletados,
} from '@/lib/mostrador/completar-datos';

/* ══════════════════════════════════════════════════════════════
   Sprint Cierre del mostrador — completar datos del solicitante.

   Whitelist de contacto (correo, teléfonos, dirección); nombre y
   documento no se tocan por aquí. La nota nunca lleva valores.
══════════════════════════════════════════════════════════════ */

describe('Cierre del mostrador — aplicarDatosCompletados', () => {
  /* 1 · aportar correo apaga su marca */
  it('el correo aportado apaga la marca de correo', () => {
    const r = aplicarDatosCompletados(
      { correo: true, telefono: true },
      { email: '  ciudadano@example.com ' },
    );
    expect(r?.cambios).toEqual({ email: 'ciudadano@example.com' });
    expect(r?.datosNoAportados).toEqual({
      documento: false, correo: false, telefono: true, direccion: false,
    });
    expect(r?.camposAportados).toEqual(['correo']);
  });

  /* 2 · cualquier teléfono apaga la marca de teléfono */
  it('el teléfono móvil apaga la marca de teléfono', () => {
    const r = aplicarDatosCompletados({ telefono: true }, { telefonoMovil: '3203452716' });
    expect(r?.datosNoAportados).toBeNull();
    expect(r?.cambios.telefonoMovil).toBe('3203452716');
  });

  /* 3 · la marca de documento nunca se toca por esta vía */
  it('documento queda intacto aunque se aporte todo lo demás', () => {
    const r = aplicarDatosCompletados(
      { documento: true, correo: true, telefono: true, direccion: true },
      { email: 'a@b.co', telefonoFijo: '6076543', direccion: 'Calle 1' },
    );
    expect(r?.datosNoAportados).toEqual({
      documento: true, correo: false, telefono: false, direccion: false,
    });
  });

  /* 4 · sin marcas restantes, el campo se borra (null) */
  it('devuelve datosNoAportados null cuando no queda ninguna marca', () => {
    const r = aplicarDatosCompletados({ correo: true }, { email: 'a@b.co' });
    expect(r?.datosNoAportados).toBeNull();
  });

  /* 5 · nada válido → null (el endpoint responde 400) */
  it('con solo espacios o campos vacíos devuelve null', () => {
    expect(aplicarDatosCompletados({ correo: true }, { email: '   ' })).toBeNull();
    expect(aplicarDatosCompletados({ correo: true }, {})).toBeNull();
  });

  /* 6 · funciona sin marcas previas (histórico sin datosNoAportados) */
  it('sin marcas previas actualiza el dato y no inventa marcas', () => {
    const r = aplicarDatosCompletados(undefined, { direccion: 'Carrera 4 620' });
    expect(r?.cambios.direccion).toBe('Carrera 4 620');
    expect(r?.datosNoAportados).toBeNull();
  });
});

describe('Cierre del mostrador — construirNotaDatosCompletados', () => {
  /* 7 · la nota lista campos, jamás valores */
  it('arma la nota con los nombres de los campos', () => {
    const nota = construirNotaDatosCompletados(['correo', 'teléfono móvil']);
    expect(nota).toBe('El ciudadano aportó posteriormente: correo, teléfono móvil.');
    expect(nota).not.toContain('@');
  });
});
