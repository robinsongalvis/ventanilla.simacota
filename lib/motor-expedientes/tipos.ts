/**
 * Motor genérico de expedientes administrativos — Fase 0 (cimientos).
 *
 * Fuente de decisión: `docs/adr/0026-motor-generico-expedientes-administrativos.md`
 * (D1-D9) y `docs/planes/PLAN_FASES_MOTOR_EXPEDIENTES.md` (Fase 0). Este
 * archivo define SOLO los tipos que la lógica pura de esta fase necesita
 * (evaluador de completitud, reloj de subsanación). NO es el esquema
 * definitivo de Firestore: la colección `expedientes` y sus subcolecciones
 * (documentos, actuaciones, observaciones) se diseñan en la Fase 1 con
 * revisión cruzada del Especialista de Firestore y Seguridad (D3, D7, D8).
 * En particular, `EstadoExpediente` es un contrato MÍNIMO para esta fase,
 * no la máquina de estados final del panel (Fase 3 añade, por ejemplo, el
 * semáforo con estado SUSPENDIDO ya reflejado aquí porque el ADR lo cita
 * explícitamente, pero el resto del enum puede ampliarse en Fase 1/2).
 *
 * D1 (alcance honesto): estos tipos cubren la fase de INTAKE, que es la
 * parte genérica del motor. La fase de resolución (Fase 4) es específica
 * por trámite y se modela en código aparte cuando llegue esa fase.
 */

import type { UnidadTermino } from '@/lib/tiempos-radicado';

/* ──────────────────────────────────────────────
   Términos y régimen de subsanación (D5)
────────────────────────────────────────────── */

/** Término administrativo simple: `{dias, unidad}`, reutilizando la unidad ya estandarizada en `lib/tiempos-radicado.ts`. */
export interface TerminoLegal {
  dias: number;
  unidad: UnidadTermino;
}

/**
 * Unidad de plazo del régimen de subsanación. Extiende `UnidadTermino` con
 * `'MESES'` porque el régimen de Ley 1755 usa "1 mes calendario" con la
 * semántica del Código Civil art. 67 (ver `sumarMesCalendario` en
 * `lib/tiempos-radicado.ts`), que NO equivale a "30 días calendario". Sin
 * esta unidad separada, el reloj de subsanación no podría representar fielmente
 * ambos regímenes reales (Decreto 1077: 30 hábiles; Ley 1755: 1 mes) desde
 * el mismo modelo de datos.
 */
export type UnidadPlazoSubsanacion = UnidadTermino | 'MESES';

/**
 * Régimen de subsanación parametrizado (D5). El MISMO motor debe poder
 * representar, solo con datos distintos:
 *  - Licencia de Construcción (Decreto 1077): 30 días hábiles + prórroga de
 *    15 días hábiles.
 *  - Derecho de petición (Ley 1755 art. 17): 1 mes calendario + prórroga de
 *    1 mes calendario, con ventana de 10 días hábiles desde la radicación
 *    para emitir el requerimiento.
 *
 * `prorrogaDias` comparte la `unidad` del plazo principal (así lo expresan
 * ambos regímenes reales: la prórroga de Ley 1755 es "un término igual" y la
 * de Licencia es la misma unidad, hábiles, con otra magnitud).
 */
export interface RegimenSubsanacion {
  dias: number;
  unidad: UnidadPlazoSubsanacion;
  prorrogaDias: number;
  /** Ventana máxima, contada desde la radicación, para que el requerimiento de subsanación sea válido. */
  ventanaRequerimiento: {
    dias: number;
    unidad: UnidadPlazoSubsanacion;
  };
}

/* ──────────────────────────────────────────────
   Checklist condicional (D4)
────────────────────────────────────────────── */

export type TipoRequisito = 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL';

/**
 * Hechos del caso concreto contra los que se evalúan las condiciones de los
 * requisitos condicionales. Es un mapa abierto (clave → valor primitivo)
 * a propósito: cada Definición de Trámite declara sus propias claves como
 * DATO (p. ej. `esApoderado`, `categoriaComplejidad`, `sujetoTituloENSR10`,
 * `predioRodeadoEspacioPublico`, `tipoPersona`), de modo que un trámite
 * nuevo pueda definir condiciones nuevas sin tocar código (D4: "crear un
 * documento, sin desplegar").
 */
export type ContextoEvaluacionRequisito = Record<string, string | number | boolean>;

/**
 * Condición evaluable de un requisito CONDICIONAL, modelada como DATO
 * estructurado (árbol de expresión booleana pequeño), no como código. Cubre
 * los casos reales del checklist de Licencia de Construcción
 * (`docs/blueprints/requisitos-licencia-construccion-obra-nueva.md`):
 *  - "solo si hay apoderado"                → IGUAL esApoderado=true
 *  - "categorías Baja y Media Complejidad"  → EN categoriaComplejidad=[BAJA,MEDIA]
 *  - "NO sujeto a Título E NSR-10"          → IGUAL sujetoTituloENSR10=false
 *  - "salvo predio rodeado de espacio público" → IGUAL predioRodeadoEspacioPublico=false
 * `Y` / `O` / `NO` componen estas condiciones CATEGÓRICAS entre sí sin código
 * nuevo. Frontera de expresividad conocida (ADR-0026 §A1): el DSL es sólo
 * categórico — umbrales numéricos/ordinales (área, nº de pisos, valor de obra),
 * requisitos alternativos "N-de-M" y condiciones sobre aportes NO son
 * expresables por dato y requieren ampliar la unión por ADR, no de forma
 * implícita.
 */
export type CondicionRequisito =
  | { operador: 'IGUAL'; clave: string; valor: string | number | boolean }
  | { operador: 'DISTINTO'; clave: string; valor: string | number | boolean }
  | { operador: 'EN'; clave: string; valores: Array<string | number | boolean> }
  | { operador: 'Y'; condiciones: CondicionRequisito[] }
  | { operador: 'O'; condiciones: CondicionRequisito[] }
  | { operador: 'NO'; condicion: CondicionRequisito };

/* ──────────────────────────────────────────────
   Catálogo de claves de contexto (Fase 1, ADR-0026 §A2 #4)
────────────────────────────────────────────── */

/** Tipo primitivo declarado para una clave de contexto. Refleja los tipos que ya admite `ContextoEvaluacionRequisito`. */
export type TipoClaveContexto = 'string' | 'number' | 'boolean';

/**
 * Declaración de UNA clave de contexto que una Definición de Trámite puede
 * referenciar en las condiciones de sus requisitos CONDICIONALES. Es
 * ESTRUCTURA genérica del motor — cada Definición concreta (Licencia,
 * Concepto de Uso del Suelo, cualquier trámite futuro) llena este catálogo
 * con SUS propias claves; el motor no conoce ni asume ninguna clave
 * particular.
 *
 * Cierra la deuda #4 de ADR-0026 §A2 (H del ultrareview de #146): hoy un
 * typo en la clave de una condición (`'esApodrado'` en vez de
 * `'esApoderado'`) no falla en ningún sitio — `evaluarCondicion` lo trata
 * como INDETERMINADO (fail-closed, correcto en tiempo de EVALUACIÓN), pero
 * es indistinguible de un hecho legítimamente ausente del caso concreto.
 * `validarDefinicionTramite` (`./validar-definicion.ts`) usa este catálogo
 * para rechazar, en el momento de PUBLICAR la Definición, cualquier
 * condición que referencie una clave no declarada.
 */
export interface ClaveContextoDeclarada {
  /** Nombre de la clave tal como aparece en `ContextoEvaluacionRequisito` y en `CondicionRequisito.clave`. */
  nombre: string;
  tipo: TipoClaveContexto;
  /** Dominio cerrado de valores permitidos (opcional). Si se omite, cualquier valor del `tipo` declarado es válido. */
  dominio?: Array<string | number | boolean>;
}

interface RequisitoBase {
  /** Slug estable del requisito dentro de su Definición de Trámite (p. ej. `poder-apoderado`). */
  id: string;
  nombre: string;
  descripcion?: string;
}

export interface RequisitoObligatorio extends RequisitoBase {
  tipo: 'OBLIGATORIO';
}

export interface RequisitoOpcional extends RequisitoBase {
  tipo: 'OPCIONAL';
}

export interface RequisitoCondicional extends RequisitoBase {
  tipo: 'CONDICIONAL';
  /** Regla evaluable que decide si este requisito aplica al caso concreto. */
  condicion: CondicionRequisito;
}

/**
 * Unión discriminada por `tipo`: el compilador exige `condicion` únicamente
 * cuando `tipo === 'CONDICIONAL'`, y la prohíbe en los otros dos casos.
 */
export type RequisitoDefinicion = RequisitoObligatorio | RequisitoOpcional | RequisitoCondicional;

/* ──────────────────────────────────────────────
   Definición de Trámite (D4, D9)
────────────────────────────────────────────── */

/**
 * Documento parametrizable (Firestore, Fase 1) que declara un trámite del
 * motor. Es el punto de extensión central de D9: un trámite nuevo de
 * intake, o una Secretaría nueva, se habilita creando una Definición — sin
 * tocar el núcleo del motor.
 */
export interface DefinicionTramite {
  /** Slug estable, p. ej. `licencia-construccion-obra-nueva`. */
  id: string;
  nombre: string;
  descripcion?: string;
  /** Solo las Definiciones activas pueden recibir expedientes nuevos. */
  activo: boolean;
  requisitos: RequisitoDefinicion[];
  /** Término administrativo principal (arranca en la radicación — D5). */
  terminos: TerminoLegal;
  regimenSubsanacion: RegimenSubsanacion;
  /** D1: puntos de variación parametrizados por datos sobre el esqueleto de estados en código. */
  requiereVisita: boolean;
  generaResolucion: boolean;
  /**
   * Catálogo de claves de contexto que esta Definición declara y que sus
   * requisitos CONDICIONALES pueden referenciar (Fase 1, ADR-0026 §A2 #4).
   * OPCIONAL a propósito: campo ADITIVO — ninguna Definición ni fixture de
   * Fase 0 existente deja de tipar por su ausencia. Una Definición SIN este
   * catálogo simplemente no tiene ninguna clave declarada, por lo que
   * `validarDefinicionTramite` rechazará cualquier condición que referencie
   * una clave (fail-closed) hasta que se declare — el catálogo vacío/ausente
   * nunca se interpreta como "todo vale".
   */
  clavesContexto?: ClaveContextoDeclarada[];
  /**
   * Subtipos declarados por esta Definición (Fase 2, arranque PASO 7) —
   * p. ej. Licencia de Construcción tiene subtipos "Obra Nueva",
   * "Ampliación", "Modificación"... OPCIONAL y ADITIVO, mismo patrón que
   * `clavesContexto`: una Definición sin este campo simplemente no tiene
   * subtipos declarados, y `Expediente.subtipos` que referencien códigos
   * no declarados aquí se rechazan (fail-closed) en
   * `validarDefinicionTramite` — nunca "todo vale" por ausencia.
   */
  subtipos?: SubtipoTramite[];
}

/** Un subtipo de trámite declarado por una `DefinicionTramite` (Fase 2, PASO 7). */
export interface SubtipoTramite {
  /** Código estable, único DENTRO de la Definición (p. ej. `obra-nueva`). */
  codigo: string;
  nombre: string;
  descripcion?: string;
}

/* ──────────────────────────────────────────────
   Expediente (D2, D3) — contrato mínimo de Fase 0
────────────────────────────────────────────── */

/**
 * NOTA (ver cabecera del archivo): enum mínimo para la lógica pura de esta
 * fase. El diseño final de la máquina de estados es tarea de Fase 1/3 con
 * revisión cruzada de datos y seguridad.
 */
export type EstadoExpediente =
  | 'EN_REVISION'
  | 'SUBSANACION'
  | 'COMPLETO'
  | 'RADICADO'
  | 'SUSPENDIDO'
  | 'ARCHIVADO';

export type EstadoAporteRequisito = 'PENDIENTE' | 'APORTADO' | 'NO_APLICA';

/** Estado de un requisito puntual dentro de un expediente (entrada del evaluador de completitud). */
export interface AporteRequisito {
  requisitoId: string;
  estado: EstadoAporteRequisito;
  /** Ids de versiones de documento (D7) que satisfacen este requisito. Vacío si no está APORTADO. Precisión (addendum A2 aprobado 8-ago): el id referenciado es el del documento LÓGICO (`DocumentoExpedienteDoc.id`, `lib/server/expedientes-documentos-tipos.ts`), no el de una versión — la vigente se resuelve vía `versionVigente`. */
  documentoIds: string[];
}

/**
 * Número de expediente emitido (`lib/motor-expedientes/numero-expediente.ts`
 * + `lib/server/emitir-numero-expediente.ts` — Fase 2 arranque, PASO 4/5).
 */
export interface NumeroExpedienteAsignado {
  /** Número formateado completo, p. ej. `68745-0-26-0020`. */
  numero: string;
  /** Serie del consecutivo que lo emitió (`SerieConsecutivo`, `lib/server/consecutivo-legal.ts`). */
  serieId: string;
  /** Año (4 dígitos) usado para el consecutivo — NO el `AA` de 2 dígitos del número formateado. */
  año: number;
  /** `true` si, al reservar unicidad, el número YA existía (Fase 5: importación reconstruida que choca con uno REAL). */
  colision?: boolean;
}

/**
 * Procedencia de un expediente importado (Fase 5 — migración). Diseño
 * concretado por el importador de históricos (`lib/migracion/
 * planificar-importacion-consecutivo.ts`, primer consumidor real de este
 * tipo — hasta entonces declarado pero sin uso, `filaOrigen` genérico se
 * reemplaza aquí por `hoja`/`fila` explícitos, más precisos para el reporte
 * de dry-run que agrupa cuarentenas por origen).
 */
export interface ProvenanceExpediente {
  /** Sistema/archivo de origen del dato migrado, p. ej. `'xlsx-consecutivo-2022-2026'`. */
  fuente: string;
  /** ISO 8601 — cuándo se ejecutó la importación (no cuándo ocurrió el hecho real). */
  fechaImportacion: string;
  /** SHA-256 del archivo de origen (Excel, PDF...) — procedencia verificable hasta el binario exacto. */
  sha256?: string;
  /** Hoja/pestaña del archivo de origen dentro de la que aparece el registro. */
  hoja?: string;
  /** Número de fila (1-based) dentro de la hoja, tal como en el archivo de origen. */
  fila?: number;
}

/** Acto administrativo que cierra el expediente (resolución de licencia, negación, etc.). */
export interface ActoFinalExpediente {
  numero?: string;
  /** ISO 8601. */
  fecha?: string;
  /**
   * ISO 8601 — fecha de FIRMEZA del acto (CPACA art. 87), DF-6/ADR-0029.
   * Dato obligatorio de cierre para expedientes `origen: 'REAL'`
   * (`validarCierreExpediente`, `./estados-licencia.ts`): desde ella corren
   * las vigencias (D.1077/2015 art. 2.2.6.1.2.4.1) y nace la obligación del
   * reporte mensual ELIC/DANE (art. 2.2.6.1.2.3.12) — el registro histórico
   * de Planeación (0 de 202 expedientes con esta fecha) documenta
   * exactamente la brecha que este campo corrige hacia adelante.
   */
  fechaFirmeza?: string;
  /** Referencia (id de documento/adjunto) a la constancia de notificación del acto (art. 2.2.6.1.2.3.7) — DF-6/ADR-0029. */
  constanciaNotificacionRef?: string;
  /** ISO 8601 — hasta cuándo vale la licencia/permiso otorgado, si aplica. */
  vigenciaHasta?: string;
  /** `true` si el expediente está cerrado pero no se conserva el detalle del acto (p. ej. migración incompleta) — nunca se inventa un valor por default. */
  cierreDesconocido?: boolean;
}

/**
 * Expediente digital único (D3) — un documento raíz por trámite, enlazado
 * bidireccionalmente con el radicado tras el handoff a Ventanilla (D2).
 * `radicadoId` es `null` hasta que ocurre ese handoff (Fase 2).
 *
 * Campos con `?` añadidos en Fase 2 (arranque, PASO 7) — TODOS aditivos y
 * opcionales: ningún `Expediente` ni fixture de Fase 0/1 existente deja de
 * tipar por su ausencia.
 */
export interface Expediente {
  id: string;
  tenantId: string;
  /** Referencia a `DefinicionTramite.id`. */
  tramiteId: string;
  estado: EstadoExpediente;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  /** Hechos del caso usados para evaluar los requisitos condicionales de su Definición de Trámite. */
  contexto: ContextoEvaluacionRequisito;
  aportes: AporteRequisito[];
  radicadoId: string | null;
  creadoEn: string;
  actualizadoEn: string;
  /** Número de expediente emitido — ausente hasta que se emite (PASO 4/5). */
  numeroExpediente?: NumeroExpedienteAsignado;
  /** Códigos de `SubtipoTramite` declarados por la Definición que aplican a este caso concreto. */
  subtipos?: string[];
  /** REAL si el expediente nació en la plataforma; RECONSTRUIDO si viene de migración (D6, Fase 5). Mismo tipo que `Actuacion.origen`. */
  origen?: OrigenActuacion;
  /** Presente solo si `origen === 'RECONSTRUIDO'` (Fase 5, aún sin diseñar). */
  provenance?: ProvenanceExpediente;
  /** Presente solo si el expediente está cerrado. */
  actoFinal?: ActoFinalExpediente;
}

/* ──────────────────────────────────────────────
   Actuación (D6, D8) — trazabilidad append-only
────────────────────────────────────────────── */

/**
 * Distingue un evento REAL (ocurrió en el momento en que se registra) de uno
 * RECONSTRUIDO (D6: migración de un expediente en trámite, reconstruido a
 * partir de su historial físico). Nunca se falsea un reconstruido como real.
 * También es la señal que consume `verificarAvanceCounter`
 * (`lib/server/consecutivo-legal.ts`, D9) para impedir que un consecutivo
 * reconstruido avance el contador vigente de una serie real.
 */
export type OrigenActuacion = 'REAL' | 'RECONSTRUIDO';

export interface Actuacion {
  id: string;
  expedienteId: string;
  /** Slug del tipo de actuación (dato, no enum cerrado en código — permite ampliar el catálogo de intake sin desplegar). */
  tipo: string;
  etapa: string;
  /** Actor capturado en SERVIDOR (D8) — nunca confiar en el valor que envíe el cliente. */
  actorUid: string;
  actorNombre: string;
  actorRol: string;
  /** Timestamp de servidor, ISO 8601. */
  fecha: string;
  origen: OrigenActuacion;
  detalle?: string;
}

/* ──────────────────────────────────────────────
   Observación (subsanación)
────────────────────────────────────────────── */

export interface Observacion {
  id: string;
  expedienteId: string;
  /** Requisito puntual al que aplica, si la observación es específica de uno. */
  requisitoId?: string;
  texto: string;
  creadoEn: string;
  autorUid: string;
  autorNombre: string;
  resuelta: boolean;
}
