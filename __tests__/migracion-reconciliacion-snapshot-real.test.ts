/**
 * Importador de históricos — "puente PLAN→ARCHIVO": corre el planificador
 * REAL contra el snapshot REAL (202 registros del libro de consecutivo de
 * Planeación) y escribe los artefactos generados que consumirá el ejecutor
 * `.mjs` — `scripts/migracion/datos/plan-importacion.generado.json` +
 * `reporte-dry-run.generado.md` (gitignored, ver README.md de ese
 * directorio — contienen los mismos datos personales que el snapshot
 * origen).
 *
 * Este es el REPORTE que verá el propietario: los números aquí abajo son
 * los reales, no un ejemplo — asévera la reconciliación EXACTA contra el
 * snapshot de verdad.
 *
 * DF-10 (decisión del propietario, 11-ago-2026 — "históricos sin
 * resolver"): reescrito frente a la versión anterior. La ÚNICA cuarentena
 * real que queda es fecha inválida (6/202, sin cambio) — TODO lo demás
 * (código sin resolver, identidad, estado jurídico, acto final) se importa
 * y se reporta como pendiente de completar. Reconciliación esperada:
 * **196 planificados, 6 en cuarentena**.
 *
 * NOTA (TAREA 4, ago-2026 — datos de predio): `direccion`/`barrioVereda`/
 * `matricula`/`area` son datos identificables por doctrina PII de este
 * directorio (ver `scripts/migracion/datos/README.md`) — el
 * `.sanitizado.json` versionado NUNCA los incluye. Consecuencia DECLARADA
 * (no un bug): en CUALQUIER entorno que corra contra el sanitizado (CI, un
 * clon nuevo del repo), `PlanImportacion.datosPredio` da 0 en los cuatro
 * conteos "con..." y 0 en los tres motivos de descarte — no hay nada que
 * mapear porque el campo de origen no está presente. Solo la máquina del
 * propietario (`.local.json`) ejerce el camino con datos reales; el test de
 * abajo ("datos de predio contra el .sanitizado.json") lo verifica de forma
 * explícita, DIRECTA contra ese archivo (sin el fallback `RUTA_SNAPSHOT`),
 * para que la aserción se cumpla en ambos entornos sin depender de cuál
 * archivo tomó el resto de la suite.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  planificarImportacion,
  generarReporteDryRun,
  type SnapshotConsecutivoLicencias,
} from '@/lib/migracion/planificar-importacion-consecutivo';

const DIR_DATOS = join(process.cwd(), 'scripts/migracion/datos');
/**
 * Fallback de dos archivos (remediación PII, ago-2026): la máquina del
 * propietario tiene `.local.json` (versión COMPLETA, con nombres — para que
 * los artefactos generados de la reunión tengan fidelidad total) y ese
 * archivo se usa si existe; en CUALQUIER OTRO entorno (CI, un clon nuevo del
 * repo) no existe (está gitignored) y el test cae al `.sanitizado.json`
 * versionado (sin nombres). El PLANIFICADOR es el mismo código en ambos
 * casos y la reconciliación (196/6) es IDÉNTICA por diseño — la única
 * diferencia es si `solicitanteNombre`/`RegistroEnCuarentena.solicitante`
 * vienen poblados o `''`/`undefined`. Ningún assert de este archivo depende
 * del nombre real.
 */
const RUTA_SNAPSHOT_LOCAL = join(DIR_DATOS, 'consecutivo-licencias-snapshot.local.json');
const RUTA_SNAPSHOT_SANITIZADO = join(DIR_DATOS, 'consecutivo-licencias-snapshot.sanitizado.json');
const RUTA_SNAPSHOT = existsSync(RUTA_SNAPSHOT_LOCAL) ? RUTA_SNAPSHOT_LOCAL : RUTA_SNAPSHOT_SANITIZADO;

const RUTA_PLAN_GENERADO = join(DIR_DATOS, 'plan-importacion.generado.json');
const RUTA_REPORTE_GENERADO = join(DIR_DATOS, 'reporte-dry-run.generado.md');

const AHORA = new Date(2026, 7, 9, 12, 0, 0, 0);

function cargarSnapshotReal(): SnapshotConsecutivoLicencias {
  return JSON.parse(readFileSync(RUTA_SNAPSHOT, 'utf8')) as SnapshotConsecutivoLicencias;
}

describe('Puente PLAN→ARCHIVO — snapshot REAL (202 registros, libro de consecutivo de Planeación)', () => {
  it('el snapshot copiado al repo tiene exactamente 202 registros y la procedencia declarada', () => {
    const snap = cargarSnapshotReal();
    expect(snap.registros).toHaveLength(202);
    expect(snap._procedencia.totalRegistros).toBe(202);
    expect(snap._procedencia.sha256).toMatch(/^[0-9a-f]{64,}$/i);
  });

  it('reconciliación EXACTA (DF-10): 196 planificados, 6 en cuarentena (única puerta real: fecha inválida)', () => {
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);

    expect(plan.reconciliacion.totalSnapshot).toBe(202);
    expect(plan.reconciliacion.planificados + plan.reconciliacion.enCuarentena).toBe(202);
    expect(plan.reconciliacion.enCuarentena).toBe(plan.cuarentena.length);

    expect(plan.reconciliacion.planificados).toBe(196);
    expect(plan.reconciliacion.enCuarentena).toBe(6);
    expect(plan.cuarentena.every((c) => c.motivos.length === 1 && c.motivos[0] === 'FECHA_INVALIDA')).toBe(true);
  });

  it('colisión 25-0037: AMBAS filas detectadas (colisiones = 2) y AMBAS se planifican (DF-10, ya no bloquea)', () => {
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);
    expect(plan.reconciliacion.colisiones).toBe(2);
    expect(plan.filasColision).toHaveLength(2);

    const expedientesColision = plan.expedientes.filter((e) => e.numeroExpediente?.numero === '68745-0-25-0037');
    expect(expedientesColision).toHaveLength(2);
    expect(expedientesColision.every((e) => e.numeroExpediente?.colision === true)).toBe(true);
    // Las dos filas reales del duplicado (fila 38 = LA/revisado, fila 39 = LR/revisado).
    expect(plan.filasColision.map((f) => f.fila).sort()).toEqual([38, 39]);
  });

  it('las 6 filas con fecha vacía/irreconocible/imposible del snapshot real quedan en FECHA_INVALIDA (única cuarentena real)', () => {
    // 4 por formato (2 vacías en la hoja "CONSECUTIVO" fila 18/19, 1 vacía en
    // "2026" fila 4, 1 con typo "27/01/20206" en "2026" fila 3) + 2 por
    // fecha CALENDARIO IMPOSIBLE ("2023-11-31" — noviembre no tiene 31 días
    // — hoja "CONSECUTIVO" filas 87/88). Estas últimas 2 NO se detectan con
    // un regex de forma "\d{4}-\d{2}-\d{2}$" (que las clasificaría como
    // válidas): hallazgo de la guarda de validez calendario de
    // `parsearFechaHistoricaANoonISO` (`new Date(...)` "normaliza" en vez
    // de rechazar fechas imposibles — sin esa guarda, "2023-11-31" se
    // habría importado silenciosamente como "2023-12-01").
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);
    expect(plan.cuarentena).toHaveLength(6);
    expect(plan.cuarentena.map((c) => `${c.hoja}:${c.fila}`).sort()).toEqual(
      ['2026:3', '2026:4', 'CONSECUTIVO:18', 'CONSECUTIVO:19', 'CONSECUTIVO:87', 'CONSECUTIVO:88'].sort(),
    );
  });

  it('DF-10: los 196 planificados entran "histórico sin resolver" — estado propio del enum, marca pendiente, operativo ARCHIVADO', () => {
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);
    expect(plan.expedientes).toHaveLength(196);
    expect(plan.expedientes.every((e) => e.estadoJuridico === 'HISTORICO_SIN_RESOLVER')).toBe(true);
    expect(plan.expedientes.every((e) => e.estado === 'ARCHIVADO')).toBe(true);
    expect(plan.expedientes.every((e) => e.revisionHistorica?.pendiente === true)).toBe(true);
    expect(plan.expedientes.every((e) => e.fechaAlertaConservadora === null)).toBe(true); // R9 end-to-end
  });

  it('DF-10: 3 registros con código de "tipo" sin resolver (P1′) se importan con el texto crudo — hallazgo: no son solo los 2 que trajo el encargo', () => {
    // El encargo nombró "LCR VISR"/"LRC"; esta implementación encontró una
    // TERCERA variante de espaciado ("LR y  LC, A", doble espacio antes de
    // "LC") que tampoco normaliza al mismo texto que la fila sembrada
    // ("LR y LC,A") — mismo criterio general (código sin resolver → se
    // importa con el texto crudo), sin caso especial para esta variante.
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);
    expect(plan.subtiposSinResolver).toHaveLength(3);
    expect(plan.subtiposSinResolver).toEqual(expect.arrayContaining([
      expect.objectContaining({ radicado: '68745-0-24-0002', hoja: 'CONSECUTIVO', fila: 103, tipoOriginal: 'LCR VISR' }),
      expect.objectContaining({ radicado: '68745-0-24-0021', hoja: 'CONSECUTIVO', fila: 122, tipoOriginal: 'LRC' }),
      expect.objectContaining({ radicado: '68745-0-22-0044', hoja: 'CONSECUTIVO', fila: 48, tipoOriginal: 'LR y  LC, A' }),
    ]));
  });

  it('DF-10: pendientesHistorico — sinIdentidad/sinEstadoJuridico/sinActoFinal cuentan los 196 planificados', () => {
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);
    // El libro histórico NUNCA registró número de documento (ninguna versión) — los 196 planificados están sin cédula.
    expect(plan.pendientesHistorico.sinIdentidad).toBe(196);
    expect(plan.pendientesHistorico.sinEstadoJuridico).toBe(196);
    expect(plan.pendientesHistorico.sinActoFinal).toBe(196);
  });

  it('genera plan-importacion.generado.json + reporte-dry-run.generado.md (artefactos gitignored, para el ejecutor .mjs)', () => {
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);
    const reporte = generarReporteDryRun(plan);

    writeFileSync(RUTA_PLAN_GENERADO, JSON.stringify(plan, null, 2), 'utf8');
    writeFileSync(RUTA_REPORTE_GENERADO, reporte, 'utf8');

    const planRelefdo = JSON.parse(readFileSync(RUTA_PLAN_GENERADO, 'utf8'));
    expect(planRelefdo.reconciliacion.totalSnapshot).toBe(202);
    expect(planRelefdo.reconciliacion.planificados).toBe(196);

    expect(reporte).toContain('# Reporte dry-run');
    expect(reporte).toContain('Total en el snapshot: **202**');
    expect(reporte).toContain('Planificados (se importan): **196**');
  });

  it('el reporte es ESTABLE: misma entrada (mismo snapshot, mismo "ahora") produce el mismo texto byte a byte', () => {
    const planA = planificarImportacion(cargarSnapshotReal(), AHORA);
    const planB = planificarImportacion(cargarSnapshotReal(), AHORA);
    expect(generarReporteDryRun(planA)).toBe(generarReporteDryRun(planB));
  });

  it('el reporte desglosa correctamente los pendientes por completar y el subtipo sin resolver', () => {
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);
    const reporte = generarReporteDryRun(plan);
    expect(reporte).toMatch(/Sin cédula del solicitante: \*\*196\*\*/);
    expect(reporte).toMatch(/Sin estado jurídico verificable[^:]*: \*\*196\*\*/);
    expect(reporte).toMatch(/Sin acto final completo: \*\*196\*\*/);
    expect(reporte).toMatch(/Con subtipo sin resolver \(texto crudo, P1′\): \*\*3\*\*/);
  });

  it('datos de predio contra el .sanitizado.json (SIEMPRE, sin fallback): 0 en los 4 conteos y en los 3 motivos de descarte — el campo de origen no existe en ese archivo (doctrina PII, ver JSDoc de arriba)', () => {
    const snapSanitizado = JSON.parse(readFileSync(RUTA_SNAPSHOT_SANITIZADO, 'utf8')) as SnapshotConsecutivoLicencias;
    const plan = planificarImportacion(snapSanitizado, AHORA);
    expect(plan.datosPredio).toEqual({
      conDireccion: 0,
      conBarrioVereda: 0,
      conMatriculaInmobiliaria: 0,
      conAreaTexto: 0,
      descartes: { direccionEsMunicipio: 0, matriculaFormatoInvalido: 0, areaDesalineada: 0 },
      filasAreaDesalineada: [],
    });
  });

  it('datos de predio contra el snapshot REAL en uso (`.local.json` si existe, si no `.sanitizado.json`): conteos exactos verificados contra las 202 filas', () => {
    const plan = planificarImportacion(cargarSnapshotReal(), AHORA);
    if (RUTA_SNAPSHOT === RUTA_SNAPSHOT_LOCAL) {
      // Máquina del propietario: verificado manualmente contra las 202 filas
      // reales (ago-2026) — 54/202 traen "direccion" y las 54 valen
      // literalmente "SIMACOTA" (descartadas); 13/202 traen "barrioVereda";
      // 11/202 traen "matricula", todas con formato válido; 16/202 traen
      // "area", de las cuales 5 son áreas reconocibles y 11 están
      // desalineadas (veredas/direcciones coladas en la columna).
      expect(plan.datosPredio).toEqual({
        conDireccion: 0,
        conBarrioVereda: 13,
        conMatriculaInmobiliaria: 11,
        conAreaTexto: 5,
        descartes: { direccionEsMunicipio: 54, matriculaFormatoInvalido: 0, areaDesalineada: 11 },
        filasAreaDesalineada: expect.arrayContaining([
          expect.objectContaining({ radicado: '68745-0-25-0029', hoja: '2025', fila: 30, valorOriginal: 'EL CHANCE' }),
        ]) as unknown as typeof plan.datosPredio.filasAreaDesalineada,
      });
      expect(plan.datosPredio.filasAreaDesalineada).toHaveLength(11);
    } else {
      // CI / clon nuevo: mismo resultado que el test anterior, contra el
      // MISMO archivo que ya está usando el resto de la suite.
      expect(plan.datosPredio.conDireccion).toBe(0);
      expect(plan.datosPredio.conBarrioVereda).toBe(0);
      expect(plan.datosPredio.conMatriculaInmobiliaria).toBe(0);
      expect(plan.datosPredio.conAreaTexto).toBe(0);
    }
  });
});
