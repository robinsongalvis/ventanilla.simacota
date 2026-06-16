import ExcelJS from 'exceljs';
import type { VentanillaRadicado, TrazabilidadRadicado } from '@/src/types/ventanilla';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { getTipoSolicitudById } from '@/lib/catalogos/tipos-solicitud';
import {
  debeOcultarIdentidad,
  nombreOficioPublico,
  radicadosVisiblesParaRol,
  responsableVisible,
  solicitanteVisible,
  type UsuarioReporte,
} from './sanitizar';
import {
  calcularCumplimientoPorDependencia,
  calcularIndicadoresMipg,
  extraerNotificaciones,
  type IndicadoresMipg,
} from './indicadores';
import { estadoTerminoServer } from './estado-termino';

/* ══════════════════════════════════════════════════════════════
   Helper defensivo: lee strings con fallback. Evita que un
   `undefined` o `null` rompa la generación del libro.
══════════════════════════════════════════════════════════════ */
function s(v: unknown, fallback = '—'): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v.trim().length > 0 ? v : fallback;
  return String(v);
}

function nombreDependencia(tenantId: unknown): string {
  if (typeof tenantId !== 'string') return '—';
  return NOMBRES_TENANT[tenantId as keyof typeof NOMBRES_TENANT] ?? tenantId;
}

/* ══════════════════════════════════════════════════════════════
   Composer del Reporte Excel MIPG institucional.

   Compone un libro .xlsx con 8 hojas: Resumen Ejecutivo,
   Indicadores MIPG, Radicados, Trazabilidad, Cumplimiento por
   Dependencia, Notificaciones, SIMI y Diccionario de Datos.

   Aplica formato institucional: encabezados verdes con texto blanco,
   filtros automáticos, freeze panes, ancho de columnas, wrap text en
   columnas largas. Respeta privacidad de anónimos/reservados y filtra
   datos por rol del usuario que solicita el reporte.

   Returns un `Buffer` listo para devolver desde un endpoint Next.js.
══════════════════════════════════════════════════════════════ */

/* Paleta institucional (sin '#') */
const COLOR = {
  VERDE_INST:     '0F5F35',
  VERDE_CLARO:    'DCFCE7',
  AMARILLO:       'FEF3C7',
  ROJO:           'FEE2E2',
  AZUL_INFO:      'E0F2FE',
  GRIS_NEUTRO:    'F8FAFC',
  BLANCO:         'FFFFFF',
  TEXTO_OSCURO:   '1F2933',
  BORDE_SUAVE:    'D9E2D9',
} as const;

export interface SimiAuditoriaRecord {
  radicadoId?:                 string;
  actorNombre?:                string;
  actorRol?:                   string;
  tenantId?:                   string;
  dependenciaRadicado?:        string;
  accion?:                     string;
  fecha?:                      string;
  resumenEntrada?:             string;
  resumenSalida?:              string;
  evaluacionCompetenciaNivel?: string;
  error?:                      string;
}

export interface SimiFeedbackRecord {
  radicadoId?: string;
  accion?:     string;
  util?:       boolean;
  motivo?:     string;
  fecha?:      string;
}

export interface ReporteExcelInput {
  usuario:                   UsuarioReporte;
  radicados:                 VentanillaRadicado[];
  trazabilidadPorRadicado:   Map<string, TrazabilidadRadicado[]>;
  simiAuditoria:             SimiAuditoriaRecord[];
  simiFeedback:              SimiFeedbackRecord[];
  rangoFechas?:              { desde?: string; hasta?: string };
  /**
   * Sprint 2 — Búsqueda histórica avanzada.
   * Cuando viene definido, el resumen ejecutivo indica los filtros activos.
   */
  filtrosAplicados?:         Record<string, unknown>;
}

/* ── helpers de estilo ─────────────────────────────────────── */
function aplicarEstiloEncabezado(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FF' + COLOR.BLANCO }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR.VERDE_INST } };
  row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  row.height = 22;
  row.eachCell((cell) => {
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF' + COLOR.VERDE_INST } },
      bottom: { style: 'thin', color: { argb: 'FF' + COLOR.VERDE_INST } },
      left:   { style: 'thin', color: { argb: 'FF' + COLOR.VERDE_INST } },
      right:  { style: 'thin', color: { argb: 'FF' + COLOR.VERDE_INST } },
    };
  });
}

function aplicarBordeFila(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.border = {
      top:    { style: 'hair', color: { argb: 'FF' + COLOR.BORDE_SUAVE } },
      bottom: { style: 'hair', color: { argb: 'FF' + COLOR.BORDE_SUAVE } },
      left:   { style: 'hair', color: { argb: 'FF' + COLOR.BORDE_SUAVE } },
      right:  { style: 'hair', color: { argb: 'FF' + COLOR.BORDE_SUAVE } },
    };
  });
}

function ajustarAncho(ws: ExcelJS.Worksheet, anchosMin: number[]) {
  ws.columns.forEach((col, i) => {
    let max = anchosMin[i] ?? 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      // primera línea solamente para anchos
      const firstLine = s.split('\n')[0];
      if (firstLine.length > max) max = firstLine.length;
    });
    col.width = Math.min(max + 2, 60);
  });
}

function pintarEstado(cell: ExcelJS.Cell, estado: 'BUENO' | 'ATENCION' | 'CRITICO' | 'INFO' | 'NEUTRAL') {
  const map: Record<typeof estado, { bg: string; fg: string }> = {
    BUENO:    { bg: COLOR.VERDE_CLARO, fg: '14532D' },
    ATENCION: { bg: COLOR.AMARILLO,    fg: '92400E' },
    CRITICO:  { bg: COLOR.ROJO,        fg: '991B1B' },
    INFO:     { bg: COLOR.AZUL_INFO,   fg: '1E40AF' },
    NEUTRAL:  { bg: COLOR.GRIS_NEUTRO, fg: '475569' },
  };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + map[estado].bg } };
  cell.font = { color: { argb: 'FF' + map[estado].fg }, bold: true };
}

/* ══════════════════════════════════════════════════════════════
   Composer principal
══════════════════════════════════════════════════════════════ */

export async function generarReporteExcelMipg(input: ReporteExcelInput): Promise<Buffer> {
  const { usuario, trazabilidadPorRadicado, simiAuditoria, simiFeedback, rangoFechas, filtrosAplicados } = input;

  // Filtro por rol
  const radicados = radicadosVisiblesParaRol(input.radicados, usuario);

  const wb = new ExcelJS.Workbook();
  wb.creator = `${usuario.nombre} (${usuario.rol})`;
  wb.created = new Date();
  wb.lastModifiedBy = wb.creator;
  wb.title = 'Reporte MIPG — Alcaldía Municipal de Simacota';

  const indicadores = calcularIndicadoresMipg(radicados);
  const cumplimiento = calcularCumplimientoPorDependencia(radicados);
  const notificaciones = extraerNotificaciones(trazabilidadPorRadicado);

  // El orden importa: las hojas aparecen en este orden en Excel.
  construirResumenEjecutivo(wb, usuario, indicadores, radicados.length, rangoFechas, filtrosAplicados);
  construirIndicadoresMipg(wb, indicadores);
  construirRadicados(wb, radicados, trazabilidadPorRadicado);
  construirTrazabilidad(wb, trazabilidadPorRadicado);
  construirCumplimientoDependencia(wb, cumplimiento);
  construirNotificaciones(wb, notificaciones);
  construirSimi(wb, simiAuditoria, simiFeedback);
  construirDiccionario(wb);

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

/* ── Hoja 1: Resumen Ejecutivo ────────────────────────────── */
const ETIQUETAS_FILTROS: Record<string, string> = {
  q: 'Búsqueda rápida',
  radicadoId: 'Radicado',
  nombre: 'Solicitante',
  documento: 'Documento',
  correo: 'Correo',
  asunto: 'Asunto',
  tipoSolicitudId: 'Tipo solicitud',
  categoria: 'Categoría',
  dependencia: 'Dependencia',
  responsable: 'Responsable',
  estado: 'Estado',
  fechaDesde: 'Fecha desde',
  fechaHasta: 'Fecha hasta',
  mes: 'Mes',
  anio: 'Año',
  canalRespuesta: 'Canal de respuesta',
  anonimo: 'Anónimo',
  reservado: 'Reservado',
  cumplioTermino: 'Cumplió término',
  conNotificacionFallida: 'Con notificación fallida',
  conRespuestaOficial: 'Con respuesta oficial',
};

function describirFiltro(clave: string, valor: unknown): string {
  if (clave === 'dependencia' && typeof valor === 'string') {
    return NOMBRES_TENANT[valor as keyof typeof NOMBRES_TENANT] ?? valor;
  }
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor ?? '');
}

function construirResumenEjecutivo(
  wb: ExcelJS.Workbook,
  usuario: UsuarioReporte,
  ind: IndicadoresMipg,
  totalVisibles: number,
  rangoFechas?: { desde?: string; hasta?: string },
  filtrosAplicados?: Record<string, unknown>,
) {
  const ws = wb.addWorksheet('Resumen Ejecutivo', { properties: { tabColor: { argb: 'FF' + COLOR.VERDE_INST } } });
  ws.columns = [{ width: 40 }, { width: 50 }];

  // Encabezado tipo informe
  ws.mergeCells('A1:B1');
  const titulo = ws.getCell('A1');
  titulo.value = 'Alcaldía Municipal de Simacota — Reporte MIPG';
  titulo.font = { bold: true, size: 16, color: { argb: 'FF' + COLOR.VERDE_INST } };
  titulo.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 32;

  ws.mergeCells('A2:B2');
  ws.getCell('A2').value = 'Ventanilla Única Digital';
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };

  const meta: [string, string][] = [
    ['Fecha de generación', new Date().toLocaleString('es-CO', { hour12: false })],
    ['Generado por',        usuario.nombre],
    ['Rol del usuario',     usuario.rol],
    ['Tenant',              usuario.tenantId],
    ['Rango de fechas',     rangoFechas?.desde || rangoFechas?.hasta
      ? `${rangoFechas?.desde ?? '—'} a ${rangoFechas?.hasta ?? '—'}`
      : 'Sin filtro de fechas (todos los disponibles para el rol)'],
    ['Radicados visibles',  String(totalVisibles)],
  ];
  ws.addRow([]);
  meta.forEach(([k, v]) => {
    const row = ws.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  });

  // Indicadores principales
  ws.addRow([]);
  const header = ws.addRow(['Indicador principal', 'Valor']);
  aplicarEstiloEncabezado(header);
  const filas: [string, string | number][] = [
    ['Total de radicados',              ind.totalRadicados],
    ['Pendientes',                      ind.pendientes],
    ['En trámite',                      ind.enTramite],
    ['Resueltos',                       ind.resueltos],
    ['Resueltos en término',            ind.resueltosEnTermino],
    ['Resueltos fuera de término',      ind.resueltosFueraDeTermino],
    ['Por vencer (≤ 2 días hábiles)',   ind.porVencer],
    ['Vencidos',                        ind.vencidos],
    ['Tasa de resolución (%)',          `${ind.tasaResolucionPct}%`],
    ['Cumplimiento de términos (%)',    ind.cumplimientoTerminosPct === null ? 'Sin datos' : `${ind.cumplimientoTerminosPct}%`],
    ['Promedio días de respuesta',      ind.promedioDiasRespuesta === null ? 'Sin datos' : ind.promedioDiasRespuesta],
    ['Radicados sin responsable',       ind.sinResponsable],
    ['Notificaciones fallidas',         ind.notificacionesFallidas],
    ['Anónimos / Reservados',           ind.anonimosOReservados],
  ];
  filas.forEach(([k, v]) => {
    const row = ws.addRow([k, v]);
    aplicarBordeFila(row);
  });

  // Sprint 2 — Filtros aplicados
  if (filtrosAplicados) {
    const entradas = Object.entries(filtrosAplicados).filter(
      ([, v]) => v !== '' && v !== null && v !== undefined,
    );
    if (entradas.length > 0) {
      ws.addRow([]);
      const headerFiltros = ws.addRow(['Filtros aplicados', '']);
      aplicarEstiloEncabezado(headerFiltros);
      for (const [k, v] of entradas) {
        const etiqueta = ETIQUETAS_FILTROS[k] ?? k;
        const row = ws.addRow([etiqueta, describirFiltro(k, v)]);
        row.getCell(1).font = { bold: true };
        aplicarBordeFila(row);
      }
    }
  }

  // Conclusión automática
  ws.addRow([]);
  const concRow = ws.addRow([
    'Conclusión automática',
    `El sistema registra ${ind.totalRadicados} radicados visibles para el rol ${usuario.rol}, con una tasa de resolución de ${ind.tasaResolucionPct}% y un cumplimiento de términos de ${ind.cumplimientoTerminosPct === null ? 'sin datos' : ind.cumplimientoTerminosPct + '%'}.`,
  ]);
  concRow.getCell(1).font = { bold: true };
  concRow.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  concRow.height = 48;

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
}

/* ── Hoja 2: Indicadores MIPG ─────────────────────────────── */
function construirIndicadoresMipg(wb: ExcelJS.Workbook, ind: IndicadoresMipg) {
  const ws = wb.addWorksheet('Indicadores MIPG');
  ws.columns = [
    { header: 'Indicador',      key: 'indicador',      width: 38 },
    { header: 'Valor',          key: 'valor',          width: 14 },
    { header: 'Fórmula',        key: 'formula',        width: 38 },
    { header: 'Interpretación', key: 'interpretacion', width: 40 },
    { header: 'Estado',         key: 'estado',         width: 14 },
  ];
  aplicarEstiloEncabezado(ws.getRow(1));

  const tasa = ind.tasaResolucionPct;
  const cum  = ind.cumplimientoTerminosPct;

  const filas: Array<{
    indicador: string; valor: string | number; formula: string; interpretacion: string;
    estado: 'BUENO' | 'ATENCION' | 'CRITICO' | 'INFO' | 'NEUTRAL';
  }> = [
    { indicador: 'Total de radicados',          valor: ind.totalRadicados, formula: 'count(radicados)', interpretacion: 'Volumen total visible al rol.', estado: 'INFO' },
    { indicador: 'Tasa de resolución (%)',      valor: tasa, formula: '(resueltos / total) × 100', interpretacion: tasa >= 80 ? 'Muy buen ritmo de resolución.' : tasa >= 60 ? 'Ritmo aceptable; revisar pendientes.' : 'Resolución baja; priorizar pendientes.', estado: tasa >= 80 ? 'BUENO' : tasa >= 60 ? 'ATENCION' : 'CRITICO' },
    { indicador: 'Cumplimiento términos (%)',   valor: cum === null ? 'Sin datos' : cum, formula: '(resueltos_en_término / resueltos_con_dato) × 100', interpretacion: cum === null ? 'Aún no hay resoluciones con dato.' : cum >= 80 ? 'Cumplimiento alto.' : cum >= 60 ? 'Cumplimiento medio.' : 'Cumplimiento bajo; riesgo MIPG.', estado: cum === null ? 'NEUTRAL' : cum >= 80 ? 'BUENO' : cum >= 60 ? 'ATENCION' : 'CRITICO' },
    { indicador: 'Resueltos en término',        valor: ind.resueltosEnTermino, formula: 'count(cumplioTermino == true)', interpretacion: 'Casos respondidos dentro del plazo legal.', estado: 'BUENO' },
    { indicador: 'Resueltos fuera de término',  valor: ind.resueltosFueraDeTermino, formula: 'count(cumplioTermino == false)', interpretacion: 'Atención: respondidos por fuera del plazo.', estado: ind.resueltosFueraDeTermino === 0 ? 'BUENO' : 'CRITICO' },
    { indicador: 'Por vencer (≤ 2 días)',       valor: ind.porVencer, formula: 'count(diasRestantes ≤ 2 && diasRestantes ≥ 0)', interpretacion: 'Casos próximos al vencimiento.', estado: ind.porVencer === 0 ? 'BUENO' : 'ATENCION' },
    { indicador: 'Vencidos',                    valor: ind.vencidos, formula: 'count(diasRestantes < 0 && estado activo)', interpretacion: 'Casos vencidos sin respuesta.', estado: ind.vencidos === 0 ? 'BUENO' : 'CRITICO' },
    { indicador: 'Promedio días de respuesta',  valor: ind.promedioDiasRespuesta === null ? 'Sin datos' : ind.promedioDiasRespuesta, formula: 'avg(fechaRespuesta − fechaRadicación)', interpretacion: 'Tiempo medio de gestión.', estado: 'INFO' },
    { indicador: 'Radicados sin responsable',   valor: ind.sinResponsable, formula: 'count(activo && !funcionarioResponsable)', interpretacion: 'Falta asignación de responsable funcional.', estado: ind.sinResponsable === 0 ? 'BUENO' : 'ATENCION' },
    { indicador: 'Notificaciones fallidas',     valor: ind.notificacionesFallidas, formula: 'count(alertaNotificacionFallida == true)', interpretacion: 'Correos al ciudadano no entregados; gestionar por canal alterno.', estado: ind.notificacionesFallidas === 0 ? 'BUENO' : 'ATENCION' },
    { indicador: 'Anónimos / Reservados',       valor: ind.anonimosOReservados, formula: 'count(esAnonimo || tipoPresentacion ∈ {ANONIMA, RESERVADA})', interpretacion: 'Casos con identidad protegida.', estado: 'INFO' },
  ];

  for (const f of filas) {
    const row = ws.addRow(f);
    aplicarBordeFila(row);
    pintarEstado(row.getCell('estado'), f.estado);
    row.getCell('estado').value = f.estado;
    row.getCell('interpretacion').alignment = { wrapText: true, vertical: 'top' };
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/* ── Hoja 3: Radicados ────────────────────────────────────── */
function construirRadicados(
  wb: ExcelJS.Workbook,
  radicados: VentanillaRadicado[],
  trazabilidadPorRadicadoLookup?: Map<string, TrazabilidadRadicado[]>,
) {
  const ws = wb.addWorksheet('Radicados');
  ws.columns = [
    { header: 'N° Radicado',                key: 'radicadoId',         width: 28 },
    { header: 'Fecha Radicación',           key: 'fechaRadicacion',    width: 22 },
    { header: 'Hora Radicación',            key: 'horaRadicacion',     width: 12 },
    { header: 'Medio Recepción',            key: 'medio',              width: 14 },
    { header: 'Solicitante',                key: 'solicitante',        width: 28 },
    { header: 'Documento',                  key: 'documento',          width: 16 },
    { header: 'Tipo Solicitud',             key: 'tipoSolicitud',      width: 22 },
    { header: 'Tipo Solicitud ID',          key: 'tipoSolicitudId',    width: 24 },
    { header: 'Categoría Solicitud',        key: 'categoriaSolicitud', width: 14 },
    { header: 'Término Días',               key: 'terminoDias',        width: 12 },
    { header: 'Tipo Días',                  key: 'tipoDias',           width: 12 },
    { header: 'Requiere Validación Jurídica', key: 'reqValidJuridica', width: 16 },
    { header: 'Heredado Sistema Actual',    key: 'heredado',           width: 16 },
    { header: 'Tipo Reclasificado',         key: 'tipoReclasificado',  width: 16 },
    { header: 'Tipo Original',              key: 'tipoOriginal',       width: 24 },
    { header: 'Forma Presentación PQRSD',   key: 'tipoPresentacion',   width: 18 },
    { header: 'Solicitud Anónima',          key: 'esAnonimo',          width: 12 },
    { header: 'Identidad Reservada',        key: 'reservada',          width: 14 },
    { header: 'Canal Respuesta',            key: 'canalRespuesta',     width: 16 },
    { header: 'Dependencia Asignada',       key: 'dependencia',        width: 30 },
    { header: 'Responsable Nombre',         key: 'respNombre',         width: 26 },
    { header: 'Responsable Email',          key: 'respEmail',          width: 28 },
    { header: 'Responsable Rol',            key: 'respRol',            width: 18 },
    { header: 'Estado',                     key: 'estado',             width: 14 },
    { header: 'Fecha Límite',               key: 'fechaLimite',        width: 22 },
    { header: 'Días Restantes',             key: 'diasRestantes',      width: 14 },
    { header: 'Estado Término',             key: 'estadoTermino',      width: 14 },
    { header: 'Fecha Respuesta',            key: 'fechaResp',          width: 22 },
    { header: 'Cumplió Término',            key: 'cumplio',            width: 18 },
    { header: 'Tiene Anexos',               key: 'tieneAnexos',        width: 12 },
    { header: 'Tiene Respuesta Oficial',    key: 'tieneRespuesta',     width: 20 },
    { header: 'Tiene Notificación Fallida', key: 'notifFallida',       width: 22 },
  ];
  aplicarEstiloEncabezado(ws.getRow(1));

  for (const r of radicados) {
    // Cada radicado se procesa con defensas: si un campo viene undefined
    // (radicado legacy o documento parcial) se sustituye por '—' / 'No
    // registrado' antes de pasarlo a ExcelJS.
    try {
      const sv  = solicitanteVisible(r);
      const rv  = responsableVisible(r);
      const sem = estadoTerminoServer(r);
      const cumplio = r.cumplioTermino === true ? 'Sí — en término'
                    : r.cumplioTermino === false ? 'No — fuera de término'
                    : 'Pendiente';
      const archivosCount = Array.isArray(r.archivos) ? r.archivos.length : 0;
      const tipoIdRaw = r.termino?.tipoSolicitudId ?? '';
      const definicionTipo = getTipoSolicitudById(tipoIdRaw);
      const tipoOriginalAud = (() => {
        if (!trazabilidadPorRadicadoLookup) return '';
        const eventos = trazabilidadPorRadicadoLookup.get(r.radicadoId) ?? [];
        const ultimaReclasif = [...eventos]
          .reverse()
          .find((ev) => ev.accion === 'TIPO_SOLICITUD_RECLASIFICADO');
        if (!ultimaReclasif) return '';
        const meta = ultimaReclasif.metadata as Record<string, unknown> | undefined;
        const original = meta?.tipoAnteriorNombre;
        return typeof original === 'string' ? original : '';
      })();
      const row = ws.addRow({
        radicadoId:       s(r.radicadoId),
        fechaRadicacion:  s(r.control?.fechaRadicado, 'No registrada'),
        horaRadicacion:   s(r.control?.horaRadicado, '—'),
        medio:            s(r.control?.medioRecepcion, '—'),
        solicitante:      sv.nombre,
        documento:        sv.documento,
        tipoSolicitud:    s(r.termino?.tipoSolicitudNombre, '—'),
        tipoSolicitudId:  s(tipoIdRaw, '—'),
        categoriaSolicitud: definicionTipo?.categoria ?? '—',
        terminoDias:      r.termino?.diasRespuesta ?? '—',
        tipoDias:         s(r.termino?.unidad, '—'),
        reqValidJuridica: definicionTipo?.requiereValidacionJuridica ? 'Sí' : 'No',
        heredado:         definicionTipo?.heredadoSistemaActual ? 'Sí' : 'No',
        tipoReclasificado: tipoOriginalAud ? 'Sí' : 'No',
        tipoOriginal:     tipoOriginalAud || '—',
        tipoPresentacion: s(r.tipoPresentacion ?? (r.esAnonimo ? 'ANONIMA' : 'IDENTIFICADA')),
        esAnonimo:        r.esAnonimo ? 'Sí' : 'No',
        reservada:        debeOcultarIdentidad(r) && !r.esAnonimo ? 'Sí' : (r.identidadReservada ? 'Sí' : 'No'),
        canalRespuesta:   s(r.canalRespuesta, 'No registrado'),
        dependencia:      nombreDependencia(r.clasificacion?.oficinaDestino),
        respNombre:       rv.nombre,
        respEmail:        rv.email,
        respRol:          rv.rol,
        estado:           s(r.estadoActual),
        fechaLimite:      s(r.termino?.fechaVencimiento, 'No registrada'),
        diasRestantes:    sem.diasRestantes,
        estadoTermino:    sem.estado,
        fechaResp:        s(r.respuestaOficial?.fecha),
        cumplio,
        tieneAnexos:      archivosCount > 0 ? `Sí (${archivosCount})` : 'No',
        tieneRespuesta:   r.respuestaOficial?.nota ? `Sí${r.respuestaOficial.archivoNombre ? ' + oficio' : ''}` : 'No',
        notifFallida:     r.alertaNotificacionFallida === true ? 'Sí — sin gestionar' : 'No',
      });
      aplicarBordeFila(row);
      // Colorea fila por estado de término
      const estadoCell = row.getCell('estadoTermino');
      if (sem.estado === 'VENCIDO')        pintarEstado(estadoCell, 'CRITICO');
      else if (sem.estado === 'POR_VENCER') pintarEstado(estadoCell, 'ATENCION');
      else if (sem.estado === 'RESUELTO')   pintarEstado(estadoCell, 'BUENO');
      else                                  pintarEstado(estadoCell, 'INFO');
      if (r.alertaNotificacionFallida === true) {
        pintarEstado(row.getCell('notifFallida'), 'CRITICO');
      }
      // Aviso visible cuando es anónimo o el oficio existe
      if (debeOcultarIdentidad(r)) {
        row.getCell('solicitante').font = { italic: true, color: { argb: 'FF475569' } };
      }
      void nombreOficioPublico(r);
    } catch (err) {
      // No abortar todo el reporte por una fila corrupta.
      console.error('[MIPG_EXCEL_ERROR] fila omitida', {
        radicadoId: r?.radicadoId ?? '?',
        mensaje: err instanceof Error ? err.message : String(err),
      });
      ws.addRow({
        radicadoId:       s(r?.radicadoId, '?'),
        fechaRadicacion:  'Error al procesar — registro omitido',
      });
    }
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
}

/* ── Hoja 4: Trazabilidad ─────────────────────────────────── */
function construirTrazabilidad(
  wb: ExcelJS.Workbook,
  trazabilidadPorRadicado: Map<string, TrazabilidadRadicado[]>,
) {
  const ws = wb.addWorksheet('Trazabilidad');
  ws.columns = [
    { header: 'N° Radicado',       key: 'radicadoId',  width: 28 },
    { header: 'Fecha Evento',      key: 'fecha',       width: 14 },
    { header: 'Hora Evento',       key: 'hora',        width: 10 },
    { header: 'Acción',            key: 'accion',      width: 32 },
    { header: 'Actor',             key: 'actor',       width: 26 },
    { header: 'Oficina Origen',    key: 'oficinaOrig', width: 22 },
    { header: 'Oficina Destino',   key: 'oficinaDest', width: 22 },
    { header: 'Descripción',       key: 'nota',        width: 60 },
    { header: 'Metadata Resumida', key: 'metadata',    width: 40 },
  ];
  aplicarEstiloEncabezado(ws.getRow(1));

  if (trazabilidadPorRadicado.size === 0) {
    const row = ws.addRow({ radicadoId: 'Ver subcolección trazabilidad en Firebase' });
    aplicarBordeFila(row);
  } else {
    for (const [radicadoId, eventos] of trazabilidadPorRadicado.entries()) {
      const ordenados = [...eventos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      for (const ev of ordenados) {
        const [fecha, horaRaw] = String(ev.fecha).split('T');
        const md = ev.metadata as Record<string, unknown> | undefined;
        const mdResumen = md
          ? Object.entries(md)
              .filter(([k]) => k !== 'error' && k !== 'destinatario')
              .slice(0, 6)
              .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
              .join(' · ')
          : '';
        const row = ws.addRow({
          radicadoId,
          fecha,
          hora:      (horaRaw ?? '').slice(0, 8),
          accion:    String(ev.accion),
          actor:     ev.actorNombre ?? 'Sistema',
          oficinaOrig: ev.oficinaOrigen ?? '—',
          oficinaDest: ev.oficinaDestino ?? '—',
          nota:      ev.nota ?? '',
          metadata:  mdResumen,
        });
        aplicarBordeFila(row);
        row.getCell('nota').alignment = { wrapText: true, vertical: 'top' };
        row.getCell('metadata').alignment = { wrapText: true, vertical: 'top' };
      }
    }
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
}

/* ── Hoja 5: Cumplimiento por Dependencia ─────────────────── */
function construirCumplimientoDependencia(
  wb: ExcelJS.Workbook,
  filas: ReturnType<typeof calcularCumplimientoPorDependencia>,
) {
  const ws = wb.addWorksheet('Cumplimiento Dependencia');
  ws.columns = [
    { header: 'Dependencia',                key: 'dep',          width: 36 },
    { header: 'Total Radicados',            key: 'total',        width: 16 },
    { header: 'En trámite',                 key: 'asignados',    width: 12 },
    { header: 'Resueltos',                  key: 'resueltos',    width: 12 },
    { header: 'Pendientes',                 key: 'pendientes',   width: 12 },
    { header: 'Por Vencer',                 key: 'porVencer',    width: 12 },
    { header: 'Vencidos',                   key: 'vencidos',     width: 12 },
    { header: 'Resueltos en Término',       key: 'enTermino',    width: 18 },
    { header: 'Resueltos Fuera de Término', key: 'fuera',        width: 20 },
    { header: 'Cumplimiento (%)',           key: 'cumpl',        width: 16 },
    { header: 'Estado',                     key: 'estado',       width: 12 },
  ];
  aplicarEstiloEncabezado(ws.getRow(1));

  for (const f of filas) {
    const row = ws.addRow({
      dep:        NOMBRES_TENANT[f.tenantId as keyof typeof NOMBRES_TENANT] ?? f.tenantId,
      total:      f.total,
      asignados:  f.asignados,
      resueltos:  f.resueltos,
      pendientes: f.pendientes,
      porVencer:  f.porVencer,
      vencidos:   f.vencidos,
      enTermino:  f.resueltosEnTermino,
      fuera:      f.resueltosFueraDeTermino,
      cumpl:      f.cumplimientoPct === null ? '—' : f.cumplimientoPct,
      estado:     f.cumplimientoPct === null
                    ? 'NEUTRAL'
                    : f.cumplimientoPct >= 80 ? 'BUENO' : f.cumplimientoPct >= 60 ? 'ATENCION' : 'CRITICO',
    });
    aplicarBordeFila(row);
    const cell = row.getCell('estado');
    pintarEstado(cell, cell.value as 'BUENO' | 'ATENCION' | 'CRITICO' | 'NEUTRAL');
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
}

/* ── Hoja 6: Notificaciones ──────────────────────────────── */
function construirNotificaciones(
  wb: ExcelJS.Workbook,
  notificaciones: ReturnType<typeof extraerNotificaciones>,
) {
  const ws = wb.addWorksheet('Notificaciones');
  ws.columns = [
    { header: 'N° Radicado',           key: 'radicadoId',   width: 28 },
    { header: 'Tipo Notificación',     key: 'tipo',         width: 18 },
    { header: 'Destinatario',          key: 'destinatario', width: 32 },
    { header: 'Canal',                 key: 'canal',        width: 10 },
    { header: 'Estado',                key: 'estado',       width: 14 },
    { header: 'Fecha',                 key: 'fecha',        width: 24 },
    { header: 'Error',                 key: 'error',        width: 40 },
    { header: 'Gestionada Manualmente',key: 'gestionada',   width: 22 },
    { header: 'Motivo Gestión Manual', key: 'motivoGestion',width: 40 },
  ];
  aplicarEstiloEncabezado(ws.getRow(1));

  for (const n of notificaciones) {
    const row = ws.addRow({
      radicadoId:    n.radicadoId,
      tipo:          n.tipoNotificacion,
      destinatario:  n.destinatario,
      canal:         n.canal,
      estado:        n.estado,
      fecha:         n.fecha,
      error:         n.error ?? '',
      gestionada:    n.gestionadaManualmente ? 'Sí' : 'No',
      motivoGestion: n.motivoGestion ?? '',
    });
    aplicarBordeFila(row);
    if (n.estado === 'FALLIDA')      pintarEstado(row.getCell('estado'), 'CRITICO');
    else if (n.estado === 'OMITIDA') pintarEstado(row.getCell('estado'), 'NEUTRAL');
    else if (n.estado === 'GESTIONADA') pintarEstado(row.getCell('estado'), 'ATENCION');
    else                              pintarEstado(row.getCell('estado'), 'BUENO');
    row.getCell('error').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('motivoGestion').alignment = { wrapText: true, vertical: 'top' };
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
}

/* ── Hoja 7: SIMI ─────────────────────────────────────────── */
function construirSimi(
  wb: ExcelJS.Workbook,
  auditoria: SimiAuditoriaRecord[],
  feedback: SimiFeedbackRecord[],
) {
  const ws = wb.addWorksheet('SIMI');
  ws.columns = [
    { header: 'N° Radicado',           key: 'radicadoId',   width: 28 },
    { header: 'Fecha',                 key: 'fecha',        width: 24 },
    { header: 'Usuario',               key: 'usuario',      width: 22 },
    { header: 'Rol',                   key: 'rol',          width: 18 },
    { header: 'Dependencia Radicado',  key: 'depRad',       width: 30 },
    { header: 'Acción SIMI',           key: 'accion',       width: 26 },
    { header: 'Resumen Entrada',       key: 'entrada',      width: 50 },
    { header: 'Resumen Salida',        key: 'salida',       width: 50 },
    { header: 'Evaluación Competencia',key: 'comp',         width: 16 },
    { header: 'Feedback Útil',         key: 'feedbackUtil', width: 14 },
    { header: 'Motivo Feedback',       key: 'feedbackMot',  width: 26 },
    { header: 'Error',                 key: 'error',        width: 32 },
  ];
  aplicarEstiloEncabezado(ws.getRow(1));

  // Indexar feedback por radicadoId+accion+fecha aproximada
  const indiceFeedback = new Map<string, SimiFeedbackRecord>();
  for (const f of feedback) {
    if (!f.radicadoId || !f.accion) continue;
    indiceFeedback.set(`${f.radicadoId}::${f.accion}`, f);
  }

  for (const a of auditoria) {
    const key = `${a.radicadoId ?? ''}::${a.accion ?? ''}`;
    const fb = indiceFeedback.get(key);
    const row = ws.addRow({
      radicadoId:   a.radicadoId ?? '—',
      fecha:        a.fecha ?? '—',
      usuario:      a.actorNombre ?? '—',
      rol:          a.actorRol ?? '—',
      depRad:       a.dependenciaRadicado ?? a.tenantId ?? '—',
      accion:       a.accion ?? '—',
      entrada:      (a.resumenEntrada ?? '').slice(0, 300),
      salida:       (a.resumenSalida ?? '').slice(0, 300),
      comp:         a.evaluacionCompetenciaNivel ?? '—',
      feedbackUtil: fb ? (fb.util ? 'Sí' : 'No') : '—',
      feedbackMot:  fb?.motivo ?? '—',
      error:        a.error ?? '',
    });
    aplicarBordeFila(row);
    row.getCell('entrada').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('salida').alignment  = { wrapText: true, vertical: 'top' };
    if (a.error) pintarEstado(row.getCell('error'), 'CRITICO');
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  if (auditoria.length === 0) {
    ws.addRow({ radicadoId: 'Sin registros de uso de SIMI en el rango / rol.' });
  }
  ajustarAncho(ws, [28, 24, 22, 18, 30, 26, 50, 50, 16, 14, 26, 32]);
}

/* ── Hoja 8: Diccionario de Datos ────────────────────────── */
function construirDiccionario(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Diccionario de Datos');
  ws.columns = [
    { header: 'Campo',         key: 'campo',     width: 28 },
    { header: 'Descripción',   key: 'desc',      width: 50 },
    { header: 'Fuente',        key: 'fuente',    width: 36 },
    { header: 'Uso MIPG',      key: 'uso',       width: 32 },
    { header: 'Observaciones', key: 'obs',       width: 40 },
  ];
  aplicarEstiloEncabezado(ws.getRow(1));

  const diccionario: Array<[string, string, string, string, string]> = [
    ['radicadoId', 'Identificador único del radicado en el formato 1-{CANAL}-{AÑO}-{CONSECUTIVO}.', 'ventanilla_radicados.radicadoId', 'Identificación oficial del trámite.', 'Inmutable. Generado por contador transaccional.'],
    ['termino.tipoSolicitudId', 'Identificador del tipo de solicitud en el catálogo institucional.', 'ventanilla_radicados.termino.tipoSolicitudId · lib/catalogos/tipos-solicitud.ts', 'Clasificación legal y cálculo de términos.', 'Catálogo único centralizado. Cambios requieren evento TIPO_SOLICITUD_RECLASIFICADO.'],
    ['categoriaSolicitud', 'Categoría del tipo de solicitud: PQRSD, TRAMITE, INTERNO o ESPECIAL.', 'lib/catalogos/tipos-solicitud.ts', 'Reportes MIPG y consulta pública.', 'Determina si es visible al ciudadano.'],
    ['requiereValidacionJuridica', 'Bandera del catálogo que indica que el tipo requiere visto bueno jurídico antes de operar.', 'lib/catalogos/tipos-solicitud.ts', 'Control jurídico institucional.', 'Aplicada en tipos heredados del sistema actual: licencia construcción, querella, urgente, entre otros.'],
    ['heredadoSistemaActual', 'Indica si el tipo fue incorporado desde el sistema interno previo a la Ventanilla Digital.', 'lib/catalogos/tipos-solicitud.ts', 'Trazabilidad de migración del catálogo.', 'Se valida jurídicamente antes del go-live oficial.'],
    ['Tipo Reclasificado / Tipo Original', 'Indica si Ventanilla cambió el tipo del radicado y cuál era el original.', 'Subcolección trazabilidad — evento TIPO_SOLICITUD_RECLASIFICADO.', 'Auditoría de reclasificación interna.', 'Se conserva el nombre del tipo previo en metadata para evidencia MIPG.'],
    ['estadoActual', 'Estado del ciclo de vida del radicado.', 'ventanilla_radicados.estadoActual', 'Ciclo de vida MIPG.', 'PENDIENTE · EN_REVISION · ASIGNADO · EN_PROCESO · PRORROGA · RESUELTO · DEVUELTO · RECHAZADO.'],
    ['cumplioTermino', 'Indica si el radicado fue respondido dentro del término legal.', 'ventanilla_radicados.cumplioTermino', 'Medición de cumplimiento de términos.', 'Campo inmutable al resolver. true = en término · false = fuera de término · null = aún activo.'],
    ['esAnonimo', 'Indica si la solicitud fue presentada de forma anónima.', 'ventanilla_radicados.esAnonimo', 'Protege identidad — Ley 1755/2015 art. 14.', 'Si es true, no se exporta nombre/documento/correo.'],
    ['tipoPresentacion', 'Forma en que el ciudadano presenta la PQRSD.', 'ventanilla_radicados.tipoPresentacion', 'Clasificación de la solicitud.', 'IDENTIFICADA · ANONIMA · RESERVADA.'],
    ['identidadReservada', 'Indica si los datos personales son reservados aunque el solicitante esté identificado.', 'ventanilla_radicados.identidadReservada', 'Protección reforzada de datos.', 'Se enmascara en el reporte como Anónimo / Reservado.'],
    ['canalRespuesta', 'Canal preferido por el ciudadano para recibir respuesta.', 'ventanilla_radicados.canalRespuesta', 'Cumplimiento del canal acordado.', 'CORREO · PRESENCIAL · TELEFONO · DIRECCION_FISICA.'],
    ['clasificacion.oficinaDestino', 'Dependencia/secretaría asignada al radicado.', 'ventanilla_radicados.clasificacion.oficinaDestino', 'Asignación funcional.', 'TenantId interno; el reporte muestra el nombre humano.'],
    ['clasificacion.funcionarioResponsable*', 'Snapshot inmutable del funcionario responsable (nombre, email, rol, cargo).', 'ventanilla_radicados.clasificacion.*', 'MIPG-2: trazabilidad de responsable.', 'No se exporta UID por privacidad/seguridad.'],
    ['termino.fechaVencimiento', 'Fecha límite legal de respuesta.', 'ventanilla_radicados.termino.fechaVencimiento', 'Control de cumplimiento.', 'Calculada según tipo de PQRSD y calendario hábil.'],
    ['termino.prorrogasAplicadas', 'Número de prórrogas aplicadas al término inicial.', 'ventanilla_radicados.termino.prorrogasAplicadas', 'Trazabilidad de extensión de plazos.', '0 cuando no hay prórroga.'],
    ['respuestaOficial.nota', 'Texto de la respuesta oficial del funcionario.', 'ventanilla_radicados.respuestaOficial.nota', 'Sustento de la respuesta entregada.', 'No se incluye en la hoja Radicados — ver consulta pública o detalle.'],
    ['respuestaOficial.archivoNombre', 'Nombre del oficio PDF firmado (si existe).', 'ventanilla_radicados.respuestaOficial.archivoNombre', 'Evidencia de oficio.', 'archivoPath se omite por ser ruta privada de Storage.'],
    ['alertaNotificacionFallida', 'Bandera que indica que un correo institucional al ciudadano falló y aún no fue gestionado.', 'ventanilla_radicados.alertaNotificacionFallida', 'Garantía de comunicación con el ciudadano.', 'Baja a false cuando el funcionario marca la notificación como gestionada manualmente.'],
    ['trazabilidad.*', 'Subcolección append-only con cada evento del radicado.', 'ventanilla_radicados/{id}/trazabilidad', 'Auditoría completa MIPG.', 'Las hojas Trazabilidad y Notificaciones extraen de esta subcolección.'],
    ['simi_auditoria.*', 'Auditoría del uso de SIMI por funcionarios.', 'simi_auditoria', 'Trazabilidad del asistente.', 'No incluye el prompt completo ni la salida completa, solo resúmenes.'],
    ['simi_feedback.*', 'Evaluación del funcionario sobre la utilidad de SIMI.', 'simi_feedback', 'Mejora continua del asistente.', 'útil / motivo / fecha.'],
  ];
  for (const [campo, desc, fuente, uso, obs] of diccionario) {
    const row = ws.addRow({ campo, desc, fuente, uso, obs });
    aplicarBordeFila(row);
    row.getCell('desc').alignment   = { wrapText: true, vertical: 'top' };
    row.getCell('fuente').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('uso').alignment    = { wrapText: true, vertical: 'top' };
    row.getCell('obs').alignment    = { wrapText: true, vertical: 'top' };
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}
