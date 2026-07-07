import { describe, expect, it } from 'vitest';
import { resumirCambio, type EntradaCambio } from '@/lib/traslado/resumir-cambio';

/* ══════════════════════════════════════════════════════════════
   Sprint Traslado claro — el formulario entiende la intención.
══════════════════════════════════════════════════════════════ */

function entrada(overrides: Partial<EntradaCambio> = {}): EntradaCambio {
  return {
    dependenciaActual: 'SEC_GOBIERNO',
    dependenciaNueva:  'SEC_GOBIERNO',
    responsableActual: 'Camila Quintero',
    responsableNuevo:  null,
    responsableCambia: false,
    areaNueva:  null,
    areaCambia: false,
    ...overrides,
  };
}

describe('Traslado claro — resumirCambio', () => {
  /* 1 · dependencia distinta = traslado, con advertencia ámbar */
  it('detecta el traslado y anuncia sus consecuencias', () => {
    const r = resumirCambio(entrada({ dependenciaNueva: 'SEC_PLANEACION' }));
    expect(r.intencion).toBe('TRASLADO');
    expect(r.tono).toBe('AMBAR');
    expect(r.botonLabel).toBe('Trasladar a Secretaría de Planeación');
    expect(r.consecuencias[0]).toContain('sale de Secretaría de Gobierno');
    expect(r.consecuencias).toContainEqual(
      'Camila Quintero deja de ser responsable; Secretaría de Planeación asignará a su persona',
    );
    expect(r.consecuencias.at(-1)).toContain('Se avisa al ciudadano');
  });

  /* 2 · traslado sin responsable actual: la nueva dependencia asigna */
  it('un traslado de caso sin persona dice que el destino asignará', () => {
    const r = resumirCambio(entrada({
      dependenciaNueva: 'SEC_HACIENDA', responsableActual: null,
    }));
    expect(r.consecuencias).toContainEqual('Secretaría de Hacienda asignará a su persona al recibirlo');
  });

  /* 3 · misma dependencia + persona nueva = asignación verde */
  it('detecta la asignación y nombra a la persona en el botón', () => {
    const r = resumirCambio(entrada({
      responsableNuevo: 'Oscar Vargas', responsableCambia: true,
    }));
    expect(r.intencion).toBe('ASIGNACION');
    expect(r.tono).toBe('VERDE');
    expect(r.botonLabel).toBe('Asignar a Oscar Vargas');
    expect(r.consecuencias).toContainEqual('Le aparecerá en su Mi gestión con su término');
  });

  /* 4 · solo área */
  it('un cambio de área solo, lo dice sin dramatizar', () => {
    const r = resumirCambio(entrada({ areaNueva: 'Almacén y Archivo', areaCambia: true }));
    expect(r.intencion).toBe('AREA');
    expect(r.botonLabel).toBe('Guardar área: Almacén y Archivo');
  });

  /* 5 · nada cambió: botón apagado y honesto */
  it('sin cambios apaga el botón', () => {
    const r = resumirCambio(entrada());
    expect(r.intencion).toBe('SIN_CAMBIOS');
    expect(r.puedeConfirmar).toBe(false);
    expect(r.botonLabel).toBe('Sin cambios por aplicar');
    expect(r.tituloCaja).toBeNull();
  });

  /* 6 · el traslado manda sobre todo lo demás */
  it('si cambió la dependencia, es traslado aunque también haya persona y área', () => {
    const r = resumirCambio(entrada({
      dependenciaNueva: 'SEC_PLANEACION',
      responsableNuevo: 'Pedro Pérez',
      responsableCambia: true,
      areaNueva: 'Sistemas',
      areaCambia: true,
    }));
    expect(r.intencion).toBe('TRASLADO');
    expect(r.consecuencias).toContainEqual('Pedro Pérez queda como responsable en Secretaría de Planeación');
    expect(r.consecuencias).toContainEqual('Lo trabajará el área Sistemas');
  });

  /* 7 · reelegir a la misma persona no es un cambio */
  it('elegir al responsable que ya está no enciende el botón', () => {
    const r = resumirCambio(entrada({
      responsableNuevo: 'Camila Quintero', responsableCambia: false,
    }));
    expect(r.intencion).toBe('SIN_CAMBIOS');
  });
});
