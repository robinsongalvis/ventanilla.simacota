import type { ReactNode } from 'react';

export type TonoKpiLibro = 'normal' | 'peligro' | 'advertencia';

/**
 * Tarjeta KPI de la fila superior del Libro Consecutivo rediseñado.
 *
 * Hermana de `TarjetaKPI` (`./TarjetaKPI.tsx`, usada por la Bandeja) pero
 * NO es la misma: aquí `tono='peligro'`/`'advertencia'` tiñen la CIFRA
 * completa (no solo el overline) — regla visual explícita del encargo
 * ("Por vencer" en `--color-danger`, "Históricos incompletos" en
 * `--color-warning`) que `TarjetaKPI` no expresa hoy. Se separa en vez de
 * ampliar `TarjetaKPI` para no arriesgar el aspecto ya validado de la
 * Bandeja de Licencias — mismo radio/sombra/escala tipográfica, para que
 * ambas se sientan del mismo sistema.
 */
export function TarjetaKpiLibro({
  overline,
  valor,
  detalle,
  tono = 'normal',
}: {
  overline: string;
  valor: number;
  detalle?: ReactNode;
  tono?: TonoKpiLibro;
}) {
  const colorCifra =
    tono === 'peligro' ? 'var(--color-danger)' : tono === 'advertencia' ? 'var(--color-warning)' : 'var(--text-primary)';

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {overline}
      </p>
      <p className="font-black leading-none tabular-nums" style={{ fontSize: 40, color: colorCifra }}>
        {valor}
      </p>
      {detalle != null && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {detalle}
        </div>
      )}
    </div>
  );
}
