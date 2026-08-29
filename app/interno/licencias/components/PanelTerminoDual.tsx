'use client';

import { useState } from 'react';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import type { OrigenActuacion } from '@/lib/motor-expedientes/tipos';
import { terminoResolucionSigueCorriendo, type EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import type { TerminoDualUI } from '../tipos-computos';

/**
 * Panel de término con DOBLE FECHA — Bloque "Términos y vigencias
 * protectores" (10-ago-2026). Consume `computos.terminoDual` YA CALCULADO
 * por el servidor (`calcularVencimientoDual`, `lib/motor-expedientes/
 * termino.ts`) — este componente NO recalcula el término, solo lo
 * presenta.
 *
 * El hueco 1 (⚖️, ADR-0029: efecto de la subsanación sobre el término)
 * sigue sin concepto escrito de Jurídica — por eso se muestran SIEMPRE las
 * dos fechas posibles, con etiquetas que un funcionario entiende sin saber
 * derecho, y la alerta roja va sobre `fechaAlertaConservadora` (la MÁS
 * TEMPRANA de las dos, nunca la más tardía ni un promedio — ver JSDoc de
 * `calcularVencimientoDual`). Ninguna de las dos fechas se presenta como
 * "la correcta".
 */
export interface PanelTerminoDualProps {
  terminoDual: TerminoDualUI;
  /**
   * Estado jurídico del expediente. Decide si el término SIGUE CORRIENDO:
   * en un expediente ya resuelto (concedido, negado, desistido, notificado
   * o en firme) el plazo de los 45 días hábiles dejó de correr cuando la
   * Administración decidió — seguir midiéndolo contra "hoy" mostraba
   * «Vencido hace 88 días hábiles» en un expediente EN FIRME (defecto de la
   * verificación E2E del 12-ago-2026), sugiriendo una mora inexistente.
   * La fecha se sigue mostrando como REFERENCIA de cuándo vencía; lo que
   * cambia es que deja de leerse como alerta.
   */
  estadoJuridico?: EstadoJuridicoLicencia;
  /** Solo decide el texto del estado vacío (histórico migrado vs. real sin radicar aún) — ver R9 (`derivarEventosTermino`), que excluye toda actuación `RECONSTRUIDO` del cómputo. */
  origen?: OrigenActuacion;
  /** ISO de la actuación `radicacion-debida-forma`, si existe — se muestra solo como referencia del ancla, nunca altera el cómputo. */
  fechaRadicacion?: string;
}

export function PanelTerminoDual({ terminoDual, origen, fechaRadicacion, estadoJuridico }: PanelTerminoDualProps) {
  const { suspension, reinicio, fechaAlertaConservadora } = terminoDual;
  // Sin estado declarado se asume que el término corre (comportamiento
  // previo): este componente no puede adivinar, y errar hacia "mostrar la
  // alerta" es el lado seguro para un módulo cuyo fin es que no se pase un
  // plazo.
  const terminoCorriendo = estadoJuridico ? terminoResolucionSigueCorriendo(estadoJuridico) : true;
  const [detalleAbierto, setDetalleAbierto] = useState(false);

  if (!suspension && !reinicio) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          Término para resolver
        </p>
        {/* La frase del ADR-0034 como TITULAR: la funcionaria tiene que poder
            leérsela al ciudadano tal cual. El motivo concreto va debajo, en
            gris, sin anillo ni fechas inventadas. */}
        <p className="text-base font-bold mt-2" style={{ color: '#9A6206' }}>
          El plazo aún no ha empezado a correr
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {origen === 'RECONSTRUIDO'
            ? 'Expediente histórico migrado — sin cómputo de término.'
            : 'Sin radicación en debida forma registrada todavía — el término aún no arranca.'}
        </p>
      </div>
    );
  }

  const diasRestantes = fechaAlertaConservadora ? diasRestantesHabiles(fechaAlertaConservadora) : null;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
    >
      {/* EL CÓMPUTO, PLEGADO. Deja de ser el encabezado y pasa a ser la letra
          menuda que se abre cuando se necesita. No se pierde una palabra: el
          texto sigue en el DOM —y las pruebas que lo custodian lo encuentran—,
          solo cambia dónde vive. */}
      <button
        type="button"
        onClick={() => setDetalleAbierto((v) => !v)}
        aria-expanded={detalleAbierto}
        aria-controls="detalle-computo"
        className="inline-flex items-center gap-1.5 text-xs font-bold self-start focus-visible:outline-none focus-visible:ring-2 rounded"
        style={{ color: '#14532D' }}
      >
        <span aria-hidden>ⓘ</span>
        {detalleAbierto ? 'Ocultar el detalle del cómputo' : 'Detalle del cómputo (ancla, suspensiones, criterio)'}
      </button>


      {/* Expediente YA RESUELTO: el plazo dejó de correr con la decisión.
          La fecha se conserva como REFERENCIA (cuándo vencía), en gris y sin
          `role="alert"` — no es una alerta porque no hay nada que atender. */}
      {fechaAlertaConservadora && !terminoCorriendo && (
        <div
          className="rounded-[10px] p-3 flex flex-col gap-1"
          style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Término ya cerrado
          </p>
          <p className="font-bold" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
            {formatFechaColombia(fechaAlertaConservadora)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            El expediente ya fue resuelto — el plazo para decidir dejó de correr con la decisión. Esta fecha queda solo como referencia de cuándo vencía.
          </p>
        </div>
      )}

      {fechaAlertaConservadora && terminoCorriendo && (
        <div
          role="alert"
          aria-describedby="panel-termino-dual-detalle"
          className="rounded-[10px] p-3 flex flex-col gap-1"
          style={{ background: '#FCEBEB', border: '1px solid rgba(220,38,38,0.35)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#911111' }}>
            Fecha con la que debe trabajar
          </p>
          <p className="font-black" style={{ fontSize: 20, color: '#911111' }}>
            {formatFechaColombia(fechaAlertaConservadora)}
          </p>
          {diasRestantes !== null && (
            <p className="text-xs" style={{ color: '#911111' }}>
              {diasRestantes < 0
                ? `Vencido hace ${Math.abs(diasRestantes)} días hábiles`
                : `Quedan ${diasRestantes} días hábiles`}
            </p>
          )}
        </div>
      )}

      <div id="detalle-computo" hidden={!detalleAbierto} className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          La interpretación jurídica de qué pasa con el plazo tras una subsanación sigue pendiente de concepto
          escrito — el sistema muestra las dos fechas posibles y alerta sobre la más exigente para proteger a la
          Administración. El vencimiento es una proyección: se recalcula en cada consulta a partir de los hechos.
        </p>
      <div id="panel-termino-dual-detalle" className="flex flex-col gap-1.5 text-sm">
        <FilaFecha etiqueta="Si el término se suspende y reanuda" fecha={suspension} />
        <FilaFecha etiqueta="Si el término reinicia" fecha={reinicio} />
      </div>

        {fechaRadicacion && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Ancla: radicación en debida forma ({formatFechaColombia(fechaRadicacion)})
          </p>
        )}
      </div>
    </div>
  );
}

function FilaFecha({ etiqueta, fecha }: { etiqueta: string; fecha: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span style={{ color: 'var(--text-secondary)' }}>{etiqueta}</span>
      <span className="font-mono font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
        {fecha ? formatFechaColombia(fecha) : '—'}
      </span>
    </div>
  );
}
