'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import type { EstadoRadicado, AccionAuditoria, TenantId } from '@/src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   DATOS: ESTADOS Y AUDITORÍA EN LENGUAJE CIUDADANO
══════════════════════════════════════════════════════════════ */

const DESCRIPCION_ESTADO: Record<EstadoRadicado, { titulo: string; descripcion: string; color: string; bg: string; border: string }> = {
  PENDIENTE: {
    titulo:      'Pendiente',
    descripcion: 'Su solicitud fue recibida y está en espera de ser revisada por un funcionario.',
    color:       'text-amber-400',
    bg:          'bg-amber-500/10',
    border:      'border-amber-500/30',
  },
  EN_REVISION: {
    titulo:      'En revisión',
    descripcion: 'Un funcionario de la Alcaldía está revisando su solicitud.',
    color:       'text-indigo-400',
    bg:          'bg-indigo-500/10',
    border:      'border-indigo-500/30',
  },
  EN_PROCESO: {
    titulo:      'En proceso',
    descripcion: 'Su solicitud está siendo atendida. Se están realizando las gestiones necesarias.',
    color:       'text-sky-400',
    bg:          'bg-sky-500/10',
    border:      'border-sky-500/30',
  },
  RESUELTO: {
    titulo:      'Resuelto',
    descripcion: 'Su solicitud fue atendida y resuelta. Si tiene preguntas, contacte la dependencia asignada.',
    color:       'text-emerald-400',
    bg:          'bg-emerald-500/10',
    border:      'border-emerald-500/30',
  },
  DEVUELTO: {
    titulo:      'Requiere acción del ciudadano',
    descripcion: 'Se requiere información o documentación adicional de su parte. Contacte la dependencia asignada.',
    color:       'text-rose-400',
    bg:          'bg-rose-500/10',
    border:      'border-rose-500/30',
  },
  RECHAZADO: {
    titulo:      'No admitido',
    descripcion: 'Su solicitud no pudo ser procesada. Contacte la dependencia asignada para más información.',
    color:       'text-slate-400',
    bg:          'bg-slate-500/10',
    border:      'border-slate-500/30',
  },
};

const EMOJI_ESTADO: Record<EstadoRadicado, string> = {
  PENDIENTE:   '⏳',
  EN_REVISION: '🔍',
  EN_PROCESO:  '⚙️',
  RESUELTO:    '✅',
  DEVUELTO:    '↩️',
  RECHAZADO:   '⛔',
};

const ACCION_CIUDADANO: Partial<Record<AccionAuditoria, string>> = {
  RADICACION:             'Solicitud recibida',
  CLASIFICACION_IA:       'Solicitud clasificada',
  ASIGNACION:             'Asignada a dependencia',
  CAMBIO_ESTADO:          'Estado actualizado',
  RESPUESTA_FUNCIONARIO:  'Respuesta del funcionario',
  DEVOLUCION:             'Se requiere documentación adicional',
  RECLASIFICACION:        'Reasignada a otra dependencia',
  NOTIFICACION_WHATSAPP:  'Notificación enviada',
};

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', {
    year:   'numeric',
    month:  'long',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function formatearFechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE INTERNO (necesita Suspense por useSearchParams)
══════════════════════════════════════════════════════════════ */

function ConsultaInterna() {
  const searchParams   = useSearchParams();
  const idParam        = searchParams.get('id') ?? '';

  const [inputId,      setInputId]      = useState(idParam);
  const [buscando,     setBuscando]     = useState(false);
  const [radicado,     setRadicado]     = useState<Record<string, unknown> | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error,        setError]        = useState('');
  const [copiado,      setCopiado]      = useState(false);
  const inputRef                        = useRef<HTMLInputElement>(null);

  // Formatear número al escribir (solo letras mayúsculas y guiones)
  function handleInputChange(valor: string) {
    setInputId(valor.toUpperCase().replace(/[^A-Z0-9\-]/g, ''));
    setNoEncontrado(false);
    setError('');
    setRadicado(null);
  }

  const buscar = useCallback(async (id: string) => {
    const idLimpio = id.trim().toUpperCase();
    if (!idLimpio) {
      inputRef.current?.focus();
      return;
    }

    setBuscando(true);
    setRadicado(null);
    setNoEncontrado(false);
    setError('');

    try {
      const db       = getDb();
      const snap     = await getDoc(doc(db, 'radicados', idLimpio));

      if (!snap.exists()) {
        setNoEncontrado(true);
      } else {
        setRadicado(snap.data() as Record<string, unknown>);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al consultar. Intente nuevamente.');
    } finally {
      setBuscando(false);
    }
  }, []);

  // Auto-búsqueda si la URL trae ?id=XXX
  useEffect(() => {
    if (idParam) {
      buscar(idParam);
    }
  }, [idParam, buscar]);

  function copiarEnlace() {
    const url = `${window.location.origin}/consulta?id=${inputId.trim()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  /* ── Extracción tipada de datos del radicado ── */
  const estado       = radicado?.estadoActual as EstadoRadicado | undefined;
  const estadoInfo   = estado ? DESCRIPCION_ESTADO[estado] : null;
  const auditoria    = (radicado?.auditoria as { fecha: string; accion: string }[] | undefined) ?? [];
  const oficinaId    = (radicado?.clasificacionIA as { oficinaDestino?: TenantId } | null)?.oficinaDestino;
  const oficina      = oficinaId ? DIRECTORIO_TENANTS[oficinaId] : null;
  const fechaCreacion = radicado?.fechaCreacion as string | undefined;

  return (
    <main
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(ellipse 70% 40% at 50% -5%, rgba(99,102,241,0.10) 0%, transparent 55%),
          #0A0A0B
        `,
      }}
    >
      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] backdrop-blur-[20px] bg-[#0A0A0B]/70">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border border-indigo-500/30 bg-indigo-500/15 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5.25-3.5 10.15-8 11.5C7.5 22.15 4 17.25 4 12V7l8-4z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 leading-none mb-0.5">
              Alcaldía de Simacota
            </p>
            <p className="text-slate-200 text-sm font-black tracking-tight leading-none" style={{ fontFamily: 'var(--font-manrope)' }}>
              Consulta de Estado de Solicitud
            </p>
          </div>
          <Link
            href="/"
            className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
          >
            Inicio
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-6">

        {/* ── Título ── */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-50 mb-3"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            ¿En qué estado está<br className="hidden sm:block" /> su solicitud?
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            Ingrese el número de radicado para ver el estado actual de su caso.
          </p>
        </div>

        {/* ── Caja de búsqueda ── */}
        <div
          className="rounded-2xl border border-white/10 p-6"
          style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(25px)' }}
        >
          <label htmlFor="radicado-input" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            Número de radicado
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="radicado-input"
              type="text"
              value={inputId}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar(inputId)}
              placeholder="EXT-2026-04-14-093022-A7K2"
              className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3
                text-slate-50 placeholder:text-slate-600 text-sm font-mono
                focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none
                transition-all duration-300"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => buscar(inputId)}
              disabled={buscando}
              className="px-5 py-3 rounded-xl font-bold text-sm text-white
                bg-gradient-to-r from-indigo-600 to-indigo-500
                hover:from-indigo-500 hover:to-indigo-400
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-300 flex items-center gap-2 shrink-0"
            >
              {buscando ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin-smooth">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              )}
              Consultar
            </button>
          </div>
        </div>

        {/* ── Resultado: no encontrado ── */}
        {noEncontrado && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-slate-200 font-bold mb-2">Radicado no encontrado</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              No se encontró un radicado con el número <span className="text-rose-400 font-mono">{inputId}</span>.
              Verifique que lo escribió correctamente.
            </p>
          </div>
        )}

        {/* ── Resultado: error ── */}
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        )}

        {/* ── Resultado: radicado encontrado ── */}
        {radicado && estadoInfo && (
          <div
            className="rounded-2xl border border-white/10 overflow-hidden"
            style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(25px)' }}
          >
            {/* Cabecera del resultado */}
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Número de radicado
                  </p>
                  <p
                    className="text-xl font-black tracking-widest text-indigo-400 font-mono break-all"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    {radicado.radicadoId as string}
                  </p>
                </div>
                {fechaCreacion && (
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                      Fecha de radicación
                    </p>
                    <p className="text-xs text-slate-300">{formatearFecha(fechaCreacion)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Estado actual */}
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Estado actual
              </p>
              <div className={`rounded-xl border ${estadoInfo.border} ${estadoInfo.bg} p-4`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{EMOJI_ESTADO[estado!]}</span>
                  <span className={`text-lg font-black tracking-tight ${estadoInfo.color}`} style={{ fontFamily: 'var(--font-manrope)' }}>
                    {estadoInfo.titulo}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{estadoInfo.descripcion}</p>
              </div>
            </div>

            {/* Dependencia asignada */}
            {oficina && (
              <div className="px-6 py-5 border-b border-white/[0.06]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                  Dependencia asignada
                </p>
                <p className="text-slate-200 font-bold mb-2">{oficina.nombreOficial}</p>
                <div className="space-y-1.5">
                  <a
                    href={`mailto:${oficina.emailOficial}`}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    {oficina.emailOficial}
                  </a>
                  <a
                    href={`tel:${oficina.celularOficial}`}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    {oficina.celularOficial.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
                  </a>
                </div>
              </div>
            )}

            {/* Historial */}
            {auditoria.length > 0 && (
              <div className="px-6 py-5 border-b border-white/[0.06]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
                  Historial
                </p>
                <ol className="space-y-3">
                  {auditoria.map((entrada, i) => {
                    const textoAmigable = ACCION_CIUDADANO[entrada.accion as AccionAuditoria] ?? 'Actualización';
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded-full border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-300">{textoAmigable}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{formatearFechaCorta(entrada.fecha)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Acciones */}
            <div className="px-6 py-4 flex flex-wrap gap-2">
              <button
                onClick={copiarEnlace}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider
                  text-slate-500 hover:text-slate-300 transition-colors px-3 py-2 rounded-lg
                  border border-white/[0.06] hover:border-white/10"
              >
                {copiado ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={2.5} className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    Copiar enlace de consulta
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Ayuda: no tiene número ── */}
        <div
          className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(25px)' }}
        >
          <p className="text-sm font-bold text-slate-300 mb-2">¿No tiene número de radicado?</p>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Si presentó su solicitud en persona, el número está en el comprobante que le entregó
            la recepcionista. Si la presentó por internet, revise su correo electrónico o anote
            el número que apareció en la pantalla de confirmación.
          </p>
          <Link
            href="/ciudadano/radicar"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider
              text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Radicar nueva solicitud
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-6 text-center mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
          Alcaldía Municipal de Simacota · Santander · Sistema de Ventanilla Única Digital
        </p>
      </footer>
    </main>
  );
}

/* ══════════════════════════════════════════════════════════════
   EXPORT DEFAULT — envuelto en Suspense (requerido por useSearchParams)
══════════════════════════════════════════════════════════════ */

export default function ConsultaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 animate-spin-smooth">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span className="text-sm">Cargando...</span>
          </div>
        </div>
      }
    >
      <ConsultaInterna />
    </Suspense>
  );
}
