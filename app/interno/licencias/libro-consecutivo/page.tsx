import Link from 'next/link';

export const metadata = {
  title: 'Libro consecutivo · Licencias',
};

/**
 * Placeholder honesto (spec Pantalla 01: "incluye entrada 'Libro
 * consecutivo' aunque apunte a placeholder") — el libro consecutivo real
 * (folio/consecutivo AGN de expedientes de licencias) depende de la
 * colección Firestore que Fase 1 todavía no crea. Se declara como
 * dependencia de Backend/Datos en la respuesta de la tarea.
 */
export default function LibroConsecutivoPage() {
  return (
    <div className="p-4 md:p-6 max-w-[720px] mx-auto flex flex-col items-start gap-3">
      <Link
        href="/interno/licencias"
        className="inline-flex items-center gap-1.5 text-sm font-medium rounded focus-visible:outline-none focus-visible:ring-2"
        style={{ color: '#14532D' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Bandeja de Licencias
      </Link>
      <div
        className="rounded-xl p-5 w-full"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <h1 className="font-headline text-xl" style={{ color: 'var(--text-primary)' }}>
          Libro consecutivo
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          Disponible cuando el motor de expedientes de licencias tenga colección propia en Firestore (Fase 1/3 de
          <code className="font-mono text-[13px] mx-1">docs/planes/PLAN_FASES_MOTOR_EXPEDIENTES.md</code>
          — fuera del alcance de esta tarea).
        </p>
      </div>
    </div>
  );
}
