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
      className="w-full min-w-0 rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
        Otros documentos
      </p>

      {documentos.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sin documentos adicionales.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-3">
          {documentos.map((doc) => {
            /* Lectura defensiva (issue #308): un documento sin `versionVigente`
               —histórico migrado, siembra mínima, escritura a medias— no puede
               tumbar la lista entera. Se muestra degradado y sin descarga. */
            const version = doc.versionVigente;
            return (
              <li key={doc.id} className="flex min-w-0 flex-col gap-x-2 gap-y-1 text-xs sm:flex-row sm:flex-wrap sm:items-center" style={{ color: 'var(--text-secondary)' }}>
                <span className="min-w-0 break-words" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{doc.nombre}</span>
                {version ? (
                  <>
                    <span className="shrink-0 font-mono">v{version.numeroVersion}</span>
                    <a
                      href={`/api/interno/archivo?path=${encodeURIComponent(version.storagePath)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 rounded"
                      style={{ color: 'var(--tema-texto-007049)' }}
                    >
                      Descargar
                    </a>
                    <span className="shrink-0" style={{ color: 'var(--text-secondary)' }}>{formatFechaHoraColombia(version.subidoEn)}</span>
                  </>
                ) : (
                  <span className="shrink-0" style={{ color: '#8E5C06' }}>Sin versión registrada</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!soloLectura && (
        <ControlSubidaDocumento expedienteId={expedienteId} etiqueta="Adjuntar documento" onSubido={onDocumentoSubido} />
      )}
    </div>
  );
}
