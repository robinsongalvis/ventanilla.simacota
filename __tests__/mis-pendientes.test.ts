import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { misPendientes } from '@/lib/mi-gestion/mis-pendientes';

/* ══════════════════════════════════════════════════════════════
   Sprint Cola personal — la lista completa de trabajo del funcionario.

   Referencia fija: jueves 2 jul 2026 15:00 UTC → 10:00 Colombia.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');
const UID = 'uid-oscar';

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
      oficinaDestino: 'SEC_HACIENDA', zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: UID,
    },
    detalle: { asunto: 'Solicitud de paz y salvo', descripcion: 'Descripción', numeroFolios: 1 },
    archivos: [],
    ...overrides,
  };
}

function conVencimiento(iso: string) {
  return radicado({ termino: { ...radicado().termino, fechaVencimiento: iso } });
}

describe('Cola personal — misPendientes', () => {
  /* 1 · solo lo mío y solo lo activo */
  it('excluye radicados de otros y los ya resueltos', () => {
    const deOtro = radicado({
      clasificacion: { oficinaDestino: 'SEC_HACIENDA', zonaGeografica: 'CASCO_URBANO', funcionarioResponsableUid: 'uid-otra' },
    });
    const resuelto = radicado({ estadoActual: 'RESUELTO' });
    const mio = radicado();
    const cola = misPendientes([deOtro, resuelto, mio], UID, AHORA);
    expect(cola.map((p) => p.radicadoId)).toEqual([mio.radicadoId]);
  });

  /* 2 · orden por urgencia: vencido → vence hoy → holgado */
  it('ordena vencidos primero y luego por días restantes', () => {
    const holgado = conVencimiento('2026-07-20T09:00:00.000Z');
    const vencido = conVencimiento('2026-06-26T09:00:00.000Z');
    const venceHoy = conVencimiento('2026-07-02T20:00:00.000Z');
    const cola = misPendientes([holgado, vencido, venceHoy], UID, AHORA);
    expect(cola.map((p) => p.radicadoId))
      .toEqual([vencido.radicadoId, venceHoy.radicadoId, holgado.radicadoId]);
  });

  /* 3 · etiquetas y niveles por fila */
  it('arma etiqueta y nivel según el término', () => {
    const vencido = conVencimiento('2026-06-26T09:00:00.000Z');
    const holgado = conVencimiento('2026-07-20T09:00:00.000Z');
    const cola = misPendientes([vencido, holgado], UID, AHORA);
    expect(cola[0].etiqueta).toMatch(/venció hace/);
    expect(cola[0].nivel).toBe('ROJO');
    expect(cola[1].etiqueta).toMatch(/vence en \d+ días/);
    expect(cola[1].nivel).toBe('VERDE');
  });

  /* 4 · sin término van al final, el más viejo primero */
  it('deja los sin término al final ordenados por fecha de radicación', () => {
    const conPlazo = conVencimiento('2026-07-03T09:00:00.000Z');
    const sinTerminoViejo = radicado({
      termino: { ...radicado().termino, fechaVencimiento: '' },
      control: { ...radicado().control, fechaRadicado: '2026-06-01T14:00:00.000Z' },
    });
    const sinTerminoNuevo = radicado({
      termino: { ...radicado().termino, fechaVencimiento: '' },
      control: { ...radicado().control, fechaRadicado: '2026-06-20T14:00:00.000Z' },
    });
    const cola = misPendientes([sinTerminoNuevo, conPlazo, sinTerminoViejo], UID, AHORA);
    expect(cola.map((p) => p.radicadoId)).toEqual([
      conPlazo.radicadoId, sinTerminoViejo.radicadoId, sinTerminoNuevo.radicadoId,
    ]);
    expect(cola[1].nivel).toBe('SIN_TERMINO');
    expect(cola[1].etiqueta).toBe('sin término');
  });

  /* 5 · la fila no expone datos del solicitante */
  it('la fila lleva solo id, estado, asunto y término', () => {
    const cola = misPendientes([radicado()], UID, AHORA);
    expect(Object.keys(cola[0]).sort()).toEqual(
      ['asunto', 'diasRestantes', 'estado', 'etiqueta', 'nivel', 'radicadoId'],
    );
  });

  /* 6 · sin nada asignado: cola vacía */
  it('devuelve vacío cuando no hay radicados del uid', () => {
    expect(misPendientes([radicado({ clasificacion: { oficinaDestino: 'SEC_HACIENDA', zonaGeografica: 'CASCO_URBANO' } })], UID, AHORA)).toEqual([]);
  });
});
