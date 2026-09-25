/**
 * Píldora compacta de MARCA sobre una fila del Libro — el marcado (dot de
 * 6 px + etiqueta de 10 px en versalitas + `title`) que `EtiquetaDatoFaltante`
 * y `ChipPrueba` ya compartían palabra por palabra. Se extrae al aparecer el
 * TERCER consumidor (`EtiquetaColisionNumero`): una tercera copia sería
 * indefendible (Principio 3 — duplicar lógica está prohibido).
 *
 * `role`: por defecto la píldora es decorativa-con-texto y no necesita rol.
 * Cuando la marca lleva una explicación que el lector de pantalla DEBE oír,
 * el consumidor pasa `role="note"`: ARIA prohíbe `aria-label` sobre un
 * `<span>` sin rol (mapea a `generic`, regla `aria-prohibited-attr`), así
 * que sin rol la explicación se perdería para quien navega con lector —
 * y una prueba con `getByLabelText` la daría por buena igualmente.
 */
export function EtiquetaMarcaFila({
  texto,
  colorFondo,
  colorTexto,
  colorDot,
  title,
  role,
  etiquetaAccesible,
}: {
  texto: string;
  colorFondo: string;
  colorTexto: string;
  colorDot: string;
  title: string;
  role?: 'note';
  etiquetaAccesible?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: colorFondo, color: colorTexto }}
      title={title}
      role={role}
      aria-label={role ? etiquetaAccesible : undefined}
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorDot }} />
      {texto}
    </span>
  );
}
