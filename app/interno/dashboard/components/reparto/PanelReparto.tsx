'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { getNombreArea } from '@/lib/catalogos/areas';
import { INSTITUCION } from '@/lib/institucion';
import type { PlanillaReparto } from '@/src/types/planilla';
import { puedeAnular, resumenPlanilla } from '@/lib/planillas/entregas';

/* ══════════════════════════════════════════════════════════════
   Sprint Planilla de reparto — panel del mostrador.

   La ronda del papel en tres momentos:
    1. ANTES  — pendientes agrupados por dependencia → Generar planilla.
    2. RONDA  — se imprime la hoja PL-{año}-{NNNN} y viaja con la
       funcionaria recogiendo firmas.
    3. DESPUÉS — registra por fila quién recibió, sube el escaneo
       firmado y cierra el día (lo no entregado rueda a mañana).

   Parámetros cerrados con la funcionaria: UNA planilla del día,
   evidencia por escáner, y solo Recepción/Admin registra.
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#14532D';
const DORADO     = '#D4A017';

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #planilla-reparto-print,
  #planilla-reparto-print * { visibility: visible !important; }
  #planilla-reparto-print {
    display: block !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    background: white !important;
    z-index: 99999 !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  @page {
    size: letter landscape;
    margin: 10mm 8mm;
  }
}
`;

interface PendienteReparto {
  radicadoId: string;
  dependenciaDestino: string;
  asunto: string;
  fechaRadicado: string;
  horaRadicado: string;
  numeroFolios: number;
}

interface DatosReparto {
  pendientes: PendienteReparto[];
  planillas: PlanillaReparto[];
}

interface EntregaEnEdicion {
  recibidoPor: string;
  nota: string;
}

export interface PanelRepartoProps {
  onCerrar: () => void;
}

function nombreDependencia(id: string): string {
  return (NOMBRES_TENANT as Record<string, string>)[id] ?? id;
}

function fechaCorta(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota',
  });
}

export function PanelReparto({ onCerrar }: PanelRepartoProps) {
  const [datos, setDatos] = useState<DatosReparto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [entregas, setEntregas] = useState<Record<string, EntregaEnEdicion>>({});
  const [cerrarDia, setCerrarDia] = useState(true);
  const [escaneo, setEscaneo] = useState<File | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);

  const stylesInjected = useRef(false);
  const inputEscaneo = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/planillas');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'No fue posible consultar el reparto.');
      setDatos({ pendientes: body.pendientes ?? [], planillas: body.planillas ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible consultar el reparto.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const abierta = useMemo(
    () => datos?.planillas.find((p) => p.estado === 'POR_ENTREGAR') ?? null,
    [datos],
  );
  const resumen = abierta ? resumenPlanilla(abierta) : null;

  const pendientesPorDependencia = useMemo(() => {
    const grupos = new Map<string, PendienteReparto[]>();
    for (const p of datos?.pendientes ?? []) {
      const grupo = grupos.get(p.dependenciaDestino) ?? [];
      grupo.push(p);
      grupos.set(p.dependenciaDestino, grupo);
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [datos]);

  async function generarPlanilla() {
    setOcupado(true);
    setMensaje(null);
    setError(null);
    try {
      const res = await fetch('/api/planillas/generar', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'No fue posible generar la planilla.');
      setMensaje(`Planilla ${body.planilla.planillaId} generada. Imprímela para la ronda.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible generar la planilla.');
    } finally {
      setOcupado(false);
    }
  }

  function imprimirPlanilla() {
    if (!stylesInjected.current) {
      const tag = document.createElement('style');
      tag.id = 'planilla-reparto-print-styles';
      tag.textContent = PRINT_STYLES;
      document.head.appendChild(tag);
      stylesInjected.current = true;
    }
    window.print();
  }

  async function registrarEntregas() {
    if (!abierta) return;
    const lista = Object.entries(entregas)
      .map(([radicadoId, e]) => ({
        radicadoId,
        recibidoPor: e.recibidoPor.trim(),
        nota: e.nota.trim() || null,
      }))
      .filter((e) => e.recibidoPor.length > 0);

    if (lista.length === 0 && !cerrarDia) {
      setError('Escribe el nombre de quien recibió en al menos una fila, o marca cerrar el día.');
      return;
    }

    setOcupado(true);
    setMensaje(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('planillaId', abierta.planillaId);
      formData.set('entregas', JSON.stringify(lista));
      formData.set('cerrar', String(cerrarDia));
      if (escaneo) formData.set('escaneo', escaneo);

      const res = await fetch('/api/planillas/entregas', { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'No fue posible registrar las entregas.');

      const partes = [`${body.entregadas} entrega${body.entregadas === 1 ? '' : 's'} registrada${body.entregadas === 1 ? '' : 's'}`];
      if (body.liberadas > 0) partes.push(`${body.liberadas} liberada${body.liberadas === 1 ? '' : 's'} para mañana`);
      setMensaje(`${partes.join(' · ')}. Cada radicado ya muestra la entrega en su historia.`);

      setEntregas({});
      setEscaneo(null);
      if (inputEscaneo.current) inputEscaneo.current.value = '';
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible registrar las entregas.');
    } finally {
      setOcupado(false);
    }
  }

  async function anular() {
    if (!abierta) return;
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch('/api/planillas/anular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planillaId: abierta.planillaId, motivo: motivoAnulacion }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'No fue posible anular la planilla.');
      setMensaje(`Planilla ${abierta.planillaId} anulada. Sus documentos vuelven a pendientes.`);
      setAnulando(false);
      setMotivoAnulacion('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible anular la planilla.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 md:p-6 print:hidden">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid #E3EAE3' }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid #E3EAE3' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#8A6A12' }}>
                Mostrador · Reparto
              </span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: DORADO }} />
            </div>
            <p className="mt-0.5 text-lg font-black leading-tight" style={{ color: '#12261A' }}>
              Entrega de documentos físicos
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar reparto"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {cargando && (
            <p className="py-8 text-center text-sm" style={{ color: '#7A8B7F' }}>Consultando el reparto…</p>
          )}

          {!cargando && error && (
            <div className="rounded-xl px-4 py-3 text-[13px] font-semibold" style={{ background: '#FCEBEB', color: '#911111' }}>
              {error}
            </div>
          )}

          {!cargando && mensaje && (
            <div className="rounded-xl px-4 py-3 text-[13px] font-semibold" style={{ background: '#EEF4EE', color: VERDE_INST }}>
              {mensaje}
            </div>
          )}

          {/* ── Planilla en ruta ── */}
          {!cargando && abierta && resumen && (
            <section className="rounded-xl" style={{ border: `1.5px solid ${VERDE_INST}` }}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: '1px solid #E3EAE3' }}>
                <div className="min-w-0">
                  <p className="font-mono text-[15px] font-black" style={{ color: '#12261A' }}>
                    {abierta.planillaId}
                  </p>
                  <p className="text-[11px]" style={{ color: '#5F6F64' }}>
                    En ruta · generada el {fechaCorta(abierta.fechaGeneracion)} ·{' '}
                    {resumen.pendientes} por entregar · {resumen.entregadas} entregada{resumen.entregadas === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={imprimirPlanilla}
                    className="rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold transition-colors hover:bg-[#EEF4EE]"
                    style={{ border: `1px solid ${VERDE_INST}`, color: VERDE_INST, background: 'white' }}
                  >
                    Imprimir planilla
                  </button>
                  {puedeAnular(abierta) && !anulando && (
                    <button
                      type="button"
                      onClick={() => setAnulando(true)}
                      className="rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold text-red-800 transition-colors hover:bg-red-50"
                      style={{ border: '1px solid #E8C4C4', background: 'white' }}
                    >
                      Anular
                    </button>
                  )}
                </div>
              </div>

              {anulando && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ background: '#FCF7F7', borderBottom: '1px solid #E3EAE3' }}>
                  <input
                    type="text"
                    value={motivoAnulacion}
                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                    placeholder="Motivo de la anulación…"
                    aria-label="Motivo de la anulación"
                    className="min-w-0 flex-1 rounded-lg px-3 py-2 text-[13px] outline-none"
                    style={{ border: '1px solid #E3EAE3', color: '#12261A' }}
                  />
                  <button
                    type="button"
                    disabled={ocupado || !motivoAnulacion.trim()}
                    onClick={() => void anular()}
                    className="rounded-lg px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
                    style={{ background: '#B42318' }}
                  >
                    Confirmar anulación
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAnulando(false); setMotivoAnulacion(''); }}
                    className="rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                    style={{ color: '#5F6F64' }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Filas: pendientes editables, entregadas en solo lectura */}
              <div>
                {abierta.filas.map((fila, i) => (
                  <div
                    key={fila.radicadoId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5"
                    style={i > 0 ? { borderTop: '1px solid #EEF2EE' } : undefined}
                  >
                    <div className="min-w-0 flex-1 basis-52">
                      <p className="truncate font-mono text-[12.5px] font-bold" style={{ color: '#12261A' }}>
                        {fila.radicadoId}
                      </p>
                      <p className="truncate text-[11px]" style={{ color: '#5F6F64' }}>
                        {nombreDependencia(fila.dependenciaDestino)} · {fila.asunto}
                      </p>
                    </div>

                    {fila.estado === 'PENDIENTE' && (
                      <div className="flex min-w-0 flex-[1.4] basis-64 gap-2">
                        <input
                          type="text"
                          value={entregas[fila.radicadoId]?.recibidoPor ?? ''}
                          onChange={(e) => setEntregas((prev) => ({
                            ...prev,
                            [fila.radicadoId]: {
                              recibidoPor: e.target.value,
                              nota: prev[fila.radicadoId]?.nota ?? '',
                            },
                          }))}
                          placeholder="Recibió (nombre)…"
                          aria-label={`Nombre de quien recibió ${fila.radicadoId}`}
                          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-700"
                          style={{ border: '1px solid #E3EAE3', color: '#12261A' }}
                        />
                        <input
                          type="text"
                          value={entregas[fila.radicadoId]?.nota ?? ''}
                          onChange={(e) => setEntregas((prev) => ({
                            ...prev,
                            [fila.radicadoId]: {
                              recibidoPor: prev[fila.radicadoId]?.recibidoPor ?? '',
                              nota: e.target.value,
                            },
                          }))}
                          placeholder="Lugar/nota (opcional)"
                          aria-label={`Nota de entrega de ${fila.radicadoId}`}
                          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-700"
                          style={{ border: '1px solid #E3EAE3', color: '#12261A' }}
                        />
                      </div>
                    )}

                    {fila.estado === 'ENTREGADA' && fila.entrega && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#EEF4EE', color: VERDE_INST }}>
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Recibió {fila.entrega.recibidoPor}
                      </span>
                    )}

                    {fila.estado === 'LIBERADA' && (
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#EEF2F5', color: '#3A4551' }}>
                        Rueda a la próxima planilla
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Cierre de la ronda */}
              <div className="space-y-3 px-4 py-3" style={{ borderTop: '1px solid #E3EAE3', background: '#F8FAF7' }}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold" style={{ color: '#12261A' }}>
                    <input
                      type="checkbox"
                      checked={cerrarDia}
                      onChange={(e) => setCerrarDia(e.target.checked)}
                      className="h-4 w-4 accent-emerald-800"
                    />
                    Cerrar el día — lo no entregado rueda a la planilla de mañana
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    className="cursor-pointer rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold transition-colors hover:bg-[#EEF4EE]"
                    style={{ border: '1px solid #E3EAE3', color: escaneo ? VERDE_INST : '#5F6F64', background: 'white' }}
                  >
                    <input
                      ref={inputEscaneo}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => setEscaneo(e.target.files?.[0] ?? null)}
                    />
                    {escaneo ? `Escaneo listo: ${escaneo.name}` : 'Adjuntar escaneo firmado (PDF)'}
                  </label>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void registrarEntregas()}
                    className="rounded-[10px] px-4 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: DORADO, color: '#3D2C00', border: '1px solid #B8890F' }}
                  >
                    {ocupado ? 'Registrando…' : 'Registrar entregas'}
                  </button>
                </div>
                {abierta.escaneoNombre && (
                  <p className="text-[11px]" style={{ color: VERDE_INST }}>
                    ✓ Escaneo firmado ya cargado: {abierta.escaneoNombre}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ── Pendientes → generar ── */}
          {!cargando && !abierta && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-bold" style={{ color: '#12261A' }}>
                  Pendientes de entrega
                  <span className="ml-2 text-[11px] font-semibold" style={{ color: '#7A8B7F' }}>
                    {datos?.pendientes.length ?? 0} documento{(datos?.pendientes.length ?? 0) === 1 ? '' : 's'} físico{(datos?.pendientes.length ?? 0) === 1 ? '' : 's'}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={ocupado || (datos?.pendientes.length ?? 0) === 0}
                  onClick={() => void generarPlanilla()}
                  className="rounded-[10px] px-4 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: DORADO, color: '#3D2C00', border: '1px solid #B8890F' }}
                >
                  {ocupado ? 'Generando…' : 'Generar planilla del día'}
                </button>
              </div>

              {(datos?.pendientes.length ?? 0) === 0 ? (
                <p className="mt-3 text-xs" style={{ color: '#7A8B7F' }}>
                  No hay documentos físicos esperando reparto. Los radicados en papel
                  aparecen aquí hasta que se registra su entrega.
                </p>
              ) : (
                <div className="mt-2.5 overflow-hidden rounded-xl bg-white" style={{ border: '1px solid #E3EAE3' }}>
                  {pendientesPorDependencia.map(([dep, filas]) => (
                    <div key={dep}>
                      <p className="px-4 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-widest" style={{ color: '#5F8A6E', background: '#F8FAF7' }}>
                        {nombreDependencia(dep)} · {filas.length}
                      </p>
                      {filas.map((p) => (
                        <div key={p.radicadoId} className="flex items-center gap-3 px-4 py-2" style={{ borderTop: '1px solid #EEF2EE' }}>
                          <span className="w-10 shrink-0 text-[11px] tabular-nums" style={{ color: '#7A8B7F' }}>
                            {p.horaRadicado || fechaCorta(p.fechaRadicado)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-[12.5px] font-bold" style={{ color: '#12261A' }}>
                              {p.radicadoId}
                            </span>
                            <span className="block truncate text-[11px]" style={{ color: '#5F6F64' }}>
                              {p.asunto}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums" style={{ color: '#7A8B7F' }}>
                            {p.numeroFolios} folio{p.numeroFolios === 1 ? '' : 's'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Historial reciente ── */}
          {!cargando && (datos?.planillas.length ?? 0) > 0 && (
            <section>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#5F8A6E' }}>
                Planillas recientes
              </p>
              <div className="mt-2 overflow-hidden rounded-xl bg-white" style={{ border: '1px solid #E3EAE3' }}>
                {datos!.planillas.slice(0, 8).map((p, i) => {
                  const r = resumenPlanilla(p);
                  return (
                    <div
                      key={p.planillaId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                      style={i > 0 ? { borderTop: '1px solid #EEF2EE' } : undefined}
                    >
                      <span className="font-mono text-[12.5px] font-bold" style={{ color: '#12261A' }}>
                        {p.planillaId}
                      </span>
                      <span className="text-[11px]" style={{ color: '#7A8B7F' }}>
                        {fechaCorta(p.fechaGeneracion)} · {r.entregadas}/{r.total} entregada{r.entregadas === 1 ? '' : 's'}
                      </span>
                      <span className="ml-auto flex items-center gap-1.5">
                        {p.escaneoPath && (
                          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: '#EEF4EE', color: VERDE_INST }}>
                            Escaneo ✓
                          </span>
                        )}
                        <span
                          className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                          style={p.estado === 'POR_ENTREGAR'
                            ? { background: '#FAEEDA', color: '#7A4F0A' }
                            : p.estado === 'ANULADA'
                              ? { background: '#FCEBEB', color: '#911111' }
                              : { background: '#EEF4EE', color: VERDE_INST }}
                        >
                          {p.estado === 'POR_ENTREGAR' ? 'En ruta' : p.estado === 'ANULADA' ? 'Anulada' : 'Cerrada'}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── Hoja imprimible (solo visible al imprimir) ── */}
      {abierta && (
        <div id="planilla-reparto-print" style={{ display: 'none' }}>
          <PlanillaImprimible planilla={abierta} />
        </div>
      )}
    </div>
  );
}

/**
 * La hoja formal que viaja con la funcionaria — heredera del formato
 * F-GSC-8200-238-37-001 de Bucaramanga en talla Simacota: número
 * único, filas agrupadas por dependencia y renglón de firma por fila.
 */
function PlanillaImprimible({ planilla }: { planilla: PlanillaReparto }) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#111', fontSize: 11 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #111', padding: '6px 10px', width: '60%' }}>
              <strong style={{ fontSize: 13 }}>{INSTITUCION.nombre.toUpperCase()}</strong>
              <br />
              Planilla para entrega interna de correspondencia
            </td>
            <td style={{ border: '1px solid #111', padding: '6px 10px' }}>
              <strong>Planilla No.: {planilla.planillaId}</strong>
              <br />
              Fecha de generación: {new Date(planilla.fechaGeneracion).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
              <br />
              Generada por: {planilla.generadaPor.nombre}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['No.', 'Fecha de radicado', 'Hora rad.', 'Número de radicado', 'Dependencia asignada', 'Área asignada', 'Solicitante', 'Asunto', 'Nro. fol.', 'Anexos', 'Fecha / Hora de recibido', 'Devuelta SÍ / NO', 'Nombre y firma'].map((h) => (
              <th key={h} style={{ border: '1px solid #111', padding: '4px 6px', background: '#EFEFEF', textAlign: 'left', fontSize: 10 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {planilla.filas.map((fila, i) => (
            <tr key={fila.radicadoId}>
              <td style={{ border: '1px solid #111', padding: '4px 6px' }}>{i + 1}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px' }}>{fechaCorta(fila.fechaRadicado)}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px' }}>{fila.horaRadicado}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px', fontFamily: 'monospace' }}>{fila.radicadoId}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px' }}>{nombreDependencia(fila.dependenciaDestino)}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px' }}>{getNombreArea(fila.areaAsignada) || '—'}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px' }}>{fila.solicitanteNombre}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px' }}>{fila.asunto}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px', textAlign: 'center' }}>{fila.numeroFolios}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px' }}>{fila.anexosDescripcion ?? '—'}</td>
              <td style={{ border: '1px solid #111', padding: '4px 6px', minWidth: 80 }}>
                Día __ Mes __ Año __ Hora __:__
              </td>
              <td style={{ border: '1px solid #111', padding: '4px 6px', minWidth: 80 }}>
                Devuelta SÍ__ NO__ Reasignada a: ______
              </td>
              <td style={{ border: '1px solid #111', padding: '4px 6px', minWidth: 130 }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #111', padding: '5px 8px', fontSize: 9.5, width: '55%' }}>
              Información de impresión: {new Date(planilla.fechaGeneracion).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
              {' · '}Generada por: {planilla.generadaPor.nombre}
            </td>
            <td style={{ border: '1px solid #111', padding: '5px 8px', fontSize: 10 }}>
              <strong>NOMBRE COMPLETO DE QUIEN ENTREGA:</strong> ______________________________
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: 8, fontSize: 9.5 }}>
        {INSTITUCION.sistema} · {INSTITUCION.municipio}, {INSTITUCION.departamento} ·
        Documento de control de entrega — la hoja firmada se digitaliza y se adjunta a la planilla en el sistema.
        Una devolución marcada en papel se registra en el sistema como traslado del radicado.
      </p>
    </div>
  );
}
