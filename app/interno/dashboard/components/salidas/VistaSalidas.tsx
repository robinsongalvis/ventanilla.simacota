'use client';

import { useMemo, useState } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { SalidaOficial } from '@/src/types/salida';
import { formatFechaCortaColombia } from '@/lib/fecha-colombia';
import { SelloDespacho } from './SelloDespacho';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { EmptyState } from '@/app/components/design-system/EmptyState';
import { BarraTrabajo } from '@/app/components/design-system/BarraTrabajo';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { ArrowRight, FileDown, Send } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — libro de correspondencia despachada.

   La serie 2-SAL completa, consultable y buscable: lo que control
   interno audita y lo que Laura consulta cuando alguien pregunta
   "¿ustedes me enviaron ese oficio?". El amarre abre el radicado de
   entrada correspondiente.
══════════════════════════════════════════════════════════════ */

const VERDE_INST = 'var(--tema-texto-007049)';

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
  /**
   * Ola 3 (ADR-0046) — presente solo si el rol registra salidas
   * (`permisos.registrarSalida`). CONTROL_INTERNO lee el libro, pero antes
   * veía un botón «Registrar salida» que no hacía nada: sin acción no hay botón.
   */
  onNuevaSalida?: () => void;
}

export function VistaSalidas({
  salidas,
  cargando,
  error,
  onAbrirEntrada,
  onNuevaSalida,
}: VistaSalidasProps) {
  const [busqueda, setBusqueda] = useState('');
  // Fase B — constancia de despacho reimprimible desde el libro.
  const [constanciaDe, setConstanciaDe] = useState<SalidaOficial | null>(null);

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
    <div className="flex-1 overflow-y-auto pb-4" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      <SectionHeader
        titulo="Libro de salidas"
        subtitulo="Correspondencia despachada"
        indicador={<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#8A6A12' }} />}
        acciones={onNuevaSalida && (
          <BotonAccion variante="primaria" Icono={Send} onClick={onNuevaSalida}>Registrar salida</BotonAccion>
        )}
      />

      <BarraTrabajo
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholder="Buscar por número de salida, destinatario, asunto o radicado de entrada…"
        ariaLabel="Buscar en el libro de salidas"
        contador={`${visibles.length} salida${visibles.length !== 1 ? 's' : ''}`}
        limpiable
      />

      <div className="mt-2 px-3 sm:px-4 lg:px-6">
      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 mb-2 text-xs"
           style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-991b1b)' }}>
          {error}
        </p>
      )}

      {cargando && salidas.length === 0 ? (
        <p role="status" className="py-3 text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>Cargando libro de salidas…</p>
      ) : visibles.length === 0 ? (
        <EmptyState
          titulo={salidas.length === 0 ? 'Sin salidas registradas' : 'Sin resultados'}
          descripcion={salidas.length === 0
            ? 'Aún no hay salidas registradas. La primera correspondencia despachada aparecerá aquí con su número 2-SAL.'
            : 'Ninguna salida coincide con la búsqueda.'}
        />
      ) : (
        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] overflow-hidden">
          {visibles.map((s, i) => (
            <div
              key={s.salidaId}
              className="flex items-center gap-2 px-3 py-2.5 flex-wrap"
              style={i > 0 ? { borderTop: '1px solid var(--tema-borde-eef2ee)' } : undefined}
            >
              <div className="min-w-0 flex-[1_1_16rem]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--tema-texto-172033)' }}>
                    {s.salidaId}
                  </span>
                  <span
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={s.tipoSalida === 'RESPUESTA'
                      ? { background: 'var(--tema-fondo-e6f1fb)', color: 'var(--tema-texto-185fa5)' }
                      : { background: 'var(--tema-fondo-eef2f5)', color: 'var(--tema-texto-3a4551)' }}
                  >
                    {s.tipoSalida === 'RESPUESTA' ? 'Respuesta' : 'Oficio independiente'}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--tema-texto-64748b)' }}>
                    {formatFechaCortaColombia(s.fechaSalida)} · {MEDIO_LABEL[s.medioEnvio] ?? s.medioEnvio}
                  </span>
                </div>
                <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--tema-texto-3a4551)' }}>
                  Para: <span className="font-semibold">{s.destinatario.nombre}</span>
                  {s.destinatario.entidad ? ` (${s.destinatario.entidad})` : ''}
                  {' · '}{s.asunto}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tema-texto-64748b)' }}>
                  Despacha: {NOMBRES_TENANT[s.dependenciaOrigen] ?? s.dependenciaOrigen} · Firma: {s.firmante.nombre}
                </p>
              </div>
              {/* Fase B — el oficio despachado, servido por la descarga
                  segura (H-01): URL firmada corta tras autorización. */}
              {s.archivoPath && (
                <a
                  href={`/api/interno/archivo?path=${encodeURIComponent(s.archivoPath)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver oficio despachado de ${s.salidaId}`}
                  title={s.archivoNombre ?? 'Oficio despachado (PDF)'}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold shrink-0 px-2.5 py-1 rounded-lg"
                  style={{ border: '1px solid var(--tema-borde-007049)', color: VERDE_INST, background: 'var(--tema-fondo-ffffff)' }}
                >
                  <FileDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                  Ver oficio
                </a>
              )}
              <button
                type="button"
                onClick={() => setConstanciaDe(s)}
                aria-label={`Imprimir constancia de despacho de ${s.salidaId}`}
                className="text-[11.5px] font-semibold shrink-0 px-2.5 py-1 rounded-lg"
                style={{ border: '1px solid var(--tema-borde-dce4ea)', color: 'var(--tema-texto-475569)', background: 'var(--tema-fondo-ffffff)' }}
              >
                Constancia
              </button>
              {s.radicadoEntradaId && (
                <button
                  type="button"
                  onClick={() => onAbrirEntrada(s.radicadoEntradaId as string)}
                  aria-label={`Abrir radicado de entrada ${s.radicadoEntradaId}`}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold shrink-0 hover:underline"
                  style={{ color: VERDE_INST }}
                >
                  Entrada {s.radicadoEntradaId}
                  <ArrowRight className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px]" style={{ color: 'var(--tema-texto-64748b)' }}>
        {visibles.length} salida{visibles.length !== 1 ? 's' : ''} · el libro es inmutable:
        una corrección se registra como salida nueva.
      </p>
      </div>

      {/* Fase B — modal ligero de la constancia de despacho. */}
      {constanciaDe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3"
          role="dialog"
          aria-modal="true"
          aria-label={`Constancia de despacho de ${constanciaDe.salidaId}`}
        >
          {/* Velo sólido — sin blur (lección de rendimiento). */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setConstanciaDe(null)}
            className="absolute inset-0 bg-black/55"
          />
          <div
            className="relative w-full max-w-lg bg-[var(--tema-fondo-ffffff)] rounded-2xl shadow-2xl overflow-y-auto flex flex-col items-center gap-4 px-6 py-6"
            style={{ border: '1px solid var(--tema-borde-dce4ea)', maxHeight: 'calc(100dvh - 24px)' }}
          >
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--tema-texto-8a6a12)' }}>
                Constancia de despacho
              </p>
              <p className="text-lg font-black font-mono" style={{ color: VERDE_INST }}>
                {constanciaDe.salidaId}
              </p>
            </div>
            <SelloDespacho salida={constanciaDe} />
            <button
              type="button"
              onClick={() => setConstanciaDe(null)}
              className="px-5 py-2 rounded-xl text-sm font-bold"
              style={{ border: '1px solid var(--tema-borde-dce4ea)', color: 'var(--tema-texto-475569)' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
