'use client';

/* ══════════════════════════════════════════════════════════════
   Libro consecutivo — Bloque C ("el reemplazo funcional del Excel").

   Reemplaza el placeholder honesto que existía hasta ahora (Fase 2,
   arranque): la colección `expedientes` YA es real (`GET /api/licencias/
   expedientes`, bloque "Integración UI y demo") — este componente consume
   el MISMO endpoint que `BandejaLicenciasClient`, sin filtro de año en el
   servidor (la cota del endpoint por tenant ya gobierna el volumen; el
   año se filtra en cliente, ver `presentacion-libro-consecutivo.ts`).

   Patrón dual (mismo que Bloque B): este componente único se monta desde
   la ruta standalone (`app/interno/licencias/libro-consecutivo/page.tsx`)
   Y desde la sub-pestaña "Libro consecutivo" de `VistaLicencias`
   (`app/interno/dashboard/components/licencias/VistaLicencias.tsx`) sin
   duplicar lógica. No necesita props de navegación (a diferencia de
   `BandejaLicenciasClient`/`DetalleLicenciaClient`): es una vista hoja,
   no abre otra pantalla — el detalle rápido vive en un panel lateral
   propio (`PanelDetalleExpediente`), no en una navegación.

   Rediseño (10-ago-2026, diseño validado por el propietario): de lista
   suelta a tabla densa con KPIs, filtros con conteo y franja de urgencia
   por fila. Las funciones de conteo/filtrado/urgencia son PURAS
   (`presentacion-libro-consecutivo.ts`) — este componente solo las
   invoca y pinta el resultado.

   Honestidad de datos (RF-5/RF-9, `docs/planes/
   ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`): "N.° LICENCIA" muestra "—"
   cuando `actoFinal` está ausente — HOY la norma, no la excepción (0/202
   expedientes del Excel histórico tienen fecha de resolución). Nunca se
   calcula ni se infiere ese dato. "Vence" sale de `fechaAlertaConservadora`,
   espejo que el servidor YA persiste en el documento raíz del expediente
   en la misma transacción que cada actuación (ver su JSDoc en
   `lib/server/expedientes-licencias.ts`): llega gratis en esta lista, sin
   leer la subcolección `actuaciones` (R11). Cuando el servidor no pudo
   proyectar término — expedientes anteriores al campo, y RECONSTRUIDOS,
   cuyas actuaciones no mueven relojes legales (R9) — la columna se ve
   honestamente vacía; jamás se recalcula aquí.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';
import { ChipEstadoJuridico } from './ChipEstadoJuridico';
import { ChipPrueba } from './ChipPrueba';
import { NumeroLegal } from './NumeroLegal';
import { TarjetaKpiLibro } from './TarjetaKpiLibro';
import { ChipFiltroLibro } from './ChipFiltroLibro';
import { EtiquetaDatoFaltante } from './EtiquetaDatoFaltante';
import { PanelDetalleExpediente } from './PanelDetalleExpediente';
import {
  añosDisponiblesLibro,
  calcularConteosKpiLibro,
  calcularConteosPorFiltroLibro,
  COLOR_URGENCIA_LIBRO,
  construirFilasLibroConsecutivo,
  FILTROS_LIBRO_CONSECUTIVO,
  filtrarFilasLibro,
  generarCsvLibroConsecutivo,
  nombreArchivoCsvLibroConsecutivo,
  subtiposConEstadoLibro,
  textoDiasVencimientoLibro,
  urgenciaFilaLibro,
  type FiltroLibroConsecutivo,
} from '../presentacion-libro-consecutivo';

export function LibroConsecutivoClient() {
  const { usuario, cargando: cargandoAuth } = useAuth();
  const [expedientes, setExpedientes] = useState<ExpedienteLicenciaDoc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default = año en curso (spec) — el selector se recalcula con datos
  // reales en cuanto llega la respuesta (`añosDisponiblesLibro`).
  const [año, setAño] = useState<number>(() => new Date().getFullYear());
  const [filtro, setFiltro] = useState<FiltroLibroConsecutivo>('TODOS');
  const [expedienteSeleccionadoId, setExpedienteSeleccionadoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/licencias/expedientes', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'No fue posible cargar el libro consecutivo.');
        return;
      }
      setExpedientes(Array.isArray(body.expedientes) ? body.expedientes : []);
    } catch {
      setError('Error de red al cargar el libro consecutivo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (cargandoAuth || !usuario) return;
    void cargar();
  }, [cargandoAuth, usuario, cargar]);

  const años = useMemo(() => añosDisponiblesLibro(expedientes), [expedientes]);
  const filas = useMemo(() => construirFilasLibroConsecutivo(expedientes, año), [expedientes, año]);
  const conteosKpi = useMemo(() => calcularConteosKpiLibro(filas), [filas]);
  const conteosFiltro = useMemo(() => calcularConteosPorFiltroLibro(filas), [filas]);
  const filasVisibles = useMemo(() => filtrarFilasLibro(filas, filtro), [filas, filtro]);
  const conteos = useMemo(
    () => ({
      total: filas.length,
      prueba: filas.filter((f) => f.esPrueba).length,
      conActoFinal: filas.filter((f) => f.numeroLicencia !== null).length,
    }),
    [filas],
  );

  // El filtro que quedó activo puede vaciarse al cambiar de año (p. ej.
  // "Vencidos" con 3 filas en 2026 pasa a 0 en 2025) — se resetea a
  // 'TODOS' para no dejar la tabla en un vacío silencioso que parezca un
  // error de carga.
  useEffect(() => {
    setFiltro('TODOS');
  }, [año]);

  const exportarCsv = useCallback(() => {
    const csv = generarCsvLibroConsecutivo(filas);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivoCsvLibroConsecutivo(año);
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }, [filas, año]);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1400px] mx-auto">
      {/* ── Encabezado de pantalla (oculto al imprimir) ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 print:hidden">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Secretaría de Planeación · Licencias Urbanísticas
          </p>
          <h1 className="font-headline text-2xl md:text-[28px] mt-1" style={{ color: 'var(--text-primary)' }}>
            Libro consecutivo
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Un expediente por fila, en el orden en que se radicó — reemplaza el Excel de consecutivo de Planeación.
          </p>
        </div>
        <div className="shrink-0 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              Año
            </span>
            <select
              className="select-internal"
              value={año}
              onChange={(e) => setAño(Number(e.target.value))}
              aria-label="Año del libro consecutivo"
            >
              {años.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={exportarCsv}
            disabled={cargando || filas.length === 0}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
            style={{ background: 'var(--color-accent)', color: 'var(--color-primary)', boxShadow: '0 2px 8px rgba(212,160,23,0.25)' }}
          >
            Exportar CSV ↓
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]"
            style={{ background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
          >
            Imprimir
          </button>
        </div>
      </div>

      {/* ── Encabezado SOLO impresión: institucional + año, sin controles ── */}
      <div className="hidden print:block">
        <InstitucionalHeader
          variant="print"
          eyebrow="Secretaría de Planeación · Licencias Urbanísticas"
          title="Libro consecutivo de licencias"
          subtitle={`Año ${año}`}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm print:hidden" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {error}
        </p>
      )}

      {/* ── Aviso permanente de alcance (RF-6/RF-7) ── */}
      <div
        role="note"
        aria-label="Aviso sobre el alcance histórico del libro"
        className="rounded-xl p-3.5 print:hidden"
        style={{ background: '#E9F0FC', border: '1px solid rgba(37,99,235,0.25)' }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: '#1E4FA0' }}>
          <strong>Libro del sistema</strong> — los expedientes históricos del Excel (2022–2026) se incorporarán con la migración (Fase 5).
        </p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <TarjetaKpiLibro overline="Total" valor={conteosKpi.total} tono="normal" detalle={<span>Expedientes de {año}</span>} />
        <TarjetaKpiLibro overline="En trámite" valor={conteosKpi.enTramite} tono="normal" detalle={<span>Radicados, en revisión, con acta o en viabilidad</span>} />
        <TarjetaKpiLibro
          overline="Por vencer"
          valor={conteosKpi.porVencer}
          tono="peligro"
          detalle={<span>Con alerta de término calculada por el sistema</span>}
        />
        <TarjetaKpiLibro
          overline="Históricos incompletos"
          valor={conteosKpi.historicosIncompletos}
          tono="advertencia"
          detalle={<span>Migrados sin cédula o sin estado registrado</span>}
        />
      </div>

      {/* ── Chips de filtro ── */}
      <div role="group" aria-label="Filtrar libro consecutivo" className="flex flex-wrap gap-2 print:hidden">
        {FILTROS_LIBRO_CONSECUTIVO.map(({ id, etiqueta }) => (
          <ChipFiltroLibro key={id} etiqueta={etiqueta} conteo={conteosFiltro[id]} activo={filtro === id} onClick={() => setFiltro(id)} />
        ))}
      </div>

      {/* ── Tabla ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{`Libro consecutivo de licencias, año ${año}, filtro ${filtro}`}</caption>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Th ancho={190}>N.° expediente</Th>
                <Th ancho={110}>Fecha radicación</Th>
                <Th>Solicitante</Th>
                <Th ancho={150}>Tipo</Th>
                <Th ancho={190}>Estado</Th>
                <Th ancho={130}>Vence</Th>
                <Th ancho={120}>Vigencia hasta</Th>
                <Th ancho={110}>N.° licencia</Th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Cargando libro consecutivo…
                  </td>
                </tr>
              )}
              {!cargando && !error && filas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Sin expedientes en {año}
                  </td>
                </tr>
              )}
              {!cargando && filas.length > 0 && filasVisibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Ningún expediente de {año} coincide con este filtro
                  </td>
                </tr>
              )}
              {!cargando &&
                filasVisibles.map((fila) => {
                  const urgencia = urgenciaFilaLibro(fila);
                  const colorUrgencia = COLOR_URGENCIA_LIBRO[urgencia];
                  const textoDias = textoDiasVencimientoLibro(fila);
                  const subtipos = subtiposConEstadoLibro(fila.subtipoCodigos);
                  const tituloSubtipos = fila.subtipos.join(', ');

                  return (
                    <tr key={fila.id} className="micro-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-3 py-2.5 align-top" style={{ boxShadow: `inset 4px 0 0 0 ${colorUrgencia}` }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setExpedienteSeleccionadoId(fila.id)}
                            className="focus-visible:outline-none focus-visible:ring-2 rounded"
                            aria-haspopup="dialog"
                          >
                            <NumeroLegal value={fila.numeroExpediente} variant="expediente" size="sm" />
                          </button>
                          {fila.esPrueba && <ChipPrueba />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {formatFechaColombia(fila.fechaRadicacion)}
                      </td>
                      <td className="px-3 py-2.5 align-top" style={{ maxWidth: 220 }}>
                        {fila.faltaCedula ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{fila.solicitanteNombre || 'Sin nombre registrado'}</span>
                            <EtiquetaDatoFaltante texto="Sin cédula" />
                          </div>
                        ) : (
                          <>
                            <p style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{fila.solicitanteNombre}</p>
                            <p style={{ color: 'var(--text-secondary)' }}>{fila.solicitanteDocumento}</p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top" style={{ maxWidth: 150 }}>
                        <div className="truncate" title={tituloSubtipos}>
                          {subtipos.map((s, i) => (
                            <span
                              key={s.codigo + i}
                              className="text-xs"
                              style={s.enCuarentena ? { color: '#9A6206', fontStyle: 'italic' } : { color: 'var(--text-secondary)' }}
                            >
                              {i > 0 ? ' · ' : ''}
                              {s.enCuarentena ? `? ${s.nombre}` : s.nombre}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {fila.faltaEstadoJuridico ? (
                          <EtiquetaDatoFaltante texto="Sin estado" />
                        ) : (
                          <ChipEstadoJuridico estado={fila.estadoJuridico} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        {fila.fechaAlertaConservadora ? (
                          <>
                            <p className="font-bold" style={{ color: colorUrgencia }}>
                              {formatFechaColombia(fila.fechaAlertaConservadora)}
                            </p>
                            {textoDias !== null && (
                              <p className="text-[11px]" style={{ color: colorUrgencia }}>
                                {textoDias}
                              </p>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap" style={{ color: 'var(--text-primary)' }} title={fila.vigenciaHastaError}>
                        {fila.vigenciaHasta ? formatFechaColombia(fila.vigenciaHasta) : '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {fila.numeroLicencia ?? '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pie: conteos de reconciliación (sobre el TOTAL del año, no del filtro activo) ── */}
      <p className="text-xs print:hidden" style={{ color: 'var(--text-secondary)' }}>
        {conteos.total} expediente{conteos.total === 1 ? '' : 's'} en {año} · {conteos.prueba} de prueba · {conteos.conActoFinal} con acto final
        {filtro !== 'TODOS' && ` · ${filasVisibles.length} visible${filasVisibles.length === 1 ? '' : 's'} con el filtro activo`}
      </p>

      {expedienteSeleccionadoId && (
        <PanelDetalleExpediente expedienteId={expedienteSeleccionadoId} onCerrar={() => setExpedienteSeleccionadoId(null)} />
      )}
    </div>
  );
}

function Th({ children, ancho }: { children: React.ReactNode; ancho?: number }) {
  return (
    <th
      scope="col"
      className="text-left px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-widest"
      style={{ color: 'var(--text-secondary)', width: ancho }}
    >
      {children}
    </th>
  );
}
