'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — StatusBadge

   Badge de estado unificado para toda la plataforma.
   Reemplaza las múltiples variantes de chip scattered por el codebase.

   Variantes de tono:
   - success:  verde (resuelto, en término, activo)
   - warning:  ámbar (por vencer, sin sellar)
   - danger:   rojo (vencido, correo fallido, crítico)
   - info:     azul (asignado, en trámite)
   - neutral:  gris (sin clasificar, inactivo)
   - accent:   dorado (prioridad, destacado)

   Tamaños: sm (10px), md (11px), lg (13px)
══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';

type TonoVisual = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';
type Tamano = 'sm' | 'md' | 'lg';

const ESTILOS_TONO: Record<TonoVisual, { bg: string; text: string; dot?: string }> = {
  success: { bg: '#DCFCE7', text: '#117937', dot: '#16A34A' },
  warning: { bg: '#FEF3C7', text: '#8E5C06', dot: '#F59E0B' },
  danger:  { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626' },
  info:    { bg: '#DBEAFE', text: '#1E40AF', dot: '#2563EB' },
  neutral: { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
  accent:  { bg: '#FEF9C3', text: '#854D0E', dot: '#D4A017' },
};

const ESTILOS_TAMANO: Record<Tamano, { text: string; px: string; py: string; gap: string; dotSize: string }> = {
  sm: { text: 'text-[9px]',  px: 'px-1.5', py: 'py-0.5', gap: 'gap-1',   dotSize: 'w-1 h-1' },
  md: { text: 'text-[10px]', px: 'px-2',   py: 'py-0.5', gap: 'gap-1',   dotSize: 'w-1.5 h-1.5' },
  lg: { text: 'text-[11px]', px: 'px-2.5', py: 'py-1',   gap: 'gap-1.5', dotSize: 'w-1.5 h-1.5' },
};

interface StatusBadgeProps {
  tono: TonoVisual;
  tamano?: Tamano;
  children: ReactNode;
  /** Mostrar punto indicador antes del texto. */
  conPunto?: boolean;
  /** Clases adicionales. */
  className?: string;
}

export function StatusBadge({
  tono,
  tamano = 'md',
  children,
  conPunto = false,
  className = '',
}: StatusBadgeProps) {
  const estilo = ESTILOS_TONO[tono];
  const tam = ESTILOS_TAMANO[tamano];

  return (
    <span
      className={`inline-flex items-center ${tam.gap} ${tam.px} ${tam.py} rounded-full font-semibold uppercase tracking-wide ${tam.text} ${className}`}
      style={{ background: estilo.bg, color: estilo.text }}
    >
      {conPunto && (
        <span
          className={`shrink-0 rounded-full ${tam.dotSize}`}
          style={{ background: estilo.dot }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   Atajos para los casos de uso más frecuentes
══════════════════════════════════════════════════════════════ */

/** Badge de estado de radicado (RESUELTO, ASIGNADO, PENDIENTE, etc.) */
export function BadgeEstadoRadicado({ estado }: { estado: string }) {
  const normalizado = estado.toUpperCase().replace(/[_\s]+/g, '_');
  const mapa: Record<string, { tono: TonoVisual; label: string }> = {
    'RESUELTO':            { tono: 'success', label: 'Resuelto' },
    'ASIGNADO':            { tono: 'info',    label: 'Asignado' },
    'PENDIENTE':           { tono: 'warning', label: 'Pendiente' },
    'EN_REVISION':         { tono: 'info',    label: 'En revisión' },
    'DEVUELTO':            { tono: 'warning', label: 'Devuelto' },
    'SIN_ASIGNAR':         { tono: 'neutral', label: 'Sin asignar' },
    'VENCIDO':             { tono: 'danger',  label: 'Vencido' },
    'RADICADO_RECIBIDO':   { tono: 'info',    label: 'Radicado' },
    'EN_TRAMITE':          { tono: 'info',    label: 'En trámite' },
    'PRORROGA':            { tono: 'accent',  label: 'Prórroga' },
  };
  const config = mapa[normalizado] ?? { tono: 'neutral' as TonoVisual, label: estado };
  return <StatusBadge tono={config.tono} conPunto>{config.label}</StatusBadge>;
}

/** Badge de prioridad MIPG */
export function BadgePrioridad({ prioridad }: { prioridad: string }) {
  const normalizado = prioridad.toUpperCase();
  const mapa: Record<string, { tono: TonoVisual; label: string }> = {
    'ROJO':   { tono: 'danger',  label: 'Crítica' },
    'AMARILLO': { tono: 'warning', label: 'Media' },
    'VERDE':  { tono: 'success', label: 'Normal' },
    'NINGUNA': { tono: 'neutral', label: 'Sin prioridad' },
  };
  const config = mapa[normalizado] ?? { tono: 'neutral' as TonoVisual, label: prioridad };
  return <StatusBadge tono={config.tono} conPunto tamano="sm">{config.label}</StatusBadge>;
}

/** Badge de urgencia por días restantes */
export function BadgeUrgencia({ dias }: { dias: number | null }) {
  if (dias === null) return <StatusBadge tono="neutral" conPunto tamano="sm">Sin plazo</StatusBadge>;
  if (dias < 0) return <StatusBadge tono="danger" conPunto tamano="sm">{Math.abs(dias)}d vencido</StatusBadge>;
  if (dias <= 2) return <StatusBadge tono="warning" conPunto tamano="sm">{dias}d por vencer</StatusBadge>;
  if (dias <= 5) return <StatusBadge tono="accent" conPunto tamano="sm">{dias}d</StatusBadge>;
  return <StatusBadge tono="success" conPunto tamano="sm">{dias}d</StatusBadge>;
}

/** Badge de rol */
export function BadgeRol({ rol }: { rol: string }) {
  const mapa: Record<string, { tono: TonoVisual; label: string }> = {
    'ADMIN':            { tono: 'danger',  label: 'Admin' },
    'RECEPCIONISTA':    { tono: 'info',    label: 'Recepción' },
    'FUNCIONARIO':      { tono: 'success', label: 'Funcionario' },
    'JEFE_DEPENDENCIA': { tono: 'accent',  label: 'Jefe Dep.' },
    'CONTROL_INTERNO':  { tono: 'warning', label: 'Control Int.' },
  };
  const config = mapa[rol] ?? { tono: 'neutral' as TonoVisual, label: rol };
  return <StatusBadge tono={config.tono} tamano="sm">{config.label}</StatusBadge>;
}
