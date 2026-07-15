/**
 * H2 (ADR-0006) — revisión cruzada del coordinador encontró que
 * `VistaAlertas.tsx` (Panel de Alertas Predictivas, Fase 2 — Inteligencia
 * Operativa) mostraba `r.solicitante.nombreCompleto` en la tarjeta de
 * alerta sin ninguna guarda de identidad reservada. No es fácilmente
 * accionable en E2E (requiere que `useAnalytics` genere una alerta
 * CRÍTICA real, condicionada a la fecha del sistema en el momento en que
 * corre el auditor funcional contra stage), así que este es el control de
 * regresión: un test de render que fuerza determinísticamente una alerta
 * CRÍTICA (vencida) para un radicado con identidad reservada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { VistaAlertas } from '@/app/interno/dashboard/components/analytics/VistaAlertas';

// `useAnalytics` calcula "vencido"/"días sin movimiento" contra `new Date()`
// en tiempo real (no acepta una fecha inyectable) — se fija el reloj del
// sistema para que el radicado de prueba (radicado hace 5 días, vencido
// hace 3) caiga siempre dentro de la ventana de período (30 días) y
// siempre resulte CRÍTICO, sin importar cuándo corra la suite.
const HOY = new Date('2026-07-11T12:00:00.000Z');

function haceDias(dias: number): string {
  const d = new Date(HOY);
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-WEB-2026-00000099',
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: haceDias(5),
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1101321226',
      nombreCompleto:  'Pedro Gómez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     '1-WEB-2026-00000099',
      consecutivo:    99,
      fechaRadicado:  haceDias(5),
      horaRadicado:   '09:00',
      medioRecepcion: 'WEB',
      origen:         'WEB',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    haceDias(3), // vencido → alerta CRÍTICA
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

describe('VistaAlertas — enmascaramiento de identidad reservada (H2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(HOY);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('sin identidad reservada: la tarjeta de alerta muestra el nombre real', () => {
    render(
      <VistaAlertas
        radicados={[radicadoBase()]}
        esAdmin={true}
        tenantIdUsuario="SEC_GOBIERNO"
        onVerRadicado={() => {}}
      />,
    );
    expect(screen.getByText('Pedro Gómez')).toBeTruthy();
  });

  it('identidad reservada: la tarjeta de alerta muestra "Identidad protegida" y NUNCA el nombre real', () => {
    const reservado = radicadoBase({ identidadReservada: true });
    render(
      <VistaAlertas
        radicados={[reservado]}
        esAdmin={true}
        tenantIdUsuario="SEC_GOBIERNO"
        onVerRadicado={() => {}}
      />,
    );
    expect(screen.getByText('Identidad protegida')).toBeTruthy();
    expect(screen.queryByText('Pedro Gómez')).toBeNull();
  });

  it('anónimo: la tarjeta de alerta muestra "Identidad protegida"', () => {
    const anonimo = radicadoBase({ esAnonimo: true, tipoPresentacion: 'ANONIMA' });
    render(
      <VistaAlertas
        radicados={[anonimo]}
        esAdmin={true}
        tenantIdUsuario="SEC_GOBIERNO"
        onVerRadicado={() => {}}
      />,
    );
    expect(screen.getByText('Identidad protegida')).toBeTruthy();
    expect(screen.queryByText('Pedro Gómez')).toBeNull();
  });
});
