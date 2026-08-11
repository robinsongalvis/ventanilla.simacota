/**
 * Planificador PURO de la importación del consecutivo histórico de
 * licencias (Bloque "Importador de históricos", ago-2026) — Fase 5
 * (expedientes RECONSTRUIDOS, ADR-0029 DF-9), rediseñado por DF-10
 * (decisión del propietario, 11-ago-2026, tras consultar al ingeniero de
 * Planeación — bloque "Históricos sin resolver").
 *
 * Resuelve el problema "el ejecutor `.mjs` no puede importar TS" separando
 * el trabajo en dos capas (mismo patrón que el resto del proyecto: "Plan |
 * Error" puro + route/script que solo orquesta I/O):
 *  - Esta capa (TS, puro, sin I/O) decide TODO: qué registro se importa,
 *    con qué datos exactos, y por qué uno se queda afuera.
 *  - `scripts/migracion/importar-consecutivo-licencias.mjs` es un ejecutor
 *    TONTO: solo lee un `PlanImportacion` ya serializado a JSON y lo
 *    escribe (o no) — cero decisiones, cero lógica de negocio, así que no
 *    necesita importar TypeScript.
 *
 * PURO: sin I/O, sin Firestore, sin `new Date()` propio (recibe `ahora`
 * como parámetro — determinismo para tests).
 *
 * Reutiliza (nunca reimplementa) las piezas REALES del motor:
 *  - `resolverEquivalencia`/`EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS`
 *    (DF-4) para el CÓDIGO de subtipo (eje P1′).
 *  - `derivarEventosTermino`/`calcularVencimientoDual` (`./termino.ts`) para
 *    verificar R9 END-TO-END (ver más abajo) — no se asume el resultado, se
 *    CALCULA con las mismas funciones que usa el servidor.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DF-10 — POR QUÉ CAMBIÓ EL DISEÑO (11-ago-2026):
 *
 * La versión anterior de este planificador esperaba que dos preguntas
 * (P1′: códigos de subtipo sin mapear; P4′: qué hito jurídico corresponde a
 * cada texto de "estado" del libro) se respondieran ANTES de poder importar
 * nada — con la semilla provisional 100% en cuarentena, el resultado real
 * eran 0 importables. El propietario, tras consultar al ingeniero de
 * Planeación, decidió lo contrario para el eje P4′: el libro se llevaba a
 * mano, "revisado" significa que se revisó y ahí quedó (no es trámite
 * activo), 132 de los 202 registros ni siquiera tienen "estado", y NINGUNO
 * de los 202 trae fecha de resolución — así que NINGÚN texto histórico de
 * "estado" alcanza a sustentar un hito jurídico verificable, sin importar
 * cuál sea. Un intento previo de mapear "terminado" → `CONCEDIDA` fue
 * RECTIFICADO expresamente por el propietario: *"No conviertas 'terminado'
 * en 'Concedida' sin acto final verificable"*.
 *
 * Consecuencia: el eje P4′ (`equivalencia-estados-operativos.ts`) queda
 * SUPERSEDIDO como puerta de bloqueo (ver su JSDoc actualizado) — TODO
 * registro con fecha válida entra como "histórico sin resolver"
 * (`RevisionHistoricaLicencia`, `lib/motor-expedientes/estados-licencia.ts`,
 * DF-10), preservando el texto original del libro
 * (`estadoOriginalHistorico`) como evidencia de procedencia, nunca como
 * insumo para adivinar un desenlace.
 *
 * El eje P1′ (códigos) SIGUE resolviendo por norma cuando puede — pero ya
 * NO bloquea cuando no puede: los 3 códigos que hoy no resuelven ("LCR
 * VISR", "LRC", y la variante de espaciado "LR y  LC, A" — HALLAZGO de esta
 * implementación, no estaba en la lista que trajo el encargo, pero el
 * mismo criterio general la cubre sin caso especial) se importan con el
 * texto histórico CRUDO como único elemento de `subtipos` — decisión
 * alineada con la MISMA convención que ya anticipa `esSubtipoEnCuarentena`
 * (`app/interno/licencias/presentacion-libro-consecutivo.ts`): un código de
 * subtipo que no está en el catálogo normativo se pinta como "pendiente de
 * identificar" en vez de tratarse como un dato cualquiera, y
 * `nombreSubtipo` ya degrada con gracia a mostrar el código crudo si no lo
 * reconoce. Se reporta aparte (`PlanImportacion.subtiposSinResolver`), NUNCA
 * se mezcla en silencio con un código real.
 *
 * La identidad del solicitante (nombre/documento) tampoco bloquea más para
 * RECONSTRUIDOS (decisión del propietario: "entran SIN cédula"; se
 * completan después desde la plataforma, los originales físicos están en la
 * Alcaldía) — el campo requerido se deja en STRING VACÍO cuando falta, NO
 * un sentinel inventado: `app/interno/licencias/presentacion-libro-
 * consecutivo.ts` YA declara `faltaCedula: estaVacio(exp.solicitanteDocumento)`
 * con JSDoc "dato faltante honesto (histórico reconstruido, R6)" — ese
 * contrato existía ANTES de esta implementación, así que reutilizarlo (en
 * vez de inventar un texto tipo "sin-documento-historico") es la opción que
 * no rompe nada y que el rediseño del Libro ya sabe leer.
 *
 * Con esto, la CUARENTENA real (que bloquea la importación) queda SOLO para
 * lo que de verdad no se puede importar: fechas calendario imposibles o
 * irreconocibles (6/202, sin cambio frente a la versión anterior). Todo lo
 * demás que sigue faltando (cédula, estado jurídico verificable, acto
 * final, subtipo) se IMPORTA de todas formas y se reporta como "pendiente
 * de completar" (`PlanImportacion.pendientesHistorico`,
 * `ExpedienteLicenciaDoc.revisionHistorica`) — editable y trazable después
 * (decisión del propietario #5: "cada registro editable y trazable"), nunca
 * un motivo para dejar el registro fuera del libro.
 *
 * R9 END-TO-END: cada expediente importado recibe, en el MISMO cálculo que
 * hace el servidor (`derivarEventosTermino` + `calcularVencimientoDual`,
 * `./termino.ts`), `fechaAlertaConservadora: null` — se VERIFICA, no se
 * asume: se construye la actuación de radicación `origen: 'RECONSTRUIDO'`
 * que el ejecutor `.mjs` escribirá de verdad
 * (`construirActuacionRadicacion`) y se corre por las funciones reales; R9
 * (`derivarEventosTermino`) la excluye ANTES de que haya ancla de término,
 * así que el resultado es `null` sin excepción — ningún histórico genera
 * vencimientos ni alertas.
 *
 * `estadoJuridico` se fija en `HISTORICO_SIN_RESOLVER` (ver
 * `ESTADO_JURIDICO_HISTORICO_SIN_RESOLVER`), un valor PROPIO del enum. La
 * primera versión reutilizaba `RADICADA_EN_DEBIDA_FORMA` "por ser el hito
 * menos comprometido", con el costo declarado de inflar el KPI "En
 * trámite"; se corrigió porque ese hito **afirma** un hecho que en un
 * histórico no consta —que la solicitud se presentó con documentación
 * completa verificada (art. 2.2.6.1.2.1.1 par. 1), lo que además ancla el
 * término— cuando del libro solo consta que hubo un radicado. Con valor
 * propio desaparece el costo: no pertenece a `ESTADOS_EN_TRAMITE_LIBRO`
 * (`app/interno/licencias/presentacion-libro-consecutivo.ts`) ni a ninguna
 * otra lista de estados activos, así que no infla contador alguno ni
 * aparece como trabajo pendiente.
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
  EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS,
} from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { resolverEquivalencia, normalizarTextoHistorico } from '@/lib/motor-expedientes/equivalencia-migracion';
import {
  type EstadoJuridicoLicencia,
  type RevisionHistoricaLicencia,
  type EjeCompletitudHistorico,
} from '@/lib/motor-expedientes/estados-licencia';
import { derivarEventosTermino, calcularVencimientoDual } from '@/lib/motor-expedientes/termino';
import type { DatosPredio, Actuacion } from '@/lib/motor-expedientes/tipos';
// Import type-only (se borra en compilación, CERO acoplamiento en tiempo de
// ejecución con `lib/server/`): reutiliza la forma exacta del documento que
// ya escriben las demás rutas de expedientes, sin duplicar la interfaz.
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

/* ──────────────────────────────────────────────
   Snapshot de entrada (contrato con el JSON copiado a `scripts/migracion/datos/`)
────────────────────────────────────────────── */

export interface RegistroConsecutivoHistorico {
  hoja: string;
  fila: number;
  radicado: string;
  fechaSolicitud: string;
  tipo: string;
  /** Ver `mapearPredioHistorico` — descartado si, normalizado, vale literalmente el nombre del municipio ("SIMACOTA"), que es el 100% de lo observado en las 54/202 filas reales que traen este campo. */
  direccion?: string;
  /** Ver `mapearPredioHistorico` — texto libre, se conserva verbatim (el libro mezcla veredas reales y al menos una dirección urbana bajo esta misma columna). */
  barrioVereda?: string;
  estado?: string;
  /** Ver `mapearPredioHistorico` — solo se aprovecha si calza el patrón de matrícula inmobiliaria; el resto se descarta. */
  matricula?: string;
  /** Ver `mapearPredioHistorico` — la columna real está DESALINEADA con direcciones y veredas; solo se aprovecha lo que contiene una unidad de área reconocible. */
  area?: string;
  noLicencia?: string;
  /**
   * Marca de "tiene correcciones" del libro histórico (3/202 filas, valores
   * observados: `"X"`/`"x"` — un checkbox sin contenido textual, nunca una
   * nota explicativa). FUERA DE ALCANCE de este planificador a propósito:
   * modelarlo de forma útil (una nota histórica real) exigiría escribir a
   * la subcolección `observaciones` del expediente, lo que cambiaría la
   * FORMA de `PlanImportacion` (hoy solo produce `expedientes:
   * ExpedienteLicenciaDoc[]`, documentos raíz) y del ejecutor `.mjs` que lo
   * consume — una ampliación estructural que no se justifica hoy para un
   * campo presente en el 1.5% de los registros y sin contenido más allá de
   * "sí/no". Se conserva el campo en el tipo (fidelidad con la fuente) pero
   * NINGUNA función de este archivo lo lee; decisión a revisar si el
   * ingeniero de Planeación confirma que el libro SÍ tiene el detalle de la
   * corrección en otra parte (p. ej. el Excel original, fuera de este
   * snapshot).
   */
  correcciones?: string;
  /**
   * Nombre del solicitante. OPCIONAL (remediación PII, ago-2026): el
   * archivo que corre en CI/se versiona es `consecutivo-licencias-
   * snapshot.sanitizado.json`, que retira este campo (Ley 1581/2012 — un
   * nombre propio nunca entra a la historia de git, ni en un repo
   * privado). La versión CON nombres (`.local.json`, gitignored) solo
   * vive en máquinas autorizadas, para la reunión con el propietario. El
   * planificador es el MISMO código en ambos casos — cuando falta (DF-10:
   * ya NO bloquea, ver `planificarImportacion`), `solicitanteNombre` queda
   * en `''` (string vacío, "dato faltante honesto" — mismo criterio que
   * `faltaCedula` en `app/interno/licencias/presentacion-libro-consecutivo.ts`),
   * nunca un nombre inventado.
   */
  solicitante?: string;
  /**
   * Número de documento del solicitante. Optativo porque el libro
   * histórico REAL de Simacota (ambas versiones, sanitizada y local) no
   * tiene esta columna — no existe en ninguna de las 202 filas — así que
   * para ese snapshot esto siempre es `undefined`. DF-10: la ausencia ya NO
   * bloquea la importación de un RECONSTRUIDO (decisión del propietario,
   * 11-ago-2026: "entran SIN cédula, se completan después desde la
   * plataforma") — `solicitanteDocumento` queda en `''` cuando falta. Se
   * declara aquí (en vez de omitirse del tipo) para que una fuente FUTURA
   * que sí traiga el dato pueda usar el mismo planificador sin cambios de
   * código — y para que los tests sintéticos puedan ejercer el camino con
   * documento presente.
   */
  solicitanteDocumento?: string;
}

export interface ProcedenciaSnapshot {
  archivoOrigen: string;
  sha256: string;
  extraidoEn: string;
  totalRegistros: number;
  nota: string;
}

export interface SnapshotConsecutivoLicencias {
  _procedencia: ProcedenciaSnapshot;
  registros: RegistroConsecutivoHistorico[];
}

/* ──────────────────────────────────────────────
   Plan de salida
────────────────────────────────────────────── */

/**
 * DF-10: único motivo de cuarentena REAL que queda — todo lo demás que
 * antes bloqueaba (`CODIGO_PENDIENTE_P1`, `ESTADO_PENDIENTE_P4`,
 * `IDENTIDAD_INCOMPLETA`) ahora se IMPORTA con el dato pendiente marcado
 * (ver `PlanImportacion.pendientesHistorico`/`subtiposSinResolver` y
 * `ExpedienteLicenciaDoc.revisionHistorica`), nunca se deja fuera del
 * libro. Se mantiene como unión (no un valor único suelto) para no romper
 * la forma de `RegistroEnCuarentena.motivos`/`generarReporteDryRun` si una
 * cuarentena real futura se vuelve a necesitar.
 */
export type MotivoCuarentena = 'FECHA_INVALIDA';

export interface RegistroEnCuarentena {
  radicado: string;
  hoja: string;
  fila: number;
  /**
   * OPCIONAL (remediación PII, ago-2026): presente solo cuando el
   * planificador corre contra el `.local.json` (máquina autorizada, con
   * nombres); ausente cuando corre contra el `.sanitizado.json` (CI, sin
   * PII). Nunca se rellena con un marcador tipo "[REDACTADO]" — redactar
   * (omitir) no es lo mismo que inventar un valor.
   */
  solicitante?: string;
  motivos: MotivoCuarentena[];
  /** Explicación legible, un elemento por motivo (mismo orden que `motivos`). */
  detalle: string[];
  colision: boolean;
}

export interface Reconciliacion {
  totalSnapshot: number;
  planificados: number;
  enCuarentena: number;
  /** Registros (no pares) involucrados en una colisión de `radicado` repetido — el caso 25-0037 real cuenta 2. NO bloquea la importación (DF-9): ambas filas se planifican, cada una con `numeroExpediente.colision: true`. */
  colisiones: number;
}

/**
 * Un registro cuyo `radicado` colisiona con otro del mismo snapshot — lista
 * PLANA (hoja/fila/radicado) para que el propietario/ingeniero la revise,
 * sin importar si el registro terminó planificado o en cuarentena por otro
 * motivo (misma filosofía que `datosPredio`: reporte ortogonal a la
 * cuarentena).
 */
export interface RegistroColision {
  radicado: string;
  hoja: string;
  fila: number;
}

/**
 * Un registro cuyo texto histórico de "tipo" NO resolvió contra el catálogo
 * normativo (P1′) y se importó con ese texto CRUDO como único elemento de
 * `subtipos` — ver JSDoc de cabecera del archivo (DF-10) para la decisión
 * completa de por qué se importa en vez de bloquear.
 */
export interface RegistroSubtipoSinResolver {
  radicado: string;
  hoja: string;
  fila: number;
  /** Texto tal como aparece en el libro, verbatim (mismo valor que termina en `ExpedienteLicenciaDoc.subtipos[0]`). */
  tipoOriginal: string;
}

/**
 * Conteos GRUPALES (no por registro) de qué falta por completar entre los
 * `reconciliacion.planificados` — DELIBERADAMENTE sin listar cada radicado
 * individual (a diferencia de `cuarentena`/`subtiposSinResolver`/
 * `filasColision`, que sí son listas accionables de pocas filas): estos
 * tres ejes aplican hoy a la CASI TOTALIDAD de los planificados (202/202
 * sin estado jurídico verificable ni acto final; 202/202 sin cédula en el
 * snapshot real) — una lista de 196 radicados no sería más útil que el
 * conteo, y el detalle POR REGISTRO ya vive en
 * `ExpedienteLicenciaDoc.revisionHistorica.pendientesAlImportar` (DF-10) una
 * vez importado.
 */
export interface ResumenPendientesHistorico {
  /** Cuántos planificados tienen `solicitanteNombre` y/o `solicitanteDocumento` en `''` (dato faltante honesto). */
  sinIdentidad: number;
  /** Cuántos planificados siguen "histórico sin resolver" (`revisionHistorica.pendiente === true`) — hoy, TODOS los planificados, por decisión del propietario (DF-10): ningún texto de "estado" del libro alcanza a sustentar un hito jurídico verificable. */
  sinEstadoJuridico: number;
  /** Cuántos planificados tienen `actoFinal.cierreDesconocido === true` (DF-6/DF-9: sin fecha de firmeza confiable en el libro). */
  sinActoFinal: number;
}

/**
 * Una fila cuya columna "area" del libro histórico NO parece un área (no
 * contiene una unidad reconocible) — se reporta con hoja/fila/radicado para
 * que el ingeniero de Planeación la ubique y corrija en el origen. NO es
 * motivo de cuarentena del registro (ver `mapearPredioHistorico`).
 */
export interface FilaAreaDesalineada {
  radicado: string;
  hoja: string;
  fila: number;
  /** Valor original tal como venía en la columna "area", sin normalizar. */
  valorOriginal: string;
}

/**
 * Reconciliación AMPLIADA (TAREA 3) de los datos de predio, calculada sobre
 * TODO el snapshot (`totalSnapshot` registros) — el predio es ortogonal a
 * la única puerta de cuarentena real (fecha) y a los ejes de completitud
 * (identidad/estado/acto final/subtipo), así que estos conteos se acumulan
 * sin importar si el registro terminó importado o en cuarentena. Ver
 * `mapearPredioHistorico` para la decisión campo por campo.
 */
export interface ReconciliacionPredio {
  /** Cuántos de `totalSnapshot` registros aportan cada campo de predio APROVECHABLE (tras el mapeo honesto, no crudo). */
  conDireccion: number;
  conBarrioVereda: number;
  conMatriculaInmobiliaria: number;
  conAreaTexto: number;
  descartes: {
    /** `direccion` presente pero descartada por valer literalmente el nombre del municipio. */
    direccionEsMunicipio: number;
    /** `matricula` presente pero con formato que no calza `NNN-NNNNN`. */
    matriculaFormatoInvalido: number;
    /** `area` presente pero sin unidad de área reconocible (columna desalineada). */
    areaDesalineada: number;
  };
  /** Detalle de cada descarte AREA_DESALINEADA, con ubicación en el libro. */
  filasAreaDesalineada: FilaAreaDesalineada[];
}

export interface PlanImportacion {
  /** Documentos COMPLETOS, listos para `tx.create`/`batch.set` — el ejecutor no decide nada más. */
  expedientes: ExpedienteLicenciaDoc[];
  cuarentena: RegistroEnCuarentena[];
  reconciliacion: Reconciliacion;
  /** DF-10: conteos grupales de qué falta por completar entre los planificados — ver `ResumenPendientesHistorico`. */
  pendientesHistorico: ResumenPendientesHistorico;
  /** DF-10: detalle por registro de los códigos de "tipo" que no resolvieron (P1′) y se importaron con el texto crudo — ver `RegistroSubtipoSinResolver`. */
  subtiposSinResolver: RegistroSubtipoSinResolver[];
  /** Detalle por registro de TODA fila involucrada en una colisión de radicado, planificada o no — ver `RegistroColision`. */
  filasColision: RegistroColision[];
  /** Reconciliación ampliada de datos de predio (TAREA 3) — ver `ReconciliacionPredio`. */
  datosPredio: ReconciliacionPredio;
  advertencias: string[];
}

/* ──────────────────────────────────────────────
   Utilidades puras de parseo (sin reimplementar `atLocalNoon`)
────────────────────────────────────────────── */

const RE_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parsea `fechaSolicitud` ("YYYY-MM-DD", ya un DÍA CIVIL sin ambigüedad de
 * huso horario — no un instante) a un ISO 8601 anclado al mediodía de ese
 * mismo día. Misma CONVENCIÓN de representación que `atLocalNoon`
 * (`lib/tiempos-radicado.ts`) — de ahí "atLocalNoon-compatible" — pero
 * deliberadamente SIN llamarla: `atLocalNoon` reinterpreta su entrada como
 * un INSTANTE (hace `new Date(value)` y vuelve a extraer el día civil vía
 * `Intl`/America-Bogota); para un string "solo fecha", `new Date(...)` lo
 * parsea como MEDIANOCHE UTC, y ese instante cae el día CIVIL ANTERIOR en
 * Bogotá (UTC−5) — verificado empíricamente:
 * `atLocalNoon('2026-01-06')` da día civil "05", no "06". Como
 * `fechaSolicitud` YA ES un día civil (no un instante que haya que
 * reinterpretar), la transformación correcta toma sus tres componentes
 * literales y los ancla al mediodía directamente — sin ningún paso por
 * huso horario intermedio.
 *
 * Devuelve `null` (nunca lanza, nunca inventa) ante cualquier formato
 * distinto de "YYYY-MM-DD" o una fecha calendario imposible (p. ej.
 * "2026-02-30", que `Date` "normalizaría" en vez de rechazar) — el caller
 * manda el registro a cuarentena en vez de asumir un valor.
 */
export function parsearFechaHistoricaANoonISO(texto: string | undefined | null): { iso: string; año: number } | null {
  if (!texto) return null;
  const m = RE_FECHA_ISO.exec(texto.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const fecha = new Date(year, month - 1, day, 12, 0, 0, 0);
  // Guarda contra fechas calendario imposibles: el constructor de `Date`
  // "normaliza" en vez de fallar (p. ej. día 30 de febrero se convierte en
  // 2 de marzo) — comparar contra los componentes originales lo detecta.
  if (fecha.getFullYear() !== year || fecha.getMonth() !== month - 1 || fecha.getDate() !== day) {
    return null;
  }
  return { iso: fecha.toISOString(), año: year };
}

/* ──────────────────────────────────────────────
   Mapeo HONESTO del predio histórico (TAREAS 1-3)
────────────────────────────────────────────── */

/**
 * Círculo registral (3 dígitos) + folio de matrícula inmobiliaria (4 a 8
 * dígitos). Verificado contra las 11/202 matrículas reales del snapshot
 * (círculo `321` de Simacota, folios de 4 a 5 dígitos) — el techo de 8 da
 * margen sin inventar una cota arbitraria más laxa que "cualquier número
 * con un guion". Cualquier valor que no calce (vacío, texto, u otro
 * formato) se descarta con `MATRICULA_FORMATO_INVALIDO`, nunca se fuerza.
 */
const RE_MATRICULA_INMOBILIARIA = /^\d{3}-\d{4,8}$/;

/**
 * El texto trae una unidad de área reconocible (hectáreas "HA" o metros
 * cuadrados "M2") como TOKEN completo. `\b` es deliberado: sin él, la
 * subcadena "HA" aparece dentro de "EL CHANCE" (un valor REAL de la columna
 * "area" del snapshot, hoja "2025") y lo clasificaría como área por error;
 * con límites de palabra, "CHANCE" no calza porque la "H" está pegada a la
 * "C" anterior (no hay frontera de palabra ahí). Insensible a mayúsculas y
 * a la cantidad de espacios alrededor del token.
 */
const RE_UNIDAD_AREA = /\b(HA|M2)\b/i;

/** Único valor observado en las 54/202 filas reales que traen `direccion` — es el nombre del MUNICIPIO, no una dirección (ver `mapearPredioHistorico`). */
const MUNICIPIO_SIN_DIRECCION = 'SIMACOTA';

export type MotivoDescartePredio = 'MATRICULA_FORMATO_INVALIDO' | 'DIRECCION_ES_MUNICIPIO' | 'AREA_DESALINEADA';

export interface DescartePredio {
  campo: 'matriculaInmobiliaria' | 'direccion' | 'areaTexto';
  motivo: MotivoDescartePredio;
  /** Valor original tal como venía en el histórico, verbatim (sin normalizar) — para que el ingeniero lo ubique en su libro. */
  valorOriginal: string;
}

export interface ResultadoMapeoPredio {
  /**
   * `undefined` si NINGÚN campo resultó aprovechable — ausencia declarada,
   * NUNCA penalizada (no es motivo de cuarentena). Cuando al menos un campo
   * se aprovecha, el objeto solo trae esos campos — nada se rellena por los
   * descartados.
   */
  predio?: DatosPredio;
  descartes: DescartePredio[];
}

/**
 * Mapeo HONESTO del predio de UN registro histórico — PURA, sin I/O, sin
 * normalizar ni inventar ningún valor ausente. Decide, campo por campo, si
 * el dato del libro es aprovechable tal cual o se descarta con un motivo
 * explícito (ver `MotivoDescartePredio`):
 *
 *  - `matricula` → `matriculaInmobiliaria` SOLO si calza
 *    `RE_MATRICULA_INMOBILIARIA`. Las 11/202 matrículas reales del
 *    snapshot son consistentes con ese patrón; cualquier otra cosa se
 *    descarta (`MATRICULA_FORMATO_INVALIDO`) en vez de forzarla.
 *  - `barrioVereda` → `barrioVereda` VERBATIM, texto libre. El libro
 *    mezcla veredas reales ("SANTA BARBARA", "LA AGUADA") con al menos una
 *    dirección urbana ("CRA 3 No. 4") bajo la misma columna — no hay señal
 *    estructural para separarlas sin inventar una regla, así que se
 *    conserva tal cual (el nombre del campo ya declara que es mixto).
 *  - `direccion` → SE DESCARTA (`DIRECCION_ES_MUNICIPIO`) si, normalizado
 *    (`normalizarTextoHistorico`), es exactamente "SIMACOTA": el 100% de
 *    las 54/202 filas reales que traen este campo valen literalmente eso
 *    — es el MUNICIPIO, no una dirección, dato inútil. Si algún registro
 *    trajera otra cosa, se conserva verbatim (el campo no está roto en sí
 *    mismo, solo su único valor observado hasta hoy lo es).
 *  - `area` → `areaTexto` SOLO si el texto contiene una unidad de área
 *    reconocible (`RE_UNIDAD_AREA`). La columna real está DESALINEADA
 *    (16/202): unos valores son áreas de verdad ("48 HA 2469 M2") y otros
 *    son direcciones ("CRA 4 # 2-21") o veredas ("AGUA BLANCA") que se
 *    colaron en la columna equivocada. Lo que no parece área se descarta
 *    (`AREA_DESALINEADA`) — `planificarImportacion` acumula estos descartes
 *    con hoja/fila en `PlanImportacion.datosPredio.filasAreaDesalineada`
 *    para que el ingeniero corrija su libro en el origen. Esto NUNCA es
 *    motivo de cuarentena del registro: el predio es ortogonal a la puerta
 *    de fecha y a los ejes de completitud (identidad/estado/acto final/subtipo).
 *
 * `noLicencia` y `correcciones` NO se mapean aquí — `noLicencia` alimenta
 * `actoFinal.numero` (un dato del ACTO, no del predio; ver
 * `planificarImportacion`) y `correcciones` queda fuera de alcance (ver su
 * JSDoc en `RegistroConsecutivoHistorico`).
 */
export function mapearPredioHistorico(registro: RegistroConsecutivoHistorico): ResultadoMapeoPredio {
  const descartes: DescartePredio[] = [];
  const predio: DatosPredio = {};

  if (registro.matricula && registro.matricula.trim().length > 0) {
    const valor = registro.matricula.trim();
    if (RE_MATRICULA_INMOBILIARIA.test(valor)) {
      predio.matriculaInmobiliaria = valor;
    } else {
      descartes.push({ campo: 'matriculaInmobiliaria', motivo: 'MATRICULA_FORMATO_INVALIDO', valorOriginal: registro.matricula });
    }
  }

  if (registro.barrioVereda && registro.barrioVereda.trim().length > 0) {
    predio.barrioVereda = registro.barrioVereda.trim();
  }

  if (registro.direccion && registro.direccion.trim().length > 0) {
    if (normalizarTextoHistorico(registro.direccion) === MUNICIPIO_SIN_DIRECCION) {
      descartes.push({ campo: 'direccion', motivo: 'DIRECCION_ES_MUNICIPIO', valorOriginal: registro.direccion });
    } else {
      predio.direccion = registro.direccion.trim();
    }
  }

  if (registro.area && registro.area.trim().length > 0) {
    const valor = registro.area.trim();
    if (RE_UNIDAD_AREA.test(valor)) {
      predio.areaTexto = valor;
    } else {
      descartes.push({ campo: 'areaTexto', motivo: 'AREA_DESALINEADA', valorOriginal: registro.area });
    }
  }

  return { predio: Object.keys(predio).length > 0 ? predio : undefined, descartes };
}

/**
 * Sentinela para `Expediente.tramiteId` (campo obligatorio del modelo) en
 * expedientes RECONSTRUIDOS: hoy solo existe UNA Definición de Trámite
 * sembrada (`DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL`, construcción obra
 * nueva) y el histórico incluye subtipos que NO son construcción (LSR,
 * LSU, PH, LR, LU) — forzar esa Definición sobre todos sería mentir sobre
 * el trámite real. Los expedientes RECONSTRUIDOS tampoco evalúan checklist
 * (no hay `aportes`/`contexto` que verificar: son registro archivístico,
 * no intake activo), así que el campo es estructuralmente obligatorio pero
 * sin consumidor real para este origen — se declara un centinela explícito
 * en vez de un valor engañoso.
 */
export const SIN_DEFINICION_TRAMITE_HISTORICO = 'sin-definicion-tramite-historico';

/**
 * DF-10: valor de `estadoJuridico` para TODO expediente importado del
 * histórico (decisión del propietario, 11-ago-2026: *"ninguno afirma
 * desenlace jurídico"*).
 *
 * Es un estado PROPIO del enum, no un hito reutilizado. La primera
 * implementación fijaba `RADICADA_EN_DEBIDA_FORMA` por ser "el menos
 * comprometido de los 9", con el costo declarado de inflar el KPI "En
 * trámite"; se corrigió porque ese hito **afirma** un hecho que en un
 * histórico no consta —que la solicitud se presentó con documentación
 * completa verificada (art. 2.2.6.1.2.1.1 par. 1), lo que además ancla el
 * término— cuando del libro solo consta que hubo un radicado. Con valor
 * propio no hay nada que afirmar ni contador que inflar: no pertenece a
 * ninguna lista de estados activos. Ver su JSDoc en
 * `lib/motor-expedientes/estados-licencia.ts`.
 */
export const ESTADO_JURIDICO_HISTORICO_SIN_RESOLVER: EstadoJuridicoLicencia = 'HISTORICO_SIN_RESOLVER';

const FUENTE_PROVENANCE = 'xlsx-consecutivo-2022-2026';

/**
 * `plazoDias` arbitrario, usado SOLO para verificar R9 end-to-end (ver
 * `fechaAlertaConservadoraHistorico` más abajo) — con una ÚNICA actuación
 * de radicación `origen: 'RECONSTRUIDO'`, `derivarEventosTermino` la
 * EXCLUYE (R9) antes de que `calcularVencimientoDual` vea ningún evento: el
 * resultado es `fechaAlertaConservadora: null` sin importar qué plazo se le
 * pase (no hay ancla `RADICACION_DEBIDA_FORMA` reconocida — ver
 * `calcularVencimiento`, `./termino.ts`). El valor exacto es irrelevante A
 * PROPÓSITO: se declara aparte de `PLAZO_DECISION_LICENCIA_DIAS_HABILES`
 * (`lib/server/expedientes-licencias.ts`) para NO importar ESE módulo aquí
 * — el planificador debe seguir con CERO acoplamiento en tiempo de
 * ejecución con `lib/server/` (ver JSDoc de cabecera del archivo).
 */
const PLAZO_IRRELEVANTE_PARA_VERIFICAR_R9 = 45;

/**
 * Calcula `fechaAlertaConservadora` para UN expediente histórico —
 * VERIFICACIÓN REAL de R9 (no una suposición): construye la MISMA actuación
 * de radicación reconstruida que `scripts/migracion/importar-consecutivo-
 * licencias.mjs` (`construirActuacionRadicacion`) escribirá de verdad, y la
 * corre por las funciones REALES del motor (`derivarEventosTermino` +
 * `calcularVencimientoDual`) — exactamente el mismo camino que
 * `lib/server/expedientes-licencias.ts` usa para expedientes reales
 * (`calcularFechaAlertaConservadoraMirror`), sin reimplementarlo. Siempre
 * `null` para estos expedientes: R9 excluye la única actuación (RECONSTRUIDA)
 * antes de que exista un ancla de término.
 */
function fechaAlertaConservadoraHistorico(actuacionRadicacion: Actuacion): string | null {
  const eventos = derivarEventosTermino([actuacionRadicacion]);
  const { fechaAlertaConservadora } = calcularVencimientoDual(eventos, PLAZO_IRRELEVANTE_PARA_VERIFICAR_R9);
  return fechaAlertaConservadora ? fechaAlertaConservadora.toISOString() : null;
}

// `resolverEquivalencia` toma `EquivalenciaMigracion[]` (mutable) — la
// semilla se declara `as const` (DF-4) para que TS la valide como tupla de
// literales; el spread la vuelve mutable para la llamada sin tocar la
// semilla ni el tipo del parámetro (mismo idioma ya usado en los tests de
// DF-4, `__tests__/catalogo-subtipos-normativo.test.ts`).
const TABLA_EQUIVALENCIAS_CODIGO = [...EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS];

export interface TablasEquivalencia {
  /** Default: `EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS` (DF-4) — inyectable para tests sintéticos que necesiten ejercer un código MAPEADO distinto sin tocar la semilla real. */
  codigos?: Parameters<typeof resolverEquivalencia>[1];
}

/**
 * Planifica la importación completa del snapshot — PURA, determinista dado
 * `ahora` (usada solo para `fechaImportacion` de `provenance`, NUNCA para
 * `creadoEn`, que sale siempre de `fechaSolicitud`). `tablas` es opcional y
 * por defecto usa la semilla real del proyecto — existe para que los tests
 * sintéticos puedan inyectar una tabla de códigos distinta (mismo principio
 * de inyección de dependencias que `resolverEquivalencia` ya usa: la tabla
 * es un parámetro, nunca un import fijo dentro de la función pura).
 *
 * DF-10: la ÚNICA puerta que manda un registro a `cuarentena` (no se
 * importa) es `FECHA_INVALIDA` — ver JSDoc de cabecera del archivo para la
 * decisión completa. Todo lo demás que falte (identidad, estado jurídico
 * verificable, acto final, subtipo sin resolver) se importa igual y se
 * reporta en `pendientesHistorico`/`subtiposSinResolver`/`filasColision`.
 */
export function planificarImportacion(
  snapshot: SnapshotConsecutivoLicencias,
  ahora: Date,
  tablas: TablasEquivalencia = {},
): PlanImportacion {
  const tablaCodigos = tablas.codigos ?? TABLA_EQUIVALENCIAS_CODIGO;
  const registros = snapshot.registros;

  // Colisiones de `radicado` — se detectan sobre TODO el snapshot, antes y
  // con independencia de a dónde termine cada registro (importado o en
  // cuarentena): DF-9 exige que la colisión se REPORTE siempre, no solo
  // cuando el registro sea importable. NO bloquea (nunca lo hizo).
  const porRadicado = new Map<string, number>();
  for (const r of registros) porRadicado.set(r.radicado, (porRadicado.get(r.radicado) ?? 0) + 1);
  const esColision = (radicado: string) => (porRadicado.get(radicado) ?? 0) > 1;
  const filasColision: RegistroColision[] = registros
    .filter((r) => esColision(r.radicado))
    .map((r) => ({ radicado: r.radicado, hoja: r.hoja, fila: r.fila }));

  const expedientes: ExpedienteLicenciaDoc[] = [];
  const cuarentena: RegistroEnCuarentena[] = [];
  const subtiposSinResolver: RegistroSubtipoSinResolver[] = [];
  const fechaImportacion = ahora.toISOString();

  const filasSinFecha: string[] = [];

  // Reconciliación ampliada de predio (TAREA 3) — acumulada sobre TODO el
  // snapshot, sin importar si el registro termina importado o en
  // cuarentena (ver JSDoc de `ReconciliacionPredio`).
  let conDireccion = 0;
  let conBarrioVereda = 0;
  let conMatriculaInmobiliaria = 0;
  let conAreaTexto = 0;
  let descartesDireccionEsMunicipio = 0;
  let descartesMatriculaFormatoInvalido = 0;
  let descartesAreaDesalineada = 0;
  const filasAreaDesalineada: FilaAreaDesalineada[] = [];

  // Conteos grupales DF-10 (ver JSDoc de `ResumenPendientesHistorico`).
  let sinIdentidad = 0;
  let sinEstadoJuridico = 0;
  let sinActoFinal = 0;

  for (const r of registros) {
    // Predio (TAREA 3): se calcula para TODO registro, sin importar el
    // destino (importado o cuarentena) — ortogonal a las demás puertas.
    const { predio, descartes: descartesPredio } = mapearPredioHistorico(r);
    if (predio?.direccion) conDireccion++;
    if (predio?.barrioVereda) conBarrioVereda++;
    if (predio?.matriculaInmobiliaria) conMatriculaInmobiliaria++;
    if (predio?.areaTexto) conAreaTexto++;
    for (const d of descartesPredio) {
      if (d.motivo === 'DIRECCION_ES_MUNICIPIO') descartesDireccionEsMunicipio++;
      if (d.motivo === 'MATRICULA_FORMATO_INVALIDO') descartesMatriculaFormatoInvalido++;
      if (d.motivo === 'AREA_DESALINEADA') {
        descartesAreaDesalineada++;
        filasAreaDesalineada.push({ radicado: r.radicado, hoja: r.hoja, fila: r.fila, valorOriginal: d.valorOriginal });
      }
    }

    const fecha = parsearFechaHistoricaANoonISO(r.fechaSolicitud);
    if (!fecha) {
      filasSinFecha.push(`hoja ${r.hoja}, fila ${r.fila} (radicado ${r.radicado})`);
      cuarentena.push({
        radicado: r.radicado,
        hoja: r.hoja,
        fila: r.fila,
        solicitante: r.solicitante,
        motivos: ['FECHA_INVALIDA'],
        detalle: [`"fechaSolicitud" ausente o con formato irreconocible: "${r.fechaSolicitud ?? ''}".`],
        colision: esColision(r.radicado),
      });
      continue;
    }

    // P1′ (código de subtipo): resuelve por norma cuando puede; si no,
    // se importa con el texto histórico CRUDO (DF-10) — nunca bloquea.
    const equivalenciaCodigo = resolverEquivalencia(r.tipo, tablaCodigos);
    const subtipoSinResolver = equivalenciaCodigo === null;
    const subtipos = subtipoSinResolver ? [r.tipo] : equivalenciaCodigo;
    if (subtipoSinResolver) {
      subtiposSinResolver.push({ radicado: r.radicado, hoja: r.hoja, fila: r.fila, tipoOriginal: r.tipo });
    }

    // Identidad (DF-10): ya NO bloquea para RECONSTRUIDOS. `''` (string
    // vacío) cuando falta — MISMO criterio que `faltaCedula` en
    // `app/interno/licencias/presentacion-libro-consecutivo.ts` ("dato
    // faltante honesto"), nunca un sentinel de texto inventado.
    const tieneNombre = Boolean(r.solicitante && r.solicitante.trim().length > 0);
    const tieneDocumento = Boolean(r.solicitanteDocumento && r.solicitanteDocumento.trim().length > 0);
    const nombre = tieneNombre ? r.solicitante!.trim() : '';
    const documento = tieneDocumento ? r.solicitanteDocumento!.trim() : '';
    const identidadPendiente = !tieneNombre || !tieneDocumento;
    if (identidadPendiente) sinIdentidad++;

    // DF-10: TODO planificado entra "histórico sin resolver" — ningún
    // texto de "estado" del libro alcanza a sustentar un hito jurídico
    // verificable (ver JSDoc de cabecera). El texto ORIGINAL se conserva
    // verbatim (trim únicamente — mismo criterio que `barrioVereda`/
    // `noLicencia`, no altera contenido sustantivo); `null` cuando el
    // libro no traía ningún estado (cohorte 2022-2024) — ausencia
    // declarada, nunca omitida en silencio.
    const estadoOriginalHistorico = r.estado && r.estado.trim().length > 0 ? r.estado.trim() : null;
    sinEstadoJuridico++;
    sinActoFinal++; // ninguno de los 202 trae fechaFirmeza (H5) — cierreDesconocido siempre true.

    const pendientesAlImportar: EjeCompletitudHistorico[] = ['ESTADO_JURIDICO', 'ACTO_FINAL'];
    if (identidadPendiente) pendientesAlImportar.unshift('IDENTIDAD');
    if (subtipoSinResolver) pendientesAlImportar.push('SUBTIPO');

    const revisionHistorica: RevisionHistoricaLicencia = { pendiente: true, pendientesAlImportar };

    const id = `hist-${r.hoja}-${r.fila}`;

    // R9 END-TO-END (ver JSDoc de `fechaAlertaConservadoraHistorico`): se
    // CALCULA con las funciones reales, no se asume `null`.
    const actuacionRadicacionReconstruida: Actuacion = {
      id: `${id}-radicacion`,
      expedienteId: id,
      tipo: 'radicacion-debida-forma',
      etapa: 'radicacion',
      actorUid: 'sistema-migracion-historicos',
      actorNombre: 'Importador de históricos (migración)',
      actorRol: 'SISTEMA',
      fecha: fecha.iso,
      origen: 'RECONSTRUIDO',
    };

    const expediente: ExpedienteLicenciaDoc = {
      id,
      tenantId: 'SEC_PLANEACION',
      tramiteId: SIN_DEFINICION_TRAMITE_HISTORICO,
      // DF-10: NUNCA `EN_REVISION` — un histórico sin resolver no es
      // trabajo pendiente del panel; `ARCHIVADO` no infla ningún KPI de
      // "en trámite" basado en `EstadoExpediente` (hoy ninguno lo usa,
      // ver `app/interno/licencias`, pero el valor sigue siendo el
      // honesto: este expediente no tiene una cola de trabajo activa).
      estado: 'ARCHIVADO',
      estadoJuridico: ESTADO_JURIDICO_HISTORICO_SIN_RESOLVER,
      estadoOriginalHistorico,
      revisionHistorica,
      solicitanteNombre: nombre,
      solicitanteDocumento: documento,
      contexto: {},
      aportes: [],
      radicadoId: null,
      creadoEn: fecha.iso,
      actualizadoEn: fecha.iso,
      numeroExpediente: {
        numero: r.radicado,
        serieId: 'historico-consecutivo-planeacion',
        año: fecha.año,
        colision: esColision(r.radicado),
      },
      subtipos,
      origen: 'RECONSTRUIDO',
      provenance: {
        fuente: FUENTE_PROVENANCE,
        fechaImportacion,
        sha256: snapshot._procedencia.sha256,
        hoja: r.hoja,
        fila: r.fila,
      },
      // `cierreDesconocido: true` se mantiene aunque `numero` esté presente:
      // `validarCierreExpediente` (`../motor-expedientes/estados-licencia.ts`)
      // exige numero Y fecha Y fechaFirmeza para considerar el acto
      // COMPLETO — el libro histórico nunca trae las dos últimas, así que
      // el acto sigue incompleto aunque conozcamos el número de licencia.
      actoFinal: {
        cierreDesconocido: true,
        ...(r.noLicencia && r.noLicencia.trim().length > 0 ? { numero: r.noLicencia.trim() } : {}),
      },
      ...(predio ? { predio } : {}),
      esPrueba: false,
      fechaAlertaConservadora: fechaAlertaConservadoraHistorico(actuacionRadicacionReconstruida),
    };
    expedientes.push(expediente);
  }

  const advertencias: string[] = [];
  if (sinIdentidad > 0) {
    advertencias.push(
      `IDENTIDAD PENDIENTE (DF-10): ${sinIdentidad} de ${expedientes.length} planificado(s) tienen "solicitanteNombre" `
      + 'y/o "solicitanteDocumento" en blanco (dato faltante honesto, nunca inventado) — el libro histórico no registra '
      + 'número de documento para NINGÚN registro; se completan después desde la plataforma, cuando el funcionario '
      + 'ubique el expediente físico (decisión del propietario, 11-ago-2026).',
    );
  }
  if (subtiposSinResolver.length > 0) {
    advertencias.push(
      `SUBTIPO SIN RESOLVER (P1′, DF-10): ${subtiposSinResolver.length} registro(s) con un texto de "tipo" que no `
      + 'resuelve contra el catálogo normativo (EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS) se importaron igual, con '
      + 'ese texto crudo como único subtipo — ver detalle en "subtiposSinResolver".',
    );
  }
  if (expedientes.length > 0) {
    advertencias.push(
      `HISTÓRICO SIN RESOLVER (DF-10): los ${expedientes.length} expediente(s) planificados entran con `
      + `"estadoJuridico": "${ESTADO_JURIDICO_HISTORICO_SIN_RESOLVER}" y "revisionHistorica.pendiente": true — `
      + 'NINGUNO afirma un desenlace jurídico verificable, sin importar lo que dijera el campo "estado" del libro '
      + '(conservado verbatim en "estadoOriginalHistorico"). Al ser un estado PROPIO del enum, no pertenece a '
      + 'ninguna lista de estados activos (ESTADOS_EN_TRAMITE_LIBRO), así que no infla el KPI "En trámite" del '
      + 'Libro Consecutivo ni aparece como trabajo pendiente. Salir de este estado exige un acto humano: no hay '
      + 'transición automática declarada (ver TRANSICIONES en lib/motor-expedientes/estados-licencia.ts).',
    );
  }
  if (filasSinFecha.length > 0) {
    advertencias.push(`FECHA_INVALIDA: ${filasSinFecha.length} registro(s) con "fechaSolicitud" ausente o irreconocible — ${filasSinFecha.join('; ')}.`);
  }

  return {
    expedientes,
    cuarentena,
    reconciliacion: {
      totalSnapshot: registros.length,
      planificados: expedientes.length,
      enCuarentena: cuarentena.length,
      colisiones: filasColision.length,
    },
    pendientesHistorico: { sinIdentidad, sinEstadoJuridico, sinActoFinal },
    subtiposSinResolver,
    filasColision,
    datosPredio: {
      conDireccion,
      conBarrioVereda,
      conMatriculaInmobiliaria,
      conAreaTexto,
      descartes: {
        direccionEsMunicipio: descartesDireccionEsMunicipio,
        matriculaFormatoInvalido: descartesMatriculaFormatoInvalido,
        areaDesalineada: descartesAreaDesalineada,
      },
      filasAreaDesalineada,
    },
    advertencias,
  };
}

/* ──────────────────────────────────────────────
   Reporte dry-run (markdown)
────────────────────────────────────────────── */

/** Genera el reporte markdown legible del plan — reconciliación, pendientes por completar, subtipos sin resolver, colisiones, cuarentena y datos de predio. */
export function generarReporteDryRun(plan: PlanImportacion): string {
  const lineas: string[] = [];
  lineas.push('# Reporte dry-run — importador de históricos (consecutivo de licencias)');
  lineas.push('');
  lineas.push('## Reconciliación');
  lineas.push('');
  lineas.push(`- Total en el snapshot: **${plan.reconciliacion.totalSnapshot}**`);
  lineas.push(`- Planificados (se importan): **${plan.reconciliacion.planificados}**`);
  lineas.push(`- En cuarentena (NO se importan): **${plan.reconciliacion.enCuarentena}**`);
  lineas.push(`- Colisiones de radicado detectadas (no bloquean, se marcan): **${plan.reconciliacion.colisiones}**`);
  lineas.push('');

  lineas.push('## Pendientes por completar (DF-10) — entre los planificados');
  lineas.push('');
  lineas.push(
    'Ningún registro se deja fuera del libro por faltarle esto — se importa con el dato en blanco/marcado y queda '
    + 'trazable para que un funcionario lo complete después (`ExpedienteLicenciaDoc.revisionHistorica`).',
  );
  lineas.push('');
  lineas.push(`- Sin cédula del solicitante: **${plan.pendientesHistorico.sinIdentidad}**`);
  lineas.push(`- Sin estado jurídico verificable ("histórico sin resolver"): **${plan.pendientesHistorico.sinEstadoJuridico}**`);
  lineas.push(`- Sin acto final completo: **${plan.pendientesHistorico.sinActoFinal}**`);
  lineas.push(`- Con subtipo sin resolver (texto crudo, P1′): **${plan.subtiposSinResolver.length}**`);
  lineas.push('');

  if (plan.subtiposSinResolver.length > 0) {
    lineas.push('### Filas con subtipo sin resolver (P1′ — texto crudo importado como subtipo)');
    lineas.push('');
    lineas.push('| Radicado | Hoja | Fila | Tipo original |');
    lineas.push('|---|---|---|---|');
    for (const f of plan.subtiposSinResolver) {
      lineas.push(`| ${f.radicado} | ${f.hoja} | ${f.fila} | ${f.tipoOriginal} |`);
    }
    lineas.push('');
  }

  if (plan.filasColision.length > 0) {
    lineas.push('### Filas en colisión de radicado (no bloquean; ambas se importan con `numeroExpediente.colision: true`)');
    lineas.push('');
    lineas.push('| Radicado | Hoja | Fila |');
    lineas.push('|---|---|---|');
    for (const f of plan.filasColision) {
      lineas.push(`| ${f.radicado} | ${f.hoja} | ${f.fila} |`);
    }
    lineas.push('');
  }

  lineas.push('## Cuarentena (única puerta real: fecha inválida)');
  lineas.push('');
  lineas.push(`- **Fecha de solicitud inválida/ausente**: ${plan.cuarentena.length} registro(s)`);
  lineas.push('');

  lineas.push('## Datos de predio');
  lineas.push('');
  lineas.push(
    `Calculado sobre los **${plan.reconciliacion.totalSnapshot}** registros del snapshot completo — el predio es `
    + 'ortogonal a la cuarentena y a los pendientes de completar, así que un registro en cuarentena por fecha igual '
    + 'cuenta aquí si su columna de predio es aprovechable. Ningún dato de predio ausente o descartado es motivo '
    + 'de cuarentena por sí mismo.',
  );
  lineas.push('');
  lineas.push(`- Con dirección aprovechable: **${plan.datosPredio.conDireccion}**`);
  lineas.push(`- Con barrio/vereda: **${plan.datosPredio.conBarrioVereda}**`);
  lineas.push(`- Con matrícula inmobiliaria válida: **${plan.datosPredio.conMatriculaInmobiliaria}**`);
  lineas.push(`- Con área (texto) reconocible: **${plan.datosPredio.conAreaTexto}**`);
  lineas.push(`- Descartados — dirección = nombre del municipio, no es una dirección real: **${plan.datosPredio.descartes.direccionEsMunicipio}**`);
  lineas.push(`- Descartados — matrícula con formato irreconocible: **${plan.datosPredio.descartes.matriculaFormatoInvalido}**`);
  lineas.push(`- Descartados — área desalineada (columna con dirección/vereda en vez de área): **${plan.datosPredio.descartes.areaDesalineada}**`);
  lineas.push('');

  if (plan.datosPredio.filasAreaDesalineada.length > 0) {
    lineas.push('### Filas con AREA_DESALINEADA (corregir la columna "area" en el libro de origen)');
    lineas.push('');
    lineas.push('| Radicado | Hoja | Fila | Valor original |');
    lineas.push('|---|---|---|---|');
    for (const f of plan.datosPredio.filasAreaDesalineada) {
      lineas.push(`| ${f.radicado} | ${f.hoja} | ${f.fila} | ${f.valorOriginal} |`);
    }
    lineas.push('');
  }

  if (plan.advertencias.length > 0) {
    lineas.push('## Advertencias');
    lineas.push('');
    for (const a of plan.advertencias) lineas.push(`- ${a}`);
    lineas.push('');
  }

  lineas.push('## Detalle de cuarentena (por registro)');
  lineas.push('');
  lineas.push('| Radicado | Hoja | Fila | Motivos | Colisión |');
  lineas.push('|---|---|---|---|---|');
  for (const c of plan.cuarentena) {
    lineas.push(`| ${c.radicado} | ${c.hoja} | ${c.fila} | ${c.motivos.join(', ')} | ${c.colision ? 'sí' : 'no'} |`);
  }
  lineas.push('');

  return lineas.join('\n');
}
