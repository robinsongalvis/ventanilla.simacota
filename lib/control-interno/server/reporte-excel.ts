/**
 * Generador del Reporte Excel Control Interno.
 *
 * Hojas:
 *   1. Resumen Ejecutivo (KPIs + semáforos)
 *   2. Alertas activas
 *   3. Riesgos por radicado
 *   4. Hallazgos
 *   5. Planes de Mejora
 *   6. Cumplimiento por Dependencia
 *   7. Diccionario de Datos
 */

import ExcelJS from 'exceljs';
import type {
  AlertaControlInterno,
  DesempenoDependencia,
  EvaluacionRiesgo,
  HallazgoControlInterno,
  KpiControlInterno,
  PlanMejora,
} from '@/src/types/control-interno';
import {
  LABEL_ESTADO_HALLAZGO,
  LABEL_ESTADO_PLAN,
  LABEL_NIVEL_RIESGO,
  LABEL_TIPO_ALERTA,
  LABEL_TIPO_HALLAZGO,
} from '@/src/types/control-interno';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';

const COLOR = {
  VERDE:        '0F5F35',
  VERDE_CLARO:  'DCFCE7',
  AMARILLO:     'FEF3C7',
  ROJO:         'FEE2E2',
  BLANCO:       'FFFFFF',
} as const;

export interface ReporteControlInternoInput {
  periodo:        { desde: string; hasta: string };
  kpis:           KpiControlInterno[];
  alertas:        AlertaControlInterno[];
  evaluaciones:   EvaluacionRiesgo[];
  hallazgos:      HallazgoControlInterno[];
  planes:         PlanMejora[];
  dependencias:   DesempenoDependencia[];
}

function aplicarEncabezado(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FF' + COLOR.BLANCO }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR.VERDE } };
  row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  row.height = 22;
  row.eachCell((c) => {
    c.border = {
      top:    { style: 'thin', color: { argb: 'FF' + COLOR.VERDE } },
      bottom: { style: 'thin', color: { argb: 'FF' + COLOR.VERDE } },
      left:   { style: 'thin', color: { argb: 'FF' + COLOR.VERDE } },
      right:  { style: 'thin', color: { argb: 'FF' + COLOR.VERDE } },
    };
  });
}

function ajustarAncho(ws: ExcelJS.Worksheet, anchos: number[]): void {
  ws.columns.forEach((col, i) => {
    col.width = anchos[i] ?? 18;
  });
}

function fillSemaforo(cell: ExcelJS.Cell, estado: 'VERDE' | 'AMARILLO' | 'ROJO'): void {
  const map = {
    VERDE:    { bg: COLOR.VERDE_CLARO, fg: '14532D' },
    AMARILLO: { bg: COLOR.AMARILLO,    fg: '92400E' },
    ROJO:     { bg: COLOR.ROJO,        fg: '991B1B' },
  } as const;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + map[estado].bg } };
  cell.font = { color: { argb: 'FF' + map[estado].fg }, bold: true };
}

export async function generarReporteExcelControlInterno(
  input: ReporteControlInternoInput,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ventanilla Única — Control Interno';
  wb.created = new Date();

  /* Hoja 1: Resumen Ejecutivo */
  const wsResumen = wb.addWorksheet('Resumen Ejecutivo');
  wsResumen.addRow(['Período', `${input.periodo.desde} a ${input.periodo.hasta}`]);
  wsResumen.addRow([]);
  const headerKpis = wsResumen.addRow(['Indicador', 'Valor', 'Semáforo', 'Acción sugerida', 'Descripción']);
  aplicarEncabezado(headerKpis);
  for (const k of input.kpis) {
    const r = wsResumen.addRow([k.label, k.valor, k.semaforo, k.accion ?? '—', k.descripcion]);
    fillSemaforo(r.getCell(3), k.semaforo);
  }
  ajustarAncho(wsResumen, [32, 14, 12, 50, 60]);

  /* Hoja 2: Alertas */
  const wsAlertas = wb.addWorksheet('Alertas');
  aplicarEncabezado(wsAlertas.addRow(['Tipo', 'Nivel', 'Radicado', 'Dependencia', 'Responsable', 'Motivo', 'Acción sugerida', 'Estado', 'Fecha']));
  for (const a of input.alertas) {
    wsAlertas.addRow([
      LABEL_TIPO_ALERTA[a.tipo],
      LABEL_NIVEL_RIESGO[a.nivel],
      a.radicadoId ?? '—',
      a.tenantId ? NOMBRES_TENANT[a.tenantId] ?? a.tenantId : '—',
      a.responsableNombre ?? '—',
      a.motivo,
      a.accionSugerida,
      a.estado,
      a.fecha,
    ]);
  }
  ajustarAncho(wsAlertas, [28, 12, 16, 30, 26, 50, 50, 14, 22]);

  /* Hoja 3: Riesgos por radicado */
  const wsRiesgos = wb.addWorksheet('Riesgos');
  aplicarEncabezado(wsRiesgos.addRow(['Radicado', 'Nivel', 'Puntaje', 'Motivos', 'Acción sugerida']));
  for (const e of input.evaluaciones) {
    wsRiesgos.addRow([e.radicadoId, LABEL_NIVEL_RIESGO[e.nivel], e.puntaje, e.motivos.join(', '), e.accion]);
  }
  ajustarAncho(wsRiesgos, [16, 12, 10, 60, 50]);

  /* Hoja 4: Hallazgos */
  const wsHallazgos = wb.addWorksheet('Hallazgos');
  aplicarEncabezado(wsHallazgos.addRow(['ID', 'Radicado', 'Dependencia', 'Tipo', 'Nivel', 'Descripción', 'Estado', 'Creado por', 'Fecha', 'Plan asociado']));
  for (const h of input.hallazgos) {
    wsHallazgos.addRow([
      h.id ?? '—',
      h.radicadoId ?? '—',
      NOMBRES_TENANT[h.tenantId] ?? h.tenantId,
      LABEL_TIPO_HALLAZGO[h.tipo],
      LABEL_NIVEL_RIESGO[h.nivel],
      h.descripcion,
      LABEL_ESTADO_HALLAZGO[h.estado],
      h.creadoPor?.nombre ?? '—',
      h.fecha,
      h.planMejoraId ?? '—',
    ]);
  }
  ajustarAncho(wsHallazgos, [16, 16, 30, 28, 12, 60, 14, 24, 22, 16]);

  /* Hoja 5: Planes */
  const wsPlanes = wb.addWorksheet('Planes de Mejora');
  aplicarEncabezado(wsPlanes.addRow(['ID', 'Hallazgo', 'Dependencia', 'Acción correctiva', 'Responsable', 'Compromiso', 'Estado', 'Avances', 'Creado']));
  for (const p of input.planes) {
    wsPlanes.addRow([
      p.id ?? '—',
      p.hallazgoId,
      NOMBRES_TENANT[p.tenantId] ?? p.tenantId,
      p.accionCorrectiva,
      p.responsableNombre,
      p.fechaCompromiso,
      LABEL_ESTADO_PLAN[p.estado],
      p.avances?.length ?? 0,
      p.fechaCreacion,
    ]);
  }
  ajustarAncho(wsPlanes, [16, 16, 30, 50, 24, 14, 14, 10, 22]);

  /* Hoja 6: Cumplimiento por Dependencia */
  const wsDep = wb.addWorksheet('Cumplimiento por Dependencia');
  aplicarEncabezado(wsDep.addRow(['Dependencia', 'Total', 'Resueltos', 'Vencidos', 'Por vencer', 'Cumplimiento %', 'Días prom. resp.', 'Sin responsable', 'Hallazgos abiertos', 'Planes abiertos', 'Notif. fallidas', 'Riesgo']));
  for (const d of input.dependencias) {
    wsDep.addRow([
      d.nombre,
      d.total,
      d.resueltos,
      d.vencidos,
      d.porVencer,
      d.cumplimientoPct,
      d.promedioDiasRespuesta ?? '—',
      d.sinResponsable,
      d.hallazgosAbiertos,
      d.planesMejoraAbiertos,
      d.notificacionesFallidas,
      LABEL_NIVEL_RIESGO[d.nivelRiesgo],
    ]);
  }
  ajustarAncho(wsDep, [32, 8, 10, 10, 12, 14, 14, 14, 16, 14, 14, 12]);

  /* Hoja 7: Diccionario */
  const wsDic = wb.addWorksheet('Diccionario de Datos');
  aplicarEncabezado(wsDic.addRow(['Campo', 'Descripción']));
  const diccionario: [string, string][] = [
    ['Cumplimiento %', 'Resueltos a tiempo / total resueltos × 100'],
    ['Nivel de riesgo', 'BAJO / MEDIO / ALTO / CRITICO, derivado del motor de riesgos'],
    ['Semáforo', 'VERDE = bueno; AMARILLO = atención; ROJO = crítico'],
    ['Por vencer', 'Activos cuyo vencimiento legal está a 2 días hábiles o menos'],
    ['Vencido', 'Activo con días restantes < 0 según calendario hábil'],
    ['Notif. fallidas', 'Correos institucionales con error de entrega no gestionados'],
    ['Hallazgo', 'Registro de incumplimiento o irregularidad creado por Control Interno'],
    ['Plan de mejora', 'Acción correctiva solicitada a la dependencia responsable'],
  ];
  for (const fila of diccionario) wsDic.addRow(fila);
  ajustarAncho(wsDic, [28, 80]);

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}
