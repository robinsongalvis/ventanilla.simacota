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
   no abre otra pantalla.

   Honestidad de datos (RF-5/RF-9, `docs/planes/
   ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`): "N.° LICENCIA" y "FECHA
   FIRMEZA" muestran "—" cuando `actoFinal` está ausente — HOY la norma,
   no la excepción (0/202 expedientes del Excel histórico tienen fecha de
   resolución). Nunca se calcula ni se infiere ese dato.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';
import { ChipEstadoJuridico } from './ChipEstadoJuridico';
import { ChipPrueba } from './ChipPrueba';
import { NumeroLegal } from './NumeroLegal';
import {
  añosDisponiblesLibro,
  construirFilasLibroConsecutivo,
  generarCsvLibroConsecutivo,
  nombreArchivoCsvLibroConsecutivo,
} from '../presentacion-libro-consecutivo';

export function LibroConsecutivoClient() {
  const { usuario, cargando: cargandoAuth } = useAuth();
  const [expedientes, setExpedientes] = useState<ExpedienteLicenciaDoc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default = año en curso (spec) — el selector se recalcula con datos
  // reales en cuanto llega la respuesta (`añosDisponiblesLibro`).
  const [año, setAño] = useState<number>(() => new Date().getFullYear());

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
  const conteos = useMemo(
    () => ({
      total: filas.length,
      prueba: filas.filter((f) => f.esPrueba).length,
      conActoFinal: filas.filter((f) => f.numeroLicencia !== null).length,
    }),
    [filas],
  );

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
            style={{ background: '#D4A017', color: '#14532D', boxShadow: '0 2px 8px rgba(212,160,23,0.25)' }}
          >
            Exportar CSV ↓
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]"
            style={{ background: 'transparent', color: '#14532D', border: '1px solid #14532D' }}
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
        className="rounded-xl p-3.5"
        style={{ background: '#E9F0FC', border: '1px solid rgba(37,99,235,0.25)' }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: '#1E4FA0' }}>
          <strong>Libro del sistema</strong> — los expedientes históricos del Excel (2022–2026) se incorporarán con la migración (Fase 5).
        </p>
      </div>

      {/* ── Tabla ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{`Libro consecutivo de licencias, año ${año}`}</caption>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Th ancho={210}>N.° expediente</Th>
                <Th ancho={130}>Fecha radicación</Th>
                <Th>Solicitante</Th>
                <Th ancho={220}>Subtipos</Th>
                <Th ancho={200}>Estado jurídico</Th>
                <Th ancho={140}>N.° licencia</Th>
                <Th ancho={130}>Fecha firmeza</Th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Cargando libro consecutivo…
                  </td>
                </tr>
              )}
              {!cargando && !error && filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Sin expedientes en {año}
                  </td>
                </tr>
              )}
              {!cargando &&
                filas.map((fila) => (
                  <tr key={fila.id} className="micro-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <NumeroLegal value={fila.numeroExpediente} variant="expediente" size="sm" />
                        {fila.esPrueba && <ChipPrueba />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-primary)' }}>
                      {formatFechaColombia(fila.fechaRadicacion)}
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-primary)' }}>
                      <p>{fila.solicitanteNombre}</p>
                      <p style={{ color: 'var(--text-secondary)' }}>{fila.solicitanteDocumento}</p>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {fila.subtipos.map((nombre) => (
                          <span
                            key={nombre}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
                          >
                            {nombre}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <ChipEstadoJuridico estado={fila.estadoJuridico} />
                    </td>
                    <td className="px-3 py-2.5 align-top font-mono" style={{ color: 'var(--text-primary)' }}>
                      {fila.numeroLicencia ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-primary)' }}>
                      {fila.fechaFirmeza ? formatFechaColombia(fila.fechaFirmeza) : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pie: conteos de reconciliación ── */}
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {conteos.total} expediente{conteos.total === 1 ? '' : 's'} en {año} · {conteos.prueba} de prueba · {conteos.conActoFinal} con acto final
      </p>
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
