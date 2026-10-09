/**
 * lib/motor-expedientes/acto-construccion/estructura-acto-construccion.ts
 *
 * CAPA 1 — ESTRUCTURAL. La ARQUITECTURA de la resolución de construcción, sin
 * el formato definitivo, que Planeación todavía no ha entregado.
 *
 * ── LA LÍNEA QUE ESTE ARCHIVO NO CRUZA ────────────────────────────────────
 *
 * En subdivisión, `estructura-f-pgj-002.ts` transcribe el TEXTO real de los
 * artículos fijos, porque teníamos el acto en la mano. Aquí NO lo tenemos. Por
 * eso este archivo declara las SECCIONES que todo acto administrativo de
 * licencia tiene —encabezado, título, considerandos, parte resolutiva,
 * recursos, notificación, firma— como una lista de TRAMOS con su orden, y deja
 * el CONTENIDO de cada uno explícitamente pendiente de Planeación.
 *
 * Declarar que una resolución lleva «considerandos» y «parte resolutiva» no es
 * inventar el formato: es el esqueleto que la Ley 1437 (CPACA) exige a
 * cualquier acto administrativo. Inventar sería redactar los considerandos o
 * los artículos —y eso es justo lo que aquí se marca como HUECO, no se escribe.
 *
 * El día que llegue el formato, el trabajo es rellenar el contenido de estos
 * tramos —no descubrir qué tramos había ni en qué orden van.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECLARA el esqueleto y su orden. NO redacta artículos, NO redacta
 * considerandos, NO fija encabezado ni pie (el formato F-PGJ-… de construcción
 * no está entregado) y NO decide numeración de artículos.
 */

/** Quién debe entregar el contenido de un tramo que hoy está vacío. */
export type DecideContenido = 'PLANEACION' | 'JURIDICA' | 'PLANEACION_O_JURIDICA';

/**
 * Un TRAMO del acto. `clave` lo identifica de forma estable; `titulo` es el
 * rótulo que un lector reconoce; `contenido` dice si el texto de ese tramo ya
 * se conoce (`'ESTRUCTURAL_CONOCIDO'`, p. ej. el rótulo «RESUELVE») o está
 * pendiente del formato, y de quién.
 */
export interface TramoActo {
  clave: string;
  titulo: string;
  orden: number;
  contenido:
    | { estado: 'ESTRUCTURAL_CONOCIDO' }
    | { estado: 'PENDIENTE_FORMATO'; decide: DecideContenido; nota: string };
  /** `true` cuando el tramo aloja datos del expediente que el generador SÍ puede volcar (aunque el texto que los rodea falte). */
  alojaDatosDinamicos: boolean;
}

/**
 * EL ESQUELETO. El orden es el de cualquier resolución de licencia; el
 * contenido de casi todos los tramos está pendiente del formato real.
 *
 * Nótese que NINGÚN tramo trae prosa inventada. Los que están
 * `ESTRUCTURAL_CONOCIDO` lo están porque su «contenido» es solo el rótulo de la
 * sección (una palabra que la ley nombra: «CONSIDERANDO», «RESUELVE»), no un
 * párrafo redactado por nosotros.
 */
export const ESQUELETO_ACTO_CONSTRUCCION: readonly TramoActo[] = [
  {
    clave: 'ENCABEZADO',
    titulo: 'Encabezado institucional (escudo, dependencia, código de formato)',
    orden: 1,
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'PLANEACION', nota: 'El código y la maqueta del formato F-PGJ-… de construcción no se han entregado. En subdivisión es F-PGJ-002; el de construcción puede ser otro.' },
    alojaDatosDinamicos: false,
  },
  {
    clave: 'NUMERO_Y_TITULO',
    titulo: 'Número de la resolución y epígrafe («POR EL CUAL SE CONCEDE…»)',
    orden: 2,
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'PLANEACION', nota: 'El número lo RECIBE el generador (serie LC ya decidida, sin abrir en producción). La redacción exacta del epígrafe es del formato.' },
    alojaDatosDinamicos: true,
  },
  {
    clave: 'PREAMBULO_FACULTADES',
    titulo: 'Preámbulo de facultades del/la Secretario(a)',
    orden: 3,
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'PLANEACION', nota: 'El texto de facultades (acto de nombramiento, decreto de delegación) es del formato de la dependencia.' },
    alojaDatosDinamicos: false,
  },
  {
    clave: 'CONSIDERANDO',
    titulo: 'CONSIDERANDO',
    orden: 4,
    contenido: { estado: 'ESTRUCTURAL_CONOCIDO' },
    alojaDatosDinamicos: true,
  },
  {
    clave: 'CONSIDERANDOS_CUERPO',
    titulo: 'Cuerpo de los considerandos (motivación de hecho y de derecho)',
    orden: 5,
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'PLANEACION_O_JURIDICA', nota: 'La motivación (citas normativas del art. 2.2.6.1.1.7, revisión del proyecto, concepto técnico) es contenido del acto que solo el formato y el expediente concreto fijan. Redactarla aquí sería inventarla.' },
    alojaDatosDinamicos: true,
  },
  {
    clave: 'RESUELVE',
    titulo: 'RESUELVE',
    orden: 6,
    contenido: { estado: 'ESTRUCTURAL_CONOCIDO' },
    alojaDatosDinamicos: false,
  },
  {
    clave: 'ARTICULOS_RESOLUTIVOS',
    titulo: 'Artículos resolutivos (conceder la licencia, área/pisos/uso autorizados, términos, obligaciones, responsable)',
    orden: 7,
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'PLANEACION', nota: 'El orden, la numeración y el texto de cada artículo son del formato. El generador SÍ puede volcar los datos (área, pisos, uso, titulares, profesional) en los huecos, pero el articulado que los enmarca falta.' },
    alojaDatosDinamicos: true,
  },
  {
    clave: 'ARTICULO_VIGENCIA',
    titulo: 'Artículo de términos de ejecución (vigencia)',
    orden: 8,
    /* La REGLA de vigencia sí está respaldada (36/24 meses desde firmeza,
       `reglas-acto-construccion.ts`); lo que falta es la REDACCIÓN del artículo
       que la enuncia. Por eso el tramo aloja datos dinámicos y su texto queda
       pendiente del formato. */
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'PLANEACION', nota: 'La vigencia (meses y ancla en firmeza) está calculada por regla; la redacción del artículo es del formato.' },
    alojaDatosDinamicos: true,
  },
  {
    clave: 'ARTICULO_EXPENSAS',
    titulo: 'Artículo de expensas / liquidación',
    orden: 9,
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'PLANEACION', nota: 'La tarifa de expensas de construcción no está transcrita en el repositorio (a diferencia de la de subdivisión, Acuerdo 026 art. 194 ítem 10). Sin la tarifa no se puede liquidar ni redactar el artículo.' },
    alojaDatosDinamicos: true,
  },
  {
    clave: 'ARTICULO_RECURSOS',
    titulo: 'Artículo de recursos',
    orden: 10,
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'JURIDICA', nota: 'Qué recursos proceden (solo reposición, o reposición y apelación) lo decide Jurídica. Hay precedente fuerte —la mesa del 10-ago-2026 y el acto de desistimiento del sistema apuntan a solo reposición—, pero enunciarlos mal vicia la notificación, así que se confirma, no se asume.' },
    alojaDatosDinamicos: false,
  },
  {
    clave: 'NOTIFICACION',
    titulo: 'Orden de notificación y publicación',
    orden: 11,
    contenido: { estado: 'PENDIENTE_FORMATO', decide: 'PLANEACION', nota: 'La fórmula de notificación (art. 2.2.6.1.2.3.7) es del formato.' },
    alojaDatosDinamicos: true,
  },
  {
    clave: 'FIRMA',
    titulo: 'Firma(s)',
    orden: 12,
    contenido: { estado: 'ESTRUCTURAL_CONOCIDO' },
    alojaDatosDinamicos: true,
  },
];

/** Los tramos cuyo contenido está pendiente del formato, en orden — la lista de trabajo de Planeación/Jurídica. */
export function tramosPendientesDeFormato(): TramoActo[] {
  return ESQUELETO_ACTO_CONSTRUCCION.filter((t) => t.contenido.estado === 'PENDIENTE_FORMATO');
}
