import { ESTILOS_ESTADO_JURIDICO } from '../estilos-estado-juridico';
import { EtiquetaMarcaFila } from './EtiquetaMarcaFila';

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
 *
 * El marcado vive ahora en `EtiquetaMarcaFila`, compartido con `ChipPrueba` y
 * `EtiquetaColisionNumero`; la salida DOM es idéntica a la anterior.
 */
export function EtiquetaDatoFaltante({ texto }: { texto: string }) {
  return (
    <EtiquetaMarcaFila
      texto={texto}
      colorFondo={AMBAR.fondo}
      colorTexto={AMBAR.texto}
      colorDot={AMBAR.dot}
      title={`Dato faltante: ${texto}`}
    />
  );
}
