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
  /** Ids de versiones de documento (D7) que satisfacen este requisito. Vacío si no está APORTADO. */
  documentoIds: string[];
}

/**
 * Expediente digital único (D3) — un documento raíz por trámite, enlazado
 * bidireccionalmente con el radicado tras el handoff a Ventanilla (D2).
 * `radicadoId` es `null` hasta que ocurre ese handoff (Fase 2).
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
