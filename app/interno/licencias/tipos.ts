/**
 * Tipos de UI del módulo Licencias Urbanísticas — Fase 2 (arranque, Tarea 5).
 *
 * SOLO tipos de presentación. El contrato de dominio real (`Expediente`,
 * `Actuacion`, `PoliticaTermino`) vive en `lib/motor-expedientes/*` y NO se
 * reabre aquí — este archivo describe cómo se VE una fila de la bandeja o
 * el detalle, no cómo se calcula (eso lo hace `fixtures.ts` llamando a las
 * funciones reales de `lib/`).
 *
 * `EstadoLicenciaUI` es deliberadamente MÁS ANGOSTO que `EstadoExpediente`
 * (`lib/motor-expedientes/tipos.ts`): es el estado que el semáforo de esta
 * pantalla necesita mostrar, no la máquina de estados del motor (esa la
 * define Fase 3 con el especialista de datos). Fase 1 no tiene colección
 * Firestore para expedientes de licencias todavía — estos tipos describen
 * los FIXTURES locales que alimentan la bandeja y el detalle hasta que esa
 * colección exista.
 */

export type EstadoLicenciaUI =
  | 'EN_TERMINO'
  | 'POR_VENCER'
  | 'VENCIDO'
  | 'ASIGNADO'
  | 'TERMINADO'
  | 'HISTORICO';

/** Fila de la Bandeja de Licencias (Pantalla 01). */
export interface FilaLicencia {
  /** Slug de ruta — `/interno/licencias/{id}`. */
  id: string;
  numeroExpediente: string;
  radicadoOrigen: string;
  solicitante: string;
  /** Modalidades combinadas tal cual las declaró el trámite, p. ej. "LC, PH". */
  modalidad: string;
  estado: EstadoLicenciaUI;
  /** `null` para HISTÓRICO (no hay cómputo de término, R9) o cuando el
   *  expediente no tiene evento de anclaje todavía. */
  vence: Date | null;
  /** Días hábiles restantes al momento de construir la fila (negativo si venció). Solo informativo para REAL. */
  diasRestantes: number | null;
  /** `true` cuando REINICIO_A_CERO y SUSPENSION_REANUDACION divergen para este expediente — ver `AvisoPoliticaSubsanacion`. */
  politicaAmbigua: boolean;
  origen: 'REAL' | 'RECONSTRUIDO';
  /** Solo para HISTÓRICO con colisión de numeración (R9, migración) — nunca se renumera. */
  colision?: {
    /** Texto corto visible junto al número, p. ej. "(2 solicitantes · colisión)". */
    nota: string;
    /** Segundo solicitante real que comparte el número (el primero ya está en `solicitante`). */
    segundoSolicitante: string;
    /** Explicación completa — usada como `title`/accesible, no se imprime siempre en pantalla. */
    detalle: string;
  };
  /** Solo para TERMINADO — fecha del acto que cerró el expediente, mostrada en vez del vencimiento. */
  resueltoEn?: Date;
}

/** Evento mostrado en `EventoTimeline` (Pantalla 02, panel historial). */
export interface EventoTimelineItem {
  /** `COMUNICACION` (Bloque A·A4/A5): constancia o aviso de acta enviados al ciudadano — tono INFORMATIVO, nunca el verde de éxito de `RADICACION`. */
  tipo: 'RADICACION' | 'ACTA' | 'SUBSANACION' | 'VENCIMIENTO_CALCULADO' | 'COMUNICACION' | 'APERTURA' | 'COMPLETITUD';
  /** En lenguaje de persona: «Se abrió el expediente», no `apertura-expediente`. */
  titulo: string;
  meta: string;
  /**
   * ISO del INSTANTE del hecho — la clave con la que se ordena el historial.
   *
   * Existe porque ordenar por `meta` era ordenar por una fecha YA FORMATEADA
   * (`dd/mm/yyyy`): con día de precisión, dos hechos del mismo día quedaban en
   * el orden en que se armó la lista, y entre meses distintos el orden salía
   * al revés —«01/09» va antes que «29/08» como texto, y después como
   * calendario—. Ausente en la proyección de vencimiento, que no es un hecho
   * ocurrido y se añade al final a propósito.
   */
  ocurrioEn?: string;
  /** Fecha y hora en que ocurrió, ya formateadas para leer. */
  cuando?: string;
  /** Quién lo hizo. Capturado en servidor, nunca lo que mande el cliente. */
  quien?: string;
  /**
   * Lo que importa del hecho, en una línea: el número emitido, desde cuándo
   * corre el plazo. Compuesto de campos, NUNCA parseando la prosa del `detalle`.
   */
  resumen?: string;
  /**
   * La jerga —handoff D2, esPrueba, R10, slugs— tal cual la escribió el
   * servidor. Va PLEGADA tras «ⓘ Detalle técnico»: el auditor la encuentra, el
   * funcionario no tropieza con ella.
   */
  detalleTecnico?: string;
}

/** Detalle completo de un expediente (Pantalla 02). */
export interface DetalleLicencia {
  fila: FilaLicencia;
  predio: string;
  /** Tags de subtipo, p. ej. "LC · Construcción". */
  subtipos: string[];
  timeline: EventoTimelineItem[];
  /** Ausente para RECONSTRUIDO — no hay término que proyectar (R9/D5). */
  proyeccion?: {
    plazoDias: number;
    eventos: import('@/lib/motor-expedientes/termino').EventoTermino[];
    /** Fecha usada por el panel principal (la más próxima de las dos políticas — ver `fixtures.ts`). */
    vigente: Date;
    diasRestantes: number;
    ancla: Date;
  };
}
