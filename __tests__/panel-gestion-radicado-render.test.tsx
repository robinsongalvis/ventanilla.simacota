/**
 * H2 (ADR-0006) — revisión cruzada del coordinador encontró que
 * `PanelGestionRadicado.tsx` mostraba `radicado.solicitante.nombreCompleto`
 * en la pestaña "Informacion general" sin ninguna guarda de identidad
 * reservada.
 *
 * Verificado: el componente NO está importado en ningún otro archivo del
 * repo (`grep -rl PanelGestionRadicado app __tests__` solo devuelve su
 * propia definición) — es código muerto, sin ruta de render viva hoy. Se
 * enmascara igual (barato y correcto — puede volver a montarse en
 * cualquier momento) y se cubre con este test de render.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { PanelGestionRadicado } from '@/app/interno/dashboard/components/pqrs/PanelGestionRadicado';

function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-WEB-2026-00000077',
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: '2026-06-01T10:00:00.000Z',
    prioridad:            'AMARILLO',
    esAnonimo:            false,
    tipoPresentacion:     'IDENTIFICADA',
    identidadReservada:   false,
    canalRespuesta:       'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1101321226',
      nombreCompleto:  'Luisa Ramírez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     '1-WEB-2026-00000077',
      consecutivo:    77,
      fechaRadicado:  '2026-06-01T10:00:00.000Z',
      horaRadicado:   '10:00',
      medioRecepcion: 'WEB',
      origen:         'WEB',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    '2026-06-22T17:00:00.000Z',
      prorrogasAplicadas:  0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO',
      zonaGeografica: 'CASCO_URBANO',
    },
    detalle: {
      asunto:       'Prueba',
      descripcion:  'Descripción',
      numeroFolios: 0,
    },
    archivos: [],
    ...overrides,
  };
}

describe('PanelGestionRadicado — enmascaramiento de identidad reservada (H2)', () => {
  afterEach(() => cleanup());

  it('sin identidad reservada: muestra el nombre real del solicitante', () => {
    render(<PanelGestionRadicado radicado={radicadoBase()} trazabilidad={[]} />);
    expect(screen.getByText('Luisa Ramírez')).toBeTruthy();
  });

  it('identidad reservada: muestra "Identidad protegida" y NUNCA el nombre real', () => {
    const reservado = radicadoBase({ identidadReservada: true });
    render(<PanelGestionRadicado radicado={reservado} trazabilidad={[]} />);
    expect(screen.getByText('Identidad protegida')).toBeTruthy();
    expect(screen.queryByText('Luisa Ramírez')).toBeNull();
  });

  it('anónimo: muestra "Identidad protegida"', () => {
    const anonimo = radicadoBase({ esAnonimo: true, tipoPresentacion: 'ANONIMA' });
    render(<PanelGestionRadicado radicado={anonimo} trazabilidad={[]} />);
    expect(screen.getByText('Identidad protegida')).toBeTruthy();
    expect(screen.queryByText('Luisa Ramírez')).toBeNull();
  });
});
