import { ESTILOS_ESTADO_JURIDICO } from '../estilos-estado-juridico';
import { EtiquetaMarcaFila } from './EtiquetaMarcaFila';

/** Mismo trío ámbar que `EtiquetaDatoFaltante` — antes estaba copiado a mano como `#FAEEDA`/`#7A4F0A`/`#D97706`, que son literalmente estos valores. */
const AMBAR = ESTILOS_ESTADO_JURIDICO.CON_ACTA_DE_OBSERVACIONES;

/**
 * Badge "PRUEBA" — marca expedientes creados con `esPrueba: true`
 * (candado de emisión real cerrado, R10; ver `lib/server/
 * expedientes-licencias.ts`). Mismo lenguaje visual que `ChipEstado`/
 * `ChipEstadoJuridico` (dot + etiqueta), pero en ámbar de advertencia —
 * DELIBERADAMENTE distinto del azul que usa `HISTORICO`
 * (`estilos-chip-estado.ts`): "prueba" (dato de demo, real pero no
 * legalmente válido) y "histórico" (dato real migrado) son dos
 * advertencias de naturaleza distinta y no deben confundirse a simple
 * vista. Reutiliza el mismo trío ámbar ya usado para "advertencia" en el
 * resto del módulo (`POR_VENCER`, `CON_ACTA_DE_OBSERVACIONES`).
 */
export function ChipPrueba() {
  return (
    <EtiquetaMarcaFila
      texto="Prueba"
      colorFondo={AMBAR.fondo}
      colorTexto={AMBAR.texto}
      colorDot={AMBAR.dot}
      title="Expediente de demostración — la emisión real está bloqueada hasta autorizar la siembra del consecutivo (R10)."
    />
  );
}
