'use client';

import { useState } from 'react';

/* ══════════════════════════════════════════════════════════════
   DESCARGAR CON SELLO — el patrón físico del mostrador.

   El número de radicado y la fecha estampados en cada página de la copia que
   sale. El original queda intacto: el sello solo existe en la copia.

   EL BOTÓN NO APARECE Y DESAPARECE SIN EXPLICACIÓN. Para un archivo que no es
   PDF, en vez de esconderse, dice POR QUÉ no hay sello — es la instrucción
   literal del propietario, y la razón es de mostrador: una funcionaria que ve
   el botón unas veces sí y otras no concluye que el sistema falla.

   LA PRIMERA VEZ TARDA. La copia se genera al pedirla y se guarda; a partir de
   ahí es inmediata. Se avisa mientras tanto en vez de dejar el botón mudo.
══════════════════════════════════════════════════════════════ */

const MIME_SELLABLE = 'application/pdf';

/** Cómo se nombra cada tipo cuando hay que explicar por qué no se sella. */
const NOMBRE_TIPO: Record<string, string> = {
  'image/jpeg': 'una imagen JPG',
  'image/png': 'una imagen PNG',
  'image/webp': 'una imagen WEBP',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'un documento Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'una hoja de cálculo Excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'una presentación PowerPoint',
};

export interface BotonDescargarSelladoProps {
  expedienteId: string;
  documentoId: string;
  mimeType: string;
}

interface Resultado {
  url: string;
  nombreSugerido?: string;
  paginasSinSello?: number[];
  totalPaginas?: number | null;
  yaExistia?: boolean;
}

export function BotonDescargarSellado({ expedienteId, documentoId, mimeType }: BotonDescargarSelladoProps) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  /* EL MOTIVO, NO LA AUSENCIA. */
  if (mimeType !== MIME_SELLABLE) {
    const comoSeLlama = NOMBRE_TIPO[mimeType] ?? 'un archivo que no es PDF';
    return (
      <p className="text-xs" style={{ color: '#94A3B8' }}>
        Sin sello: es {comoSeLlama}, y el sello solo puede estamparse sobre PDF.
      </p>
    );
  }

  async function pedir() {
    setError(null);
    setGenerando(true);
    try {
      const res = await fetch(
        `/api/licencias/expedientes/${encodeURIComponent(expedienteId)}/documentos/${encodeURIComponent(documentoId)}/sellado`,
        { credentials: 'include' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Tal cual llega: el servidor sabe por qué no pudo.
        setError(body.error ?? 'No fue posible preparar el documento sellado.');
        return;
      }
      setResultado(body as Resultado);
      window.open(body.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Error de red al preparar el documento sellado.');
    } finally {
      setGenerando(false);
    }
  }

  const sinSello = resultado?.paginasSinSello ?? [];

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={pedir}
        disabled={generando}
        className="inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
        style={{ background: 'transparent', color: '#14532D', border: '1px solid #14532D' }}
      >
        {generando ? 'Preparando la copia sellada…' : 'Descargar con sello'}
      </button>

      {generando && (
        <p className="text-[11px]" style={{ color: '#94A3B8' }}>
          La primera vez tarda unos segundos; después es inmediata.
        </p>
      )}

      {sinSello.length > 0 && (
        /* CONSTANCIA VISIBLE de las páginas que no admitieron el sello. No va en
           el papel porque la página sin sello es, por definición, la que no
           tiene sitio para uno: escribirle encima la nota sería el mismo
           problema con otro texto. */
        <p role="alert" className="text-[11px]" style={{ color: '#9A6206' }}>
          {sinSello.length === 1
            ? `La página ${sinSello[0]} quedó sin sello: es demasiado pequeña para que el sello se pueda leer.`
            : `Quedaron sin sello las páginas ${sinSello.join(', ')}: son demasiado pequeñas para que el sello se pueda leer.`}
          {resultado?.totalPaginas ? ` Las otras ${resultado.totalPaginas - sinSello.length} sí lo llevan.` : ''}
        </p>
      )}

      {error && (
        <p role="alert" className="text-[11px]" style={{ color: 'var(--color-danger-text)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
