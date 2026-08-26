import type { TenantId } from '@/src/types/radicado';
import { calcularCompletitudExpediente, type CompletitudExpediente } from '@/lib/server/completitud-expediente';
import type { Expediente, Actuacion, ContextoEvaluacionRequisito, DefinicionTramite, NumeroExpedienteAsignado } from '@/lib/motor-expedientes/tipos';
import { CATALOGO_FIGURAS_NORMATIVAS } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { puedeTransicionar, type EstadoJuridicoLicencia, type RevisionHistoricaLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { esEstadoCerrado } from '@/lib/radicado-estados';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import { sumarDiasHabiles, diasRestantesHabiles, atLocalNoon } from '@/lib/tiempos-radicado';
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
  /** Completitud calculada EN EL SERVIDOR y recalculada con cada cambio de aportes.
   *  Opcional porque los expedientes escritos antes de este cambio no la traen —
   *  su ausencia significa «nunca se evaluó en servidor», que NO es lo mismo que
   *  «está completo»: quien la lea debe distinguir los dos casos. */
  completitud?: CompletitudExpediente;
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
   * Día en que la solicitud quedó RADICADA EN LEGAL Y DEBIDA FORMA (ISO 8601),
   * escrito por el acto de radicar. Es la fecha con efecto de plazo.
   *
   * Denormalizada en el raíz por el mismo motivo que `fechaAlertaConservadora`:
   * el Libro Consecutivo y la Bandeja listan sin traer la subcolección de
   * actuaciones, y sin este campo tendrían que seguir usando `creadoEn` —el día
   * en que se abrió la carpeta— para una columna rotulada «fecha de radicación».
   *
   * AUSENTE mientras el expediente no se haya radicado (PRESENTADA), y en los
   * históricos reconstruidos. Quien la lea debe mostrar un vacío honesto, nunca
   * sustituirla por `creadoEn`: son dos hechos distintos y el ADR-0033 existe
   * precisamente para no confundirlos.
   */
  fechaRadicacionDebidaForma?: string;
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
/**
 * Evidencia de la afirmación que hace el acto de radicar. Vive EN la actuación
 * —que es append-only— y no en el documento raíz, que se sobrescribe: dentro de
 * un año, reconstruir quién afirmó que la solicitud estaba completa y con qué
 * documento se hace leyendo esto.
 */
export interface EvidenciaRadicacion {
  requisitosAplicables: number;
  requisitosFaltantes: number;
  /**
   * Qué documento fijó la fecha del término — SOLO cuando la fecha se dedujo
   * de él. `null` cuando el ancla salió del momento REGISTRADO de completitud,
   * porque entonces ningún documento la fijó.
   *
   * Nombrar un documento en los dos casos era una imprecisión con
   * consecuencia: un auditor leería «documento que fija la fecha» y creería
   * que esa fecha sale de ese archivo, cuando sale del registro. La destapó la
   * propia demostración al imprimirlo en lenguaje llano.
   */
  requisitoQueFijaElAncla: string | null;
  documentoQueFijaElAncla: string | null;
  /** El último documento aportado, siempre — informativo, no la causa de la fecha. */
  ultimoDocumentoAportado: string;
  /** De dónde salió la fecha: un hecho registrado o una deducción. Un auditor no debería tener que adivinarlo. */
  baseDelAncla: 'MOMENTO_REGISTRADO_DE_COMPLETITUD' | 'PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO';
  /** Ata la afirmación al binario exacto (INV-3). `null` si la versión no lo trae. */
  hashSha256: string | null;
  definicionId: string;
  numeroExpediente: string;
  serieId: string;
}

export interface ActuacionLicenciaDoc extends Actuacion {
  tenantId: string;
  /** Presente SOLO en la actuación `tipo: 'radicacion-debida-forma'`. */
  evidenciaRadicacion?: EvidenciaRadicacion;
  /**
   * Presente SOLO en actuaciones `tipo: 'comunicacion-enviada'` — el tipo
   * ESTRUCTURADO de la comunicación (p. ej. "Aviso de acta de observaciones
   * y correcciones", "Acuse de recibo de solicitud").
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
    /* ADR-0033 §0 — la apertura NO es la radicación. Este slug no está en
       SLUG_A_TIPO_EVENTO (lib/motor-expedientes/termino.ts), y el motor ignora
       las actuaciones sin relevancia para el término: por eso un expediente
       recién abierto NO tiene término corriendo. La actuación
       'radicacion-debida-forma' se escribirá en la TRANSICIÓN, cuando el
       checklist se verifique en servidor — y con ella el número oficial y el
       arranque del plazo. */
    tipo: 'apertura-expediente',
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
    estadoJuridico: 'PRESENTADA',
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

export type TipoActuacionPermitida = 'inicio-revision' | 'acta-observaciones' | 'respuesta-subsanacion';

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
  /* LA SALIDA DEL CALLEJÓN. Desde `RADICADA_EN_DEBIDA_FORMA` el mapa de
     transiciones solo permite `EN_REVISION` y `DESISTIDA`, y hasta el
     26-ago-2026 NINGUNA ruta escribía `EN_REVISION`. Consecuencia: el acta de
     observaciones —lo ÚNICO que DETIENE el término— era inalcanzable, porque
     solo procede desde `EN_REVISION`.

     Es decir: radicar habría emitido un número legal y arrancado un plazo de
     45 días hábiles que el sistema no podía suspender. Peor que no emitirlo.

     `inicio-revision` NO mueve el reloj: su slug no está en
     `SLUG_A_TIPO_EVENTO` (`lib/motor-expedientes/termino.ts`) a propósito.
     Empezar a revisar es un hecho operativo, no uno de los cuatro eventos que
     el Decreto 1077 reconoce como relevantes para el cómputo. */
  'inicio-revision': 'EN_REVISION',
  'acta-observaciones': 'CON_ACTA_DE_OBSERVACIONES',
  'respuesta-subsanacion': 'EN_VIABILIDAD',
};

function esTipoActuacionPermitida(tipo: string): tipo is TipoActuacionPermitida {
  return tipo === 'inicio-revision'
    || tipo === 'acta-observaciones'
    || tipo === 'respuesta-subsanacion';
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
/**
 * Elegibilidad de un radicado para recibir vínculo con un expediente.
 * Compartida por las DOS puertas que lo vinculan —crear desde radicado y
 * vincular a uno existente— para que no puedan divergir: si una aceptara
 * un radicado que la otra rechaza, la unicidad del vínculo dejaría de ser
 * una propiedad del sistema y pasaría a depender de por dónde se entró.
 */
export function verificarRadicadoVinculable(radicado: RadicadoParaHandoff): ErrorExpediente | null {
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
  return null;
}

export interface PlanVincularRadicado {
  vinculoRadicado: VinculoExpedienteRadicado;
  actuacion: ActuacionLicenciaDoc;
}

/**
 * Plan para vincular un radicado a un expediente que YA existe.
 *
 * POR QUÉ EXISTE. Hasta el 13-ago-2026 un expediente creado con «Radicar
 * solicitud» nacía con `radicadoId: null` y NO había forma de vincularlo
 * después: quedaba huérfano para siempre, y el botón que lo creaba estaba
 * al lado del correcto en la misma barra. Una funcionaria que se
 * equivocara de botón no tenía marcha atrás y el expediente no podía llegar
 * a ser un trámite real. Esto lo hace reversible.
 *
 * Función PURA, y con la MISMA disciplina transaccional que el handoff: el
 * caller debe leer el radicado DENTRO de la transacción en la que luego
 * escribe, para que "sin vínculo previo" y la escritura del vínculo sean
 * atómicos frente a dos vinculaciones concurrentes.
 */
export function planVincularRadicado(
  expediente: Pick<ExpedienteLicenciaDoc, 'id' | 'tenantId' | 'radicadoId' | 'numeroExpediente'>,
  radicado: RadicadoParaHandoff,
  actor: ActorExpediente,
  ahora: Date,
): PlanVincularRadicado | ErrorExpediente {
  if (expediente.radicadoId) {
    return {
      status: 409,
      mensaje: `El expediente ya tiene vinculado el radicado "${expediente.radicadoId}"; un expediente no se re-vincula.`,
    };
  }
  const inelegible = verificarRadicadoVinculable(radicado);
  if (inelegible) return inelegible;

  const nowIso = ahora.toISOString();
  const numero = expediente.numeroExpediente?.numero ?? expediente.id;
  return {
    vinculoRadicado: { expedienteId: expediente.id, numeroExpediente: numero, fecha: nowIso },
    actuacion: {
      id: crypto.randomUUID(),
      expedienteId: expediente.id,
      tenantId: expediente.tenantId,
      tipo: 'vinculacion-radicado',
      etapa: 'radicacion',
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      actorRol: actor.rol,
      fecha: nowIso,
      origen: 'REAL',
      detalle: `Se vinculó el radicado de ventanilla ${radicado.radicadoId} a este expediente, que se había creado sin radicado.`,
    },
  };
}

export function planCrearExpedienteDesdeRadicado(
  radicado: RadicadoParaHandoff,
  input: CrearExpedienteDesdeRadicadoInput,
  tenantId: TenantId,
  actor: ActorExpediente,
  ahora: Date,
): PlanCrearExpedienteDesdeRadicado | ErrorExpediente {
  const inelegible = verificarRadicadoVinculable(radicado);
  if (inelegible) return inelegible;
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
    /* ADR-0033 §0 — ver la nota del camino demo: la apertura NO es la
       radicación, y este slug no genera evento de término. */
    tipo: 'apertura-expediente',
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
    estadoJuridico: 'PRESENTADA',
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
    // Nace con la completitud REAL: aportes vacíos ⇒ incompleto, con todos los
    // requisitos aplicables listados como faltantes. Que el expediente afirme
    // `RADICADA_EN_DEBIDA_FORMA` con este bloque diciendo lo contrario es
    // exactamente la contradicción que el ADR-0033 viene a resolver — y ahora
    // queda ESCRITA en el documento en vez de solo en una auditoría.
    completitud: calcularCompletitudExpediente([], input.contexto ?? {}, ahora),
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
  numeroExpediente?: string,
): GateComunicacionExpediente {
  // NUNCA se comunica al ciudadano un número de DEMOSTRACIÓN.
  //
  // El corte sigue vigente aunque el correo haya dejado de ser una constancia:
  // desde el 26-ago-2026 se envía un ACUSE DE RECIBO
  // (`lib/email/templates/acuse-recibo-expediente-licencia.ts`), que no
  // certifica ningún hecho jurídico — pero sí le da al ciudadano un número
  // con el que volver al mostrador. Con el candado R10 cerrado ese número es
  // `DEMO-{AA}-{8hex}`, que no existe en ninguna serie: la persona vendría a
  // preguntar por un expediente que nadie puede encontrar.
  //
  // Se corta AQUÍ y no en la plantilla a propósito: la decisión de comunicar
  // es del dominio, no de la maqueta del correo.
  if (numeroExpediente?.startsWith('DEMO-')) {
    return {
      debeEnviar: false,
      motivo: 'El expediente tiene un número de DEMOSTRACIÓN (candado R10): no se le entrega al ciudadano un número que no pertenece a la serie legal y con el que nadie podría encontrar su expediente.',
    };
  }
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

/* ══════════════════════════════════════════════════════════════
   EL ACTO DE RADICAR — PRESENTADA → RADICADA_EN_DEBIDA_FORMA

   Es el momento en que la Alcaldía AFIRMA que la solicitud llegó completa:
   nace el número oficial y arranca el término de 45 días hábiles
   (D.1077/2015 art. 2.2.6.1.2.1.1 par. 1). ADR-0033: el número y el término
   nacen en ESTA transición, no al crear el expediente.

   TODO lo de aquí es PURO. La transacción, la emisión del número y las
   escrituras las orquesta la ruta; este módulo decide QUÉ debe ocurrir y se
   deja probar sin Firestore.
══════════════════════════════════════════════════════════════ */

/** Lo que el acto necesita saber de un documento aportado. Subconjunto deliberado de `DocumentoExpedienteDoc`. */
export interface DocumentoParaAncla {
  id: string;
  requisitoId?: string;
  /**
   * ISO 8601, INMUTABLE: creación del documento lógico (= su v0001). NO es
   * `versionVigente.subidoEn`. La diferencia tiene consecuencia jurídica:
   * si el ciudadano corrige un documento con una versión nueva, el término
   * NO se recorre hacia adelante — la solicitud estuvo completa desde la
   * primera cobertura de ese requisito.
   */
  creadoEn: string;
  versionVigente?: { hashSha256?: string };
}

export interface EvidenciaDelAncla {
  /** Requisito cuyo documento fija el ancla (el ÚLTIMO en llegar). */
  requisitoId: string;
  documentoId: string;
  /** Hash de la versión vigente — ata la afirmación al binario exacto (INV-3). */
  hashSha256?: string;
}

export interface EvaluacionRadicacionDebidaForma {
  /** Día en que la solicitud quedó completa, ISO 8601 al mediodía local. */
  anclaIso: string;
  /**
   * Cómo se determinó el ancla, y decirlo es parte de la evidencia:
   *  - `MOMENTO_REGISTRADO_DE_COMPLETITUD`: el sistema anotó cuándo la
   *    solicitud quedó completa. Es el caso normal y el único auditable.
   *  - `PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO`: respaldo para expedientes
   *    anteriores a ese registro — fecha DEDUCIDA, con las salvedades del
   *    guard de término vencido.
   */
  baseDelAncla: 'MOMENTO_REGISTRADO_DE_COMPLETITUD' | 'PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO';
  /** El mismo día, en formato civil `YYYY-MM-DD` — lo que se enseña y lo que se confirma. */
  anclaDiaCivil: string;
  evidencia: EvidenciaDelAncla;
  completitud: CompletitudExpediente;
}

/** El acto ya ocurrió. No se repite: se devuelve lo que quedó escrito. */
export interface RadicacionYaOcurrida {
  yaEstaba: true;
  numeroExpediente: string | null;
  anclaIso: string;
}

export function esRadicacionYaOcurrida(x: unknown): x is RadicacionYaOcurrida {
  return typeof x === 'object' && x !== null && (x as RadicacionYaOcurrida).yaEstaba === true;
}

/** Día civil de Bogotá de un instante ISO — `YYYY-MM-DD`, sin depender del reloj del proceso. */
function diaCivilBogota(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

/**
 * ¿Procede declarar la radicación en legal y debida forma?
 *
 * PURA, y se ejecuta DENTRO de la transacción sobre lo que la transacción
 * acaba de leer — no sobre lo que la pantalla vio hace un minuto. Esa es la
 * revalidación: entre que la funcionaria miró y pulsó, alguien pudo subir un
 * documento, retirar otro o radicar el expediente por otra pestaña.
 *
 * ORDEN DELIBERADO de los guards, de más específico a más genérico: un
 * expediente histórico debe recibir una negativa que diga «es histórico», no
 * un «faltan documentos» que nadie puede satisfacer.
 *
 * SE EJECUTA ANTES DE LEER EL CONTADOR. Un rechazo no llega siquiera a mirar
 * la serie, así que un intento fallido no puede dejar un hueco: un hueco se
 * explica con acta, pero explicarlo es trabajo que nadie tiene por qué hacer.
 */
export function evaluarRadicacionEnDebidaForma(entrada: {
  /** Tal como está en Firestore ANTES de este acto — de aquí sale el hecho registrado. */
  expediente: ExpedienteLicenciaDoc;
  actuacionesPrevias: ActuacionLicenciaDoc[];
  /** Documentos leídos por los ids que traen los `aportes` APORTADOS. */
  documentos: DocumentoParaAncla[];
  /** Día civil que la pantalla le mostró a la funcionaria. Si ya no coincide, se rechaza. */
  anclaEsperada?: string;
  tenantEsperado: TenantId;
  ahora: Date;
}): ErrorExpediente | RadicacionYaOcurrida | EvaluacionRadicacionDebidaForma {
  const { expediente: exp, actuacionesPrevias, documentos, anclaEsperada, tenantEsperado, ahora } = entrada;

  /* (a) Tenant. `canOperateTenant` deja pasar a ADMIN y RECEPCIONISTA contra
     CUALQUIER dependencia; sin esta comprobación un rol transversal podría
     declarar en debida forma un expediente que no es de su escritorio. */
  if (exp.tenantId !== tenantEsperado) {
    return { status: 404, mensaje: 'Expediente no encontrado.' };
  }

  /* (b) Un expediente RECONSTRUIDO no se radica: su radicación ocurrió en
     papel, años atrás. Declararla hoy inventaría un hito que ya pasó y
     arrancaría un término legal sobre un trámite que puede estar resuelto. */
  if (exp.origen === 'RECONSTRUIDO' || exp.revisionHistorica) {
    return {
      status: 409,
      mensaje: 'Este expediente proviene del libro histórico de Planeación: su radicación consta en papel y no se declara de nuevo aquí. Para completar su revisión use el flujo de revisión histórica.',
    };
  }

  /* (c) Un expediente de DEMOSTRACIÓN no consume la serie legal. El candado
     R10 ya lo impide aguas arriba; esto lo vuelve imposible también por dato,
     no solo por configuración. */
  if (exp.esPrueba === true) {
    return {
      status: 422,
      mensaje: 'Este es un expediente de demostración (esPrueba). No puede recibir un número de la serie legal de expedientes.',
    };
  }

  /* (d) REPLAY — el acto ya ocurrió. La idempotencia es del DOMINIO: el
     propio `estadoJuridico`, leído bajo el bloqueo de la transacción, es el
     candado. No se inventa una clave de idempotencia porque el estado ya
     dice, con precisión jurídica, si el hecho ocurrió.

     Devuelve 200 con lo escrito, no un error: quien reintenta tras una
     desconexión no cometió ninguna falta, y un 409 le haría pensar que hay
     dos radicaciones cuando hay una. */
  if (exp.estadoJuridico === 'RADICADA_EN_DEBIDA_FORMA') {
    const yaEscrita = actuacionesPrevias.find(
      (a) => a.tipo === 'radicacion-debida-forma' && a.origen === 'REAL',
    );
    return {
      yaEstaba: true,
      numeroExpediente: exp.numeroExpediente?.numero ?? null,
      anclaIso: yaEscrita?.fecha ?? exp.actualizadoEn ?? ahora.toISOString(),
    };
  }

  /* (e) Cualquier otro estado: la máquina de estados decide, no una lista
     escrita a mano aquí. */
  if (!puedeTransicionar(exp.estadoJuridico, 'RADICADA_EN_DEBIDA_FORMA')) {
    return {
      status: 409,
      mensaje: `Un expediente en estado "${exp.estadoJuridico}" no puede declararse radicado en legal y debida forma. Solo procede desde "PRESENTADA".`,
    };
  }

  /* (f) Completitud RECALCULADA, nunca leída del campo persistido.
     `completitud` es opcional y su ausencia significa «nunca se evaluó» —
     que no es «está completo». Una compuerta escrita `completitud?.completo
     !== false` dejaría pasar justo a los expedientes que nunca se evaluaron. */
  /* `exp.completitud` entra como PREVIA. SIN ese cuarto argumento, `completoDesde`
     —el instante REGISTRADO en que la solicitud quedó completa— se regenera como
     `ahora` en cada evaluación, y el ancla del término vuelve a ser una deducción
     disfrazada de hecho. Compilaba, pasaba las pruebas y no se quejaba. */
  const completitud = calcularCompletitudExpediente(
    exp.aportes ?? [],
    exp.contexto ?? {},
    ahora,
    exp.completitud,
  );
  if (!completitud.completo) {
    /* DOS CAUSAS DISTINTAS, DOS MENSAJES DISTINTOS. Con una sola redacción, un
       expediente bloqueado por contexto incompleto le decía a la funcionaria
       «faltan 0 de 19 requisitos» — un mensaje que no se puede accionar: no
       falta ningún documento, falta saber QUÉ documentos aplican a este caso
       (si hay apoderado, si el predio linda con espacio público, la categoría
       de complejidad). Un rechazo que no dice qué hacer es un rechazo a medias. */
    if (completitud.faltantes.length === 0) {
      return {
        status: 409,
        mensaje:
          'Faltan datos del caso para saber qué documentos exige este trámite (por ejemplo si actúa un apoderado, ' +
          'si el predio linda con espacio público, o la categoría de complejidad). Complete esos datos en el ' +
          'expediente y vuelva a intentarlo: hasta entonces no se puede afirmar que la solicitud esté completa.',
      };
    }
    const lista = completitud.faltantes.map((f) => f.nombre).join('; ');
    return {
      status: 409,
      mensaje: `La solicitud todavía no está completa: faltan ${completitud.faltantes.length} de ${completitud.aplicables} requisitos aplicables (${lista}). El término no puede arrancar hasta que estén todos.`,
    };
  }

  /* (g) EL ANCLA. El término corre desde el día en que llegó el ÚLTIMO
     requisito, no desde hoy ni desde que se abrió el expediente. Se deriva
     de la evidencia —la fecha inmutable del documento— y nunca del reloj:
     si no se puede determinar, se rechaza. Caer hacia `ahora` regalaría a la
     Administración los días que el expediente llevaba completo sin que nadie
     lo declarara, que es exactamente lo contrario de lo que protege el
     término. */
  const porId = new Map(documentos.map((d) => [d.id, d]));
  const cubiertos: { requisitoId: string; doc: DocumentoParaAncla }[] = [];
  for (const aporte of exp.aportes ?? []) {
    if (aporte.estado !== 'APORTADO') continue;
    for (const docId of aporte.documentoIds ?? []) {
      const doc = porId.get(docId);
      if (doc) cubiertos.push({ requisitoId: aporte.requisitoId, doc });
    }
  }
  if (cubiertos.length === 0) {
    return {
      status: 409,
      mensaje: 'No se puede determinar desde cuándo corre el término: el expediente figura completo pero no hay documentos con fecha que lo respalden. Revise los documentos antes de radicar.',
    };
  }

  const ultimo = cubiertos.reduce((a, b) =>
    new Date(b.doc.creadoEn).getTime() > new Date(a.doc.creadoEn).getTime() ? b : a,
  );

  /* EL ANCLA ES UN HECHO REGISTRADO, NO UNA DEDUCCIÓN.

     `completoDesde` se graba en el instante en que la completitud pasa a
     verdadera (ver `CompletitudExpediente`). Esa es la fecha que ancla el
     término, y es auditable: consta cuándo se registró, no se reconstruye
     después a partir de otra cosa.

     La deducción desde la fecha del documento queda como RESPALDO declarado,
     y solo para expedientes anteriores a ese campo — con su base escrita en
     la evidencia para que nadie confunda una fecha registrada con una
     inferida. */
  /* EL HECHO REGISTRADO ES EL **PERSISTIDO**, NO EL RECALCULADO.

     `completitud` viene de recalcular ahora mismo, y ese recálculo SELLA
     `completoDesde` con «ahora» si el expediente está completo y no traía
     valor previo. Tomarlo de ahí hacía que el ancla fuera SIEMPRE el momento
     registrado —la deducción quedaba en código muerto— y, en un expediente
     anterior al campo, el término arrancaría HOY: exactamente lo que este
     código dice que nunca hará, regalándole a la Administración los días que
     el expediente llevaba completo sin que nadie lo declarara.

     Se lee del documento tal como estaba ANTES de esta evaluación. Si no lo
     trae, no hay hecho registrado y se pasa a la deducción declarada, con su
     guard de término vencido. */
  const registrado = exp.completitud?.completoDesde;
  const baseDelAncla = registrado
    ? ('MOMENTO_REGISTRADO_DE_COMPLETITUD' as const)
    : ('PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO' as const);
  const fuente = registrado ?? ultimo.doc.creadoEn;
  const anclaIso = atLocalNoon(fuente).toISOString();
  const anclaDiaCivil = diaCivilBogota(fuente);

  /* (h) Control optimista LEGIBLE POR UN AUDITOR: la funcionaria confirma el
     día que la pantalla le enseñó. Si entre lo que vio y el commit entró otro
     documento, el ancla se movió y el acto se rechaza — en vez de afirmar una
     fecha que ella nunca vio. Es lo contrario de un campo de fecha libre, que
     sería la puerta trasera al «clic de verificación» que ADR-0033 prohíbe. */
  if (anclaEsperada && anclaEsperada !== anclaDiaCivil) {
    return {
      status: 409,
      mensaje: `La evidencia cambió mientras revisaba: usted vio que el término arrancaría el ${anclaEsperada} y ahora arrancaría el ${anclaDiaCivil}. Vuelva a revisar el expediente antes de radicar.`,
    };
  }

  /* ⚠️ EL ANCLA SE DERIVA DE `creadoEn`, QUE RESPONDE A OTRA PREGUNTA.
     `creadoEn` es la fecha en que se adjuntó el PRIMER archivo de ese
     requisito, no la fecha en que el requisito quedó de verdad satisfecho:
     el servidor no revisa contenido, así que un PDF equivocado subido el
     día 1 marca el requisito como aportado, y la corrección posterior entra
     como versión nueva sin mover `creadoEn`.

     El sesgo favorece al ciudadano, y hasta aquí sería la doctrina
     conservadora de siempre. Pero llevado al extremo deja de ser un sesgo:
     si el ancla derivada es tan antigua que el término YA venció, radicar
     hoy equivaldría a declarar de oficio un silencio administrativo
     positivo — la licencia concedida por no responder a tiempo.

     Mientras el sistema no registre CUÁNDO la solicitud quedó completa (un
     `completoDesde` escrito en el instante en que la completitud pasa a
     verdadera, hoy inexistente), este acto NO adivina: se detiene y pide una
     decisión humana. Un «no puedo» ruidoso, en lugar de un plazo vencido en
     silencio. */
  const vencimiento = sumarDiasHabiles(atLocalNoon(anclaIso), PLAZO_DECISION_LICENCIA_DIAS_HABILES);
  if (baseDelAncla === 'PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO'
      && diasRestantesHabiles(vencimiento.toISOString()) < 0) {
    return {
      status: 409,
      mensaje:
        `No se radica automáticamente: la fecha del último documento (${anclaDiaCivil}) haría que el término ` +
        `de ${PLAZO_DECISION_LICENCIA_DIAS_HABILES} días hábiles naciera YA VENCIDO. Esa fecha es la de la primera ` +
        `versión del documento, que puede no ser el día en que la solicitud quedó realmente completa. ` +
        `Revise el expediente con Planeación antes de declarar la radicación: radicar así equivaldría a ` +
        `reconocer un silencio administrativo positivo.`,
    };
  }

  return {
    anclaIso,
    anclaDiaCivil,
    baseDelAncla,
    evidencia: {
      requisitoId: ultimo.requisitoId,
      documentoId: ultimo.doc.id,
      hashSha256: ultimo.doc.versionVigente?.hashSha256,
    },
    completitud,
  };
}

export interface PlanRadicarEnDebidaForma {
  /** Se escribe con `tx.create` sobre un id DETERMINISTA — el tercer candado contra el acto duplicado. */
  actuacion: ActuacionLicenciaDoc;
  actuacionId: string;
  /** Campos a fusionar en el documento raíz del expediente. */
  parcheExpediente: {
    estadoJuridico: EstadoJuridicoLicencia;
    /* Tipado contra el modelo A PROPÓSITO: escribí `anio` en la primera
       versión y el compilador no dijo nada, porque el objeto era literal.
       El campo real es `año`, y un expediente con `anio` habría quedado sin
       número visible para todo lo que lo lee. */
    numeroExpediente: NumeroExpedienteAsignado;
    /**
     * La fecha JURÍDICA de la radicación, denormalizada en el raíz por el
     * mismo motivo que `fechaAlertaConservadora`: quien lista no paga la
     * lectura de la subcolección. Sin esto, el Libro Consecutivo seguiría
     * mostrando `creadoEn` —el día que se abrió la carpeta— en la columna
     * «fecha de radicación», contradiciendo a la actuación que dice otra.
     * Dos fechas distintas para el mismo hecho es el defecto que el
     * ADR-0033 vino a corregir. Escribirlo aquí es la mitad del trabajo; la
     * otra mitad es que el Libro lo LEA (`presentacion-libro-consecutivo.ts`).
     */
    fechaRadicacionDebidaForma: string;
    fechaAlertaConservadora: string | null;
    completitud: CompletitudExpediente;
    actualizadoEn: string;
  };
}

/** Id determinista de la actuación que declara la radicación. Un solo acto, un solo documento. */
export function idActuacionRadicacion(expedienteId: string): string {
  return `${expedienteId}-radicacion`;
}

/**
 * Construye lo que se escribe, una vez emitido el número. PURA.
 *
 * Se separa de `evaluarRadicacionEnDebidaForma` a propósito: entre las dos
 * ocurre la emisión del consecutivo, que es la ÚLTIMA lectura y la PRIMERA
 * escritura de la transacción. Partir el cómputo en dos deja ese orden
 * visible en la ruta en vez de escondido en un solo bloque.
 */
export function planRadicarEnDebidaForma(entrada: {
  expedienteId: string;
  tenantId: string;
  evaluacion: EvaluacionRadicacionDebidaForma;
  numeroEmitido: string;
  anioSerie: number;
  actuacionesPrevias: ActuacionLicenciaDoc[];
  actor: { uid: string; nombre: string; rol: string };
  ahora: Date;
  definicionId?: string;
  observacion?: string;
}): PlanRadicarEnDebidaForma {
  const { expedienteId, tenantId, evaluacion, numeroEmitido, anioSerie,
          actuacionesPrevias, actor, ahora, definicionId, observacion } = entrada;

  const actuacionId = idActuacionRadicacion(expedienteId);
  const actuacion: ActuacionLicenciaDoc = {
    id: actuacionId,
    expedienteId,
    tenantId,
    /* EXACTAMENTE este slug. `SLUG_A_TIPO_EVENTO` es un lookup literal: una
       variante ('radicacion_debida_forma', 'radicacionDebidaForma') no da
       error — se descarta EN SILENCIO y el término nunca arranca. */
    tipo: 'radicacion-debida-forma',
    etapa: 'radicacion',
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    /* La fecha JURÍDICA: el día en que la solicitud quedó completa. NO el
       instante en que se pulsó el botón — ese va en `selloServidor`, que
       pone la ruta. Dos relojes con papeles distintos. */
    fecha: evaluacion.anclaIso,
    /* REAL, sin excepción: R9 excluye del término toda actuación
       RECONSTRUIDA antes incluso de mirar el slug. */
    origen: 'REAL',
    detalle:
      `Radicación en legal y debida forma. Expediente ${numeroEmitido}. ` +
      `Término de ${PLAZO_DECISION_LICENCIA_DIAS_HABILES} días hábiles desde ${evaluacion.anclaDiaCivil} ` +
      `(último requisito aportado: ${evaluacion.evidencia.requisitoId}).` +
      (observacion ? ` Observación: ${observacion}` : ''),
  };

  /* La evidencia viaja EN la actuación —que es append-only— y no en el
     documento raíz, que se sobrescribe. Dentro de un año, reconstruir quién
     afirmó que la solicitud estaba completa y con qué documento se hace
     leyendo esto, y el hash ata la afirmación al binario exacto (INV-3). */
  const conEvidencia: ActuacionLicenciaDoc = {
    ...actuacion,
    evidenciaRadicacion: {
      requisitosAplicables: evaluacion.completitud.aplicables,
      requisitosFaltantes: evaluacion.completitud.faltantes.length,
      /* Solo se nombra el documento cuando de verdad fijó la fecha. */
      requisitoQueFijaElAncla:
        evaluacion.baseDelAncla === 'PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO'
          ? evaluacion.evidencia.requisitoId
          : null,
      documentoQueFijaElAncla:
        evaluacion.baseDelAncla === 'PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO'
          ? evaluacion.evidencia.documentoId
          : null,
      ultimoDocumentoAportado: evaluacion.evidencia.documentoId,
      baseDelAncla: evaluacion.baseDelAncla,
      hashSha256: evaluacion.evidencia.hashSha256 ?? null,
      definicionId: definicionId ?? DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id,
      numeroExpediente: numeroEmitido,
      serieId: 'expedientes',
    },
  };

  /* El espejo se recalcula sobre la serie COMPLETA tras esta escritura.
     Omitirlo dejaría `fechaAlertaConservadora: null` en el raíz con el
     término ya corriendo — y el vigía de vencimientos clasifica por ese
     campo ANTES que por nada: el expediente seguiría reportándose SIN_ANCLAR
     mientras el reloj legal corre. */
  const fechaAlertaConservadora = calcularFechaAlertaConservadoraMirror([
    ...actuacionesPrevias,
    conEvidencia,
  ]);

  return {
    actuacion: conEvidencia,
    actuacionId,
    parcheExpediente: {
      estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA',
      numeroExpediente: { numero: numeroEmitido, serieId: 'expedientes', año: anioSerie },
      fechaRadicacionDebidaForma: evaluacion.anclaIso,
      fechaAlertaConservadora,
      completitud: evaluacion.completitud,
      actualizadoEn: ahora.toISOString(),
    },
  };
}
