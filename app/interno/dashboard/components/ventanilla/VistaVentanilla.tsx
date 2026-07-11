'use client';

import { useMemo, useState } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  filtrarTrabajoHoy,
  trabajoDeHoy,
  type FilaTrabajoHoy,
  type FiltroTrabajoHoy,
  type PendienteMostrador,
} from '@/lib/mostrador/trabajo-de-hoy';
import { nombreSolicitanteVisible } from '@/lib/seguridad/identidad-protegida';

/* ══════════════════════════════════════════════════════════════
   Ventanilla · módulo de mostrador — "Atención al ciudadano".

   Intención distinta del Tablero: aquí no hay panorama ni KPIs, hay
   un ciudadano al frente. La búsqueda es la protagonista y "Nueva
   radicación" la acción primaria (única superficie dorada).

   La búsqueda tiene estado PROPIO: no comparte el `busqueda` del
   reducer del Tablero para no arrastrar filtros apilados entre
   módulos (lección del Nivel 3A).
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#14532D';
const DORADO     = '#D4A017';

const MAX_RESULTADOS = 8;

/** Trío visual de cada chip de pendiente (color = estado, nunca decora). */
const CHIP_PENDIENTE: Record<PendienteMostrador, { label: string; bg: string; texto: string }> = {
  SELLAR_PDF:            { label: 'PDF sin sellar',        bg: '#FAEEDA', texto: '#7A4F0A' },
  DATOS_INCOMPLETOS:     { label: 'Datos incompletos',     bg: '#FAEEDA', texto: '#7A4F0A' },
  CORREO_FALLIDO:        { label: 'Correo fallido',        bg: '#FCEBEB', texto: '#911111' },
  CONSTANCIA_SIN_ENVIAR: { label: 'Constancia sin enviar', bg: '#FAEEDA', texto: '#7A4F0A' },
};

/** Riel izquierdo de la fila según su pendiente más urgente. */
function rielFila(f: FilaTrabajoHoy): string {
  if (f.pendientes.includes('CORREO_FALLIDO')) return '#DC2626';
  if (f.pendientes.length > 0)                 return '#D97706';
  return VERDE_INST;
}

export interface VistaVentanillaProps {
  radicados: VentanillaRadicado[];
  puedeRadicar: boolean;
  onNuevaRadicacion: () => void;
  onAbrirBusquedaAvanzada: () => void;
  onAbrirRadicado: (radicadoId: string) => void;
  /** Sprint Radicación de salida — presente solo para roles que
   *  registran despachos; abre el modal de oficio independiente. */
  onRegistrarSalida?: () => void;
  /** Sprint Planilla de reparto — presente solo para Recepción/Admin;
   *  abre el panel de entrega de documentos físicos. */
  onAbrirReparto?: () => void;
  /** Referencia temporal inyectable para tests deterministas. */
  ahora?: Date;
}

/**
 * Coincidencia de mostrador: radicado, cédula o nombre del ciudadano —
 * exactamente lo que promete el placeholder. Para todo lo demás está
 * la búsqueda avanzada.
 */
function coincideMostrador(r: VentanillaRadicado, q: string): boolean {
  return (
    r.radicadoId.toLowerCase().includes(q) ||
    r.solicitante.nombreCompleto.toLowerCase().includes(q) ||
    r.solicitante.numeroDocumento.includes(q)
  );
}

export function VistaVentanilla({
  radicados,
  puedeRadicar,
  onNuevaRadicacion,
  onAbrirBusquedaAvanzada,
  onAbrirRadicado,
  onRegistrarSalida,
  onAbrirReparto,
  ahora,
}: VistaVentanillaProps) {
  const [consulta, setConsulta] = useState('');
  const [filtroHoy, setFiltroHoy] = useState<FiltroTrabajoHoy>('TODOS');
  const q = consulta.toLowerCase().trim();

  const hoy = useMemo(
    () => trabajoDeHoy(radicados, ahora ?? new Date()),
    [radicados, ahora],
  );
  const filasVisibles = useMemo(
    () => filtrarTrabajoHoy(hoy.filas, filtroHoy),
    [hoy.filas, filtroHoy],
  );

  const fechaLegible = (ahora ?? new Date()).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
  });

  const resultados = useMemo(() => {
    if (!q) return [];
    return radicados.filter((r) => coincideMostrador(r, q)).slice(0, MAX_RESULTADOS);
  }, [radicados, q]);

  /* Enter abre el radicado si la coincidencia es inequívoca: id exacto
     o un único resultado. */
  const abrirCoincidenciaExacta = () => {
    const exacto = resultados.find((r) => r.radicadoId.toLowerCase() === q);
    const unico  = resultados.length === 1 ? resultados[0] : null;
    const destino = exacto ?? unico;
    if (destino) onAbrirRadicado(destino.radicadoId);
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: '#F8FAF7' }}>
      {/* ── Header del mostrador ── */}
      <div
        className="flex items-center justify-between gap-3 px-4 md:px-6 pt-4 pb-3 bg-white"
        style={{ borderBottom: '1px solid #E3EAE3' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#8A6A12' }}>
              Mostrador de atención
            </span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: DORADO }} />
          </div>
          <p className="text-lg font-black leading-tight mt-0.5 truncate" style={{ color: '#12261A' }}>
            Ventanilla · Atención al ciudadano
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
        {onAbrirReparto && (
          <button
            type="button"
            onClick={onAbrirReparto}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold px-4 py-2.5 rounded-[10px] transition-colors hover:bg-[#EEF4EE]"
            style={{ border: '1px solid #14532D', color: '#14532D', background: 'white' }}
          >
            Reparto del día
          </button>
        )}
        {onRegistrarSalida && (
          <button
            type="button"
            onClick={onRegistrarSalida}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold px-4 py-2.5 rounded-[10px] transition-colors hover:bg-[#EEF4EE]"
            style={{ border: '1px solid #14532D', color: '#14532D', background: 'white' }}
          >
            Registrar salida
          </button>
        )}
        {puedeRadicar && (
          <button
            type="button"
            onClick={onNuevaRadicacion}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold px-4 py-2.5 rounded-[10px] shrink-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/40"
            style={{ background: DORADO, color: '#3D2C00', border: '1px solid #B8890F' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            Nueva radicación
          </button>
        )}
        </div>
      </div>

      {/* ── Búsqueda protagonista ── */}
      <div className="px-4 md:px-6 py-4 bg-white" style={{ borderBottom: '1px solid #E3EAE3' }}>
        <div
          className="flex items-center gap-2.5 h-12 px-4 rounded-xl bg-white"
          style={{ border: `1.5px solid ${VERDE_INST}` }}
        >
          <svg className="w-5 h-5 shrink-0" style={{ color: VERDE_INST }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') abrirCoincidenciaExacta(); }}
            placeholder="Radicado, cédula o nombre del ciudadano…"
            aria-label="Buscar radicado por número, cédula o nombre"
            className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-slate-400"
            style={{ color: '#12261A' }}
          />
          {consulta && (
            <button
              type="button"
              onClick={() => setConsulta('')}
              aria-label="Limpiar búsqueda"
              className="text-slate-400 hover:text-slate-600 shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          <span className="text-[11px]" style={{ color: '#7A8B7F' }}>
            Un radicado completo abre el detalle con Enter
          </span>
          <button
            type="button"
            onClick={onAbrirBusquedaAvanzada}
            className="inline-flex items-center gap-1 text-xs font-semibold shrink-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 rounded"
            style={{ color: VERDE_INST }}
          >
            Búsqueda avanzada
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Resultados de la consulta ── */}
      {q && (
        <div className="px-4 md:px-6 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#5F8A6E' }}>
            {resultados.length === 0
              ? 'Sin coincidencias'
              : `${resultados.length} coincidencia${resultados.length === 1 ? '' : 's'}`}
          </p>
          {resultados.length > 0 && (
            <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E3EAE3' }}>
              {resultados.map((r, i) => (
                <button
                  key={r.radicadoId}
                  type="button"
                  onClick={() => onAbrirRadicado(r.radicadoId)}
                  aria-label={`Abrir radicado ${r.radicadoId}`}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F4F8F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                  style={i > 0 ? { borderTop: '1px solid #EEF2EE' } : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[13px] font-bold truncate" style={{ color: '#12261A' }}>
                      {r.radicadoId}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: '#5F6F64' }}>
                      {nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}
                      {' · '}
                      {NOMBRES_TENANT[r.clasificacion.oficinaDestino] ?? r.clasificacion.oficinaDestino}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold shrink-0" style={{ color: VERDE_INST }}>
                    Abrir
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          )}
          {resultados.length === 0 && (
            <p className="text-xs" style={{ color: '#7A8B7F' }}>
              Nada con &ldquo;{consulta.trim()}&rdquo; en la bandeja actual. Prueba la búsqueda avanzada
              para el histórico completo.
            </p>
          )}
        </div>
      )}

      {/* ── Trabajo de hoy (oculto mientras se busca) ── */}
      {!q && (
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[13px] font-bold" style={{ color: '#12261A' }}>
                Trabajo de hoy
              </span>
              <span className="text-[11px] truncate" style={{ color: '#7A8B7F' }}>
                {fechaLegible} · {hoy.filas.length} radicado{hoy.filas.length === 1 ? '' : 's'}
              </span>
            </div>
            {hoy.filas.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <ChipFiltroHoy
                  label="Todos"
                  conteo={hoy.filas.length}
                  activo={filtroHoy === 'TODOS'}
                  color={VERDE_INST}
                  onClick={() => setFiltroHoy('TODOS')}
                />
                {hoy.conteos.sellarPdf > 0 && (
                  <ChipFiltroHoy
                    label="PDF sin sellar"
                    conteo={hoy.conteos.sellarPdf}
                    activo={filtroHoy === 'SELLAR_PDF'}
                    color="#854F0B"
                    onClick={() => setFiltroHoy(filtroHoy === 'SELLAR_PDF' ? 'TODOS' : 'SELLAR_PDF')}
                  />
                )}
                {hoy.conteos.datosIncompletos > 0 && (
                  <ChipFiltroHoy
                    label="Datos incompletos"
                    conteo={hoy.conteos.datosIncompletos}
                    activo={filtroHoy === 'DATOS_INCOMPLETOS'}
                    color="#854F0B"
                    onClick={() => setFiltroHoy(filtroHoy === 'DATOS_INCOMPLETOS' ? 'TODOS' : 'DATOS_INCOMPLETOS')}
                  />
                )}
                {hoy.conteos.correoFallido > 0 && (
                  <ChipFiltroHoy
                    label="Correo fallido"
                    conteo={hoy.conteos.correoFallido}
                    activo={filtroHoy === 'CORREO_FALLIDO'}
                    color="#A32D2D"
                    onClick={() => setFiltroHoy(filtroHoy === 'CORREO_FALLIDO' ? 'TODOS' : 'CORREO_FALLIDO')}
                  />
                )}
                {hoy.conteos.constanciaSinEnviar > 0 && (
                  <ChipFiltroHoy
                    label="Constancia sin enviar"
                    conteo={hoy.conteos.constanciaSinEnviar}
                    activo={filtroHoy === 'CONSTANCIA_SIN_ENVIAR'}
                    color="#854F0B"
                    onClick={() => setFiltroHoy(filtroHoy === 'CONSTANCIA_SIN_ENVIAR' ? 'TODOS' : 'CONSTANCIA_SIN_ENVIAR')}
                  />
                )}
              </div>
            )}
          </div>

          {hoy.filas.length === 0 ? (
            <p className="mt-3 text-xs" style={{ color: '#7A8B7F' }}>
              Hoy no se han radicado documentos. El primero del día aparecerá aquí
              con sus pendientes de recepción.
            </p>
          ) : (
            <div className="mt-2.5 rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E3EAE3' }}>
              {filasVisibles.map((f, i) => (
                <FilaTrabajoHoyItem
                  key={f.radicadoId}
                  fila={f}
                  primera={i === 0}
                  onAbrir={() => onAbrirRadicado(f.radicadoId)}
                />
              ))}
              {filasVisibles.length === 0 && (
                <p className="px-4 py-3 text-xs italic" style={{ color: '#94A3B8' }}>
                  Ninguna fila coincide con el filtro elegido.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Recordatorio de límites del módulo ── */}
      <p className="px-4 md:px-6 py-3 text-[11px]" style={{ color: '#7A8B7F' }}>
        ¿Panorama del municipio y prioridades? Eso vive en el Tablero.
      </p>
    </div>
  );
}

function ChipFiltroHoy({
  label,
  conteo,
  activo,
  color,
  onClick,
}: {
  label: string;
  conteo: number;
  activo: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={`Filtrar trabajo de hoy: ${label} (${conteo})`}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
      style={activo
        ? { background: '#EEF4EE', border: `1px solid ${VERDE_INST}`, color: VERDE_INST }
        : { background: '#FFFFFF', border: '1px solid #E3EAE3', color }}
    >
      {label} · {conteo}
    </button>
  );
}

function FilaTrabajoHoyItem({
  fila,
  primera,
  onAbrir,
}: {
  fila: FilaTrabajoHoy;
  primera: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Abrir radicado ${fila.radicadoId}`}
      className="w-full flex items-center gap-3 pr-4 text-left hover:bg-[#F4F8F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
      style={primera ? undefined : { borderTop: '1px solid #EEF2EE' }}
    >
      <span className="w-[3px] self-stretch shrink-0" style={{ background: rielFila(fila) }} />
      <span className="text-[11px] w-10 shrink-0 py-3 tabular-nums" style={{ color: '#7A8B7F' }}>
        {fila.horaRadicado}
      </span>
      <span className="flex-1 min-w-0 py-2.5">
        <span className="block font-mono text-[13px] font-bold truncate" style={{ color: '#12261A' }}>
          {fila.radicadoId}
        </span>
        <span className="block text-[11px] truncate" style={{ color: '#5F6F64' }}>
          {fila.tipoSolicitudNombre} · {NOMBRES_TENANT[fila.oficinaDestino] ?? fila.oficinaDestino}
        </span>
      </span>
      <span className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
        {fila.identidadReservada && (
          <span
            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#EEF2F5', color: '#3A4551' }}
          >
            Identidad reservada
          </span>
        )}
        {fila.pendientes.map((p) => (
          <span
            key={p}
            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: CHIP_PENDIENTE[p].bg, color: CHIP_PENDIENTE[p].texto }}
          >
            {CHIP_PENDIENTE[p].label}
          </span>
        ))}
        {fila.pendientes.length === 0 && (
          <span
            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#EEF4EE', color: VERDE_INST }}
          >
            Al día
          </span>
        )}
      </span>
      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold shrink-0" style={{ color: VERDE_INST }}>
        Abrir
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}
