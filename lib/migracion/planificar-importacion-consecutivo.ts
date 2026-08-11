/**
 * Planificador PURO de la importación del consecutivo histórico de
 * licencias (Bloque "Importador de históricos", ago-2026) — Fase 5
 * (expedientes RECONSTRUIDOS, ADR-0029 DF-9).
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
 *  - `resolverEstadoOperativo`/`EQUIVALENCIAS_ESTADOS_OPERATIVOS_SEMILLA`
 *    (`./equivalencia-estados-operativos.ts`, estructura P4′ nueva) para el
 *    hito jurídico (eje P4′).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * REGLA DURA — por qué HOY el dry-run planifica 0 importables:
 *
 * Un registro histórico solo se planifica como expediente si TODAS estas
 * puertas pasan:
 *  1. `tipo` resuelve a códigos de subtipo (P1′) — `resolverEquivalencia`.
 *  2. `estado` resuelve a un hito jurídico (P4′) — `resolverEstadoOperativo`.
 *  3. `fechaSolicitud` es una fecha calendario válida y reconocible.
 *  4. El solicitante tiene nombre Y número de documento — HALLAZGO de esta
 *     implementación, no parte del encargo original: `solicitanteNombre` y
 *     `solicitanteDocumento` son campos OBLIGATORIOS del modelo
 *     `Expediente`. El número de documento/cédula NUNCA existió en el
 *     libro histórico (verificado contra las 202 filas reales, en NINGUNA
 *     versión del snapshot) — bloquea el 100% de los registros por sí
 *     solo. El NOMBRE sí existe en el libro real, pero remediación PII
 *     (ago-2026, Ley 1581/2012): el archivo que corre en CI/se versiona
 *     (`consecutivo-licencias-snapshot.sanitizado.json`) lo retira a
 *     propósito — los nombres propios nunca entran a la historia de git,
 *     ni en un repo privado (la historia es permanente). Contra ESE
 *     archivo, esta puerta también bloquea el 100% por el lado del
 *     nombre; contra el `.local.json` (máquina autorizada, con nombres),
 *     solo bloquea por el lado del documento — el resultado numérico
 *     (0 planificados) es idéntico en ambos casos, cambia únicamente el
 *     detalle textual de POR QUÉ. Inventar un valor de relleno (aunque
 *     fuera `''` o un marcador tipo "[REDACTADO]") sería exactamente lo
 *     que "sin inventar nada ausente" prohíbe — redactar (omitir) no es
 *     lo mismo que inventar. Esta puerta seguirá bloqueando incluso
 *     después de que P1′ y P4′ respondan, salvo que el propietario decida
 *     una fuente alterna para la identidad o se relaje el modelo. Se
 *     reporta como advertencia aparte (no se mezcla con P1′/P4′, que sí
 *     estaban en el encargo).
 *
 * Con la semilla PROVISIONAL de hoy (100% CUARENTENA en la tabla de
 * estados operativos — ver `equivalencia-estados-operativos.ts`), la
 * puerta 2 por sí sola YA quarentena el 100% del snapshot real. El
 * resultado esperado y CORRECTO del dry-run: **0 planificados, ~202 en
 * cuarentena**. El reporte (`generarReporteDryRun`) desglosa CUÁNTOS
 * registros desbloquea cada respuesta pendiente, para que el propietario y
 * el ingeniero vean el impacto exacto de responder P1′/P4′ (y, aparte, de
 * decidir qué hacer con la identidad del solicitante).
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
  EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS,
} from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { resolverEquivalencia, normalizarTextoHistorico } from '@/lib/motor-expedientes/equivalencia-migracion';
import {
  EQUIVALENCIAS_ESTADOS_OPERATIVOS_SEMILLA,
  resolverEstadoOperativo,
} from './equivalencia-estados-operativos';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import type { EstadoExpediente, DatosPredio } from '@/lib/motor-expedientes/tipos';
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
   * planificador es el MISMO código en ambos casos — la puerta
   * IDENTIDAD_INCOMPLETA (ver más abajo) exige este campo igual que
   * `solicitanteDocumento`, así que la ausencia (sanitizado) o presencia
   * (local) no cambia la reconciliación, solo el detalle textual de la
   * cuarentena.
   */
  solicitante?: string;
  /**
   * Número de documento del solicitante. Optativo porque el libro
   * histórico REAL de Simacota (ambas versiones, sanitizada y local) no
   * tiene esta columna — no existe en ninguna de las 202 filas — así que
   * para ese snapshot esto siempre es `undefined` y la puerta
   * IDENTIDAD_INCOMPLETA (ver `planificarImportacion`) los manda a todos
   * a cuarentena, honestamente. Se declara aquí (en vez de omitirse del
   * tipo) para que una fuente FUTURA que sí traiga el dato pueda usar el
   * mismo planificador sin cambios de código — y para que los tests
   * sintéticos puedan ejercer el camino "importable".
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

export type MotivoCuarentena =
  | 'CODIGO_PENDIENTE_P1'
  | 'ESTADO_PENDIENTE_P4'
  | 'FECHA_INVALIDA'
  | 'IDENTIDAD_INCOMPLETA';

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
  /** Puede tener más de un motivo simultáneo (p. ej. código Y estado sin mapear a la vez) — cada uno se cuenta aparte en el reporte. */
  motivos: MotivoCuarentena[];
  /** Explicación legible, un elemento por motivo (mismo orden que `motivos`). */
  detalle: string[];
  colision: boolean;
}

export interface Reconciliacion {
  totalSnapshot: number;
  planificados: number;
  enCuarentena: number;
  /** Registros (no pares) involucrados en una colisión de `radicado` repetido — el caso 25-0037 real cuenta 2. */
  colisiones: number;
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
 * las puertas P1′/P4′/fecha/identidad, así que estos conteos se acumulan
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

/**
 * Deriva el estado OPERATIVO (panel, `EstadoExpediente`) desde el hito
 * JURÍDICO resuelto — simplificación DECLARADA (Principio 13): hoy no hay
 * ninguna fila `MAPEADO` en `EQUIVALENCIAS_ESTADOS_OPERATIVOS_SEMILLA`, así
 * que esta rama no se ejerce contra datos reales todavía (solo en tests
 * sintéticos); cuando P4′ responda y se llenen filas `MAPEADO`, esta
 * heurística puede necesitar revisión humana en vez de asumirse correcta
 * en producción sin más validación.
 */
function estadoOperativoDesdeJuridico(estadoJuridico: EstadoJuridicoLicencia): EstadoExpediente {
  const CERRADOS: readonly EstadoJuridicoLicencia[] = ['CONCEDIDA', 'NEGADA', 'DESISTIDA', 'NOTIFICADA', 'EN_FIRME'];
  return CERRADOS.includes(estadoJuridico) ? 'ARCHIVADO' : 'EN_REVISION';
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
 *    motivo de cuarentena del registro: el predio es ortogonal a las
 *    puertas P1′/P4′/fecha/identidad.
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

const FUENTE_PROVENANCE = 'xlsx-consecutivo-2022-2026';

// `resolverEquivalencia` toma `EquivalenciaMigracion[]` (mutable) — la
// semilla se declara `as const` (DF-4) para que TS la valide como tupla de
// literales; el spread la vuelve mutable para la llamada sin tocar la
// semilla ni el tipo del parámetro (mismo idioma ya usado en los tests de
// DF-4, `__tests__/catalogo-subtipos-normativo.test.ts`).
const TABLA_EQUIVALENCIAS_CODIGO = [...EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS];

export interface TablasEquivalencia {
  /** Default: `EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS` (DF-4) — inyectable para tests sintéticos que necesiten ejercer el camino "importable" sin esperar a P1′. */
  codigos?: Parameters<typeof resolverEquivalencia>[1];
  /** Default: `EQUIVALENCIAS_ESTADOS_OPERATIVOS_SEMILLA` — inyectable por el mismo motivo, del lado P4′. */
  estados?: Parameters<typeof resolverEstadoOperativo>[1];
}

/**
 * Planifica la importación completa del snapshot — PURA, determinista dado
 * `ahora` (usada solo para `fechaImportacion` de `provenance`, NUNCA para
 * `creadoEn`, que sale siempre de `fechaSolicitud`). `tablas` es opcional y
 * por defecto usa las semillas reales del proyecto — existe para que los
 * tests sintéticos puedan inyectar una tabla con alguna fila `MAPEADO` y
 * ejercer el camino "importable" sin depender de que P1′/P4′ ya hayan
 * respondido (mismo principio de inyección de dependencias que
 * `resolverEquivalencia`/`resolverEstadoOperativo` ya usan: la tabla es un
 * parámetro, nunca un import fijo dentro de la función pura).
 */
export function planificarImportacion(
  snapshot: SnapshotConsecutivoLicencias,
  ahora: Date,
  tablas: TablasEquivalencia = {},
): PlanImportacion {
  const tablaCodigos = tablas.codigos ?? TABLA_EQUIVALENCIAS_CODIGO;
  const tablaEstados = tablas.estados ?? EQUIVALENCIAS_ESTADOS_OPERATIVOS_SEMILLA;
  const registros = snapshot.registros;

  // Colisiones de `radicado` — se detectan sobre TODO el snapshot, antes y
  // con independencia de a dónde termine cada registro (importado o en
  // cuarentena): DF-9 exige que la colisión se REPORTE siempre, no solo
  // cuando el registro sea importable.
  const porRadicado = new Map<string, number>();
  for (const r of registros) porRadicado.set(r.radicado, (porRadicado.get(r.radicado) ?? 0) + 1);
  const esColision = (radicado: string) => (porRadicado.get(radicado) ?? 0) > 1;
  const colisiones = registros.filter((r) => esColision(r.radicado)).length;

  const expedientes: ExpedienteLicenciaDoc[] = [];
  const cuarentena: RegistroEnCuarentena[] = [];
  const fechaImportacion = ahora.toISOString();

  let algunoSinDocumento = false;
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

  for (const r of registros) {
    const motivos: MotivoCuarentena[] = [];
    const detalle: string[] = [];

    const equivalenciaCodigo = resolverEquivalencia(r.tipo, tablaCodigos);
    if (equivalenciaCodigo === null) {
      motivos.push('CODIGO_PENDIENTE_P1');
      detalle.push(`El tipo histórico "${r.tipo}" no tiene equivalencia confirmada en el catálogo normativo de subtipos (P1′).`);
    }

    const resolucionEstado = resolverEstadoOperativo(r.estado, tablaEstados);
    if (resolucionEstado.resultado === 'CUARENTENA') {
      motivos.push('ESTADO_PENDIENTE_P4');
      detalle.push(resolucionEstado.motivo);
    }

    const fecha = parsearFechaHistoricaANoonISO(r.fechaSolicitud);
    if (!fecha) {
      motivos.push('FECHA_INVALIDA');
      detalle.push(`"fechaSolicitud" ausente o con formato irreconocible: "${r.fechaSolicitud ?? ''}".`);
      filasSinFecha.push(`hoja ${r.hoja}, fila ${r.fila} (radicado ${r.radicado})`);
    }

    // IDENTIDAD_INCOMPLETA cubre AMBOS campos de la identidad del
    // solicitante — nombre Y documento — porque `Expediente.solicitanteNombre`
    // y `.solicitanteDocumento` son los dos obligatorios del modelo. Cuál de
    // los dos falta puede variar por ENTORNO (sanitizado en CI retira el
    // nombre a propósito; el libro histórico REAL nunca tuvo documento, en
    // ninguna versión) — el detalle distingue cuál, sin inventar ningún
    // valor de relleno para el que falte (redactar ≠ inventar).
    const tieneNombre = Boolean(r.solicitante && r.solicitante.trim().length > 0);
    const tieneDocumento = Boolean(r.solicitanteDocumento && r.solicitanteDocumento.trim().length > 0);
    if (!tieneNombre || !tieneDocumento) {
      algunoSinDocumento = true;
      motivos.push('IDENTIDAD_INCOMPLETA');
      if (!tieneNombre && !tieneDocumento) {
        detalle.push('Falta el nombre Y el número de documento del solicitante; ambos son obligatorios en el modelo y no pueden completarse sin inventar un valor.');
      } else if (!tieneNombre) {
        detalle.push('Falta el nombre del solicitante (retirado en la versión sanitizada que corre en CI — Ley 1581/2012; presente solo en la versión local con datos personales); "solicitanteNombre" es obligatorio en el modelo.');
      } else {
        detalle.push('El libro histórico no registra número de documento del solicitante; "solicitanteDocumento" es obligatorio en el modelo y no puede completarse sin inventar un valor.');
      }
    }

    // Predio (TAREA 3): se calcula para TODO registro, sin importar el
    // destino (importado o cuarentena) — ortogonal a las puertas de arriba.
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

    if (motivos.length > 0) {
      cuarentena.push({
        radicado: r.radicado,
        hoja: r.hoja,
        fila: r.fila,
        solicitante: r.solicitante,
        motivos,
        detalle,
        colision: esColision(r.radicado),
      });
      continue;
    }

    // Puertas todas pasadas — HOY inalcanzable contra el snapshot real
    // (ESTADO_PENDIENTE_P4 e IDENTIDAD_INCOMPLETA quarentenan el 100%),
    // pero el camino existe y lo ejercen los tests sintéticos.
    const estadoJuridico = (resolucionEstado as Extract<typeof resolucionEstado, { resultado: 'MAPEADO' }>).estadoJuridico;
    const codigos = equivalenciaCodigo as string[];
    // Guarda de tipos: `motivos.length === 0` en este punto implica, por
    // construcción del bucle de arriba, que `fecha` no es null (si lo
    // fuera, 'FECHA_INVALIDA' habría entrado a `motivos` y ya se habría
    // hecho `continue`). TS no correlaciona ramas de `if` distintas, así
    // que se deja explícito en vez de un `!` no comentado.
    if (!fecha) continue;

    const expediente: ExpedienteLicenciaDoc = {
      id: `hist-${r.hoja}-${r.fila}`,
      tenantId: 'SEC_PLANEACION',
      tramiteId: SIN_DEFINICION_TRAMITE_HISTORICO,
      estado: estadoOperativoDesdeJuridico(estadoJuridico),
      estadoJuridico,
      // No-null por la puerta IDENTIDAD_INCOMPLETA (arriba): si `r.solicitante`
      // o `r.solicitanteDocumento` estuvieran vacíos/ausentes, ya se habría
      // entrado a `motivos` y hecho `continue` — ninguno de los dos llega
      // aquí sin estar presente.
      solicitanteNombre: r.solicitante!.trim(),
      solicitanteDocumento: r.solicitanteDocumento!.trim(),
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
      subtipos: codigos,
      origen: 'RECONSTRUIDO',
      provenance: {
        fuente: FUENTE_PROVENANCE,
        fechaImportacion,
        sha256: snapshot._procedencia.sha256,
        hoja: r.hoja,
        fila: r.fila,
      },
      // `cierreDesconocido: true` se mantiene aunque `numero` esté presente:
      // `validarCierreExpediente` (`./estados-licencia.ts`) exige numero Y
      // fecha Y fechaFirmeza para considerar el acto COMPLETO — el libro
      // histórico nunca trae las dos últimas, así que el acto sigue
      // incompleto aunque conozcamos el número de licencia.
      actoFinal: {
        cierreDesconocido: true,
        ...(r.noLicencia && r.noLicencia.trim().length > 0 ? { numero: r.noLicencia.trim() } : {}),
      },
      ...(predio ? { predio } : {}),
      esPrueba: false,
    };
    expedientes.push(expediente);
  }

  const advertencias: string[] = [];
  if (algunoSinDocumento) {
    advertencias.push(
      'IDENTIDAD_INCOMPLETA (hallazgo, fuera del encargo original de P1′/P4′): el libro histórico no registra número '
      + 'de documento del solicitante para NINGÚN registro. Esta puerta seguirá bloqueando el 100% de los registros '
      + 'incluso después de que P1′ y P4′ respondan, salvo que el propietario decida una fuente alterna para la '
      + 'identidad o se relaje el modelo — requiere decisión aparte, no se resuelve solo con las dos tablas de equivalencias.',
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
      colisiones,
    },
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

/** Genera el reporte markdown legible del plan — reconciliación, cuarentenas agrupadas por motivo con conteos, advertencias. */
export function generarReporteDryRun(plan: PlanImportacion): string {
  const lineas: string[] = [];
  lineas.push('# Reporte dry-run — importador de históricos (consecutivo de licencias)');
  lineas.push('');
  lineas.push('## Reconciliación');
  lineas.push('');
  lineas.push(`- Total en el snapshot: **${plan.reconciliacion.totalSnapshot}**`);
  lineas.push(`- Planificados (importables HOY): **${plan.reconciliacion.planificados}**`);
  lineas.push(`- En cuarentena: **${plan.reconciliacion.enCuarentena}**`);
  lineas.push(`- Colisiones de radicado detectadas: **${plan.reconciliacion.colisiones}**`);
  lineas.push('');

  const conteosPorMotivo = new Map<MotivoCuarentena, number>();
  for (const c of plan.cuarentena) {
    for (const m of c.motivos) conteosPorMotivo.set(m, (conteosPorMotivo.get(m) ?? 0) + 1);
  }
  const ETIQUETAS: Record<MotivoCuarentena, string> = {
    CODIGO_PENDIENTE_P1: 'Códigos pendientes (P1′)',
    ESTADO_PENDIENTE_P4: 'Estados pendientes (P4′)',
    FECHA_INVALIDA: 'Fecha de solicitud inválida/ausente',
    IDENTIDAD_INCOMPLETA: 'Identidad del solicitante incompleta (hallazgo)',
  };

  lineas.push('## Cuarentena, agrupada por motivo');
  lineas.push('');
  const orden: MotivoCuarentena[] = ['CODIGO_PENDIENTE_P1', 'ESTADO_PENDIENTE_P4', 'FECHA_INVALIDA', 'IDENTIDAD_INCOMPLETA'];
  for (const motivo of orden) {
    const n = conteosPorMotivo.get(motivo) ?? 0;
    lineas.push(`- **${ETIQUETAS[motivo]}**: ${n} registro(s)`);
  }
  lineas.push(`- **Colisión de radicado** (ya contadas arriba, no es un motivo de cuarentena aparte): ${plan.cuarentena.filter((c) => c.colision).length} registro(s) en cuarentena que además colisionan`);
  lineas.push('');

  lineas.push('## Datos de predio');
  lineas.push('');
  lineas.push(
    `Calculado sobre los **${plan.reconciliacion.totalSnapshot}** registros del snapshot completo — el predio es `
    + 'ortogonal a las puertas P1′/P4′/fecha/identidad, así que un registro en cuarentena por otro motivo igual '
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
