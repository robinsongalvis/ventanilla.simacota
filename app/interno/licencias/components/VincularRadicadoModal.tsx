'use client';

import { useEffect, useState } from 'react';
import type { RadicadoCandidato } from '@/app/api/licencias/radicados-candidatos/route';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { NumeroLegal } from './NumeroLegal';

/* ══════════════════════════════════════════════════════════════
   Modal «Vincular radicado» — repara un expediente creado SIN radicado.

   POR QUÉ EXISTE. En la Bandeja hay dos botones juntos: «Crear desde
   radicado» (el camino correcto) y «Radicar solicitud», que crea el
   expediente sin radicado. Hasta el 13-ago-2026 equivocarse de botón era
   irreversible — el expediente quedaba huérfano para siempre y no podía
   llegar a ser un trámite real. Esto lo repara.

   Consume la MISMA lista de candidatos que `CrearDesdeRadicadoModal`
   (`GET /api/licencias/radicados-candidatos`: radicados de Planeación sin
   vínculo y no cerrados) — no se duplica el criterio de elegibilidad, que
   además el servidor vuelve a comprobar con la función compartida.

   A diferencia del handoff, aquí NO se piden subtipos: el expediente ya
   existe con los suyos. Lo único que falta es el vínculo.
══════════════════════════════════════════════════════════════ */

export interface VincularRadicadoModalProps {
  expedienteId: string;
  onCerrar: () => void;
  /** Se invoca cuando el servidor confirma el vínculo — el caller refresca. */
  onVinculado: (radicadoId: string) => void;
}

export function VincularRadicadoModal({ expedienteId, onCerrar, onVinculado }: VincularRadicadoModalProps) {
  const [candidatos, setCandidatos] = useState<RadicadoCandidato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch('/api/licencias/radicados-candidatos', { credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (!res.ok) {
          setError(body.error ?? 'No fue posible cargar los radicados disponibles.');
          return;
        }
        setCandidatos(Array.isArray(body.radicados) ? body.radicados : []);
      } catch {
        if (vivo) setError('Error de red al cargar los radicados disponibles.');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function vincular() {
    if (!seleccionado) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}/vincular-radicado`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radicadoId: seleccionado }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // El error del servidor se muestra LITERAL — mismo patrón que el
        // resto de modales del módulo. El caso más probable con uso
        // concurrente es 409 «el radicado ya está vinculado».
        setError(body.error ?? 'No fue posible vincular el radicado.');
        return;
      }
      onVinculado(seleccionado);
    } catch {
      setError('Error de red al vincular el radicado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vincular-radicado-titulo"
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--bg-surface)', boxShadow: 'var(--shadow-elevated)' }}
      >
        <header className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 id="vincular-radicado-titulo" className="font-headline text-lg" style={{ color: 'var(--text-primary)' }}>
            Vincular radicado de Ventanilla
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Este expediente se creó sin radicado. Elija el radicado de Ventanilla que le corresponde —
            solo aparecen los de Planeación que aún no tienen expediente.
          </p>
        </header>

        <div className="px-5 py-4 overflow-y-auto min-h-0 flex-1">
          {error && (
            <p role="alert" className="text-xs mb-3" style={{ color: 'var(--color-danger-text)' }}>
              {error}
            </p>
          )}
          {cargando && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cargando radicados disponibles…</p>}
          {!cargando && candidatos.length === 0 && !error && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No hay radicados de Planeación sin expediente. Si el ciudadano aún no ha radicado en Ventanilla,
              primero debe hacerse allí.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {candidatos.map((c) => (
              <li key={c.radicadoId}>
                <label
                  className="flex items-start gap-3 rounded-xl p-3 cursor-pointer"
                  style={{
                    border: `1px solid ${seleccionado === c.radicadoId ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: seleccionado === c.radicadoId ? 'var(--bg-surface-2)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="radicado"
                    className="mt-1"
                    checked={seleccionado === c.radicadoId}
                    onChange={() => setSeleccionado(c.radicadoId)}
                  />
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <NumeroLegal value={c.radicadoId} variant="radicado" size="sm" />
                    <span className="text-sm" style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {c.solicitanteNombre}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatFechaColombia(c.fechaRadicado)} · {c.tipoSolicitud}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <footer className="px-5 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-[10px] px-4 py-2.5 text-sm font-bold"
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--color-border)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={vincular}
            disabled={!seleccionado || enviando}
            className="rounded-[10px] px-4 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            {enviando ? 'Vinculando…' : 'Vincular radicado'}
          </button>
        </footer>
      </div>
    </div>
  );
}
