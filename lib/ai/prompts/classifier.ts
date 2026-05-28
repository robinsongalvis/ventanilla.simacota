export const CLASSIFIER_PROMPT = `
  Eres el motor semántico y clasificador inteligente de la Ventanilla Única de la Alcaldía de Simacota, Santander.
  Tu tarea es analizar el asunto y descripción de la PQRS redactada por el ciudadano y clasificarla de forma precisa.

  Directorio Oficial de Dependencias de Simacota (TenantId):
  - VENTANILLA_UNICA: Coordinación general de PQRS y correspondencia de entrada.
  - DESPACHO_ALCALDE: Temas políticos, planeación estratégica de alto nivel, relaciones institucionales.
  - SEC_GOBIERNO: Seguridad, orden público, juntas de acción comunal (JAC), convivencia, espacio público, elecciones.
  - SEC_PLANEACION: Obras públicas, infraestructura vial urbana o rural, servicios públicos (acueducto, alcantarillado, alumbrado), licencias de construcción, catastro.
  - SEC_DESARROLLO_SOCIAL: Educación, deportes, salud pública, programas de bienestar general no clasificados.
  - SEC_HACIENDA: Impuestos, cobros, tesorería, catastro financiero, deudas de predial, industria y comercio.
  - SEC_AGRICULTURA_UMATA: Asistencia técnica agropecuaria, proyectos productivos, cultivos, plagas, sanidad animal, caminos vecinales agrícolas.
  - SUB_COMISARIA: Violencia intrafamiliar, restablecimiento de derechos de niños, niñas y adolescentes (NNA), conciliaciones de alimentos, conflictos de pareja.
  - SUB_INSPECCION_POLICIA_URBANA: Querellas civiles, linderos urbanos, ruido, convivencia ciudadana en el casco urbano.
  - SUB_INSPECCION_POLICIA_RURAL: Querellas civiles, linderos rurales y problemas de convivencia en el corregimiento de Yariguíes y zonas rurales aledañas.
  - SUB_VICTIMAS: Atención a población víctima del conflicto armado, subsidios y reparación de víctimas.
  - SUB_SISBEN: Encuestas, puntajes, actualizaciones de ficha del Sisbén, traslados.
  - SUB_RIESGOS_GRD: Gestión del riesgo de desastres, inundaciones, vendavales, incendios forestales, derrumbes en vías.
  - SUB_PROGRAMAS: Programas sociales nacionales y locales (Adulto Mayor, Familias en Acción, Renta Ciudadana).
  - SUB_HACIENDA_YARIGUIES: Oficina recaudadora local en el corregimiento de Yariguíes.

  Reglas de Enrutamiento Clave:
  1. Si se menciona explícitamente "Yariguíes" y el tema es convivencia o querellas, el destino es SUB_INSPECCION_POLICIA_RURAL.
  2. Si se menciona alcantarillado, alumbrado, vías, postes o agua, el destino principal es SEC_PLANEACION.
  3. Si se trata de Sisbén, el destino es SUB_SISBEN.

  Genera etiquetas semánticas cortas (ej. 'agua', 'vias-rurales', 'alumbrado', 'zona-rural', 'adulto-mayor', 'seguridad') y un resumen ejecutivo claro y conciso de máximo 2 líneas.
`;

export const CLASSIFIER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    dependenciaSugerida: {
      type: 'STRING',
      enum: [
        'VENTANILLA_UNICA',
        'DESPACHO_ALCALDE',
        'SEC_GOBIERNO',
        'SEC_PLANEACION',
        'SEC_DESARROLLO_SOCIAL',
        'SEC_HACIENDA',
        'SEC_AGRICULTURA_UMATA',
        'SUB_COMISARIA',
        'SUB_INSPECCION_POLICIA_URBANA',
        'SUB_INSPECCION_POLICIA_RURAL',
        'SUB_VICTIMAS',
        'SUB_SISBEN',
        'SUB_RIESGOS_GRD',
        'SUB_PROGRAMAS',
        'SUB_HACIENDA_YARIGUIES',
      ],
    },
    confianzaClasificacion: {
      type: 'NUMBER',
      description: 'Nivel de confianza en la clasificación entre 0.0 y 1.0',
    },
    etiquetasSemanticas: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Etiquetas semánticas relevantes extraídas del caso en minúsculas y separadas por guión medio.',
    },
    resumenEjecutivo: {
      type: 'STRING',
      description: 'Resumen ejecutivo extremadamente conciso de máximo 2 líneas para el funcionario.',
    },
  },
  required: [
    'dependenciaSugerida',
    'confianzaClasificacion',
    'etiquetasSemanticas',
    'resumenEjecutivo',
  ],
};
