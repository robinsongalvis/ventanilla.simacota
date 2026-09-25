'use client';

import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════
   PESTAÑAS DEL EXPEDIENTE, con icono y contador.

   El contador no es decoración: «Documentos 5 de 13» le dice a la funcionaria
   dónde falta trabajo SIN abrir la pestaña. Y su COLOR sigue la misma semántica
   de estados del historial: VERDE cuando está completo (nada que hacer), ÁMBAR
   cuando falta algo — el ámbar es «requiere acción», no «pestaña activa».
══════════════════════════════════════════════════════════════ */

export type PestanaExpediente = 'documentos' | 'hechos' | 'predio' | 'historial';

export interface PestanasExpedienteProps {
  activa: PestanaExpediente;
  onCambiar: (p: PestanaExpediente) => void;
  documentos: { aportados: number; aplicables: number };
  hechos: { definidos: number; total: number };
}

export function PestanasExpediente({ activa, onCambiar, documentos, hechos }: PestanasExpedienteProps) {
  const docsCompletos = documentos.aportados >= documentos.aplicables;
  const hechosCompletos = hechos.definidos >= hechos.total;
  const pestanas: {
    id: PestanaExpediente; texto: string; icono: ReactNode;
    contador?: string; completo?: boolean;
  }[] = [
    { id: 'documentos', texto: 'Documentos', icono: <IconoDocumentos />, contador: `${documentos.aportados} de ${documentos.aplicables}`, completo: docsCompletos },
    { id: 'hechos', texto: 'Hechos del caso', icono: <IconoHechos />, contador: `${hechos.definidos} de ${hechos.total}`, completo: hechosCompletos },
    { id: 'predio', texto: 'Datos del predio', icono: <IconoPredio /> },
    { id: 'historial', texto: 'Historial', icono: <IconoHistorial /> },
  ];

  return (
    <div role="tablist" aria-label="Secciones del expediente" className="flex flex-wrap gap-1"
         style={{ borderBottom: '1px solid var(--color-border)' }}>
      {pestanas.map((p) => {
        const esActiva = p.id === activa;
        return (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={esActiva}
            onClick={() => onCambiar(p.id)}
            className="inline-flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-black/[0.03] active:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2"
            style={{
              color: esActiva ? '#14532D' : 'var(--text-secondary)',
              fontWeight: esActiva ? 800 : 600,
              borderBottom: esActiva ? '2px solid #14532D' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            <span aria-hidden style={{ color: esActiva ? '#14532D' : 'var(--text-secondary)' }}>{p.icono}</span>
            {p.texto}
            {p.contador && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px] font-bold"
                /* VERDE = completo (nada que hacer); ÁMBAR = falta algo. El
                   estado del contador manda sobre si la pestaña está activa —
                   antes el ámbar salía solo por estar activa, y «18 de 18»
                   (completo) se veía como si faltara trabajo. */
                style={
                  p.completo
                    ? { background: '#E7F5EC', color: '#117937' }
                    : { background: '#FDF1DC', color: '#8E5C06' }
                }
              >
                {p.contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function IconoDocumentos() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3.75h6.5L18.25 8.5V19A1.25 1.25 0 0 1 17 20.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 4v5h5M8.5 13h7M8.5 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconoHechos() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 6.5h14M5 12h14M5 17.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconoPredio() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21c4.5-4.2 6.75-7.5 6.75-10.5a6.75 6.75 0 1 0-13.5 0C5.25 13.5 7.5 16.8 12 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="10.3" r="2.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconoHistorial() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
