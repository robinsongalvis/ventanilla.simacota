/**
 * lib/motor-expedientes/acto-lsr/estructura-f-pgj-002.ts
 *
 * LO ESTRUCTURAL DEL FORMATO — lo que es igual en todas las resoluciones LSR.
 *
 * Transcrito del acto real que entregó el ingeniero (F-PGJ-002, versión 02,
 * aprobación 2024). Se separa de lo dinámico por un motivo práctico: esto se
 * revisa UNA vez con Planeación y no se vuelve a tocar; lo otro cambia en cada
 * expediente.
 *
 * ── DOS COSAS QUE SE CORRIGEN AL TRANSCRIBIR, Y SE DICEN ──────────────────
 *
 *  · El acto real numera «ARTÍCULO dieciséis» en minúscula, rompiendo la serie
 *    de mayúsculas. Aquí la serie es uniforme: es un descuido de la copia
 *    manual, no una forma del documento.
 *  · El encabezado real dice «PÁGINA 1 de 1» fijo, en un documento de varias
 *    páginas. La paginación la pone el renderizador, no un literal.
 *
 * No se corrige nada más. En particular NO se toca el texto de recursos aunque
 * contradiga lo que el sistema escribe en otros actos: esa es la decisión
 * pendiente `TEXTO_RECURSOS` y la resuelve Jurídica.
 */

export const ENCABEZADO_F_PGJ_002 = {
  entidad: 'ALCALDÍA MUNICIPAL DE SIMACOTA',
  encabezadoEntidad: 'República de Colombia, Departamento Santander Municipio Simacota',
  nit: 'Nit. 890.208.807-0',
  titulo: 'RESOLUCIÓN',
  codigo: 'F-PGJ-002',
  fechaAprobacion: '2024',
  version: '02',
} as const;

export const PIE_F_PGJ_002 = {
  direccion: 'Carrera 6 No. 3-33 | Telefax 097-7261507 | Código Postal - 683561',
  contacto: 'Correo Electrónico alcaldia@simacota-santander.gov.co | Página Web www.simacota-santander.gov.co',
} as const;

/** El preámbulo de facultades. Idéntico en toda LSR. */
export const PREAMBULO_FACULTADES =
  'LA SECRETARÍA DE DESPACHO DE LA SECRETARÍA DE PLANEACIÓN E INFRAESTRUCTURA EN USO DE SUS FACULTADES LEGALES, EN ESPECIAL '
  + 'LAS CONFERIDAS EN EL ART. 99 DE LA LEY 388 DEL 18 DE JULIO DE 1997, LEY 675 DE 2001, LEY 810 DE 2003, DECRETO 097 DE '
  + 'ENERO 16 DE 2006 Y 1469 DE ABRIL 30 DE 2010, COMPILADO POR EL DECRETO 1077 DE MAYO 26 DE 2015, MODIFICADO POR LOS '
  + 'DECRETOS 2218 DE 2015, 1197 DE 2016, 1203 DE 2017, 2013 DE 2017, DECRETO 1783 DE DICIEMBRE 20 DE 2021, Y ACUERDO '
  + 'MUNICIPAL 013 DEL 11 DE DICIEMBRE DE 2003 (EOT MUNICIPAL), DEMÁS NORMAS COMPLEMENTARIAS Y,';

/** La advertencia que va bajo el título, entre paréntesis, en el acto real. */
export const ADVERTENCIA_ALCANCE_LSR =
  '(ESTA LICENCIA NO AUTORIZA LA EJECUCIÓN DE OBRAS DE INFRAESTRUCTURA, O DE CONSTRUCCIÓN NI LA DELIMITACIÓN DE ESPACIOS '
  + 'PÚBLICOS O PRIVADOS)';

/** Las citas normativas que el acto reproduce literalmente en los considerandos. */
export const CITAS_UAF = {
  articulo44:
    '«ARTÍCULO 44. Salvo las excepciones que se señalan en el artículo siguiente, los predios rurales no podrán fraccionarse '
    + 'por debajo de la extensión determinada por el INCORA como Unidad Agrícola Familiar para el respectivo municipio o zona.» '
    + '«En consecuencia, so pena de nulidad absoluta del acto o contrato no podrá llevarse a cabo actuación o negocio alguno del '
    + 'cual resulte la división de un inmueble rural cuyas superficies sean inferiores a la señalada como Unidad Agrícola '
    + 'Familiar para el correspondiente municipio por el INCORA.»',
  fuenteRangos:
    'El INCORA, mediante la Resolución 041 de 1996, modificada parcialmente por la Resolución 020 de 1998, estableció en su '
    + 'artículo 23 la Unidad Agrícola Familiar para el Municipio de Simacota.',
} as const;

/**
 * Los artículos de texto FIJO, con su posición en la serie.
 *
 * Los que faltan en esta lista —primero, segundo, cuarto, quinto, sexto, doce y
 * quince— llevan datos del expediente y los arma el generador. Esta separación
 * es el objeto del módulo: lo de aquí se revisa una vez, lo otro cambia siempre.
 */
export const ARTICULOS_FIJOS: readonly { ordinal: number; nombre: string; texto: string }[] = [
  {
    ordinal: 3,
    nombre: 'TERCERO',
    texto:
      'Si vencido el término no se ha ejecutado el objeto del presente permiso, se deberá solicitar ante las autoridades del '
      + 'Municipio de Simacota Santander la actualización del proyecto y la licencia. En caso de que se presenten modificaciones '
      + 'originadas por cambio de la reglamentación, el proyectista deberá efectuar los ajustes necesarios y someterlos a '
      + 'aprobación. En caso de incumplimiento de las normas establecidas dentro de esta Resolución, automáticamente se le '
      + 'impondrán las sanciones previstas por la Ley.',
  },
  {
    ordinal: 7,
    nombre: 'SÉPTIMO',
    texto: 'La responsabilidad civil por daños a terceros correrá por cuenta del propietario y contratista del predio.',
  },
  {
    ordinal: 8,
    nombre: 'OCTAVO',
    texto: 'Esta resolución debe notificarse al interesado y a los vecinos.',
  },
  {
    ordinal: 10,
    nombre: 'DÉCIMO',
    texto:
      'El Titular de la Licencia y el Profesional se responsabilizan del cumplimiento de la Ley 1228 de 2008 en cuanto al retiro '
      + 'obligatorio para las carreteras del sistema vial nacional.',
  },
  {
    ordinal: 11,
    nombre: 'UNDÉCIMO',
    texto:
      'Se presentó el correspondiente levantamiento topográfico para avalar el área correspondiente presentada en los planos '
      + 'radicados en este despacho.',
  },
  {
    ordinal: 13,
    nombre: 'DECIMOTERCERO',
    texto: 'No es competencia de la Secretaría de Planeación e Infraestructura realizar los correspondientes cambios de áreas.',
  },
  {
    ordinal: 14,
    nombre: 'DECIMOCUARTO',
    texto:
      'Que debido a su condición de subdivisión rural se deberán tener en cuenta las determinantes relacionadas con la protección '
      + 'de los suelos rurales y suburbanos, en el artículo 46 de la Resolución 0858 de 2018 de la Corporación Autónoma Regional '
      + 'de Santander (CAS).',
  },
  {
    ordinal: 16,
    nombre: 'DECIMOSEXTO',
    texto:
      'Por el cual se reglamentan las disposiciones relativas a las licencias urbanísticas, al reconocimiento de edificaciones y '
      + 'a la función pública que desempeñan los curadores urbanos, y se expiden otras disposiciones, de acuerdo con el Decreto '
      + '1077 del año 2015.',
  },
];

/** Nombre ordinal de cada artículo, para no escribirlos sueltos en el generador. */
export const ORDINALES: Readonly<Record<number, string>> = {
  1: 'PRIMERO', 2: 'SEGUNDO', 3: 'TERCERO', 4: 'CUARTO', 5: 'QUINTO', 6: 'SEXTO',
  7: 'SÉPTIMO', 8: 'OCTAVO', 9: 'NOVENO', 10: 'DÉCIMO', 11: 'UNDÉCIMO', 12: 'DUODÉCIMO',
  13: 'DECIMOTERCERO', 14: 'DECIMOCUARTO', 15: 'DECIMOQUINTO', 16: 'DECIMOSEXTO',
};
