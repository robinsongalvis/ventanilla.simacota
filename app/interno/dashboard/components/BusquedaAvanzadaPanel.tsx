'use client';

/* ══════════════════════════════════════════════════════════════
   Panel de Búsqueda Histórica Avanzada (Sprint 2).

   Modal lateral que:
   - Expone los filtros (texto + selects + booleanos + rangos de fecha).
   - Lanza POST /api/radicados/busqueda-avanzada y muestra resultados.
   - Renderiza chips de filtros activos, permite limpiar uno o todos.
   - Permite exportar el Excel MIPG con los filtros activos.
   - Pagina (25 / 50 / 100).
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import {
  CATALOGO_TIPOS_SOLICITUD,
  getTipoSolicitudById,
} from '@/lib/catalogos/tipos-solicitud';
import {
  rangoFechaPreset,
  type FiltrosBusqueda,
  type PresetFecha,
} from '@/lib/busqueda/filtros-radicado';
import { nombreSolicitanteVisible } from '@/lib/seguridad/identidad-protegida';

const ESTADOS = [
  'PENDIENTE',
  'EN_REVISION',
  'ASIGNADO',
  'EN_PROCESO',
  'PRORROGA',
  'RESUELTO',
  'DEVUELTO',
  'RECHAZADO',
];

const PAGE_SIZES = [25, 50, 100] as const;

interface BusquedaResponse {
  items: VentanillaRadicado[];
  total: number;
  page: number;
  pageSize: 25 | 50 | 100;
  totalPaginas: number;
  filtrosAplicados: FiltrosBusqueda;
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onSeleccionar?: (radicado: VentanillaRadicado) => void;
  /** Callback opcional para exportar el Excel con los filtros activos. */
  onExportarExcel?: (filtros: FiltrosBusqueda) => void;
}

const VACIO: FiltrosBusqueda = {};

export function BusquedaAvanzadaPanel({
  abierto,
  onCerrar,
  onSeleccionar,
  onExportarExcel,
}: Props) {
  const [filtros, setFiltros] = useState<FiltrosBusqueda>(VACIO);
  const [preset, setPreset] = useState<PresetFecha>('PERSONALIZADO');
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [page, setPage] = useState(1);
  const [resultado, setResultado] = useState<BusquedaResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtrosActivos = useMemo(
    () => Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    [filtros],
  );

  const setFiltro = useCallback(<K extends keyof FiltrosBusqueda>(clave: K, valor: FiltrosBusqueda[K]) => {
    setFiltros((prev) => ({ ...prev, [clave]: valor }));
    setPage(1);
  }, []);

  const limpiarFiltro = useCallback((clave: keyof FiltrosBusqueda) => {
    setFiltros((prev) => {
      const next = { ...prev };
      delete next[clave];
      return next;
    });
    setPage(1);
  }, []);

  const limpiarTodos = useCallback(() => {
    setFiltros(VACIO);
    setPreset('PERSONALIZADO');
    setPage(1);
  }, []);

  const aplicarPreset = useCallback((p: PresetFecha) => {
    setPreset(p);
    const rango = rangoFechaPreset(p);
    setFiltros((prev) => ({
      ...prev,
      fechaDesde: rango.desde ?? prev.fechaDesde,
      fechaHasta: rango.hasta ?? prev.fechaHasta,
    }));
    setPage(1);
  }, []);

  const ejecutar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/radicados/busqueda-avanzada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filtros, page, pageSize }),
      });
      const data = (await res.json().catch(() => null)) as BusquedaResponse | { error?: string } | null;
      if (!res.ok || !data || 'error' in (data ?? {})) {
        const message = data && 'error' in data && data.error ? data.error : `HTTP ${res.status}`;
        throw new Error(message);
      }
      setResultado(data as BusquedaResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error ejecutando la búsqueda.');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }, [filtros, page, pageSize]);

  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(() => { void ejecutar(); }, 200);
    return () => clearTimeout(t);
  }, [abierto, ejecutar]);

  if (!abierto) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onCerrar}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-[var(--tema-fondo-ffffff)] flex flex-col shadow-2xl"
        style={{ borderLeft: '1px solid var(--tema-borde-dce4ea)' }}
        role="dialog"
        aria-label="Búsqueda histórica avanzada"
      >
        <header className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--tema-borde-dce4ea)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Sprint 2</p>
            <h2 className="text-lg font-black" style={{ color: 'var(--tema-texto-172033)' }}>Búsqueda histórica avanzada</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--tema-borde-dce4ea)', color: 'var(--tema-texto-172033)' }}
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </header>

        {/* Panel de filtros */}
        <div className="overflow-y-auto px-5 py-4 space-y-4" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
          <FiltrosGrid filtros={filtros} setFiltro={setFiltro} />

          <div className="rounded-xl border bg-[var(--tema-fondo-ffffff)] p-3" style={{ borderColor: 'var(--tema-borde-dce4ea)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Rango de fechas</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(['HOY', 'SEMANA', 'MES', 'MES_ANTERIOR', 'ANIO', 'PERSONALIZADO'] as PresetFecha[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => aplicarPreset(p)}
                  className="px-2 py-1 text-[11px] rounded-md border"
                  style={{
                    borderColor: preset === p ? 'var(--tema-borde-007049)' : 'var(--tema-borde-dce4ea)',
                    background: preset === p ? 'var(--tema-fondo-f4f9f6)' : 'var(--tema-fondo-ffffff)',
                    color: 'var(--tema-texto-172033)',
                  }}
                >
                  {labelPreset(p)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Desde">
                <input
                  type="date"
                  value={filtros.fechaDesde ?? ''}
                  onChange={(e) => setFiltro('fechaDesde', e.target.value)}
                  className="w-full text-xs rounded-md border px-2 py-1.5"
                  style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
                />
              </Field>
              <Field label="Hasta">
                <input
                  type="date"
                  value={filtros.fechaHasta ?? ''}
                  onChange={(e) => setFiltro('fechaHasta', e.target.value)}
                  className="w-full text-xs rounded-md border px-2 py-1.5"
                  style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
                />
              </Field>
            </div>
          </div>

          {/* Chips de filtros activos */}
          {filtrosActivos.length > 0 && (
            <div className="rounded-xl border bg-[var(--tema-fondo-ffffff)] p-3" style={{ borderColor: 'var(--tema-borde-dce4ea)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                  Filtros activos ({filtrosActivos.length})
                </p>
                <button
                  type="button"
                  onClick={limpiarTodos}
                  className="text-[11px] underline"
                  style={{ color: 'var(--tema-texto-d81e1e)' }}
                >
                  Limpiar filtros
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {filtrosActivos.map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px]"
                    style={{ background: 'var(--tema-fondo-f4f9f6)', color: 'var(--tema-texto-007049)', border: '1px solid var(--tema-borde-dce4ea)' }}
                  >
                    {labelChip(k as keyof FiltrosBusqueda, v)}
                    <button
                      type="button"
                      onClick={() => limpiarFiltro(k as keyof FiltrosBusqueda)}
                      aria-label={`Quitar ${k}`}
                      className="text-[12px] leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <label>Resultados por página</label>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value) as 25 | 50 | 100); setPage(1); }}
                className="rounded-md border px-2 py-1"
                style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {onExportarExcel && (
                <button
                  type="button"
                  onClick={() => onExportarExcel(filtros)}
                  className="text-xs px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--tema-borde-007049)', color: 'var(--tema-texto-007049)', background: 'var(--tema-fondo-ffffff)' }}
                  title="Exportar Excel MIPG con los filtros aplicados"
                >
                  Exportar Excel filtrado
                </button>
              )}
              <button
                type="button"
                onClick={ejecutar}
                disabled={cargando}
                className="text-xs px-3 py-2 rounded-lg font-bold text-white"
                style={{ background: 'var(--tema-fondo-007049)' }}
              >
                {cargando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs rounded-lg p-3" style={{ background: 'var(--tema-fondo-fef2f2)', color: 'var(--tema-texto-991b1b)', border: '1px solid var(--tema-borde-fecaca)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto border-t bg-[var(--tema-fondo-ffffff)]" style={{ borderColor: 'var(--tema-borde-dce4ea)' }}>
          {!resultado && !cargando && (
            <p className="px-5 py-6 text-xs" style={{ color: 'var(--text-secondary)' }}>Sin resultados aún. Aplica filtros y presiona Buscar.</p>
          )}
          {resultado && (
            <>
              <div className="px-5 py-3 sticky top-0 bg-[var(--tema-fondo-ffffff)] flex items-center justify-between text-xs" style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {resultado.total} resultado{resultado.total !== 1 ? 's' : ''} ·
                  Página {resultado.page} de {resultado.totalPaginas}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={resultado.page <= 1}
                    className="px-2 py-1 rounded-md border disabled:opacity-50"
                    style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(resultado.totalPaginas, p + 1))}
                    disabled={resultado.page >= resultado.totalPaginas}
                    className="px-2 py-1 rounded-md border disabled:opacity-50"
                    style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
              <ul className="divide-y" style={{ borderColor: 'var(--tema-borde-f4f9f6)' }}>
                {resultado.items.map((r) => (
                  <li key={r.radicadoId}>
                    <button
                      type="button"
                      onClick={() => onSeleccionar?.(r)}
                      className="w-full text-left px-5 py-3 hover:bg-[var(--tema-fondo-f7f9fb)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold" style={{ color: 'var(--tema-texto-172033)' }}>
                            {r.radicadoId} · {r.detalle?.asunto?.slice(0, 80) || 'Sin asunto'}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {r.solicitante?.nombreCompleto ? nombreSolicitanteVisible(r, r.solicitante.nombreCompleto) : '—'} ·{' '}
                            {NOMBRES_TENANT[r.clasificacion?.oficinaDestino] ?? r.clasificacion?.oficinaDestino} ·{' '}
                            {r.termino?.tipoSolicitudNombre}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {r.control?.fechaRadicado?.slice(0, 10)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
                {resultado.items.length === 0 && (
                  <li className="px-5 py-6 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Sin radicados que coincidan con los filtros.
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function labelPreset(p: PresetFecha): string {
  switch (p) {
    case 'HOY':           return 'Hoy';
    case 'SEMANA':        return 'Esta semana';
    case 'MES':           return 'Este mes';
    case 'MES_ANTERIOR':  return 'Mes anterior';
    case 'ANIO':          return 'Año actual';
    case 'PERSONALIZADO': return 'Personalizado';
  }
}

function labelChip(k: keyof FiltrosBusqueda, v: unknown): string {
  const etiqueta: Partial<Record<keyof FiltrosBusqueda, string>> = {
    q: 'Texto',
    radicadoId: 'Radicado',
    nombre: 'Solicitante',
    documento: 'Documento',
    correo: 'Correo',
    asunto: 'Asunto',
    tipoSolicitudId: 'Tipo',
    categoria: 'Categoría',
    dependencia: 'Dependencia',
    responsable: 'Responsable',
    estado: 'Estado',
    fechaDesde: 'Desde',
    fechaHasta: 'Hasta',
    mes: 'Mes',
    anio: 'Año',
    canalRespuesta: 'Canal',
    anonimo: 'Anónimo',
    reservado: 'Reservado',
    cumplioTermino: 'Cumplió término',
    conNotificacionFallida: 'Notif. fallida',
    conRespuestaOficial: 'Con respuesta',
  };
  let valor = String(v);
  if (k === 'tipoSolicitudId') valor = getTipoSolicitudById(String(v))?.nombre ?? String(v);
  if (k === 'dependencia') valor = NOMBRES_TENANT[String(v) as TenantId] ?? String(v);
  if (typeof v === 'boolean') valor = v ? 'Sí' : 'No';
  return `${etiqueta[k] ?? k}: ${valor}`;
}

function FiltrosGrid({
  filtros,
  setFiltro,
}: {
  filtros: FiltrosBusqueda;
  setFiltro: <K extends keyof FiltrosBusqueda>(k: K, v: FiltrosBusqueda[K]) => void;
}) {
  return (
    <div className="rounded-xl border bg-[var(--tema-fondo-ffffff)] p-3 grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ borderColor: 'var(--tema-borde-dce4ea)' }}>
      <Field label="Búsqueda rápida">
        <input
          type="search"
          placeholder="Radicado, nombre, documento, asunto, correo, dependencia, responsable, tipo…"
          value={filtros.q ?? ''}
          onChange={(e) => setFiltro('q', e.target.value)}
          className="w-full text-xs rounded-md border px-2 py-1.5"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        />
      </Field>
      <Field label="Número de radicado (exacto)">
        <input
          type="text"
          placeholder="1-WEB-2026-00000014"
          value={filtros.radicadoId ?? ''}
          onChange={(e) => setFiltro('radicadoId', e.target.value)}
          className="w-full text-xs rounded-md border px-2 py-1.5"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        />
      </Field>
      <Field label="Solicitante">
        <input
          type="text"
          value={filtros.nombre ?? ''}
          onChange={(e) => setFiltro('nombre', e.target.value)}
          className="w-full text-xs rounded-md border px-2 py-1.5"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        />
      </Field>
      <Field label="Documento">
        <input
          type="text"
          value={filtros.documento ?? ''}
          onChange={(e) => setFiltro('documento', e.target.value)}
          className="w-full text-xs rounded-md border px-2 py-1.5"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        />
      </Field>
      <Field label="Correo">
        <input
          type="email"
          value={filtros.correo ?? ''}
          onChange={(e) => setFiltro('correo', e.target.value)}
          className="w-full text-xs rounded-md border px-2 py-1.5"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        />
      </Field>
      <Field label="Asunto">
        <input
          type="text"
          value={filtros.asunto ?? ''}
          onChange={(e) => setFiltro('asunto', e.target.value)}
          className="w-full text-xs rounded-md border px-2 py-1.5"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        />
      </Field>
      <Field label="Tipo de solicitud">
        <select
          value={filtros.tipoSolicitudId ?? ''}
          onChange={(e) => setFiltro('tipoSolicitudId', e.target.value || undefined)}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Todos —</option>
          {CATALOGO_TIPOS_SOLICITUD.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </Field>
      <Field label="Categoría">
        <select
          value={filtros.categoria ?? ''}
          onChange={(e) => setFiltro('categoria', (e.target.value || undefined) as FiltrosBusqueda['categoria'])}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Todas —</option>
          <option value="PQRSD">PQRSD</option>
          <option value="TRAMITE">Trámite</option>
          <option value="INTERNO">Interno</option>
          <option value="ESPECIAL">Especial</option>
        </select>
      </Field>
      <Field label="Dependencia">
        <select
          value={filtros.dependencia ?? ''}
          onChange={(e) => setFiltro('dependencia', (e.target.value || undefined) as TenantId)}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Todas —</option>
          {Object.entries(NOMBRES_TENANT).map(([id, nombre]) => (
            <option key={id} value={id}>{nombre}</option>
          ))}
        </select>
      </Field>
      <Field label="Responsable">
        <input
          type="text"
          value={filtros.responsable ?? ''}
          onChange={(e) => setFiltro('responsable', e.target.value)}
          className="w-full text-xs rounded-md border px-2 py-1.5"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        />
      </Field>
      <Field label="Estado">
        <select
          value={filtros.estado ?? ''}
          onChange={(e) => setFiltro('estado', e.target.value || undefined)}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Todos —</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </Field>
      <Field label="Canal de respuesta">
        <select
          value={filtros.canalRespuesta ?? ''}
          onChange={(e) => setFiltro('canalRespuesta', e.target.value || undefined)}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Todos —</option>
          <option value="CORREO">Correo</option>
          <option value="TELEFONO">Teléfono</option>
          <option value="PRESENCIAL">Presencial</option>
          <option value="DIRECCION_FISICA">Dirección física</option>
        </select>
      </Field>
      <Field label="Mes">
        <select
          value={filtros.mes ?? ''}
          onChange={(e) => setFiltro('mes', e.target.value ? Number(e.target.value) : undefined)}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Cualquier mes —</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>
      </Field>
      <Field label="Año">
        <input
          type="number"
          min={2020}
          max={2099}
          value={filtros.anio ?? ''}
          onChange={(e) => setFiltro('anio', e.target.value ? Number(e.target.value) : undefined)}
          className="w-full text-xs rounded-md border px-2 py-1.5"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        />
      </Field>
      <Field label="Anónimo">
        <select
          value={filtros.anonimo === undefined ? '' : filtros.anonimo ? 'true' : 'false'}
          onChange={(e) => setFiltro('anonimo', e.target.value === '' ? undefined : e.target.value === 'true')}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Indistinto —</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      </Field>
      <Field label="Identidad reservada">
        <select
          value={filtros.reservado === undefined ? '' : filtros.reservado ? 'true' : 'false'}
          onChange={(e) => setFiltro('reservado', e.target.value === '' ? undefined : e.target.value === 'true')}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Indistinto —</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      </Field>
      <Field label="Cumplió término">
        <select
          value={filtros.cumplioTermino === undefined || filtros.cumplioTermino === null ? '' : filtros.cumplioTermino ? 'true' : 'false'}
          onChange={(e) => setFiltro('cumplioTermino', e.target.value === '' ? undefined : e.target.value === 'true')}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Indistinto —</option>
          <option value="true">Sí — en término</option>
          <option value="false">No — fuera de término</option>
        </select>
      </Field>
      <Field label="Notificación fallida">
        <select
          value={filtros.conNotificacionFallida === undefined ? '' : 'true'}
          onChange={(e) => setFiltro('conNotificacionFallida', e.target.value === 'true' ? true : undefined)}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Indistinto —</option>
          <option value="true">Solo radicados con notificación fallida</option>
        </select>
      </Field>
      <Field label="Con respuesta oficial">
        <select
          value={filtros.conRespuestaOficial === undefined ? '' : 'true'}
          onChange={(e) => setFiltro('conRespuestaOficial', e.target.value === 'true' ? true : undefined)}
          className="w-full text-xs rounded-md border px-2 py-1.5 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
        >
          <option value="">— Indistinto —</option>
          <option value="true">Solo radicados con respuesta oficial</option>
        </select>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
