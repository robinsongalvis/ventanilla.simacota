'use client';

import { useState } from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db }                          from '@/lib/firebase';
import { generateWhatsAppReport }      from '@/lib/whatsapp';
import type { EstadoRadicado, Radicado } from '@/src/types/radicado';
import type { UsuarioAutenticado }       from '@/lib/hooks/useAuth';

/* ══════════════════════════════════════════════════════════════
   STATE TRANSITION MAP
══════════════════════════════════════════════════════════════ */

const TRANSICIONES: Partial<Record<EstadoRadicado, { valor: EstadoRadicado; label: string }[]>> = {
  PENDIENTE:   [
    { valor: 'EN_REVISION', label: 'Pasar a revisión' },
    { valor: 'DEVUELTO',    label: 'Devolver al ciudadano' },
  ],
  EN_REVISION: [
    { valor: 'EN_PROCESO',  label: 'Poner en proceso' },
    { valor: 'RESUELTO',    label: 'Resolver caso' },
    { valor: 'DEVUELTO',    label: 'Devolver al ciudadano' },
  ],
  EN_PROCESO:  [
    { valor: 'RESUELTO',    label: 'Resolver caso' },
    { valor: 'DEVUELTO',    label: 'Devolver al ciudadano' },
  ],
  DEVUELTO:    [
    { valor: 'EN_REVISION', label: 'Retomar revisión' },
  ],
};

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */

interface Props {
  radicado: Radicado;
  usuario:  UsuarioAutenticado;
  onExito:  (mensaje: string) => void;
}

export function FormRespuesta({ radicado, usuario, onExito }: Props) {
  const opciones = TRANSICIONES[radicado.estadoActual] ?? [];

  const [nuevoEstado,   setNuevoEstado]   = useState<EstadoRadicado | ''>(opciones[0]?.valor ?? '');
  const [respuesta,     setRespuesta]     = useState('');
  const [notificarWA,   setNotificarWA]   = useState(true);
  const [guardando,     setGuardando]     = useState(false);
  const [errorLocal,    setErrorLocal]    = useState<string | null>(null);
  const [confirmando,   setConfirmando]   = useState(false);

  /* ── Case closed (RESUELTO) ── */
  if (radicado.estadoActual === 'RESUELTO') {
    const entradaResolucion = [...radicado.auditoria]
      .reverse()
      .find((e) => e.accion === 'CAMBIO_ESTADO' && (e.metadata as { estadoNuevo?: string } | undefined)?.estadoNuevo === 'RESUELTO')
      ?? radicado.auditoria[radicado.auditoria.length - 1];

    const fechaResolucion = entradaResolucion
      ? new Date(entradaResolucion.fecha).toLocaleDateString('es-CO', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
      : '—';

    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <span className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          CASO RESUELTO
        </span>
        <p className="text-xs text-slate-500">Resuelto el {fechaResolucion}</p>
        <p className="text-xs text-slate-600 mt-1 text-center max-w-xs">
          Este radicado ha sido cerrado. Los detalles de la resolución se encuentran en el historial de auditoría.
        </p>
      </div>
    );
  }

  /* ── No available transitions ── */
  if (opciones.length === 0) {
    return (
      <p className="text-sm text-slate-600 italic text-center py-2">
        No hay acciones disponibles para el estado actual ({radicado.estadoActual}).
      </p>
    );
  }

  /* ── Validation ── */
  const validate = (): boolean => {
    if (!nuevoEstado) { setErrorLocal('Selecciona una acción.'); return false; }
    if (respuesta.trim().length < 10) {
      setErrorLocal('La respuesta debe tener al menos 10 caracteres.');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    if (!validate()) return;

    // Require inline confirmation for critical actions
    if (nuevoEstado === 'RESUELTO' || nuevoEstado === 'DEVUELTO') {
      setConfirmando(true);
      return;
    }

    ejecutar();
  };

  const ejecutar = async () => {
    if (!nuevoEstado) return;
    setGuardando(true);
    setConfirmando(false);
    setErrorLocal(null);

    const ahora = new Date().toISOString();
    const accion = nuevoEstado === 'DEVUELTO' ? 'DEVOLUCION' : 'CAMBIO_ESTADO';

    const nuevaEntrada = {
      fecha:  ahora,
      accion,
      actor:  usuario.nombre,
      nota:   respuesta.trim(),
      metadata: {
        estadoAnterior: radicado.estadoActual,
        estadoNuevo:    nuevoEstado,
      },
    };

    try {
      await updateDoc(doc(db, 'radicados', radicado.radicadoId), {
        estadoActual: nuevoEstado,
        auditoria:    arrayUnion(nuevaEntrada),
      });

      let mensajeExito = 'Radicado actualizado correctamente.';

      /* WhatsApp notification (simulated) */
      if (notificarWA && radicado.clasificacionIA) {
        const report = generateWhatsAppReport({
          radicadoId:           radicado.radicadoId,
          ciudadanoNombre:      radicado.ciudadano.nombre,
          ciudadanoTelefono:    radicado.ciudadano.telefono,
          tenantId:             radicado.clasificacionIA.oficinaDestino,
          estadoNuevo:          nuevoEstado,
          respuestaFuncionario: respuesta.trim(),
          fechaRadicacion:      radicado.fechaCreacion,
        });

        console.group(`[WhatsApp] Notificación para ${radicado.ciudadano.nombre}`);
        console.log('Teléfono:', report.telefono);
        console.log('Mensaje:\n', report.mensaje);
        console.log('Link wa.me:', report.linkWaMe);
        console.groupEnd();

        // Audit entry for the WhatsApp notification
        await updateDoc(doc(db, 'radicados', radicado.radicadoId), {
          auditoria: arrayUnion({
            fecha:  new Date().toISOString(),
            accion: 'NOTIFICACION_WHATSAPP',
            actor:  'Sistema',
            nota:   `Mensaje enviado al ${report.telefono} (simulado)`,
          }),
        });

        mensajeExito += ' Notificación WhatsApp generada (simulada).';
      }

      setRespuesta('');
      onExito(mensajeExito);
    } catch (err) {
      setErrorLocal(
        `Error al guardar en Firestore: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setGuardando(false);
    }
  };

  /* ── Derived UI state ── */
  const esResolucion = nuevoEstado === 'RESUELTO';
  const esDevolucion = nuevoEstado === 'DEVUELTO';

  const btnClases = esResolucion
    ? 'bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500/50'
    : esDevolucion
      ? 'bg-rose-600 hover:bg-rose-500 focus:ring-rose-500/50'
      : 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500/50';

  const btnTexto = esResolucion ? 'Resolver caso' : esDevolucion ? 'Devolver al ciudadano' : 'Actualizar radicado';

  /* ── Inline confirmation dialog ── */
  if (confirmando) {
    const tituloConf = esResolucion
      ? '¿Marcar como RESUELTO?'
      : '¿Devolver al ciudadano?';
    const textoConf = esResolucion
      ? 'Esta acción cerrará definitivamente el caso. No se podrá reabrir desde aquí.'
      : 'El ciudadano recibirá notificación de que debe completar o corregir su solicitud.';

    return (
      <div className="bg-slate-800/50 border border-white/10 rounded-xl p-5 flex flex-col gap-4">
        <div>
          <p className={`font-semibold mb-1 ${esResolucion ? 'text-emerald-300' : 'text-rose-300'}`}>
            {tituloConf}
          </p>
          <p className="text-sm text-slate-400">{textoConf}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmando(false)}
            className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={ejecutar}
            disabled={guardando}
            className={`
              flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white
              transition-colors focus:outline-none focus:ring-2
              ${guardando ? 'opacity-60 cursor-not-allowed' : btnClases}
            `}
          >
            {guardando ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-smooth" />
                Guardando…
              </span>
            ) : (
              esResolucion ? 'Sí, resolver' : 'Sí, devolver'
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5 flex flex-col gap-4"
    >
      {/* Nueva acción */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-label text-slate-400 uppercase tracking-widest">
          Nueva acción
        </label>
        <select
          value={nuevoEstado}
          onChange={(e) => setNuevoEstado(e.target.value as EstadoRadicado)}
          className="
            bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3
            text-slate-50 text-sm
            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
            transition-all duration-300 cursor-pointer
          "
        >
          {opciones.map((op) => (
            <option key={op.valor} value={op.valor}>{op.label}</option>
          ))}
        </select>
      </div>

      {/* Respuesta */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-label text-slate-400 uppercase tracking-widest">
          Respuesta / Nota
        </label>
        <textarea
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          rows={4}
          placeholder="Describe la acción tomada, documentación requerida, próximos pasos…"
          className="
            bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3
            text-slate-50 placeholder-slate-500 text-sm
            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
            transition-all duration-300 resize-none
          "
        />
        <span className="text-xs text-slate-600 text-right">{respuesta.length} / 10 min</span>
      </div>

      {/* WhatsApp toggle */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <div
          role="checkbox"
          aria-checked={notificarWA}
          tabIndex={0}
          onClick={() => setNotificarWA((v) => !v)}
          onKeyDown={(e) => e.key === ' ' && setNotificarWA((v) => !v)}
          className={`
            w-10 h-5 rounded-full transition-colors relative shrink-0 outline-none
            focus-visible:ring-2 focus-visible:ring-indigo-500/50
            ${notificarWA ? 'bg-green-600' : 'bg-slate-700'}
          `}
        >
          <span className={`
            absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all
            ${notificarWA ? 'left-[22px]' : 'left-0.5'}
          `} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-slate-200">Notificar al ciudadano por WhatsApp</span>
          <span className="text-xs text-slate-500">Genera y registra el mensaje (simulado)</span>
        </div>
      </label>

      {/* Error */}
      {errorLocal && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {errorLocal}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={guardando}
        className={`
          w-full py-3 rounded-xl text-sm font-semibold text-white
          transition-colors focus:outline-none focus:ring-2
          ${guardando ? 'opacity-60 cursor-not-allowed bg-slate-700' : btnClases}
        `}
      >
        {guardando ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-smooth" />
            Guardando en Firestore…
          </span>
        ) : (
          btnTexto
        )}
      </button>
    </form>
  );
}
