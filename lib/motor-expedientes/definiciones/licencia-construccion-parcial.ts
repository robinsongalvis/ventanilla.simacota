/**
 * Definición de Trámite sembrada — Licencia de Construcción, modalidad
 * Obra Nueva — Bloque A·A2.
 *
 * CONTENIDO COMPLETO (11-ago-2026). Transcribe los 19 requisitos de las
 * DOS páginas del formato oficial de la Alcaldía de Simacota
 * (`F-PGD-009`, versión 02, aprobado el 15-01-2024), aportado por el
 * propietario y archivado en `docs/blueprints/`. Cubre la precondición #2
 * del ADR-0026.
 *
 * Nota de historia, para que nadie la reintroduzca: hasta hoy esta
 * constante se anunciaba como "PARCIAL (página 1 de 2)" y la pantalla lo
 * repetía al funcionario. Era FALSO desde antes: los 6 requisitos de la
 * página 2 (proyecto arquitectónico, disponibilidad de servicios
 * públicos, matrícula y experiencia profesional, memorial de
 * responsabilidad, valla de citación y expensas) ya estaban sembrados y
 * verificados uno a uno contra el PDF oficial — lo que faltó fue retirar
 * la marca cuando llegaron. El nombre del símbolo conserva el sufijo
 * `_PARCIAL` por compatibilidad con sus 13 consumidores; ya no describe
 * el contenido.
 *
 * Se mantiene la regla de gobierno del bloque: nunca se inventan
 * requisitos que el formato oficial no liste.
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
  descripcion: 'Checklist COMPLETO — formato oficial F-PGD-009 v02 (15-01-2024) de la Alcaldía de Simacota, páginas 1 y 2.',
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
  /**
   * `pregunta` / `ayuda` / `efecto` de las 4 claves siguientes son
   * REDACCIÓN PROVISIONAL del equipo de desarrollo — sustituyen la etiqueta
   * técnica que hoy deriva el panel (`prettyClave` en
   * `app/interno/licencias/components/PanelHechosCaso.tsx`, p. ej.
   * "Sujeto Titulo ENSR10") por lenguaje dirigido al funcionario, pero NO
   * son concepto de Planeación. Cada texto está derivado de lo que el
   * propio requisito activado dice en su `descripcion` (ver más abajo en
   * este archivo) — no se inventó ningún efecto que el blueprint
   * (`docs/blueprints/requisitos-licencia-construccion-obra-nueva.md`) no
   * declare. PENDIENTES de validación por el ingeniero de Planeación: si
   * él los corrige, se edita SOLO el texto — ninguna condición ni
   * requisito depende de `pregunta`/`ayuda`/`efecto` (son puramente
   * informativos, no evaluables).
   *
   * Caso `categoriaComplejidad`: los plazos legales diferenciados por
   * categoría de complejidad fueron DEROGADOS (D.1783/2021 art. 37, ver
   * `docs/planes/INVESTIGACION_NORMATIVA_LICENCIAS.md`). Esta clave NO se
   * usa aquí para plazos — solo para decidir qué planos técnicos exige el
   * requisito #12 (`planos-hidraulicos-sanitarios-estructurales`), uso que
   * el blueprint sí sustenta. Punto A CONFIRMAR con el ingeniero: ¿la
   * categoría Baja/Media/Alta sigue siendo un criterio vigente para
   * clasificar la complejidad técnica de la obra, o también quedó sin
   * base tras la derogatoria de plazos?
   *
   * Caso `sujetoTituloENSR10`: el requisito #13 que activa
   * (`estudio-suelos-geotecnico`) dice literalmente "proyectos NO sujetos
   * al Título E de la NSR-10" (mismo texto en el blueprint, fila 13) — es
   * el Título E (procedimiento simplificado para vivienda de uno y dos
   * pisos), no el Título H. La `ayuda` redactada menciona el Título H
   * (Estudios Geotécnicos de la NSR-10) SOLO como la parte del reglamento
   * que regula el contenido del estudio exigido — no como el título al
   * que se refiere `sujetoTituloENSR10`, que sigue siendo el E. Punto A
   * CONFIRMAR con el ingeniero: que esta lectura (Título E = vía
   * simplificada que exime del estudio; fuera de esa vía = estudio
   * geotécnico completo) sea la interpretación correcta del requisito.
   */
  clavesContexto: [
    {
      nombre: 'esApoderado',
      tipo: 'boolean',
      pregunta: '¿La solicitud la presenta un apoderado o autorizado, en representación del titular?',
      ayuda: 'Marque "Sí" si quien radica la solicitud no es el propietario o titular del predio, sino una persona que actúa en su nombre mediante poder o autorización escrita.',
      efecto: 'Si responde "Sí", se exigirá el poder o autorización del apoderado, con presentación personal de quien lo otorga y copia de la cédula del apoderado.',
    },
    {
      nombre: 'categoriaComplejidad',
      tipo: 'string',
      dominio: ['BAJA', 'MEDIA', 'ALTA'],
      pregunta: '¿Cuál es la categoría de complejidad de la obra?',
      ayuda: 'Clasificación técnica del proyecto en Baja, Media o Alta complejidad. No determina el plazo legal de respuesta (los plazos diferenciados por categoría de complejidad fueron derogados, D.1783/2021 art. 37) — aquí solo decide qué planos técnicos se exigen en el checklist.',
      efecto: 'Si la categoría es "Baja" o "Media", se exigirán los planos hidráulicos, sanitarios y estructurales firmados por Ingeniero Civil.',
    },
    {
      nombre: 'sujetoTituloENSR10',
      tipo: 'boolean',
      // La pregunta abre con lo que el funcionario reconoce a simple vista
      // (vivienda de uno o dos pisos) y deja la referencia normativa al
      // final: quien llena el formulario sabe cuántos pisos tiene la obra,
      // no si "está sujeta al Título E".
      pregunta: '¿Es una vivienda de uno o dos pisos que se acoge al procedimiento simplificado (Título E de la NSR-10)?',
      ayuda: 'El Título E del Reglamento Colombiano de Construcción Sismo Resistente (NSR-10) define un procedimiento simplificado para viviendas de uno y dos pisos que cumplan ciertas condiciones. Si el proyecto NO se acoge a ese procedimiento simplificado, debe sustentarse con un estudio de suelos y geotécnico completo, cuyo contenido regula el Título H (Estudios Geotécnicos) de la misma norma.',
      efecto: 'Si responde "No" (el proyecto no está sujeto al Título E), se exigirá el estudio de suelos y geotécnico, con memorias de cálculo estructural.',
    },
    {
      nombre: 'predioRodeadoEspacioPublico',
      tipo: 'boolean',
      pregunta: '¿El predio está completamente rodeado por espacio público (vías, parques, zonas verdes)?',
      ayuda: 'Se refiere a que el lote no tenga predios colindantes porque todo su perímetro linda con espacio público. La norma también exime de este requisito a los predios en zona rural no suburbana, pero esa condición no está disponible todavía en este formulario.',
      efecto: 'Si responde "No" (el predio sí tiene colindantes), se exigirá la relación de direcciones de los predios colindantes y el acta de colindancia.',
    },
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
