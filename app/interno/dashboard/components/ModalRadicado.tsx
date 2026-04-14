'use client';

import { useEffect, useRef, useState } from 'react';
import type { Radicado }                from '@/src/types/radicado';
import type { UsuarioAutenticado }      from '@/lib/hooks/useAuth';
import { NOMBRES_TENANT }               from '@/src/types/reglas-negocio';
import { TimelineAuditoria }            from './TimelineAuditoria';
import { FormRespuesta }                from './FormRespuesta';

const LABELS_ESTADO: Record<string, string> = {
  PENDIENTE:   'Pendiente',
  EN_REVISION: 'En revisión',
  EN_PROCESO:  'En proceso',
  RESUELTO:    'Resuelto',
  DEVUELTO:    'Devuelto',
  RECHAZADO:   'Rechazado',
};

const COLORES_ESTADO: Record<string, { bg: string; text: string; border: string }> = {
  PENDIENTE:   { bg: 'bg-indigo-500/20', text: 'text-indigo-300',  border: 'border-indigo-500/30'  },
  EN_REVISION: { bg: 'bg-amber-500/20',  text: 'text-amber-300',   border: 'border-amber-500/30'   },
  EN_PROCESO:  { bg: 'bg-blue-500/20',   text: 'text-blue-300',    border: 'border-blue-500/30'    },
  RESUELTO:    { bg: 'bg-emerald-500/20',text: 'text-emerald-300', border: 'border-emerald-500/30' },
  DEVUELTO:    { bg: 'bg-rose-500/20',   text: 'text-rose-300',    border: 'border-rose-500/30'    },
  RECHAZADO:   { bg: 'bg-slate-500/20',  text: 'text-slate-300',   border: 'border-slate-500/30'   },
};

const LABELS_PRIORIDAD: Record<string, string> = {
  ROJO: 'Alta', NARANJA: 'Media', AMARILLO: 'Baja',
};

const DOT_PRIORIDAD: Record<string, string> = {
  ROJO:     'bg-red-500 shadow-lg shadow-red-500/50',
  NARANJA:  'bg-orange-500 shadow-lg shadow-orange-500/50',
  AMARILLO: 'bg-yellow-500 shadow-lg shadow-yellow-500/50',
};

/* ══════════════════════════════════════════════════════════════
   SECTION WRAPPER
══════════════════════════════════════════════════════════════ */

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4">
      <p className="text-xs font-label text-slate-500 uppercase tracking-widest mb-3">{titulo}</p>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════════ */

function Toast({ mensaje, onDismiss }: { mensaje: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="
      fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]
      flex items-center gap-3 px-5 py-3 rounded-xl
      bg-emerald-900/80 backdrop-blur-xl border border-emerald-500/30
      text-emerald-200 text-sm shadow-xl
      animate-fade-in-up
    ">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      {mensaje}
      <button onClick={onDismiss} className="ml-2 text-emerald-400 hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */

interface Props {
  radicado: Radicado;
  usuario:  UsuarioAutenticado;
  onCerrar: () => void;
}

export function ModalRadicado({ radicado, usuario, onCerrar }: Props) {
  const [cerrando,  setCerrando]  = useState(false);
  const [toast,     setToast]     = useState<string | null>(null);

  const modalRef    = useRef<HTMLDivElement>(null);
  const primerFocus = useRef<HTMLButtonElement>(null);

  /* ── Scroll lock ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Escape key ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ── Initial focus ── */
  useEffect(() => {
    primerFocus.current?.focus();
  }, []);

  /* ── Focus trap ── */
  const handleTabTrap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

  /* ── Animated close ── */
  const handleClose = () => {
    if (cerrando) return;
    setCerrando(true);
    setTimeout(onCerrar, 200);
  };

  /* ── Derived ── */
  const ia        = radicado.clasificacionIA;
  const estado    = COLORES_ESTADO[radicado.estadoActual] ?? COLORES_ESTADO.PENDIENTE;
  const dotColor  = DOT_PRIORIDAD[radicado.prioridad]    ?? DOT_PRIORIDAD.AMARILLO;
  const esRojo    = radicado.prioridad === 'ROJO';

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm ${cerrando ? 'animate-overlay-out' : 'animate-overlay-in'}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        onKeyDown={handleTabTrap}
        tabIndex={-1}
        className={`
          fixed inset-0 z-50 flex items-center justify-center p-4
          pointer-events-none
        `}
      >
        <div className={`
          w-full max-w-3xl max-h-[90vh] overflow-y-auto
          bg-slate-900/95 backdrop-blur-[30px]
          border border-white/10 rounded-2xl
          shadow-2xl shadow-black/50
          pointer-events-auto
          ${cerrando ? 'animate-modal-out' : 'animate-modal-in'}
        `}>
          <div className="p-6 flex flex-col gap-5">

            {/* ── Modal header ── */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`shrink-0 w-3.5 h-3.5 rounded-full ${dotColor} ${esRojo ? 'animate-pulse' : ''}`}
                  title={`Prioridad ${LABELS_PRIORIDAD[radicado.prioridad] ?? radicado.prioridad}`}
                />
                <div className="min-w-0">
                  <h2
                    id="modal-titulo"
                    className="text-lg font-black tracking-tighter text-slate-50 leading-none"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    {radicado.ciudadano.nombre}
                  </h2>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{radicado.radicadoId}</p>
                </div>
                <span className={`
                  shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border
                  ${estado.bg} ${estado.text} ${estado.border}
                `}>
                  {LABELS_ESTADO[radicado.estadoActual] ?? radicado.estadoActual}
                </span>
              </div>

              <button
                ref={primerFocus}
                onClick={handleClose}
                aria-label="Cerrar modal"
                className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Datos del ciudadano ── */}
            <Seccion titulo="Datos del ciudadano">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <InfoRow icon="👤" label="Nombre"   valor={radicado.ciudadano.nombre} />
                {radicado.ciudadano.email    && <InfoRow icon="📧" label="Email"    valor={radicado.ciudadano.email} />}
                {radicado.ciudadano.telefono && <InfoRow icon="📱" label="Teléfono" valor={radicado.ciudadano.telefono} />}
                <InfoRow
                  icon={radicado.origen === 'WEB' ? '🌐' : '📋'}
                  label="Canal"
                  valor={radicado.origen === 'WEB' ? 'Portal Web' : 'Recepción Física'}
                />
              </div>
            </Seccion>

            {/* ── Detalle del caso ── */}
            {ia && (
              <Seccion titulo="Detalle del caso">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Resumen IA</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{ia.resumenCaso}</p>
                  </div>
                  <MensajeExpandible texto={ia.mensajeOriginal} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2 py-1 rounded-full text-xs bg-slate-700/60 text-slate-300">
                      📍 {ia.zonaGeografica === 'CASCO_URBANO' ? 'Casco Urbano' : ia.zonaGeografica === 'ZONA_YARIGUIES' ? 'Zona Yariguíes' : 'Zona Rural'}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs bg-slate-700/60 text-slate-300">
                      🏢 {NOMBRES_TENANT[ia.oficinaDestino] ?? ia.oficinaDestino}
                    </span>
                  </div>
                </div>
              </Seccion>
            )}

            {/* ── Archivos adjuntos ── */}
            <Seccion titulo="Archivos adjuntos">
              {radicado.archivos.length === 0 ? (
                <p className="text-sm text-slate-600 italic">Sin archivos adjuntos.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {radicado.archivos.map((arch, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                      <span className="flex items-center gap-2 text-sm text-slate-300 min-w-0">
                        <span className="text-slate-500 text-base">📎</span>
                        <span className="truncate">{arch.nombre}</span>
                      </span>
                      {arch.url ? (
                        <a
                          href={arch.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
                        >
                          Ver
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-slate-600">Sin URL</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>

            {/* ── Timeline de auditoría ── */}
            <Seccion titulo="Historial de auditoría">
              <TimelineAuditoria entradas={radicado.auditoria} />
            </Seccion>

            {/* ── Acciones ── */}
            <Seccion titulo="Acciones">
              <FormRespuesta
                radicado={radicado}
                usuario={usuario}
                onExito={(msg) => setToast(msg)}
              />
            </Seccion>

          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast mensaje={toast} onDismiss={() => setToast(null)} />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   MICRO-COMPONENTS
══════════════════════════════════════════════════════════════ */

function InfoRow({ icon, label, valor }: { icon: string; label: string; valor: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-base leading-tight mt-0.5" role="img" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 leading-none mb-0.5">{label}</p>
        <p className="text-sm text-slate-200 break-words">{valor}</p>
      </div>
    </div>
  );
}

function MensajeExpandible({ texto }: { texto: string }) {
  const [expandido, setExpandido] = useState(false);
  const corto = texto.length > 200;

  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">Mensaje original</p>
      <p className={`text-sm text-slate-400 leading-relaxed ${!expandido && corto ? 'line-clamp-3' : ''}`}>
        {texto}
      </p>
      {corto && (
        <button
          onClick={() => setExpandido((v) => !v)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-1 underline underline-offset-2"
        >
          {expandido ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}
