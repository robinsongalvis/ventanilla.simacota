import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChipEstado } from '../components/ChipEstado';
import { NumeroLegal } from '../components/NumeroLegal';
import { EventoTimeline } from '../components/EventoTimeline';
import { AvisoPoliticaSubsanacion } from '../components/AvisoPoliticaSubsanacion';
import { BotonAccionPlaceholder } from '../components/BotonAccionPlaceholder';
import { detalleLicencia } from '../fixtures';
import { formatFechaColombia } from '@/lib/fecha-colombia';

type ParamsPromise = Promise<{ expedienteId: string }>;

// Next 16: `params` es una promesa (ver node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/page.md) — se resuelve con `await`
// en este Server Component, nunca se lee de forma síncrona.
export async function generateMetadata({ params }: { params: ParamsPromise }) {
  const { expedienteId } = await params;
  const detalle = detalleLicencia(expedienteId);
  return { title: detalle ? `Expediente ${detalle.fila.numeroExpediente}` : 'Expediente no encontrado' };
}

/**
 * Pantalla 02 · Detalle de Expediente — Fase 2 (arranque, Tarea 5).
 *
 * El panel término (izquierda) solo aparece para expedientes REAL: para
 * RECONSTRUIDO (histórico migrado) se reemplaza por una nota neutra — R9,
 * un dato reconstruido nunca finge un cómputo de término que no tiene.
 */
export default async function DetalleLicenciaPage({ params }: { params: ParamsPromise }) {
  const { expedienteId } = await params;
  const detalle = detalleLicencia(expedienteId);
  if (!detalle) notFound();

  const { fila, predio, subtipos, timeline, proyeccion } = detalle;
  const progreso = proyeccion
    ? Math.min(100, Math.max(0, ((proyeccion.plazoDias - proyeccion.diasRestantes) / proyeccion.plazoDias) * 100))
    : 0;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1400px] mx-auto">
      <Link
        href="/interno/licencias"
        className="inline-flex items-center gap-1.5 text-sm font-medium w-fit rounded focus-visible:outline-none focus-visible:ring-2"
        style={{ color: '#14532D' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Bandeja de Licencias
      </Link>

      {/* ── Tarjeta encabezado ── */}
      <div
        className="rounded-xl p-4 md:p-5 flex flex-col gap-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <NumeroLegal value={fila.numeroExpediente} variant="expediente" size="lg" />
          <ChipEstado estado={fila.estado} />
          <div className="flex flex-wrap gap-1.5">
            {subtipos.map((s) => (
              <span
                key={s}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <Metadato label="Radicado de origen (Ventanilla)">
            <NumeroLegal value={fila.radicadoOrigen} variant="radicado" size="sm" />
          </Metadato>
          <Metadato label="Solicitante">
            {fila.solicitante}
            {fila.colision && <span style={{ color: 'var(--text-secondary)' }}> · {fila.colision.segundoSolicitante}</span>}
          </Metadato>
          <Metadato label="Predio">{predio}</Metadato>
          <Metadato label="Origen">{fila.origen}</Metadato>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* ── Panel término (o nota histórica) ── */}
        <div className="w-full lg:w-[430px] shrink-0 flex flex-col gap-3">
          {proyeccion ? (
            <>
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
              >
                <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                  Término para resolver
                </p>
                <p className="font-black mt-1" style={{ fontSize: 22, color: 'var(--text-primary)' }}>
                  Vence el {formatFechaColombia(proyeccion.vigente)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Quedan {proyeccion.diasRestantes} días hábiles de {proyeccion.plazoDias} · ancla: radicación en debida forma ({formatFechaColombia(proyeccion.ancla)})
                </p>
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(progreso)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso del término: ${Math.round(progreso)}%`}
                  className="mt-3 h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--bg-surface-2)' }}
                >
                  <div className="h-full rounded-full" style={{ width: `${progreso}%`, background: '#D97706' }} />
                </div>
              </div>

              <AvisoPoliticaSubsanacion eventos={proyeccion.eventos} plazoDias={proyeccion.plazoDias} />

              <div className="flex flex-col sm:flex-row gap-2">
                <BotonAccionPlaceholder label="Registrar acta de observaciones" variant="dorado" />
                <BotonAccionPlaceholder
                  label="Emitir acto final"
                  variant="outline"
                  disabled
                  notaDeshabilitado="⚖️ serie pendiente P3"
                />
              </div>
            </>
          ) : (
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Expediente histórico migrado — sin cómputo de término.
              </p>
            </div>
          )}
        </div>

        {/* ── Panel historial ── */}
        <div
          className="flex-1 min-w-0 rounded-xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
            Historial del expediente{' '}
            <span className="normal-case font-normal">(los eventos son los hechos; el vencimiento se calcula)</span>
          </p>
          <EventoTimeline eventos={timeline} />
        </div>
      </div>
    </div>
  );
}

function Metadato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <div className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>
        {children}
      </div>
    </div>
  );
}
