'use client';

import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { useCargaDependencias, type AlertaTono, type CargaDependencia } from './useCargaDependencias';
import { filtroMipgParaCelda, type CeldaDependencia } from './filtro-celda';
import { useVentanilla, type FiltroMIPG } from '@/lib/store/ventanillaStore';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import type { IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { CabeceraTablaSticky, SuperficieTabla } from '@/app/components/design-system/SuperficieTabla';
import { Activity, AlertTriangle, CircleDashed, Clock3 } from 'lucide-react';

/* ── Paleta institucional clara por tono ──────────────────────── */

/** Borde izquierdo de la fila (accent) */
const SPINE_CLS: Record<AlertaTono, string> = {
  rose:   'border-l-red-400',
  amber:  'border-l-amber-400',
  indigo: 'border-l-[var(--tema-borde-007049)]',
  slate:  'border-l-gray-300',
};

/** Color del número total */
const VALOR_STYLE: Record<AlertaTono, React.CSSProperties> = {
  rose:   { color: 'var(--tema-texto-d81e1e)' },
  amber:  { color: 'var(--tema-texto-d97706)' },
  indigo: { color: 'var(--tema-texto-007049)' },
  slate:  { color: 'var(--tema-texto-64748b)' },
};

/** Color de la barra de carga */
const BARRA_CLS: Record<AlertaTono, string> = {
  rose:   'bg-red-500',
  amber:  'bg-amber-500',
  indigo: 'bg-[var(--tema-fondo-007049)]',
  slate:  'bg-gray-300',
};

/** Chips de estado — badge claro */
const CHIP_CLS_PEND  = 'bg-yellow-50 oscuro:bg-yellow-500/15  text-yellow-700 oscuro:text-yellow-300 border-yellow-200 oscuro:border-yellow-500/30';
const CHIP_CLS_PROC  = 'bg-sky-50 oscuro:bg-sky-500/15     text-sky-700 oscuro:text-sky-300    border-sky-200 oscuro:border-sky-500/30';
const CHIP_CLS_PV    = 'bg-amber-50 oscuro:bg-amber-500/15   text-amber-700 oscuro:text-amber-300  border-amber-200 oscuro:border-amber-500/30';
const CHIP_CLS_VENC  = 'bg-red-50 oscuro:bg-red-500/15     text-red-700 oscuro:text-red-300    border-red-200 oscuro:border-red-500/30';

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
      /* Sin carga: antes se atenuaba la fila entera (opacidad 0,45) y el
         nombre de la dependencia quedaba ilegible (2,8:1). Ahora se atenúa
         con el gris más claro que cumple AA: se distingue y se lee. */
      style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}
      onMouseEnter={(e) => { if (dep.total > 0) (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f7f9fb)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      {/* Nombre */}
      <td className="px-2 py-2 max-w-[220px]">
        <p className="text-sm font-medium leading-snug truncate" style={{ color: dep.total === 0 ? 'var(--tema-texto-64748b)' : 'var(--tema-texto-172033)' }}>{dep.nombre}</p>
      </td>

      {/* Total */}
      <td className="px-2 py-2 whitespace-nowrap w-16">
        <span className="text-xl font-black tabular-nums leading-none" style={VALOR_STYLE[dep.alertaTono]}>
          {dep.total}
        </span>
      </td>

      {/* Chips de estado */}
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 flex-wrap min-w-[160px]">
          <ChipEstado valor={dep.pendientes} label="PEND" cls={CHIP_CLS_PEND} {...celda('pendientes', dep.pendientes)} />
          <ChipEstado valor={dep.enProceso}  label="PROC" cls={CHIP_CLS_PROC} {...celda('enProceso',  dep.enProceso)}  />
          <ChipEstado valor={dep.porVencer}  label="PV"   cls={CHIP_CLS_PV}   {...celda('porVencer',  dep.porVencer)}  />
          <ChipEstado valor={dep.vencidos}   label="VENC" cls={CHIP_CLS_VENC} {...celda('vencidos',   dep.vencidos)}   />
          {dep.total === 0 && (
            <span className="text-[10px] italic" style={{ color: 'var(--tema-texto-64748b)' }}>sin carga</span>
          )}
        </div>
      </td>

      {/* Barra de carga */}
      <td className="px-2 py-2 w-36">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tema-fondo-f4f9f6)' }}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${BARRA_CLS[dep.alertaTono]}`}
            style={{ width: `${dep.cargaRelativa}%` }}
          />
        </div>
        <p className="text-[10px] mt-1 tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{dep.cargaRelativa}%</p>
      </td>

      {/* Acción */}
      <td className="px-2 py-2 whitespace-nowrap w-16">
        {dep.total > 0 && (
          <button
            onClick={() => onVer(dep.tenantId)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
            style={{ color: 'var(--tema-texto-007049)', background: 'var(--tema-fondo-f4f9f6)', border: '1px solid var(--tema-borde-dce4ea)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-dce4ea)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; }}
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

  /* Ola 3 (ADR-0046) — mismos cuatro conteos con el Indicador del Tablero.
     Cuentan dependencias, no filtran: son de solo lectura, no botones. */
  const tarjetas: IndicadorEstaticoProps[] = [
    { etiqueta: 'Con vencidos',  valor: conVencidos, tono: 'rojo',  Icono: AlertTriangle },
    { etiqueta: 'Con alertas',   valor: conAlerta,   tono: 'ambar', Icono: Clock3 },
    { etiqueta: 'Con actividad', valor: activas,     tono: 'verde', Icono: Activity },
    { etiqueta: 'Sin carga',     valor: sinCarga,    tono: 'gris',  Icono: CircleDashed },
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
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[var(--tema-fondo-f7f9fb)]">

      {/* Header */}
      <SectionHeader
        titulo="Carga por Dependencia"
        subtitulo="Panel Operacional"
        indicador={<span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
      />

      {/* Indicadores (lenguaje del Tablero) */}
      <FilaTarjetas etiqueta="Resumen de carga por dependencia" className="shrink-0 px-4 pb-1 lg:px-6">
        {tarjetas.map((t) => (
          <TarjetaIndicador key={t.etiqueta} {...t} />
        ))}
      </FilaTarjetas>

      {/* Tabla: superficie y cabecera fija del sistema; scroll interno */}
      <SuperficieTabla>
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--tema-fondo-ffffff)]">
          <table className="w-full text-sm">
            <CabeceraTablaSticky
              columnas={['Dependencia', 'Total', 'Estado de carga', 'Carga relativa', { etiqueta: '', etiquetaAccesible: 'Acciones' }]}
            />
            <tbody>
              {deps.map((dep) => (
                <FilaDependencia key={dep.tenantId} dep={dep} onVer={verDependencia} onVerCelda={verCelda} />
              ))}
            </tbody>
          </table>
        </div>
      </SuperficieTabla>
    </div>
  );
}
