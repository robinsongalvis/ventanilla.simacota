'use client';

/**
 * Buscador rápido del Libro Consecutivo y de la Bandeja de Licencias —
 * pedido explícito del propietario ante los ~202 expedientes históricos
 * por importar (el libro pasará de 3 a ~205 filas reales). Presentacional
 * puro: la lógica de coincidencia vive en `coincideBusquedaLibro`
 * (`../presentacion-libro-consecutivo.ts`, función PURA sin React) — este
 * componente solo pinta el campo, su etiqueta accesible y el anuncio de
 * resultados; ambas pantallas lo usan igual (`LibroConsecutivoClient`,
 * `BandejaLicenciasClient`).
 *
 * Accesibilidad (WCAG 2.1 AA):
 *  - `<label>` asociado por `htmlFor`/`id` — oculto visualmente (`sr-only`,
 *    ya usado en `LibroConsecutivoClient` para el `<caption>` de la
 *    tabla): el placeholder ya orienta visualmente qué se puede buscar,
 *    pero un lector de pantalla necesita el nombre accesible explícito.
 *  - `aria-controls` apunta al `id` de la tabla que este campo filtra.
 *  - El párrafo de resultados es `aria-live="polite"`: al cambiar el
 *    conteo (cada tecla, tras el filtrado en memoria) se anuncia sin
 *    interrumpir al lector de pantalla. Solo se muestra/anuncia con un
 *    término activo — vacío no compite por atención con el resto de la
 *    pantalla.
 */
export interface BuscadorRapidoLibroProps {
  /** `id` único del input — enlaza `<label htmlFor>` y sirve de ancla si el padre necesita enfocarlo. */
  id: string;
  /** Texto del `<label>` accesible (oculto visualmente). */
  etiqueta: string;
  placeholder: string;
  valor: string;
  onChange: (valor: string) => void;
  /** `id` de la tabla que este campo filtra — `aria-controls`. */
  idTabla: string;
  /** Filas visibles TRAS aplicar la búsqueda (y cualquier otro filtro activo) — insumo del anuncio `aria-live`. */
  totalVisible: number;
}

export function BuscadorRapidoLibro({ id, etiqueta, placeholder, valor, onChange, idTabla, totalVisible }: BuscadorRapidoLibroProps) {
  const terminoActivo = valor.trim();
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-[240px] max-w-md">
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: 'var(--text-secondary)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          id={id}
          type="search"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-internal"
          style={{ paddingLeft: '2.25rem' }}
          aria-controls={idTabla}
        />
      </div>
      <p aria-live="polite" className="text-xs min-h-[1em]" style={{ color: 'var(--text-secondary)' }}>
        {terminoActivo && `${totalVisible} resultado${totalVisible === 1 ? '' : 's'} para "${terminoActivo}"`}
      </p>
    </div>
  );
}
