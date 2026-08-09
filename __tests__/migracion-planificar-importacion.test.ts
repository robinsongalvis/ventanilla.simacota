/**
 * Importador de históricos — planificador puro, snapshot SINTÉTICO.
 * (Bloque "Importador de históricos", ago-2026.)
 */
import { describe, it, expect } from 'vitest';
import {
  planificarImportacion,
  parsearFechaHistoricaANoonISO,
  SIN_DEFINICION_TRAMITE_HISTORICO,
  type SnapshotConsecutivoLicencias,
  type RegistroConsecutivoHistorico,
} from '@/lib/migracion/planificar-importacion-consecutivo';
import type { EquivalenciaEstadoOperativo } from '@/lib/migracion/equivalencia-estados-operativos';

const AHORA = new Date(2026, 7, 9, 10, 0, 0, 0);

function snapshot(registros: RegistroConsecutivoHistorico[], sha256 = 'sha-sintetico'): SnapshotConsecutivoLicencias {
  return {
    _procedencia: { archivoOrigen: 'sintetico.xlsx', sha256, extraidoEn: '2026-08-09T00:00:00.000Z', totalRegistros: registros.length, nota: 'test' },
    registros,
  };
}

function registro(overrides: Partial<RegistroConsecutivoHistorico>): RegistroConsecutivoHistorico {
  return {
    hoja: '2026',
    fila: 2,
    radicado: '68745-0-26-0001',
    fechaSolicitud: '2026-01-06',
    solicitante: 'SOLICITANTE SINTETICO BASE',
    tipo: 'LC',
    estado: 'terminado',
    ...overrides,
  };
}

// Tabla de estados SINTÉTICA con una fila MAPEADO — para ejercer el camino
// "importable" sin esperar a que P4′ responda de verdad.
const TABLA_ESTADOS_CON_MAPEADO: EquivalenciaEstadoOperativo[] = [
  { textoHistorico: 'CERRADO-SINTETICO', estado: 'MAPEADO', estadoJuridico: 'EN_FIRME', fundamento: 'Fundamento sintético de test.' },
];

describe('parsearFechaHistoricaANoonISO', () => {
  it('"YYYY-MM-DD" válido → ISO anclado al MISMO día civil (no se corre un día por TZ)', () => {
    const r = parsearFechaHistoricaANoonISO('2026-01-06');
    expect(r).not.toBeNull();
    // El día civil de Bogotá del resultado debe seguir siendo 6, no 5
    // (regresión del defecto documentado: atLocalNoon() reinterpretaría
    // este string como instante UTC y perdería un día).
    const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(r!.iso));
    const dia = partes.find((p) => p.type === 'day')?.value;
    expect(dia).toBe('06');
    expect(r!.año).toBe(2026);
  });

  it('vacío/undefined → null', () => {
    expect(parsearFechaHistoricaANoonISO('')).toBeNull();
    expect(parsearFechaHistoricaANoonISO(undefined)).toBeNull();
  });

  it('formato irreconocible (DD/MM/YYYY, u otro) → null, nunca lanza', () => {
    expect(parsearFechaHistoricaANoonISO('27/01/2026')).toBeNull();
    expect(parsearFechaHistoricaANoonISO('27/01/20206')).toBeNull();
  });

  it('fecha calendario imposible (30 de febrero) → null', () => {
    expect(parsearFechaHistoricaANoonISO('2026-02-30')).toBeNull();
  });
});

describe('planificarImportacion — camino IMPORTABLE (tablas sintéticas con MAPEADO)', () => {
  it('código MAPEADO + estado MAPEADO + fecha válida + documento presente → se planifica como expediente', () => {
    const plan = planificarImportacion(
      snapshot([registro({ tipo: 'LC', estado: 'CERRADO-SINTETICO', solicitanteDocumento: '12345678' })]),
      AHORA,
      { estados: TABLA_ESTADOS_CON_MAPEADO },
    );

    expect(plan.reconciliacion.planificados).toBe(1);
    expect(plan.reconciliacion.enCuarentena).toBe(0);
    expect(plan.cuarentena).toHaveLength(0);

    const exp = plan.expedientes[0]!;
    expect(exp.origen).toBe('RECONSTRUIDO');
    expect(exp.esPrueba).toBe(false);
    expect(exp.estadoJuridico).toBe('EN_FIRME');
    expect(exp.tramiteId).toBe(SIN_DEFINICION_TRAMITE_HISTORICO);
    expect(exp.subtipos).toEqual(['CONSTRUCCION']);
    expect(exp.solicitanteDocumento).toBe('12345678');
    expect(exp.radicadoId).toBeNull();
  });

  it('numeroExpediente como ATRIBUTO: usa el radicado histórico verbatim, nunca lo formatea/reserva', () => {
    const plan = planificarImportacion(
      snapshot([registro({ radicado: '68745-0-26-0099', tipo: 'PH', estado: 'CERRADO-SINTETICO', solicitanteDocumento: '999' })]),
      AHORA,
      { estados: TABLA_ESTADOS_CON_MAPEADO },
    );
    expect(plan.expedientes[0]!.numeroExpediente).toEqual({
      numero: '68745-0-26-0099', serieId: 'historico-consecutivo-planeacion', año: 2026, colision: false,
    });
  });

  it('actoFinal.cierreDesconocido: true (DF-6/DF-9 — nunca se inventa una fecha de firmeza)', () => {
    const plan = planificarImportacion(
      snapshot([registro({ tipo: 'PH', estado: 'CERRADO-SINTETICO', solicitanteDocumento: '999' })]),
      AHORA,
      { estados: TABLA_ESTADOS_CON_MAPEADO },
    );
    expect(plan.expedientes[0]!.actoFinal).toEqual({ cierreDesconocido: true });
  });

  it('provenance: {fuente, sha256, hoja, fila} tal como exige el importador', () => {
    const plan = planificarImportacion(
      snapshot([registro({ hoja: '2024', fila: 17, tipo: 'LR', estado: 'CERRADO-SINTETICO', solicitanteDocumento: '111' })], 'sha-real-del-xlsx'),
      AHORA,
      { estados: TABLA_ESTADOS_CON_MAPEADO },
    );
    expect(plan.expedientes[0]!.provenance).toEqual({
      fuente: 'xlsx-consecutivo-2022-2026',
      fechaImportacion: AHORA.toISOString(),
      sha256: 'sha-real-del-xlsx',
      hoja: '2024',
      fila: 17,
    });
  });
});

describe('planificarImportacion — cuarentena por CÓDIGO (P1′)', () => {
  it('"LA" (no sembrado, JAMÁS se mapea) → CUARENTENA con motivo CODIGO_PENDIENTE_P1', () => {
    const plan = planificarImportacion(snapshot([registro({ tipo: 'LA', estado: 'CERRADO-SINTETICO', solicitanteDocumento: '1' })]), AHORA, { estados: TABLA_ESTADOS_CON_MAPEADO });
    expect(plan.reconciliacion.planificados).toBe(0);
    expect(plan.cuarentena[0]!.motivos).toContain('CODIGO_PENDIENTE_P1');
  });
});

describe('planificarImportacion — cuarentena por ESTADO (P4′, semilla REAL)', () => {
  it('con la tabla REAL (default, sin inyección) — "terminado"/"revisado" → CUARENTENA con motivo ESTADO_PENDIENTE_P4', () => {
    const plan = planificarImportacion(snapshot([
      registro({ tipo: 'LC', estado: 'terminado', solicitanteDocumento: '1' }),
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002', tipo: 'PH', estado: 'revisado', solicitanteDocumento: '2' }),
    ]), AHORA);
    expect(plan.reconciliacion.planificados).toBe(0);
    expect(plan.cuarentena.every((c) => c.motivos.includes('ESTADO_PENDIENTE_P4'))).toBe(true);
  });

  it('ausencia total de "estado" (cohorte 2022-2024) → CUARENTENA (R9: sin evidencia de cierre)', () => {
    const plan = planificarImportacion(snapshot([registro({ estado: undefined, solicitanteDocumento: '1' })]), AHORA);
    expect(plan.cuarentena[0]!.motivos).toContain('ESTADO_PENDIENTE_P4');
    expect(plan.cuarentena[0]!.detalle.join(' ')).toMatch(/R9/);
  });
});

describe('planificarImportacion — COLISIÓN de radicado (DF-9)', () => {
  it('dos filas con el MISMO radicado → colision:true en AMBAS, aunque terminen en cuarentena', () => {
    const plan = planificarImportacion(snapshot([
      // Nombres SINTÉTICOS a propósito (no los reales del caso 25-0037):
      // ningún dato personal del libro entra al repo, ni siquiera en tests.
      registro({ hoja: '2025', fila: 38, radicado: '68745-0-25-0037', tipo: 'LA', estado: 'revisado', solicitante: 'SOLICITANTE SINTETICA UNO' }),
      registro({ hoja: '2025', fila: 39, radicado: '68745-0-25-0037', tipo: 'LR', estado: 'revisado', solicitante: 'SOLICITANTE SINTETICA DOS' }),
    ]), AHORA);

    expect(plan.reconciliacion.colisiones).toBe(2);
    expect(plan.cuarentena.filter((c) => c.colision)).toHaveLength(2);
  });

  it('sin repetidos → colisiones = 0', () => {
    const plan = planificarImportacion(snapshot([
      registro({ radicado: '68745-0-26-0001' }),
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002' }),
    ]), AHORA);
    expect(plan.reconciliacion.colisiones).toBe(0);
  });
});

describe('planificarImportacion — cuarentena por FECHA e IDENTIDAD (hallazgos)', () => {
  it('fechaSolicitud vacía → CUARENTENA con motivo FECHA_INVALIDA', () => {
    const plan = planificarImportacion(snapshot([registro({ fechaSolicitud: '', estado: 'CERRADO-SINTETICO', solicitanteDocumento: '1' })]), AHORA, { estados: TABLA_ESTADOS_CON_MAPEADO });
    expect(plan.cuarentena[0]!.motivos).toContain('FECHA_INVALIDA');
  });

  it('sin solicitanteDocumento (el caso REAL de las 202 filas) → CUARENTENA con motivo IDENTIDAD_INCOMPLETA', () => {
    const plan = planificarImportacion(snapshot([registro({ estado: 'CERRADO-SINTETICO', solicitanteDocumento: undefined })]), AHORA, { estados: TABLA_ESTADOS_CON_MAPEADO });
    expect(plan.cuarentena[0]!.motivos).toContain('IDENTIDAD_INCOMPLETA');
    expect(plan.advertencias.some((a) => a.startsWith('IDENTIDAD_INCOMPLETA'))).toBe(true);
  });

  it('un registro puede acumular VARIOS motivos a la vez (no se detiene en el primero)', () => {
    const plan = planificarImportacion(snapshot([registro({ tipo: 'LCR VISR', estado: 'revisado', fechaSolicitud: 'no-es-fecha', solicitanteDocumento: undefined })]), AHORA);
    expect(plan.cuarentena[0]!.motivos.sort()).toEqual(
      ['CODIGO_PENDIENTE_P1', 'ESTADO_PENDIENTE_P4', 'FECHA_INVALIDA', 'IDENTIDAD_INCOMPLETA'].sort(),
    );
  });
});

describe('planificarImportacion — reconciliación siempre cuadra', () => {
  it('totalSnapshot === planificados + enCuarentena', () => {
    const plan = planificarImportacion(snapshot([
      registro({ tipo: 'LC', estado: 'CERRADO-SINTETICO', solicitanteDocumento: '1' }),
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002', tipo: 'LA' }), // cuarentena por código (y más)
      registro({ hoja: '2026', fila: 4, radicado: '68745-0-26-0003', tipo: 'PH', estado: 'terminado' }), // cuarentena por estado
    ]), AHORA, { estados: TABLA_ESTADOS_CON_MAPEADO });
    expect(plan.reconciliacion.totalSnapshot).toBe(3);
    expect(plan.reconciliacion.planificados + plan.reconciliacion.enCuarentena).toBe(3);
  });
});
