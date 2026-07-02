'use client';

import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { useCargaDependencias, type AlertaTono, type CargaDependencia } from './useCargaDependencias';
import { filtroMipgParaCelda, type CeldaDependencia } from './filtro-celda';
import { useVentanilla, type FiltroMIPG } from '@/lib/store/ventanillaStore';

/* ── Paleta institucional clara por tono ──────────────────────── */

/** Borde izquierdo de la fila (accent) */
const SPINE_CLS: Record<AlertaTono, string> = {
  rose:   'border-l-red-400',
  amber:  'border-l-amber-400',
  indigo: 'border-l-[#14532D]',
  slate:  'border-l-gray-300',
};

/** Color del número total */
const VALOR_STYLE: Record<AlertaTono, React.CSSProperties> = {
  rose:   { color: '#DC2626' },
  amber:  { color: '#D97706' },
  indigo: { color: '#14532D' },
  slate:  { color: '#94A3B8' },
};

/** Color de la barra de carga */
const BARRA_CLS: Record<AlertaTono, string> = {
  rose:   'bg-red-500',
  amber:  'bg-amber-500',
  indigo: 'bg-[#14532D]',
  slate:  'bg-gray-300',
};

/** Borde-left de la tarjeta KPI */
const CARD_BORDER_COLOR: Record<AlertaTono, string> = {
  rose:   '#F87171',
  amber:  '#FBBF24',
  indigo: '#14532D',
  slate:  '#D9E2D9',
};

/** Color del número en la tarjeta KPI */
const CARD_VALOR_STYLE: Record<AlertaTono, React.CSSProperties> = {
  rose:   { color: '#DC2626' },
  amber:  { color: '#D97706' },
  indigo: { color: '#14532D' },
  slate:  { color: '#94A3B8' },
};

/** Chips de estado — badge claro */
const CHIP_CLS_PEND  = 'bg-yellow-50  text-yellow-700 border-yellow-200';
const CHIP_CLS_PROC  = 'bg-sky-50     text-sky-700    border-sky-200';
const CHIP_CLS_PV    = 'bg-amber-50   text-amber-700  border-amber-200';
const CHIP_CLS_VENC  = 'bg-red-50     text-red-700    border-red-200';

/* ── ChipEstado ─────────────────────────────────────────────── */

function ChipEstado({
  valor,
  label,
  cls,
  onClick,
  ariaLabel,
}: {
  valor: number;
  label: string;
  cls: string;
  /** Panel Op Nivel 2 — clic en el chip navega a la bandeja filtrada
   *  por dependencia + estado (la celda de la matriz es navegable). */
  onClick?: () => void;
  ariaLabel?: string;
}) {
  if (valor === 0) return null;
  if (!onClick) {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums border leading-none ${cls}`}>
        {label}&nbsp;{valor}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums border leading-none cursor-pointer transition-transform active:scale-95 hover:ring-2 hover:ring-emerald-700/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 ${cls}`}
    >
      {label}&nbsp;{valor}
    </button>
  );
}

/* ── FilaDependencia ────────────────────────────────────────── */

function FilaDependencia({
  dep,
  onVer,
  onVerCelda,
}: {
  dep: CargaDependencia;
  onVer: (id: TenantId) => void;
  onVerCelda: (id: TenantId, celda: CeldaDependencia) => void;
}) {
  const celda = (c: CeldaDependencia, valor: number) => ({
    onClick:   () => onVerCelda(dep.tenantId, c),
    ariaLabel: `Ver ${valor} radicado${valor === 1 ? '' : 's'} (${c}) de ${dep.nombre}`,
  });
  return (
    <tr
      className={`border-l-4 ${SPINE_CLS[dep.alertaTono]} transition-colors group`}
      style={{
        borderBottom: '1px solid #EEF4EE',
        opacity: dep.total === 0 ? 0.45 : 1,
      }}
      onMouseEnter={(e) => { if (dep.total > 0) (e.currentTarget as HTMLElement).style.background = '#F8FAF7'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      {/* Nombre */}
      <td className="px-4 py-3 max-w-[220px]">
        <p className="text-sm font-medium leading-snug truncate" style={{ color: '#1F2933' }}>{dep.nombre}</p>
      </td>

      {/* Total */}
      <td className="px-4 py-3 whitespace-nowrap w-16">
        <span className="text-xl font-black tabular-nums leading-none" style={VALOR_STYLE[dep.alertaTono]}>
          {dep.total}
        </span>
      </td>

      {/* Chips de estado */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 flex-wrap min-w-[160px]">
          <ChipEstado valor={dep.pendientes} label="PEND" cls={CHIP_CLS_PEND} {...celda('pendientes', dep.pendientes)} />
          <ChipEstado valor={dep.enProceso}  label="PROC" cls={CHIP_CLS_PROC} {...celda('enProceso',  dep.enProceso)}  />
          <ChipEstado valor={dep.porVencer}  label="PV"   cls={CHIP_CLS_PV}   {...celda('porVencer',  dep.porVencer)}  />
          <ChipEstado valor={dep.vencidos}   label="VENC" cls={CHIP_CLS_VENC} {...celda('vencidos',   dep.vencidos)}   />
          {dep.total === 0 && (
            <span className="text-[10px] italic" style={{ color: '#94A3B8' }}>sin carga</span>
          )}
        </div>
      </td>

      {/* Barra de carga */}
      <td className="px-4 py-3 w-36">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF4EE' }}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${BARRA_CLS[dep.alertaTono]}`}
            style={{ width: `${dep.cargaRelativa}%` }}
          />
        </div>
        <p className="text-[10px] mt-1 tabular-nums" style={{ color: '#94A3B8' }}>{dep.cargaRelativa}%</p>
      </td>

      {/* Acción */}
      <td className="px-3 py-3 whitespace-nowrap w-16">
        {dep.total > 0 && (
          <button
            onClick={() => onVer(dep.tenantId)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            style={{ color: '#14532D', background: '#EEF4EE', border: '1px solid #D9E2D9' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#D9E2D9'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
          >
            Ver →
          </button>
        )}
      </td>
    </tr>
  );
}

/* ── PanelCargaDependencias ─────────────────────────────────── */

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

  // Panel Op Nivel 2 — la celda de la matriz es navegable: clic en un
  // chip abre la bandeja filtrada por esa dependencia Y ese estado.
  // El conteo del chip coincide exactamente con las filas visibles
  // (mismos criterios en useCargaDependencias y aplicarFiltroMIPG).
  function verCelda(tenantId: TenantId, celda: CeldaDependencia) {
    const filtro: FiltroMIPG = filtroMipgParaCelda(celda);
    dispatch({ type: 'SET_TENANT_FILTRO', tenant: tenantId });
    dispatch({ type: 'SET_FILTRO_MIPG',   filtro });
    dispatch({ type: 'SET_VISTA',          vista: 'TABLERO' });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#F8FAF7]">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white shrink-0"
           style={{ borderBottom: '1px solid #D9E2D9' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
            Panel Operacional
          </p>
          <h2 className="text-base font-black mt-0.5" style={{ color: '#1F2933' }}>Carga por Dependencia</h2>
        </div>
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: '#667085' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Tiempo real
        </span>
      </div>

      {/* KPI cards */}
      <div className="px-5 py-3 shrink-0 bg-white" style={{ borderBottom: '1px solid #D9E2D9' }}>
        <div className="flex gap-3 overflow-x-auto pb-0.5">
          {tarjetas.map((t) => (
            <div
              key={t.label}
              className="shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border-l-4 bg-white"
              style={{
                border: '1px solid #D9E2D9',
                borderLeftColor: CARD_BORDER_COLOR[t.tono],
                borderLeftWidth: 4,
              }}
            >
              <span className="text-2xl font-black leading-none tabular-nums" style={CARD_VALOR_STYLE[t.tono]}>
                {t.valor}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#94A3B8' }}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ background: '#EEF4EE' }}>
            <tr style={{ borderBottom: '1px solid #D9E2D9' }}>
              {['Dependencia', 'Total', 'Estado de carga', 'Carga relativa', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: '#14532D' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deps.map((dep) => (
              <FilaDependencia key={dep.tenantId} dep={dep} onVer={verDependencia} onVerCelda={verCelda} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
