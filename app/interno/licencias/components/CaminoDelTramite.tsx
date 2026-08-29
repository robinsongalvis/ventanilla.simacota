'use client';

import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { PASOS, situacionDePaso } from '../camino-del-tramite';

/* ══════════════════════════════════════════════════════════════
   CAMINO DEL TRÁMITE — los cuatro hitos, a la derecha del expediente.

   Presentación pura: agrupa los once estados jurídicos en cuatro hitos que una
   persona reconoce. No decide nada; el motor sigue mandando.
══════════════════════════════════════════════════════════════ */

export function CaminoDelTramite({ estado }: { estado: EstadoJuridicoLicencia }) {
  return (
    <section
      aria-label="Camino del trámite"
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#667085' }}>
        Camino del trámite
      </p>

      <ol className="flex flex-col gap-3">
        {PASOS.map((paso) => {
          const situacion = situacionDePaso(paso, estado);
          const cumplido = situacion === 'CUMPLIDO';
          const actual = situacion === 'ACTUAL';
          return (
            <li key={paso.numero} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black"
                style={
                  cumplido
                    ? { background: '#14532D', color: '#fff' }
                    : actual
                      ? { background: '#D4A017', color: '#14532D' }
                      : { background: 'var(--bg-surface-2)', color: '#94A3B8', border: '1px solid var(--color-border)' }
                }
              >
                {cumplido ? '✓' : paso.numero}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-sm"
                  style={{
                    color: actual || cumplido ? 'var(--text-primary)' : '#94A3B8',
                    fontWeight: actual ? 800 : 600,
                  }}
                >
                  {paso.titulo}
                </span>
                <span className="block text-xs" style={{ color: '#94A3B8' }}>
                  {paso.subtexto(situacion)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
