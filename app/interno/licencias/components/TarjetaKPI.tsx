import type { ReactNode } from 'react';

export type TonoTarjetaKPI = 'critico' | 'normal' | 'exito' | 'advertencia';

/**
 * Tarjeta KPI de la Bandeja de Licencias (spec C.2): superficie, radio 12,
 * sombra suave, overline + cifra Bold 40 + detalle 12.
 *
 * `tono='critico'` marca un KPI verificadamente urgente (p. ej. Vencidas
 * en el semáforo por fecha): borde 2px rojo y cifra roja — llama la
 * atención sin necesitar que la funcionaria lea el overline primero.
 * `tono='exito'` (p. ej. En término/Resueltos) tiñe solo el overline de
 * verde institucional. `tono='advertencia'` (bloque "Integración UI y
 * demo", ámbar = advertencia del sistema de diseño) es el mismo peso
 * visual que `exito` — solo tiñe el overline, sin borde — para un KPI que
 * pide atención (p. ej. "Con acta de observaciones") SIN afirmar una
 * urgencia que el sistema no puede verificar (no hay fecha de vencimiento
 * detrás): `critico` queda reservado para cuando sí existe ese dato.
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
  const advertencia = tono === 'advertencia';

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
        style={{ color: exito ? '#14532D' : advertencia ? '#9A6206' : 'var(--text-secondary)' }}
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
