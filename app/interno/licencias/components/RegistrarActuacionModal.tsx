'use client';

import { useEffect, useState } from 'react';
import type {
  ActuacionLicenciaDoc,
  TipoActuacionPermitida,
} from '@/lib/server/expedientes-licencias';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

/* ══════════════════════════════════════════════════════════════
   Modal de registro de HECHOS del expediente — bloque "Integración UI y
   demo". Cubre los 2 tipos que `POST …/actuaciones` acepta
   (`TipoActuacionPermitida`, `lib/server/expedientes-licencias.ts`, type
   -only): 'acta-observaciones' y 'respuesta-subsanacion'. El guard de
   acta única (409, "por una sola vez", D.1077/2015 art. 2.2.6.1.2.2.4) lo
   decide el SERVIDOR — este modal solo muestra el mensaje literal si
   llega; nunca reimplementa esa validación en el cliente.
══════════════════════════════════════════════════════════════ */

const COPIA: Record<TipoActuacionPermitida, { titulo: string; etiquetaCampo: string; placeholder: string; nota: string }> = {
  'acta-observaciones': {
    titulo: 'Registrar acta de observaciones',
    etiquetaCampo: 'Observaciones formuladas',
    placeholder: 'Se observan planos estructurales incompletos y falta cesión de andén…',
    nota: 'Procede por una sola vez (D.1077/2015 art. 2.2.6.1.2.2.4) — el servidor rechaza una segunda acta.',
  },
  'respuesta-subsanacion': {
    titulo: 'Registrar respuesta de subsanación',
    etiquetaCampo: 'Qué aportó o corrigió el solicitante',
    placeholder: 'El solicitante aporta planos corregidos y escritura de cesión…',
    nota: 'Solo procede si ya existe un acta de observaciones registrada.',
  },
};

export interface RegistrarActuacionModalProps {
  expedienteId: string;
  tipo: TipoActuacionPermitida;
  onCerrar: () => void;
  onRegistrada: (actuacion: ActuacionLicenciaDoc, estadoJuridico: EstadoJuridicoLicencia) => void;
}

export function RegistrarActuacionModal({ expedienteId, tipo, onCerrar, onRegistrada }: RegistrarActuacionModalProps) {
  const copia = COPIA[tipo];
  const [detalle, setDetalle] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCerrar]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorServidor(null);
    setGuardando(true);
    try {
      const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}/actuaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tipo, detalle }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorServidor(body.error ?? 'No fue posible registrar la actuación.');
        return;
      }
      onRegistrada(body.actuacion as ActuacionLicenciaDoc, body.estadoJuridico as EstadoJuridicoLicencia);
    } catch {
      setErrorServidor('Error de red al registrar la actuación.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3"
      role="dialog"
      aria-modal="true"
      aria-label={copia.titulo}
    >
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/55" />

      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ border: '1px solid #D9E2D9', maxHeight: 'calc(100dvh - 24px)' }}
      >
        <header className="px-5 py-4" style={{ borderBottom: '1px solid #D9E2D9' }}>
          <h2 className="text-lg font-black leading-tight" style={{ color: '#12261A' }}>
            {copia.titulo}
          </h2>
          <p className="text-xs mt-1" style={{ color: '#5F6F64' }}>{copia.nota}</p>
        </header>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
              {copia.etiquetaCampo}
            </span>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              required
              rows={4}
              className="input-internal"
              placeholder={copia.placeholder}
            />
          </label>

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
              {guardando ? 'Registrando…' : 'Registrar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
