import type { NormativeDocument } from '@/src/types/simi-normograma';

/**
 * Sprint SIMI Fase 2 — semilla del paquete núcleo del normograma.
 *
 * El motor RAG (retrieveLegalContext) ya está completo; lo que faltaba
 * era el combustible. Este es el paquete núcleo: las normas que
 * gobiernan el 95 % de las PQRSD de una alcaldía colombiana. Con estas
 * cargadas, SIMI deja de responder "sin contexto documental validado"
 * y empieza a citar fundamento real, verificado contra la base.
 *
 * CURADURÍA: metadatos objetivos y verificables (número, año, entidad,
 * tema). Los resúmenes son de alcance general, no interpretación de
 * artículos — SIMI siempre produce un borrador para revisión humana.
 * Todas nacen `vigente` con `validado_por` que marca la curaduría
 * inicial: un jurista de la alcaldía las ratifica (o ajusta el estado)
 * sobre la base ya cargada, no desde cero. Igual que el catálogo de
 * áreas con Laura.
 *
 * Idempotencia: cada norma trae un `slug` estable; el cargador lo usa
 * como id del documento, así reejecutar no duplica.
 */

const VALIDADO_POR = 'Curaduría inicial SIMI — sujeta a ratificación jurídica municipal';
const FECHA_CURADURIA = '2026-07-07';

export interface NormaNucleo extends Omit<NormativeDocument, 'id' | 'createdAt' | 'updatedAt'> {
  /** Identificador estable para idempotencia del cargador. */
  slug: string;
}

export const NORMOGRAMA_NUCLEO: NormaNucleo[] = [
  {
    slug: 'cp-art-23-derecho-peticion',
    titulo: 'Constitución Política de Colombia — Artículo 23 (Derecho de petición)',
    tipo_norma: 'Constitución',
    anio: '1991',
    entidad_emisora: 'Asamblea Nacional Constituyente',
    estado: 'vigente',
    tema: ['derecho de petición', 'garantías fundamentales'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Toda persona tiene derecho a presentar peticiones respetuosas a las autoridades por motivos de interés general o particular y a obtener pronta resolución.',
    palabras_clave: ['peticion', 'derecho', 'respuesta', 'autoridad', 'pronta resolucion'],
    nivel_confianza: 'alto',
    fuente: 'Constitución Política',
    url_fuente: 'https://www.constitucioncolombia.com/titulo-2/capitulo-1/articulo-23',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'cp-art-74-acceso-documentos',
    titulo: 'Constitución Política de Colombia — Artículo 74 (Acceso a documentos públicos)',
    tipo_norma: 'Constitución',
    anio: '1991',
    entidad_emisora: 'Asamblea Nacional Constituyente',
    estado: 'vigente',
    tema: ['acceso a la información', 'transparencia', 'documentos públicos'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Todas las personas tienen derecho a acceder a los documentos públicos salvo los casos que establezca la ley. El secreto profesional es inviolable.',
    palabras_clave: ['acceso', 'documentos', 'publicos', 'informacion', 'reserva'],
    nivel_confianza: 'alto',
    fuente: 'Constitución Política',
    url_fuente: 'https://www.constitucioncolombia.com/titulo-2/capitulo-1/articulo-74',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'ley-1755-2015-derecho-peticion',
    titulo: 'Ley 1755 de 2015 — Derecho fundamental de petición',
    tipo_norma: 'Ley',
    numero: '1755',
    anio: '2015',
    entidad_emisora: 'Congreso de la República',
    estado: 'vigente',
    tema: ['derecho de petición', 'términos de respuesta', 'silencio administrativo'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Regula el derecho fundamental de petición y sustituye el Título II de la Ley 1437 de 2011. Fija los términos generales (15 días hábiles), los especiales para consultas (30 días) y documentos e información (10 días), y las reglas de traslado por competencia y prórroga.',
    palabras_clave: ['peticion', 'terminos', '15 dias', 'consulta', 'informacion', 'traslado', 'prorroga', 'silencio'],
    nivel_confianza: 'alto',
    fuente: 'Congreso de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=65334',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'ley-1437-2011-cpaca',
    titulo: 'Ley 1437 de 2011 (CPACA) — Código de Procedimiento Administrativo y de lo Contencioso Administrativo',
    tipo_norma: 'Ley',
    numero: '1437',
    anio: '2011',
    entidad_emisora: 'Congreso de la República',
    estado: 'vigente',
    tema: ['procedimiento administrativo', 'actos administrativos', 'notificaciones'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Rige el procedimiento administrativo general: formación de actos, notificaciones, recursos, silencio administrativo y trámite de las actuaciones ante la administración. Base del debido proceso administrativo municipal.',
    palabras_clave: ['procedimiento', 'administrativo', 'acto', 'notificacion', 'recurso', 'debido proceso'],
    nivel_confianza: 'alto',
    fuente: 'Congreso de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'ley-1712-2014-transparencia',
    titulo: 'Ley 1712 de 2014 — Transparencia y acceso a la información pública',
    tipo_norma: 'Ley',
    numero: '1712',
    anio: '2014',
    entidad_emisora: 'Congreso de la República',
    estado: 'vigente',
    tema: ['transparencia', 'acceso a la información', 'información pública'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Crea la Ley de Transparencia y del Derecho de Acceso a la Información Pública Nacional. Define información pública, obligaciones de divulgación, excepciones (reserva y clasificación) y el trámite de las solicitudes de información (10 días hábiles).',
    palabras_clave: ['transparencia', 'acceso', 'informacion', 'publica', 'reserva', 'divulgacion', '10 dias'],
    nivel_confianza: 'alto',
    fuente: 'Congreso de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=56882',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'ley-1581-2012-datos-personales',
    titulo: 'Ley 1581 de 2012 — Protección de datos personales',
    tipo_norma: 'Ley',
    numero: '1581',
    anio: '2012',
    entidad_emisora: 'Congreso de la República',
    estado: 'vigente',
    tema: ['protección de datos', 'habeas data', 'datos sensibles'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Dicta disposiciones generales para la protección de datos personales. Establece principios de tratamiento, derechos del titular, categorías de datos sensibles y deberes de los responsables. Aplica al manejo de datos de los peticionarios.',
    palabras_clave: ['datos', 'personales', 'habeas data', 'sensibles', 'titular', 'tratamiento', 'proteccion'],
    nivel_confianza: 'alto',
    fuente: 'Congreso de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'decreto-1377-2013-datos-personales',
    titulo: 'Decreto 1377 de 2013 — Reglamenta parcialmente la Ley 1581 de 2012',
    tipo_norma: 'Decreto',
    numero: '1377',
    anio: '2013',
    entidad_emisora: 'Presidencia de la República',
    estado: 'vigente',
    tema: ['protección de datos', 'autorización', 'política de tratamiento'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Reglamenta la autorización del titular para el tratamiento de datos, el aviso de privacidad y las políticas de tratamiento de la información. Guía la forma en que la administración recolecta y usa datos de los ciudadanos.',
    palabras_clave: ['datos', 'autorizacion', 'aviso de privacidad', 'politica', 'tratamiento'],
    nivel_confianza: 'alto',
    fuente: 'Presidencia de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=53646',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'decreto-1499-2017-mipg',
    titulo: 'Decreto 1499 de 2017 — Modelo Integrado de Planeación y Gestión (MIPG)',
    tipo_norma: 'Decreto',
    numero: '1499',
    anio: '2017',
    entidad_emisora: 'Presidencia de la República',
    estado: 'vigente',
    tema: ['MIPG', 'gestión pública', 'control interno', 'servicio al ciudadano'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Actualiza el Modelo Integrado de Planeación y Gestión (MIPG) y articula el Sistema de Gestión con el de Control Interno. Enmarca las dimensiones de gestión pública, incluida la relación Estado-ciudadano y la gestión documental que rigen la respuesta a PQRSD.',
    palabras_clave: ['mipg', 'gestion', 'control interno', 'servicio al ciudadano', 'planeacion', 'calidad'],
    nivel_confianza: 'alto',
    fuente: 'Presidencia de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=83433',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'ley-594-2000-archivos',
    titulo: 'Ley 594 de 2000 — Ley General de Archivos',
    tipo_norma: 'Ley',
    numero: '594',
    anio: '2000',
    entidad_emisora: 'Congreso de la República',
    estado: 'vigente',
    tema: ['gestión documental', 'archivos', 'trazabilidad'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Establece las reglas y principios de la función archivística del Estado. Fundamenta la gestión documental, la conservación de expedientes y la trazabilidad de las actuaciones — base del radicado y su historia.',
    palabras_clave: ['archivo', 'gestion documental', 'expediente', 'conservacion', 'trazabilidad', 'radicacion'],
    nivel_confianza: 'alto',
    fuente: 'Congreso de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4275',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'decreto-1080-2015-duce-cultura',
    titulo: 'Decreto 1080 de 2015 — Decreto Único Reglamentario del Sector Cultura (gestión documental)',
    tipo_norma: 'Decreto',
    numero: '1080',
    anio: '2015',
    entidad_emisora: 'Presidencia de la República',
    estado: 'vigente',
    tema: ['gestión documental', 'archivos', 'tablas de retención'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Compila la reglamentación del sector cultura, incluida la gestión documental: tablas de retención documental (TRD), instrumentos archivísticos y organización de archivos de las entidades públicas.',
    palabras_clave: ['gestion documental', 'trd', 'tablas de retencion', 'archivo', 'instrumentos'],
    nivel_confianza: 'medio',
    fuente: 'Presidencia de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=76833',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'ley-2052-2020-racionalizacion-tramites',
    titulo: 'Ley 2052 de 2020 — Racionalización de trámites',
    tipo_norma: 'Ley',
    numero: '2052',
    anio: '2020',
    entidad_emisora: 'Congreso de la República',
    estado: 'vigente',
    tema: ['racionalización de trámites', 'servicio al ciudadano', 'gobierno digital'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Establece disposiciones para la racionalización de trámites: prohíbe exigir documentos que reposan en la entidad, promueve la interoperabilidad y la digitalización del servicio al ciudadano.',
    palabras_clave: ['tramites', 'racionalizacion', 'interoperabilidad', 'gobierno digital', 'documentos'],
    nivel_confianza: 'medio',
    fuente: 'Congreso de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=142707',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
  {
    slug: 'ley-1474-2011-anticorrupcion',
    titulo: 'Ley 1474 de 2011 — Estatuto Anticorrupción',
    tipo_norma: 'Ley',
    numero: '1474',
    anio: '2011',
    entidad_emisora: 'Congreso de la República',
    estado: 'vigente',
    tema: ['transparencia', 'lucha contra la corrupción', 'atención al ciudadano'],
    dependencia_relacionada: ['VENTANILLA_UNICA'],
    resumen: 'Dicta normas para fortalecer los mecanismos de prevención, investigación y sanción de actos de corrupción. Incluye deberes de atención al ciudadano y de rendición de cuentas de las entidades públicas.',
    palabras_clave: ['anticorrupcion', 'transparencia', 'rendicion de cuentas', 'atencion al ciudadano', 'prevencion'],
    nivel_confianza: 'medio',
    fuente: 'Congreso de la República',
    url_fuente: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=43292',
    validado_por: VALIDADO_POR,
    fecha_validacion: FECHA_CURADURIA,
  },
];

/** Estados válidos de un documento normativo (para validar la semilla). */
const ESTADOS_VALIDOS = new Set([
  'vigente', 'parcialmente_vigente', 'derogada',
  'pendiente_verificacion', 'interna_validada', 'interna_no_validada',
]);

export interface ProblemaSemilla {
  slug:    string;
  campo:   string;
  detalle: string;
}

/**
 * Valida la estructura de la semilla: slugs únicos, campos mínimos y
 * estado en el vocabulario permitido. Pura — sin Firestore.
 */
export function validarSemilla(normas: NormaNucleo[] = NORMOGRAMA_NUCLEO): ProblemaSemilla[] {
  const problemas: ProblemaSemilla[] = [];
  const vistos = new Set<string>();

  for (const n of normas) {
    if (vistos.has(n.slug)) {
      problemas.push({ slug: n.slug, campo: 'slug', detalle: 'slug duplicado' });
    }
    vistos.add(n.slug);

    if (!n.slug?.trim())  problemas.push({ slug: n.slug, campo: 'slug', detalle: 'vacío' });
    if (!n.titulo?.trim()) problemas.push({ slug: n.slug, campo: 'titulo', detalle: 'vacío' });
    if (!n.resumen?.trim()) problemas.push({ slug: n.slug, campo: 'resumen', detalle: 'vacío' });
    if (!ESTADOS_VALIDOS.has(n.estado)) {
      problemas.push({ slug: n.slug, campo: 'estado', detalle: `no permitido: ${n.estado}` });
    }
    if (!Array.isArray(n.palabras_clave) || n.palabras_clave.length === 0) {
      problemas.push({ slug: n.slug, campo: 'palabras_clave', detalle: 'sin palabras clave' });
    }
    if (!Array.isArray(n.tema) || n.tema.length === 0) {
      problemas.push({ slug: n.slug, campo: 'tema', detalle: 'sin tema' });
    }
  }
  return problemas;
}
