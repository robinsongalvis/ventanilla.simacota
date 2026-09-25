'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { FiltroMIPG, VistaActual } from '@/lib/store/ventanillaStore';

export interface ResumenDiarioData {
  mostrar: boolean;
  fecha: string;
  fechaColombiaLarga: string;
  saludo: string;
  versionResumen?: string;
  totales: {
    vencidos: number;
    vencenHoy: number;
    proximosVencer: number;
    sinAsignar: number;
    correosFallidos: number;
    devoluciones: number;
    hallazgosPendientes?: number;
    planesVencidos?: number;
    planesPorVencer?: number;
  };
  prioridades: Array<{
    tipo: 'VENCIDO' | 'VENCE_HOY' | 'PROXIMO_VENCER' | 'SIN_ASIGNAR' | 'CORREO_FALLIDO' | 'DEVUELTO' | 'PLAN_VENCIDO' | 'PLAN_POR_VENCER' | 'HALLAZGO_PENDIENTE';
    radicadoId: string;
    numeroRadicado: string;
    diasVencido?: number;
    diasRestantes?: number;
    ruta: string;
  }>;
}

interface Props {
  data: ResumenDiarioData;
  userName: string;
  userRol: RolInterno;
  onCerrar: () => void;
  onFiltroMIPG: (filtro: FiltroMIPG) => void;
  onVistaChange: (vista: VistaActual) => void;
  onCerrarDefinitivo: () => Promise<void>;
}

type Categoria = {
  key: string;
  label: string;
  valor: number;
  tono: 'rose' | 'amber' | 'indigo' | 'sky' | 'slate';
  filtro?: FiltroMIPG;
  vista?: VistaActual;
};

const TONO = {
  rose: {
    spine: 'border-l-rose-500',
    chip: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    text: 'text-rose-300',
    hover: 'hover:bg-rose-500/10',
    ring: 'focus-visible:ring-rose-500/50',
  },
  amber: {
    spine: 'border-l-amber-500',
    chip: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    text: 'text-amber-300',
    hover: 'hover:bg-amber-500/10',
    ring: 'focus-visible:ring-amber-500/50',
  },
  indigo: {
    spine: 'border-l-indigo-500',
    chip: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    text: 'text-indigo-300',
    hover: 'hover:bg-indigo-500/10',
    ring: 'focus-visible:ring-indigo-500/50',
  },
  sky: {
    spine: 'border-l-sky-500',
    chip: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    text: 'text-sky-300',
    hover: 'hover:bg-sky-500/10',
    ring: 'focus-visible:ring-sky-500/50',
  },
  slate: {
    spine: 'border-l-slate-700',
    chip: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    text: 'text-slate-300',
    hover: 'hover:bg-white/[0.05]',
    ring: 'focus-visible:ring-slate-500/50',
  },
} as const;

const PRIORIDAD_META: Record<ResumenDiarioData['prioridades'][number]['tipo'], {
  label: string;
  tono: keyof typeof TONO;
  filtro?: FiltroMIPG;
  vista?: VistaActual;
}> = {
  VENCIDO: { label: 'Vencido', tono: 'rose', filtro: 'VENCIDAS' },
  VENCE_HOY: { label: 'Vence hoy', tono: 'amber', filtro: 'POR_VENCER' },
  PROXIMO_VENCER: { label: 'Próximo a vencer', tono: 'amber', filtro: 'POR_VENCER' },
  SIN_ASIGNAR: { label: 'Sin asignar', tono: 'indigo', filtro: 'RADICADAS' },
  CORREO_FALLIDO: { label: 'Correo fallido', tono: 'rose', filtro: 'TODOS' },
  DEVUELTO: { label: 'Devuelto', tono: 'sky', filtro: 'DEVUELTAS_PRORROGA' },
  PLAN_VENCIDO: { label: 'Plan vencido', tono: 'rose', vista: 'CONTROL_INTERNO' },
  PLAN_POR_VENCER: { label: 'Plan por vencer', tono: 'amber', vista: 'CONTROL_INTERNO' },
  HALLAZGO_PENDIENTE: { label: 'Hallazgo pendiente', tono: 'slate', vista: 'CONTROL_INTERNO' },
};

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || 'funcionario';
}

function descripcionPrioridad(p: ResumenDiarioData['prioridades'][number]): string {
  if (p.tipo === 'VENCIDO' || p.tipo === 'PLAN_VENCIDO') return `Hace ${p.diasVencido ?? 1} día${(p.diasVencido ?? 1) === 1 ? '' : 's'}`;
  if (p.tipo === 'VENCE_HOY') return 'Fecha límite hoy';
  if (p.tipo === 'PROXIMO_VENCER' || p.tipo === 'PLAN_POR_VENCER') return `En ${p.diasRestantes ?? 1} día${(p.diasRestantes ?? 1) === 1 ? '' : 's'}`;
  return 'Gestión pendiente';
}

export function ResumenDiarioModal({
  data,
  userName,
  userRol,
  onCerrar,
  onFiltroMIPG,
  onVistaChange,
  onCerrarDefinitivo,
}: Props) {
  const [cerrando, setCerrando] = useState(false);
  const [guardandoVisto, setGuardandoVisto] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cerrarBtnRef = useRef<HTMLButtonElement>(null);

  const cantidadAlertas = useMemo(
    () => Object.values(data.totales).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0),
    [data.totales],
  );

  const categorias = useMemo<Categoria[]>(() => {
    const items: Categoria[] = [
    { key: 'vencidos', label: 'Vencidos', valor: data.totales.vencidos, tono: 'rose', filtro: 'VENCIDAS' },
    { key: 'hoy', label: 'Vencen hoy', valor: data.totales.vencenHoy, tono: 'amber', filtro: 'POR_VENCER' },
    { key: 'proximos', label: 'Próximos a vencer', valor: data.totales.proximosVencer, tono: 'amber', filtro: 'POR_VENCER' },
    { key: 'sinAsignar', label: 'Sin asignar', valor: data.totales.sinAsignar, tono: 'indigo', filtro: 'RADICADAS' },
    { key: 'fallidos', label: 'Correos fallidos', valor: data.totales.correosFallidos, tono: 'rose', filtro: 'TODOS' },
    { key: 'devoluciones', label: 'Devueltos', valor: data.totales.devoluciones, tono: 'sky', filtro: 'DEVUELTAS_PRORROGA' },
    { key: 'hallazgos', label: 'Hallazgos', valor: data.totales.hallazgosPendientes ?? 0, tono: 'slate', vista: 'CONTROL_INTERNO' },
    { key: 'planesVencidos', label: 'Planes vencidos', valor: data.totales.planesVencidos ?? 0, tono: 'rose', vista: 'CONTROL_INTERNO' },
    { key: 'planesProximos', label: 'Planes próximos', valor: data.totales.planesPorVencer ?? 0, tono: 'amber', vista: 'CONTROL_INTERNO' },
    ];
    return items.filter((c) => c.valor > 0);
  }, [data.totales]);

  const cerrarMarcandoVisto = useCallback(async () => {
    if (cerrando || guardandoVisto) return;
    setGuardandoVisto(true);
    try {
      await onCerrarDefinitivo();
    } finally {
      setCerrando(true);
      window.setTimeout(onCerrar, 150);
    }
  }, [cerrando, guardandoVisto, onCerrar, onCerrarDefinitivo]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    cerrarBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void cerrarMarcandoVisto();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cerrarMarcandoVisto]);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const irAFiltro = (filtro: FiltroMIPG) => {
    onFiltroMIPG(filtro);
    onVistaChange('TABLERO');
    void cerrarMarcandoVisto();
  };

  const irAVista = (vista: VistaActual) => {
    onVistaChange(vista);
    void cerrarMarcandoVisto();
  };

  const ejecutarCategoria = (cat: Categoria) => {
    if (cat.vista) irAVista(cat.vista);
    else if (cat.filtro) irAFiltro(cat.filtro);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar resumen del día"
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-150 ${cerrando ? 'opacity-0' : 'opacity-100'}`}
        onClick={() => void cerrarMarcandoVisto()}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-none">
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resumen-diario-title"
          onKeyDown={trapTab}
          className={`pointer-events-auto w-full max-w-3xl max-h-[92dvh] overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117] transition-all duration-150 ${cerrando ? 'scale-[0.98] opacity-0' : 'scale-100 opacity-100'}`}
        >
          <header className="border-b border-white/[0.07] px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  {data.saludo}, {primerNombre(userName)}
                </p>
                <h2 id="resumen-diario-title" className="mt-1 font-headline text-2xl text-slate-50">
                  Resumen del día
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {data.fechaColombiaLarga}
                </p>
              </div>
              <button
                ref={cerrarBtnRef}
                type="button"
                onClick={() => void cerrarMarcandoVisto()}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition-all duration-150 hover:bg-white/[0.05] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                Cerrar
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-300">
              Estas son las actividades que requieren su atención hoy.
            </p>
          </header>

          <div className="max-h-[calc(92dvh-168px)] overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categorias.map((cat) => {
                const tono = TONO[cat.tono];
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => ejecutarCategoria(cat)}
                    className={`rounded-xl border border-l-4 border-t-white/[0.08] border-r-white/[0.08] border-b-white/[0.08] bg-white/[0.04] px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${tono.spine} ${tono.hover} ${tono.ring}`}
                  >
                    <span className={`block text-2xl font-black leading-none tabular-nums ${tono.text}`}>
                      {cat.valor}
                    </span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {data.prioridades.length > 0 && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.035]">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Atención prioritaria
                  </p>
                  <span className="text-[10px] font-mono text-slate-600">
                    {Math.min(data.prioridades.length, 5)} de {cantidadAlertas}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {data.prioridades.map((p) => {
                    const meta = PRIORIDAD_META[p.tipo];
                    const tono = TONO[meta.tono];
                    return (
                      <div key={`${p.tipo}-${p.radicadoId}`} className={`border-l-4 px-4 py-3 ${tono.spine}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-200">
                                {p.numeroRadicado}
                              </span>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tono.chip}`}>
                                {meta.label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {descripcionPrioridad(p)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (meta.vista) irAVista(meta.vista);
                              else if (meta.filtro) irAFiltro(meta.filtro);
                            }}
                            className={`shrink-0 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-300 transition-all duration-150 hover:bg-white/[0.05] active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${tono.ring}`}
                          >
                            Ver listado
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <footer className="flex flex-col gap-2 border-t border-white/[0.07] bg-black/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <button
              type="button"
              onClick={() => void cerrarMarcandoVisto()}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300 transition-all duration-150 hover:bg-white/[0.05] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
            >
              Ir al dashboard
            </button>

            <div className="flex flex-col gap-2 sm:flex-row">
              {data.totales.vencidos > 0 && (
                <button
                  type="button"
                  onClick={() => irAFiltro('VENCIDAS')}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2.5 text-xs font-bold text-rose-200 transition-all duration-150 hover:bg-rose-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
                >
                  Revisar vencidos
                </button>
              )}

              {userRol !== 'CONTROL_INTERNO' && (
                <button
                  type="button"
                  onClick={() => irAFiltro('TODOS')}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-200 transition-all duration-150 hover:bg-emerald-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  Ver pendientes
                </button>
              )}

              <button
                type="button"
                disabled={guardandoVisto}
                onClick={() => void cerrarMarcandoVisto()}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-all duration-150 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                {guardandoVisto ? 'Guardando…' : 'Cerrar por hoy'}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </>
  );
}
