'use client';

import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { useCargaDependencias, type AlertaTono, type CargaDependencia } from './useCargaDependencias';
import { useVentanilla } from '@/lib/store/ventanillaStore';

/* ─── Tailwind class maps — full strings required for JIT detection ─── */

const SPINE_CLS: Record<AlertaTono, string> = {
  rose:   'border-l-rose-500',
  amber:  'border-l-amber-500',
  indigo: 'border-l-indigo-500',
  slate:  'border-l-slate-700',
};

const VALOR_CLS: Record<AlertaTono, string> = {
  rose:   'text-rose-300',
  amber:  'text-amber-300',
  indigo: 'text-slate-100',
  slate:  'text-slate-600',
};

const BARRA_CLS: Record<AlertaTono, string> = {
  rose:   'bg-rose-500',
  amber:  'bg-amber-500',
  indigo: 'bg-indigo-500',
  slate:  'bg-slate-700',
};

const CARD_BORDE: Record<AlertaTono, string> = {
  rose:   'border-rose-500',
  amber:  'border-amber-500',
  indigo: 'border-indigo-500',
  slate:  'border-slate-600',
};

const CARD_TEXTO: Record<AlertaTono, string> = {
  rose:   'text-rose-300',
  amber:  'text-amber-300',
  indigo: 'text-indigo-300',
  slate:  'text-slate-500',
};

/* ─── ChipEstado ─── */

function ChipEstado({ valor, label, cls }: { valor: number; label: string; cls: string }) {
  if (valor === 0) return null;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums border leading-none ${cls}`}
    >
      {label}&nbsp;{valor}
    </span>
  );
}

/* ─── FilaDependencia ─── */

function FilaDependencia({
  dep,
  onVer,
}: {
  dep: CargaDependencia;
  onVer: (id: TenantId) => void;
}) {
  return (
    <tr
      className={`border-b border-white/[0.04] border-l-4 ${SPINE_CLS[dep.alertaTono]} transition-colors group ${
        dep.total === 0 ? 'opacity-40' : 'hover:bg-white/[0.025]'
      }`}
    >
      {/* Nombre */}
      <td className="px-4 py-3 max-w-[220px]">
        <p className="text-sm font-medium text-slate-200 leading-snug truncate">{dep.nombre}</p>
      </td>

      {/* Total */}
      <td className="px-4 py-3 whitespace-nowrap w-16">
        <span className={`text-xl font-black tabular-nums leading-none ${VALOR_CLS[dep.alertaTono]}`}>
          {dep.total}
        </span>
      </td>

      {/* Chips de estado */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 flex-wrap min-w-[160px]">
          <ChipEstado
            valor={dep.pendientes}
            label="PEND"
            cls="bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
          />
          <ChipEstado
            valor={dep.enProceso}
            label="PROC"
            cls="bg-sky-500/20 text-sky-300 border-sky-500/30"
          />
          <ChipEstado
            valor={dep.porVencer}
            label="PV"
            cls="bg-amber-500/20 text-amber-300 border-amber-500/30"
          />
          <ChipEstado
            valor={dep.vencidos}
            label="VENC"
            cls="bg-rose-500/20 text-rose-300 border-rose-500/30"
          />
          {dep.total === 0 && (
            <span className="text-[10px] text-slate-700 italic">sin carga</span>
          )}
        </div>
      </td>

      {/* Barra de carga */}
      <td className="px-4 py-3 w-36">
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${BARRA_CLS[dep.alertaTono]}`}
            style={{ width: `${dep.cargaRelativa}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-700 mt-1 tabular-nums">{dep.cargaRelativa}%</p>
      </td>

      {/* Acción */}
      <td className="px-3 py-3 whitespace-nowrap w-16">
        {dep.total > 0 && (
          <button
            onClick={() => onVer(dep.tenantId)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10 active:scale-95 transition-all duration-150 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            Ver →
          </button>
        )}
      </td>
    </tr>
  );
}

/* ─── PanelCargaDependencias ─── */

export function PanelCargaDependencias({ radicados }: { radicados: VentanillaRadicado[] }) {
  const { dispatch } = useVentanilla();
  const deps = useCargaDependencias(radicados);

  const conVencidos = deps.filter((d) => d.vencidos > 0).length;
  const conAlerta   = deps.filter((d) => d.porVencer > 0 && d.vencidos === 0).length;
  const activas     = deps.filter((d) => d.total > 0).length;
  const sinCarga    = deps.filter((d) => d.total === 0).length;

  const tarjetas: { label: string; valor: number; tono: AlertaTono }[] = [
    { label: 'Con vencidos',  valor: conVencidos, tono: 'rose'  },
    { label: 'Con alertas',   valor: conAlerta,   tono: 'amber' },
    { label: 'Con actividad', valor: activas,     tono: 'indigo'},
    { label: 'Sin carga',     valor: sinCarga,    tono: 'slate' },
  ];

  function verDependencia(tenantId: TenantId) {
    dispatch({ type: 'SET_TENANT_FILTRO', tenant: tenantId });
    dispatch({ type: 'SET_FILTRO_MIPG',   filtro: 'TODOS'   });
    dispatch({ type: 'SET_VISTA',          vista:  'TABLERO' });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.07] shrink-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Panel Operacional</p>
          <h2 className="text-base font-black text-slate-50 mt-0.5">Carga por Dependencia</h2>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Tiempo real
        </span>
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 border-b border-white/[0.07] bg-slate-900/20 shrink-0">
        <div className="flex gap-3 overflow-x-auto pb-0.5">
          {tarjetas.map((t) => (
            <div
              key={t.label}
              className={`shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border border-l-4 bg-slate-900/40 border-t-white/[0.08] border-r-white/[0.08] border-b-white/[0.08] ${CARD_BORDE[t.tono]}`}
            >
              <span className={`text-2xl font-black leading-none tabular-nums ${CARD_TEXTO[t.tono]}`}>
                {t.valor}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 opacity-70 ${CARD_TEXTO[t.tono]}`}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla densa */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm">
            <tr className="border-b border-white/[0.07]">
              {['Dependencia', 'Total', 'Estado de carga', 'Carga relativa', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deps.map((dep) => (
              <FilaDependencia key={dep.tenantId} dep={dep} onVer={verDependencia} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
