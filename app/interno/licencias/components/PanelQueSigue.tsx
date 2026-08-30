'use client';

import type { QueSigue } from '../que-sigue';
import type { TipoActuacionPermitida } from '@/lib/server/expedientes-licencias';

/* ══════════════════════════════════════════════════════════════
   QUÉ SIGUE EN ESTE EXPEDIENTE.

   Antes esto era una PILA PLANA de botones: «Registrar desistimiento» arriba,
   en verde y habilitado, y lo que de verdad tocaba hacer ni siquiera aparecía.
   Lo destructivo era lo más visible. Un funcionario que baja la vista y pulsa
   el primer botón verde archiva un trámite vivo.

   ESTE COMPONENTE NO DECIDE NADA. Todo lo que muestra —qué se ofrece, con qué
   peso, y por qué algo no procede— sale de `derivarQueSigue`, que a su vez sale
   del mapa de transiciones que el servidor consulta. Aquí solo se pinta la
   jerarquía que el dominio ya estableció.
══════════════════════════════════════════════════════════════ */

export interface PanelQueSigueProps {
  queSigue: QueSigue;
  /** Paso del camino en el que está, para encabezar el panel. */
  pasoActual?: { numero: number; titulo: string } | null;
  onAccion: (tipo: TipoActuacionPermitida) => void;
  /** Acciones de papel: no cambian el expediente, solo lo imprimen o descargan. */
  papel?: { etiqueta: string; href: string }[];
}

export function PanelQueSigue({ queSigue, pasoActual, onAccion, papel = [] }: PanelQueSigueProps) {
  const { principal, disponibles, esperando, aparte } = queSigue;

  return (
    <section
      aria-label="Qué sigue en este expediente"
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
          Qué sigue en este expediente
        </p>
      </div>

      {/* ── 1 · LA ACCIÓN DEL MOMENTO ─────────────────────────────────────
          Sola y grande. Es la respuesta a «¿y ahora qué hago?», que es la
          pregunta que la pantalla tiene que contestar sin que nadie la busque. */}
      {principal && (
        <div className="px-4 pb-4">
          <div
            className="rounded-xl p-4"
            style={{ background: '#F1F8F3', border: '1px solid rgba(20,83,45,.22)' }}
          >
            {pasoActual && (
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#3F6B4E' }}>
                Paso {pasoActual.numero} del camino · le toca a la Secretaría
              </p>
            )}
            <p className="font-headline text-lg font-black mb-2" style={{ color: 'var(--text-primary)' }}>
              {principal.etiqueta}
            </p>
            <button
              type="button"
              onClick={() => onAccion(principal.tipo)}
              className="w-full sm:w-auto inline-flex flex-col items-center rounded-[10px] px-5 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]"
              style={{ background: '#14532D', color: '#fff', boxShadow: '0 2px 10px rgba(20,83,45,.28)' }}
            >
              <span className="text-sm font-bold">{principal.etiqueta}</span>
              {principal.nota && (
                <span className="text-[11px] font-normal" style={{ color: 'rgba(255,255,255,.82)' }}>
                  {principal.nota}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── 2 · LO DEMÁS QUE PROCEDE HOY ──────────────────────────────── */}
      {disponibles.length > 0 && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {disponibles.map((a) => (
            <button
              key={a.tipo}
              type="button"
              onClick={() => onAccion(a.tipo)}
              className="inline-flex flex-col items-start rounded-[10px] px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 hover:brightness-95"
              style={{ background: 'transparent', color: '#14532D', border: '1px solid #14532D' }}
            >
              <span className="text-sm font-bold">{a.etiqueta}</span>
              {a.nota && (
                <span className="text-[11px] font-normal" style={{ color: 'var(--text-secondary)' }}>
                  {a.nota}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── 3 · LO QUE NO PROCEDE TODAVÍA, CON SU PORQUÉ ──────────────────
          Atenuado, pero NO escondido: esconderlo obligaría a la funcionaria a
          recordar que existe, y a preguntarse por qué no está. El motivo lo
          escribe el SERVIDOR; aquí solo se coloca. */}
      {esperando.map((e, i) => {
        const idNota = `que-sigue-espera-${i}`;
        return (
          <div key={e.etiqueta} className="px-4 pb-3 flex flex-col gap-1">
            {/* SIGUE SIENDO UN <button disabled>, y no un texto bonito.
                La primera versión de este panel lo convirtió en un `div`
                atenuado y perdió la accesibilidad: un lector de pantalla dejaba
                de anunciar «acción no disponible» y solo leía una frase suelta.
                Lo cazaron las pruebas del detalle, que buscan el botón por su
                rol. Atenuar es cosa del estilo, no del marcado. */}
            <button
              type="button"
              disabled
              aria-describedby={idNota}
              className="w-full text-left rounded-[10px] px-4 py-2.5 text-sm font-bold cursor-not-allowed"
              style={{ background: 'var(--bg-surface-2)', color: '#94A3B8', border: '1px dashed var(--color-border)' }}
            >
              {e.etiqueta}
            </button>
            <p id={idNota} className="text-xs px-1" style={{ color: '#9A6206' }}>{e.porque}</p>
          </div>
        );
      })}

      {/* ── 4 · PAPEL ─────────────────────────────────────────────────────
          No cambian nada del expediente: lo imprimen o lo descargan. Por eso
          van como enlaces discretos y no compiten con las acciones. */}
      {papel.length > 0 && (
        <div className="px-4 pb-3 flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {papel.map((p) => (
            <a
              key={p.href}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 rounded"
              style={{ color: 'var(--text-primary)' }}
            >
              <span>{p.etiqueta}</span>
              <span className="text-xs font-bold" style={{ color: '#14532D' }}>Abrir →</span>
            </a>
          ))}
        </div>
      )}

      {/* ── 5 · APARTE ────────────────────────────────────────────────────
          Lo que archiva un trámite va al final, en gris y en letra pequeña.
          Nunca el botón que primero se encuentra la mano. */}
      {aparte.length > 0 && (
        <div
          className="px-4 py-3 flex flex-col gap-1.5"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--bg-surface-2)' }}
        >
          {aparte.map((a) => (
            <button
              key={a.tipo}
              type="button"
              onClick={() => onAccion(a.tipo)}
              className="text-left text-xs underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 rounded"
              style={{ color: '#667085' }}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
