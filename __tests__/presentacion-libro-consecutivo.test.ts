import { describe, expect, it } from 'vitest';
import {
  añoRadicacionColombia,
  añosDisponiblesLibro,
  calcularConteosKpiLibro,
  calcularConteosPorFiltroLibro,
  coincideFiltroLibro,
  construirFilasLibroConsecutivo,
  esHistoricoIncompletoLibro,
  esSubtipoEnCuarentena,
  filtrarFilasLibro,
  generarCsvLibroConsecutivo,
  nombreArchivoCsvLibroConsecutivo,
  subtiposConEstadoLibro,
  UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO,
  urgenciaFilaLibro,
  type FilaLibroConsecutivo,
} from '@/app/interno/licencias/presentacion-libro-consecutivo';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';
import { formatFechaColombia } from '@/lib/fecha-colombia';

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

  /* ── Campos del rediseño (KPIs/filtros/panel, 10-ago-2026) ── */

  it('subtipoCodigos conserva los códigos crudos, en el mismo orden que subtipos (nombres legibles)', () => {
    const filas = construirFilasLibroConsecutivo([expedienteBase({ subtipos: ['CONSTRUCCION', 'APROBACION_PH'] })], 2026);
    expect(filas[0].subtipoCodigos).toEqual(['CONSTRUCCION', 'APROBACION_PH']);
    expect(filas[0].subtipos).toHaveLength(2);
  });

  it('origen: REAL por defecto (Expediente.origen ausente), respeta RECONSTRUIDO si se declara', () => {
    const [real] = construirFilasLibroConsecutivo([expedienteBase({ origen: undefined })], 2026);
    expect(real.origen).toBe('REAL');
    const [reconstruido] = construirFilasLibroConsecutivo([expedienteBase({ origen: 'RECONSTRUIDO' })], 2026);
    expect(reconstruido.origen).toBe('RECONSTRUIDO');
  });

  it('faltaCedula: true con documento vacío/solo espacios/ausente, false con un documento real', () => {
    expect(construirFilasLibroConsecutivo([expedienteBase({ solicitanteDocumento: '' })], 2026)[0].faltaCedula).toBe(true);
    expect(construirFilasLibroConsecutivo([expedienteBase({ solicitanteDocumento: '   ' })], 2026)[0].faltaCedula).toBe(true);
    expect(construirFilasLibroConsecutivo([expedienteBase({ solicitanteDocumento: '91234567' })], 2026)[0].faltaCedula).toBe(false);
  });

  it('faltaEstadoJuridico: true si el valor no es uno de los 9 estados conocidos (dato legado/corrupto, defensivo)', () => {
    const [ok] = construirFilasLibroConsecutivo([expedienteBase({ estadoJuridico: 'EN_REVISION' })], 2026);
    expect(ok.faltaEstadoJuridico).toBe(false);
    const [malo] = construirFilasLibroConsecutivo(
      [expedienteBase({ estadoJuridico: 'NO_EXISTE' as unknown as ExpedienteLicenciaDoc['estadoJuridico'] })],
      2026,
    );
    expect(malo.faltaEstadoJuridico).toBe(true);
  });

  it('fechaAlertaConservadora: null si el documento no la trae (campo opcional, no denormalizado todavía) — nunca se inventa', () => {
    const [fila] = construirFilasLibroConsecutivo([expedienteBase()], 2026);
    expect(fila.fechaAlertaConservadora).toBeNull();
  });

  it('fechaAlertaConservadora: se lee tal cual si el documento la trae (denormalización futura del backend)', () => {
    const exp = { ...expedienteBase(), fechaAlertaConservadora: '2026-05-01T12:00:00-05:00' } as unknown as ExpedienteLicenciaDoc;
    const [fila] = construirFilasLibroConsecutivo([exp], 2026);
    expect(fila.fechaAlertaConservadora).toBe('2026-05-01T12:00:00-05:00');
  });

  describe('vigenciaHasta', () => {
    it('null sin actoFinal.fechaFirmeza — la vigencia no corre todavía, no se promete un plazo', () => {
      const [fila] = construirFilasLibroConsecutivo([expedienteBase({ actoFinal: undefined })], 2026);
      expect(fila.vigenciaHasta).toBeNull();
      expect(fila.vigenciaHastaError).toBeUndefined();
    });

    it('usa actoFinal.vigenciaHasta YA PERSISTIDO tal cual, sin recalcular — es el dato más autorizado', () => {
      const [fila] = construirFilasLibroConsecutivo(
        [
          expedienteBase({
            subtipos: ['SUBDIVISION_RURAL'],
            actoFinal: { numero: '002-2026', fechaFirmeza: '2026-04-20T15:00:00.000Z', vigenciaHasta: '2099-01-01T00:00:00.000Z' },
          }),
        ],
        2026,
      );
      expect(fila.vigenciaHasta).toBe('2099-01-01T00:00:00.000Z');
    });

    it('sin vigenciaHasta persistido, la calcula con la MISMA función pura que usa el servidor del Detalle (calcularVencimientoVigencia)', () => {
      const [fila] = construirFilasLibroConsecutivo(
        [expedienteBase({ subtipos: ['SUBDIVISION_RURAL'], actoFinal: { numero: '002-2026', fechaFirmeza: '2026-04-20T15:00:00.000Z' } })],
        2026,
      );
      // 12 meses improrrogables desde la firmeza (Código Civil art. 67).
      //
      // Se asevera el DÍA CIVIL en Colombia, NO el instante ISO exacto: la
      // vigencia es un día del calendario, y `sumarMesCalendario` ancla al
      // mediodía del runtime (mediodía Bogotá en local = 17:00Z; mediodía
      // UTC en CI = 12:00Z). Ambos instantes son el MISMO día civil en
      // Bogotá — que es lo único que el usuario ve y lo único que la norma
      // define. Comparar el ISO crudo haría que el test pasara en Colombia
      // y fallara en CI (ocurrió: PR #180) sin que nada estuviera roto.
      expect(fila.vigenciaHasta).not.toBeNull();
      expect(formatFechaColombia(fila.vigenciaHasta!)).toBe(formatFechaColombia('2027-04-20T17:00:00.000Z'));
    });

    it('cierreDesconocido (migración sin detalle confiable): no calcula, aunque fechaFirmeza esté presente', () => {
      const [fila] = construirFilasLibroConsecutivo(
        [
          expedienteBase({
            origen: 'RECONSTRUIDO',
            subtipos: ['SUBDIVISION_RURAL'],
            actoFinal: { fechaFirmeza: '2026-04-20T15:00:00.000Z', cierreDesconocido: true },
          }),
        ],
        2026,
      );
      expect(fila.vigenciaHasta).toBeNull();
    });

    it('régimen no resoluble (p. ej. CONSTRUCCION sin modalidad — dato que ningún expediente captura hoy): null + motivo técnico para tooltip, nunca inventa una fecha', () => {
      const [fila] = construirFilasLibroConsecutivo(
        [expedienteBase({ subtipos: ['CONSTRUCCION'], actoFinal: { numero: '002-2026', fechaFirmeza: '2026-04-20T15:00:00.000Z' } })],
        2026,
      );
      expect(fila.vigenciaHasta).toBeNull();
      expect(fila.vigenciaHastaError).toBeTruthy();
    });
  });
});

describe('esSubtipoEnCuarentena / subtiposConEstadoLibro', () => {
  it('un código mapeado (p. ej. CONSTRUCCION) no está en cuarentena', () => {
    expect(esSubtipoEnCuarentena('CONSTRUCCION')).toBe(false);
  });

  it('un texto histórico en CUARENTENA (LCR VISR, LRC) se detecta — insensible a mayúsculas/espacios (normalizarTextoHistorico)', () => {
    expect(esSubtipoEnCuarentena('LCR VISR')).toBe(true);
    expect(esSubtipoEnCuarentena('lcr   visr')).toBe(true);
    expect(esSubtipoEnCuarentena('LRC')).toBe(true);
  });

  it('subtiposConEstadoLibro resuelve nombre + bandera de cuarentena por código, en orden', () => {
    const resultado = subtiposConEstadoLibro(['CONSTRUCCION', 'LCR VISR']);
    expect(resultado).toEqual([
      { codigo: 'CONSTRUCCION', nombre: 'Licencia de construcción', enCuarentena: false },
      { codigo: 'LCR VISR', nombre: 'LCR VISR', enCuarentena: true },
    ]);
  });
});

describe('urgenciaFilaLibro', () => {
  // Ancla FIJA arbitraria (no `new Date()`): las pruebas de banda de
  // urgencia son las únicas de este archivo cuyo resultado depende de
  // "hoy" — en vez de fake timers (se cuelgan con este runner, ver
  // `libro-consecutivo-render.test.tsx`), se le pasa `hoy` explícito a la
  // función pura y las fechas límite se DERIVAN con `sumarDiasHabiles`
  // (misma utilidad que usa el código bajo prueba), nunca a mano.
  const HOY = new Date('2026-03-10T12:00:00-05:00');

  it('NEUTRO sin fechaAlertaConservadora', () => {
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: null }, HOY)).toBe('NEUTRO');
  });

  it('VENCIDO si la fecha ya pasó', () => {
    const pasada = new Date(HOY.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: pasada }, HOY)).toBe('VENCIDO');
  });

  it(`POR_VENCER si faltan exactamente ${UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO} días hábiles (el umbral incluye el límite)`, () => {
    const fecha = sumarDiasHabiles(HOY, UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO).toISOString();
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: fecha }, HOY)).toBe('POR_VENCER');
  });

  it('EN_TERMINO si faltan más días hábiles que el umbral', () => {
    const fecha = sumarDiasHabiles(HOY, UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO + 1).toISOString();
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: fecha }, HOY)).toBe('EN_TERMINO');
  });
});

describe('esHistoricoIncompletoLibro', () => {
  it('true solo si origen RECONSTRUIDO Y falta cédula o estado', () => {
    expect(esHistoricoIncompletoLibro({ origen: 'RECONSTRUIDO', faltaCedula: true, faltaEstadoJuridico: false })).toBe(true);
    expect(esHistoricoIncompletoLibro({ origen: 'RECONSTRUIDO', faltaCedula: false, faltaEstadoJuridico: true })).toBe(true);
  });

  it('false si es REAL, aunque le falte un dato (se marca la fila igual, pero no cuenta como "histórico")', () => {
    expect(esHistoricoIncompletoLibro({ origen: 'REAL', faltaCedula: true, faltaEstadoJuridico: true })).toBe(false);
  });

  it('false si es RECONSTRUIDO pero no le falta nada', () => {
    expect(esHistoricoIncompletoLibro({ origen: 'RECONSTRUIDO', faltaCedula: false, faltaEstadoJuridico: false })).toBe(false);
  });
});

describe('coincideFiltroLibro / filtrarFilasLibro / conteos', () => {
  const HOY = new Date('2026-03-10T12:00:00-05:00');

  function filaBase(overrides: Partial<FilaLibroConsecutivo> = {}): FilaLibroConsecutivo {
    return {
      id: 'f1',
      numeroExpediente: '68745-0-26-0001',
      fechaRadicacion: '2026-03-10T15:00:00.000Z',
      solicitanteNombre: 'Carlos Alberto Rojas',
      solicitanteDocumento: '91234567',
      subtipos: ['Licencia de construcción'],
      subtipoCodigos: ['CONSTRUCCION'],
      estadoJuridico: 'EN_REVISION',
      numeroLicencia: null,
      fechaFirmeza: null,
      esPrueba: false,
      origen: 'REAL',
      fechaAlertaConservadora: null,
      vigenciaHasta: null,
      faltaCedula: false,
      faltaEstadoJuridico: false,
      ...overrides,
    };
  }

  const enTramite = filaBase({ id: 'a', estadoJuridico: 'EN_REVISION' });
  const resuelto = filaBase({ id: 'b', estadoJuridico: 'EN_FIRME' });
  const vencido = filaBase({
    id: 'c',
    estadoJuridico: 'EN_VIABILIDAD',
    fechaAlertaConservadora: new Date(HOY.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const historicoIncompleto = filaBase({ id: 'd', origen: 'RECONSTRUIDO', estadoJuridico: 'EN_FIRME', faltaCedula: true });
  const filas = [enTramite, resuelto, vencido, historicoIncompleto];

  it('TODOS coincide con cualquier fila', () => {
    expect(filas.every((f) => coincideFiltroLibro(f, 'TODOS', HOY))).toBe(true);
  });

  it('EN_TRAMITE: RADICADA_EN_DEBIDA_FORMA/EN_REVISION/CON_ACTA_DE_OBSERVACIONES/EN_VIABILIDAD', () => {
    expect(filtrarFilasLibro(filas, 'EN_TRAMITE', HOY).map((f) => f.id)).toEqual(['a', 'c']); // c está EN_VIABILIDAD (en trámite) Y vencido — ambos criterios son independientes
  });

  it('VENCIDOS: solo filas con fechaAlertaConservadora en el pasado', () => {
    expect(filtrarFilasLibro(filas, 'VENCIDOS', HOY).map((f) => f.id)).toEqual(['c']);
  });

  it('POR_VENCER: ninguna de estas filas cae en la banda ámbar (ni "vencido" ni "sin fecha" cuentan)', () => {
    expect(filtrarFilasLibro(filas, 'POR_VENCER', HOY)).toEqual([]);
  });

  it('HISTORICOS_INCOMPLETOS: solo RECONSTRUIDO con dato faltante', () => {
    expect(filtrarFilasLibro(filas, 'HISTORICOS_INCOMPLETOS', HOY).map((f) => f.id)).toEqual(['d']);
  });

  it('calcularConteosPorFiltroLibro: un conteo por cada filtro, coherente con filtrarFilasLibro', () => {
    const conteos = calcularConteosPorFiltroLibro(filas, HOY);
    expect(conteos).toEqual({ TODOS: 4, EN_TRAMITE: 2, POR_VENCER: 0, VENCIDOS: 1, HISTORICOS_INCOMPLETOS: 1 });
  });

  it('calcularConteosKpiLibro: las 4 cifras de la fila de KPIs, mismo criterio que los chips', () => {
    expect(calcularConteosKpiLibro(filas, HOY)).toEqual({ total: 4, enTramite: 2, porVencer: 0, historicosIncompletos: 1 });
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
      // Campos del rediseño (KPIs/filtros/panel) — el generador de CSV NO
      // los lee (solo `subtipos`, no `subtipoCodigos`); se incluyen aquí
      // únicamente para satisfacer el tipo `FilaLibroConsecutivo`.
      subtipoCodigos: ['CONSTRUCCION'],
      estadoJuridico: 'EN_REVISION',
      numeroLicencia: null,
      fechaFirmeza: null,
      esPrueba: false,
      origen: 'REAL',
      fechaAlertaConservadora: null,
      vigenciaHasta: null,
      faltaCedula: false,
      faltaEstadoJuridico: false,
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
