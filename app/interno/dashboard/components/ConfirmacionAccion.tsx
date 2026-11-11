'use client';

import { useEffect, type CSSProperties } from 'react';
import { MailWarning, X } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   CONFIRMACIÓN DE UNA ACTUACIÓN SOBRE EL RADICADO

   Reemplaza el aviso de una línea ("Operación guardada correctamente")
   que pasaba desapercibido: entra desde arriba del panel, dibuja el
   chulo, dice QUÉ pasó y se va sola a los 6 s (o antes, con la X).
   Con prefers-reduced-motion aparece y desaparece sin animar.
══════════════════════════════════════════════════════════════ */

export interface Confirmacion {
  titulo:   string;
  detalle?: string;
  /** 'aviso': la actuación quedó, pero algo requiere gestión (p. ej. el correo no salió). */
  tono?:    'ok' | 'aviso';
}

const DURACION_MS = 6000;

export function ConfirmacionAccion({
  titulo,
  detalle,
  tono = 'ok',
  onDismiss,
}: Confirmacion & { onDismiss: () => void }) {
  // Se reinicia si llega otra confirmación mientras esta sigue en pantalla.
  useEffect(() => {
    const t = setTimeout(onDismiss, DURACION_MS);
    return () => clearTimeout(t);
  }, [onDismiss, titulo, detalle]);

  const aviso = tono === 'aviso';
  const color = aviso ? '#b45309' : '#116530';

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-confirmacion-in absolute left-3 right-3 top-3 z-30 overflow-hidden rounded-2xl border bg-[var(--tema-fondo-ffffff)] shadow-xl"
      style={{ borderColor: aviso ? '#fcd34d' : '#86efac', '--confirmacion-ms': `${DURACION_MS}ms` } as CSSProperties}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="animate-success-bounce shrink-0" aria-hidden="true">
          {aviso ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: '#fef3c7', color }}>
              <MailWarning size={24} strokeWidth={2} />
            </span>
          ) : (
            /* r=25 → perímetro 157, el mismo dasharray de .svg-circle-draw */
            <svg width="44" height="44" viewBox="0 0 56 56" fill="none">
              <circle className="svg-circle-draw" cx="28" cy="28" r="25" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
              <path className="svg-check-draw" d="M17 29l8 8 14-16" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-base font-extrabold leading-tight" style={{ color }}>{titulo}</p>
          {detalle && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--tema-texto-475569)' }}>{detalle}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar la confirmación"
          className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[var(--tema-fondo-f7f9fb)]"
          style={{ color: 'var(--tema-texto-475569)' }}
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Barra que se encoge: cuánto falta para que se cierre sola. */}
      <div className="animate-confirmacion-barra h-1" style={{ background: color, opacity: 0.35 }} aria-hidden="true" />
    </div>
  );
}
