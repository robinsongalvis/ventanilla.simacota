'use client';

import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { PASOS, situacionDePaso } from '../camino-del-tramite';
import { ESTADOS_VISUALES, FONDO_EVENTO_ACTUAL } from '../estado-visual-evento';

/* ══════════════════════════════════════════════════════════════
   CAMINO DEL TRÁMITE — los cuatro hitos, a la derecha del expediente.

   Presentación pura: agrupa los once estados jurídicos en cuatro hitos que una
   persona reconoce. No decide nada; el motor sigue mandando.
══════════════════════════════════════════════════════════════ */

export function CaminoDelTramite({
  estado,
  documentacionCompleta,
}: {
  estado: EstadoJuridicoLicencia;
  /** Del servidor (`completitud.completo`). Sin él, el camino se comporta como antes. */
  documentacionCompleta?: boolean;
}) {
  return (
    <section
      aria-label="Camino del trámite"
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#667085' }}>
        Camino del trámite
      </p>

      <ol className="flex flex-col gap-3">
        {PASOS.map((paso) => {
          const situacion = situacionDePaso(paso, estado, documentacionCompleta);
          const cumplido = situacion === 'CUMPLIDO';
          const actual = situacion === 'ACTUAL';
          return (
            <li key={paso.numero} className="flex items-start gap-2.5">
              {/* El paso ACTUAL va en AZUL (en curso), nunca en ámbar: el
                  ámbar queda reservado para advertencias. Punto blanco central
                  y halo, igual que el evento «en curso» del historial. */}
              <span
                aria-hidden
                className="mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ring-2 ring-white"
                style={
                  cumplido
                    ? { background: ESTADOS_VISUALES.completed.color, color: '#fff' }
                    : actual
                      ? { background: ESTADOS_VISUALES.in_progress.color, color: '#fff', boxShadow: `0 0 0 3px ${FONDO_EVENTO_ACTUAL.replace('0.06', '0.20')}` }
                      : { background: 'var(--bg-surface-2)', color: '#94A3B8', border: '1px solid var(--color-border)' }
                }
              >
                {cumplido ? '✓' : actual ? <span className="rounded-full bg-white" style={{ width: 6, height: 6 }} /> : paso.numero}
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
