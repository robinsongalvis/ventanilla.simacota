import { describe, expect, it } from 'vitest';
import {
  añoRadicacionColombia,
  añosDisponiblesLibro,
  calcularConteosKpiLibro,
  calcularConteosPorFiltroLibro,
  camposBusquedaDesdeExpediente,
  COLOR_TEXTO_URGENCIA_LIBRO,
  COLOR_URGENCIA_LIBRO,
  coincideBusquedaLibro,
  coincideFiltroLibro,
  construirFilasLibroConsecutivo,
  esHistoricoIncompletoLibro,
  esSubtipoEnCuarentena,
  filtrarFilasLibro,
  generarCsvLibroConsecutivo,
  nombreArchivoCsvLibroConsecutivo,
  subtiposConEstadoLibro,
  textoColisionLibro,
  textoDiasVencimientoLibro,
  UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO,
  urgenciaFilaLibro,
  type CamposBusquedaLibro,
  type FilaLibroConsecutivo,
} from '@/app/interno/licencias/presentacion-libro-consecutivo';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { diasRestantesHabiles, sumarDiasHabiles } from '@/lib/tiempos-radicado';
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
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: null, estadoJuridico: 'EN_REVISION' }, HOY)).toBe('NEUTRO');
  });

  it('VENCIDO si la fecha ya pasó', () => {
    const pasada = new Date(HOY.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: pasada, estadoJuridico: 'EN_REVISION' }, HOY)).toBe('VENCIDO');
  });

  it(`POR_VENCER si faltan exactamente ${UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO} días hábiles (el umbral incluye el límite)`, () => {
    const fecha = sumarDiasHabiles(HOY, UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO).toISOString();
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: fecha, estadoJuridico: 'EN_REVISION' }, HOY)).toBe('POR_VENCER');
  });

  it('EN_TERMINO si faltan más días hábiles que el umbral', () => {
    const fecha = sumarDiasHabiles(HOY, UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO + 1).toISOString();
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: fecha, estadoJuridico: 'EN_REVISION' }, HOY)).toBe('EN_TERMINO');
  });

  // ── REGRESIÓN: vencido SIN días hábiles de por medio ────────────────
  // Defecto encontrado en la verificación visual del 11-ago-2026 (caso
  // REAL, no sintético): el término venció el viernes 7-ago-2026 —
  // festivo de la Batalla de Boyacá — y "hoy" es lunes 10; el 8 y 9 son
  // fin de semana. `diasRestantesHabiles` devuelve 0 (no hay NINGÚN día
  // hábil entre ambas fechas), así que la versión anterior, que decidía
  // por el signo de ese conteo, clasificaba como POR_VENCER un expediente
  // YA VENCIDO: franja ámbar en vez de roja, fuera del filtro y del KPI
  // "Vencidos". Justo lo contrario del propósito protector del módulo.
  describe('vencido sin días hábiles intermedios (festivo + fin de semana)', () => {
    const LUNES_10_AGO = new Date('2026-08-10T12:00:00-05:00');
    const VIERNES_7_AGO_FESTIVO = '2026-08-07T12:00:00-05:00';

    it('el conteo de días hábiles entre ambas fechas es 0 — la premisa del defecto', () => {
      expect(diasRestantesHabiles(VIERNES_7_AGO_FESTIVO, LUNES_10_AGO)).toBe(0);
    });

    it('aun así es VENCIDO: la pregunta "¿ya pasó la fecha?" es de CALENDARIO, no de días hábiles', () => {
      expect(urgenciaFilaLibro({ fechaAlertaConservadora: VIERNES_7_AGO_FESTIVO, estadoJuridico: 'EN_REVISION' }, LUNES_10_AGO)).toBe('VENCIDO');
    });

    it('entra en el filtro VENCIDOS y NO en POR_VENCER', () => {
      const [fila] = construirFilasLibroConsecutivo(
        [expedienteBase({ creadoEn: '2026-02-01T10:00:00.000Z' })],
        2026,
      );
      const filaVencida = { ...fila, fechaAlertaConservadora: VIERNES_7_AGO_FESTIVO };
      expect(coincideFiltroLibro(filaVencida, 'VENCIDOS', LUNES_10_AGO)).toBe(true);
      expect(coincideFiltroLibro(filaVencida, 'POR_VENCER', LUNES_10_AGO)).toBe(false);
    });

    it('el texto dice "Vencido", no "0 días hábiles" (que sería engañoso)', () => {
      expect(textoDiasVencimientoLibro({ fechaAlertaConservadora: VIERNES_7_AGO_FESTIVO, estadoJuridico: 'EN_REVISION' }, LUNES_10_AGO)).toBe('Vencido');
    });

    it('el MISMO día del vencimiento todavía NO está vencido (el plazo corre hasta el final del día)', () => {
      expect(urgenciaFilaLibro({ fechaAlertaConservadora: VIERNES_7_AGO_FESTIVO, estadoJuridico: 'EN_REVISION' }, new Date('2026-08-07T08:00:00-05:00'))).not.toBe('VENCIDO');
    });
  });
});

describe('urgenciaFilaLibro — expediente YA RESUELTO no está en mora (regresión E2E 12-ago-2026)', () => {
  // Defecto encontrado verificando la aplicación REAL en stage: un expediente
  // EN FIRME mostraba «Vencido hace 88 días hábiles». El plazo de los 45 días
  // hábiles dejó de correr cuando la Administración decidió; medirlo contra
  // "hoy" convierte el paso del tiempo en un incumplimiento inexistente.
  const HOY = new Date('2026-08-12T12:00:00-05:00');
  const FECHA_VIEJA = '2026-03-30T12:00:00-05:00'; // muy anterior a HOY

  it.each(['CONCEDIDA', 'NEGADA', 'DESISTIDA', 'NOTIFICADA', 'EN_FIRME'] as const)(
    '%s → NEUTRO aunque la fecha proyectada ya pasó (el trámite se resolvió)',
    (estadoJuridico) => {
      expect(urgenciaFilaLibro({ fechaAlertaConservadora: FECHA_VIEJA, estadoJuridico }, HOY)).toBe('NEUTRO');
    },
  );

  it('HISTORICO_SIN_RESOLVER → NEUTRO: nunca tuvo término proyectable (R9)', () => {
    expect(urgenciaFilaLibro({ fechaAlertaConservadora: FECHA_VIEJA, estadoJuridico: 'HISTORICO_SIN_RESOLVER' }, HOY)).toBe('NEUTRO');
  });

  it.each(['RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION', 'CON_ACTA_DE_OBSERVACIONES', 'EN_VIABILIDAD'] as const)(
    '%s → VENCIDO: el término SÍ sigue corriendo y la fecha ya pasó',
    (estadoJuridico) => {
      expect(urgenciaFilaLibro({ fechaAlertaConservadora: FECHA_VIEJA, estadoJuridico }, HOY)).toBe('VENCIDO');
    },
  );

  it('un expediente resuelto tampoco entra en el filtro/KPI "Vencidos"', () => {
    const [base] = construirFilasLibroConsecutivo([expedienteBase({ creadoEn: '2026-02-01T10:00:00.000Z' })], 2026);
    const resuelto = { ...base, fechaAlertaConservadora: FECHA_VIEJA, estadoJuridico: 'EN_FIRME' as const };
    expect(coincideFiltroLibro(resuelto, 'VENCIDOS', HOY)).toBe(false);
    expect(coincideFiltroLibro(resuelto, 'POR_VENCER', HOY)).toBe(false);
  });

  it('el texto de apoyo tampoco anuncia mora en un expediente resuelto', () => {
    expect(textoDiasVencimientoLibro({ fechaAlertaConservadora: FECHA_VIEJA, estadoJuridico: 'EN_FIRME' }, HOY)).toBeNull();
  });
});

describe('textoDiasVencimientoLibro', () => {
  const HOY = new Date('2026-03-10T12:00:00-05:00');

  it('null sin fecha (nada que decir)', () => {
    expect(textoDiasVencimientoLibro({ fechaAlertaConservadora: null, estadoJuridico: 'EN_REVISION' }, HOY)).toBeNull();
  });

  it('cuenta los días hábiles cuando el plazo sigue corriendo', () => {
    const fecha = sumarDiasHabiles(HOY, 4).toISOString();
    expect(textoDiasVencimientoLibro({ fechaAlertaConservadora: fecha, estadoJuridico: 'EN_REVISION' }, HOY)).toBe('4 días hábiles');
  });

  it('dice hace cuántos días hábiles venció cuando sí los hubo', () => {
    // Fecha pasada explícita (`sumarDiasHabiles` no retrocede con negativos)
    // y expectativa DERIVADA con la misma utilidad que usa el código — nunca
    // un número a mano, que se rompería con cualquier festivo del tramo.
    const fecha = '2026-03-03T12:00:00-05:00';
    const habilesTranscurridos = Math.abs(diasRestantesHabiles(fecha, HOY));
    expect(habilesTranscurridos).toBeGreaterThan(0);
    expect(textoDiasVencimientoLibro({ fechaAlertaConservadora: fecha, estadoJuridico: 'EN_REVISION' }, HOY)).toBe(
      `Vencido hace ${habilesTranscurridos} días hábiles`,
    );
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
      fechaApertura: '2026-03-01T15:00:00.000Z',
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
      colision: false,
      otrosConMismoNumero: [],
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
    expect(conteos).toEqual({ TODOS: 4, EN_TRAMITE: 2, POR_VENCER: 0, VENCIDOS: 1, HISTORICOS_INCOMPLETOS: 1, COLISIONES: 0 });
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
      fechaApertura: '2026-03-01T15:00:00.000Z',
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
      colision: false,
      otrosConMismoNumero: [],
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
      'N. EXPEDIENTE;FECHA APERTURA;FECHA RADICACION;SOLICITANTE;DOCUMENTO;SUBTIPOS;ESTADO JURIDICO;N. LICENCIA;FECHA FIRMEZA;PRUEBA;COLISION',
    );
  });

  it('una fila con acto final ausente muestra "—" en N. LICENCIA y FECHA FIRMEZA, y "NO" en PRUEBA', () => {
    const csv = generarCsvLibroConsecutivo([filaSintetica()]);
    const [, filaTexto] = csv.replace(/^﻿/, '').split('\r\n');
    expect(filaTexto).toBe('68745-0-26-0001;01/03/2026;10/03/2026;Carlos Alberto Rojas;91234567;Licencia de construcción;En revisión;—;—;NO;NO');
  });

  /* El caso que motiva la columna nueva: un expediente PRESENTADA no tiene
     fecha de radicación en debida forma. La celda queda VACÍA — antes salía
     la fecha de apertura, afirmando que el término arrancó ese día. */
  it('un expediente sin radicar deja la FECHA RADICACION vacía, no la rellena con la apertura', () => {
    const csv = generarCsvLibroConsecutivo([filaSintetica({ fechaRadicacion: null })]);
    const filaTexto = csv.replace(/^\uFEFF/, '').split('\r\n')[1];
    expect(filaTexto).toBe('68745-0-26-0001;01/03/2026;;Carlos Alberto Rojas;91234567;Licencia de construcción;En revisión;—;—;NO;NO');
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

/* ══════════════════════════════════════════════════════════════
   Buscador rápido (Libro consecutivo + Bandeja) — pedido explícito del
   propietario ante la importación de los 202 históricos. `coincideBusquedaLibro`
   es la ÚNICA fuente de verdad de la coincidencia; `FilaLibroConsecutivo`
   ya calza `CamposBusquedaLibro` estructuralmente (se prueba pasando filas
   reales, sin adaptador), y `camposBusquedaDesdeExpediente` se prueba
   aparte como el mapeo que necesita la Bandeja.
══════════════════════════════════════════════════════════════ */

describe('coincideBusquedaLibro', () => {
  function camposBase(overrides: Partial<CamposBusquedaLibro> = {}): CamposBusquedaLibro {
    return {
      numeroExpediente: '68745-0-26-0007',
      radicadoId: '1-110-202603-00042',
      fechaApertura: '2026-03-10T15:00:00.000Z',
      solicitanteNombre: 'María Fernanda Gálvez',
      solicitanteDocumento: '91234567',
      matriculaInmobiliaria: '321-51890',
      subtipoCodigos: ['CONSTRUCCION'],
      subtipos: ['Licencia de construcción'],
      estadoJuridico: 'EN_REVISION',
      ...overrides,
    };
  }

  it('término vacío o solo espacios coincide con todo (mismo criterio que el filtro "TODOS")', () => {
    expect(coincideBusquedaLibro(camposBase(), '')).toBe(true);
    expect(coincideBusquedaLibro(camposBase(), '   ')).toBe(true);
  });

  it('coincide por número de expediente', () => {
    expect(coincideBusquedaLibro(camposBase(), '26-0007')).toBe(true);
    expect(coincideBusquedaLibro(camposBase(), '99-9999')).toBe(false);
  });

  it('coincide por número de radicado', () => {
    expect(coincideBusquedaLibro(camposBase(), '00042')).toBe(true);
  });

  it('radicadoId ausente (null/undefined): no rompe, simplemente no coincide por ese campo', () => {
    expect(coincideBusquedaLibro(camposBase({ radicadoId: null }), '00042')).toBe(false);
    expect(coincideBusquedaLibro(camposBase({ radicadoId: undefined }), 'gálvez')).toBe(true);
  });

  it('coincide por documento', () => {
    expect(coincideBusquedaLibro(camposBase(), '91234567')).toBe(true);
  });

  it('coincide por matrícula inmobiliaria; ausente no rompe', () => {
    expect(coincideBusquedaLibro(camposBase(), '321-51890')).toBe(true);
    expect(coincideBusquedaLibro(camposBase({ matriculaInmobiliaria: undefined }), '321-51890')).toBe(false);
    expect(coincideBusquedaLibro(camposBase({ matriculaInmobiliaria: null }), 'gálvez')).toBe(true);
  });

  it('coincide por código de subtipo Y por su nombre legible', () => {
    expect(coincideBusquedaLibro(camposBase(), 'CONSTRUCCION')).toBe(true);
    expect(coincideBusquedaLibro(camposBase(), 'construcción')).toBe(true);
  });

  it('coincide por estado: código crudo y etiqueta legible', () => {
    expect(coincideBusquedaLibro(camposBase(), 'EN_REVISION')).toBe(true);
    expect(coincideBusquedaLibro(camposBase({ estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES' }), 'acta de observaciones')).toBe(true);
  });

  it('estado corrupto/legado (no está en las 9 claves conocidas): no rompe, se busca solo por el código crudo', () => {
    expect(coincideBusquedaLibro(camposBase({ estadoJuridico: 'NO_EXISTE' }), 'NO_EXISTE')).toBe(true);
    expect(coincideBusquedaLibro(camposBase({ estadoJuridico: 'NO_EXISTE' }), 'en revisión')).toBe(false);
  });

  it('insensible a mayúsculas y a acentos — "MARIA" encuentra a "María", sin mapa de acentos a mano', () => {
    expect(coincideBusquedaLibro(camposBase(), 'MARIA')).toBe(true);
    expect(coincideBusquedaLibro(camposBase(), 'maria')).toBe(true);
    expect(coincideBusquedaLibro(camposBase(), 'gAlVeZ')).toBe(true);
  });

  it('término con varios fragmentos: TODOS deben coincidir, en cualquier campo (no en el mismo campo)', () => {
    // "gálvez" vive en el solicitante; "2026" solo aparece en la fecha de
    // radicación formateada (10/03/2026) — el ejemplo textual del pedido.
    expect(coincideBusquedaLibro(camposBase(), 'galvez 2026')).toBe(true);
    expect(coincideBusquedaLibro(camposBase(), 'galvez 2099')).toBe(false);
  });

  it('nombre societario largo (dato feo real) sigue siendo buscable por fragmento parcial', () => {
    const campos = camposBase({ solicitanteNombre: 'Comercializadora y Distribuidora El Roble S.A.S.' });
    expect(coincideBusquedaLibro(campos, 'roble')).toBe(true);
    expect(coincideBusquedaLibro(campos, 'comercializadora roble')).toBe(true);
  });

  it('fecha de radicación inválida: no lanza, simplemente no aporta coincidencia por fecha', () => {
    const campos = camposBase({ fechaApertura: 'no-es-fecha' });
    expect(() => coincideBusquedaLibro(campos, 'maria')).not.toThrow();
    expect(coincideBusquedaLibro(campos, 'maria')).toBe(true);
  });

  it('sin coincidencia en ningún campo: false', () => {
    expect(coincideBusquedaLibro(camposBase(), 'xyz-no-existe')).toBe(false);
  });
});

describe('camposBusquedaDesdeExpediente', () => {
  it('mapea número de expediente, radicado, matrícula y subtipos (código + nombre legible) desde ExpedienteLicenciaDoc', () => {
    const exp = expedienteBase({
      radicadoId: '1-110-202603-00042',
      predio: { matriculaInmobiliaria: '321-51890' },
      subtipos: ['CONSTRUCCION'],
    });
    const campos = camposBusquedaDesdeExpediente(exp);
    expect(campos.numeroExpediente).toBe('68745-0-26-0002');
    expect(campos.radicadoId).toBe('1-110-202603-00042');
    expect(campos.matriculaInmobiliaria).toBe('321-51890');
    expect(campos.subtipoCodigos).toEqual(['CONSTRUCCION']);
    expect(campos.subtipos).toEqual(['Licencia de construcción']);
  });

  it('usa el id del documento como número de expediente cuando numeroExpediente está ausente (mismo criterio que construirFilasLibroConsecutivo)', () => {
    const campos = camposBusquedaDesdeExpediente(expedienteBase({ id: 'exp-sin-numero', numeroExpediente: undefined }));
    expect(campos.numeroExpediente).toBe('exp-sin-numero');
  });

  it('predio/radicadoId ausentes: matriculaInmobiliaria y radicadoId quedan null, sin inventar nada', () => {
    const campos = camposBusquedaDesdeExpediente(expedienteBase({ predio: undefined, radicadoId: null }));
    expect(campos.matriculaInmobiliaria).toBeNull();
    expect(campos.radicadoId).toBeNull();
  });

  it('el resultado del mapeo es buscable con coincideBusquedaLibro (integración de ambas funciones)', () => {
    const exp = expedienteBase({ solicitanteNombre: 'Ana María Vargas', predio: { matriculaInmobiliaria: '900-12345' } });
    const campos = camposBusquedaDesdeExpediente(exp);
    expect(coincideBusquedaLibro(campos, 'maria')).toBe(true);
    expect(coincideBusquedaLibro(campos, '900-12345')).toBe(true);
  });
});

describe('COLOR_TEXTO_URGENCIA_LIBRO — franja y texto NUNCA comparten token (ADR-0030)', () => {
  // Los tokens semánticos están calibrados para pintar un filete de 4 px, no
  // para leerse: medidos en la aplicación real daban 2,15:1 (ámbar), 3,30:1
  // (verde) y 4,83:1 (rojo, que cae a 4,33:1 sobre fila atenuada). El peor
  // caso era la alerta «quedan pocos días hábiles», que es justo la que la
  // funcionaria más necesita leer.
  it('NINGUNA banda reutiliza como texto el token de su franja', () => {
    for (const urgencia of ['VENCIDO', 'POR_VENCER', 'EN_TERMINO', 'NEUTRO'] as const) {
      expect(COLOR_TEXTO_URGENCIA_LIBRO[urgencia]).not.toBe(COLOR_URGENCIA_LIBRO[urgencia]);
    }
  });

  it('las tres bandas con plazo vivo usan la variante `-text` del token de su franja (mismo tono, no un color nuevo)', () => {
    expect(COLOR_URGENCIA_LIBRO.VENCIDO).toBe('var(--color-danger)');
    expect(COLOR_TEXTO_URGENCIA_LIBRO.VENCIDO).toBe('var(--color-danger-text)');
    expect(COLOR_URGENCIA_LIBRO.POR_VENCER).toBe('var(--color-warning)');
    expect(COLOR_TEXTO_URGENCIA_LIBRO.POR_VENCER).toBe('var(--color-warning-text)');
    expect(COLOR_URGENCIA_LIBRO.EN_TERMINO).toBe('var(--color-success)');
    expect(COLOR_TEXTO_URGENCIA_LIBRO.EN_TERMINO).toBe('var(--color-success-text)');
  });

  it('NEUTRO usa `--text-secondary`: `--color-border` es un token de borde sin variante de texto', () => {
    expect(COLOR_URGENCIA_LIBRO.NEUTRO).toBe('var(--color-border)');
    expect(COLOR_TEXTO_URGENCIA_LIBRO.NEUTRO).toBe('var(--text-secondary)');
  });

  it('ningún color de texto es un hex suelto — todo pasa por el sistema de diseño (sin estilos paralelos)', () => {
    for (const urgencia of ['VENCIDO', 'POR_VENCER', 'EN_TERMINO', 'NEUTRO'] as const) {
      expect(COLOR_TEXTO_URGENCIA_LIBRO[urgencia]).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });
});

describe('colisión de radicado — el Libro delata la anomalía que el importador declaró', () => {
  // Caso REAL en producción desde el 11-ago-2026: `68745-0-25-0037`, dos
  // solicitantes distintos con el mismo número (H4/R1 del análisis del
  // insumo). No se renumera: la serie legal histórica es intocable.
  function expColision(overrides: Partial<ExpedienteLicenciaDoc> = {}): ExpedienteLicenciaDoc {
    return expedienteBase({
      creadoEn: '2025-09-17T15:00:00.000Z',
      numeroExpediente: { numero: '68745-0-25-0037', serieId: 'historico', año: 2025, colision: true },
      ...overrides,
    });
  }

  it('mapea `numeroExpediente.colision` tal cual, y colapsa ausente/false a `false` (nunca undefined)', () => {
    const [conFlag] = construirFilasLibroConsecutivo([expColision()], 2025);
    expect(conFlag.colision).toBe(true);

    const sinFlag = construirFilasLibroConsecutivo(
      [expColision({ id: 'b', numeroExpediente: { numero: '68745-0-25-0040', serieId: 'h', año: 2025, colision: false } })],
      2025,
    );
    expect(sinFlag[0].colision).toBe(false);

    const ausente = construirFilasLibroConsecutivo(
      [expColision({ id: 'c', numeroExpediente: { numero: '68745-0-25-0041', serieId: 'h', año: 2025 } })],
      2025,
    );
    expect(ausente[0].colision).toBe(false);

    const sinNumero = construirFilasLibroConsecutivo([expColision({ id: 'd', numeroExpediente: undefined })], 2025);
    expect(sinNumero[0].colision).toBe(false);
  });

  it('LA PRUEBA CLAVE: dos filas con el MISMO número pero SIN flag NO se marcan — el Libro no diagnostica, solo delata', () => {
    const mismoNumero = { numero: '68745-0-25-0099', serieId: 'h', año: 2025 };
    const filas = construirFilasLibroConsecutivo(
      [
        expColision({ id: 'x', numeroExpediente: { ...mismoNumero } }),
        expColision({ id: 'y', numeroExpediente: { ...mismoNumero } }),
      ],
      2025,
    );
    expect(filas.map((f) => f.colision)).toEqual([false, false]);
    // …aunque el derivado SÍ los ve: son cosas distintas a propósito.
    expect(filas[0].otrosConMismoNumero).toHaveLength(1);
  });

  it('`otrosConMismoNumero` identifica al gemelo del mismo año (con quién colisiona, que es lo que se necesita para resolver)', () => {
    const filas = construirFilasLibroConsecutivo(
      [
        expColision({ id: 'primera', solicitanteNombre: 'Ana Lucía Avilés' }),
        expColision({ id: 'segunda', solicitanteNombre: 'Pedro Rojas Peña', creadoEn: '2025-09-30T15:00:00.000Z' }),
      ],
      2025,
    );
    const primera = filas.find((f) => f.id === 'primera')!;
    expect(primera.otrosConMismoNumero).toHaveLength(1);
    expect(primera.otrosConMismoNumero[0]).toMatchObject({ id: 'segunda', solicitanteNombre: 'Pedro Rojas Peña' });
    // Nunca se incluye a sí misma.
    expect(primera.otrosConMismoNumero.some((o) => o.id === 'primera')).toBe(false);
  });

  it('gemelo fuera de la vista (otro año): la marca SIGUE encendida y la lista queda vacía — el alcance declarado no apaga el flag', () => {
    const [fila] = construirFilasLibroConsecutivo([expColision()], 2025);
    expect(fila.colision).toBe(true);
    expect(fila.otrosConMismoNumero).toEqual([]);
  });

  it('el fallback al id del documento no fabrica falsos positivos', () => {
    const filas = construirFilasLibroConsecutivo(
      [expColision({ id: 'sin-num-1', numeroExpediente: undefined }), expColision({ id: 'sin-num-2', numeroExpediente: undefined })],
      2025,
    );
    expect(filas.every((f) => f.otrosConMismoNumero.length === 0)).toBe(true);
  });

  it('textoColisionLibro: null sin marca; nombra al gemelo cuando lo ve; habla del DATO cuando no', () => {
    const limpia = { colision: false, numeroExpediente: '68745-0-25-0001', otrosConMismoNumero: [] };
    expect(textoColisionLibro(limpia)).toBeNull();

    const conGemelo = textoColisionLibro({
      colision: true,
      numeroExpediente: '68745-0-25-0037',
      otrosConMismoNumero: [{ id: 'y', solicitanteNombre: 'Pedro Rojas Peña', fechaRadicacion: '2025-09-30T15:00:00.000Z' }],
    })!;
    expect(conGemelo).toContain('Pedro Rojas Peña');
    expect(conGemelo).toContain('30/09/2025');
    expect(conGemelo).toContain('No se renumera');

    // Sin gemelo a la vista NO se afirma que exista: `colision` es una
    // aserción del importador en el pasado, no un invariante vivo.
    const sinGemelo = textoColisionLibro({ colision: true, numeroExpediente: '68745-0-25-0037', otrosConMismoNumero: [] })!;
    expect(sinGemelo).toContain('El importador marcó');
    expect(sinGemelo).toContain('no aparece en esta vista');
    expect(sinGemelo).not.toMatch(/otro expediente comparte/i);
  });

  it('filtro COLISIONES: aísla las marcadas y NO las saca del resto de baldes (la colisión es un atributo, no un estado)', () => {
    const filas = construirFilasLibroConsecutivo(
      [expColision({ id: 'a' }), expColision({ id: 'b', creadoEn: '2025-09-30T15:00:00.000Z' }), expedienteBase({ id: 'c', creadoEn: '2025-04-01T15:00:00.000Z', numeroExpediente: { numero: '68745-0-25-0010', serieId: 'h', año: 2025 } })],
      2025,
    );
    expect(filtrarFilasLibro(filas, 'COLISIONES')).toHaveLength(2);
    // Siguen contando en Total y en su estado.
    expect(filtrarFilasLibro(filas, 'TODOS')).toHaveLength(3);
    expect(calcularConteosKpiLibro(filas).total).toBe(3);
  });

  it('el CSV lleva la colisión: sin ella, la anomalía seguiría invisible una capa más abajo', () => {
    const filas = construirFilasLibroConsecutivo([expColision()], 2025);
    const csv = generarCsvLibroConsecutivo(filas);
    const [encabezado, primera] = csv.replace('﻿', '').split('\r\n');
    expect(encabezado.endsWith(';COLISION')).toBe(true);
    expect(primera.endsWith(';SI')).toBe(true);
    // Guardián de alineación: cabecera y fila con el mismo número de celdas.
    expect(primera.split(';')).toHaveLength(encabezado.split(';').length);
  });
});

describe('duplicado NO DECLARADO — el único detector de una colisión que nadie marcó', () => {
  // Hasta el 13-ago-2026 el aviso exigía `colision === true`, la bandera que
  // solo escribe el importador. Una colisión NUEVA —por ejemplo una emisión
  // real que aterrizara sobre un número histórico— habría sido invisible,
  // aunque `otrosConMismoNumero` ya la calculaba y se descartaba.
  function conNumero(id: string, numero: string, nombre: string, colision = false): ExpedienteLicenciaDoc {
    return expedienteBase({
      id, solicitanteNombre: nombre, creadoEn: '2026-03-10T15:00:00.000Z',
      numeroExpediente: { numero, serieId: 'expedientes', año: 2026, colision },
    });
  }

  it('dos filas con el mismo número y SIN bandera: el aviso aparece y dice que NADIE lo declaró', () => {
    const filas = construirFilasLibroConsecutivo(
      [conNumero('a', '68745-0-26-0007', 'Ana Lucía Avilés'), conNumero('b', '68745-0-26-0007', 'Pedro Nel Rojas')],
      2026,
    );
    const texto = textoColisionLibro(filas[0])!;
    expect(texto).toContain('DUPLICADO NO DECLARADO');
    expect(texto).toContain('Pedro Nel Rojas');
    expect(texto).toContain('No se renumera');
  });

  it('el Libro sigue SIN fabricar la bandera persistida — solo la presentación cambia', () => {
    const filas = construirFilasLibroConsecutivo(
      [conNumero('a', '68745-0-26-0007', 'Ana'), conNumero('b', '68745-0-26-0007', 'Pedro')],
      2026,
    );
    expect(filas.map((f) => f.colision)).toEqual([false, false]);
  });

  it('con bandera del importador el texto NO dice "no declarado" (son dos cosas distintas)', () => {
    const filas = construirFilasLibroConsecutivo(
      [conNumero('a', '68745-0-26-0007', 'Ana', true), conNumero('b', '68745-0-26-0007', 'Pedro', true)],
      2026,
    );
    const texto = textoColisionLibro(filas[0])!;
    expect(texto).toContain('Comparte el número');
    expect(texto).not.toContain('NO DECLARADO');
  });

  it('el filtro COLISIONES atrapa también las no declaradas', () => {
    const filas = construirFilasLibroConsecutivo(
      [
        conNumero('a', '68745-0-26-0007', 'Ana'),
        conNumero('b', '68745-0-26-0007', 'Pedro'),
        conNumero('c', '68745-0-26-0008', 'Sin duplicado'),
      ],
      2026,
    );
    expect(filtrarFilasLibro(filas, 'COLISIONES').map((f) => f.id).sort()).toEqual(['a', 'b']);
  });

  it('una fila limpia sigue sin aviso', () => {
    const [fila] = construirFilasLibroConsecutivo([conNumero('solo', '68745-0-26-0009', 'Única')], 2026);
    expect(textoColisionLibro(fila)).toBeNull();
  });
});
