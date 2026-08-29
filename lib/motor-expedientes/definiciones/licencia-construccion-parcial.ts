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
      /* Sin `ayuda` NI línea de contexto: con las etiquetas nuevas la pregunta
         se explica sola, y el texto viejo —«Marque "Sí" si quien radica…»—
         hablaba de unos botones Sí/No que ya no existen. */
      pregunta: '¿Quién presenta la solicitud?',
      opciones: {
        no: {
          etiqueta: 'El titular del predio',
          resumen: 'Titular directo — no se exige poder',
        },
        si: {
          etiqueta: 'Un apoderado',
          consecuencia: 'exigirá poder + cédula',
          resumen: 'Apoderado — se exigirá poder y cédula',
        },
      },
    },
    {
      nombre: 'categoriaComplejidad',
      tipo: 'string',
      dominio: ['BAJA', 'MEDIA', 'ALTA'],
      pregunta: 'Categoría de complejidad de la obra',
      /* Línea corta SIEMPRE visible: es contexto, no una consecuencia futura. */
      efecto: 'Solo decide qué planos técnicos se exigen — no cambia el plazo legal.',
      ayudaEnlace: '¿Cómo se clasifica?',
      ayuda:
        'Clasificación técnica del proyecto en Baja, Media o Alta complejidad. No determina el ' +
        'plazo legal de respuesta (los plazos diferenciados fueron derogados, D.1783/2021 art. 37) ' +
        '— aquí solo decide qué planos técnicos se exigen en el checklist.',
      /* La escala CONSERVA su orden natural. La regla de «lo que no añade
         requisitos primero» se aplica a las preguntas de dos opciones, donde
         orienta; en una escala, romperla —Alta, Baja, Media— confundiría más de
         lo que ordena. Coincide con la maqueta. */
      opciones: {
        porValor: {
          BAJA: {
            etiqueta: 'Baja',
            consecuencia: 'planos firmados',
            resumen: 'Baja — planos hidráulicos, sanitarios y estructurales firmados',
          },
          MEDIA: {
            etiqueta: 'Media',
            consecuencia: 'planos firmados',
            resumen: 'Media — planos hidráulicos, sanitarios y estructurales firmados',
          },
          ALTA: {
            etiqueta: 'Alta',
            resumen: 'Alta — sin planos adicionales por esta vía',
          },
        },
      },
    },
    {
      nombre: 'sujetoTituloENSR10',
      tipo: 'boolean',
      pregunta: '¿Vivienda de 1 o 2 pisos con procedimiento simplificado?',
      efecto: 'Título E de la norma sismo resistente (NSR-10).',
      ayudaEnlace: '¿Qué es el Título E?',
      ayuda:
        'El Título E permite un procedimiento simplificado para viviendas de uno y dos pisos que ' +
        'cumplan ciertas condiciones. Si el proyecto no se acoge, debe sustentarse con estudio de ' +
        'suelos y geotécnico completo, con memorias de cálculo estructural (Título H).',
      /* «Sí, se acoge» primero: es la que NO añade requisitos. */
      opciones: {
        si: {
          etiqueta: 'Sí, se acoge',
          resumen: 'Se acoge al Título E — procedimiento simplificado',
        },
        no: {
          etiqueta: 'No',
          consecuencia: 'exigirá estudio de suelos',
          resumen: 'No se acoge — se exigirá estudio de suelos y geotécnico',
        },
      },
    },
    {
      nombre: 'predioRodeadoEspacioPublico',
      tipo: 'boolean',
      /* OJO: la pregunta va en POSITIVO —«¿tiene colindantes?»— pero la clave
         sigue siendo `predioRodeadoEspacioPublico`, así que las etiquetas van
         CRUZADAS: «Sí, tiene» es el valor `false`. Se deja escrito porque es
         justo donde alguien invertiría el valor por descuido. */
      pregunta: '¿El predio tiene predios colindantes?',
      ayudaEnlace: '¿Qué cuenta como colindante?',
      ayuda:
        'Se refiere a que el lote no tenga predios vecinos porque todo su perímetro linda con ' +
        'espacio público (vías, parques, zonas verdes). Si el predio sí tiene colindantes, se ' +
        'exigirá la relación de direcciones de los predios colindantes y el acta de colindancia.',
      opciones: {
        si: {
          etiqueta: 'No — rodeado de espacio público',
          resumen: 'Sin colindantes — rodeado de espacio público',
        },
        no: {
          etiqueta: 'Sí, tiene',
          consecuencia: 'exigirá acta de colindancia',
          resumen: 'Con colindantes — se exigirá acta de colindancia',
        },
      },
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
