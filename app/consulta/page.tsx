'use client';

import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';
import { SelloRadicado } from '@/app/components/institucional/SelloRadicado';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';
import {
  ESTADO_CIUDADANO_DESC,
  ESTADO_CIUDADANO_LABELS,
  type EstadoCiudadano,
  type RadicadoPublico,
} from '@/src/types/simi-citizen';

import type { LicenciaPublica } from '@/lib/seguridad/consulta-publica-licencia';

const ESTADO_VISUAL: Record<EstadoCiudadano, { icono: string; color: string; fondo: string; borde: string }> = {
  radicado_recibido:       { icono: '✓', color: 'text-emerald-800', fondo: 'bg-emerald-50', borde: 'border-emerald-200' },
  en_revision:             { icono: '⌕', color: 'text-indigo-800', fondo: 'bg-indigo-50', borde: 'border-indigo-200' },
  asignado_dependencia:    { icono: '→', color: 'text-sky-800', fondo: 'bg-sky-50', borde: 'border-sky-200' },
  en_proyeccion_respuesta: { icono: '⋯', color: 'text-amber-800', fondo: 'bg-amber-50', borde: 'border-amber-200' },
  pendiente_aprobacion:    { icono: '⌛', color: 'text-amber-800', fondo: 'bg-amber-50', borde: 'border-amber-200' },
  requiere_aclaracion:     { icono: '!', color: 'text-rose-800', fondo: 'bg-rose-50', borde: 'border-rose-200' },
  trasladado:              { icono: '↗', color: 'text-sky-800', fondo: 'bg-sky-50', borde: 'border-sky-200' },
  respondido:              { icono: '✓', color: 'text-emerald-800', fondo: 'bg-emerald-50', borde: 'border-emerald-200' },
  cerrado:                 { icono: '✓', color: 'text-slate-800', fondo: 'bg-slate-50', borde: 'border-slate-200' },
};

function formatearFecha(iso: string): string {
  return formatFechaHoraColombia(iso);
}

function labelCanalRespuesta(canal: string): string {
  const labels: Record<string, string> = {
    CORREO: 'Correo electrónico',
    TELEFONO: 'Teléfono',
    PRESENCIAL: 'Presencial',
    DIRECCION_FISICA: 'Dirección física',
  };
  return labels[canal] ?? canal;
}

function ConsultaInterna() {
  const searchParams = useSearchParams();
  const [numeroRadicado, setNumeroRadicado] = useState(
    searchParams.get('id') ?? searchParams.get('radicadoId') ?? '',
  );
  const [datoVerificacion, setDatoVerificacion] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [radicado, setRadicado] = useState<RadicadoPublico | null>(null);
  /* El bloque de licencia, cuando el radicado tiene expediente vinculado.
     Ausente para la inmensa mayoría de radicados, que no son licencias. */
  const [licencia, setLicencia] = useState<LicenciaPublica | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [fallos, setFallos] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const numeroRef = useRef<HTMLInputElement>(null);
  const verificacionRef = useRef<HTMLInputElement>(null);

  function limpiarResultado() {
    setRadicado(null);
    setLicencia(null);
    setMensaje('');
  }

  async function buscar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numero = numeroRadicado.trim().toUpperCase();
    const dato = datoVerificacion.trim();
    if (!numero) return numeroRef.current?.focus();
    if (!dato) return verificacionRef.current?.focus();

    setBuscando(true);
    limpiarResultado();
    try {
      const response = await fetch('/api/public/radicado/consulta', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroRadicado: numero, datoVerificacion: dato }),
      });
      const payload = await response.json().catch(() => null) as {
        licencia?: LicenciaPublica | null;
        ok?: boolean;
        error?: string;
        radicado?: RadicadoPublico;
      } | null;

      if (!response.ok || !payload?.ok || !payload.radicado) {
        const siguientesFallos = fallos + 1;
        setFallos(siguientesFallos);
        if (siguientesFallos >= 3) {
          setDatoVerificacion('');
          setFallos(0);
        }
        setMensaje(payload?.error ?? 'No fue posible realizar la consulta. Intente nuevamente.');
        return;
      }

      setRadicado(payload.radicado);
      setLicencia(payload.licencia ?? null);
      setFallos(0);
    } catch {
      setMensaje('No fue posible realizar la consulta. Revise su conexión e intente nuevamente.');
    } finally {
      setBuscando(false);
    }
  }

  function copiarEnlace() {
    const url = `${window.location.origin}/consulta?id=${encodeURIComponent(numeroRadicado.trim())}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2_000);
    });
  }

  const estadoVisual = radicado ? ESTADO_VISUAL[radicado.estadoPublico] : null;

  return (
    <main className="min-h-screen bg-institucional-light" style={{ color: 'var(--text-primary-2)' }}>
      <header className="sticky top-0 z-40 border-b border-[var(--border-soft)] bg-white/90 backdrop-blur-[20px]">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          <InstitucionalHeader compact theme="light" subtitle="Consulta segura de solicitudes" />
          <Link href="/" className="link-gradient-underline ml-auto font-label text-[11px]" style={{ color: 'var(--text-secondary-2)' }}>
            Inicio
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 sm:py-16">
        <div className="mb-8 text-center">
          <p className="mb-3 font-label text-[10px] tracking-[0.22em]" style={{ color: 'var(--brand-green-action)' }}>
            Consulta protegida
          </p>
          <h1 className="mb-3 text-3xl font-black tracking-tighter sm:text-4xl" style={{ fontFamily: 'var(--font-manrope)' }}>
            Consulte el estado de su solicitud
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed" style={{ color: 'var(--text-secondary-2)' }}>
            Para proteger su información, ingrese el número de radicado y el dato de verificación asociado a su solicitud.
          </p>
        </div>

        <form onSubmit={buscar} className="card-institucional overflow-hidden" style={{ boxShadow: 'var(--shadow-institutional-md)' }}>
          <div className="border-l-4 px-5 py-4" style={{ borderLeftColor: 'var(--brand-green-action)', background: 'rgba(15,95,53,0.04)' }}>
            <p className="text-sm font-bold">Verificación de identidad</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary-2)' }}>
              El dato de verificación no se guarda en este dispositivo ni se incluye en la dirección de la página.
            </p>
          </div>
          <div className="grid gap-5 p-5 sm:p-6">
            <div>
              <label htmlFor="radicado-input" className="mb-2 block text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary-2)' }}>
                Número de radicado
              </label>
              <input
                ref={numeroRef}
                id="radicado-input"
                value={numeroRadicado}
                onChange={(event) => {
                  setNumeroRadicado(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                  limpiarResultado();
                }}
                placeholder="1-WEB-2026-00000047"
                className="input-internal w-full font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label htmlFor="verificacion-input" className="mb-2 block text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary-2)' }}>
                Dato de verificación
              </label>
              <input
                ref={verificacionRef}
                id="verificacion-input"
                type="password"
                value={datoVerificacion}
                onChange={(event) => {
                  setDatoVerificacion(event.target.value);
                  limpiarResultado();
                }}
                placeholder="Correo, últimos 4 dígitos o código de consulta"
                className="input-internal w-full text-sm"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="ayuda-verificacion"
              />
              <p id="ayuda-verificacion" className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary-2)' }}>
                Ingrese el correo utilizado al radicar, los últimos cuatro dígitos del documento o el código de consulta recibido.
              </p>
            </div>
            <button
              type="submit"
              disabled={buscando}
              className="btn-institucional-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {buscando ? 'Verificando…' : 'Consultar de forma segura'}
            </button>
          </div>
        </form>

        {mensaje && (
          <div role="alert" className="card-institucional border-rose-200 bg-rose-50 p-5 text-center">
            <p className="text-sm font-semibold leading-relaxed text-rose-800">{mensaje}</p>
            <p className="mt-2 text-xs text-rose-700">Si su solicitud es histórica y no cuenta con un dato de verificación, comuníquese con la Ventanilla Única.</p>
          </div>
        )}

        {radicado && estadoVisual && (
          <article className="card-institucional overflow-hidden" style={{ boxShadow: 'var(--shadow-institutional-md)' }}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] px-6 py-5">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Número de radicado</p>
                <p className="break-all font-mono text-xl font-black tracking-wider" style={{ color: 'var(--brand-forest)' }}>
                  {radicado.numeroRadicado}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Fecha de radicación</p>
                <p className="text-xs text-slate-700">{formatearFecha(radicado.fechaRadicacion)}</p>
              </div>
            </div>

            <div className="border-b border-[var(--border-soft)] px-6 py-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Estado actual</p>
              <div className={`rounded-xl border p-4 ${estadoVisual.borde} ${estadoVisual.fondo}`}>
                <div className="mb-2 flex items-center gap-3">
                  <span aria-hidden className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black ${estadoVisual.borde} ${estadoVisual.color}`}>
                    {estadoVisual.icono}
                  </span>
                  <h2 className={`text-lg font-black tracking-tight ${estadoVisual.color}`} style={{ fontFamily: 'var(--font-manrope)' }}>
                    {ESTADO_CIUDADANO_LABELS[radicado.estadoPublico]}
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{ESTADO_CIUDADANO_DESC[radicado.estadoPublico]}</p>
              </div>
            </div>

            {licencia && (
              /* SU LICENCIA, EN SU IDIOMA. El estado jurídico traducido a lo que
                 necesita saber: qué pasó y si le toca hacer algo. Las etiquetas
                 internas («con acta de observaciones», «en viabilidad») son
                 exactas y no significan nada fuera de Planeación. */
              <div className="border-b border-[var(--border-soft)] px-6 py-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Su licencia urbanística
                </p>
                {licencia.numeroExpediente && (
                  <p className="mb-2 font-mono text-xs text-slate-600">{licencia.numeroExpediente}</p>
                )}
                <h2 className="text-base font-black text-slate-900">{licencia.estado.titulo}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{licencia.estado.explicacion}</p>

                {licencia.estado.accionDelCiudadano !== 'NINGUNA' && (
                  <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    {licencia.estado.accionDelCiudadano === 'DEBE_COMPLETAR'
                      ? 'Usted debe atender las observaciones para que su solicitud continúe.'
                      : 'Usted debe notificarse de la decisión para que produzca efectos.'}
                  </p>
                )}

                <p className="mt-3 text-xs text-slate-600">
                  {licencia.avisoPlazo
                    ? licencia.avisoPlazo
                    : `El plazo de respuesta corre desde el ${formatearFecha(licencia.desdeCuandoCorreElPlazo!)}.`}
                </p>
              </div>
            )}

            <div className="border-b border-[var(--border-soft)] px-6 py-5">
              <SelloRadicado
                variant="compact"
                data={{
                  radicadoId: radicado.numeroRadicado,
                  fechaRadicado: radicado.fechaRadicacion,
                  medioRecepcion: radicado.numeroRadicado.includes('-WEB-') ? 'WEB' : null,
                  tipoSolicitud: radicado.tipoSolicitud,
                  canalRespuesta: radicado.canalRespuesta ?? null,
                  dependencia: radicado.dependencia ?? 'Información protegida',
                  estado: ESTADO_CIUDADANO_LABELS[radicado.estadoPublico],
                  esAnonimo: !radicado.dependencia,
                }}
              />
              <p className="mt-3 text-xs text-slate-600">
                Fecha límite estimada: <span className="font-semibold text-slate-700">{formatearFecha(radicado.fechaVencimiento)}</span>
              </p>
            </div>

            <div className="grid gap-4 border-b border-[var(--border-soft)] px-6 py-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Tipo de solicitud</p>
                <p className="text-sm font-semibold text-slate-800">{radicado.tipoSolicitud}</p>
              </div>
              {radicado.canalRespuesta && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Canal de respuesta</p>
                  <p className="text-sm font-semibold text-slate-800">{labelCanalRespuesta(radicado.canalRespuesta)}</p>
                </div>
              )}
            </div>

            {radicado.respuestaOficial && (
              <div className="border-b border-[var(--border-soft)] px-6 py-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-emerald-700">Respuesta oficial de la Alcaldía</p>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{radicado.respuestaOficial.nota}</p>
                  <p className="mt-4 border-t border-emerald-200 pt-3 text-[11px] text-slate-600">
                    {radicado.respuestaOficial.dependenciaNombre} · {formatearFecha(radicado.respuestaOficial.fecha)}
                  </p>
                </div>
              </div>
            )}

            {radicado.lineaTiempo && radicado.lineaTiempo.length > 0 && (
              <div className="border-b border-[var(--border-soft)] px-6 py-5">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Línea de tiempo pública</p>
                <ol className="space-y-3">
                  {radicado.lineaTiempo.map((item, index) => (
                    <li key={`${item.fecha}-${item.evento}-${index}`} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--brand-green-action)' }} />
                      <div>
                        <p className="font-semibold text-slate-800">{item.evento}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatearFecha(item.fecha)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="px-6 py-4">
              <button type="button" onClick={copiarEnlace} className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30">
                {copiado ? 'Enlace copiado' : 'Copiar enlace sin dato de verificación'}
              </button>
            </div>
          </article>
        )}

        <div className="card-institucional p-5">
          <p className="mb-2 text-sm font-bold">¿No tiene número o dato de verificación?</p>
          <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--text-secondary-2)' }}>
            Revise el comprobante o el correo de confirmación. Para solicitudes históricas sin código, comuníquese con la Ventanilla Única para recibir orientación.
          </p>
          <Link href="/radicacion" className="link-gradient-underline text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-green-action)' }}>
            Radicar nueva solicitud
          </Link>
        </div>
      </div>

      <footer className="mt-4 border-t border-[var(--border-soft)] bg-white/40 py-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary-2)' }}>
          Alcaldía Municipal de Simacota · Santander · Sistema de Ventanilla Única Digital
        </p>
      </footer>
    </main>
  );
}

export default function ConsultaPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-institucional-light text-sm text-slate-600">Cargando consulta segura…</div>}>
      <ConsultaInterna />
    </Suspense>
  );
}
