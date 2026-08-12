'use client';

import { useState } from 'react';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import type { EvaluacionPlazoSubsanacion, BorradorActoDesistimiento } from '../tipos-computos';

export interface PanelDesistimientoSemicontroladoProps {
  plazoSubsanacion: EvaluacionPlazoSubsanacion;
  /** Solo presente cuando `plazoSubsanacion.resultado === 'POR_ARCHIVAR'` (`generarBorradorActoDesistimiento`, servidor) — `null` en cualquier otro caso. */
  borrador: BorradorActoDesistimiento | null;
}

/**
 * Estado "Por archivar" (desistimiento SEMICONTROLADO, art. 2.2.6.1.2.2.4) —
 * Bloque "Términos y vigencias protectores" (10-ago-2026). Consume
 * `computos.plazoSubsanacion` (`evaluarPlazoSubsanacion`) y
 * `borradorActoDesistimiento` (`generarBorradorActoDesistimiento`), ambos
 * YA CALCULADOS por el servidor — este componente NO decide nada, NO
 * archiva nada, y NO ofrece ningún botón que sugiera "archivar
 * automáticamente" (Principio 9: el sistema sugiere, el funcionario
 * decide; aquí con más fuerza porque el efecto es irreversible).
 *
 * `EN_PLAZO` se muestra DISCRETO (texto pequeño, sin `role="alert"`, sin
 * color de alarma) — no hay nada urgente todavía. `POR_ARCHIVAR` se
 * muestra con badge + panel rojo + el proyecto de acto para leer/copiar/
 * imprimir, con el copy NO NEGOCIABLE de que nada ocurre hasta la firma
 * del funcionario.
 */
export function PanelDesistimientoSemicontrolado({ plazoSubsanacion, borrador }: PanelDesistimientoSemicontroladoProps) {
  const [copiado, setCopiado] = useState(false);

  if (plazoSubsanacion.resultado === 'NO_APLICA') {
    return null;
  }

  if (plazoSubsanacion.resultado === 'EN_PLAZO') {
    return (
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Plazo de subsanación: quedan {plazoSubsanacion.diasHabilesRestantes} días hábiles
        {plazoSubsanacion.fechaVencimientoPlazo && (
          <> (vence el {formatFechaColombia(plazoSubsanacion.fechaVencimientoPlazo)})</>
        )}
        .
      </p>
    );
  }

  // POR_ARCHIVAR — el plazo de 30 días hábiles desde la comunicación del
  // acta ya venció sin respuesta del solicitante (`evaluarPlazoSubsanacion`).
  const diasTranscurridos =
    plazoSubsanacion.diasHabilesRestantes != null ? Math.abs(plazoSubsanacion.diasHabilesRestantes) : null;

  async function copiarBorrador() {
    if (!borrador) return;
    try {
      await navigator.clipboard.writeText(`${borrador.titulo}\n\n${borrador.cuerpo}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin fallback ruidoso: si clipboard falla, el texto sigue visible en pantalla para copiar a mano.
    }
  }

  return (
    <div
      role="alert"
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: '#FCEBEB', border: '1px solid rgba(220,38,38,0.35)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
          style={{ background: 'var(--color-danger)', color: '#FFFFFF' }}
        >
          Por archivar
        </span>
        <p className="text-sm font-semibold" style={{ color: '#911111' }}>
          El plazo de subsanación venció
          {plazoSubsanacion.fechaVencimientoPlazo && <> el {formatFechaColombia(plazoSubsanacion.fechaVencimientoPlazo)}</>}
          {diasTranscurridos !== null && <> — hace {diasTranscurridos} días hábiles</>}.
        </p>
      </div>

      <p className="text-[13px] leading-relaxed" style={{ color: '#911111' }}>
        <strong>El sistema NO archivó nada.</strong> Lo que sigue es un PROYECTO de acto administrativo: debe
        revisarlo, completarlo con los datos que falten y <strong>firmarlo</strong>. Nada ocurre hasta su firma.
      </p>

      {borrador && (
        <div
          className="rounded-[10px] p-3"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
            {borrador.titulo}
          </p>
          <div
            className="text-sm whitespace-pre-wrap"
            style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}
          >
            {borrador.cuerpo}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 print:hidden">
            <button
              type="button"
              onClick={copiarBorrador}
              className="inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]"
              style={{ background: 'transparent', color: '#14532D', border: '1px solid #14532D' }}
            >
              {copiado ? '✓ Copiado' : 'Copiar texto'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]"
              style={{ background: 'transparent', color: '#14532D', border: '1px solid #14532D' }}
            >
              Imprimir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
