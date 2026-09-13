'use client';

import { useState } from 'react';
import './licencias-tema.css';

/* ══════════════════════════════════════════════════════════════
   Registrar la PRÓRROGA del plazo de subsanación.

   D.1077/2015 art. 2.2.6.1.2.2.4: «Este plazo podrá ser ampliado, a solicitud
   de parte, hasta por un término adicional de quince (15) días hábiles».

   ── LA FECHA QUE PIDE, Y POR QUÉ ESA ──────────────────────────────────────

   Pide el día en que el CIUDADANO solicitó la prórroga, no el de hoy. La norma
   condiciona la ampliación a que él la pidiera dentro del plazo, y entre su
   escrito y el momento en que la funcionaria lo captura pueden pasar días.
   Poner «hoy» automáticamente sería afirmar un hecho ajeno.

   ── NO DECIDE NADA ────────────────────────────────────────────────────────

   Toda la validación —que el plazo exista, que la solicitud llegue a tiempo,
   que sea única— vive en el SERVIDOR (`planRegistrarProrrogaSubsanacion`). Este
   formulario recoge y muestra lo que el servidor responda, literal. Si un día
   la regla cambia, cambia en un sitio.
══════════════════════════════════════════════════════════════ */

export interface RegistrarProrrogaModalProps {
  expedienteId: string;
  onCerrar: () => void;
  onRegistrada: () => void;
}

const MEDIOS = ['Escrito radicado', 'Correo electrónico', 'Personalmente', 'Otro'];

export function RegistrarProrrogaModal({ expedienteId, onCerrar, onRegistrada }: RegistrarProrrogaModalProps) {
  const [solicitadaEl, setSolicitadaEl] = useState('');
  const [medio, setMedio] = useState(MEDIOS[0]!);
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}/prorroga-subsanacion`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          /* Mediodía de Bogotá: el input da un día civil, y guardar su
             medianoche UTC lo correría al día anterior en nuestro huso. */
          solicitadaEl: solicitadaEl ? `${solicitadaEl}T12:00:00.000-05:00` : '',
          medio,
          referencia: referencia.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'No fue posible registrar la prórroga.');
        return;
      }
      onRegistrada();
    } catch {
      setError('Error de red al registrar la prórroga.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    /* Mismo armazón que el resto de modales del módulo (`CrearDesdeRadicadoModal`):
       overlay clicable para cerrar + tarjeta, sobre `tema-licencias`. */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3 tema-licencias"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-prorroga"
    >
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/55" />
      <div
        className="relative w-full max-w-lg shadow-2xl p-5 flex flex-col"
        style={{
          background: 'var(--superficie)',
          border: '1px solid var(--borde)',
          borderRadius: 'var(--radio-modal)',
          maxHeight: 'calc(100dvh - 24px)',
          overflowY: 'auto',
        }}
      >
        <h2 id="titulo-prorroga" className="font-headline text-lg font-black" style={{ color: 'var(--text-primary)' }}>
          Registrar prórroga del plazo de subsanación
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Amplía el plazo del ciudadano de 30 a 45 días hábiles. Solo procede si él la
          solicitó antes de que vencieran los 30 (D.1077/2015 art. 2.2.6.1.2.2.4).
        </p>

        <div className="flex flex-col gap-3 mt-4">
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ fontWeight: 700 }}>¿Qué día la solicitó el ciudadano?</span>
            <input
              type="date"
              value={solicitadaEl}
              onChange={(e) => setSolicitadaEl(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid var(--borde)' }}
            />
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              La fecha de su escrito, no la de hoy.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span style={{ fontWeight: 700 }}>¿Por qué medio llegó?</span>
            <select
              value={medio}
              onChange={(e) => setMedio(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid var(--borde)' }}
            >
              {MEDIOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span style={{ fontWeight: 700 }}>Radicado u oficio de la solicitud <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span></span>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="1-110-202609-00000123"
              className="rounded-lg px-3 py-2 text-sm font-mono"
              style={{ border: '1px solid var(--borde)' }}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm mt-3 rounded-lg px-3 py-2" style={{ background: '#FEF2F2', color: '#B42318' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onCerrar} className="text-sm font-bold px-3 py-2 rounded-lg"
            style={{ border: '1px solid var(--borde)', color: 'var(--text-secondary)' }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !solicitadaEl}
            className="text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-50"
            style={{ background: '#14532D', color: 'white' }}
          >
            {enviando ? 'Registrando…' : 'Registrar prórroga'}
          </button>
        </div>
      </div>
    </div>
  );
}
