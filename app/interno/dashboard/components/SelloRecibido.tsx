'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import {
  INSTITUCION,
  formatFechaInstitucional,
  formatHoraInstitucional,
} from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   Sprint Recepción fluida — sello digital de recibido.

   Flujo real: el ciudadano trae su copia física, Laura la pone en la
   impresora y el sistema imprime SOLO el sello en la esquina que ella
   elija — mira la carta, ve dónde hay espacio libre y toca esa
   esquina. Default: superior derecha, la esquina del sello de
   radicado tradicional (el membrete de las cartas va a la izquierda).

   La vista previa muestra un croquis de la hoja con el sello ya
   ubicado, para que la funcionaria sepa exactamente dónde caerá.
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#14532D';

type EsquinaSello = 'SUP_IZQ' | 'SUP_DER' | 'INF_IZQ' | 'INF_DER';

const ESQUINAS: { id: EsquinaSello; label: string }[] = [
  { id: 'SUP_IZQ', label: '↖ Sup. izquierda' },
  { id: 'SUP_DER', label: '↗ Sup. derecha' },
  { id: 'INF_IZQ', label: '↙ Inf. izquierda' },
  { id: 'INF_DER', label: '↘ Inf. derecha' },
];

/** Posición del sello en la impresión real (position: fixed). */
const POSICION_PRINT: Record<EsquinaSello, string> = {
  SUP_IZQ: 'top: 0 !important; left: 0 !important;',
  SUP_DER: 'top: 0 !important; right: 0 !important;',
  INF_IZQ: 'bottom: 0 !important; left: 0 !important;',
  INF_DER: 'bottom: 0 !important; right: 0 !important;',
};

/** Posición del sello dentro del croquis de la vista previa. */
const POSICION_CROQUIS: Record<EsquinaSello, string> = {
  SUP_IZQ: 'top-3 left-3',
  SUP_DER: 'top-3 right-3',
  INF_IZQ: 'bottom-3 left-3',
  INF_DER: 'bottom-3 right-3',
};

function buildPrintStyles(esquina: EsquinaSello): string {
  return `
@media print {
  body * { visibility: hidden !important; }
  #sello-recibido-print,
  #sello-recibido-print * { visibility: visible !important; }
  #sello-recibido-print {
    position: fixed !important;
    ${POSICION_PRINT[esquina]}
    width: 70mm !important;
    background: white !important;
    z-index: 99999 !important;
  }
  @page {
    size: letter portrait;
    margin: 8mm;
  }
}
`;
}

export interface SelloRecibidoProps {
  radicadoId:    string;
  fechaRadicado: string;
  horaRadicado:  string;
  numeroFolios?: number;
  numeroAnexos?: number;
  /** Texto corto de medios entregados ("CD, USB"), si aplica. */
  mediosAnexos?: string | null;
}

export function SelloRecibido({
  radicadoId,
  fechaRadicado,
  horaRadicado,
  numeroFolios = 0,
  numeroAnexos = 0,
  mediosAnexos = null,
}: SelloRecibidoProps) {
  const consultaCorta = INSTITUCION.consultaUrl.replace(/^https?:\/\//, '');
  const hayFisico = numeroFolios > 0 || numeroAnexos > 0;
  // La funcionaria elige dónde caerá el sello según el espacio libre
  // de cada carta. Default: superior derecha (sello tradicional).
  const [esquina, setEsquina] = useState<EsquinaSello>('SUP_DER');

  function handleImprimir() {
    /* El comprobante completo usa su propia hoja (@page half-letter);
       se desactiva su stylesheet durante esta impresión para que el
       sello controle la página (letter + esquina), y se restaura al
       cerrar el diálogo. */
    const stylesComprobante =
      document.getElementById('comprobante-print-styles') as HTMLStyleElement | null;
    if (stylesComprobante) stylesComprobante.disabled = true;

    const tag = document.createElement('style');
    tag.id = 'sello-recibido-print-styles';
    tag.textContent = buildPrintStyles(esquina);
    document.head.appendChild(tag);

    window.print();

    tag.remove();
    if (stylesComprobante) stylesComprobante.disabled = false;
  }

  return (
    <div className="w-full max-w-[460px] space-y-3">
      {/* Acción + instrucción del flujo físico */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleImprimir}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all active:scale-95"
          style={{ background: VERDE_INST }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir sello de recibido
        </button>
        <p className="text-[11px] text-center max-w-[380px]" style={{ color: '#7A8B7F' }}>
          Coloque la copia física del ciudadano en la impresora: solo se
          imprime el sello, en la esquina que elija abajo.
        </p>
      </div>

      {/* Selector de esquina — según el espacio libre de cada carta. */}
      <div
        className="flex items-center justify-center gap-1.5 flex-wrap"
        role="group"
        aria-label="Posición del sello en la hoja"
      >
        {ESQUINAS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEsquina(e.id)}
            aria-pressed={esquina === e.id}
            className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full transition-colors"
            style={esquina === e.id
              ? { background: VERDE_INST, color: '#FFFFFF', border: `1px solid ${VERDE_INST}` }
              : { background: 'white', color: '#475569', border: '1px solid #D9E2D9' }}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Croquis de la hoja con el sello ya ubicado */}
      <div
        className="relative mx-auto w-full aspect-[17/22] rounded-md bg-white"
        style={{ border: '2px dashed #CBD5D1' }}
        aria-label="Vista previa: posición del sello en la hoja"
      >
        {/* El sello — único contenido visible al imprimir. Ocupa ~⅓ del
            ancho de la hoja carta (70mm), proporción de sello de recibido
            institucional. */}
        <div id="sello-recibido-print" className={`absolute ${POSICION_CROQUIS[esquina]} w-[38%] min-w-[190px]`}>
          <div
            className="bg-white"
            style={{ border: `1.5px solid ${VERDE_INST}`, borderRadius: 6, padding: '6px 8px' }}
          >
            <div className="flex items-center gap-2">
              {/* Lockup 1574×382 recortado por CSS: solo el escudo. */}
              <div className="shrink-0 overflow-hidden" style={{ width: 26, height: 26 }}>
                <img
                  src={INSTITUCION.logo}
                  alt={`Escudo de la ${INSTITUCION.nombre}`}
                  className="max-w-none"
                  style={{ height: 26, width: 'auto', objectPosition: 'left' }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase leading-tight" style={{ color: VERDE_INST }}>
                  {INSTITUCION.nombre}
                </p>
                <p className="text-[8px] uppercase tracking-[0.14em]" style={{ color: '#667085' }}>
                  {INSTITUCION.sistema} · Recibido
                </p>
              </div>
            </div>

            <p className="font-mono font-black mt-1.5 leading-none" style={{ fontSize: 13, color: '#12261A' }}>
              {radicadoId}
            </p>

            {/* El sello es un documento PÚBLICO: certifica solo lo que
                siempre es verdad (la Alcaldía recibió, cuándo y qué). El
                direccionamiento interno vive en el sistema, donde un
                traslado es un evento normal, no un error impreso. */}
            <div className="mt-1 space-y-px" style={{ color: '#3A4551' }}>
              <p className="text-[9px]">
                Fecha: {formatFechaInstitucional(fechaRadicado)} · Hora: {formatHoraInstitucional(horaRadicado)}
              </p>
              {hayFisico && (
                <p className="text-[9px]">
                  Folios: {numeroFolios} · Anexos: {numeroAnexos}
                  {mediosAnexos ? ` (${mediosAnexos})` : ''}
                </p>
              )}
            </div>

            <p className="text-[8px] mt-1" style={{ color: '#94A3B8' }}>
              Consulte: {consultaCorta}
            </p>
          </div>
        </div>

        <p
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] italic"
          style={{ color: '#CBD5D1' }}
        >
          Copia física del ciudadano
        </p>
      </div>
    </div>
  );
}
