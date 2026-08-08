'use client';

import { useState } from 'react';
import { tiposPermitidosMagicBytes } from '@/lib/seguridad/magic-bytes';

/* ══════════════════════════════════════════════════════════════
   Control de carga de UN archivo — Bloque A·A3. Compartido por
   `RequisitoItem` (documento enlazado a un requisito) y `OtrosDocumentos`
   (documento suelto): mismo POST multipart, mismos estados (spinner,
   error literal del servidor), un solo lugar donde vive esa lógica
   (Principio 3, reutilización por defecto).

   `accept` se construye con `tiposPermitidosMagicBytes()`
   (`lib/seguridad/magic-bytes.ts`, función pura sin I/O — segura de
   importar en cliente) para que la allowlist del input NUNCA se desincronice
   de la que valida el servidor; el servidor sigue siendo la única fuente de
   verdad (el `accept` del navegador es solo una ayuda de UX, no seguridad).

   NUNCA optimista: el archivo solo se da por subido cuando el servidor
   responde `ok`. Mientras tanto, "Subiendo…"; si el servidor rechaza, se
   muestra el mensaje LITERAL de `body.error` (magic-bytes, 10MB, requisito
   inexistente, expediente EN_FIRME…) — este componente nunca reinterpreta
   ni reescribe esos mensajes.
══════════════════════════════════════════════════════════════ */

const ACCEPT_ARCHIVOS = tiposPermitidosMagicBytes().join(',');

export interface ControlSubidaDocumentoProps {
  expedienteId: string;
  /** Presente cuando el documento satisface un requisito del checklist; ausente para un adjunto suelto. */
  requisitoId?: string;
  /** Nombre lógico sugerido para el documento (el servidor lo usa solo si crea un documento NUEVO). */
  nombre?: string;
  etiqueta: string;
  etiquetaSubiendo?: string;
  onSubido: () => void;
}

export function ControlSubidaDocumento({
  expedienteId,
  requisitoId,
  nombre,
  etiqueta,
  etiquetaSubiendo = 'Subiendo…',
  onSubido,
}: ControlSubidaDocumentoProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setError(null);
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      if (requisitoId) formData.append('requisitoId', requisitoId);
      if (nombre) formData.append('nombre', nombre);
      const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}/documentos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'No fue posible subir el documento.');
        return;
      }
      onSubido();
    } catch {
      setError('Error de red al subir el documento.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="inline-flex items-center gap-1.5 w-fit text-xs font-semibold rounded-lg px-3 py-1.5 cursor-pointer transition-colors hover:brightness-95 focus-within:outline-none focus-within:ring-2"
        style={{ border: '1px solid var(--color-border)', color: '#14532D' }}
      >
        {subiendo ? etiquetaSubiendo : etiqueta}
        <input
          type="file"
          accept={ACCEPT_ARCHIVOS}
          className="sr-only"
          disabled={subiendo}
          aria-label={etiqueta}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            // Limpiar el value ANTES de procesar: si un intento anterior
            // falló, permite re-seleccionar el MISMO archivo — el navegador
            // no dispara `change` dos veces sobre el mismo path si el
            // value del input no se resetea entre intentos.
            e.target.value = '';
            if (archivo) void subir(archivo);
          }}
        />
      </label>
      {subiendo && (
        <span role="status" className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {etiquetaSubiendo}
        </span>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
