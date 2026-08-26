'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import type { RadicadoCandidato } from '@/app/api/licencias/radicados-candidatos/route';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { NumeroLegal } from './NumeroLegal';
import { SelectorSubtiposNormativos } from './SelectorSubtiposNormativos';

/* ══════════════════════════════════════════════════════════════
   Modal "Crear desde radicado" — Bloque A·A4 (handoff radicado⇄expediente).

   Mismo patrón visual que `RadicarSolicitudModal` (overlay + card, `role=
   dialog`, error del servidor mostrado literal en `role=alert`) y MISMO
   checklist de subtipos (`SelectorSubtiposNormativos`, extraído de ese
   modal — no se duplica).

   Flujo: al abrir, carga `GET /api/licencias/radicados-candidatos`
   (radicados de Planeación sin vínculo, no cerrados). El funcionario
   elige UN radicado + subtipos → `POST .../expedientes/desde-radicado`.
   El vínculo es ÚNICO en el servidor: un 409 ("radicado ya vinculado") es
   el error más probable con uso concurrente (dos funcionarios viendo la
   misma lista) — se muestra literal, igual que cualquier otro error.
══════════════════════════════════════════════════════════════ */

export interface CrearDesdeRadicadoModalProps {
  onCerrar: () => void;
  /** Se invoca en cuanto el servidor confirma la creación — el caller decide si refresca su lista en segundo plano; el modal sigue abierto mostrando la confirmación. */
  onCreado?: (expediente: ExpedienteLicenciaDoc) => void;
}

interface ResultadoCreacion {
  expediente: ExpedienteLicenciaDoc;
  constanciaEnviada: boolean;
}

export function CrearDesdeRadicadoModal({ onCerrar, onCreado }: CrearDesdeRadicadoModalProps) {
  const router = useRouter();

  const [candidatos, setCandidatos] = useState<RadicadoCandidato[]>([]);
  const [cargandoCandidatos, setCargandoCandidatos] = useState(true);
  const [errorCandidatos, setErrorCandidatos] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState<string | null>(null);
  const [errorSeleccion, setErrorSeleccion] = useState<string | null>(null);
  const [subtipos, setSubtipos] = useState<string[]>([]);
  const [errorSubtipos, setErrorSubtipos] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [creado, setCreado] = useState<ResultadoCreacion | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setCargandoCandidatos(true);
      setErrorCandidatos(null);
      try {
        const res = await fetch('/api/licencias/radicados-candidatos', { credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (!res.ok) {
          setErrorCandidatos(body.error ?? 'No fue posible cargar los radicados candidatos.');
          return;
        }
        setCandidatos(Array.isArray(body.radicados) ? body.radicados : []);
      } catch {
        if (!cancelado) setErrorCandidatos('Error de red al cargar los radicados candidatos.');
      } finally {
        if (!cancelado) setCargandoCandidatos(false);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCerrar]);

  function alternarSubtipo(codigo: string) {
    setSubtipos((prev) => (prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]));
  }

  const candidatosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return candidatos;
    return candidatos.filter(
      (r) =>
        r.radicadoId.toLowerCase().includes(q) ||
        r.solicitanteNombre.toLowerCase().includes(q) ||
        r.tipoSolicitud.toLowerCase().includes(q),
    );
  }, [candidatos, busqueda]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let hayErrorLocal = false;
    if (!radicadoSeleccionado) {
      setErrorSeleccion('Selecciona el radicado de origen.');
      hayErrorLocal = true;
    } else {
      setErrorSeleccion(null);
    }
    if (subtipos.length === 0) {
      setErrorSubtipos('Selecciona al menos un subtipo (figura normativa).');
      hayErrorLocal = true;
    } else {
      setErrorSubtipos(null);
    }
    if (hayErrorLocal) return;

    setErrorServidor(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/licencias/expedientes/desde-radicado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ radicadoId: radicadoSeleccionado, subtipos }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorServidor(body.error ?? 'No fue posible crear el expediente desde el radicado.');
        return;
      }
      const expediente = body.expediente as ExpedienteLicenciaDoc;
      setCreado({ expediente, constanciaEnviada: Boolean(body.constanciaEnviada) });
      onCreado?.(expediente);
    } catch {
      setErrorServidor('Error de red al crear el expediente desde el radicado.');
    } finally {
      setGuardando(false);
    }
  }

  const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-widest';
  const labelStyle = { color: '#667085' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3"
      role="dialog"
      aria-modal="true"
      aria-label="Crear expediente desde radicado"
    >
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/55" />

      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ border: '1px solid #D9E2D9', maxHeight: 'calc(100dvh - 24px)' }}
      >
        <header className="px-5 py-4" style={{ borderBottom: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#8A6A12' }}>
            Secretaría de Planeación · Licencias Urbanísticas
          </p>
          <h2 className="text-lg font-black leading-tight" style={{ color: '#12261A' }}>
            Crear expediente desde radicado
          </h2>
          <p className="text-xs mt-1" style={{ color: '#5F6F64' }}>
            Vincula un radicado de Ventanilla ya existente con un expediente de demostración (esPrueba) nuevo — el vínculo es único, un radicado ya vinculado no puede volver a usarse.
          </p>
        </header>

        {creado ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-success-text)' }}>
              Expediente creado
            </p>
            <p className="text-2xl font-black font-mono" style={{ color: '#12261A' }}>
              {creado.expediente.numeroExpediente?.numero ?? creado.expediente.id}
            </p>
            <p className="text-xs max-w-sm" style={{ color: '#667085' }}>
              Número de demostración (esPrueba) — no es un consecutivo legal. Vinculado al radicado{' '}
              <NumeroLegal value={radicadoSeleccionado ?? ''} variant="radicado" size="sm" />.
              {creado.constanciaEnviada && ' Se envió al solicitante el acuse de recibo de su solicitud.'}
            </p>
            {!creado.constanciaEnviada && (
              <p
                role="alert"
                className="rounded-lg px-3 py-2 text-xs max-w-sm text-left font-semibold"
                style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}
              >
                ⚠ Acuse de recibo NO enviado al ciudadano. Mientras el candado de emisión real (R10) siga cerrado, el expediente lleva un número de DEMOSTRACIÓN y la plataforma no le entrega al ciudadano un número que no pertenece a la serie legal. Si el candado ya está abierto, la causa sería que el radicado no tiene un correo de contacto habilitado.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ border: '1px solid #D9E2D9', color: '#475569' }}
              >
                Volver a la bandeja
              </button>
              <button
                type="button"
                onClick={() => router.push(`/interno/licencias/${creado.expediente.id}`)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#14532D' }}
              >
                Ver expediente →
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <fieldset>
              <legend className={labelCls} style={labelStyle}>
                Radicado de origen — selecciona uno
              </legend>

              {cargandoCandidatos && (
                <p className="text-sm py-3" style={{ color: '#667085' }}>
                  Cargando radicados…
                </p>
              )}

              {!cargandoCandidatos && errorCandidatos && (
                <p
                  role="alert"
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
                >
                  {errorCandidatos}
                </p>
              )}

              {!cargandoCandidatos && !errorCandidatos && candidatos.length === 0 && (
                <p className="text-sm py-3" style={{ color: '#667085' }}>
                  No hay radicados de Planeación pendientes de expediente.
                </p>
              )}

              {!cargandoCandidatos && !errorCandidatos && candidatos.length > 0 && (
                <>
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="input-internal mb-2"
                    placeholder="Buscar por radicado, solicitante o tipo de solicitud…"
                    aria-label="Buscar radicado candidato"
                  />
                  <div
                    role="radiogroup"
                    aria-label="Radicados candidatos"
                    className="flex flex-col gap-0 max-h-56 overflow-y-auto rounded-lg"
                    style={{ border: '1px solid #D9E2D9' }}
                  >
                    {candidatosFiltrados.length === 0 ? (
                      <p className="text-sm px-3 py-3" style={{ color: '#667085' }}>
                        Ningún radicado coincide con &quot;{busqueda}&quot;.
                      </p>
                    ) : (
                      candidatosFiltrados.map((r, i) => (
                        <label
                          key={r.radicadoId}
                          className="flex items-start gap-2.5 px-3 py-2.5 text-sm cursor-pointer"
                          style={{
                            borderTop: i === 0 ? 'none' : '1px solid #EEF4EE',
                            background: radicadoSeleccionado === r.radicadoId ? '#FBF3D9' : 'transparent',
                          }}
                        >
                          <input
                            type="radio"
                            name="radicado-candidato"
                            value={r.radicadoId}
                            checked={radicadoSeleccionado === r.radicadoId}
                            onChange={() => setRadicadoSeleccionado(r.radicadoId)}
                            className="mt-1 h-4 w-4 accent-[#14532D] focus-visible:outline-none focus-visible:ring-2"
                          />
                          <span className="flex flex-col gap-0.5 min-w-0">
                            <NumeroLegal value={r.radicadoId} variant="radicado" size="sm" />
                            <span style={{ color: '#1F2933' }}>{r.solicitanteNombre || 'Sin nombre registrado'}</span>
                            <span className="text-xs" style={{ color: '#667085' }}>
                              {r.tipoSolicitud || 'Tipo de solicitud sin registrar'} · {formatFechaColombia(r.fechaRadicado)}
                            </span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}

              {errorSeleccion && (
                <p role="alert" className="text-xs mt-2" style={{ color: 'var(--color-danger-text)' }}>
                  {errorSeleccion}
                </p>
              )}
            </fieldset>

            <SelectorSubtiposNormativos seleccionados={subtipos} onAlternar={alternarSubtipo} error={errorSubtipos} />

            {errorServidor && (
              <p
                role="alert"
                className="rounded-lg px-3 py-2 text-xs"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
              >
                {errorServidor}
              </p>
            )}

            <footer className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ border: '1px solid #D9E2D9', color: '#475569' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: '#14532D' }}
              >
                {guardando ? 'Creando…' : 'Crear expediente'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
