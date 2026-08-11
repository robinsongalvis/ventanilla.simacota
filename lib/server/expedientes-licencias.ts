import type { TenantId } from '@/src/types/radicado';
import type { Expediente, Actuacion, ContextoEvaluacionRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import { CATALOGO_FIGURAS_NORMATIVAS } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { puedeTransicionar, type EstadoJuridicoLicencia, type RevisionHistoricaLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { esEstadoCerrado } from '@/lib/radicado-estados';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import { sumarDiasHabiles, diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { debeNotificarCiudadano, type CriterioNotificacion } from '@/lib/email/debe-notificar-ciudadano';
import { PREFIJO_AVISO_ACTA_COMUNICACION } from '@/lib/motor-expedientes/comunicaciones-licencia';
import { calcularVencimientoDual, derivarEventosTermino } from '@/lib/motor-expedientes/termino';

/* ══════════════════════════════════════════════════════════════
   Lógica de DECISIÓN de expedientes de licencias — bloque "Integración UI
   y demo". Funciones PURAS (patrón `lib/server/subsanacion.ts`): reciben
   datos + actor + `ahora` y devuelven un plan (documentos a escribir) o un
   error `{status, mensaje}`. Las rutas (`app/api/licencias/expedientes/…`)
   SOLO orquestan IO/auth — ningún cómputo de negocio vive ahí.
══════════════════════════════════════════════════════════════ */

/**
 * Plazo de DECISIÓN del trámite de licencias — D.1077/2015 art. 2.2.6.1.2.3.1
 * inc. 1: "45 días hábiles" (misma cita ya usada en
 * `estados-licencia.ts` para las transiciones `EN_VIABILIDAD → CONCEDIDA/NEGADA`).
 * Parámetro OBLIGATORIO de `calcularVencimientoDual` (`./termino.ts`, sin
 * default) — este es el DATO que la ruta de licencias le pasa; el motor
 * sigue sin conocer ningún número por defecto.
 */
export const PLAZO_DECISION_LICENCIA_DIAS_HABILES = 45;

/**
 * ⚖️ CANDADO DE EMISIÓN — NO NEGOCIABLE. La serie legal `expedientes`
 * (`lib/server/consecutivo-legal.ts`, D9) NO está sembrada en producción:
 * doctrina R10 pendiente de autorización explícita del propietario
 * (`docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md` §R10 —
 * `counters/expedientes-expedientes-{año}` single-writer global, deuda #13
 * ADR-0026 §A2, sin sembrar ni namespacing decidido).
 *
 * Mientras esta constante sea `false`: NINGUNA ruta ni función de este
 * módulo puede alcanzar `emitirNumeroExpedienteReal`
 * (`lib/server/emitir-numero-expediente.ts`) — toda creación que no sea
 * `esPrueba: true` se rechaza con 422 ANTES de tocar counters o
 * `unicidad_expedientes`. El flujo real ya existe, completo y probado
 * (DF-4/DF-5 arranque, PR #162/#167) — activarlo cuando el propietario
 * autorice la siembra es cambiar ESTA constante (y que la ruta deje de
 * forzar `esPrueba: true`), NUNCA reescribir la lógica de emisión.
 */
export const EMISION_REAL_EXPEDIENTES_HABILITADA = false as const;

export interface ActorExpediente {
  uid: string;
  nombre: string;
  rol: string;
}

export interface ErrorExpediente {
  status: number;
  mensaje: string;
}

export function esErrorExpediente(x: unknown): x is ErrorExpediente {
  return typeof x === 'object' && x !== null && typeof (x as ErrorExpediente).status === 'number';
}

/**
 * Documento Firestore de un expediente de licencias — EXTIENDE el contrato
 * genérico del motor (`Expediente`, `lib/motor-expedientes/tipos.ts`) con
 * lo específico de licencias. Deliberadamente NO se añaden estos campos al
 * `Expediente` genérico: el núcleo del motor debe seguir siendo
 * trámite-agnóstico (D9/A3, ADR-0026) y `EstadoJuridicoLicencia`
 * (`./estados-licencia.ts`) ya es, por diseño, específico de licencias.
 */
export interface ExpedienteLicenciaDoc extends Expediente {
  /** DF-5: estado JURÍDICO del ciclo, convive con `estado` (operativo del panel) sin sustituirlo. */
  estadoJuridico: EstadoJuridicoLicencia;
  /** `true` en TODO expediente creado en esta fase (candado de emisión) — nunca `undefined` en un documento real de esta colección. */
  esPrueba?: boolean;
  /**
   * ESPEJO denormalizado de `calcularVencimientoDual(...).fechaAlertaConservadora`
   * (`lib/motor-expedientes/termino.ts`, ISO 8601) — la fecha MÁS TEMPRANA
   * entre las dos políticas de efecto de subsanación (⚖️ hueco 1 sigue SIN
   * default, ver JSDoc de `VencimientoDual`). La fuente de verdad SIGUE
   * SIENDO la serie de actuaciones del expediente (`derivarEventosTermino`);
   * este campo es una PROYECCIÓN escrita en el documento raíz — nada lo lee
   * para decidir nada, existe únicamente para que la bandeja lo muestre sin
   * pagar una lectura extra.
   *
   * Por qué existe (R11, `app/api/licencias/expedientes/route.ts`): la
   * bandeja lista expedientes sin traer su subcolección `actuaciones` —
   * traerla por expediente sería N+1 (hasta `LIMITE_BANDEJA` lecturas
   * adicionales por carga). Denormalizar esta fecha en el documento raíz le
   * permite a la bandeja mostrarla SIN esa lectura extra; el detalle
   * (`GET .../[id]`) sigue calculándola on-read porque de todos modos ya
   * carga `actuaciones` para otros fines (cómputo, no persistencia).
   *
   * Se recalcula y persiste en la MISMA transacción/batch que escribe la
   * actuación que puede haberla movido — nunca una escritura suelta que
   * pueda desincronizarse del origen real: `planCrearExpedienteDemo`,
   * `planCrearExpedienteDesdeRadicado` y `planRegistrarActuacion` (todos en
   * este módulo) son los ÚNICOS puntos que la calculan, vía el helper
   * privado `calcularFechaAlertaConservadoraMirror`.
   *
   * Ausente (`undefined`): expedientes escritos ANTES de este campo — la UI
   * debe mostrar "—", nunca asumir vigente ni vencido.
   * `null`: expedientes SIN ningún evento de término reconocible en su
   * serie REAL de actuaciones — el caso esperado es un expediente histórico
   * reconstruido (Fase 5, D6) cuyas actuaciones son TODAS
   * `origen: 'RECONSTRUIDO'` y quedan excluidas por R9
   * (`derivarEventosTermino`): un expediente reconstruido no tiene un
   * término legal VIVO que proyectar, así que `null` es el resultado
   * correcto, no un error.
   */
  fechaAlertaConservadora?: string | null;
  /**
   * DF-10 (decisión del propietario, 11-ago-2026): texto EXACTO del campo
   * "estado" del libro histórico de Planeación al momento de migrar —
   * verbatim, ANTES de cualquier normalización o interpretación
   * ("terminado", "REVISADO", "TERMINADA"...). `null` cuando el libro NO
   * traía ningún estado para esa fila (la cohorte 2022-2024) — la ausencia
   * es información y se declara explícitamente, nunca se omite en silencio
   * (mismo principio que `predio`/`DatosPredio`: ausencia declarada, nunca
   * inventada). Ausente (`undefined`) en cualquier expediente que NO
   * provenga de esa migración (`lib/migracion/planificar-importacion-
   * consecutivo.ts`, único escritor de este campo).
   *
   * NUNCA se usa para inferir `estadoJuridico` — es evidencia de
   * procedencia archivística, no un dato operable (ver
   * `RevisionHistoricaLicencia`, `../motor-expedientes/estados-licencia.ts`).
   */
  estadoOriginalHistorico?: string | null;
  /**
   * DF-10: presente en TODO expediente RECONSTRUIDO importado del
   * consecutivo histórico de licencias — ver `RevisionHistoricaLicencia`
   * (`../motor-expedientes/estados-licencia.ts`) para el contrato completo
   * (marca "histórico sin resolver", fail-closed, transición solo
   * explícita vía `completarRevisionHistorica`). Ausente en expedientes que
   * no provienen de esa migración.
   */
  revisionHistorica?: RevisionHistoricaLicencia;
}

/**
 * Documento de una actuación dentro de `expedientes/{id}/actuaciones`.
 * `tenantId` DENORMALIZADO desde el documento raíz, copiado en SERVIDOR —
 * jamás del cliente. Cierra la deuda #6 (ADR-0026 §A2: "`Actuacion`/
 * `Observacion` sin `tenantId`, bloquea `collectionGroup` por tenant") PARA
 * ESTA subcolección específicamente; el tipo genérico `Actuacion` en
 * `tipos.ts` NO se modifica (mismo motivo que `ExpedienteLicenciaDoc`: no
 * acoplar el núcleo a un caso concreto).
 */
export interface ActuacionLicenciaDoc extends Actuacion {
  tenantId: string;
  /**
   * Presente SOLO en actuaciones `tipo: 'comunicacion-enviada'` — el tipo
   * ESTRUCTURADO de la comunicación (p. ej. "Aviso de acta de observaciones
   * y correcciones", "Constancia de radicación en legal y debida forma").
   * Corrección de un hallazgo de revisión cruzada con consecuencia jurídica
   * (10-ago-2026): `'comunicacion-enviada'` es un tipo COMPARTIDO por la
   * constancia (`desde-radicado/route.ts`) y el aviso del acta
   * (`[id]/actuaciones/route.ts`) — antes de este campo, la única forma de
   * distinguirlas era el PREFIJO de texto libre de `detalle`, y nada
   * obligaba a `evaluarPlazoSubsanacion` a mirarlo: tomaba CUALQUIER
   * comunicación posterior al acta, incluida una constancia de OTRO
   * expediente/evento — un escenario real (no teórico) si el aviso del
   * acta falla al enviarse (la UI ya contempla "⚠ Aviso NO enviado") y
   * después sale cualquier otra comunicación. El dato ya llegaba
   * estructurado a `construirActuacionComunicacionEnviada` (`meta.tipoComunicacion`)
   * y se perdía al concatenarlo dentro de `detalle` — este campo lo
   * conserva tal cual, sin tocar `detalle` (compatibilidad con lo ya
   * escrito).
   */
  tipoComunicacion?: string;
}

/**
 * Prefijo que identifica una comunicación como "aviso del acta de
 * observaciones" — fuente de verdad ÚNICA para esa clasificación en el
 * servidor. Vía PRIMARIA de identificación: `ActuacionLicenciaDoc.tipoComunicacion`
 * (arriba) empieza con este prefijo. Vía FALLBACK (actuaciones escritas
 * ANTES de que existiera el campo estructurado): `detalle` empieza con el
 * mismo prefijo.
 *
 * DEUDA SALDADA (10-ago-2026, dev-frontend): la constante vive ahora en
 * `lib/motor-expedientes/comunicaciones-licencia.ts` (módulo PURO, sin
 * dependencias de servidor) y `app/interno/licencias/presentacion-actuaciones.ts`
 * (`tituloComunicacionEnviada`) la importa de ahí directamente en vez de
 * mantener `'Aviso de acta'` duplicado — este módulo la RE-EXPORTA con el
 * mismo nombre para no romper a sus consumidores actuales (las rutas
 * `app/api/licencias/expedientes/...`).
 */
export { PREFIJO_AVISO_ACTA_COMUNICACION };

/**
 * Punto de entrada del camino REAL (fuera de demo) — HOY siempre rechaza
 * con 422 mientras `EMISION_REAL_EXPEDIENTES_HABILITADA` sea `false`. Ni la
 * ruta actual ni ninguna otra función de este módulo llaman a esto todavía
 * (el body de `POST /api/licencias/expedientes` no expone forma de pedir
 * emisión real en esta fase) — existe para que el candado sea una función
 * PROBABLE con dobles, no solo una constante leída a ojo.
 *
 * Cuando se autorice la siembra del contador (R10), una ruta futura
 * orquestaría `emitirNumeroExpedienteReal` (`lib/server/emitir-numero-
 * expediente.ts`, ya completo y probado desde el arranque de Fase 2) DENTRO
 * de su propia transacción tras confirmar aquí que el candado está abierto
 * — se ACTIVA cambiando la constante (y la ruta), no reescribiendo lógica.
 *
 * `habilitado` es inyectable (default = la constante real del módulo)
 * exclusivamente para que los tests ejerciten la rama "candado abierto"
 * sin mutar `EMISION_REAL_EXPEDIENTES_HABILITADA` en producción.
 */
export function evaluarCandadoEmisionReal(
  habilitado: boolean = EMISION_REAL_EXPEDIENTES_HABILITADA,
): ErrorExpediente | { candadoAbierto: true } {
  if (!habilitado) {
    return {
      status: 422,
      mensaje: 'La emisión real de expedientes de licencias está bloqueada hasta que se autorice la siembra del contador de la serie "expedientes" (doctrina R10, pendiente del propietario). En esta fase solo se admiten expedientes de demostración.',
    };
  }
  return { candadoAbierto: true };
}

/**
 * Punto ÚNICO donde este módulo invoca `derivarEventosTermino` +
 * `calcularVencimientoDual` para obtener el valor a escribir en
 * `ExpedienteLicenciaDoc.fechaAlertaConservadora` (ver su JSDoc para el
 * contrato completo). Reutilizado por los 3 caminos que crean o mutan la
 * serie de actuaciones relevante para el término —
 * `planCrearExpedienteDemo`, `planCrearExpedienteDesdeRadicado` y
 * `planRegistrarActuacion` — así el cómputo nunca diverge entre ellos ni se
 * reimplementa (R11, requisito 5 del bloque).
 *
 * `actuaciones` debe ser la serie COMPLETA vigente tras la escritura que se
 * está planeando (existentes + la nueva, si aplica) — el caller es
 * responsable de pasar el conjunto correcto; esta función no sabe nada de
 * Firestore ni de qué actuación es "nueva".
 */
function calcularFechaAlertaConservadoraMirror(actuaciones: ActuacionLicenciaDoc[]): string | null {
  const eventos = derivarEventosTermino(actuaciones);
  const { fechaAlertaConservadora } = calcularVencimientoDual(eventos, PLAZO_DECISION_LICENCIA_DIAS_HABILES);
  return fechaAlertaConservadora ? fechaAlertaConservadora.toISOString() : null;
}

/* ──────────────────────────────────────────────
   Creación (camino DEMO)
────────────────────────────────────────────── */

export interface CrearExpedienteInput {
  solicitanteNombre: string;
  solicitanteDocumento: string;
  subtipos: string[];
  contexto?: ContextoEvaluacionRequisito;
}

export interface PlanCrearExpedienteDemo {
  expediente: ExpedienteLicenciaDoc;
  primeraActuacion: ActuacionLicenciaDoc;
}

const CODIGOS_CATALOGO_NORMATIVO = new Set(CATALOGO_FIGURAS_NORMATIVAS.map((f) => f.codigo));

/**
 * Genera el número de expediente DEMO: `DEMO-{AA}-{idCorto}` — esquema
 * DELIBERADAMENTE distinto del formato legal (`{dane}-{curaduria}-{AA}-
 * {CCCC}`, `lib/motor-expedientes/numero-expediente.ts`) para que nadie lo
 * confunda con un número real: sin counters, sin ceros de relleno a 4
 * dígitos, con un prefijo textual imposible de generar por el formateador
 * legal. `idCorto` es aleatorio (8 hex de un UUID) — no hay invariante de
 * unicidad transaccional que preservar en demo (sin `unicidad_expedientes`).
 */
function formatearNumeroExpedienteDemo(fecha: Date): string {
  const anioCorto = String(fecha.getFullYear()).slice(-2);
  const idCorto = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `DEMO-${anioCorto}-${idCorto}`;
}

/**
 * Plan de creación de un expediente de licencias — SIEMPRE camino DEMO en
 * esta fase (ver candado arriba). Función PURA: no toca Firestore, no
 * genera ningún efecto además de construir los documentos a escribir.
 *
 * FAIL-CLOSED doble (verificado por `__tests__/expedientes-licencias-
 * decisiones.test.ts`): (1) esta función JAMÁS importa ni referencia
 * `emitirNumeroExpedienteReal`, `leerConsecutivosLegales` ni
 * `confirmarConsecutivosLegales` — no hay ninguna rama de código que
 * pueda alcanzarlos; (2) no escribe (ni planea escribir) en `counters/*`
 * ni `unicidad_expedientes/*` — el plan que devuelve solo referencia
 * `expedientes/{id}` y su subcolección `actuaciones`.
 */
export function planCrearExpedienteDemo(
  input: CrearExpedienteInput,
  tenantId: TenantId,
  actor: ActorExpediente,
  ahora: Date,
): PlanCrearExpedienteDemo | ErrorExpediente {
  const nombre = input.solicitanteNombre?.trim() ?? '';
  const documento = input.solicitanteDocumento?.trim() ?? '';
  if (!nombre) return { status: 400, mensaje: 'El nombre del solicitante es obligatorio.' };
  if (!documento) return { status: 400, mensaje: 'El documento del solicitante es obligatorio.' };
  if (!Array.isArray(input.subtipos) || input.subtipos.length === 0) {
    return { status: 400, mensaje: 'Debe indicar al menos un subtipo (figura normativa) para el expediente.' };
  }

  for (const codigo of input.subtipos) {
    if (!CODIGOS_CATALOGO_NORMATIVO.has(codigo)) {
      return {
        status: 422,
        mensaje: `El subtipo "${codigo}" no está en el catálogo normativo de figuras (DF-4, ADR-0029). Si es un código local histórico (p. ej. "LA", "LCR VISR", "LRC"), su significado está pendiente del ingeniero (P1′) y no puede usarse para radicar todavía.`,
      };
    }
  }

  const id = crypto.randomUUID();
  const nowIso = ahora.toISOString();

  const primeraActuacion: ActuacionLicenciaDoc = {
    id: crypto.randomUUID(),
    expedienteId: id,
    tenantId,
    tipo: 'radicacion-debida-forma',
    etapa: 'radicacion',
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    fecha: nowIso,
    origen: 'REAL',
    detalle: 'Expediente de demostración creado (esPrueba: true) — candado de emisión real cerrado (R10).',
  };

  const expediente: ExpedienteLicenciaDoc = {
    id,
    tenantId,
    // Placeholder documentado: no existe todavía una `DefinicionTramite`
    // publicada para licencias (eso es persistencia de Fase 1) — este
    // id es el que se espera que tenga cuando exista.
    tramiteId: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id,
    estado: 'EN_REVISION',
    estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA',
    solicitanteNombre: nombre,
    solicitanteDocumento: documento,
    contexto: input.contexto ?? {},
    aportes: [],
    radicadoId: null,
    creadoEn: nowIso,
    actualizadoEn: nowIso,
    subtipos: [...input.subtipos],
    origen: 'REAL',
    numeroExpediente: {
      numero: formatearNumeroExpedienteDemo(ahora),
      // 'demo' NO es un `SerieConsecutivo` real (`lib/server/consecutivo-legal.ts`)
      // — marca explícita de que este número no salió de la serie legal.
      serieId: 'demo',
      año: ahora.getFullYear(),
    },
    esPrueba: true,
    // Espejo denormalizado (R11, ver JSDoc del campo) — nace ya poblado
    // porque el expediente nace CON su actuación de radicación en la MISMA
    // escritura (`app/api/licencias/expedientes/route.ts`, un solo batch).
    fechaAlertaConservadora: calcularFechaAlertaConservadoraMirror([primeraActuacion]),
  };

  return { expediente, primeraActuacion };
}

/* ──────────────────────────────────────────────
   Registro de actuaciones (acta / respuesta)
────────────────────────────────────────────── */

export type TipoActuacionPermitida = 'acta-observaciones' | 'respuesta-subsanacion';

export const DETALLE_ACTUACION_MIN = 15;

export interface RegistrarActuacionInput {
  tipo: string;
  detalle: string;
}

export interface PlanRegistrarActuacion {
  actuacion: ActuacionLicenciaDoc;
  nuevoEstadoJuridico: EstadoJuridicoLicencia;
  /** Espejo recalculado sobre `actuacionesExistentes + actuacion` — ver JSDoc de `ExpedienteLicenciaDoc.fechaAlertaConservadora`. El caller lo persiste en el MISMO batch que escribe `actuacion`. */
  fechaAlertaConservadora: string | null;
}

/**
 * Estado jurídico destino por tipo de actuación — la ÚNICA parte de este
 * módulo que declara "qué significa" cada tipo de evento (el mapa de
 * `estados-licencia.ts` no lo sabe: solo conoce pares desde/hacia válidos,
 * no a qué evento del mundo real corresponde cada tránsito). Cada entrada
 * se VALIDA contra ese mapa vía `puedeTransicionar` — nunca se asume válida
 * solo por estar aquí declarada.
 */
const ESTADO_DESTINO_POR_TIPO_ACTUACION: Readonly<Record<TipoActuacionPermitida, EstadoJuridicoLicencia>> = {
  'acta-observaciones': 'CON_ACTA_DE_OBSERVACIONES',
  'respuesta-subsanacion': 'EN_VIABILIDAD',
};

function esTipoActuacionPermitida(tipo: string): tipo is TipoActuacionPermitida {
  return tipo === 'acta-observaciones' || tipo === 'respuesta-subsanacion';
}

/**
 * Plan de registro de una actuación de HECHO ('acta-observaciones' o
 * 'respuesta-subsanacion') — el EFECTO sobre el término sigue ⚖️ dual
 * (`./termino.ts`, hueco 1 ADR-0029): esta función NO calcula ni persiste
 * ningún vencimiento, solo registra que el hecho ocurrió y mueve el
 * `estadoJuridico` según `puedeTransicionar`.
 *
 * Guards, en orden:
 *  1. `tipo` debe ser uno de los 2 permitidos (cualquier otro, incl.
 *     nombres de otros eventos de `TipoEventoTermino`, se rechaza — esta
 *     ruta NO es un registro genérico de eventos del término).
 *  2. `detalle` motivado (mínimo `DETALLE_ACTUACION_MIN` caracteres, mismo
 *     criterio que `MOTIVO_MIN` de `lib/server/subsanacion.ts`).
 *  3. Acta ÚNICA (D.1077/2015 art. 2.2.6.1.2.2.4, "por una sola vez"): si
 *     ya existe una actuación `acta-observaciones` en el expediente, una
 *     nueva se rechaza con 409 — sin importar el estado jurídico actual.
 *  4. `respuesta-subsanacion` exige que YA exista un acta previa (si no,
 *     no hay observación que responder) — guard adicional al del mapa,
 *     porque el mapa por sí solo no distingue "no hubo acta" de "el
 *     expediente llegó a EN_VIABILIDAD por la rama sin observaciones" (en
 *     ambos casos el estado podría permitir una transición hacia
 *     EN_VIABILIDAD, pero solo el primero es una respuesta legítima).
 *  5. La transición resultante debe ser válida según
 *     `puedeTransicionar(estadoActual, estadoDestino, {yaHuboActa})` — el
 *     MAPA de `estados-licencia.ts` es la autoridad final, esta función no
 *     lo duplica.
 *
 * `actuacionesExistentes` debe traer la actuación COMPLETA (no solo
 * `tipo`) — a partir del bloque "Términos y vigencias protectores"
 * (denormalización R11) esta función también recalcula el espejo
 * `fechaAlertaConservadora` sobre `actuacionesExistentes + actuacion`
 * (`calcularFechaAlertaConservadoraMirror`), y ese cómputo necesita
 * `fecha`/`origen` de cada actuación previa, no solo su `tipo`.
 */
export function planRegistrarActuacion(
  estadoJuridicoActual: EstadoJuridicoLicencia,
  actuacionesExistentes: ActuacionLicenciaDoc[],
  expedienteId: string,
  tenantId: string,
  input: RegistrarActuacionInput,
  actor: ActorExpediente,
  ahora: Date,
): PlanRegistrarActuacion | ErrorExpediente {
  if (!esTipoActuacionPermitida(input.tipo)) {
    return { status: 400, mensaje: 'Tipo de actuación no permitido; solo se admiten "acta-observaciones" y "respuesta-subsanacion".' };
  }

  const detalleLimpio = input.detalle?.trim() ?? '';
  if (detalleLimpio.length < DETALLE_ACTUACION_MIN) {
    return { status: 400, mensaje: `El detalle de la actuación debe describir el hecho con claridad (mínimo ${DETALLE_ACTUACION_MIN} caracteres).` };
  }

  const yaHuboActa = actuacionesExistentes.some((a) => a.tipo === 'acta-observaciones');

  if (input.tipo === 'acta-observaciones' && yaHuboActa) {
    return { status: 409, mensaje: 'Ya existe un acta de observaciones para este expediente; el acta procede por una sola vez (D.1077/2015 art. 2.2.6.1.2.2.4).' };
  }
  if (input.tipo === 'respuesta-subsanacion' && !yaHuboActa) {
    return { status: 409, mensaje: 'No hay un acta de observaciones registrada para este expediente; no procede una respuesta de subsanación.' };
  }

  const estadoDestino = ESTADO_DESTINO_POR_TIPO_ACTUACION[input.tipo];
  if (!puedeTransicionar(estadoJuridicoActual, estadoDestino, { yaHuboActa })) {
    return {
      status: 409,
      mensaje: `No procede registrar "${input.tipo}" desde el estado jurídico actual (${estadoJuridicoActual}).`,
    };
  }

  const actuacion: ActuacionLicenciaDoc = {
    id: crypto.randomUUID(),
    expedienteId,
    tenantId,
    tipo: input.tipo,
    etapa: input.tipo === 'acta-observaciones' ? 'revision' : 'subsanacion',
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    fecha: ahora.toISOString(),
    origen: 'REAL',
    detalle: detalleLimpio,
  };

  const fechaAlertaConservadora = calcularFechaAlertaConservadoraMirror([...actuacionesExistentes, actuacion]);

  return { actuacion, nuevoEstadoJuridico: estadoDestino, fechaAlertaConservadora };
}

/* ──────────────────────────────────────────────
   Contexto del caso (Bloque A·A2)
────────────────────────────────────────────── */

export interface PlanActualizarContexto {
  contexto: ContextoEvaluacionRequisito;
}

/**
 * Plan de actualización del `contexto` de un expediente — los hechos
 * (`esApoderado`, `categoriaComplejidad`, …) que `evaluarCondicion`
 * necesita para resolver los requisitos CONDICIONALES de su Definición
 * (`lib/motor-expedientes/completitud.ts`). Sin esto, los condicionales
 * quedan INDETERMINADOS para siempre.
 *
 * Fail-closed (mismo criterio que `validarDefinicionTramite`,
 * `CLAVE_NO_DECLARADA`): toda clave del `input` DEBE estar en
 * `definicion.clavesContexto`; una clave no declarada rechaza TODA la
 * actualización con 400 (no se aplican las claves válidas y se ignora la
 * inválida en silencio — todo o nada, para que el error sea imposible de
 * pasar por alto). El TIPO del valor también debe coincidir con el tipo
 * declarado de la clave (`ClaveContextoDeclarada.tipo`).
 *
 * PARCIAL, no total: solo actualiza las claves presentes en `input` —
 * combina (merge) sobre el `contextoActual`, no lo reemplaza completo.
 */
export function planActualizarContexto(
  contextoActual: ContextoEvaluacionRequisito,
  input: Record<string, unknown>,
  definicion: DefinicionTramite,
): PlanActualizarContexto | ErrorExpediente {
  const clavesDeclaradas = new Map((definicion.clavesContexto ?? []).map((c) => [c.nombre, c] as const));

  if (Object.keys(input).length === 0) {
    return { status: 400, mensaje: 'No se envió ninguna clave de contexto para actualizar.' };
  }

  for (const [clave, valor] of Object.entries(input)) {
    const declarada = clavesDeclaradas.get(clave);
    if (!declarada) {
      const catalogo = [...clavesDeclaradas.keys()].join(', ') || '(ninguna declarada)';
      return {
        status: 400,
        mensaje: `La clave de contexto "${clave}" no está declarada en la Definición "${definicion.id}". Claves válidas: ${catalogo}.`,
      };
    }
    if (typeof valor !== declarada.tipo) {
      return {
        status: 400,
        mensaje: `La clave de contexto "${clave}" espera un valor de tipo "${declarada.tipo}", se recibió "${typeof valor}".`,
      };
    }
    if (declarada.dominio && !declarada.dominio.includes(valor as string | number | boolean)) {
      return {
        status: 400,
        mensaje: `El valor "${String(valor)}" no pertenece al dominio permitido de "${clave}" (${declarada.dominio.join(', ')}).`,
      };
    }
  }

  return { contexto: { ...contextoActual, ...(input as ContextoEvaluacionRequisito) } };
}

/* ──────────────────────────────────────────────
   Handoff radicado⇄expediente (Bloque A·A4, D2)
────────────────────────────────────────────── */

/** Subconjunto mínimo de `VentanillaRadicado` que necesita el handoff — evita acoplar este módulo al tipo completo de ventanilla. */
export interface RadicadoParaHandoff {
  radicadoId: string;
  estadoActual: string;
  clasificacion: { oficinaDestino: string };
  solicitante: { nombreCompleto: string; numeroDocumento: string };
  vinculoExpediente?: { expedienteId: string; numeroExpediente: string; fecha: string } | null;
}

export interface CrearExpedienteDesdeRadicadoInput {
  subtipos: string[];
  contexto?: ContextoEvaluacionRequisito;
}

export interface VinculoExpedienteRadicado {
  expedienteId: string;
  numeroExpediente: string;
  fecha: string;
}

export interface PlanCrearExpedienteDesdeRadicado {
  expediente: ExpedienteLicenciaDoc;
  primeraActuacion: ActuacionLicenciaDoc;
  /** Lo que se escribe en `VentanillaRadicado.vinculoExpediente` — MISMA transacción que crea el expediente. */
  vinculoRadicado: VinculoExpedienteRadicado;
}

/**
 * Plan del handoff radicado→expediente (D2, ADR-0026). Función PURA:
 * recibe el radicado YA LEÍDO (el caller es responsable de que esa lectura
 * ocurra DENTRO de la misma transacción en la que luego se escriben ambos
 * documentos — `tx.get` antes de cualquier `tx.create`, regla del Admin
 * SDK — así el chequeo "sin vínculo previo" y la escritura del vínculo son
 * atómicos: dos solicitudes concurrentes de vincular el MISMO radicado no
 * pueden ambas ganar).
 *
 * Validaciones, en orden:
 *  1. El radicado debe estar clasificado hacia `SEC_PLANEACION` — un
 *     expediente de licencias no nace de un radicado de otra dependencia.
 *  2. El radicado no puede estar cerrado (mismo criterio que
 *     `assertNotClosed`, `lib/server/radicados-security.ts` — reutiliza
 *     `esEstadoCerrado`, no lo duplica).
 *  3. Vínculo ÚNICO: si `radicado.vinculoExpediente` ya existe, 409 — no
 *     se encadenan expedientes sobre el mismo radicado.
 *  4. `subtipos` — misma validación que `planCrearExpedienteDemo` contra
 *     el catálogo normativo (DF-4).
 *
 * PROYECCIÓN MÍNIMA D2 (deliberada — "no copies la PII completa"): el
 * expediente solo recibe `solicitanteNombre`/`solicitanteDocumento` del
 * radicado. El EMAIL nunca se copia al expediente — se usa, si existe,
 * SOLO en el momento de enviar la constancia (A5), leído del radicado en
 * ese instante, nunca persistido como campo del expediente.
 *
 * Candado R10 INTACTO: igual que `planCrearExpedienteDemo`, esta función
 * siempre construye el camino DEMO (`esPrueba: true`, prefijo `DEMO-`) —
 * no referencia `emitirNumeroExpedienteReal` en ninguna rama.
 */
export function planCrearExpedienteDesdeRadicado(
  radicado: RadicadoParaHandoff,
  input: CrearExpedienteDesdeRadicadoInput,
  tenantId: TenantId,
  actor: ActorExpediente,
  ahora: Date,
): PlanCrearExpedienteDesdeRadicado | ErrorExpediente {
  if (radicado.clasificacion.oficinaDestino !== 'SEC_PLANEACION') {
    return {
      status: 400,
      mensaje: 'El radicado no está clasificado hacia la Secretaría de Planeación; no procede crear un expediente de licencias a partir de él.',
    };
  }
  if (esEstadoCerrado(radicado.estadoActual)) {
    return { status: 409, mensaje: 'El radicado está cerrado; no admite esta acción.' };
  }
  if (radicado.vinculoExpediente) {
    return {
      status: 409,
      mensaje: `El radicado ya está vinculado al expediente "${radicado.vinculoExpediente.expedienteId}" (${radicado.vinculoExpediente.numeroExpediente}); no procede vincular otro.`,
    };
  }
  if (!Array.isArray(input.subtipos) || input.subtipos.length === 0) {
    return { status: 400, mensaje: 'Debe indicar al menos un subtipo (figura normativa) para el expediente.' };
  }
  for (const codigo of input.subtipos) {
    if (!CODIGOS_CATALOGO_NORMATIVO.has(codigo)) {
      return {
        status: 422,
        mensaje: `El subtipo "${codigo}" no está en el catálogo normativo de figuras (DF-4, ADR-0029). Si es un código local histórico (p. ej. "LA", "LCR VISR", "LRC"), su significado está pendiente del ingeniero (P1′) y no puede usarse para radicar todavía.`,
      };
    }
  }

  const id = crypto.randomUUID();
  const nowIso = ahora.toISOString();
  const numero = formatearNumeroExpedienteDemo(ahora);

  const primeraActuacion: ActuacionLicenciaDoc = {
    id: crypto.randomUUID(),
    expedienteId: id,
    tenantId,
    tipo: 'radicacion-debida-forma',
    etapa: 'radicacion',
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    fecha: nowIso,
    origen: 'REAL',
    detalle: `Expediente creado a partir del radicado de ventanilla ${radicado.radicadoId} (handoff D2). Demostración (esPrueba: true) — candado de emisión real cerrado (R10, ADR-0026 precondición #4).`,
  };

  const expediente: ExpedienteLicenciaDoc = {
    id,
    tenantId,
    tramiteId: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id,
    estado: 'EN_REVISION',
    estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA',
    solicitanteNombre: radicado.solicitante.nombreCompleto,
    solicitanteDocumento: radicado.solicitante.numeroDocumento,
    contexto: input.contexto ?? {},
    aportes: [],
    radicadoId: radicado.radicadoId,
    creadoEn: nowIso,
    actualizadoEn: nowIso,
    subtipos: [...input.subtipos],
    origen: 'REAL',
    numeroExpediente: { numero, serieId: 'demo', año: ahora.getFullYear() },
    esPrueba: true,
    // Espejo denormalizado (R11, ver JSDoc del campo) — mismo criterio que
    // `planCrearExpedienteDemo`: nace ya poblado porque el expediente nace
    // CON su actuación de radicación en la MISMA transacción.
    fechaAlertaConservadora: calcularFechaAlertaConservadoraMirror([primeraActuacion]),
  };

  return {
    expediente,
    primeraActuacion,
    vinculoRadicado: { expedienteId: id, numeroExpediente: numero, fecha: nowIso },
  };
}

/* ──────────────────────────────────────────────
   Comunicaciones al ciudadano (Bloque A·A5) — dictamen gobierno-digital
   8-ago-2026, VINCULANTE
────────────────────────────────────────────── */

/**
 * v1 restringe el envío de comunicaciones (constancia y aviso de acta) a
 * expedientes de esta Definición — condición (c) del dictamen: "término
 * de 45 días SOLO para definiciones de licencia". Hoy solo existe
 * `DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL`; una Definición de "PH sola"
 * (15 días) queda deliberadamente FUERA de v1 — ampliar esta lista exige
 * decidir, para cada Definición nueva, si sus textos institucionales
 * (que citan artículos específicos de la licencia) le aplican.
 */
const DEFINICIONES_HABILITADAS_COMUNICACION_EXPEDIENTE = new Set([DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id]);

export interface RadicadoParaComunicacion extends CriterioNotificacion {
  solicitante: {
    email?: string | null;
    /** Marca "no aporta correo" — condición (e) del dictamen, además de `debeNotificarCiudadano`. */
    datosNoAportados?: { correo?: boolean };
  };
}

export interface GateComunicacionExpediente {
  debeEnviar: boolean;
  /** Motivo de NO envío — para logging/trazabilidad, nunca se expone como error HTTP (enviar o no email nunca bloquea la operación principal). */
  motivo?: string;
}

/**
 * Decide si procede enviar UNA comunicación (constancia o aviso de acta)
 * para un expediente — condiciones (c) y (e) del dictamen:
 *  - `tramiteId` debe estar en la lista habilitada (v1: solo licencia).
 *  - Debe existir un radicado vinculado con email válido, SIN marca de
 *    "no aporta correo" y SIN presentación anónima/reservada
 *    (`debeNotificarCiudadano`, mismo criterio que el resto del sistema).
 * Sin radicado vinculado (expediente creado por el camino normal, sin
 * handoff D2) NUNCA hay email disponible — no se copia PII de contacto al
 * expediente (proyección mínima D2) — así que nunca se envía.
 */
export function debeEnviarComunicacionExpediente(
  tramiteId: string,
  radicado: RadicadoParaComunicacion | null | undefined,
): GateComunicacionExpediente {
  if (!DEFINICIONES_HABILITADAS_COMUNICACION_EXPEDIENTE.has(tramiteId)) {
    return { debeEnviar: false, motivo: 'La Definición de este expediente no está habilitada para comunicaciones por correo en v1 (solo licencia de construcción).' };
  }
  if (!radicado) {
    return { debeEnviar: false, motivo: 'El expediente no tiene radicado vinculado con datos de contacto (no se copia email al expediente, proyección mínima D2).' };
  }
  if (radicado.solicitante.datosNoAportados?.correo) {
    return { debeEnviar: false, motivo: 'El solicitante marcó que no aporta correo.' };
  }
  if (!debeNotificarCiudadano(radicado)) {
    return { debeEnviar: false, motivo: 'No hay un correo válido para notificar, o la presentación es anónima/reservada.' };
  }
  return { debeEnviar: true };
}

/**
 * Fecha límite de respuesta al acta: 30 días hábiles desde la
 * COMUNICACIÓN del acta (no su expedición) — art. 2.2.6.1.2.2.4. Reutiliza
 * `sumarDiasHabiles` (`lib/tiempos-radicado.ts`) — NO reimplementa la
 * aritmética de días hábiles. Distinto del vencimiento de 45 días de la
 * licencia (DF-7 inerte, sigue sin calcularse): este plazo SÍ es literal
 * de la norma y no depende del hueco 1 del ADR-0029.
 */
export function calcularFechaLimiteRespuestaActa(fechaComunicacion: string | Date): string {
  return sumarDiasHabiles(fechaComunicacion, 30).toISOString();
}

/**
 * Actuación `comunicacion-enviada` — copia en el expediente de cada envío
 * (constancia o aviso), condición (i) del dictamen (CPACA arts. 36/59).
 * Metadata mínima: tipo de comunicación, destinatario, asunto — NUNCA el
 * cuerpo completo del correo (eso vive en el proveedor de correo, no se
 * duplica en Firestore).
 */
export function construirActuacionComunicacionEnviada(
  expedienteId: string,
  tenantId: string,
  meta: { tipoComunicacion: string; destinatario: string; asunto: string },
  actor: ActorExpediente,
  ahora: Date,
): ActuacionLicenciaDoc {
  return {
    id: crypto.randomUUID(),
    expedienteId,
    tenantId,
    tipo: 'comunicacion-enviada',
    etapa: 'comunicacion',
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    fecha: ahora.toISOString(),
    origen: 'REAL',
    tipoComunicacion: meta.tipoComunicacion,
    detalle: `${meta.tipoComunicacion} enviada a ${meta.destinatario}. Asunto: "${meta.asunto}".`,
  };
}

/* ──────────────────────────────────────────────
   Desistimiento SEMICONTROLADO (Bloque "Términos y vigencias protectores",
   10-ago-2026) — art. 2.2.6.1.2.2.4: "se entenderá desistida la solicitud"
   si el ciudadano no subsana dentro del plazo tras el acta COMUNICADA.
   NUNCA automático (Principio 9, IA/sistema sugiere — el funcionario
   decide): `evaluarPlazoSubsanacion` es una lectura derivada, calculada
   ON-READ, que NO toca la máquina de estados jurídicos (`estados-licencia.ts`)
   ni escribe nada — el archivo lo decide y firma el funcionario, con el
   proyecto de acto (`generarBorradorActoDesistimiento`) como insumo.

   ⚠ AMPLIACIÓN DE 15 DÍAS — DECLARADA Y OMITIDA (sin inventar): el acta de
   la mesa (10-ago) registra "30 días hábiles, ampliables 15" como el dato
   normativo. Pero NINGÚN `TipoEventoTermino` (`./termino.ts`, DF-7) ni
   ningún slug de `Actuacion.tipo` conocido en este módulo representa un
   evento de "ampliación del plazo de subsanación" — no es lo mismo que
   `PRORROGA_TERMINO_ADMINISTRACION` (esa es la prórroga del TÉRMINO
   GENERAL del trámite, un concepto distinto, también ⚖️ inerte). Sin una
   señal real que decir "esto es una ampliación", inventar cuándo aplicar
   +15 sería fabricar un hecho. `evaluarPlazoSubsanacion` implementa
   SOLO el plazo base de 30 días hábiles; cuando exista un evento/actuación
   real de ampliación, esta función debe extenderse para leerlo — no antes.
────────────────────────────────────────────── */

export type ResultadoPlazoSubsanacion = 'NO_APLICA' | 'EN_PLAZO' | 'POR_ARCHIVAR';

export interface EvaluacionPlazoSubsanacion {
  resultado: ResultadoPlazoSubsanacion;
  /** ISO 8601 — presente solo si `resultado !== 'NO_APLICA'`. */
  fechaVencimientoPlazo?: string;
  /** Puede ser negativo (plazo ya vencido) — presente solo si `resultado !== 'NO_APLICA'`. */
  diasHabilesRestantes?: number;
}

/**
 * ¿Esta comunicación es identificable como el AVISO DEL ACTA (no la
 * constancia, ni ninguna otra comunicación futura)? Corrección de un
 * hallazgo de revisión cruzada con consecuencia jurídica (10-ago-2026):
 * `'comunicacion-enviada'` es un tipo COMPARTIDO — antes de este fix,
 * `evaluarPlazoSubsanacion` tomaba CUALQUIER comunicación posterior al
 * acta, lo que podía arrancar el reloj de desistimiento tácito desde el
 * envío EQUIVOCADO (p. ej. si el aviso real del acta falló al enviarse y
 * después salió cualquier otra comunicación) — un vicio de debido proceso.
 *
 * Vía PRIMARIA: `tipoComunicacion` (campo estructurado, presente en toda
 * actuación escrita DESDE este fix). Vía FALLBACK, solo si el campo no
 * está presente (actuaciones escritas ANTES del fix): el prefijo conocido
 * de `detalle`, la MISMA constante (`PREFIJO_AVISO_ACTA_COMUNICACION`) que
 * ya usaba el texto libre. Si NINGUNA de las dos vías identifica la
 * comunicación como el aviso → `false`, fail-closed (mejor no reconocerla
 * que reconocerla mal).
 */
function esComunicacionDelActa(a: Pick<ActuacionLicenciaDoc, 'tipoComunicacion' | 'detalle'>): boolean {
  if (a.tipoComunicacion) return a.tipoComunicacion.startsWith(PREFIJO_AVISO_ACTA_COMUNICACION);
  return Boolean(a.detalle?.startsWith(PREFIJO_AVISO_ACTA_COMUNICACION));
}

/**
 * Evalúa si un expediente tiene un plazo de subsanación (desistimiento
 * tácito, art. 2.2.6.1.2.2.4) EN CURSO o VENCIDO, a partir de su
 * trazabilidad de actuaciones — PURA, sin I/O, sin escribir nada.
 *
 * Aplica (deja de ser `NO_APLICA`) SOLO si las tres condiciones se
 * cumplen, en este orden:
 *  1. Existe una actuación `acta-observaciones`.
 *  2. Existe una actuación `comunicacion-enviada` con `fecha` POSTERIOR (o
 *     igual) a la del acta Y que `esComunicacionDelActa` identifique como
 *     EL AVISO DEL ACTA — no cualquier comunicación posterior (ver JSDoc
 *     de `esComunicacionDelActa`: evidencia de que el acta SÍ se comunicó
 *     al interesado, CPACA arts. 36/59, sin la cual el plazo no corre —
 *     due process). Fail-closed: ninguna comunicación identificable como
 *     el aviso → `NO_APLICA`, aunque exista OTRA comunicación posterior.
 *  3. NO existe una actuación `respuesta-subsanacion` posterior al acta
 *     (el ciudadano aún no respondió).
 *
 * Con las tres condiciones dadas, el plazo son 30 días hábiles desde la
 * `fecha` de la comunicación (reutiliza `calcularFechaLimiteRespuestaActa`
 * — NO reimplementa la suma de días hábiles) — `POR_ARCHIVAR` si `hoy` ya
 * pasó esa fecha, `EN_PLAZO` si no.
 */
export function evaluarPlazoSubsanacion(
  actuaciones: Pick<ActuacionLicenciaDoc, 'tipo' | 'fecha' | 'tipoComunicacion' | 'detalle'>[],
  hoy: Date,
): EvaluacionPlazoSubsanacion {
  const ordenadas = [...actuaciones].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const acta = [...ordenadas].reverse().find((a) => a.tipo === 'acta-observaciones');
  if (!acta) return { resultado: 'NO_APLICA' };

  const actaTime = new Date(acta.fecha).getTime();

  const yaRespondio = ordenadas.some((a) => a.tipo === 'respuesta-subsanacion' && new Date(a.fecha).getTime() >= actaTime);
  if (yaRespondio) return { resultado: 'NO_APLICA' };

  const comunicacion = ordenadas.find((a) => (
    a.tipo === 'comunicacion-enviada' && new Date(a.fecha).getTime() >= actaTime && esComunicacionDelActa(a)
  ));
  if (!comunicacion) return { resultado: 'NO_APLICA' };

  const fechaVencimientoPlazo = calcularFechaLimiteRespuestaActa(comunicacion.fecha);
  const diasHabilesRestantes = diasRestantesHabiles(fechaVencimientoPlazo, hoy);
  const resultado: ResultadoPlazoSubsanacion = diasHabilesRestantes < 0 ? 'POR_ARCHIVAR' : 'EN_PLAZO';

  return { resultado, fechaVencimientoPlazo, diasHabilesRestantes };
}

/**
 * Fórmula de recursos contra el proyecto de acto de desistimiento tácito.
 * PARAMETRIZADA a propósito (no un literal inline en `generarBorradorActoDesistimiento`):
 * el acta de la mesa (10-ago) confirma la SUSTANCIA (recurso de reposición
 * ante la misma Secretaría de Planeación; sin apelación ante el Alcalde —
 * aclaración expresa del propietario el mismo día, commit
 * "docs(juridica): aclaración del propietario — recursos también quedan en
 * Planeación (solo reposición)") pero deja EXPRESAMENTE reservada la
 * "fórmula exacta" para el concepto ESCRITO de Jurídica ("una línea
 * basta"), por el riesgo de vicio de debido proceso si el texto de
 * notificación de recursos queda mal redactado. Mientras ese concepto no
 * llegue, este texto es la mejor redacción disponible con la sustancia ya
 * confirmada — cambiarlo cuando llegue el concepto es editar esta
 * constante, no la función que la usa.
 */
export const TEXTO_RECURSOS_DESISTIMIENTO_TACITO =
  'Contra este acto procede el recurso de reposición ante la Secretaría de Planeación de Simacota, '
  + 'dentro de los diez (10) días siguientes a su notificación (CPACA, art. 76). No procede recurso de apelación.';

export interface BorradorActoDesistimiento {
  titulo: string;
  /** Texto estructurado, imprimible — párrafos separados por línea en blanco. NO es HTML ni PDF (ver JSDoc de `generarBorradorActoDesistimiento`). */
  cuerpo: string;
}

/**
 * Genera el TEXTO del proyecto de acto administrativo de desistimiento
 * tácito — PURO, servidor, NO escribe nada ni decide nada por sí mismo: es
 * un INSUMO para que el funcionario revise, complete los datos que le
 * falten (motivo específico de lo no subsanado, fecha de firma) y firme.
 * El sistema JAMÁS declara el desistimiento — Principio 9 (IA/sistema
 * sugiere, el funcionario decide) aplica aquí con la misma fuerza que a
 * cualquier sugerencia de IA, aunque este texto no use IA: es lógica
 * determinista, pero la DECISIÓN administrativa sigue siendo 100% humana.
 *
 * Deliberadamente devuelve TEXTO PLANO estructurado (`{titulo, cuerpo}`),
 * NO monta ninguna generación de PDF nueva — eso es una decisión de
 * presentación que le corresponde a dev-frontend/UI. Si en el repo ya
 * existe un patrón de generación de PDF reutilizable para otros documentos
 * (constancias, oficios), es una pieza que dev-frontend puede aprovechar
 * DESPUÉS de este entregable — no se investigó ni se acopló aquí a
 * propósito, para no mezclar la lógica de negocio (qué dice el acto) con
 * la de presentación (cómo se imprime).
 *
 * Solo tiene sentido llamarla cuando `evaluacion.resultado === 'POR_ARCHIVAR'`
 * — se valida y se devuelve `null` en cualquier otro caso (no hay nada que
 * proyectar si el plazo no aplica o sigue corriendo).
 */
export function generarBorradorActoDesistimiento(
  expediente: Pick<ExpedienteLicenciaDoc, 'id' | 'solicitanteNombre' | 'solicitanteDocumento' | 'numeroExpediente'>,
  evaluacion: EvaluacionPlazoSubsanacion,
): BorradorActoDesistimiento | null {
  if (evaluacion.resultado !== 'POR_ARCHIVAR') return null;

  const numero = expediente.numeroExpediente?.numero ?? expediente.id;
  const cuerpo = [
    `PROYECTO DE ACTO ADMINISTRATIVO — DESISTIMIENTO TÁCITO DE LA SOLICITUD`,
    ``,
    `Expediente No. ${numero}`,
    `Solicitante: ${expediente.solicitanteNombre} (documento ${expediente.solicitanteDocumento})`,
    ``,
    `De conformidad con el artículo 2.2.6.1.2.2.4 del Decreto 1077 de 2015: "se entenderá `
      + `desistida la solicitud" cuando el solicitante no atienda el requerimiento de la `
      + `Administración dentro del plazo señalado tras la comunicación del acta de observaciones `
      + `y correcciones, sin que se hubiere aportado la información y/o documentación requerida.`,
    ``,
    `Vencido el plazo de subsanación (${evaluacion.fechaVencimientoPlazo ?? 'fecha de vencimiento pendiente de registrar'}) `
      + `sin respuesta del solicitante, se declara el DESISTIMIENTO TÁCITO de la solicitud y el `
      + `ARCHIVO del expediente.`,
    ``,
    TEXTO_RECURSOS_DESISTIMIENTO_TACITO,
    ``,
    `NOTA: este es un PROYECTO — no produce efecto alguno hasta ser revisado, completado y `
      + `firmado por el funcionario competente.`,
    ``,
    `_________________________________`,
    `Firma del funcionario competente`,
    `Secretaría de Planeación — Simacota, Santander`,
  ].join('\n');

  return {
    titulo: `Proyecto de acto de desistimiento tácito — expediente ${numero}`,
    cuerpo,
  };
}
