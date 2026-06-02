'use client';

/**
 * SemaforoTermino — Semáforo MIPG de término legal
 *
 * Variantes:
 *   badge   → pill con dot + texto (por defecto)
 *   compact → dot + texto sin pill
 *   inline  → solo texto
 *
 * Badges claros para buena lectura sobre bg-white y bg-[#F8FAF7].
 */

import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles }    from '@/lib/tiempos-radicado';

export type EstadoTermino = 'EN_TERMINO' | 'POR_VENCER' | 'VENCIDO' | 'RESUELTO';

export interface SemaforoData {
  estado:        EstadoTermino;
  diasRestantes: number;
  label:         string;
  badgeClass:    string;
  dotClass:      string;
  textoClass:    string;
}

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
      // claro: rosa pálido si falló término, gris suave si ok
      badgeClass:  fueATiempo === false
        ? 'bg-pink-50 text-pink-700 border-pink-200'
        : 'bg-gray-100 text-gray-600 border-gray-200',
      dotClass:    fueATiempo === false ? 'bg-pink-500' : 'bg-gray-400',
      textoClass:  fueATiempo === false ? 'text-pink-600 font-semibold' : 'text-gray-500',
    };
  }

  const dias = diasRestantesHabiles(radicado.termino.fechaVencimiento);

  if (dias < 0) {
    return {
      estado:        'VENCIDO',
      diasRestantes: dias,
      label:         `${Math.abs(dias)}d vencido`,
      badgeClass:    'bg-red-50 text-red-700 border-red-200',
      dotClass:      'bg-red-500 animate-pulse',
      textoClass:    'text-red-600 font-bold',
    };
  }

  if (dias <= 2) {
    return {
      estado:        'POR_VENCER',
      diasRestantes: dias,
      label:         dias === 0 ? 'Vence hoy' : `${dias}d restante${dias > 1 ? 's' : ''}`,
      badgeClass:    'bg-yellow-50 text-yellow-700 border-yellow-200',
      dotClass:      'bg-yellow-500 animate-pulse',
      textoClass:    'text-yellow-700 font-semibold',
    };
  }

  return {
    estado:        'EN_TERMINO',
    diasRestantes: dias,
    label:         `${dias}d restantes`,
    badgeClass:    'bg-green-50 text-green-700 border-green-200',
    dotClass:      'bg-green-500',
    textoClass:    'text-green-700',
  };
}

interface SemaforoTerminoProps {
  radicado: VentanillaRadicado;
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

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${semaforo.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${semaforo.dotClass}`} />
      {semaforo.label}
    </span>
  );
}
