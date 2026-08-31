/**
 * Importador de históricos — planificador puro, snapshot SINTÉTICO.
 * (Bloque "Importador de históricos", ago-2026; rediseñado por DF-10,
 * decisión del propietario 11-ago-2026 — "históricos sin resolver".)
 */
import { describe, it, expect } from 'vitest';
import {
  planificarImportacion,
  parsearFechaHistoricaANoonISO,
  mapearPredioHistorico,
  SIN_DEFINICION_TRAMITE_HISTORICO,
  ESTADO_JURIDICO_HISTORICO_SIN_RESOLVER,
  type SnapshotConsecutivoLicencias,
  type RegistroConsecutivoHistorico,
} from '@/lib/migracion/planificar-importacion-consecutivo';

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

describe('parsearFechaHistoricaANoonISO', () => {
  it('"YYYY-MM-DD" válido → ISO anclado al MISMO día civil (no se corre un día por TZ)', () => {
    const r = parsearFechaHistoricaANoonISO('2026-01-06');
    expect(r).not.toBeNull();
    // El día civil de Bogotá del resultado debe seguir siendo 6, no 5.
    // (Históricamente esto protegía contra un defecto de atLocalNoon(), que
    // reinterpretaba el string como instante UTC y perdía un día; desde el
    // rescate del PR #156 la raíz está corregida y ambas rutas delegan en
    // fechaCivilANoon — este test vigila que la delegación no regrese.)
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

describe('planificarImportacion — DF-10: TODO registro con fecha válida se planifica como "histórico sin resolver"', () => {
  it('código MAPEADO + fecha válida + documento presente → se planifica, con la marca DF-10 completa', () => {
    const plan = planificarImportacion(
      snapshot([registro({ tipo: 'LC', estado: 'terminado', solicitanteDocumento: '12345678' })]),
      AHORA,
    );

    expect(plan.reconciliacion.planificados).toBe(1);
    expect(plan.reconciliacion.enCuarentena).toBe(0);
    expect(plan.cuarentena).toHaveLength(0);

    const exp = plan.expedientes[0]!;
    expect(exp.origen).toBe('RECONSTRUIDO');
    expect(exp.esPrueba).toBe(false);
    expect(exp.estado).toBe('ARCHIVADO'); // DF-10: nunca EN_REVISION — no es trabajo pendiente del panel.
    expect(exp.estadoJuridico).toBe(ESTADO_JURIDICO_HISTORICO_SIN_RESOLVER);
    // Estado PROPIO del enum (DF-10): no reutiliza ningún hito del ciclo —
    // ver el JSDoc de `HISTORICO_SIN_RESOLVER` en `estados-licencia.ts`.
    expect(exp.estadoJuridico).toBe('HISTORICO_SIN_RESOLVER');
    expect(exp.tramiteId).toBe(SIN_DEFINICION_TRAMITE_HISTORICO);
    expect(exp.subtipos).toEqual(['CONSTRUCCION']);
    expect(exp.solicitanteDocumento).toBe('12345678');
    expect(exp.radicadoId).toBeNull();

    // Marca DF-10.
    expect(exp.revisionHistorica).toEqual({
      pendiente: true,
      pendientesAlImportar: ['ESTADO_JURIDICO', 'ACTO_FINAL'],
    });
    expect(exp.estadoOriginalHistorico).toBe('terminado');
  });

  it('numeroExpediente como ATRIBUTO: usa el radicado histórico verbatim, nunca lo formatea/reserva', () => {
    const plan = planificarImportacion(
      snapshot([registro({ radicado: '68745-0-26-0099', tipo: 'PH', solicitanteDocumento: '999' })]),
      AHORA,
    );
    expect(plan.expedientes[0]!.numeroExpediente).toEqual({
      numero: '68745-0-26-0099', serieId: 'historico-consecutivo-planeacion', año: 2026, colision: false,
    });
  });

  it('actoFinal.cierreDesconocido: true (DF-6/DF-9 — nunca se inventa una fecha de firmeza)', () => {
    const plan = planificarImportacion(
      snapshot([registro({ tipo: 'PH', solicitanteDocumento: '999' })]),
      AHORA,
    );
    expect(plan.expedientes[0]!.actoFinal).toEqual({ cierreDesconocido: true });
  });

  it('provenance: {fuente, sha256, hoja, fila} tal como exige el importador', () => {
    const plan = planificarImportacion(
      snapshot([registro({ hoja: '2024', fila: 17, tipo: 'LR', solicitanteDocumento: '111' })], 'sha-real-del-xlsx'),
      AHORA,
    );
    expect(plan.expedientes[0]!.provenance).toEqual({
      fuente: 'xlsx-consecutivo-2022-2026',
      fechaImportacion: AHORA.toISOString(),
      sha256: 'sha-real-del-xlsx',
      hoja: '2024',
      fila: 17,
    });
  });

  it('R9 END-TO-END: fechaAlertaConservadora siempre null — la actuación de radicación reconstruida se excluye del término', () => {
    const plan = planificarImportacion(
      snapshot([registro({ tipo: 'LC', solicitanteDocumento: '1' })]),
      AHORA,
    );
    expect(plan.expedientes[0]!.fechaAlertaConservadora).toBeNull();
  });
});

describe('planificarImportacion — estadoOriginalHistorico se conserva verbatim (DF-10)', () => {
  it.each([
    ['terminado', 'terminado'],
    ['REVISADO', 'REVISADO'],
    ['  TERMINADA  ', 'TERMINADA'], // trim de espacios incidentales, no altera contenido sustantivo (mismo criterio que barrioVereda/noLicencia)
  ])('estado histórico %j → estadoOriginalHistorico %j', (original, esperado) => {
    const plan = planificarImportacion(snapshot([registro({ estado: original, solicitanteDocumento: '1' })]), AHORA);
    expect(plan.expedientes[0]!.estadoOriginalHistorico).toBe(esperado);
  });

  it('ausencia total de "estado" (cohorte 2022-2024) → estadoOriginalHistorico: null (ausencia declarada, no omitida)', () => {
    const plan = planificarImportacion(snapshot([registro({ estado: undefined, solicitanteDocumento: '1' })]), AHORA);
    expect(plan.expedientes[0]!.estadoOriginalHistorico).toBeNull();
  });

  it('string vacío/solo espacios también cuenta como ausencia → null', () => {
    const plan = planificarImportacion(snapshot([registro({ estado: '   ', solicitanteDocumento: '1' })]), AHORA);
    expect(plan.expedientes[0]!.estadoOriginalHistorico).toBeNull();
  });

  it('ningún texto de "estado" hace que el registro deje de ser "histórico sin resolver" (nunca se infiere un desenlace)', () => {
    const plan = planificarImportacion(snapshot([
      registro({ hoja: '2026', fila: 2, radicado: '68745-0-26-0001', estado: 'terminado', solicitanteDocumento: '1' }),
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002', estado: 'revisado', solicitanteDocumento: '2' }),
      registro({ hoja: '2026', fila: 4, radicado: '68745-0-26-0003', estado: undefined, solicitanteDocumento: '3' }),
    ]), AHORA);
    expect(plan.reconciliacion.planificados).toBe(3);
    expect(plan.expedientes.every((e) => e.estadoJuridico === ESTADO_JURIDICO_HISTORICO_SIN_RESOLVER)).toBe(true);
    expect(plan.expedientes.every((e) => e.revisionHistorica?.pendiente === true)).toBe(true);
  });
});

describe('planificarImportacion — "histórico sin resolver" NUNCA infla "en trámite" del panel', () => {
  it('estado operativo (EstadoExpediente) siempre ARCHIVADO, nunca EN_REVISION', () => {
    const plan = planificarImportacion(snapshot([
      registro({ estado: 'terminado', solicitanteDocumento: '1' }),
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002', estado: undefined, solicitanteDocumento: '2' }),
    ]), AHORA);
    expect(plan.expedientes.every((e) => e.estado === 'ARCHIVADO')).toBe(true);
  });
});

describe('planificarImportacion — código sin resolver (P1′) se IMPORTA con el texto crudo (DF-10)', () => {
  /* ══════════════════════════════════════════════════════════════
     UN RENGLÓN DEL INGENIERO PUEDE VALER MÁS DE UN SUBTIPO.

     La traducción NO es uno a uno: el ingeniero escribe «LC y PH» —una sola
     casilla en su planilla— y eso son DOS figuras normativas, porque la
     licencia de construcción conlleva la aprobación de propiedad horizontal.
     `LC, PH y LSU` son tres.

     POR QUÉ ESTA PRUEBA EXISTE AQUÍ, si `catalogo-subtipos-normativo.test.ts`
     ya cubre la expansión: porque cubre el RESOLUTOR, no a quien lo consume.
     Medido por mutación el 31-ago-2026 — con `resolverEquivalencia` devolviendo
     solo el primer código (`fila.codigos.slice(0, 1)`), la prueba del catálogo
     se pone en 5 rojas y ESTE archivo seguía en 47 verdes. Es decir: nadie
     comprobaba que el expediente MIGRADO naciera con sus dos subtipos.

     Lo que se perdería en silencio no es cosmético: un expediente con
     `['CONSTRUCCION']` en vez de `['CONSTRUCCION','APROBACION_PH']` pierde la
     figura de PH —y con ella los requisitos y las vigencias que le
     correspondan— sin que ningún rojo lo diga. */
  it('un solo texto histórico puede expandirse a VARIOS subtipos en el expediente planificado', () => {
    const plan = planificarImportacion(
      snapshot([
        registro({ radicado: '68745-0-26-0001', fila: 2, tipo: 'LC y PH' }),
        registro({ radicado: '68745-0-26-0002', fila: 3, tipo: 'LC, PH y LSU' }),
      ]),
      AHORA,
    );

    const dos = plan.expedientes.find((e) => e.numeroExpediente?.numero === '68745-0-26-0001')
      ?? plan.expedientes[0]!;
    const tres = plan.expedientes.find((e) => e.numeroExpediente?.numero === '68745-0-26-0002')
      ?? plan.expedientes[1]!;

    expect(
      dos.subtipos,
      '«LC y PH» dejó de expandirse: el expediente perdió la figura de propiedad horizontal',
    ).toEqual(['CONSTRUCCION', 'APROBACION_PH']);

    expect(
      tres.subtipos,
      '«LC, PH y LSU» dejó de expandirse a sus tres figuras',
    ).toEqual(['CONSTRUCCION', 'APROBACION_PH', 'SUBDIVISION_URBANA']);

    // Y expandirse no es «no resolverse»: nada de esto va al informe de huecos.
    expect(plan.subtiposSinResolver).toHaveLength(0);
  });

  it('"LRC" (no sembrado, JAMÁS se mapea por norma) → se planifica con subtipos: ["LRC"], reportado en subtiposSinResolver', () => {
    const plan = planificarImportacion(snapshot([registro({ tipo: 'LRC', solicitanteDocumento: '1' })]), AHORA);
    expect(plan.reconciliacion.planificados).toBe(1);
    expect(plan.cuarentena).toHaveLength(0);
    expect(plan.expedientes[0]!.subtipos).toEqual(['LRC']);
    expect(plan.subtiposSinResolver).toEqual([{ radicado: '68745-0-26-0001', hoja: '2026', fila: 2, tipoOriginal: 'LRC' }]);
    expect(plan.expedientes[0]!.revisionHistorica?.pendientesAlImportar).toContain('SUBTIPO');
  });

  it('código MAPEADO → NO aparece en subtiposSinResolver ni en pendientesAlImportar', () => {
    const plan = planificarImportacion(snapshot([registro({ tipo: 'LC', solicitanteDocumento: '1' })]), AHORA);
    expect(plan.subtiposSinResolver).toHaveLength(0);
    expect(plan.expedientes[0]!.revisionHistorica?.pendientesAlImportar).not.toContain('SUBTIPO');
  });

  it('advertencias incluye una nota SUBTIPO SIN RESOLVER cuando aplica', () => {
    const plan = planificarImportacion(snapshot([registro({ tipo: 'LCR VISR', solicitanteDocumento: '1' })]), AHORA);
    expect(plan.advertencias.some((a) => a.startsWith('SUBTIPO SIN RESOLVER'))).toBe(true);
  });
});

describe('planificarImportacion — COLISIÓN de radicado (DF-9) — NO bloquea (DF-10)', () => {
  it('dos filas con el MISMO radicado → colision:true en AMBAS, AMBAS se planifican (ya no van a cuarentena)', () => {
    const plan = planificarImportacion(snapshot([
      // Nombres SINTÉTICOS a propósito (no los reales del caso 25-0037):
      // ningún dato personal del libro entra al repo, ni siquiera en tests.
      registro({ hoja: '2025', fila: 38, radicado: '68745-0-25-0037', tipo: 'LA', estado: 'revisado', solicitante: 'SOLICITANTE SINTETICA UNO' }),
      registro({ hoja: '2025', fila: 39, radicado: '68745-0-25-0037', tipo: 'LR', estado: 'revisado', solicitante: 'SOLICITANTE SINTETICA DOS' }),
    ]), AHORA);

    expect(plan.reconciliacion.colisiones).toBe(2);
    expect(plan.reconciliacion.planificados).toBe(2);
    expect(plan.cuarentena).toHaveLength(0);
    expect(plan.expedientes.every((e) => e.numeroExpediente?.colision === true)).toBe(true);
    expect(plan.filasColision).toEqual([
      { radicado: '68745-0-25-0037', hoja: '2025', fila: 38 },
      { radicado: '68745-0-25-0037', hoja: '2025', fila: 39 },
    ]);
  });

  it('sin repetidos → colisiones = 0, filasColision vacío', () => {
    const plan = planificarImportacion(snapshot([
      registro({ radicado: '68745-0-26-0001' }),
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002' }),
    ]), AHORA);
    expect(plan.reconciliacion.colisiones).toBe(0);
    expect(plan.filasColision).toEqual([]);
  });

  it('una fila en colisión que ADEMÁS tiene fecha inválida sí va a cuarentena — la colisión se reporta igual', () => {
    const plan = planificarImportacion(snapshot([
      registro({ hoja: '2025', fila: 38, radicado: '68745-0-25-0037', fechaSolicitud: 'no-es-fecha' }),
      registro({ hoja: '2025', fila: 39, radicado: '68745-0-25-0037' }),
    ]), AHORA);
    expect(plan.reconciliacion.colisiones).toBe(2);
    expect(plan.filasColision).toHaveLength(2);
    expect(plan.cuarentena).toHaveLength(1);
    expect(plan.cuarentena[0]!.colision).toBe(true);
    expect(plan.reconciliacion.planificados).toBe(1);
  });
});

describe('planificarImportacion — ÚNICA cuarentena real: FECHA_INVALIDA', () => {
  it('fechaSolicitud vacía → CUARENTENA con motivo FECHA_INVALIDA', () => {
    const plan = planificarImportacion(snapshot([registro({ fechaSolicitud: '', solicitanteDocumento: '1' })]), AHORA);
    expect(plan.cuarentena[0]!.motivos).toEqual(['FECHA_INVALIDA']);
    expect(plan.reconciliacion.enCuarentena).toBe(1);
    expect(plan.reconciliacion.planificados).toBe(0);
  });

  it('fecha calendario imposible → CUARENTENA', () => {
    const plan = planificarImportacion(snapshot([registro({ fechaSolicitud: '2026-02-30' })]), AHORA);
    expect(plan.cuarentena[0]!.motivos).toEqual(['FECHA_INVALIDA']);
  });
});

describe('planificarImportacion — identidad (nombre/documento) ya NO bloquea a un RECONSTRUIDO (DF-10)', () => {
  it('sin solicitanteDocumento (el caso REAL de las 202 filas) → se planifica con solicitanteDocumento: "" (dato faltante honesto, nunca inventado)', () => {
    const plan = planificarImportacion(snapshot([registro({ solicitanteDocumento: undefined })]), AHORA);
    expect(plan.reconciliacion.planificados).toBe(1);
    expect(plan.cuarentena).toHaveLength(0);
    expect(plan.expedientes[0]!.solicitanteDocumento).toBe('');
    expect(plan.expedientes[0]!.solicitanteNombre).toBe('SOLICITANTE SINTETICO BASE');
    expect(plan.expedientes[0]!.revisionHistorica?.pendientesAlImportar).toContain('IDENTIDAD');
    expect(plan.pendientesHistorico.sinIdentidad).toBe(1);
    expect(plan.advertencias.some((a) => a.startsWith('IDENTIDAD PENDIENTE'))).toBe(true);
  });

  it('sin solicitante (nombre) NI documento (caso del snapshot .sanitizado.json en CI) → AMBOS quedan en ""', () => {
    const plan = planificarImportacion(snapshot([registro({ solicitante: undefined, solicitanteDocumento: undefined })]), AHORA);
    expect(plan.reconciliacion.planificados).toBe(1);
    expect(plan.expedientes[0]!.solicitanteNombre).toBe('');
    expect(plan.expedientes[0]!.solicitanteDocumento).toBe('');
    expect(plan.expedientes[0]!.revisionHistorica?.pendientesAlImportar).toContain('IDENTIDAD');
  });

  it('con nombre Y documento presentes → pendientesAlImportar NO incluye IDENTIDAD y sinIdentidad no lo cuenta', () => {
    const plan = planificarImportacion(snapshot([registro({ solicitante: 'ALGUIEN', solicitanteDocumento: '123' })]), AHORA);
    expect(plan.expedientes[0]!.revisionHistorica?.pendientesAlImportar).not.toContain('IDENTIDAD');
    expect(plan.pendientesHistorico.sinIdentidad).toBe(0);
  });
});

describe('planificarImportacion — un registro puede acumular varios ejes pendientes a la vez, sin bloquear (salvo fecha)', () => {
  it('código sin resolver + sin identidad → se planifica igual, con AMBOS ejes en pendientesAlImportar', () => {
    const plan = planificarImportacion(snapshot([registro({ tipo: 'LCR VISR', estado: 'revisado', solicitanteDocumento: undefined })]), AHORA);
    expect(plan.reconciliacion.planificados).toBe(1);
    expect(plan.cuarentena).toHaveLength(0);
    const pendientes = plan.expedientes[0]!.revisionHistorica?.pendientesAlImportar ?? [];
    expect(pendientes.sort()).toEqual(['ACTO_FINAL', 'ESTADO_JURIDICO', 'IDENTIDAD', 'SUBTIPO'].sort());
  });

  it('solo fecha inválida bloquea; el resto de ejes pendientes no impide reportarla igual como cuarentena', () => {
    const plan = planificarImportacion(snapshot([registro({ tipo: 'LCR VISR', estado: 'revisado', fechaSolicitud: 'no-es-fecha', solicitanteDocumento: undefined })]), AHORA);
    expect(plan.cuarentena[0]!.motivos).toEqual(['FECHA_INVALIDA']);
    expect(plan.reconciliacion.planificados).toBe(0);
  });
});

describe('planificarImportacion — reconciliación siempre cuadra', () => {
  it('totalSnapshot === planificados + enCuarentena', () => {
    const plan = planificarImportacion(snapshot([
      registro({ tipo: 'LC', solicitanteDocumento: '1' }),
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002', tipo: 'LA' }), // sin documento — se planifica igual (DF-10)
      registro({ hoja: '2026', fila: 4, radicado: '68745-0-26-0003', tipo: 'PH', fechaSolicitud: 'no-es-fecha' }), // única cuarentena real
    ]), AHORA);
    expect(plan.reconciliacion.totalSnapshot).toBe(3);
    expect(plan.reconciliacion.planificados + plan.reconciliacion.enCuarentena).toBe(3);
    expect(plan.reconciliacion.planificados).toBe(2);
    expect(plan.reconciliacion.enCuarentena).toBe(1);
  });
});

describe('planificarImportacion — pendientesHistorico (conteos grupales, DF-10)', () => {
  it('sinEstadoJuridico y sinActoFinal cuentan TODOS los planificados — ninguno tiene desenlace verificable', () => {
    const plan = planificarImportacion(snapshot([
      registro({ tipo: 'LC', solicitanteDocumento: '1' }),
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002', tipo: 'PH', solicitanteDocumento: '2' }),
    ]), AHORA);
    expect(plan.pendientesHistorico.sinEstadoJuridico).toBe(2);
    expect(plan.pendientesHistorico.sinActoFinal).toBe(2);
  });
});

/* ──────────────────────────────────────────────
   mapearPredioHistorico — mapeo HONESTO del predio (TAREAS 1-3)
   Valores sintéticos que replican los patrones REALES verificados contra
   las 202 filas del snapshot (ninguno es un dato personal ni real).
────────────────────────────────────────────── */

describe('mapearPredioHistorico', () => {
  it('matrícula con formato "NNN-NNNNN" válido → se aprovecha verbatim', () => {
    const r = mapearPredioHistorico(registro({ matricula: '321-51890' }));
    expect(r.predio?.matriculaInmobiliaria).toBe('321-51890');
    expect(r.descartes).toHaveLength(0);
  });

  it('matrícula con folio corto (4 dígitos, caso REAL "321-4939") también calza', () => {
    const r = mapearPredioHistorico(registro({ matricula: '321-4939' }));
    expect(r.predio?.matriculaInmobiliaria).toBe('321-4939');
  });

  it('matrícula con formato irreconocible → se descarta con MATRICULA_FORMATO_INVALIDO, nunca se fuerza', () => {
    const r = mapearPredioHistorico(registro({ matricula: 'sin-formato-de-matricula' }));
    expect(r.predio?.matriculaInmobiliaria).toBeUndefined();
    expect(r.descartes).toEqual([
      { campo: 'matriculaInmobiliaria', motivo: 'MATRICULA_FORMATO_INVALIDO', valorOriginal: 'sin-formato-de-matricula' },
    ]);
  });

  it('barrioVereda se conserva VERBATIM, texto libre, sin normalizar', () => {
    const r = mapearPredioHistorico(registro({ barrioVereda: 'VEREDA SINTETICA' }));
    expect(r.predio?.barrioVereda).toBe('VEREDA SINTETICA');
    expect(r.descartes).toHaveLength(0);
  });

  it('dirección = "SIMACOTA" (insensible a mayúsculas/espacios) → se descarta con DIRECCION_ES_MUNICIPIO', () => {
    const r1 = mapearPredioHistorico(registro({ direccion: 'SIMACOTA' }));
    expect(r1.predio?.direccion).toBeUndefined();
    expect(r1.descartes).toEqual([{ campo: 'direccion', motivo: 'DIRECCION_ES_MUNICIPIO', valorOriginal: 'SIMACOTA' }]);

    const r2 = mapearPredioHistorico(registro({ direccion: '  simacota  ' }));
    expect(r2.predio?.direccion).toBeUndefined();
    expect(r2.descartes[0]!.motivo).toBe('DIRECCION_ES_MUNICIPIO');
  });

  it('dirección distinta de "SIMACOTA" → se conserva (el campo no está roto en sí, solo su único valor observado hoy)', () => {
    const r = mapearPredioHistorico(registro({ direccion: 'CALLE 10 # 5-20' }));
    expect(r.predio?.direccion).toBe('CALLE 10 # 5-20');
    expect(r.descartes).toHaveLength(0);
  });

  it('área con unidad reconocible (HA/M2, con o sin mezcla de unidades) → se aprovecha como TEXTO', () => {
    expect(mapearPredioHistorico(registro({ area: '48 HA 2469 M2' })).predio?.areaTexto).toBe('48 HA 2469 M2');
    expect(mapearPredioHistorico(registro({ area: '290 M2' })).predio?.areaTexto).toBe('290 M2');
    expect(mapearPredioHistorico(registro({ area: '7 ha' })).predio?.areaTexto).toBe('7 ha');
  });

  it('área DESALINEADA (parece dirección o vereda, no área) → se descarta con AREA_DESALINEADA', () => {
    const r = mapearPredioHistorico(registro({ area: 'CRA 4 # 2-21' }));
    expect(r.predio?.areaTexto).toBeUndefined();
    expect(r.descartes).toEqual([{ campo: 'areaTexto', motivo: 'AREA_DESALINEADA', valorOriginal: 'CRA 4 # 2-21' }]);
  });

  it('"EL CHANCE" (vereda real que contiene la subcadena "HA") NO se confunde con un área — regresión del hallazgo de \\b', () => {
    const r = mapearPredioHistorico(registro({ area: 'EL CHANCE' }));
    expect(r.predio?.areaTexto).toBeUndefined();
    expect(r.descartes[0]!.motivo).toBe('AREA_DESALINEADA');
  });

  it('sin ningún campo de predio aprovechable → predio undefined (ausencia declarada, NUNCA penalizada)', () => {
    const r = mapearPredioHistorico(registro({ direccion: 'SIMACOTA' }));
    expect(r.predio).toBeUndefined();
    expect(r.descartes).toHaveLength(1);
  });

  it('registro sin ningún campo de predio en absoluto → predio undefined, sin descartes', () => {
    const r = mapearPredioHistorico(registro({}));
    expect(r.predio).toBeUndefined();
    expect(r.descartes).toHaveLength(0);
  });
});

describe('planificarImportacion — predio en el expediente y reconciliación ampliada (TAREAS 1-3)', () => {
  it('un registro importable con predio aprovechable propaga `expediente.predio`', () => {
    const plan = planificarImportacion(
      snapshot([registro({
        tipo: 'LC', solicitanteDocumento: '1',
        matricula: '321-51890', barrioVereda: 'VEREDA SINTETICA', direccion: 'SIMACOTA', area: '290 M2',
      })]),
      AHORA,
    );
    expect(plan.expedientes[0]!.predio).toEqual({
      matriculaInmobiliaria: '321-51890',
      barrioVereda: 'VEREDA SINTETICA',
      areaTexto: '290 M2',
      // direccion ausente: "SIMACOTA" se descartó.
    });
  });

  it('un registro importable SIN ningún dato de predio no trae `predio` en el expediente', () => {
    const plan = planificarImportacion(
      snapshot([registro({ tipo: 'LC', solicitanteDocumento: '1' })]),
      AHORA,
    );
    expect(plan.expedientes[0]!.predio).toBeUndefined();
  });

  it('noLicencia se mapea a actoFinal.numero; cierreDesconocido sigue true (falta fecha/fechaFirmeza)', () => {
    const plan = planificarImportacion(
      snapshot([registro({ tipo: 'LC', solicitanteDocumento: '1', noLicencia: '002-2025' })]),
      AHORA,
    );
    expect(plan.expedientes[0]!.actoFinal).toEqual({ cierreDesconocido: true, numero: '002-2025' });
  });

  it('datosPredio cuenta sobre TODO el snapshot, incluidos los registros en cuarentena por fecha', () => {
    const plan = planificarImportacion(snapshot([
      // Planificado, con matrícula válida.
      registro({ tipo: 'LC', solicitanteDocumento: '1', matricula: '321-51890' }),
      // En cuarentena por fecha, pero SU predio igual se cuenta.
      registro({ hoja: '2026', fila: 3, radicado: '68745-0-26-0002', fechaSolicitud: 'no-es-fecha', barrioVereda: 'VEREDA SINTETICA' }),
      // En cuarentena por fecha, con área desalineada.
      registro({ hoja: '2026', fila: 4, radicado: '68745-0-26-0003', fechaSolicitud: 'no-es-fecha', area: 'CRA 4 # 2-21' }),
      // En cuarentena por fecha, con dirección = municipio (descartada).
      registro({ hoja: '2026', fila: 5, radicado: '68745-0-26-0004', fechaSolicitud: 'no-es-fecha', direccion: 'SIMACOTA' }),
    ]), AHORA);

    expect(plan.datosPredio.conMatriculaInmobiliaria).toBe(1);
    expect(plan.datosPredio.conBarrioVereda).toBe(1);
    expect(plan.datosPredio.descartes.areaDesalineada).toBe(1);
    expect(plan.datosPredio.descartes.direccionEsMunicipio).toBe(1);
    expect(plan.datosPredio.filasAreaDesalineada).toEqual([
      { radicado: '68745-0-26-0003', hoja: '2026', fila: 4, valorOriginal: 'CRA 4 # 2-21' },
    ]);
  });

  it('AREA_DESALINEADA NUNCA es motivo de cuarentena por sí sola (predio es ortogonal a la puerta de fecha)', () => {
    const plan = planificarImportacion(
      snapshot([registro({ tipo: 'LC', solicitanteDocumento: '1', area: 'CRA 4 # 2-21' })]),
      AHORA,
    );
    expect(plan.reconciliacion.planificados).toBe(1);
    expect(plan.cuarentena).toHaveLength(0);
    expect(plan.expedientes[0]!.predio).toBeUndefined();
    expect(plan.datosPredio.descartes.areaDesalineada).toBe(1);
  });
});
