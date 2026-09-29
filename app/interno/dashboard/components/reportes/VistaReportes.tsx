'use client';

import { useMemo, useState } from 'react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import type { SalidaOficial } from '@/src/types/salida';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import {
  ETIQUETA_PRESET,
  filtrarPorPreset,
  indicadoresDeReporte,
  resumenPorDependencia,
  type PresetReporte,
} from '@/lib/reportes/filtrar-por-preset';
import { filtrarSalidasPorPreset, resumenSalidas } from '@/lib/salidas/reporte-salidas';
import { INSTITUCION } from '@/lib/institucion';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';
import { descargarExcelMipg, exportarCSVMIPG } from './exportaciones-mipg';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { ChipFiltro } from '@/app/components/design-system/ChipFiltro';
import type { IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { CabeceraTablaSticky } from '@/app/components/design-system/SuperficieTabla';
import {
  AlertTriangle, CheckCheck, CheckCircle2, Clock3, FileDown, FileSpreadsheet, FileText, Flag, Inbox, Printer, Target, Undo2, UsersRound,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Reportes MIPG — indicadores de eficiencia del período, corte por
   dependencia, correspondencia de salida e impresión/exportación.

   Ola 3 (ADR-0046): trasladada SIN cambios desde
   `app/interno/dashboard/page.tsx` y migrada al lenguaje del Tablero
   (encabezado, chips de período, indicadores y tabla del sistema). Los
   cálculos del reporte no cambian.
══════════════════════════════════════════════════════════════ */

/* Sprint 3C — impresión del reporte: solo el bloque #reporte-mipg-print
   es visible al imprimir (mismo patrón de constancia y sello). */
const PRINT_STYLES_REPORTE = `
@media print {
  body * { visibility: hidden !important; }
  #reporte-mipg-print,
  #reporte-mipg-print * { visibility: visible !important; }
  #reporte-mipg-print {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    background: white !important;
    padding: 0 !important;
    z-index: 99999 !important;
  }
  @page {
    size: letter portrait;
    margin: 14mm 12mm;
  }
}
`;

const MEDIO_SALIDA_LABEL: Record<string, string> = {
  CORREO:     'Correo electrónico',
  FISICO:     'Correo físico',
  MENSAJERO:  'Mensajero',
  PRESENCIAL: 'Entrega presencial',
};

export function VistaReportes({
  total,
  radicados,
  salidas,
  dependenciaFija,
}: {
  total:     number;
  radicados: VentanillaRadicado[];
  /** Fase B — libro de salidas; null = el rol no lee el libro completo. */
  salidas:   SalidaOficial[] | null;
  /**
   * Ola 3 (ADR-0046) — alcance DEPENDENCIA (JEFE_DEPENDENCIA): sus datos ya
   * llegan acotados, así que el selector de dependencia no aplica (antes
   * listaba las 15 y cualquier otra daba ceros). El reporte se rotula con su
   * dependencia en pantalla y al imprimir. El cálculo no cambia.
   */
  dependenciaFija?: TenantId;
}) {
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [errorExcel, setErrorExcel] = useState<string | null>(null);
  // Sprint 3C — preset de período y dependencia del reporte.
  const [preset, setPreset] = useState<PresetReporte>('ESTE_MES');
  const [depFiltro, setDepFiltro] = useState<TenantId | 'TODAS'>('TODAS');
  async function onExportarExcel() {
    setDescargandoExcel(true);
    setErrorExcel(null);
    const res = await descargarExcelMipg();
    if (!res.ok) setErrorExcel(res.error ?? 'No se pudo generar el reporte Excel.');
    setDescargandoExcel(false);
  }

  /* Sprint 3C — el reporte se calcula sobre el subconjunto del período
     elegido, con los mismos cortes calendario de los KPIs operativos. */
  const subconjunto = useMemo(
    () => filtrarPorPreset(radicados, preset, depFiltro),
    [radicados, preset, depFiltro],
  );
  const ind = useMemo(() => indicadoresDeReporte(subconjunto), [subconjunto]);
  const filasDependencia = useMemo(() => resumenPorDependencia(subconjunto), [subconjunto]);
  const pctCumplimiento = ind.pctCumplimiento;
  /* Fase B — la serie 2-SAL del mismo período y dependencia. */
  const resumenSal = useMemo(
    () => (salidas ? resumenSalidas(filtrarSalidasPorPreset(salidas, preset, depFiltro)) : null),
    [salidas, preset, depFiltro],
  );

  /* Sprint 3C — imprimir o "Guardar como PDF" del navegador. Se
     desactiva la hoja de estilos del comprobante durante la impresión
     para que no compita por la @page, y el tag propio se retira al
     cerrar el diálogo (mismo manejo del sello de recibido). */
  function handleImprimirReporte() {
    const stylesComprobante =
      document.getElementById('comprobante-print-styles') as HTMLStyleElement | null;
    if (stylesComprobante) stylesComprobante.disabled = true;

    const tag = document.createElement('style');
    tag.id = 'reporte-mipg-print-styles';
    tag.textContent = PRINT_STYLES_REPORTE;
    document.head.appendChild(tag);

    window.print();

    tag.remove();
    if (stylesComprobante) stylesComprobante.disabled = false;
  }

  const tonoCumplimiento: IndicadorEstaticoProps['tono'] = pctCumplimiento === null ? 'gris'
    : pctCumplimiento >= 80 ? 'verde' : pctCumplimiento >= 60 ? 'ambar' : 'rojo';
  /* Ola 3 — los mismos diez indicadores con el Indicador del Tablero. La
     aclaración va visible: el reporte se imprime y en papel no hay tooltip. */
  const items: IndicadorEstaticoProps[] = [
    { etiqueta: 'Total radicados',           valor: ind.total,     tono: 'gris',  Icono: FileText,      descripcion: ETIQUETA_PRESET[preset] },
    { etiqueta: 'Tasa resolución (%)',       valor: ind.total > 0 ? Math.round((ind.resueltos / ind.total) * 100) : 0, tono: 'verde', Icono: CheckCircle2, descripcion: 'Resueltos / Total' },
    { etiqueta: 'Cumplimiento términos (%)', valor: pctCumplimiento !== null ? pctCumplimiento : '—', tono: tonoCumplimiento, Icono: Target, descripcion: 'MIPG Req. 8 — Respondidos a tiempo' },
    { etiqueta: 'Respondidos a tiempo',      valor: ind.aTiempo,   tono: 'verde', Icono: CheckCheck,    descripcion: 'Con dato de cumplimiento' },
    { etiqueta: 'Radicadas (pendientes)',    valor: ind.radicadas, tono: 'gris',  Icono: Inbox },
    { etiqueta: 'Prioridad MIPG activos',    valor: ind.prioridadMipg, tono: 'rojo', Icono: Flag,       descripcion: 'Prioridad ROJO activa' },
    { etiqueta: 'En trámite (asignadas)',    valor: ind.asignadas, tono: 'azul',  Icono: UsersRound },
    { etiqueta: 'Por vencer (≤ 2 días)',     valor: ind.porVencer, tono: 'ambar', Icono: Clock3 },
    { etiqueta: 'Vencidas sin respuesta',    valor: ind.vencidas,  tono: 'rojo',  Icono: AlertTriangle },
    { etiqueta: 'Devueltas / Prórroga',      valor: ind.devueltasProrroga, tono: 'ambar', Icono: Undo2 },
  ];
  const nombreAlcance = depFiltro !== 'TODAS'
    ? (NOMBRES_TENANT[depFiltro] ?? depFiltro)
    : dependenciaFija ? (NOMBRES_TENANT[dependenciaFija] ?? dependenciaFija) : 'Todas las dependencias';

  return (
    <div id="reporte-mipg-print" className="flex-1 overflow-y-auto pb-6" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      {/* Encabezado institucional — solo visible al imprimir. */}
      <div className="hidden print:block mb-6 px-3" style={{ borderBottom: '2px solid var(--tema-borde-007049)', paddingBottom: 12 }}>
        <div className="flex items-center gap-3">
          <div className="shrink-0 overflow-hidden" style={{ width: 40, height: 40 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={INSTITUCION.logo}
              alt=""
              className="max-w-none"
              style={{ height: 40, width: 'auto', objectPosition: 'left' }}
            />
          </div>
          <div>
            <p className="text-sm font-black uppercase" style={{ color: 'var(--tema-texto-007049)' }}>{INSTITUCION.nombre}</p>
            <p className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>
              Reporte de indicadores MIPG · {ETIQUETA_PRESET[preset]}
              {` · ${nombreAlcance}`}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--tema-texto-94a3b8)' }}>
              Generado: {formatFechaHoraColombia(new Date())} · {subconjunto.length} radicado{subconjunto.length !== 1 ? 's' : ''} en el período
            </p>
          </div>
        </div>
      </div>

      <SectionHeader
        className="print:hidden"
        titulo="Indicadores de Eficiencia"
        subtitulo={dependenciaFija ? `MIPG · Rendición de Cuentas · ${nombreAlcance}` : 'MIPG · Rendición de Cuentas'}
        acciones={
          <>
            <BotonAccion Icono={Printer} onClick={handleImprimirReporte} title="Imprimir el reporte del período o guardarlo como PDF desde el navegador">
              Imprimir / PDF
            </BotonAccion>
            <BotonAccion variante="primaria" Icono={FileSpreadsheet} onClick={onExportarExcel} disabled={descargandoExcel} title="Exportar Reporte MIPG en formato Excel institucional (8 hojas)">
              {descargandoExcel ? 'Generando…' : 'Exportar Excel MIPG'}
            </BotonAccion>
            <BotonAccion Icono={FileDown} onClick={() => exportarCSVMIPG(subconjunto)} title="Exportar CSV técnico (respaldo plano para integraciones)">
              CSV técnico
            </BotonAccion>
          </>
        }
      />

      {errorExcel && (
        <div role="alert" className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs sm:mx-4 lg:mx-6"
             style={{ background: 'var(--tema-fondo-fee2e2)', border: '1px solid var(--tema-borde-fca5a5)', color: 'var(--tema-texto-991b1b)' }}>
          <strong>Excel MIPG:</strong> {errorExcel}
        </div>
      )}

      {/* Sprint 3C — presets de período + dependencia. */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1 sm:px-4 lg:px-6 print:hidden" role="group" aria-label="Período del reporte">
        {(Object.entries(ETIQUETA_PRESET) as [PresetReporte, string][]).map(([id, etiqueta]) => (
          <ChipFiltro key={id} etiqueta={etiqueta} activo={preset === id} onClick={() => setPreset(id)} />
        ))}
        {!dependenciaFija && (
          <select
            value={depFiltro}
            onChange={(e) => setDepFiltro(e.target.value as TenantId | 'TODAS')}
            aria-label="Filtrar reporte por dependencia"
            className="select-internal text-xs ml-auto"
            style={{ maxWidth: 260 }}
          >
            <option value="TODAS">Todas las dependencias</option>
            {(Object.entries(NOMBRES_TENANT) as [TenantId, string][]).map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        )}
      </div>

      <FilaTarjetas etiqueta="Indicadores del reporte" className="px-3 pt-3 sm:px-4 lg:px-6 xl:grid-cols-5">
        {items.map((item) => (
          <TarjetaIndicador key={item.etiqueta} {...item} descripcionVisible />
        ))}
      </FilaTarjetas>

      {/* Sprint 3C — corte por dependencia del período. */}
      {filasDependencia.length > 0 && (
        <div className="mx-3 mt-3 rounded-xl bg-[var(--tema-fondo-ffffff)] p-3 sm:mx-4 lg:mx-6">
          <p className="text-xs font-black mb-2" style={{ color: 'var(--tema-texto-172033)' }}>
            Por dependencia · {ETIQUETA_PRESET[preset]}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <CabeceraTablaSticky
                columnas={[
                  'Dependencia',
                  { etiqueta: 'Total', alineacion: 'derecha' },
                  { etiqueta: 'Pendientes', alineacion: 'derecha' },
                  { etiqueta: 'En trámite', alineacion: 'derecha' },
                  { etiqueta: 'Resueltos', alineacion: 'derecha' },
                  { etiqueta: 'Vencidas', alineacion: 'derecha' },
                ]}
              />
              <tbody>
                {filasDependencia.map((f) => (
                  <tr key={f.oficina} style={{ borderTop: '1px solid var(--tema-borde-eef2ee)', color: 'var(--tema-texto-172033)' }}>
                    <td className="px-2 py-2 font-medium">{NOMBRES_TENANT[f.oficina] ?? f.oficina}</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">{f.total}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{f.pendientes}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{f.enTramite}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{f.resueltos}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-bold"
                        style={{ color: f.vencidas > 0 ? 'var(--tema-texto-d81e1e)' : 'var(--tema-texto-64748b)' }}>
                      {f.vencidas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fase B — lo que la administración despachó en el mismo período. */}
      {resumenSal && (
        <div className="mx-3 mt-3 rounded-xl bg-[var(--tema-fondo-ffffff)] p-3 sm:mx-4 lg:mx-6">
          <p className="text-xs font-black mb-2" style={{ color: 'var(--tema-texto-172033)' }}>
            Correspondencia de salida · {ETIQUETA_PRESET[preset]}
          </p>
          {resumenSal.total === 0 ? (
            <p className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>
              Sin salidas 2-SAL registradas en el período
              {depFiltro !== 'TODAS' ? ' para esta dependencia' : ''}.
            </p>
          ) : (
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-3xl font-black tabular-nums" style={{ color: 'var(--tema-texto-172033)' }}>{resumenSal.total}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: 'var(--tema-texto-64748b)' }}>Salidas despachadas</p>
              </div>
              <div>
                <p className="text-3xl font-black tabular-nums" style={{ color: 'var(--tema-texto-185fa5)' }}>{resumenSal.respuestas}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: 'var(--tema-texto-64748b)' }}>Respuestas a radicados</p>
              </div>
              <div>
                <p className="text-3xl font-black tabular-nums" style={{ color: 'var(--tema-texto-3a4551)' }}>{resumenSal.oficios}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: 'var(--tema-texto-64748b)' }}>Oficios independientes</p>
              </div>
              {resumenSal.porMedio.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                  {resumenSal.porMedio.map((m) => (
                    <span
                      key={m.medio}
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--tema-fondo-f4f9f6)', border: '1px solid var(--tema-borde-dce4ea)', color: 'var(--tema-texto-475569)' }}
                    >
                      {MEDIO_SALIDA_LABEL[m.medio] ?? m.medio}: {m.cantidad}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pctCumplimiento === null && (
        <div role="note" className="mx-3 mt-3 rounded-lg px-3 py-2.5 sm:mx-4 lg:mx-6" style={{ background: 'var(--tema-fondo-fffbeb)', border: '1px solid var(--tema-borde-fde68a)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--tema-texto-92400e)' }}>
            <span className="font-bold">MIPG Req. 8 — Sin datos de cumplimiento aún.</span>{' '}
            El campo <span className="font-mono">cumplioTermino</span> se registra automáticamente
            la próxima vez que se resuelva un radicado. Los radicados históricos no tienen este dato.
          </p>
        </div>
      )}

      <p className="mt-3 px-3 text-xs sm:px-4 lg:px-6 print:hidden" style={{ color: 'var(--tema-texto-64748b)' }}>
        Datos en tiempo real · colección <span className="font-mono">ventanilla_radicados</span> ·
        {' '}{subconjunto.length} de {total} documento{total !== 1 ? 's' : ''} en el período ·
        el CSV exporta lo filtrado; el Excel MIPG, el histórico completo.
      </p>
    </div>
  );
}
