import { ESTILOS_ESTADO_JURIDICO } from '../estilos-estado-juridico';
import { EtiquetaMarcaFila } from './EtiquetaMarcaFila';

/**
 * Trío ROJO REUTILIZADO de `ESTILOS_ESTADO_JURIDICO.NEGADA` — cero hex nuevo,
 * exactamente el mismo patrón con que `EtiquetaDatoFaltante` toma el ámbar de
 * `CON_ACTA_DE_OBSERVACIONES`. Contraste medido de `#911111` sobre `#FCEBEB`:
 * 7,95:1 (WCAG AA exige 4,5:1).
 *
 * POR QUÉ ROJO Y NO EL ÁMBAR DE "DATO FALTANTE": un número legal repetido no
 * es un hueco del histórico pendiente de digitar (ámbar, se completa leyendo
 * el expediente físico) — es una violación consumada de la unicidad del
 * consecutivo, que ya está en producción y que NADIE puede resolver
 * escribiendo un dato: exige decisión humana con acta.
 *
 * RIESGO ASUMIDO Y ACOTADO: es el mismo rojo del estado "Negada". Nunca
 * comparten columna (el estado vive en la columna ESTADO, esta marca en
 * N.° EXPEDIENTE) y ambas llevan su propio texto en versalitas, así que el
 * color no es nunca el único portador del significado.
 *
 * Deliberadamente NO usa `--color-warning`: rinde 2,15:1 como texto (ver
 * ADR-0030). El arreglo de fondo de los tokens semánticos es trabajo aparte.
 */
const ROJO = ESTILOS_ESTADO_JURIDICO.NEGADA;

/**
 * Marca un expediente cuyo número legal está DUPLICADO en el libro. El texto
 * visible ("Colisión") no cabe entero en la píldora, así que la explicación
 * —con quién colisiona y qué se hace— viaja en el `title` y en el nombre
 * accesible, que es donde mira la funcionaria cuando ve la anomalía.
 *
 * `role="note"` es obligatorio para que `aria-label` sea válido (ver
 * `EtiquetaMarcaFila`): sin él, ARIA lo prohíbe sobre un `<span>` genérico y
 * un lector de pantalla anunciaría solo "Colisión", sin el porqué.
 */
export function EtiquetaColisionNumero({ explicacion }: { explicacion: string }) {
  return (
    <EtiquetaMarcaFila
      texto="Colisión"
      colorFondo={ROJO.fondo}
      colorTexto={ROJO.texto}
      colorDot={ROJO.dot}
      title={explicacion}
      role="note"
      etiquetaAccesible={`Colisión de número de expediente. ${explicacion}`}
    />
  );
}
