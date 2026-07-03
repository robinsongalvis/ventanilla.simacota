'use client';

import { useMemo, useState } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

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

export interface VistaVentanillaProps {
  radicados: VentanillaRadicado[];
  puedeRadicar: boolean;
  onNuevaRadicacion: () => void;
  onAbrirBusquedaAvanzada: () => void;
  onAbrirRadicado: (radicadoId: string) => void;
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

function identidadProtegida(r: VentanillaRadicado): boolean {
  return r.identidadReservada === true || r.esAnonimo === true;
}

export function VistaVentanilla({
  radicados,
  puedeRadicar,
  onNuevaRadicacion,
  onAbrirBusquedaAvanzada,
  onAbrirRadicado,
}: VistaVentanillaProps) {
  const [consulta, setConsulta] = useState('');
  const q = consulta.toLowerCase().trim();

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
                      {identidadProtegida(r) ? 'Identidad protegida' : r.solicitante.nombreCompleto}
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

      {/* ── Recordatorio de límites del módulo ── */}
      <p className="px-4 md:px-6 py-3 text-[11px]" style={{ color: '#7A8B7F' }}>
        ¿Panorama del municipio y prioridades? Eso vive en el Tablero.
      </p>
    </div>
  );
}
