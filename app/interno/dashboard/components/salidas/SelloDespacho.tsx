'use client';

/* eslint-disable @next/next/no-img-element */

import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { SalidaOficial } from '@/src/types/salida';
import { INSTITUCION, formatFechaInstitucional, formatHoraInstitucional } from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   Fase B de salidas — constancia de despacho.

   El gemelo del sello digital de recibido, pero para lo que SALE:
   la copia del oficio que queda en el archivo de la dependencia se
   sella con el número 2-SAL, la fecha, el destinatario y el medio.
   Mismo flujo físico: la hoja va a la impresora y solo se imprime el
   sello en la esquina superior izquierda.
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#14532D';
const DORADO_INST = '#8A6A12';

const MEDIO_LABEL: Record<string, string> = {
  CORREO:     'Correo electrónico',
  FISICO:     'Correo físico',
  MENSAJERO:  'Mensajero',
  PRESENCIAL: 'Entrega presencial',
};

const PRINT_STYLES_DESPACHO = `
@media print {
  body * { visibility: hidden !important; }
  #sello-despacho-print,
  #sello-despacho-print * { visibility: visible !important; }
  #sello-despacho-print {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
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

/** Ids de stylesheets de otros modos de impresión que hay que apagar. */
const OTROS_PRINT_STYLES = ['comprobante-print-styles', 'sello-recibido-print-styles'];

export interface SelloDespachoProps {
  salida: SalidaOficial;
  /** Compacto: sin croquis de hoja (para el libro de salidas). */
  variante?: 'completa' | 'compacta';
}

export function SelloDespacho({ salida, variante = 'completa' }: SelloDespachoProps) {
  const consultaCorta = INSTITUCION.consultaUrl.replace(/^https?:\/\//, '');
  const dependencia = NOMBRES_TENANT[salida.dependenciaOrigen] ?? salida.dependenciaOrigen;

  function handleImprimir() {
    /* Mismo truco del sello de recibido: se apagan las hojas de estilo
       de impresión de los otros modos mientras este sello controla la
       página, y se restauran al cerrar el diálogo. */
    const apagados: HTMLStyleElement[] = [];
    for (const id of OTROS_PRINT_STYLES) {
      const el = document.getElementById(id) as HTMLStyleElement | null;
      if (el && !el.disabled) {
        el.disabled = true;
        apagados.push(el);
      }
    }

    const tag = document.createElement('style');
    tag.id = 'sello-despacho-print-styles';
    tag.textContent = PRINT_STYLES_DESPACHO;
    document.head.appendChild(tag);

    window.print();

    tag.remove();
    for (const el of apagados) el.disabled = false;
  }

  const sello = (
    <div id="sello-despacho-print" className={variante === 'completa' ? 'absolute top-3 left-3 w-[38%] min-w-[190px]' : 'w-full max-w-[250px]'}>
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
            <p className="text-[8px] uppercase tracking-[0.14em]" style={{ color: DORADO_INST }}>
              {INSTITUCION.sistema} · Despachado
            </p>
          </div>
        </div>

        <p className="font-mono font-black mt-1.5 leading-none" style={{ fontSize: 13, color: '#12261A' }}>
          {salida.salidaId}
        </p>

        <div className="mt-1 space-y-px" style={{ color: '#3A4551' }}>
          <p className="text-[9px]">
            Fecha: {formatFechaInstitucional(salida.fechaSalida)} · Hora: {formatHoraInstitucional(salida.fechaSalida)}
          </p>
          <p className="text-[9px]">
            Para: {salida.destinatario.nombre}
            {salida.destinatario.entidad ? ` (${salida.destinatario.entidad})` : ''}
          </p>
          <p className="text-[9px]">
            Medio: {MEDIO_LABEL[salida.medioEnvio] ?? salida.medioEnvio} · Despacha: {dependencia}
          </p>
          {salida.radicadoEntradaId && (
            <p className="text-[9px]">Responde al radicado: {salida.radicadoEntradaId}</p>
          )}
          <p className="text-[9px]">Firma: {salida.firmante.nombre}</p>
        </div>

        <p className="text-[8px] mt-1" style={{ color: '#94A3B8' }}>
          Consulte: {consultaCorta}
        </p>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-[460px] space-y-3">
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
          Imprimir constancia de despacho
        </button>
        <p className="text-[11px] text-center max-w-[380px]" style={{ color: '#7A8B7F' }}>
          Coloque la copia del oficio que queda en el archivo: solo se imprime
          el sello sobre la esquina superior izquierda de la hoja.
        </p>
      </div>

      {variante === 'completa' ? (
        <div
          className="relative mx-auto w-full aspect-[17/22] rounded-md bg-white"
          style={{ border: '2px dashed #CBD5D1' }}
          aria-label="Vista previa: posición del sello en la hoja"
        >
          {sello}
          <p
            className="absolute inset-x-0 bottom-6 text-center text-[11px] italic"
            style={{ color: '#CBD5D1' }}
          >
            Copia del oficio para el archivo
          </p>
        </div>
      ) : (
        <div className="flex justify-center">{sello}</div>
      )}
    </div>
  );
}
