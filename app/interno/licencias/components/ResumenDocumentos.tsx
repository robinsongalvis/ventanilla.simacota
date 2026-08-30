'use client';

import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { formatFechaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   RESUMEN DE DOCUMENTOS — columna derecha, junto al historial.

   SOLO LECTURA Y CERO LÓGICA. No decide si un requisito está cumplido, no
   cuenta faltantes, no evalúa nada: eso lo hace el checklist, que es el único
   que puede. Aquí solo se asoman los últimos que entraron, para que quien mira
   el historial vea también QUÉ hay, sin cambiar de pestaña.

   El número de la cabecera y el enlace del pie llevan al checklist: este
   resumen nunca es el sitio donde se trabaja, solo donde se ojea.
══════════════════════════════════════════════════════════════ */

const CUANTOS_SE_ASOMAN = 3;

export interface ResumenDocumentosProps {
  documentos: DocumentoExpedienteDoc[];
  /** Total de requisitos aportados, tal como lo cuenta el checklist. */
  aportados?: number;
  aplicables?: number;
  /** Lleva a la pestaña de documentos. */
  onVerTodos?: () => void;
}

export function ResumenDocumentos({ documentos, aportados, aplicables, onVerTodos }: ResumenDocumentosProps) {
  if (documentos.length === 0) return null;

  /* Los últimos que entraron primero: quien abre el expediente suele venir a
     ver qué acaba de llegar, no qué llegó hace tres semanas. */
  const recientes = documentos
    .slice()
    .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : a.creadoEn > b.creadoEn ? -1 : 0))
    .slice(0, CUANTOS_SE_ASOMAN);

  const hayConteo = typeof aportados === 'number' && typeof aplicables === 'number';

  return (
    <section
      aria-label="Documentos del expediente"
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#667085' }}>
        Documentos del expediente
        {hayConteo && (
          <span className="normal-case font-normal" style={{ color: 'var(--text-secondary)' }}>
            {' '}· {aportados} de {aplicables} aportados
          </span>
        )}
      </p>

      <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {recientes.map((d) => (
          <li key={d.id} className="py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {d.nombre}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {formatFechaColombia(d.creadoEn)}
                {/* Quién lo subió sale de la versión vigente, que es donde el
                    servidor lo captura. Si no viene, no se inventa. */}
                {d.versionVigente?.subidoPor?.nombre ? ` · ${d.versionVigente.subidoPor.nombre}` : ''}
                {d.totalVersiones > 1 ? ` · ${d.totalVersiones} versiones` : ''}
              </p>
            </div>
            <span
              className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#E7F6EC', color: '#116932' }}
            >
              Aportado
            </span>
          </li>
        ))}
      </ul>

      {documentos.length > CUANTOS_SE_ASOMAN && (
        <button
          type="button"
          onClick={onVerTodos}
          className="mt-3 w-full text-center text-sm font-bold focus-visible:outline-none focus-visible:ring-2 rounded py-1.5"
          style={{ color: '#14532D' }}
        >
          Ver los {documentos.length} documentos →
        </button>
      )}
    </section>
  );
}
