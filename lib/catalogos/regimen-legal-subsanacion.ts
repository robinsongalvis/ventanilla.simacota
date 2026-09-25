/* ══════════════════════════════════════════════════════════════
   lib/catalogos/regimen-legal-subsanacion.ts

   Clasificación, por tipo de solicitud, del RÉGIMEN LEGAL que gobierna
   la subsanación (requerimiento de información / documentos al
   ciudadano) — no todo radicado se rige por Ley 1755 Art. 17.

   Origen del hallazgo (severidad ALTA, 6-ago-2026): la ruta operativa
   de subsanación aplicaba el requerimiento estándar de Ley 1755 Art. 17
   a CUALQUIER radicado, incluidos trámites con régimen propio (p. ej.
   Licencia de Construcción → Decreto 1077 de 2015: acta de observaciones
   que suspende el término, 30 días hábiles + 15 de prórroga, SIN ventana
   de 10 días — ver docs/blueprints/CN-modulo-planeacion-licencias.md).

   Este módulo es DATO PURO (sin I/O): la tabla exhaustiva
   `REGIMEN_SUBSANACION_POR_TIPO` es el mecanismo fail-closed — al usar
   `Record<TipoSolicitudCatalogoId, ...>`, un tipo nuevo agregado al
   catálogo (`./tipos-solicitud`) NO COMPILA hasta que alguien lo
   clasifique aquí explícitamente. No hay rama "default" que permita
   colar un tipo sin decisión consciente.

   Clasificación validada por dictamen de gobierno-digital del 6-ago-2026.
   Los tipos ESPECIAL_NO_HABILITADO permanecen bloqueados hasta que Jurídica
   ratifique y parametrice los valores propios de cada régimen (plazos,
   prórrogas, ventanas); mientras tanto, el requerimiento correspondiente se
   gestiona por el instrumento propio de ese régimen, por fuera de la
   plataforma.
══════════════════════════════════════════════════════════════ */

import type { TipoSolicitudCatalogoId } from './tipos-solicitud';

/* ──────────────────────────────────────────────────────────────
   Tipos del modelo
────────────────────────────────────────────────────────────── */

export type ClaseRegimenSubsanacion =
  /** Procede el requerimiento estándar de subsanación (Ley 1755 Art. 17). */
  | 'LEY_1755'
  /** Tiene régimen legal propio, distinto de Ley 1755, aún no parametrizado
   *  ni ratificado por Jurídica en la plataforma → se BLOQUEA el requerimiento
   *  estándar (fail-closed) hasta que exista esa ratificación. */
  | 'ESPECIAL_NO_HABILITADO'
  /** Documento interno / de registro: no hay petición ciudadana que subsanar
   *  → se BLOQUEA el requerimiento (no aplica ningún régimen de subsanación). */
  | 'NO_APLICA';

export interface RegimenLegalSubsanacion {
  clase: ClaseRegimenSubsanacion;
  /**
   * Solo presente cuando `clase === 'ESPECIAL_NO_HABILITADO'`: nombre del
   * régimen que sí gobierna este tipo de solicitud, p. ej.
   * 'Decreto 1077 de 2015 (trámites urbanísticos)'. Se usa en el mensaje al
   * funcionario para orientar la gestión manual mientras no esté habilitado.
   */
  regimenAplicable?: string;
}

/* ──────────────────────────────────────────────────────────────
   Tabla exhaustiva por tipo de solicitud

   Clasificación validada por dictamen de gobierno-digital del 6-ago-2026.
   Cuando llegue la ratificación de Jurídica sobre el régimen de licencias
   (Decreto 1077) u otro régimen especial, su constante de textos
   (plazo/prórroga/fundamento) se añadirá en este archivo como DATO — nunca
   hardcodeada en las plantillas de email (ver `TextosLegalesSubsanacion`
   más abajo).
────────────────────────────────────────────────────────────── */

export const REGIMEN_SUBSANACION_POR_TIPO: Record<TipoSolicitudCatalogoId, RegimenLegalSubsanacion> = {
  /* ── PQRSD (categoría PQRSD del catálogo) — Ley 1755 Art. 17 ────────── */
  PETICION_GENERAL: { clase: 'LEY_1755' },
  PETICION_INFORMACION: { clase: 'LEY_1755' },
  PETICION_DOCUMENTOS: { clase: 'LEY_1755' },
  CONSULTA: { clase: 'LEY_1755' },
  QUEJA: { clase: 'LEY_1755' },
  RECLAMO: { clase: 'LEY_1755' },
  SUGERENCIA: { clase: 'LEY_1755' },
  FELICITACION: { clase: 'LEY_1755' },
  DENUNCIA: { clase: 'LEY_1755' },

  /* ── Peticiones con término especial (categoría ESPECIAL) que siguen
     siendo peticiones: Ley 1755 Art. 17 les aplica igual ─────────────── */
  PETICION_ENTRE_AUTORIDADES: { clase: 'LEY_1755' },
  /** Variante interna de petición de información (término reducido); el
   *  ciudadano radica como PETICION_INFORMACION estándar (ver catálogo). */
  PETICION_INFORMACION_CORTA: { clase: 'LEY_1755' },

  /* ── Régimen especial propio, aún NO habilitado en la plataforma ────── */
  /**
   * HABEAS_DATA se rige por su propio régimen estatutario (Ley 1581 de
   * 2012, artículo 15), que DESPLAZA al Art. 17 de Ley 1755: aplicar el
   * requerimiento estándar perjudicaría al titular del dato. Bajo 1755 el
   * desistimiento tácito procedería al mes (1581 da 2 meses: sería
   * prematuro) y el requerimiento se consideraría extemporáneo si se emite
   * entre los días 6 y 10 (1581 exige requerirlo dentro de los primeros 5
   * días). Bloqueado hasta que Jurídica ratifique el futuro régimen
   * LEY_1581 con sus propios valores parametrizados en la plataforma.
   */
  HABEAS_DATA: {
    clase: 'ESPECIAL_NO_HABILITADO',
    regimenAplicable: 'la Ley 1581 de 2012, artículo 15 (habeas data: requerimiento dentro de los 5 días y plazo de 2 meses propios)',
  },
  LICENCIA_CONSTRUCCION: {
    clase: 'ESPECIAL_NO_HABILITADO',
    regimenAplicable: 'el Decreto 1077 de 2015 (acta de observaciones y correcciones)',
  },
  SOLICITUD_SUBDIVISION: {
    clase: 'ESPECIAL_NO_HABILITADO',
    regimenAplicable: 'el Decreto 1077 de 2015 (acta de observaciones y correcciones)',
  },
  DECLARACION_RETENCION_ICA: {
    clase: 'ESPECIAL_NO_HABILITADO',
    regimenAplicable: 'el procedimiento del Estatuto Tributario (Ley 788 de 2002, art. 59, y estatuto tributario municipal)',
  },
  /**
   * PETICION_ENTES_CONTROL: decretar un desistimiento tácito contra un
   * órgano de control (Procuraduría, Contraloría, Personería, Defensoría)
   * es institucionalmente insostenible. Una aclaración sobre este tipo de
   * requerimiento se gestiona por oficio de respuesta directamente al ente
   * requirente, no por el trámite de subsanación del Art. 17.
   */
  PETICION_ENTES_CONTROL: {
    clase: 'ESPECIAL_NO_HABILITADO',
    regimenAplicable: 'las potestades de vigilancia y control del ente requirente (C.P. arts. 267 y 277; norma especial del requerimiento)',
  },
  /**
   * PERMISO_ESTABLECIMIENTO_PUBLICO: bloqueo PRUDENCIAL, no por régimen
   * especial identificado — no se conoce un régimen de subsanación propio
   * distinto de Ley 1755 para este trámite, así que el Art. 17 aplicaría
   * subsidiariamente. Se bloquea de todas formas hasta que Jurídica defina
   * el instrumento correcto por subtipo de establecimiento/permiso.
   */
  PERMISO_ESTABLECIMIENTO_PUBLICO: {
    clase: 'ESPECIAL_NO_HABILITADO',
    regimenAplicable: 'régimen de policía administrativa (Ley 1801 de 2016 y normativa local)',
  },
  QUERELLA: {
    clase: 'ESPECIAL_NO_HABILITADO',
    regimenAplicable: 'proceso policivo (Ley 1801 de 2016)',
  },
  /**
   * URGENTE se bloquea fail-closed aunque no sea, en sí, un trámite con
   * régimen propio conocido: es una categoría interna de uso transversal que
   * puede ENVOLVER actuaciones con régimen distinto al de Ley 1755 (p. ej.
   * una acción de tutela, Decreto 2591 de 1991: subsanación de 3 días). Sin
   * poder distinguir el documento subyacente, no es seguro aplicar el
   * requerimiento estándar — se bloquea hasta gestión manual caso a caso.
   */
  URGENTE: {
    clase: 'ESPECIAL_NO_HABILITADO',
    regimenAplicable: 'régimen del documento subyacente (categoría interna de urgencia; puede tratarse de trámites con régimen propio)',
  },

  /* ── Documentos internos / de registro: no hay petición ciudadana ───── */
  INFORMATIVO: { clase: 'NO_APLICA' },
  INVITACION: { clase: 'NO_APLICA' },
  RESPUESTA_A_SOLICITUD: { clase: 'NO_APLICA' },
  SOLICITUD_SAC: { clase: 'NO_APLICA' },
};

/* ──────────────────────────────────────────────────────────────
   Helper público
────────────────────────────────────────────────────────────── */

/**
 * Resuelve el régimen legal de subsanación aplicable a un tipo de solicitud.
 *
 * Fallback: si `tipoId` es `null`/`undefined`/desconocido, se asume
 * `LEY_1755` — misma convención de "radicado legacy sin tipo → era
 * PQRSD-only" usada por `getTerminoTipoSolicitud` (`./tipos-solicitud.ts`)
 * y por `resolverTipoSolicitud` (`@/lib/tiempos-radicado.ts`), ambos con
 * fallback a `PETICION_GENERAL`. Los radicados anteriores a la
 * introducción de `tipoSolicitudId` son, por construcción, peticiones
 * PQRSD y sí deben poder recibir el requerimiento estándar.
 */
export function getRegimenLegalSubsanacion(tipoId: string | null | undefined): RegimenLegalSubsanacion {
  if (!tipoId) return { clase: 'LEY_1755' };
  const regimen = REGIMEN_SUBSANACION_POR_TIPO[tipoId as TipoSolicitudCatalogoId];
  return regimen ?? { clase: 'LEY_1755' };
}

/* ──────────────────────────────────────────────────────────────
   Textos citizen-facing por régimen (para las plantillas de email)

   El contenido LEGAL de la plantilla (plazo, prórroga, fundamento) es
   parámetro por régimen — nunca hardcodeado en el HTML de la plantilla.
   Hoy solo existe la constante de Ley 1755; cuando Jurídica ratifique el
   régimen de licencias (Decreto 1077), su constante se añade aquí.
────────────────────────────────────────────────────────────── */

export interface TextosLegalesSubsanacion {
  /** P. ej. 'un (1) mes'. */
  plazoDescripcion: string;
  /** P. ej. 'hasta por un término igual'. */
  prorrogaDescripcion: string;
  /** P. ej. 'Ley 1755 de 2015, artículo 17'. */
  fundamentoLegal: string;
}

/** `prorrogaDescripcion` reproduce el texto literal del Art. 17: "...hasta
 *  por un término igual...". */
export const TEXTOS_SUBSANACION_LEY_1755: TextosLegalesSubsanacion = {
  plazoDescripcion: 'un (1) mes',
  prorrogaDescripcion: 'hasta por un término igual',
  fundamentoLegal: 'Ley 1755 de 2015, artículo 17',
};
