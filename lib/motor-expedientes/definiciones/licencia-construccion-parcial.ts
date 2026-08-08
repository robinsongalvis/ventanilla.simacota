/**
 * Definición de Trámite sembrada — Licencia de Construcción, modalidad
 * Obra Nueva — Bloque A·A2.
 *
 * CONTENIDO PARCIAL (pág. 1/2) — el checklist oficial completo es
 * precondición #2 del ADR-0026, pendiente de Planeación. Esta constante
 * transcribe ÚNICAMENTE los 19 requisitos de
 * `docs/blueprints/requisitos-licencia-construccion-obra-nueva.md`
 * ("Página 1 de 2" — el propio documento declara que falta la página 2).
 * Al llegar esa página, esta constante se completa como DATO — nunca se
 * inventan requisitos que el blueprint no liste (regla de gobierno de
 * este bloque).
 *
 * `terminos` (45 días hábiles) y el eje `dias`/`prorrogaDias` de
 * `regimenSubsanacion` (30 hábiles + 15 de prórroga) están confirmados
 * por norma (D.1077/2015 art. 2.2.6.1.2.3.1 inc. 1; art. 2.2.6.1.2.2.4).
 * `regimenSubsanacion.ventanaRequerimiento` sigue siendo PLACEHOLDER
 * técnico (mismo aviso que `__tests__/motor-expedientes-completitud.test.ts`
 * y `__tests__/motor-expedientes-subsanacion-regimen.test.ts`): el
 * Decreto 1077 NO define una ventana de 10 días para el acta de
 * observaciones (el acta opera dentro de la revisión, no como una
 * ventana posterior) — NO copiar como valor ratificado.
 *
 * Requisitos #6 y #7 son "Obligatorio" en el blueprint con una VARIANTE
 * según el caso (tipo de persona / existencia de acuerdo de pago) — se
 * transcriben como un único requisito OBLIGATORIO con la variante en la
 * `descripcion`, fieles a como el blueprint los tabula (no se inventa una
 * bifurcación CONDICIONAL que el blueprint no declara como tal).
 *
 * Requisito #16 ("para trámites que así lo requieran") es CONDICIONAL en
 * el blueprint pero su condición NO es expresable con el DSL categórico
 * actual (ADR-0026 §A1) ni con las 4 `clavesContexto` declaradas aquí —
 * se registra como OPCIONAL (no bloquea completitud) en vez de inventar
 * una clave/condición que el blueprint no define; se corrige cuando
 * Planeación precise la regla (página 2 o P9 del ADR-0029).
 */

import type { DefinicionTramite } from '../tipos';

export const DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL: DefinicionTramite = {
  id: 'licencia-construccion-obra-nueva',
  nombre: 'Licencia de Construcción · Obra Nueva',
  descripcion: 'Checklist PARCIAL (página 1 de 2) — docs/blueprints/requisitos-licencia-construccion-obra-nueva.md',
  activo: true,
  terminos: { dias: 45, unidad: 'HABILES' },
  regimenSubsanacion: {
    dias: 30,
    unidad: 'HABILES',
    prorrogaDias: 15,
    // PLACEHOLDER — ver JSDoc de cabecera. NO copiar como semilla real.
    ventanaRequerimiento: { dias: 10, unidad: 'HABILES' },
  },
  requiereVisita: true,
  generaResolucion: true,
  clavesContexto: [
    { nombre: 'esApoderado', tipo: 'boolean' },
    { nombre: 'categoriaComplejidad', tipo: 'string', dominio: ['BAJA', 'MEDIA', 'ALTA'] },
    { nombre: 'sujetoTituloENSR10', tipo: 'boolean' },
    { nombre: 'predioRodeadoEspacioPublico', tipo: 'boolean' },
  ],
  requisitos: [
    // #1
    {
      id: 'solicitud-escrita-titular',
      nombre: 'Solicitud escrita del titular o apoderado',
      tipo: 'OBLIGATORIO',
      descripcion: 'Incluye copia de cédula, celular y cuadro de áreas.',
    },
    // #2
    {
      id: 'formulario-unico-nacional',
      nombre: 'Formulario Único Nacional de solicitud de licencias',
      tipo: 'OBLIGATORIO',
      descripcion: 'Diligenciado en su totalidad. Adoptado por MinAmbiente/Vivienda.',
    },
    // #3
    {
      id: 'poder-apoderado',
      nombre: 'Poder o autorización del apoderado',
      tipo: 'CONDICIONAL',
      descripcion: 'Incluye presentación personal de quien lo otorga y copia de cédula del apoderado.',
      condicion: { operador: 'IGUAL', clave: 'esApoderado', valor: true },
    },
    // #4
    {
      id: 'certificado-tradicion-libertad',
      nombre: 'Certificado de Tradición y Libertad del inmueble',
      tipo: 'OBLIGATORIO',
      descripcion: 'Vigencia máxima de 30 días antes de la solicitud.',
    },
    // #5
    {
      id: 'escritura-publica-predio',
      nombre: 'Copia de la escritura pública del predio',
      tipo: 'OBLIGATORIO',
    },
    // #6
    {
      id: 'identidad-o-representacion-legal',
      nombre: 'Documento de identidad o certificado de existencia y representación legal',
      tipo: 'OBLIGATORIO',
      descripcion: 'Documento de identidad si persona natural; certificado de existencia y representación legal (vigencia ≤ 1 mes) si persona jurídica.',
    },
    // #7
    {
      id: 'declaracion-impuesto-predial',
      nombre: 'Declaración/impuesto predial del último año',
      tipo: 'OBLIGATORIO',
      descripcion: 'O certificación de acuerdo de pago vigente de Hacienda, si aplica.',
    },
    // #8
    {
      id: 'paz-y-salvo-municipal',
      nombre: 'Paz y salvo municipal del titular/propietario',
      tipo: 'OBLIGATORIO',
    },
    // #9
    {
      id: 'relacion-colindantes',
      nombre: 'Relación de direcciones de predios colindantes',
      tipo: 'CONDICIONAL',
      descripcion: 'En el Formulario Único. Regla completa del blueprint: NO exigible si el predio está rodeado completamente por espacio público O en zona rural no suburbana — solo el primer supuesto es expresable con las clavesContexto declaradas (sin clave para "zona rural no suburbana" en esta fase); el segundo queda como limitación declarada.',
      condicion: { operador: 'IGUAL', clave: 'predioRodeadoEspacioPublico', valor: false },
    },
    // #10
    {
      id: 'acta-colindancia',
      nombre: 'Acta de colindancia de los predios colindantes',
      tipo: 'CONDICIONAL',
      descripcion: 'Ligado al requisito de relación de colindantes (#9, mismo supuesto de exención).',
      condicion: { operador: 'IGUAL', clave: 'predioRodeadoEspacioPublico', valor: false },
    },
    // #11
    {
      id: 'certificacion-redam',
      nombre: 'Certificación REDAM de los propietarios',
      tipo: 'OBLIGATORIO',
      descripcion: 'Registro de Deudores Alimentarios Morosos.',
    },
    // #12
    {
      id: 'planos-hidraulicos-sanitarios-estructurales',
      nombre: 'Planos hidráulicos y sanitarios + planos estructurales firmados',
      tipo: 'CONDICIONAL',
      descripcion: 'Conexión a red matriz; planos estructurales rotulados/firmados por Ingeniero Civil. Para categorías Baja y Media Complejidad.',
      condicion: { operador: 'EN', clave: 'categoriaComplejidad', valores: ['BAJA', 'MEDIA'] },
    },
    // #13
    {
      id: 'estudio-suelos-geotecnico',
      nombre: 'Estudio de suelos y geotécnico',
      tipo: 'CONDICIONAL',
      descripcion: 'Incluye memorias de cálculo estructural. Para proyectos NO sujetos al Título E de la NSR-10.',
      condicion: { operador: 'IGUAL', clave: 'sujetoTituloENSR10', valor: false },
    },
    // #14
    {
      id: 'proyecto-arquitectonico',
      nombre: 'Proyecto arquitectónico impreso, rotulado y firmado',
      tipo: 'OBLIGATORIO',
      descripcion: 'Por arquitecto con matrícula. Contenido mínimo: localización, plantas, alzados/cortes, fachadas, cubiertas con red pluvial, cuadro de áreas, corte con cableado eléctrico/RETIE. 2 copias impresas + digital (art. 2.2.6.1.2.3.5, D.1203/2017; RETIE vigente).',
    },
    // #15
    {
      id: 'disponibilidad-servicios-publicos',
      nombre: 'Certificación de disponibilidad inmediata de servicios públicos',
      tipo: 'OBLIGATORIO',
      descripcion: 'Incluye soporte de acceso directo a vía pública vehicular.',
    },
    // #16 — ver JSDoc de cabecera (condición del blueprint no expresable con el DSL/clavesContexto actuales).
    {
      id: 'matricula-profesional-experiencia',
      nombre: 'Copia de matrícula profesional y certificaciones de experiencia',
      tipo: 'OPCIONAL',
      descripcion: 'Ingeniero Civil y Arquitecto. El blueprint lo marca CONDICIONAL ("para trámites que así lo requieran") sin regla evaluable con las clavesContexto actuales — se registra OPCIONAL hasta precisar la condición (P9/página 2).',
    },
    // #17
    {
      id: 'memorial-responsabilidad-profesionales',
      nombre: 'Memorial de responsabilidad firmado por los profesionales',
      tipo: 'OBLIGATORIO',
    },
    // #18
    {
      id: 'valla-citacion-vecinos',
      nombre: 'Valla de citación a vecinos colindantes',
      tipo: 'OBLIGATORIO',
      descripcion: 'Actuación de publicidad; los vecinos se hacen parte en 5 días hábiles desde la fijación en Planeación.',
    },
    // #19
    {
      id: 'cancelacion-expensas',
      nombre: 'Cancelación de expensas por la licencia',
      tipo: 'OBLIGATORIO',
    },
  ],
};
