'use client';

import { useEffect, useState } from 'react';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import type { ResumenCorrida } from '@/lib/server/vigilancia-termino';

/* ══════════════════════════════════════════════════════════════
   ROLL-UP DEL VIGÍA DEL TÉRMINO.

   Muestra lo que el cron DEJÓ ESCRITO, no un cálculo propio: si esta pantalla
   recalculara, podría decir algo distinto del correo del mismo día y habría dos
   verdades sobre el mismo hecho.

   No repite el «vence» por expediente —la bandeja ya lo muestra en cada fila—:
   aquí va solo el agregado, que es lo que no existía.

   LOS TRES SILENCIOS, QUE NO SON EL MISMO:
     · nunca ha corrido  → el vigía no se ha ejecutado. Eso es una avería.
     · conjunto vacío    → corrió y no hay NADA que vigilar. Hoy es lo normal:
                           con el candado R10 todo expediente nace `esPrueba` y
                           el vigía los excluye.
     · todo en cero      → hay expedientes vigilados y ninguno en alerta.
   Un panel que pinta los tres igual es el fallo PT-2 llevado a la pantalla.
══════════════════════════════════════════════════════════════ */

interface Respuesta {
  ultimaCorrida: ResumenCorrida | null;
  nuncaHaCorrido: boolean;
}

const ETIQUETA: Record<string, string> = {
  VENCIDO: 'Vencidos',
  CRITICO: 'Críticos',
  AVISO: 'En aviso',
  ESPERA_EXCESIVA: 'Sin radicar hace demasiado',
};

/** Orden de presentación: lo que más urge, primero. */
const ORDEN = ['VENCIDO', 'CRITICO', 'ESPERA_EXCESIVA', 'AVISO'] as const;

export function PanelVigilanciaTermino() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/licencias/vigilancia-termino', { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Respuesta & { error?: string };
        if (!vivo) return;
        if (!res.ok) setError(body.error ?? 'No fue posible consultar la vigilancia del término.');
        else setDatos(body);
      })
      .catch(() => vivo && setError('Error de red al consultar la vigilancia del término.'))
    return () => {
      vivo = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-xs" style={{ color: 'var(--color-danger-text)' }}>
        {error}
      </p>
    );
  }
  if (!datos) return null;

  if (datos.nuncaHaCorrido) {
    return (
      <div
        role="status"
        className="rounded-lg px-3 py-2 text-sm"
        style={{ background: 'var(--color-warning)', color: '#4A2E02' }}
      >
        <strong>El vigía del término todavía no ha corrido.</strong> Esto no significa que no haya
        vencimientos: significa que nadie ha mirado.
      </div>
    );
  }

  const c = datos.ultimaCorrida;
  if (!c) return null;

  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-surface-2)' }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
          Vigía del término
        </span>
        <span className="text-[11px]" style={{ color: '#94A3B8' }}>
          última revisión: {formatFechaColombia(c.corridaIso)} · {c.revisados} expedientes revisados
        </span>
      </div>

      {c.conjuntoVacio ? (
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Revisó y <strong>no hay ningún expediente que vigilar</strong>. Hoy es lo esperado: los
          expedientes de demostración quedan fuera del alcance del vigía.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {ORDEN.map((nivel) => (
            <span
              key={nivel}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={
                c.porNivel[nivel] > 0 && (nivel === 'VENCIDO' || nivel === 'CRITICO')
                  ? { background: 'var(--color-danger)', color: '#fff' }
                  : { background: 'var(--bg-surface-1)', color: 'var(--text-secondary)' }
              }
            >
              {ETIQUETA[nivel]}: {c.porNivel[nivel]}
            </span>
          ))}
        </div>
      )}

      {!c.lecturaCompleta && (
        <p role="alert" className="text-xs mt-1.5" style={{ color: 'var(--color-danger-text)' }}>
          La revisión tocó su techo de lectura: hay expedientes que <strong>no se miraron</strong>.
          Estas cifras son un mínimo, no un total.
        </p>
      )}
      {c.salidasNoCalculables && (
        <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
          Por esa misma razón no se pudo determinar qué expedientes salieron de alerta.
        </p>
      )}
    </div>
  );
}
