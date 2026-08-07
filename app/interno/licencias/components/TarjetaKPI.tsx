import type { ReactNode } from 'react';

export type TonoTarjetaKPI = 'critico' | 'normal' | 'exito';

/**
 * Tarjeta KPI de la Bandeja de Licencias (spec C.2): superficie, radio 12,
 * sombra suave, overline + cifra Bold 40 + detalle 12.
 *
 * `tono='critico'` marca el KPI de Vencidas: borde 2px rojo y cifra roja —
 * llama la atención sin necesitar que la funcionaria lea el overline
 * primero. `tono='exito'` (En término) solo tiñe el overline de verde
 * institucional; la cifra se mantiene en el tono neutro de texto primario
 * para no competir visualmente con el crítico.
 */
export function TarjetaKPI({
  overline,
  valor,
  detalle,
  tono = 'normal',
}: {
  overline: string;
  valor: number;
  detalle?: ReactNode;
  tono?: TonoTarjetaKPI;
}) {
  const critico = tono === 'critico';
  const exito = tono === 'exito';

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{
        background: 'var(--bg-surface)',
        border: `${critico ? 2 : 1}px solid ${critico ? '#DC2626' : 'var(--color-border)'}`,
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <p
        className="text-[10.5px] font-bold uppercase tracking-widest"
        style={{ color: exito ? '#14532D' : 'var(--text-secondary)' }}
      >
        {overline}
      </p>
      <p
        className="font-black leading-none tabular-nums"
        style={{ fontSize: 40, color: critico ? '#DC2626' : 'var(--text-primary)' }}
      >
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
