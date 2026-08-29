'use client';

/* ══════════════════════════════════════════════════════════════
   PESTAÑAS DEL EXPEDIENTE, con contador.

   El contador no es decoración: «Documentos 5 de 13» y «Hechos del caso 1 de 4»
   le dicen a la funcionaria dónde falta trabajo SIN abrir la pestaña. Un
   contador que dijera solo el total escondería justo eso.
══════════════════════════════════════════════════════════════ */

export type PestanaExpediente = 'documentos' | 'hechos' | 'predio' | 'historial';

export interface PestanasExpedienteProps {
  activa: PestanaExpediente;
  onCambiar: (p: PestanaExpediente) => void;
  documentos: { aportados: number; aplicables: number };
  hechos: { definidos: number; total: number };
}

export function PestanasExpediente({ activa, onCambiar, documentos, hechos }: PestanasExpedienteProps) {
  const pestanas: { id: PestanaExpediente; texto: string; contador?: string }[] = [
    { id: 'documentos', texto: 'Documentos', contador: `${documentos.aportados} de ${documentos.aplicables}` },
    { id: 'hechos', texto: 'Hechos del caso', contador: `${hechos.definidos} de ${hechos.total}` },
    { id: 'predio', texto: 'Datos del predio' },
    { id: 'historial', texto: 'Historial' },
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
            className="inline-flex items-center gap-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
            style={{
              color: esActiva ? '#14532D' : 'var(--text-secondary)',
              fontWeight: esActiva ? 800 : 600,
              borderBottom: esActiva ? '2px solid #14532D' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {p.texto}
            {p.contador && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px] font-bold"
                style={
                  esActiva
                    ? { background: '#FDF6E3', color: '#9A6206' }
                    : { background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }
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
