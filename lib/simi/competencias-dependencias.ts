import type { TenantId } from '@/src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   Matriz de competencias por dependencia.

   Cada entrada describe el ámbito GENERAL de la dependencia, los
   temas frecuentes que recibe, los temas que claramente NO son su
   competencia, y advertencias específicas para que SIMI no asuma
   funciones específicas que no estén confirmadas por norma.

   Reglas editoriales:
   - Competencias en lenguaje general, no específico (evita afirmar
     funciones detalladas que no estén confirmadas oficialmente).
   - Si hay duda razonable, SIMI debe pedir validación humana.
   - Esta matriz NO es fuente normativa; es un mapa heurístico para
     el clasificador. Las competencias formales viven en los
     manuales de funciones del municipio.
══════════════════════════════════════════════════════════════ */

export interface CompetenciaDependencia {
  tenantId:                       TenantId;
  nombre:                         string;
  /** Descripción de alto nivel del ámbito de la dependencia. */
  competenciasGenerales:          string[];
  /** Temas frecuentes (palabras y conceptos que típicamente le corresponden). */
  temasFrecuentes:                string[];
  /** Temas que claramente NO le corresponden — útil para detectar mala asignación. */
  noEsCompetentePara:             string[];
  /** Dependencias a las que típicamente debería escalar lo que no le corresponde. */
  debeEscalarA?:                  TenantId[];
  /** Patrones que indican que conviene una validación jurídica antes de responder. */
  requiereRevisionJuridicaCuando?: string[];
  /** Estilo de respuesta sugerido por la dependencia. */
  estiloRespuesta:                string;
  /** Advertencias específicas para SIMI al asistir a esta dependencia. */
  advertencias:                   string[];
}

export const COMPETENCIAS_DEPENDENCIAS: Record<TenantId, CompetenciaDependencia> = {
  VENTANILLA_UNICA: {
    tenantId: 'VENTANILLA_UNICA',
    nombre: 'Ventanilla Única',
    competenciasGenerales: [
      'Recepción y radicación de solicitudes ciudadanas.',
      'Asignación inicial de radicados a dependencias.',
      'Devolución por información incompleta o inconsistente.',
      'Orientación general sobre el flujo de PQRSD.',
    ],
    temasFrecuentes: [
      'consulta de estado', 'orientación', 'devolución', 'reclasificación',
      'aclaración de radicado', 'fecha de respuesta',
    ],
    noEsCompetentePara: [
      'decisiones técnicas de otras secretarías',
      'pronunciamientos jurídicos de fondo',
      'ejecución de programas sociales',
    ],
    estiloRespuesta: 'Informativo y orientador. Dirige al ciudadano a la dependencia competente.',
    advertencias: [
      'Ventanilla Única no debe responder de fondo casos que correspondan a otra dependencia.',
    ],
  },

  DESPACHO_ALCALDE: {
    tenantId: 'DESPACHO_ALCALDE',
    nombre: 'Despacho del Alcalde',
    competenciasGenerales: [
      'Dirección general del municipio.',
      'Coordinación de secretarías y subsecretarías.',
      'Asuntos políticos, protocolarios y de representación institucional.',
    ],
    temasFrecuentes: [
      'felicitación', 'invitación oficial', 'reconocimiento',
      'queja directa al alcalde', 'agradecimiento institucional',
    ],
    noEsCompetentePara: [
      'trámites operativos rutinarios que correspondan a una secretaría',
    ],
    debeEscalarA: ['SEC_GOBIERNO', 'SEC_PLANEACION', 'SEC_DESARROLLO_SOCIAL', 'SEC_HACIENDA'],
    estiloRespuesta: 'Formal, protocolario, institucional.',
    advertencias: [
      'No comprometer pronunciamientos del Alcalde sin validación previa.',
    ],
  },

  SEC_GOBIERNO: {
    tenantId: 'SEC_GOBIERNO',
    nombre: 'Secretaría de Gobierno',
    competenciasGenerales: [
      'Orden público y convivencia ciudadana.',
      'Apoyo a procesos electorales en lo administrativo municipal.',
      'Articulación con inspecciones de policía y comisarías.',
      'Atención a víctimas en coordinación con la subsecretaría correspondiente.',
    ],
    temasFrecuentes: [
      'orden público', 'convivencia', 'manifestaciones', 'eventos públicos',
      'seguridad ciudadana', 'comportamientos contrarios a la convivencia',
    ],
    noEsCompetentePara: [
      'litigios judiciales (compete a la jurisdicción competente)',
      'obras de infraestructura (compete a Planeación)',
      'programas sociales operativos (compete a Desarrollo Social)',
    ],
    debeEscalarA: ['SUB_COMISARIA', 'SUB_INSPECCION_POLICIA_URBANA', 'SUB_INSPECCION_POLICIA_RURAL'],
    requiereRevisionJuridicaCuando: [
      'la solicitud involucra sanciones, multas o medidas correctivas',
      'la solicitud implica restricción de derechos fundamentales',
    ],
    estiloRespuesta: 'Institucional firme. Cita el marco normativo solo si está confirmado.',
    advertencias: [
      'No emitir órdenes administrativas en la respuesta sin acto administrativo de respaldo.',
    ],
  },

  SUB_INSPECCION_POLICIA_URBANA: {
    tenantId: 'SUB_INSPECCION_POLICIA_URBANA',
    nombre: 'Inspección de Policía Urbana',
    competenciasGenerales: [
      'Aplicación del Código Nacional de Seguridad y Convivencia Ciudadana en el casco urbano.',
      'Trámite de querellas por perturbación a la convivencia.',
      'Conciliación en asuntos de competencia.',
    ],
    temasFrecuentes: [
      'perturbación', 'ruido', 'conflicto entre vecinos', 'linderos',
      'comportamientos contrarios a la convivencia', 'querella',
    ],
    noEsCompetentePara: [
      'asuntos del área rural (compete a Inspección Rural)',
      'asuntos de violencia intrafamiliar (compete a Comisaría)',
      'asuntos contractuales o comerciales',
    ],
    debeEscalarA: ['SUB_INSPECCION_POLICIA_RURAL', 'SUB_COMISARIA'],
    requiereRevisionJuridicaCuando: [
      'la solicitud implica medidas correctivas con sanción',
    ],
    estiloRespuesta: 'Procedimental, claro sobre próximos pasos del trámite.',
    advertencias: [
      'No prejuzgar sobre quién tiene la razón en disputas entre particulares.',
    ],
  },

  SUB_INSPECCION_POLICIA_RURAL: {
    tenantId: 'SUB_INSPECCION_POLICIA_RURAL',
    nombre: 'Inspección de Policía Rural',
    competenciasGenerales: [
      'Aplicación del Código Nacional de Seguridad y Convivencia Ciudadana en zona rural.',
      'Trámite de querellas rurales.',
    ],
    temasFrecuentes: [
      'linderos rurales', 'conflictos vecinales rurales', 'aprovechamiento de aguas',
      'conducción de ganado', 'cercas y caminos',
    ],
    noEsCompetentePara: [
      'asuntos del casco urbano (compete a Inspección Urbana)',
      'titulación de predios (compete a entidades nacionales como ANT o IGAC)',
    ],
    debeEscalarA: ['SUB_INSPECCION_POLICIA_URBANA', 'SEC_AGRICULTURA_UMATA'],
    estiloRespuesta: 'Procedimental, contextualizado al medio rural.',
    advertencias: [
      'No emitir pronunciamientos sobre propiedad de la tierra.',
    ],
  },

  SUB_COMISARIA: {
    tenantId: 'SUB_COMISARIA',
    nombre: 'Comisaría de Familia',
    competenciasGenerales: [
      'Protección integral de los derechos de niños, niñas y adolescentes.',
      'Atención a violencia intrafamiliar.',
      'Medidas de restablecimiento de derechos.',
    ],
    temasFrecuentes: [
      'violencia intrafamiliar', 'maltrato infantil', 'custodia',
      'medidas de protección', 'restablecimiento de derechos',
    ],
    noEsCompetentePara: [
      'fijación judicial de alimentos (jurisdicción de familia)',
      'divorcios (jurisdicción de familia)',
    ],
    requiereRevisionJuridicaCuando: [
      'cualquier respuesta que afecte custodia o medidas de protección',
      'la solicitud implica restricción de contacto familiar',
    ],
    estiloRespuesta: 'Empático, cuidadoso, riguroso. Proteger identidad de menores siempre.',
    advertencias: [
      'NUNCA revelar datos personales de niños, niñas o adolescentes.',
      'Verificar siempre reserva de información en casos sensibles.',
    ],
  },

  SUB_VICTIMAS: {
    tenantId: 'SUB_VICTIMAS',
    nombre: 'Subsecretaría de Atención a Víctimas',
    competenciasGenerales: [
      'Atención a la población víctima del conflicto armado.',
      'Apoyo en trámites de la Ley 1448 de 2011 en lo municipal.',
      'Coordinación con la Unidad para la Atención y Reparación Integral a las Víctimas.',
    ],
    temasFrecuentes: [
      'declaración', 'reparación', 'ayuda humanitaria', 'inscripción RUV',
      'retorno y reubicación',
    ],
    noEsCompetentePara: [
      'reconocimiento como víctima (compete a la UARIV)',
      'pago de indemnizaciones (compete a la UARIV)',
    ],
    debeEscalarA: ['SEC_DESARROLLO_SOCIAL'],
    requiereRevisionJuridicaCuando: [
      'la solicitud requiere certificación de hechos victimizantes',
    ],
    estiloRespuesta: 'Empático, riguroso en la protección de datos sensibles.',
    advertencias: [
      'Información de víctimas es reservada. Aplica Ley 1448/2011.',
    ],
  },

  SEC_PLANEACION: {
    tenantId: 'SEC_PLANEACION',
    nombre: 'Secretaría de Planeación',
    competenciasGenerales: [
      'Planeación municipal y ordenamiento territorial.',
      'Coordinación de obras de infraestructura municipal.',
      'Atención de solicitudes sobre uso del suelo.',
      'Articulación con Sisbén y Gestión del Riesgo.',
    ],
    temasFrecuentes: [
      'uso del suelo', 'licencias de construcción menor (si aplica)',
      'plan de desarrollo', 'POT', 'vías municipales',
      'acueducto y alcantarillado en lo administrativo', 'mantenimiento de obras',
    ],
    noEsCompetentePara: [
      'cobro de impuestos (compete a Hacienda)',
      'asistencia social directa (compete a Desarrollo Social)',
    ],
    debeEscalarA: ['SEC_HACIENDA', 'SEC_DESARROLLO_SOCIAL', 'SUB_SISBEN', 'SUB_RIESGOS_GRD'],
    requiereRevisionJuridicaCuando: [
      'la solicitud implica modificación del POT',
      'la solicitud involucra predios privados',
    ],
    estiloRespuesta: 'Técnico-administrativo, citando instrumentos de planeación cuando aplique.',
    advertencias: [
      'No comprometer obras o inversiones no aprobadas en el plan de desarrollo.',
    ],
  },

  SUB_SISBEN: {
    tenantId: 'SUB_SISBEN',
    nombre: 'Oficina del Sisbén',
    competenciasGenerales: [
      'Aplicación de la encuesta Sisbén IV.',
      'Atención de novedades en la base local (cambios de domicilio, núcleo familiar).',
      'Orientación sobre el grupo de clasificación.',
    ],
    temasFrecuentes: [
      'encuesta Sisbén', 'novedad de Sisbén', 'cambio de domicilio',
      'grupo Sisbén', 'inclusión en base',
    ],
    noEsCompetentePara: [
      'asignación de beneficios sociales (compete a cada programa)',
      'subsidios económicos directos',
    ],
    debeEscalarA: ['SUB_PROGRAMAS', 'SEC_DESARROLLO_SOCIAL'],
    estiloRespuesta: 'Procedimental, indica trámite y tiempos del DNP.',
    advertencias: [
      'No prometer cambios de grupo Sisbén — depende del DNP.',
    ],
  },

  SUB_RIESGOS_GRD: {
    tenantId: 'SUB_RIESGOS_GRD',
    nombre: 'Gestión del Riesgo de Desastres',
    competenciasGenerales: [
      'Conocimiento, reducción y manejo del riesgo de desastres en el municipio.',
      'Coordinación del Consejo Municipal de Gestión del Riesgo.',
      'Atención inicial a emergencias.',
    ],
    temasFrecuentes: [
      'emergencia', 'desastre', 'inundación', 'deslizamiento',
      'evaluación de riesgo', 'ayuda humanitaria por emergencia',
    ],
    noEsCompetentePara: [
      'reconstrucción de viviendas (compete a Planeación y entidades nacionales)',
    ],
    debeEscalarA: ['SEC_PLANEACION', 'SUB_VICTIMAS'],
    requiereRevisionJuridicaCuando: [
      'la solicitud implica reubicación obligatoria',
    ],
    estiloRespuesta: 'Operativo, claro sobre niveles de coordinación.',
    advertencias: [
      'En emergencias activas, dirigir al ciudadano a líneas de emergencia.',
    ],
  },

  SEC_DESARROLLO_SOCIAL: {
    tenantId: 'SEC_DESARROLLO_SOCIAL',
    nombre: 'Secretaría de Desarrollo Social',
    competenciasGenerales: [
      'Programas sociales municipales (adulto mayor, discapacidad, primera infancia, mujer).',
      'Apoyo a poblaciones vulnerables.',
      'Coordinación de programas departamentales y nacionales en lo local.',
    ],
    temasFrecuentes: [
      'subsidio adulto mayor', 'programa de discapacidad',
      'apoyo a mujer cabeza de familia', 'familias en acción (operativo)',
      'banco de elementos asistivos',
    ],
    noEsCompetentePara: [
      'pago de pensiones (compete a Colpensiones u otra)',
      'subsidios económicos directos no municipales',
    ],
    debeEscalarA: ['SUB_PROGRAMAS', 'SUB_SISBEN', 'SUB_VICTIMAS'],
    estiloRespuesta: 'Cálido, claro en requisitos y disponibilidad de cupos.',
    advertencias: [
      'No prometer inclusión en programa antes de validar cupos y requisitos.',
    ],
  },

  SUB_PROGRAMAS: {
    tenantId: 'SUB_PROGRAMAS',
    nombre: 'Subsecretaría de Programas Sociales',
    competenciasGenerales: [
      'Operación de los programas sociales del municipio en territorio.',
      'Atención a beneficiarios y novedades.',
    ],
    temasFrecuentes: [
      'beneficiario de programa', 'novedad de programa',
      'inclusión en programa social', 'requisitos de programa',
    ],
    noEsCompetentePara: [
      'diseño de programas (compete a Desarrollo Social)',
    ],
    debeEscalarA: ['SEC_DESARROLLO_SOCIAL', 'SUB_SISBEN'],
    estiloRespuesta: 'Operativo y orientador.',
    advertencias: [
      'No comprometer ingresos a programas sin verificación de requisitos.',
    ],
  },

  SEC_HACIENDA: {
    tenantId: 'SEC_HACIENDA',
    nombre: 'Secretaría de Hacienda',
    competenciasGenerales: [
      'Recaudo de impuestos municipales (predial, industria y comercio).',
      'Tesorería municipal.',
      'Atención a contribuyentes sobre obligaciones tributarias municipales.',
    ],
    temasFrecuentes: [
      'predial', 'industria y comercio', 'acuerdo de pago',
      'paz y salvo', 'liquidación de impuestos',
    ],
    noEsCompetentePara: [
      'impuestos nacionales (compete a la DIAN)',
      'pagos no tributarios fuera de la competencia municipal',
    ],
    debeEscalarA: ['SUB_HACIENDA_YARIGUIES'],
    requiereRevisionJuridicaCuando: [
      'la solicitud cuestiona la legalidad del cobro',
      'la solicitud implica devolución de pagos ya realizados',
    ],
    estiloRespuesta: 'Técnico-tributario, indicando normas municipales aplicables solo si están confirmadas.',
    advertencias: [
      'Validar siempre la liquidación antes de comprometer acuerdos de pago.',
    ],
  },

  SUB_HACIENDA_YARIGUIES: {
    tenantId: 'SUB_HACIENDA_YARIGUIES',
    nombre: 'Subsecretaría de Hacienda - Yariguíes',
    competenciasGenerales: [
      'Atención tributaria descentralizada en la zona Yariguíes.',
      'Recaudo y orientación en territorio.',
    ],
    temasFrecuentes: [
      'predial Yariguíes', 'paz y salvo Yariguíes',
      'orientación tributaria local',
    ],
    noEsCompetentePara: [
      'casos por fuera del área Yariguíes',
    ],
    debeEscalarA: ['SEC_HACIENDA'],
    estiloRespuesta: 'Cercano al ciudadano de la zona, técnico.',
    advertencias: [
      'Validar cobertura territorial antes de tramitar.',
    ],
  },

  SEC_AGRICULTURA_UMATA: {
    tenantId: 'SEC_AGRICULTURA_UMATA',
    nombre: 'Secretaría de Agricultura - UMATA',
    competenciasGenerales: [
      'Asistencia técnica agropecuaria.',
      'Apoyo a productores rurales.',
      'Articulación con programas nacionales del sector agropecuario.',
    ],
    temasFrecuentes: [
      'asistencia técnica', 'productor agropecuario',
      'sanidad animal', 'huerta', 'plagas', 'cosecha',
    ],
    noEsCompetentePara: [
      'titulación rural (compete a ANT/IGAC)',
      'subsidios nacionales agropecuarios (compete al Ministerio de Agricultura)',
    ],
    debeEscalarA: ['SEC_PLANEACION', 'SUB_INSPECCION_POLICIA_RURAL'],
    estiloRespuesta: 'Técnico-rural, cercano al productor.',
    advertencias: [
      'No comprometer entrega de insumos sin verificar disponibilidad.',
    ],
  },
};

/** Helper para obtener la competencia o `null` si el tenant no existe. */
export function obtenerCompetencia(tenantId: TenantId): CompetenciaDependencia | null {
  return COMPETENCIAS_DEPENDENCIAS[tenantId] ?? null;
}

/** Devuelve los tenantIds cubiertos por la matriz. */
export function listarTenantsConCompetencia(): TenantId[] {
  return Object.keys(COMPETENCIAS_DEPENDENCIAS) as TenantId[];
}
