/**
 * Utilidad compartida de enmascaramiento de identidad reservada — H2
 * (ADR-0006, variante A: enmascarar por defecto).
 *
 * Antes de esta utilidad el criterio vivía duplicable y local a
 * `VistaVentanilla.tsx` y se aplicaba solo en el mostrador. Este test
 * cubre el criterio de reserva y las funciones de valor visible que ahora
 * se reutilizan en el panel de detalle, la bandeja de asignación, las
 * filas de lista y la exportación CSV/Excel de `app/interno/dashboard/page.tsx`.
 */
import { describe, expect, it } from 'vitest';
import {
  documentoSolicitanteVisible,
  identidadProtegida,
  MARCADOR_DOCUMENTO_PROTEGIDO,
  MARCADOR_NOMBRE_PROTEGIDO,
  nombreSolicitanteVisible,
  numeroDocumentoVisible,
  type RadicadoConReserva,
} from '@/lib/seguridad/identidad-protegida';

const IDENTIFICADA: RadicadoConReserva = {
  esAnonimo: false,
  identidadReservada: false,
  tipoPresentacion: 'IDENTIFICADA',
};

const RESERVADA: RadicadoConReserva = {
  esAnonimo: false,
  identidadReservada: true,
  tipoPresentacion: 'RESERVADA',
};

const ANONIMA: RadicadoConReserva = {
  esAnonimo: true,
  identidadReservada: false,
  tipoPresentacion: 'ANONIMA',
};

describe('identidadProtegida', () => {
  it('no reservada: identidad visible', () => {
    expect(identidadProtegida(IDENTIFICADA)).toBe(false);
  });

  it('identidadReservada === true: identidad protegida', () => {
    expect(identidadProtegida(RESERVADA)).toBe(true);
  });

  it('esAnonimo === true: identidad protegida', () => {
    expect(identidadProtegida(ANONIMA)).toBe(true);
  });

  it('tipoPresentacion RESERVADA sin la bandera booleana: igual protegida (defensivo)', () => {
    expect(identidadProtegida({ tipoPresentacion: 'RESERVADA' })).toBe(true);
  });

  it('tipoPresentacion ANONIMA sin la bandera booleana: igual protegida (defensivo)', () => {
    expect(identidadProtegida({ tipoPresentacion: 'ANONIMA' })).toBe(true);
  });

  it('sin ningún campo presente (radicado histórico): identidad visible', () => {
    expect(identidadProtegida({})).toBe(false);
  });
});

describe('nombreSolicitanteVisible', () => {
  it('no reservada: devuelve el nombre real', () => {
    expect(nombreSolicitanteVisible(IDENTIFICADA, 'María Pérez')).toBe('María Pérez');
  });

  it('reservada: devuelve el marcador, nunca el nombre real', () => {
    expect(nombreSolicitanteVisible(RESERVADA, 'María Pérez')).toBe(MARCADOR_NOMBRE_PROTEGIDO);
  });

  it('anónima: devuelve el marcador', () => {
    expect(nombreSolicitanteVisible(ANONIMA, 'María Pérez')).toBe(MARCADOR_NOMBRE_PROTEGIDO);
  });
});

describe('documentoSolicitanteVisible', () => {
  it('no reservada: devuelve tipo + número de documento', () => {
    expect(documentoSolicitanteVisible(IDENTIFICADA, 'CC', '1101321226')).toBe('CC 1101321226');
  });

  it('reservada: devuelve el marcador, nunca el documento real', () => {
    expect(documentoSolicitanteVisible(RESERVADA, 'CC', '1101321226')).toBe(MARCADOR_DOCUMENTO_PROTEGIDO);
  });
});

describe('numeroDocumentoVisible', () => {
  it('no reservada: devuelve el número de documento', () => {
    expect(numeroDocumentoVisible(IDENTIFICADA, '1101321226')).toBe('1101321226');
  });

  it('reservada: devuelve el marcador, nunca el número real (vector de exportación)', () => {
    expect(numeroDocumentoVisible(RESERVADA, '1101321226')).toBe(MARCADOR_DOCUMENTO_PROTEGIDO);
  });

  it('anónima: devuelve el marcador', () => {
    expect(numeroDocumentoVisible(ANONIMA, '1101321226')).toBe(MARCADOR_DOCUMENTO_PROTEGIDO);
  });
});
