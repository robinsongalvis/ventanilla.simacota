'use client';

import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════
   Resumen de «Documentos del trámite» — barra de progreso + cuatro tarjetas
   por ESTADO (un solo eje, mutuamente excluyente). Presentación pura: recibe
   los números YA CALCULADOS por `ChecklistRequisitos` a partir del evaluador
   real; no cuenta ni reevalúa nada.

   «Requieren corrección» = DUPLICADO (documentos duplicados), NO una revisión
   humana. «Sin definir» = INDETERMINADO (falta un hecho del caso). «Condicionales»
   NO va aquí: es un eje de TIPO y se solaparía — vive en el filtro.

   COLOR (maqueta): cada tarjeta lleva su ícono en COLOR PLENO con el glifo en
   blanco —verde/ámbar/rojo/azul— y un subtítulo que nombra el estado en el
   idioma del funcionario. Nada de íconos de contorno sobre fondos pálidos.
══════════════════════════════════════════════════════════════ */

export interface DocumentSummaryProps {
  aportados: number;
  aplicables: number;
  pendientes: number;
  requiereCorreccion: number;
  sinDefinir: number;
  completo: boolean;
}

export function DocumentSummary({
  aportados, aplicables, pendientes, requiereCorreccion, sinDefinir, completo,
}: DocumentSummaryProps) {
  const porcentaje = aplicables > 0 ? Math.round((aportados / aplicables) * 100) : 0;
  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-sm shrink-0" style={{ color: 'var(--text-primary)' }}>
          <strong>{aportados} de {aplicables}</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>documentos aportados</span>
        </p>

        <div
          className="flex-1 min-w-[120px] h-2 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={aportados}
          aria-valuemin={0}
          aria-valuemax={aplicables}
          aria-label="Documentos aportados"
          style={{ background: 'var(--bg-surface-2)' }}
        >
          {/* La transición suave del ancho: al aportar un documento la barra
              «crece» en vez de saltar. */}
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${porcentaje}%`, background: completo ? '#14532D' : '#16A34A' }}
          />
        </div>

        <span className="text-base font-black shrink-0 tabular-nums" style={{ color: completo ? '#14532D' : '#16A34A' }}>
          {porcentaje}%
        </span>

        <span
          className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0"
          style={completo ? { background: '#E7F6EC', color: '#116932' } : { background: '#FAEEDA', color: '#7A4F0A' }}
        >
          {completo ? 'Completo' : 'Incompleto'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TileEstado valor={aportados} label="Aportados" sub="Documentos con archivo" color="#16A34A" icono={<IconoCheck />} />
        <TileEstado valor={pendientes} label="Pendientes" sub="Por aportar" color="#D97706" icono={<IconoReloj />} />
        <TileEstado valor={requiereCorreccion} label="Requieren corrección" sub="Documentos duplicados" color="#DC2626" icono={<IconoAlerta />} />
        <TileEstado valor={sinDefinir} label="Sin definir" sub="Requiere evaluar condición" color="#2563EB" icono={<IconoInterrogante />} />
      </div>
    </div>
  );
}

function TileEstado({
  valor, label, sub, color, icono,
}: {
  valor: number; label: string; sub: string; color: string; icono: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}>
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: color }}>
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block font-headline text-2xl font-black leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>{valor}</span>
        <span className="mt-1 block text-[13px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="mt-0.5 block text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>{sub}</span>
      </span>
    </div>
  );
}

/* Glifos en BLANCO (heredan `text-white` del contenedor de color pleno). */
function IconoCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.3 4.3L19 7.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoReloj() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.6V12l3 1.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoAlerta() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5.4l7.5 12.9a1 1 0 0 1-.87 1.5H5.37a1 1 0 0 1-.87-1.5L12 5.4z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M12 10.4v3.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="0.95" fill="currentColor" />
    </svg>
  );
}
function IconoInterrogante() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9.4 9.2a2.6 2.6 0 0 1 4.6 1.6c0 1.7-2.5 2-2.5 3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11.4" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}
