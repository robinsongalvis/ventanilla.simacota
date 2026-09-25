'use client';

import {
  NOMBRE_CLASE,
  QUE_HACER,
  hayComunicacionFallida,
  type ClaseComunicacion,
  type ComunicacionesFallidas,
} from '@/lib/server/comunicacion-fallida';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   LA MARCA DE CORREO FALLIDO, EN LA PANTALLA DEL EXPEDIENTE.

   Requisito vinculante del ADR-0033 §4.7-bis, incumplido hasta ahora: el
   resultado del envío viajaba en la respuesta HTTP y se evaporaba. La
   funcionaria veía la actuación registrada y nada le decía que el aviso al
   ciudadano no salió — peor que no avisar, porque el sistema parecía haber
   avisado.

   NO ES UN ICONITO. Cada fallo dice QUÉ HACER, y el del acta dice además que el
   plazo no ha empezado a correr: sin eso, la marca es decorativa y la
   funcionaria tiene que deducir las consecuencias.
══════════════════════════════════════════════════════════════ */

/** El acta primero: es el único cuyo fallo cambia un plazo legal. */
const ORDEN: ClaseComunicacion[] = ['ACTA', 'ACUSE', 'HITO'];

export interface AvisoComunicacionFallidaProps {
  marcas: ComunicacionesFallidas | undefined;
}

export function AvisoComunicacionFallida({ marcas }: AvisoComunicacionFallidaProps) {
  if (!hayComunicacionFallida(marcas)) return null;

  return (
    <div
      role="alert"
      className="rounded-xl px-4 py-3 flex flex-col gap-3"
      style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#991B1B' }}>
        Correo al ciudadano no entregado
      </p>

      {ORDEN.filter((c) => marcas?.[c]).map((clase) => {
        const fallo = marcas![clase]!;
        return (
          <div key={clase} className="flex flex-col gap-0.5">
            <p className="text-sm font-bold" style={{ color: '#991B1B' }}>
              No salió el {NOMBRE_CLASE[clase]}
            </p>
            <p className="text-xs" style={{ color: '#7F1D1D' }}>
              Se intentó enviar a <strong>{fallo.destinatario}</strong> el{' '}
              {formatFechaHoraColombia(fallo.fechaIso)}.
            </p>
            <p className="text-xs" style={{ color: '#7F1D1D' }}>
              {QUE_HACER[clase]}
            </p>
          </div>
        );
      })}
    </div>
  );
}
