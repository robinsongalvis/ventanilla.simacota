import { describe, expect, it } from 'vitest';
import {
  añoRadicacionColombia,
  añosDisponiblesLibro,
  construirFilasLibroConsecutivo,
  generarCsvLibroConsecutivo,
  nombreArchivoCsvLibroConsecutivo,
  type FilaLibroConsecutivo,
} from '@/app/interno/licencias/presentacion-libro-consecutivo';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

/* ══════════════════════════════════════════════════════════════
   Bloque C — Libro consecutivo. Pruebas de las funciones PURAS que
   alimentan `LibroConsecutivoClient`: derivar años, filtrar/ordenar filas
   y generar el CSV que reemplaza el Excel de Planeación. Sin fetch, sin
   React — datos sintéticos, comparables 1:1 con lo documentado en
   `docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`.
══════════════════════════════════════════════════════════════ */

function expedienteBase(overrides: Partial<ExpedienteLicenciaDoc> = {}): ExpedienteLicenciaDoc {
  return {
    id: 'exp-1',
    tenantId: 'SEC_PLANEACION',
    tramiteId: 'LICENCIA_CONSTRUCCION_PARCIAL',
    estado: 'RADICADO',
    solicitanteNombre: 'Carlos Alberto Rojas',
    solicitanteDocumento: '91234567',
    contexto: {},
    aportes: [],
    radicadoId: null,
    creadoEn: '2026-03-10T15:00:00.000Z',
    actualizadoEn: '2026-03-10T15:00:00.000Z',
    numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 },
    subtipos: ['CONSTRUCCION'],
    origen: 'REAL',
    estadoJuridico: 'EN_REVISION',
    esPrueba: false,
    ...overrides,
  };
}

describe('añoRadicacionColombia', () => {
  it('deriva el año en horario Colombia a partir de un ISO válido', () => {
    expect(añoRadicacionColombia('2026-03-10T15:00:00.000Z')).toBe(2026);
  });

  it('un ISO cercano a medianoche UTC que en Bogotá aún es el día/año anterior se ancla al año Colombia, no al UTC', () => {
    // 1-ene-2026 02:00 UTC = 31-dic-2025 21:00 hora Colombia (UTC-5).
    expect(añoRadicacionColombia('2026-01-01T02:00:00.000Z')).toBe(2025);
  });

  it('devuelve null para una fecha inválida', () => {
    expect(añoRadicacionColombia('no-es-fecha')).toBeNull();
  });
});

describe('añosDisponiblesLibro', () => {
  it('incluye el año en curso aunque no haya expedientes ese año', () => {
    expect(añosDisponiblesLibro([], 2026)).toEqual([2026]);
  });

  it('incluye los años distintos de los expedientes, orden descendente, sin duplicar el año en curso', () => {
    const expedientes = [
      expedienteBase({ id: 'a', creadoEn: '2024-05-01T10:00:00.000Z' }),
      expedienteBase({ id: 'b', creadoEn: '2025-06-01T10:00:00.000Z' }),
      expedienteBase({ id: 'c', creadoEn: '2026-01-01T10:00:00.000Z' }),
    ];
    expect(añosDisponiblesLibro(expedientes, 2026)).toEqual([2026, 2025, 2024]);
  });
});

describe('construirFilasLibroConsecutivo', () => {
  it('filtra por año y ordena ASCENDENTE por número de expediente (orden de libro)', () => {
    const expedientes = [
      expedienteBase({ id: 'exp-3', numeroExpediente: { numero: '68745-0-26-0003', serieId: 'demo', año: 2026 } }),
      expedienteBase({ id: 'exp-1', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 } }),
      expedienteBase({ id: 'exp-otro-año', creadoEn: '2025-03-10T15:00:00.000Z', numeroExpediente: { numero: '68745-0-25-0050', serieId: 'demo', año: 2025 } }),
    ];

    const filas = construirFilasLibroConsecutivo(expedientes, 2026);

    expect(filas.map((f) => f.numeroExpediente)).toEqual(['68745-0-26-0001', '68745-0-26-0003']);
  });

  it('mapea actoFinal ausente a numeroLicencia/fechaFirmeza null (honesto, nunca inventado)', () => {
    const filas = construirFilasLibroConsecutivo([expedienteBase({ actoFinal: undefined })], 2026);
    expect(filas[0].numeroLicencia).toBeNull();
    expect(filas[0].fechaFirmeza).toBeNull();
  });

  it('mapea actoFinal presente a sus valores reales', () => {
    const filas = construirFilasLibroConsecutivo(
      [expedienteBase({ actoFinal: { numero: '002-2026', fecha: '2026-04-01T00:00:00.000Z', fechaFirmeza: '2026-04-20T00:00:00.000Z' } })],
      2026,
    );
    expect(filas[0].numeroLicencia).toBe('002-2026');
    expect(filas[0].fechaFirmeza).toBe('2026-04-20T00:00:00.000Z');
  });

  it('traduce subtipos a nombres legibles y respeta esPrueba', () => {
    const filas = construirFilasLibroConsecutivo([expedienteBase({ esPrueba: true })], 2026);
    expect(filas[0].esPrueba).toBe(true);
    expect(filas[0].subtipos.length).toBeGreaterThan(0);
  });

  it('usa el id del documento como número de expediente cuando numeroExpediente está ausente', () => {
    const filas = construirFilasLibroConsecutivo([expedienteBase({ id: 'exp-sin-numero', numeroExpediente: undefined })], 2026);
    expect(filas[0].numeroExpediente).toBe('exp-sin-numero');
  });
});

describe('nombreArchivoCsvLibroConsecutivo', () => {
  it('arma el nombre de archivo con el año', () => {
    expect(nombreArchivoCsvLibroConsecutivo(2026)).toBe('libro-consecutivo-licencias-2026.csv');
  });
});

describe('generarCsvLibroConsecutivo', () => {
  function filaSintetica(overrides: Partial<FilaLibroConsecutivo> = {}): FilaLibroConsecutivo {
    return {
      id: 'exp-1',
      numeroExpediente: '68745-0-26-0001',
      fechaRadicacion: '2026-03-10T15:00:00.000Z',
      solicitanteNombre: 'Carlos Alberto Rojas',
      solicitanteDocumento: '91234567',
      subtipos: ['Licencia de construcción'],
      estadoJuridico: 'EN_REVISION',
      numeroLicencia: null,
      fechaFirmeza: null,
      esPrueba: false,
      ...overrides,
    };
  }

  it('empieza con BOM UTF-8', () => {
    const csv = generarCsvLibroConsecutivo([filaSintetica()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('la cabecera tiene las columnas del libro, separadas por ";"', () => {
    const csv = generarCsvLibroConsecutivo([]);
    const [encabezado] = csv.replace(/^﻿/, '').split('\r\n');
    expect(encabezado).toBe(
      'N. EXPEDIENTE;FECHA RADICACION;SOLICITANTE;DOCUMENTO;SUBTIPOS;ESTADO JURIDICO;N. LICENCIA;FECHA FIRMEZA;PRUEBA',
    );
  });

  it('una fila con acto final ausente muestra "—" en N. LICENCIA y FECHA FIRMEZA, y "NO" en PRUEBA', () => {
    const csv = generarCsvLibroConsecutivo([filaSintetica()]);
    const [, filaTexto] = csv.replace(/^﻿/, '').split('\r\n');
    expect(filaTexto).toBe('68745-0-26-0001;10/03/2026;Carlos Alberto Rojas;91234567;Licencia de construcción;En revisión;—;—;NO');
  });

  it('una fila con acto final y esPrueba=true muestra los valores reales y "SI"', () => {
    const csv = generarCsvLibroConsecutivo([
      filaSintetica({ numeroLicencia: '002-2026', fechaFirmeza: '2026-04-20T15:00:00.000Z', esPrueba: true }),
    ]);
    const [, filaTexto] = csv.replace(/^﻿/, '').split('\r\n');
    expect(filaTexto).toContain('002-2026;20/04/2026;SI');
  });

  it('escapa un campo que contiene el separador ";" entre comillas', () => {
    const csv = generarCsvLibroConsecutivo([filaSintetica({ subtipos: ['LC; construcción'] })]);
    expect(csv).toContain('"LC; construcción"');
  });

  it('múltiples filas se separan con CRLF', () => {
    const csv = generarCsvLibroConsecutivo([filaSintetica({ id: 'a' }), filaSintetica({ id: 'b', numeroExpediente: '68745-0-26-0002' })]);
    const lineas = csv.replace(/^﻿/, '').split('\r\n');
    expect(lineas).toHaveLength(3); // encabezado + 2 filas
  });
});
