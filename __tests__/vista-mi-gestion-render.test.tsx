import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { VistaMiGestion } from '@/app/interno/dashboard/components/mi-gestion/VistaMiGestion';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Sprint Mi gestión — render fiel al boceto aprobado.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');
const USUARIO = { uid: 'uid-carlos', nombre: 'Carlos Méndez', tenantId: 'SEC_PLANEACION' as const };

let n = 0;
function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  n += 1;
  const id = `1-WEB-2026-${String(n).padStart(8, '0')}`;
  return {
    radicadoId: id,
    estadoActual: 'ASIGNADO',
    ultimaActualizacion: AHORA.toISOString(),
    prioridad: 'AMARILLO',
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '1',
      nombreCompleto: 'Juan Pérez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: id, consecutivo: n, fechaRadicado: '2026-06-25T14:00:00.000Z',
      horaRadicado: '09:00', medioRecepcion: 'PRESENCIAL', origen: 'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición general',
      diasRespuesta: 15, unidad: 'HABILES',
      fechaVencimiento: '2026-07-20T09:00:00.000Z', prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: 'uid-carlos',
    },
    detalle: { asunto: 'Solicitud', descripcion: 'Descripción', numeroFolios: 1 },
    archivos: [],
    ...overrides,
  };
}

describe('Mi gestión — VistaMiGestion', () => {
  /* 1 · el header del boceto: nombre, dependencia y chip del semáforo */
  it('muestra el header con nombre, dependencia y chip "Al día"', () => {
    render(<VistaMiGestion radicados={[radicado()]} usuario={USUARIO} onAbrirRadicado={vi.fn()} ahora={AHORA} />);
    expect(screen.getByText(/Mi gestión · desempeño personal/i)).toBeTruthy();
    expect(screen.getByText(/Carlos Méndez · Secretaría de Planeación/)).toBeTruthy();
    expect(screen.getByText('Al día')).toBeTruthy();
  });

  /* 2 · las 5 tarjetas del boceto */
  it('muestra las cinco tarjetas de indicadores', () => {
    render(<VistaMiGestion radicados={[radicado()]} usuario={USUARIO} onAbrirRadicado={vi.fn()} ahora={AHORA} />);
    for (const label of ['Asignados', 'Respondidos', 'Pendientes', 'Tiempo promedio (días)', 'Por vencer']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  /* 3 · un vencido pinta el chip "Atrasado" y aparece en Atiende primero */
  it('con un vencido: chip Atrasado y fila clicable con su etiqueta', () => {
    const onAbrir = vi.fn();
    const vencido = radicado({
      termino: { ...radicado().termino, fechaVencimiento: '2026-06-26T09:00:00.000Z' },
    });
    render(<VistaMiGestion radicados={[vencido]} usuario={USUARIO} onAbrirRadicado={onAbrir} ahora={AHORA} />);
    expect(screen.getByText('Atrasado')).toBeTruthy();
    // La etiqueta sale en "Atiende primero" y en la cola de Mis pendientes.
    expect(screen.getAllByText(/venció hace/i).length).toBeGreaterThanOrEqual(1);
    const filas = screen.getAllByRole('button', { name: new RegExp(`Abrir radicado ${vencido.radicadoId}`) });
    fireEvent.click(filas[0]);
    expect(onAbrir).toHaveBeenCalledWith(vencido.radicadoId);
  });

  /* 4 · sin cumplimiento aún: la barra explica en vez de inventar */
  it('sin resueltos muestra — y el mensaje de primeros radicados', () => {
    render(<VistaMiGestion radicados={[radicado()]} usuario={USUARIO} onAbrirRadicado={vi.fn()} ahora={AHORA} />);
    // "—" aparece en el % de la barra y en la tarjeta de tiempo promedio.
    expect(screen.getAllByText('—').length).toBe(2);
    expect(screen.getByText(/primeros radicados/i)).toBeTruthy();
  });

  /* 5 · sin urgencias: estado tranquilo */
  it('sin vencimientos cercanos muestra "Sin urgencias"', () => {
    render(<VistaMiGestion radicados={[radicado()]} usuario={USUARIO} onAbrirRadicado={vi.fn()} ahora={AHORA} />);
    expect(screen.getByText(/Sin urgencias/i)).toBeTruthy();
  });

  /* 6 · la tendencia trae las 4 etiquetas del boceto */
  it('muestra la tendencia S-3, S-2, S-1, Esta', () => {
    render(<VistaMiGestion radicados={[radicado()]} usuario={USUARIO} onAbrirRadicado={vi.fn()} ahora={AHORA} />);
    for (const s of ['S-3', 'S-2', 'S-1', 'Esta']) {
      expect(screen.getByText(s)).toBeTruthy();
    }
  });

  /* 7 · Cola personal: la lista completa con asunto, estado y término */
  it('lista Mis pendientes con conteo y fila clicable', () => {
    const onAbrir = vi.fn();
    const holgado = radicado();
    const vencido = radicado({
      termino: { ...radicado().termino, fechaVencimiento: '2026-06-26T09:00:00.000Z' },
      detalle: { asunto: 'Certificado urgente', descripcion: 'D', numeroFolios: 1 },
    });
    render(<VistaMiGestion radicados={[holgado, vencido]} usuario={USUARIO} onAbrirRadicado={onAbrir} ahora={AHORA} />);
    expect(screen.getByText('Mis pendientes')).toBeTruthy();
    expect(screen.getByText('2 radicados')).toBeTruthy();
    expect(screen.getByText('Certificado urgente')).toBeTruthy();
    // El vencido va de primero en la cola.
    const filas = screen.getAllByRole('button', { name: /^Abrir radicado 1-WEB/ });
    expect(filas[0].getAttribute('aria-label')).toContain(vencido.radicadoId);
    fireEvent.click(filas[0]);
    expect(onAbrir).toHaveBeenCalledWith(vencido.radicadoId);
  });

  /* 8 · Cola personal vacía: bandeja limpia */
  it('sin pendientes muestra el estado de bandeja limpia', () => {
    const resuelto = radicado({ estadoActual: 'RESUELTO' });
    render(<VistaMiGestion radicados={[resuelto]} usuario={USUARIO} onAbrirRadicado={vi.fn()} ahora={AHORA} />);
    expect(screen.getByText(/bandeja limpia/i)).toBeTruthy();
  });
});
