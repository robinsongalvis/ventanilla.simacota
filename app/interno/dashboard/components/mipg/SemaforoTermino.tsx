'use client';

/**
 * SemaforoTermino — Componente reutilizable de semáforo MIPG
 *
 * Muestra el estado de cumplimiento de término legal de un radicado
 * con colores semafóricos y días restantes/vencidos.
 *
 * Colores:
 *   Verde   → En término (> 2 días hábiles restantes)
 *   Amarillo → Próximo a vencer (0-2 días hábiles)
 *   Rojo    → Vencido (días negativos)
 *   Gris    → Resuelto / cerrado
 *
 * Usado en: tabla de radicados, panel derecho, y cualquier futuro
 * componente que necesite mostrar estado de término.
 */

import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles }    from '@/lib/tiempos-radicado';

/* ── Tipos ──────────────────────────────────────────────────── */

export type EstadoTermino = 'EN_TERMINO' | 'POR_VENCER' | 'VENCIDO' | 'RESUELTO';

export interface SemaforoData {
  estado:        EstadoTermino;
  diasRestantes: number;
  label:         string;
  /** Color de fondo/borde para badges */
  badgeClass:    string;
  /** Color del dot/indicador */
  dotClass:      string;
  /** Color del texto */
  textoClass:    string;
}

/* ── Cálculo puro ───────────────────────────────────────────── */

const ESTADOS_RESUELTOS = new Set(['RESUELTO', 'RECHAZADO']);

export function calcularSemaforo(radicado: VentanillaRadicado): SemaforoData {
  if (ESTADOS_RESUELTOS.has(radicado.estadoActual)) {
    const fueATiempo = radicado.cumplioTermino;
    return {
      estado:        'RESUELTO',
      diasRestantes: 0,
      label:         fueATiempo === false
        ? 'Resuelto fuera de término'
        : fueATiempo === true
          ? 'Resuelto en término'
          : 'Resuelto',
      badgeClass:    fueATiempo === false
        ? 'bg-pink-500/15 text-pink-300 border-pink-500/30'
        : 'bg-slate-500/15 text-slate-400 border-slate-500/30',
      dotClass:      fueATiempo === false ? 'bg-pink-400' : 'bg-slate-500',
      textoClass:    fueATiempo === false ? 'text-pink-300' : 'text-slate-500',
    };
  }

  const dias = diasRestantesHabiles(radicado.termino.fechaVencimiento);

  if (dias < 0) {
    return {
      estado:        'VENCIDO',
      diasRestantes: dias,
      label:         `${Math.abs(dias)}d vencido`,
      badgeClass:    'bg-red-500/15 text-red-300 border-red-500/30',
      dotClass:      'bg-red-500 animate-pulse',
      textoClass:    'text-red-400 font-bold',
    };
  }

  if (dias <= 2) {
    return {
      estado:        'POR_VENCER',
      diasRestantes: dias,
      label:         dias === 0 ? 'Vence hoy' : `${dias}d restante${dias > 1 ? 's' : ''}`,
      badgeClass:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
      dotClass:      'bg-amber-500 animate-pulse',
      textoClass:    'text-amber-400 font-semibold',
    };
  }

  return {
    estado:        'EN_TERMINO',
    diasRestantes: dias,
    label:         `${dias}d restantes`,
    badgeClass:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotClass:      'bg-emerald-500',
    textoClass:    'text-emerald-400',
  };
}

/* ── Componente visual ──────────────────────────────────────── */

interface SemaforoTerminoProps {
  radicado: VentanillaRadicado;
  /** 'badge' muestra pill con icono; 'compact' muestra solo dot + días; 'inline' solo texto */
  variante?: 'badge' | 'compact' | 'inline';
}

export function SemaforoTermino({ radicado, variante = 'badge' }: SemaforoTerminoProps) {
  const semaforo = calcularSemaforo(radicado);

  if (variante === 'inline') {
    return <span className={`text-xs tabular-nums ${semaforo.textoClass}`}>{semaforo.label}</span>;
  }

  if (variante === 'compact') {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${semaforo.dotClass}`} />
        <span className={`text-xs tabular-nums ${semaforo.textoClass}`}>{semaforo.label}</span>
      </div>
    );
  }

  // variante 'badge' (default)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${semaforo.badgeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${semaforo.dotClass}`} />
      {semaforo.label}
    </span>
  );
}
