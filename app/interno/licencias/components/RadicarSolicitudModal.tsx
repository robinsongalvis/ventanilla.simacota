'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { SelectorSubtiposNormativos } from './SelectorSubtiposNormativos';
import { SelectorModalidadesConstruccion } from './SelectorModalidadesConstruccion';
import { exigeModalidadConstruccion } from '@/lib/motor-expedientes/modalidad-construccion';

/* ══════════════════════════════════════════════════════════════
   Formulario "Recibir solicitud" — bloque "Integración UI y demo".

   El verbo dice lo que la acción HACE. Hasta el 26-ago-2026 este modal decía
   «Radicar solicitud»: crea un expediente en PRESENTADA y escribe una actuación
   `apertura-expediente`, que por el ADR-0033 es un acto ANTERIOR y distinto de
   la radicación en legal y debida forma. La funcionaria no puede leer en el
   botón que está haciendo algo que no está haciendo.

   Envía a `POST /api/licencias/expedientes`. El servidor SIEMPRE crea un
   expediente de PRUEBA (`esPrueba: true`, candado R10) — este formulario
   no expone ninguna forma de pedir lo contrario, ni finge que el número
   resultante es un consecutivo legal.

   Mismo patrón visual que el resto de modales del panel (`RegistroExpres
   Modal`, `app/interno/dashboard/components/`): overlay + card, `role=
   dialog`, error del servidor mostrado literal en `role=alert`.
══════════════════════════════════════════════════════════════ */

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
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [errorModalidades, setErrorModalidades] = useState<string | null>(null);


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

  function alternarModalidad(codigo: string) {
    setModalidades((prev) => (prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]));
  }


  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (subtipos.length === 0) {
      setErrorSubtipos('Selecciona al menos un subtipo (figura normativa).');
      return;
    }
    setErrorSubtipos(null);

    /* Si la figura la exige, la modalidad es OBLIGATORIA en la pantalla —aunque
       el servidor no la exija, porque tiene que poder leer los expedientes
       viejos que nacieron sin ella. Quien crea uno nuevo, la captura. */
    if (exigeModalidadConstruccion(subtipos) && modalidades.length === 0) {
      setErrorModalidades('Indica al menos una modalidad de construcción (art. 2.2.6.1.1.7).');
      return;
    }
    setErrorModalidades(null);
    setErrorServidor(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/licencias/expedientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          solicitanteNombre,
          solicitanteDocumento,
          subtipos,
          // Solo viaja si la figura la admite: el servidor rechaza una
          // modalidad descolgada de su figura.
          ...(exigeModalidadConstruccion(subtipos) ? { modalidadesConstruccion: modalidades } : {}),
        }),
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
      aria-label="Recibir solicitud de licencia"
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
            Recibir solicitud
          </h2>
          <p className="text-xs mt-1" style={{ color: '#5F6F64' }}>
            Crea un expediente de demostración (esPrueba) — la emisión con consecutivo legal está bloqueada hasta autorizar la siembra (R10).
          </p>
        </header>

        {creado ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-success-text)' }}>
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

            <SelectorSubtiposNormativos seleccionados={subtipos} onAlternar={alternarSubtipo} error={errorSubtipos} />

            <SelectorModalidadesConstruccion
              subtipos={subtipos}
              seleccionadas={modalidades}
              onAlternar={alternarModalidad}
              error={errorModalidades}
            />

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
                {guardando ? 'Recibiendo…' : 'Recibir solicitud'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
