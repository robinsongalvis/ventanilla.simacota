'use client';

import type { ReactNode } from 'react';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { NumeroLegal } from './NumeroLegal';
import type { OrigenActuacion } from '@/lib/motor-expedientes/tipos';

/* ══════════════════════════════════════════════════════════════
   TARJETAS DE RESUMEN — las cuatro señas del expediente, de un vistazo.

   Es un rediseño de PRESENTACIÓN de la grilla de metadatos: cada dato con su
   icono y, donde ayuda, una lectura en lenguaje de persona. No inventa datos ni
   acciones — solo muestra lo que el expediente ya tiene, y conserva la ÚNICA
   acción real que había aquí: vincular el radicado cuando falta.

   «Origen: REAL» era jerga interna; se acompaña de «Información verificada»
   (nació en la plataforma) o «Migrado del libro» (histórico), que es lo que ese
   valor de verdad significa para quien atiende.
══════════════════════════════════════════════════════════════ */

export interface TarjetasResumenExpedienteProps {
  solicitanteNombre: string;
  solicitanteDocumento?: string;
  radicadoId?: string | null;
  /** ISO de la vinculación del radicado, si consta. */
  radicadoVinculadoFecha?: string | null;
  origen?: OrigenActuacion;
  /** ISO de creación. */
  creadoEn: string;
  /** Abre el flujo de vincular radicado (solo se usa cuando no hay radicado). */
  onVincular: () => void;
}

export function TarjetasResumenExpediente({
  solicitanteNombre, solicitanteDocumento, radicadoId, radicadoVinculadoFecha,
  origen, creadoEn, onVincular,
}: TarjetasResumenExpedienteProps) {
  const esReal = (origen ?? 'REAL') === 'REAL';
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta icono={<IconoPersona />} tinte="#E7F5EC" trazo="#16A34A" label="Solicitante">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{solicitanteNombre}</p>
        {solicitanteDocumento && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>CC {solicitanteDocumento}</p>
        )}
      </Tarjeta>

      <Tarjeta icono={<IconoRadicado />} tinte="#E6EEFE" trazo="#2563EB" label="Radicado de origen (Ventanilla)">
        {radicadoId ? (
          <>
            <NumeroLegal value={radicadoId} variant="radicado" size="sm" />
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {radicadoVinculadoFecha
                ? `Vinculado el ${formatFechaColombia(radicadoVinculadoFecha)}`
                : 'Fecha de vinculación no disponible'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Sin vincular aún</p>
            <button
              type="button"
              onClick={onVincular}
              className="mt-1 text-xs font-bold underline focus-visible:outline-none focus-visible:ring-2 rounded"
              style={{ color: 'var(--color-primary)' }}
            >
              Vincular radicado de Ventanilla
            </button>
          </>
        )}
      </Tarjeta>

      <Tarjeta icono={<IconoOrigen />} tinte="#F1E9FE" trazo="#7C3AED" label="Origen">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{origen ?? 'REAL'}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs" style={{ color: esReal ? '#117937' : 'var(--text-secondary)' }}>
          {esReal ? (
            <><IconoCheck /> Información verificada</>
          ) : (
            'Migrado del libro histórico'
          )}
        </p>
      </Tarjeta>

      <Tarjeta icono={<IconoCalendario />} tinte="#FDF1DC" trazo="#D97706" label="Creado">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatFechaColombia(creadoEn)}</p>
      </Tarjeta>
    </div>
  );
}

function Tarjeta({
  icono, tinte, trazo, label, children,
}: {
  icono: ReactNode; tinte: string; trazo: string; label: string; children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}>
      <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: tinte, color: trazo }}>
        {icono}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function IconoPersona() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconoRadicado() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3.75h6.5L18.25 8.5V19A1.25 1.25 0 0 1 17 20.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 4v5h5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 15h4.5m0 0-1.75-1.75M13.5 15l-1.75 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoOrigen() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.5l8 4.25-8 4.25-8-4.25L12 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 12l8 4.25L20 12M4 16l8 4.25L20 16" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function IconoCalendario() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.75" y="4.75" width="16.5" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.75 9h16.5M8 3v3m8-3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconoCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 12.2l2.3 2.3 4.7-4.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
