'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATALOGO_FIGURAS_NORMATIVAS, type TipoFigura } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

/* ══════════════════════════════════════════════════════════════
   Formulario "Radicar solicitud" — bloque "Integración UI y demo".

   Envía a `POST /api/licencias/expedientes`. El servidor SIEMPRE crea un
   expediente de PRUEBA (`esPrueba: true`, candado R10) — este formulario
   no expone ninguna forma de pedir lo contrario, ni finge que el número
   resultante es un consecutivo legal.

   Mismo patrón visual que el resto de modales del panel (`RegistroExpres
   Modal`, `app/interno/dashboard/components/`): overlay + card, `role=
   dialog`, error del servidor mostrado literal en `role=alert`.
══════════════════════════════════════════════════════════════ */

const TITULO_GRUPO: Record<TipoFigura, string> = {
  LICENCIA: 'Licencias',
  ACTO_RECONOCIMIENTO: 'Actos de reconocimiento',
  OTRA_ACTUACION: 'Otras actuaciones',
};

const GRUPOS: TipoFigura[] = ['LICENCIA', 'ACTO_RECONOCIMIENTO', 'OTRA_ACTUACION'];

export interface RadicarSolicitudModalProps {
  onCerrar: () => void;
  /** Se invoca en cuanto el servidor confirma la creación — el caller decide si refresca su lista en segundo plano; el modal sigue abierto mostrando la confirmación. */
  onCreado?: (expediente: ExpedienteLicenciaDoc) => void;
}

export function RadicarSolicitudModal({ onCerrar, onCreado }: RadicarSolicitudModalProps) {
  const router = useRouter();

  const [solicitanteNombre, setSolicitanteNombre] = useState('');
  const [solicitanteDocumento, setSolicitanteDocumento] = useState('');
  const [subtipos, setSubtipos] = useState<string[]>([]);
  const [errorSubtipos, setErrorSubtipos] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [creado, setCreado] = useState<ExpedienteLicenciaDoc | null>(null);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (subtipos.length === 0) {
      setErrorSubtipos('Selecciona al menos un subtipo (figura normativa).');
      return;
    }
    setErrorSubtipos(null);
    setErrorServidor(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/licencias/expedientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ solicitanteNombre, solicitanteDocumento, subtipos }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorServidor(body.error ?? 'No fue posible radicar la solicitud.');
        return;
      }
      setCreado(body.expediente as ExpedienteLicenciaDoc);
      onCreado?.(body.expediente as ExpedienteLicenciaDoc);
    } catch {
      setErrorServidor('Error de red al radicar la solicitud.');
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
      aria-label="Radicar solicitud de licencia"
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
            Radicar solicitud
          </h2>
          <p className="text-xs mt-1" style={{ color: '#5F6F64' }}>
            Crea un expediente de demostración (esPrueba) — la emisión con consecutivo legal está bloqueada hasta autorizar la siembra (R10).
          </p>
        </header>

        {creado ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#16A34A' }}>
              Expediente creado
            </p>
            <p className="text-2xl font-black font-mono" style={{ color: '#12261A' }}>
              {creado.numeroExpediente?.numero ?? creado.id}
            </p>
            <p className="text-xs max-w-sm" style={{ color: '#667085' }}>
              Número de demostración (esPrueba) — no es un consecutivo legal. Puedes verlo en el detalle o volver a la bandeja.
            </p>
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
                onClick={() => router.push(`/interno/licencias/${creado.id}`)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#14532D' }}
              >
                Ver expediente →
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              <label>
                <span className={labelCls} style={labelStyle}>Nombre del solicitante</span>
                <input
                  type="text"
                  value={solicitanteNombre}
                  onChange={(e) => setSolicitanteNombre(e.target.value)}
                  required
                  className="input-internal"
                  placeholder="Carlos Alberto Rojas Mantilla"
                />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Documento del solicitante</span>
                <input
                  type="text"
                  value={solicitanteDocumento}
                  onChange={(e) => setSolicitanteDocumento(e.target.value)}
                  required
                  className="input-internal"
                  placeholder="13456789"
                />
              </label>
            </div>

            <fieldset>
              <legend className={labelCls} style={labelStyle}>
                Subtipos (figuras normativas) — selecciona al menos uno
              </legend>
              <div className="flex flex-col gap-3 mt-1">
                {GRUPOS.map((grupo) => {
                  const figuras = CATALOGO_FIGURAS_NORMATIVAS.filter((f) => f.tipoFigura === grupo);
                  if (figuras.length === 0) return null;
                  return (
                    <div key={grupo}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>
                        {TITULO_GRUPO[grupo]}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                        {figuras.map((f) => (
                          <label key={f.codigo} className="flex items-start gap-2 text-sm" style={{ color: '#1F2933' }}>
                            <input
                              type="checkbox"
                              checked={subtipos.includes(f.codigo)}
                              onChange={() => alternarSubtipo(f.codigo)}
                              className="mt-0.5 h-4 w-4 rounded border-[#D9E2D9] accent-[#14532D] focus-visible:outline-none focus-visible:ring-2"
                            />
                            <span>
                              {f.nombre} <span className="font-mono text-[11px]" style={{ color: '#94A3B8' }}>({f.codigo})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {errorSubtipos && (
                <p role="alert" className="text-xs mt-2" style={{ color: '#DC2626' }}>
                  {errorSubtipos}
                </p>
              )}
            </fieldset>

            {errorServidor && (
              <p role="alert" className="rounded-lg px-3 py-2 text-xs"
                 style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                {errorServidor}
              </p>
            )}

            <footer className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onCerrar}
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ border: '1px solid #D9E2D9', color: '#475569' }}>
                Cancelar
              </button>
              <button type="submit" disabled={guardando}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: '#14532D' }}>
                {guardando ? 'Radicando…' : 'Radicar solicitud'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
