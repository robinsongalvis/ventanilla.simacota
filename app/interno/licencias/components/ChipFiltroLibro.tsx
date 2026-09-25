/**
 * Chip de filtro del Libro Consecutivo (Todos / En trámite / Por vencer /
 * Vencidos / Históricos incompletos) — botón real (no un `<div>` con
 * `onClick`) para que Tab + Enter/Espacio lo operen sin JS adicional;
 * `aria-pressed` comunica el estado activo a lectores de pantalla (patrón
 * "toggle button", más simple que un `radiogroup` con tabindex-roving y
 * suficiente para un filtro que no necesita navegación por flechas).
 *
 * El activo usa el dorado del sistema (`--color-accent` sobre
 * `--color-primary`) — mismo par que ya usan los botones primarios del
 * módulo (p. ej. "Recibir solicitud →" en `BandejaLicenciasClient`), para
 * que "seleccionado" se lea con el mismo lenguaje visual en toda la
 * pantalla.
 */
export function ChipFiltroLibro({
  etiqueta,
  conteo,
  activo,
  onClick,
}: {
  etiqueta: string;
  conteo: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.98]"
      style={
        activo
          ? { background: 'var(--color-accent)', color: 'var(--color-primary)', boxShadow: '0 2px 8px rgba(212,160,23,0.25)' }
          : { background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--color-border)' }
      }
    >
      <span>{etiqueta}</span>
      <span className="tabular-nums" style={{ opacity: activo ? 0.85 : 0.7 }}>
        {conteo}
      </span>
    </button>
  );
}
