'use client';

import Link from 'next/link';
import { INSTITUCION } from '@/lib/institucion';
import { InstitucionalHeader } from './InstitucionalHeader';
import { SelloRadicado, type SelloRadicadoData } from './SelloRadicado';

interface Props {
  sello: SelloRadicadoData;
  errores?: string[];
  onNueva?: () => void;
}

export function ConstanciaRadicacion({ sello, errores = [], onNueva }: Props) {
  return (
    <div className="constancia-radicacion mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-8 shadow-2xl shadow-black/30 print:bg-white print:text-slate-950 print:shadow-none print:border-0">
      <div className="mb-7 print:mb-5">
        <InstitucionalHeader align="center" title={INSTITUCION.nombre} subtitle={INSTITUCION.sistema} />
      </div>

      <div className="mb-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300 print:text-slate-700">
          Constancia de radicación
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-50 print:text-slate-950" style={{ fontFamily: 'var(--font-manrope)' }}>
          Su solicitud fue radicada exitosamente
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400 print:text-slate-700">
          Su solicitud fue radicada exitosamente en la {INSTITUCION.sistema} de la {INSTITUCION.nombre}. Conserve el número y, si aparece en la constancia, el código de consulta: no podrá recuperarlo después.
        </p>
      </div>

      <SelloRadicado data={sello} variant="print" />

      {errores.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left print:hidden">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Observaciones</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100">
            {errores.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center print:hidden">
        <Link href={`/consulta?id=${encodeURIComponent(sello.radicadoId)}`} className="btn-primary justify-center">
          Consultar estado
        </Link>
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-white/[0.06]">
          Imprimir constancia
        </button>
        {onNueva && (
          <button type="button" onClick={onNueva} className="rounded-xl px-5 py-3 text-sm font-bold text-slate-400 transition-colors hover:text-slate-200">
            Radicar otra solicitud
          </button>
        )}
      </div>
    </div>
  );
}
