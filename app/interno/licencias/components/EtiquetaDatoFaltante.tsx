import { ESTILOS_ESTADO_JURIDICO } from '../estilos-estado-juridico';

/**
 * Trío ámbar REUTILIZADO de `ESTILOS_ESTADO_JURIDICO.CON_ACTA_DE_OBSERVACIONES`
 * (mismo dot/texto/fondo que ya usa `ChipPrueba` para "advertencia" en este
 * módulo) — cero hex nuevo: "dato faltante" es otra advertencia ámbar, no
 * un significado distinto que justifique una paleta propia.
 */
const AMBAR = ESTILOS_ESTADO_JURIDICO.CON_ACTA_DE_OBSERVACIONES;

/**
 * Marca un dato faltante y honesto en una fila del Libro (p. ej. "Sin
 * cédula", "Sin estado") — histórico reconstruido con hueco real, NUNCA un
 * valor inventado para rellenar la celda. Mismo lenguaje visual que
 * `ChipPrueba` (dot + etiqueta compacta), en ámbar de advertencia.
 */
export function EtiquetaDatoFaltante({ texto }: { texto: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: AMBAR.fondo, color: AMBAR.texto }}
      title={`Dato faltante: ${texto}`}
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: AMBAR.dot }} />
      {texto}
    </span>
  );
}
