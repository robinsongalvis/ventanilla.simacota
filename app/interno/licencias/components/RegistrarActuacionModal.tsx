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
  'inicio-revision': {
    titulo: 'Iniciar revisión del expediente',
    etiquetaCampo: 'Quién asume la revisión y con qué alcance',
    placeholder: 'Asume la revisión el arquitecto de Planeación; se verificarán planos, cesiones y aportes urbanísticos…',
    nota: 'No detiene el plazo: el término de 45 días hábiles sigue corriendo. Registrar el inicio de la revisión es lo que habilita levantar el acta de observaciones, que sí lo suspende.',
  },
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

  /* ── LA CADENA DE CIERRE ──────────────────────────────────────────────
     Cada eslabón pide, además del detalle, la EVIDENCIA estructurada que la
     constancia de ejecutoria tiene que poder volver a imprimir. */
  'resolucion-concede': {
    titulo: 'Registrar resolución que CONCEDE la licencia',
    etiquetaCampo: 'Motivación de la decisión',
    placeholder: 'Se concede la licencia por cumplir las normas urbanísticas aplicables…',
    nota: 'Registra el acto administrativo ya expedido. La licencia no produce efectos hasta que se notifique.',
  },
  'resolucion-niega': {
    titulo: 'Registrar resolución que NIEGA la licencia',
    etiquetaCampo: 'Motivación de la negativa',
    placeholder: 'Se niega por incumplir el índice de ocupación previsto en el POT…',
    nota: 'La negativa también se notifica: de la notificación corren los plazos para que el ciudadano recurra.',
  },
  'desistimiento-expreso': {
    titulo: 'Registrar desistimiento del solicitante',
    etiquetaCampo: 'Cómo y cuándo lo manifestó',
    placeholder: 'El solicitante radica escrito de desistimiento el 14 de agosto…',
    nota: 'Procede en cualquier momento antes de la decisión (D.1077/2015 art. 2.2.6.1.2.3.4).',
  },
  'desistimiento-tacito': {
    titulo: 'Archivar por desistimiento tácito',
    etiquetaCampo: 'Constancia de que no se atendió el acta',
    placeholder: 'Transcurridos los 30 días hábiles desde la comunicación del acta sin respuesta…',
    nota: 'El servidor comprueba de nuevo que los 30 días hábiles transcurrieron y que no entró respuesta: no basta con que el vigía lo hubiera detectado.',
  },
  notificacion: {
    titulo: 'Registrar notificación al ciudadano',
    etiquetaCampo: 'Cómo se surtió la notificación',
    placeholder: 'Notificación personal en la Secretaría de Planeación, con entrega de copia íntegra…',
    nota: 'La fecha que registre aquí es la que arranca el plazo de 10 días hábiles para recursos (CPACA art. 76).',
  },
  firmeza: {
    titulo: 'Registrar firmeza del acto',
    etiquetaCampo: 'Constancia de la firmeza',
    placeholder: 'Vencido el término para recursos sin que se interpusiera ninguno…',
    nota: 'Por vencimiento del plazo, el servidor no admite una fecha anterior al vencimiento real: declararla antes le quitaría al ciudadano un recurso que todavía tenía.',
  },
};

export interface RegistrarActuacionModalProps {
  expedienteId: string;
  tipo: TipoActuacionPermitida;
  onCerrar: () => void;
  onRegistrada: (actuacion: ActuacionLicenciaDoc, estadoJuridico: EstadoJuridicoLicencia) => void;
}

interface ResultadoActa {
  actuacion: ActuacionLicenciaDoc;
  estadoJuridico: EstadoJuridicoLicencia;
  avisoEnviado: boolean;
}

export function RegistrarActuacionModal({ expedienteId, tipo, onCerrar, onRegistrada }: RegistrarActuacionModalProps) {
  const copia = COPIA[tipo];
  const [detalle, setDetalle] = useState('');
  /** Solo aplica a 'acta-observaciones' (A5) — `<input type="date">` da "YYYY-MM-DD" sin hora. */
  const [fechaComunicacion, setFechaComunicacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  /**
   * Solo se llena para `tipo === 'acta-observaciones'` — es el ÚNICO tipo
   * para el que la ruta intenta enviar un aviso al ciudadano
   * (`POST …/actuaciones`, ver `avisoEnviado` en su respuesta). Para
   * 'respuesta-subsanacion' el servidor nunca intenta enviar nada, así que
   * mostrar aquí un estado de aviso sería un dato inventado — ese tipo
   * sigue cerrando el modal de inmediato, sin pantalla de confirmación.
   */
  const [resultadoActa, setResultadoActa] = useState<ResultadoActa | null>(null);

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
      // Ancla la fecha del `<input type="date">` al mediodía de Bogotá
      // (`T12:00:00-05:00`, mismo patrón que `app/api/interno/resumen-
      // diario/route.ts`) ANTES de enviarla — el servidor no re-ancla
      // `fechaComunicacion` (`calcularFechaLimiteRespuestaActa` →
      // `sumarDiasHabiles` → `atLocalNoon`, `lib/tiempos-radicado.ts`), y un
      // "YYYY-MM-DD" crudo se interpretaría como medianoche UTC — un día
      // civil ANTES en Bogotá (UTC-5) — corriendo el plazo de 30 días desde
      // la fecha equivocada.
      const fechaComunicacionAnclada =
        tipo === 'acta-observaciones' && fechaComunicacion ? `${fechaComunicacion}T12:00:00-05:00` : undefined;
      const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}/actuaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tipo,
          detalle,
          ...(fechaComunicacionAnclada ? { fechaComunicacion: fechaComunicacionAnclada } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorServidor(body.error ?? 'No fue posible registrar la actuación.');
        return;
      }
      const actuacion = body.actuacion as ActuacionLicenciaDoc;
      const estadoJuridico = body.estadoJuridico as EstadoJuridicoLicencia;
      if (tipo === 'acta-observaciones') {
        // Pausa en una pantalla de confirmación — el funcionario necesita
        // ver si el aviso llegó al ciudadano ANTES de que el modal se
        // cierre solo; `onRegistrada` (que actualiza al padre y cierra)
        // se dispara cuando el funcionario pulsa "Continuar".
        setResultadoActa({ actuacion, estadoJuridico, avisoEnviado: Boolean(body.avisoEnviado) });
        return;
      }
      onRegistrada(actuacion, estadoJuridico);
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

        {resultadoActa ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-success-text)' }}>
              Acta registrada
            </p>
            {resultadoActa.avisoEnviado ? (
              <p
                role="status"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold"
                style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' }}
              >
                Aviso enviado al ciudadano ✓
              </p>
            ) : (
              <p
                role="alert"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold"
                style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}
              >
                ⚠ Aviso NO enviado al ciudadano — el expediente no tiene un correo de contacto habilitado (sin radicado vinculado, correo no aportado, o trámite aún no habilitado para avisos por correo).
              </p>
            )}
            <footer className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => onRegistrada(resultadoActa.actuacion, resultadoActa.estadoJuridico)}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: '#14532D' }}
              >
                Continuar
              </button>
            </footer>
          </div>
        ) : (
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

          {tipo === 'acta-observaciones' && (
            <div>
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
                  Fecha de comunicación del acta{' '}
                  <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(opcional)</span>
                </span>
                <input
                  type="date"
                  value={fechaComunicacion}
                  onChange={(e) => setFechaComunicacion(e.target.value)}
                  className="input-internal"
                  aria-describedby="ayuda-fecha-comunicacion-acta"
                />
              </label>
              <p id="ayuda-fecha-comunicacion-acta" className="text-xs mt-1" style={{ color: '#667085' }}>
                Si la registra, el aviso al ciudadano incluirá la fecha límite de respuesta; el plazo corre desde la comunicación, no desde la expedición.
              </p>
            </div>
          )}

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
        )}
      </div>
    </div>
  );
}
