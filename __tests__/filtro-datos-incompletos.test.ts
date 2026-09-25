import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  filtrarSoloDatosIncompletos,
  tieneDatosNoAportados,
} from '@/lib/busqueda/filtros-radicado';

/* ══════════════════════════════════════════════════════════════
   Sprint 1.5 · PR 3 — filtro "Datos incompletos" en bandeja.

   Tests puros del helper `filtrarSoloDatosIncompletos`. No arrancan
   React ni tocan el store — solo verifican la lógica de selección.
══════════════════════════════════════════════════════════════ */

function radicadoConNoAportados(
  radicadoId: string,
  datos?: { documento?: boolean; correo?: boolean; telefono?: boolean; direccion?: boolean } | null,
): VentanillaRadicado {
  return {
    radicadoId,
    estadoActual: 'PENDIENTE',
    ultimaActualizacion: '2026-06-01T08:00:00.000Z',
    prioridad: 'AMARILLO',
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1098765432',
      nombreCompleto: 'Ciudadano',
      email: 'ciudadano@ejemplo.com',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
      ...(datos !== null ? { datosNoAportados: datos } : {}),
    },
    control: {
      radicadoId,
      consecutivo: 1,
      fechaRadicado: '2026-06-01T08:00:00.000Z',
      horaRadicado: '08:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: '2026-06-20T08:00:00.000Z',
      prorrogasAplicadas: 0,
    },
    clasificacion: { oficinaDestino: 'VENTANILLA_UNICA', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Solicitud', descripcion: 'Desc', numeroFolios: 1 },
    archivos: [],
  };
}

describe('Sprint 1.5 — filtrarSoloDatosIncompletos', () => {
  /* 1 */
  it('devuelve arreglo vacío si la lista es vacía', () => {
    expect(filtrarSoloDatosIncompletos([])).toEqual([]);
  });

  /* 2 */
  it('devuelve solo radicados con al menos una casilla en true', () => {
    const dataset = [
      radicadoConNoAportados('1-WEB-2026-00000001', { correo: true }),
      radicadoConNoAportados('1-WEB-2026-00000002', { documento: false, correo: false, telefono: false, direccion: false }),
      radicadoConNoAportados('1-WEB-2026-00000003', { documento: true, telefono: true }),
      radicadoConNoAportados('1-WEB-2026-00000004', { direccion: true }),
    ];
    const filtrados = filtrarSoloDatosIncompletos(dataset);
    expect(filtrados.map((r) => r.radicadoId)).toEqual([
      '1-WEB-2026-00000001',
      '1-WEB-2026-00000003',
      '1-WEB-2026-00000004',
    ]);
  });

  /* 3 — Compatibilidad histórica: radicados nacidos antes del Sprint 1
     no tienen `datosNoAportados`. Deben quedar EXCLUIDOS del filtro
     (no ensuciar la bandeja con radicados que nunca pasaron por el
     nuevo flujo). */
  it('excluye radicados históricos sin campo datosNoAportados', () => {
    const dataset = [
      radicadoConNoAportados('1-WEB-2024-00000010', null), // sin campo
      radicadoConNoAportados('1-WEB-2026-00000011', { correo: true }),
    ];
    const filtrados = filtrarSoloDatosIncompletos(dataset);
    expect(filtrados.map((r) => r.radicadoId)).toEqual(['1-WEB-2026-00000011']);
  });

  /* 4 — Consistencia con el helper unitario. */
  it('un radicado incluido siempre pasa tieneDatosNoAportados', () => {
    const dataset = [
      radicadoConNoAportados('1-WEB-2026-00000020', { telefono: true }),
      radicadoConNoAportados('1-WEB-2026-00000021', {}),
    ];
    const filtrados = filtrarSoloDatosIncompletos(dataset);
    for (const r of filtrados) {
      expect(tieneDatosNoAportados(r.solicitante.datosNoAportados)).toBe(true);
    }
  });
});
