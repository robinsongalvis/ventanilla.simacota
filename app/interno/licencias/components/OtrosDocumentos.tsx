import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';
import { ControlSubidaDocumento } from './ControlSubidaDocumento';

/* ══════════════════════════════════════════════════════════════
   "Otros documentos" — Bloque A·A3. Documentos del expediente SIN
   `requisitoId` (anexos espontáneos, `DocumentoExpedienteDoc.requisitoId`
   ausente) — fuera del checklist, no bloquean ni cuentan en su resumen.
══════════════════════════════════════════════════════════════ */

export interface OtrosDocumentosProps {
  expedienteId: string;
  /** YA filtrados por el padre (`documentos.filter(d => !d.requisitoId)`). */
  documentos: DocumentoExpedienteDoc[];
  soloLectura: boolean;
  onDocumentoSubido: () => void;
}

export function OtrosDocumentos({ expedienteId, documentos, soloLectura, onDocumentoSubido }: OtrosDocumentosProps) {
  if (documentos.length === 0 && soloLectura) return null;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
        Otros documentos
      </p>

      {documentos.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sin documentos adicionales.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-3">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="truncate max-w-full" style={{ color: 'var(--text-primary)' }}>{doc.nombre}</span>
              <span className="shrink-0 font-mono">v{doc.versionVigente.numeroVersion}</span>
              <a
                href={`/api/interno/archivo?path=${encodeURIComponent(doc.versionVigente.storagePath)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 rounded"
                style={{ color: '#14532D' }}
              >
                Descargar
              </a>
              <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{formatFechaHoraColombia(doc.versionVigente.subidoEn)}</span>
            </li>
          ))}
        </ul>
      )}

      {!soloLectura && (
        <ControlSubidaDocumento expedienteId={expedienteId} etiqueta="Adjuntar documento" onSubido={onDocumentoSubido} />
      )}
    </div>
  );
}
