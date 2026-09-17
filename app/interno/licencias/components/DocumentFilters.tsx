'use client';

/* ══════════════════════════════════════════════════════════════
   Filtros + buscador de «Documentos del trámite». Presentación pura: el estado
   del filtro y la búsqueda viven en `ChecklistRequisitos`, que filtra los
   requisitos REALES; este componente solo los dibuja y avisa del cambio.

   «Condicionales» es un filtro por TIPO (independiente), a diferencia de los
   demás, que son por ESTADO — por eso vive aquí y no en el resumen.
══════════════════════════════════════════════════════════════ */

export type FiltroDoc = 'TODOS' | 'APORTADO' | 'PENDIENTE' | 'CONDICIONAL' | 'DUPLICADO' | 'INDETERMINADO';

export type ConteosFiltro = Record<FiltroDoc, number>;

const FILTROS: { clave: FiltroDoc; etiqueta: string }[] = [
  { clave: 'TODOS', etiqueta: 'Todos' },
  { clave: 'APORTADO', etiqueta: 'Aportados' },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes' },
  { clave: 'CONDICIONAL', etiqueta: 'Condicionales' },
  { clave: 'DUPLICADO', etiqueta: 'Requieren corrección' },
  { clave: 'INDETERMINADO', etiqueta: 'Sin definir' },
];

export interface DocumentFiltersProps {
  activo: FiltroDoc;
  onCambiar: (f: FiltroDoc) => void;
  conteos: ConteosFiltro;
  busqueda: string;
  onBuscar: (texto: string) => void;
}

export function DocumentFilters({ activo, onCambiar, conteos, busqueda, onBuscar }: DocumentFiltersProps) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div role="tablist" aria-label="Filtrar documentos por estado" className="flex flex-wrap gap-1.5">
        {FILTROS.map(({ clave, etiqueta }) => {
          const esActivo = clave === activo;
          return (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={esActivo}
              onClick={() => onCambiar(clave)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none active:translate-y-px"
              style={
                esActivo
                  ? { background: '#14532D', color: '#fff', border: '1px solid #14532D' }
                  : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--color-border)' }
              }
            >
              {etiqueta}
              <span
                className="tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                style={esActivo ? { background: 'rgba(255,255,255,0.22)', color: '#fff' } : { background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
              >
                {conteos[clave]}
              </span>
            </button>
          );
        })}
      </div>

      <label className="relative block lg:w-64 shrink-0">
        <span className="sr-only">Buscar documento</span>
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" /><path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
          placeholder="Buscar documento…"
          className="w-full rounded-full py-2 pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none focus-visible:ring-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
        />
      </label>
    </div>
  );
}
