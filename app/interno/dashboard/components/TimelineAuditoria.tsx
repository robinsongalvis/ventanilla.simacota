'use client';

import type { AuditoriaEntry } from '@/src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */

const LABELS_ACCION: Record<string, string> = {
  RADICACION:            'Radicación',
  CLASIFICACION_IA:      'Clasificación IA',
  ASIGNACION:            'Asignación',
  CAMBIO_ESTADO:         'Cambio de estado',
  RESPUESTA_FUNCIONARIO: 'Respuesta del funcionario',
  DEVOLUCION:            'Devolución',
  RECLASIFICACION:       'Reclasificación',
  NOTIFICACION_WHATSAPP: 'Notificación WhatsApp',
  // Legacy values used in seed data
  EN_REVISION:           'Cambio de estado',
  EN_PROCESO:            'Cambio de estado',
  RESUELTO:              'Resolución',
  DEVUELTO:              'Devolución',
};

/** Dot + ring color for each action type */
const COLOR_ACCION: Record<string, { dot: string; ring: string; icon: string }> = {
  RADICACION:            { dot: 'bg-indigo-500',  ring: 'ring-indigo-500/30',  icon: '📥' },
  CLASIFICACION_IA:      { dot: 'bg-purple-500',  ring: 'ring-purple-500/30',  icon: '🤖' },
  ASIGNACION:            { dot: 'bg-blue-500',    ring: 'ring-blue-500/30',    icon: '📌' },
  CAMBIO_ESTADO:         { dot: 'bg-amber-500',   ring: 'ring-amber-500/30',   icon: '🔄' },
  RESPUESTA_FUNCIONARIO: { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30', icon: '💬' },
  DEVOLUCION:            { dot: 'bg-rose-500',    ring: 'ring-rose-500/30',    icon: '↩️' },
  RECLASIFICACION:       { dot: 'bg-orange-500',  ring: 'ring-orange-500/30',  icon: '🔀' },
  NOTIFICACION_WHATSAPP: { dot: 'bg-green-500',   ring: 'ring-green-500/30',   icon: '📱' },
  // Legacy fallbacks
  EN_REVISION:           { dot: 'bg-amber-500',   ring: 'ring-amber-500/30',   icon: '🔄' },
  EN_PROCESO:            { dot: 'bg-blue-500',    ring: 'ring-blue-500/30',    icon: '🔄' },
  RESUELTO:              { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30', icon: '✅' },
  DEVUELTO:              { dot: 'bg-rose-500',    ring: 'ring-rose-500/30',    icon: '↩️' },
};

const COLOR_FALLBACK = { dot: 'bg-slate-500', ring: 'ring-slate-500/30', icon: '•' };

/* ══════════════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════════ */

function formatearFechaHora(isoString: string): string {
  const d = new Date(isoString);
  const fecha = d.toLocaleDateString('es-CO', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });
  const hora = d.toLocaleTimeString('es-CO', {
    hour:   '2-digit',
    minute: '2-digit',
  });
  return `${fecha} ${hora}`;
}

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */

interface Props {
  entradas: AuditoriaEntry[];
}

export function TimelineAuditoria({ entradas }: Props) {
  // Most recent first
  const ordenadas = [...entradas].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  if (ordenadas.length === 0) {
    return (
      <p className="text-sm text-slate-600 italic">Sin entradas de auditoría.</p>
    );
  }

  return (
    <ol className="relative flex flex-col gap-0">
      {ordenadas.map((entrada, idx) => {
        const color  = COLOR_ACCION[entrada.accion] ?? COLOR_FALLBACK;
        const label  = LABELS_ACCION[entrada.accion] ?? entrada.accion;
        const meta   = entrada.metadata as { estadoAnterior?: string; estadoNuevo?: string } | undefined;
        const esUltimo = idx === ordenadas.length - 1;

        return (
          <li
            key={`${entrada.fecha}-${idx}`}
            className="relative flex gap-4 pb-6 field-animate"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* Vertical line */}
            {!esUltimo && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-white/8" />
            )}

            {/* Dot */}
            <div className={`
              shrink-0 relative z-10 mt-0.5
              w-6 h-6 rounded-full ring-4 ${color.ring}
              ${color.dot}
              flex items-center justify-center
              text-[10px]
            `}>
              <span role="img" aria-hidden className="leading-none">{color.icon}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 flex-wrap mb-0.5">
                <span className="text-sm font-semibold text-slate-200">{label}</span>
                <time
                  dateTime={entrada.fecha}
                  className="shrink-0 text-xs text-slate-500 font-mono tabular-nums"
                >
                  {formatearFechaHora(entrada.fecha)}
                </time>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="text-slate-500">{entrada.actor}</span>
                {' — '}
                {entrada.nota}
              </p>

              {/* State transition metadata */}
              {meta?.estadoAnterior && meta?.estadoNuevo && (
                <p className="mt-1 text-xs text-slate-600 font-mono">
                  {meta.estadoAnterior} → {meta.estadoNuevo}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
