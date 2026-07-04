'use client';

import { useMemo, useState } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { SalidaOficial } from '@/src/types/salida';
import { formatFechaCortaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — libro de correspondencia despachada.

   La serie 2-SAL completa, consultable y buscable: lo que control
   interno audita y lo que Laura consulta cuando alguien pregunta
   "¿ustedes me enviaron ese oficio?". El amarre abre el radicado de
   entrada correspondiente.
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#14532D';

const MEDIO_LABEL: Record<string, string> = {
  CORREO:     'Correo electrónico',
  FISICO:     'Correo físico',
  MENSAJERO:  'Mensajero',
  PRESENCIAL: 'Entrega presencial',
};

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export interface VistaSalidasProps {
  salidas:        SalidaOficial[];
  cargando:       boolean;
  error:          string | null;
  onAbrirEntrada: (radicadoId: string) => void;
  onNuevaSalida:  () => void;
}

export function VistaSalidas({
  salidas,
  cargando,
  error,
  onAbrirEntrada,
  onNuevaSalida,
}: VistaSalidasProps) {
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return salidas;
    return salidas.filter((s) =>
      s.salidaId.toLowerCase().includes(q)
      || normalizar(s.destinatario.nombre).includes(q)
      || normalizar(s.destinatario.entidad ?? '').includes(q)
      || normalizar(s.asunto).includes(q)
      || (s.radicadoEntradaId ?? '').toLowerCase().includes(q));
  }, [salidas, busqueda]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6" style={{ background: '#F8FAF7' }}>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: '#8A6A12' }}>
            Correspondencia despachada
          </p>
          <h2 className="text-xl font-black" style={{ color: '#12261A' }}>Libro de salidas</h2>
        </div>
        <button
          type="button"
          onClick={onNuevaSalida}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold px-4 py-2.5 rounded-[10px] transition-opacity hover:opacity-90"
          style={{ background: '#D4A017', color: '#3D2C00', border: '1px solid #B8890F' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          Registrar salida
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número de salida, destinatario, asunto o radicado de entrada…"
          aria-label="Buscar en el libro de salidas"
          className="input-internal w-full max-w-xl"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 mb-4 text-xs"
           style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {error}
        </p>
      )}

      {cargando && salidas.length === 0 ? (
        <p className="text-xs" style={{ color: '#7A8B7F' }}>Cargando libro de salidas…</p>
      ) : visibles.length === 0 ? (
        <p className="text-xs" style={{ color: '#7A8B7F' }}>
          {salidas.length === 0
            ? 'Aún no hay salidas registradas. La primera correspondencia despachada aparecerá aquí con su número 2-SAL.'
            : 'Ninguna salida coincide con la búsqueda.'}
        </p>
      ) : (
        <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E3EAE3' }}>
          {visibles.map((s, i) => (
            <div
              key={s.salidaId}
              className="flex items-center gap-3 px-4 py-3 flex-wrap"
              style={i > 0 ? { borderTop: '1px solid #EEF2EE' } : undefined}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[13px] font-bold" style={{ color: '#12261A' }}>
                    {s.salidaId}
                  </span>
                  <span
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={s.tipoSalida === 'RESPUESTA'
                      ? { background: '#E6F1FB', color: '#185FA5' }
                      : { background: '#EEF2F5', color: '#3A4551' }}
                  >
                    {s.tipoSalida === 'RESPUESTA' ? 'Respuesta' : 'Oficio independiente'}
                  </span>
                  <span className="text-[11px]" style={{ color: '#7A8B7F' }}>
                    {formatFechaCortaColombia(s.fechaSalida)} · {MEDIO_LABEL[s.medioEnvio] ?? s.medioEnvio}
                  </span>
                </div>
                <p className="text-[12px] mt-0.5 truncate" style={{ color: '#3A4551' }}>
                  Para: <span className="font-semibold">{s.destinatario.nombre}</span>
                  {s.destinatario.entidad ? ` (${s.destinatario.entidad})` : ''}
                  {' · '}{s.asunto}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: '#7A8B7F' }}>
                  Despacha: {NOMBRES_TENANT[s.dependenciaOrigen] ?? s.dependenciaOrigen} · Firma: {s.firmante.nombre}
                </p>
              </div>
              {s.radicadoEntradaId && (
                <button
                  type="button"
                  onClick={() => onAbrirEntrada(s.radicadoEntradaId as string)}
                  aria-label={`Abrir radicado de entrada ${s.radicadoEntradaId}`}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold shrink-0 hover:underline"
                  style={{ color: VERDE_INST }}
                >
                  Entrada {s.radicadoEntradaId}
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px]" style={{ color: '#7A8B7F' }}>
        {visibles.length} salida{visibles.length !== 1 ? 's' : ''} · el libro es inmutable:
        una corrección se registra como salida nueva.
      </p>
    </div>
  );
}
