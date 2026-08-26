/**
 * Presentación del Libro Consecutivo — Bloque C ("el reemplazo del
 * Excel"). Funciones PURAS de mapeo/orden/exportación, sin fetch ni React:
 * `LibroConsecutivoClient.tsx` es el único caller, pero viven aparte para
 * que el generador de CSV (el dato más sensible: es lo que reemplaza el
 * archivo operativo real del ingeniero) se pueda probar con datos
 * sintéticos sin montar el componente — mismo patrón de extracción que
 * `presentacion-actuaciones.ts`/`presentacion-subtipos.ts`.
 *
 * Fuente del contrato de columnas: `docs/planes/
 * ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md` (H1, glosario §10). El Excel
 * real de Planeación lleva: fecha solicitud, fecha resolución, No.
 * radicado (=numeroExpediente), propietario/solicitante, tipo de licencia,
 * No. de licencia, estado, correcciones — este módulo mapea esas mismas
 * columnas a los campos REALES que ya expone `GET /api/licencias/
 * expedientes` (`ExpedienteLicenciaDoc`), sin inventar ninguno que el
 * motor no tenga todavía (fecha de resolución/No. de licencia: H5, 0/202
 * llenos hoy — se muestran honestos como "—", nunca "TBD" ni una fecha
 * calculada).
 */

import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { terminoResolucionSigueCorriendo, type EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import type { OrigenActuacion } from '@/lib/motor-expedientes/tipos';
import { calcularVencimientoVigencia, esErrorVigencia } from '@/lib/motor-expedientes/vigencias';
import { EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { normalizarTextoHistorico } from '@/lib/motor-expedientes/equivalencia-migracion';
import { atLocalNoon, diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { ESTILOS_ESTADO_JURIDICO } from './estilos-estado-juridico';
import { nombreSubtipo } from './presentacion-subtipos';
import { formatFechaColombia, safeDate, TIMEZONE_COLOMBIA } from '@/lib/fecha-colombia';

/**
 * Umbral "por vencer" del Libro — MISMO valor y MISMA justificación que
 * `UMBRAL_POR_VENCER_DIAS_HABILES` (`./fixtures.ts`, SUPUESTO EXPLÍCITO
 * Principio 13, sin validar con Planeación todavía). Se declara aparte en
 * vez de importarlo: `fixtures.ts` es el módulo de los FIXTURES de la
 * Fase 1 (Actuacion[] de juguete) — importarlo desde aquí acoplaría este
 * módulo de datos reales a ese archivo de demo por una sola constante.
 * Mismo número, mismo criterio; si Planeación valida un umbral distinto,
 * este es el único punto a cambiar para el Libro.
 */
export const UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO = 5;

/**
 * Partición de `EstadoJuridicoLicencia` para el KPI/filtro "En trámite" del
 * Libro — MISMO criterio que `ESTADOS_EN_TRAMITE` de `BandejaLicenciasClient.tsx`
 * (no importado desde ahí a propósito: ese archivo es un Client Component
 * que arrastra sus propios modales/imports; este módulo debe seguir siendo
 * PURO, sin React — mismo principio que ya declara el JSDoc de cabecera).
 * SUPUESTO EXPLÍCITO (Principio 13), igual que en la Bandeja: sin guía
 * operativa validada con Planeación para agrupar los 9 estados jurídicos.
 */
const ESTADOS_EN_TRAMITE_LIBRO: readonly EstadoJuridicoLicencia[] = [
  // Ver la nota de BandejaLicenciasClient: sin esta entrada el estado previo
  // se vuelve invisible en el filtro «en trámite» del libro.
  'PRESENTADA',
  'RADICADA_EN_DEBIDA_FORMA',
  'EN_REVISION',
  'CON_ACTA_DE_OBSERVACIONES',
  'EN_VIABILIDAD',
];

/** Fila de presentación del Libro Consecutivo — una por expediente. */
export interface FilaLibroConsecutivo {
  id: string;
  /** Texto ya formateado (mono en pantalla) — `numeroExpediente.numero` o, a falta de él, el id del documento. */
  numeroExpediente: string;
  /**
   * ISO 8601 — día en que el expediente quedó RADICADO EN LEGAL Y DEBIDA
   * FORMA. `null` mientras eso no haya ocurrido (PRESENTADA) y en los
   * históricos reconstruidos.
   *
   * Hasta el 26-ago-2026 este campo se llenaba con `creadoEn` y su JSDoc
   * afirmaba que ese valor ERA la fecha de debida forma. Desde el ADR-0033
   * es falso: `creadoEn` es el día en que se abrió la carpeta, y el
   * expediente nace en PRESENTADA. La columna rotulada «Fecha radicación»
   * —en pantalla y en el CSV que reemplaza el Excel de Planeación— estaba
   * afirmando que el término de 45 días hábiles arrancó un día en que no
   * había arrancado. Un vacío honesto vale más que una fecha cómoda.
   */
  fechaRadicacion: string | null;
  /** ISO 8601 — día en que se abrió el expediente. Es un hecho distinto, y se muestra aparte. */
  fechaApertura: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  /** Nombres legibles de los subtipos declarados, en el orden del expediente — p. ej. `['Licencia de construcción']`. INTOCADO (fuente del CSV, `generarCsvLibroConsecutivo`) — para códigos crudos usar `subtipoCodigos`. */
  subtipos: string[];
  /** Códigos crudos de `exp.subtipos`, MISMO orden que `subtipos` — insumo del rediseño (chip de cuarentena, cómputo de vigencia); el CSV nunca lee este campo. */
  subtipoCodigos: string[];
  estadoJuridico: EstadoJuridicoLicencia;
  /** `actoFinal.numero` — `null` si el expediente aún no cierra (H5: hoy la норма, no la excepción). */
  numeroLicencia: string | null;
  /** ISO 8601 de `actoFinal.fechaFirmeza` — `null` si no hay (DF-6: dispara vigencias, casi siempre ausente hoy). */
  fechaFirmeza: string | null;
  esPrueba: boolean;
  /** `Expediente.origen` (`REAL` por defecto — mismo default que usa `DetalleLicenciaClient`). */
  origen: OrigenActuacion;
  /**
   * Espejo denormalizado que el servidor persiste en el documento raíz del
   * expediente, en la MISMA transacción que cada actuación (ver su JSDoc en
   * `lib/server/expedientes-licencias.ts`): así la bandeja lo trae sin
   * lecturas extra de la subcolección `actuaciones` (R11, evita N+1).
   * `null` cuando el servidor no pudo proyectar término — expedientes
   * escritos antes de que el campo existiera, y RECONSTRUIDOS, cuyas
   * actuaciones no mueven relojes legales (R9). En ambos casos la columna
   * se ve honestamente vacía ("—"): NUNCA se recalcula aquí (el cómputo
   * real es `derivarEventosTermino`/`calcularVencimientoDual`, del
   * servidor) ni se inventa un valor.
   */
  fechaAlertaConservadora: string | null;
  /** Vencimiento de la vigencia del acto — ver `calcularVigenciaHastaLibro`. `null` sin `actoFinal.fechaFirmeza` (la vigencia no corre todavía) o si el régimen no se puede resolver (p. ej. falta modalidad). */
  vigenciaHasta: string | null;
  /** Motivo técnico cuando `fechaFirmeza` existe pero `vigenciaHasta` no se pudo calcular — solo para tooltip, nunca se imprime como dato. */
  vigenciaHastaError?: string;
  /** `true` si `solicitanteDocumento` viene vacío/en blanco — dato faltante honesto (histórico reconstruido, R6), nunca inventado. */
  faltaCedula: boolean;
  /** `true` si `estadoJuridico` no es uno de los 9 valores conocidos (`ESTILOS_ESTADO_JURIDICO`) — defensivo: el documento real puede no cumplir el tipo TS en tiempo de ejecución (dato legado/corrupto). */
  faltaEstadoJuridico: boolean;
  /**
   * `Expediente.radicadoId` — número de radicado Ventanilla vinculado,
   * `null` si el expediente aún no tiene handoff. Insumo del buscador
   * rápido (ver sección "Buscador rápido" más abajo). Opcional en el TIPO
   * (a diferencia del resto de campos de esta interfaz) para no romper los
   * fixtures que ya construyen `FilaLibroConsecutivo` a mano en
   * `__tests__/presentacion-libro-consecutivo.test.ts` sin pasar por
   * `construirFilasLibroConsecutivo` — el buscador trata "ausente" igual
   * que `null`.
   */
  radicadoId?: string | null;
  /**
   * `predio?.matriculaInmobiliaria` del expediente (`DatosPredio`,
   * `lib/motor-expedientes/tipos.ts`) — insumo del buscador rápido, no se
   * pinta como columna propia (no lo pidió el rediseño de la tabla).
   * MISMA razón de opcionalidad que `radicadoId`.
   */
  matriculaInmobiliaria?: string | null;
  /**
   * `numeroExpediente.colision` tal cual viene del documento — NUNCA se
   * deriva aquí. Es la declaración del importador: ese número legal aparecía
   * más de una vez en su propia fuente (ver el JSDoc del campo en
   * `lib/motor-expedientes/tipos.ts`). Caso REAL en producción desde el
   * 11-ago-2026: `68745-0-25-0037`, dos solicitantes distintos (17-sep y
   * 30-sep-2025, modalidades LA y LR) — H4/R1 de
   * `docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`.
   *
   * Por qué no se deriva comparando números repetidos en la vista: dos filas
   * con el mismo texto podrían venir de un fallback al `id` del documento o
   * de un lote truncado, y el Libro inventaría una infracción que nadie
   * declaró. El Libro DELATA la anomalía que el importador marcó; no la
   * diagnostica.
   */
  colision: boolean;
  /**
   * Los OTROS expedientes del mismo año cargado que comparten este número
   * legal — para que la funcionaria sepa con cuál colisiona, que es lo que
   * necesita para resolver (pregunta P6 a Planeación).
   *
   * ALCANCE DECLARADO (Principio 13): se deriva de las filas del año que la
   * vista tiene en memoria, acotadas por `LIMITE_BANDEJA` (300). Una lista
   * vacía NO significa "no hay gemelo" — significa "no está en esta vista"
   * (otro año, o fuera del lote). Por eso jamás enciende la marca: eso solo
   * lo hace `colision`, que sí es dato persistido.
   */
  otrosConMismoNumero: { id: string; solicitanteNombre: string; fechaApertura: string }[];
}

/** `true` si el valor es un string vacío/solo espacios (o no es string) — mismo criterio de "faltante" para cédula y demás campos de texto de la fila. */
function estaVacio(valor: unknown): boolean {
  return typeof valor !== 'string' || valor.trim().length === 0;
}

/**
 * Vencimiento de la vigencia del acto para una fila del Libro:
 *  1. Sin `fechaFirmeza` → `null` (la vigencia no corre todavía — nunca se
 *     promete un plazo sin firmeza).
 *  2. Con `actoFinal.vigenciaHasta` YA persistido (`ActoFinalExpediente.
 *     vigenciaHasta`, `lib/motor-expedientes/tipos.ts`) → se usa tal cual,
 *     es el dato real más autorizado que existe.
 *  3. `actoFinal.cierreDesconocido` (migración sin detalle confiable) → no
 *     se calcula: el JSDoc de `calcularVencimientoVigencia` es explícito en
 *     que esos casos "no tienen fechaFirmeza confiable".
 *  4. En cualquier otro caso, se deriva con la MISMA función pura que ya
 *     usa el servidor para `computos.vigencia` (`GET .../[id]/route.ts`) y
 *     con los MISMOS insumos (`fechaFirmeza` + `subtipos`, sin
 *     `modalidadConstruccion` — dato que ningún expediente captura hoy) —
 *     cero divergencia posible entre lo que ve el Libro y lo que ve el
 *     Detalle, porque es literalmente la misma llamada.
 */
function calcularVigenciaHastaLibro(exp: ExpedienteLicenciaDoc): { fecha: string | null; error?: string } {
  const fechaFirmeza = exp.actoFinal?.fechaFirmeza;
  if (!fechaFirmeza) return { fecha: null };
  if (exp.actoFinal?.vigenciaHasta) return { fecha: exp.actoFinal.vigenciaHasta };
  if (exp.actoFinal?.cierreDesconocido) return { fecha: null };

  const resultado = calcularVencimientoVigencia({ fechaFirmeza, subtipos: exp.subtipos ?? [] });
  if (esErrorVigencia(resultado)) {
    return { fecha: null, error: resultado.mensaje };
  }
  return { fecha: resultado.vencimiento.toISOString() };
}

/**
 * Textos históricos en CUARENTENA (`EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS`,
 * `lib/motor-expedientes/catalogo-subtipos-normativo.ts`, DF-4/ADR-0029) —
 * normalizados una sola vez a nivel de módulo. `resolverEquivalencia` de
 * `lib/motor-expedientes/equivalencia-migracion.ts` no distingue "en
 * cuarentena" de "no está en la tabla" (ambos devuelven `null`, correcto
 * para SU propósito: ninguno de los dos se resuelve); el Libro sí necesita
 * esa distinción para marcar visualmente "pendiente de identificar" en vez
 * de tratarlo como un código cualquiera — de ahí este set aparte, en vez de
 * reutilizar `resolverEquivalencia` directamente.
 */
const TEXTOS_HISTORICOS_EN_CUARENTENA = new Set(
  EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS.filter((f) => f.estado === 'CUARENTENA').map((f) =>
    normalizarTextoHistorico(f.textoHistorico),
  ),
);

/**
 * `true` si `codigo` (un elemento de `Expediente.subtipos`) coincide con un
 * texto histórico marcado en CUARENTENA — HOY (antes de la migración
 * Fase 5) ningún expediente real puede tener esto, porque una fila en
 * cuarentena mapea a `codigos: []` (nada que guardar); es una defensa hacia
 * adelante para cuando la migración exista, y lo que este bloque pide
 * probar explícitamente con datos sintéticos ("datos feos").
 */
export function esSubtipoEnCuarentena(codigo: string): boolean {
  return TEXTOS_HISTORICOS_EN_CUARENTENA.has(normalizarTextoHistorico(codigo));
}

/** Un subtipo de la fila, ya resuelto a nombre legible + bandera de cuarentena — insumo directo de la columna "Tipo" compacta. */
export interface SubtipoLibro {
  codigo: string;
  nombre: string;
  enCuarentena: boolean;
}

/** Resuelve `subtipoCodigos` de una fila a la forma que consume la tabla — separado de `FilaLibroConsecutivo.subtipos` (que debe seguir siendo `string[]` para no tocar el CSV). */
export function subtiposConEstadoLibro(codigos: readonly string[]): SubtipoLibro[] {
  return codigos.map((codigo) => ({ codigo, nombre: nombreSubtipo(codigo), enCuarentena: esSubtipoEnCuarentena(codigo) }));
}

/**
 * Año (calendario Colombia, `America/Bogota`) en que un expediente se
 * radicó — deriva el selector de año del Libro a partir del dato real
 * (`creadoEn`), nunca de un campo `año` separado que pudiera desincronizarse.
 * `null` si `creadoEn` no es una fecha válida (dato corrupto: se excluye
 * del conteo por año en vez de agruparlo bajo un año inventado).
 */
export function añoAperturaColombia(creadoEn: string): number | null {
  const fecha = safeDate(creadoEn);
  if (!fecha) return null;
  const texto = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_COLOMBIA, year: 'numeric' }).format(fecha);
  const año = Number(texto);
  return Number.isFinite(año) ? año : null;
}

/**
 * Años seleccionables del libro: los que tienen al menos un expediente,
 * más el año en curso (aunque todavía no tenga expedientes — el selector
 * siempre debe poder mostrar "Sin expedientes en {año actual}" el primer
 * día del año). Orden descendente (el año más reciente primero).
 */
export function añosDisponiblesLibro(
  expedientes: readonly Pick<ExpedienteLicenciaDoc, 'creadoEn'>[],
  añoActual: number = new Date().getFullYear(),
): number[] {
  const años = new Set<number>([añoActual]);
  for (const exp of expedientes) {
    const año = añoAperturaColombia(exp.creadoEn);
    if (año !== null) años.add(año);
  }
  return [...años].sort((a, b) => b - a);
}

function numeroExpedienteTexto(exp: ExpedienteLicenciaDoc): string {
  return exp.numeroExpediente?.numero ?? exp.id;
}

/**
 * Filas del Libro para UN año: filtra por `año` (RN Excel: "una hoja por
 * año") y ordena ASCENDENTE por número de expediente — el orden físico de
 * un libro consecutivo, folio 1 primero. `localeCompare` con `numeric:
 * true` para que el consecutivo de 4 dígitos ordene correctamente incluso
 * si algún día conviven longitudes distintas (p. ej. el prefijo `DEMO-`).
 */
export function construirFilasLibroConsecutivo(
  expedientes: readonly ExpedienteLicenciaDoc[],
  año: number,
): FilaLibroConsecutivo[] {
  const delAño = expedientes.filter((exp) => añoAperturaColombia(exp.creadoEn) === año);
  // Índice número legal → expedientes que lo llevan, para resolver `otros
  // ConMismoNumero`. Se construye SOLO con lo que la vista tiene cargado; ver
  // el alcance declarado en el JSDoc del campo. Nunca decide `colision`.
  const porNumero = new Map<string, { id: string; solicitanteNombre: string; fechaApertura: string }[]>();
  for (const exp of delAño) {
    const numero = numeroExpedienteTexto(exp);
    const lista = porNumero.get(numero) ?? [];
    lista.push({ id: exp.id, solicitanteNombre: exp.solicitanteNombre, fechaApertura: exp.creadoEn });
    porNumero.set(numero, lista);
  }
  return delAño
    .map((exp) => {
      const subtipoCodigos = [...(exp.subtipos ?? [])];
      const vigencia = calcularVigenciaHastaLibro(exp);
      // Espejo denormalizado que el servidor persiste en el documento raíz
      // (ver su JSDoc en `lib/server/expedientes-licencias.ts`): la bandeja
      // lo trae sin lecturas extra (R11). Tres casos, colapsados aquí a
      // `null` porque la presentación los muestra igual ("—"): ausente
      // (expediente escrito antes del campo), `null` (sin ancla de
      // radicación real — típicamente RECONSTRUIDO, R9) y fecha ISO.
      const fechaAlertaConservadora = exp.fechaAlertaConservadora ?? null;
      return {
        id: exp.id,
        numeroExpediente: numeroExpedienteTexto(exp),
        fechaRadicacion: exp.fechaRadicacionDebidaForma ?? null,
        fechaApertura: exp.creadoEn,
        solicitanteNombre: exp.solicitanteNombre,
        solicitanteDocumento: exp.solicitanteDocumento,
        subtipos: subtipoCodigos.map(nombreSubtipo),
        subtipoCodigos,
        estadoJuridico: exp.estadoJuridico,
        numeroLicencia: exp.actoFinal?.numero ?? null,
        fechaFirmeza: exp.actoFinal?.fechaFirmeza ?? null,
        esPrueba: exp.esPrueba === true,
        origen: exp.origen ?? 'REAL',
        fechaAlertaConservadora,
        vigenciaHasta: vigencia.fecha,
        vigenciaHastaError: vigencia.error,
        faltaCedula: estaVacio(exp.solicitanteDocumento),
        faltaEstadoJuridico: estaVacio(exp.estadoJuridico) || !((exp.estadoJuridico as string) in ESTILOS_ESTADO_JURIDICO),
        radicadoId: exp.radicadoId ?? null,
        matriculaInmobiliaria: exp.predio?.matriculaInmobiliaria ?? null,
        colision: exp.numeroExpediente?.colision === true,
        otrosConMismoNumero: (porNumero.get(numeroExpedienteTexto(exp)) ?? []).filter((o) => o.id !== exp.id),
      };
    })
    .sort((a, b) => a.numeroExpediente.localeCompare(b.numeroExpediente, 'es', { numeric: true }));
}

/* ══════════════════════════════════════════════════════════════
   KPIs, filtros y urgencia — rediseño del Libro (tabla densa + panel
   lateral). Funciones PURAS, todas deterministas sobre `FilaLibroConsecutivo[]`
   ya construidas; ninguna hace fetch ni depende de React.
══════════════════════════════════════════════════════════════ */

export type UrgenciaFilaLibro = 'VENCIDO' | 'POR_VENCER' | 'EN_TERMINO' | 'NEUTRO';

/**
 * Banda de urgencia de una fila, por `fechaAlertaConservadora`. `NEUTRO`
 * cubre tanto "sin dato" como cualquier expediente sin ancla de término —
 * nunca se distingue una cosa de la otra con un color de urgencia, ambas se
 * ven igual de neutras ("—"). `hoy` es parámetro (no `new Date()`
 * implícito) para que el cálculo sea determinista en pruebas.
 *
 * VENCIDO se decide comparando el DÍA CIVIL del vencimiento contra el de
 * hoy, NO por el signo de `diasRestantesHabiles` — corrección de un defecto
 * encontrado en la verificación visual del 11-ago-2026: entre un
 * vencimiento y hoy puede no haber NINGÚN día hábil (p. ej. venció el
 * viernes 7-ago-2026, festivo de la Batalla de Boyacá, y hoy es lunes 10:
 * 8 y 9 son fin de semana), así que `diasRestantesHabiles` devuelve 0 y el
 * expediente —ya vencido— caía en POR_VENCER. Consecuencia real: no se
 * contaba en el filtro/KPI "Vencidos" y la franja salía ámbar en vez de
 * roja, justo lo contrario del propósito protector del módulo. El conteo
 * de días hábiles sigue gobernando el umbral de POR_VENCER (que sí es una
 * pregunta de plazo hábil), pero "¿ya pasó la fecha?" es una pregunta de
 * CALENDARIO.
 */
export function urgenciaFilaLibro(
  fila: Pick<FilaLibroConsecutivo, 'fechaAlertaConservadora' | 'estadoJuridico'>,
  hoy: Date = new Date(),
): UrgenciaFilaLibro {
  if (!fila.fechaAlertaConservadora) return 'NEUTRO';
  // Un expediente YA RESUELTO no está en mora: el término de resolución dejó
  // de correr cuando la Administración decidió (ver
  // `terminoResolucionSigueCorriendo`). Sin esta guarda, el simple paso del
  // tiempo pintaba de rojo expedientes cerrados y los sumaba a "Vencidos" —
  // defecto encontrado en la verificación E2E del 12-ago-2026, donde un
  // expediente EN FIRME anunciaba "Vencido hace 88 días hábiles".
  if (!terminoResolucionSigueCorriendo(fila.estadoJuridico)) return 'NEUTRO';
  // Ambos extremos anclados al mediodía de su día civil (`atLocalNoon`, ya
  // usada por todo el módulo): comparar sus instantes compara días civiles,
  // sin que la hora del dato pueda desplazar el resultado.
  const vencimiento = atLocalNoon(fila.fechaAlertaConservadora);
  const referencia = atLocalNoon(hoy);
  if (Number.isNaN(vencimiento.getTime())) return 'NEUTRO';
  if (vencimiento.getTime() < referencia.getTime()) return 'VENCIDO';

  const dias = diasRestantesHabiles(fila.fechaAlertaConservadora, hoy);
  if (dias <= UMBRAL_POR_VENCER_DIAS_HABILES_LIBRO) return 'POR_VENCER';
  return 'EN_TERMINO';
}

/**
 * Texto de apoyo bajo la fecha en la columna "Vence" — PURO y derivado de
 * `urgenciaFilaLibro`, no del signo de `diasRestantesHabiles`: cuando un
 * expediente vencido no tiene días hábiles de por medio (ver JSDoc de
 * arriba), decir "0 días hábiles" sería engañoso. En ese caso se dice
 * "Vencido" a secas — sin inventar un número que no significa nada.
 */
export function textoDiasVencimientoLibro(
  fila: Pick<FilaLibroConsecutivo, 'fechaAlertaConservadora' | 'estadoJuridico'>,
  hoy: Date = new Date(),
): string | null {
  if (!fila.fechaAlertaConservadora) return null;
  const urgencia = urgenciaFilaLibro(fila, hoy);
  if (urgencia === 'NEUTRO') return null;
  const dias = diasRestantesHabiles(fila.fechaAlertaConservadora, hoy);
  if (urgencia === 'VENCIDO') {
    return dias < 0 ? `Vencido hace ${Math.abs(dias)} días hábiles` : 'Vencido';
  }
  return `${dias} días hábiles`;
}

/**
 * Explicación de la colisión para el `title`/nombre accesible de la marca.
 * `null` cuando la fila no está marcada — la marca no se pinta.
 *
 * REDACCIÓN DELIBERADA (misma disciplina que `fechaAlertaConservadora` y
 * `numeroLicencia`: no afirmar lo que no se puede sostener). `colision` es
 * una aserción del importador en el instante de la migración, no un
 * invariante vivo: si el gemelo se corrigiera, se borrara, o quedara fuera
 * del lote de 300, decir "otro expediente comparte el número" sería afirmar
 * como hecho presente algo que el Libro no ve. Por eso, sin gemelo a la
 * vista, se habla del DATO ("el importador lo marcó"), no del mundo.
 */
export function textoColisionLibro(fila: Pick<FilaLibroConsecutivo, 'colision' | 'numeroExpediente' | 'otrosConMismoNumero'>): string | null {
  const cierre = 'No se renumera: la serie legal histórica es intocable — la resolución es humana, con acta.';

  // CASO 1 — el Libro VE el duplicado con sus propios ojos. Manda sobre la
  // bandera del importador: aquí no se está afirmando nada que no se pueda
  // sostener, están las dos filas cargadas y se pueden nombrar.
  //
  // Este es además el ÚNICO detector de una colisión NO declarada, y por eso
  // no está condicionado a `colision`. Un duplicado que el importador no
  // marcó —por ejemplo, una emisión real que aterrice sobre un número
  // histórico— sería invisible si esta rama exigiera esa bandera. El cálculo
  // de `otrosConMismoNumero` ya se paga en `construirFilasLibroConsecutivo`;
  // hasta el 13-ago-2026 se descartaba.
  if (fila.otrosConMismoNumero.length > 0) {
    const otros = fila.otrosConMismoNumero
      .map((o) => `${o.solicitanteNombre || 'sin nombre registrado'} (abierto el ${formatFechaColombia(o.fechaApertura)})`)
      .join('; ');
    const preludio = fila.colision
      ? `Comparte el número ${fila.numeroExpediente} con`
      : `DUPLICADO NO DECLARADO: dos expedientes de este libro llevan el número ${fila.numeroExpediente}`;
    return `${preludio}: ${otros}. ${cierre}`;
  }

  // CASO 2 — el Libro NO ve al gemelo, pero el importador dejó constancia.
  // Se habla del DATO, no del mundo: `colision` es una aserción del pasado,
  // no un invariante vivo (el gemelo pudo corregirse, borrarse, o quedar
  // fuera del lote de 300).
  if (fila.colision) {
    return `El importador marcó el número ${fila.numeroExpediente} como duplicado en el histórico. El otro expediente no aparece en esta vista (otro año, o fuera del lote cargado). ${cierre}`;
  }

  return null;
}

/** Token de color (`app/globals.css`) por banda de urgencia — franja lateral de 4 px de la fila. */
export const COLOR_URGENCIA_LIBRO: Record<UrgenciaFilaLibro, string> = {
  VENCIDO: 'var(--color-danger)',
  POR_VENCER: 'var(--color-warning)',
  EN_TERMINO: 'var(--color-success)',
  NEUTRO: 'var(--color-border)',
};

/**
 * Token de color del TEXTO de la columna "Vence" — NINGUNA banda comparte
 * valor con su franja, porque franja y texto tienen requisitos distintos.
 *
 * Los tokens base (`--color-warning`, `--color-success`, `--color-danger`)
 * están calibrados para pintar un filete de 4 px, no para leerse: medidos en
 * la aplicación real rendían 2,15:1, 3,30:1 y 4,83:1 sobre blanco, y el rojo
 * bajaba a 4,33:1 sobre fila atenuada. Las variantes `-text` de ADR-0030
 * conservan el tono y solo bajan la luminosidad — el ámbar sigue siendo
 * ámbar — y cumplen ≥4,5:1 sobre las tres superficies institucionales.
 *
 * `NEUTRO` no tiene variante `-text` porque `--color-border` es un token de
 * borde sin equivalente de texto: se usa `--text-secondary` (4,97:1), que es
 * exactamente lo que se quiere para un expediente ya resuelto — visible pero
 * bajado de jerarquía, sin leerse como incumplimiento.
 */
export const COLOR_TEXTO_URGENCIA_LIBRO: Record<UrgenciaFilaLibro, string> = {
  VENCIDO: 'var(--color-danger-text)',
  POR_VENCER: 'var(--color-warning-text)',
  EN_TERMINO: 'var(--color-success-text)',
  NEUTRO: 'var(--text-secondary)',
};

/**
 * "Histórico incompleto" = expediente `RECONSTRUIDO` (migrado) al que le
 * falta cédula o estado jurídico — SUPUESTO EXPLÍCITO (Principio 13, mismo
 * criterio que `ESTADOS_EN_TRAMITE_LIBRO`): el KPI se llama "Históricos
 * incompletos", no "Filas incompletas" — un expediente `REAL` con un dato
 * vacío (anomalía, no lo esperado) igual se marca en la fila con
 * `EtiquetaDatoFaltante` (honestidad universal), pero no infla este
 * conteo, que es específicamente sobre la calidad del histórico migrado.
 */
export function esHistoricoIncompletoLibro(
  fila: Pick<FilaLibroConsecutivo, 'origen' | 'faltaCedula' | 'faltaEstadoJuridico'>,
): boolean {
  return fila.origen === 'RECONSTRUIDO' && (fila.faltaCedula || fila.faltaEstadoJuridico);
}

export type FiltroLibroConsecutivo = 'TODOS' | 'EN_TRAMITE' | 'POR_VENCER' | 'VENCIDOS' | 'HISTORICOS_INCOMPLETOS' | 'COLISIONES';

export const FILTROS_LIBRO_CONSECUTIVO: readonly { id: FiltroLibroConsecutivo; etiqueta: string }[] = [
  { id: 'TODOS', etiqueta: 'Todos' },
  { id: 'EN_TRAMITE', etiqueta: 'En trámite' },
  { id: 'POR_VENCER', etiqueta: 'Por vencer' },
  { id: 'VENCIDOS', etiqueta: 'Vencidos' },
  { id: 'HISTORICOS_INCOMPLETOS', etiqueta: 'Históricos incompletos' },
  { id: 'COLISIONES', etiqueta: 'Colisiones' },
];

/** `true` si `fila` pertenece al balde `filtro` — única fuente de verdad que comparten el filtrado en memoria y los conteos de KPIs/chips (nunca se duplica el criterio). */
export function coincideFiltroLibro(fila: FilaLibroConsecutivo, filtro: FiltroLibroConsecutivo, hoy: Date = new Date()): boolean {
  switch (filtro) {
    case 'TODOS':
      return true;
    case 'EN_TRAMITE':
      return ESTADOS_EN_TRAMITE_LIBRO.includes(fila.estadoJuridico);
    case 'POR_VENCER':
      return urgenciaFilaLibro(fila, hoy) === 'POR_VENCER';
    case 'VENCIDOS':
      return urgenciaFilaLibro(fila, hoy) === 'VENCIDO';
    case 'HISTORICOS_INCOMPLETOS':
      return esHistoricoIncompletoLibro(fila);
    case 'COLISIONES':
      // Ambas fuentes: la declarada por el importador y la que el propio
      // Libro detecta al ver dos filas con el mismo número. La segunda es la
      // que atraparía una colisión nueva, que nadie declaró.
      return fila.colision || fila.otrosConMismoNumero.length > 0;
  }
}

/** Filtrado en memoria (la API ya trae hasta 300 expedientes del tenant, R11 — no hay una segunda llamada por filtro). */
export function filtrarFilasLibro(
  filas: readonly FilaLibroConsecutivo[],
  filtro: FiltroLibroConsecutivo,
  hoy: Date = new Date(),
): FilaLibroConsecutivo[] {
  return filas.filter((f) => coincideFiltroLibro(f, filtro, hoy));
}

/** Conteo por cada filtro — alimenta el número de cada chip (`ChipFiltroLibro`) sin recorrer `filas` una vez por chip por separado en el componente. */
export function calcularConteosPorFiltroLibro(
  filas: readonly FilaLibroConsecutivo[],
  hoy: Date = new Date(),
): Record<FiltroLibroConsecutivo, number> {
  const conteos = {} as Record<FiltroLibroConsecutivo, number>;
  for (const { id } of FILTROS_LIBRO_CONSECUTIVO) {
    conteos[id] = filtrarFilasLibro(filas, id, hoy).length;
  }
  return conteos;
}

/** Las 4 cifras de la fila de KPIs — reutiliza `calcularConteosPorFiltroLibro` (mismo criterio que los chips, nunca un segundo cálculo paralelo que pudiera desincronizarse). */
export interface ConteosKpiLibro {
  total: number;
  enTramite: number;
  porVencer: number;
  historicosIncompletos: number;
}

export function calcularConteosKpiLibro(filas: readonly FilaLibroConsecutivo[], hoy: Date = new Date()): ConteosKpiLibro {
  const porFiltro = calcularConteosPorFiltroLibro(filas, hoy);
  return {
    total: porFiltro.TODOS,
    enTramite: porFiltro.EN_TRAMITE,
    porVencer: porFiltro.POR_VENCER,
    historicosIncompletos: porFiltro.HISTORICOS_INCOMPLETOS,
  };
}

/** Nombre de archivo del CSV exportado — `libro-consecutivo-licencias-{año}.csv`. */
export function nombreArchivoCsvLibroConsecutivo(año: number): string {
  return `libro-consecutivo-licencias-${año}.csv`;
}

const ENCABEZADOS_CSV = [
  'N. EXPEDIENTE',
  'FECHA APERTURA',
  'FECHA RADICACION',
  'SOLICITANTE',
  'DOCUMENTO',
  'SUBTIPOS',
  'ESTADO JURIDICO',
  'N. LICENCIA',
  'FECHA FIRMEZA',
  'PRUEBA',
  // Aditiva y AL FINAL, igual que 'PRUEBA' en su momento: Excel abre el
  // archivo sin cambios y nada aguas abajo se desplaza de columna.
  'COLISION',
] as const;

/**
 * Escapa UN campo para CSV separado por `;` (estándar regional es-CO, el
 * que Excel abre sin pedir "convertir texto en columnas"). Se citan los
 * campos que contienen el separador, comillas o salto de línea — el resto
 * queda tal cual, más legible al abrir el archivo en un editor de texto.
 */
function celdaCsv(valor: string): string {
  if (/[;"\n\r]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

/**
 * Genera el texto completo del CSV del Libro Consecutivo — FUNCIÓN PURA
 * (sin `Blob`/`URL.createObjectURL`: eso es responsabilidad del
 * componente, esto solo arma texto). Recibe las filas YA filtradas por año
 * (`construirFilasLibroConsecutivo`) — el año en sí solo lo necesita el
 * nombre del archivo (`nombreArchivoCsvLibroConsecutivo`), no el contenido.
 * Mismas columnas que la tabla en pantalla, más `PRUEBA` en texto plano
 * (el chip de pantalla no sobrevive a un CSV) — ver JSDoc del módulo.
 *
 * BOM (`﻿`) al inicio: sin él, Excel en Windows abre el archivo
 * asumiendo Latin-1 y corrompe tildes/eñes de los nombres de solicitantes.
 * Separador `;` y salto de línea `\r\n`: convención regional es-CO/Excel.
 */
export function generarCsvLibroConsecutivo(filas: readonly FilaLibroConsecutivo[]): string {
  const encabezado = ENCABEZADOS_CSV.join(';');
  const filasTexto = filas.map((f) => {
    const celdas = [
      f.numeroExpediente,
      formatFechaColombia(f.fechaApertura),
      f.fechaRadicacion ? formatFechaColombia(f.fechaRadicacion) : '',
      f.solicitanteNombre,
      f.solicitanteDocumento,
      f.subtipos.join(', '),
      ESTILOS_ESTADO_JURIDICO[f.estadoJuridico].label,
      f.numeroLicencia ?? '—',
      f.fechaFirmeza ? formatFechaColombia(f.fechaFirmeza) : '—',
      f.esPrueba ? 'SI' : 'NO',
      f.colision ? 'SI' : 'NO',
    ];
    return celdas.map(celdaCsv).join(';');
  });
  return '﻿' + [encabezado, ...filasTexto].join('\r\n');
}

/* ══════════════════════════════════════════════════════════════
   Buscador rápido (Libro consecutivo + Bandeja de Licencias) — pedido
   explícito del propietario ante los ~202 expedientes históricos por
   importar (pasarán de 3 a ~205 filas reales): sin buscador, localizar un
   expediente por radicado/nombre/matrícula/estado sería inviable para
   quien tenga que completar cédulas y estados desde el expediente físico.

   Función PURA, compartida por ambas pantallas vía `CamposBusquedaLibro`:
   `FilaLibroConsecutivo` ya calza esa forma ESTRUCTURALMENTE (por eso el
   Libro llama `coincideBusquedaLibro(fila, termino)` directo, sin
   adaptador); la Bandeja trabaja con `ExpedienteLicenciaDoc` crudo (no
   construye filas), así que pasa por `camposBusquedaDesdeExpediente`
   primero.
══════════════════════════════════════════════════════════════ */

/**
 * Campos sobre los que corre el buscador rápido — los 6 que pidió el
 * propietario (número de expediente/radicado, nombre del solicitante,
 * documento, matrícula, código de subtipo y estado) más la fecha de APERTURA.
 *
 * Se busca por la apertura y no por la radicación en debida forma a propósito:
 * la segunda puede no existir todavía (expediente en PRESENTADA), y un
 * buscador que deja de encontrar un expediente porque aún no se radicó es
 * exactamente lo contrario de lo que necesita quien atiende al ciudadano.
 * SUPUESTO EXPLÍCITO (Principio 13, no estaba en la lista literal del
 * pedido): sin la fecha formateada, el propio ejemplo del encargo —
 * "buscar 'galvis 2025' encuentra al solicitante Galvis del año 2025" —
 * no se cumple, porque el número de expediente vigente (`68745-0-AA-CCCC`)
 * no lleva un año de 4 dígitos.
 */
export interface CamposBusquedaLibro {
  numeroExpediente: string;
  radicadoId?: string | null;
  fechaApertura: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  matriculaInmobiliaria?: string | null;
  subtipoCodigos: readonly string[];
  subtipos: readonly string[];
  estadoJuridico: string;
}

/**
 * Normaliza texto para comparar en la búsqueda: minúsculas + sin marcas
 * diacríticas vía descomposición NFD (así "MARÍA"/"María"/"maria" son el
 * mismo término) — sin mantener un mapa de acentos a mano, mismo espíritu
 * que `normalizarTextoHistorico` (`lib/motor-expedientes/
 * equivalencia-migracion.ts`) pero de propósito general.
 */
function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * `true` si CADA fragmento del término (separado por espacios) aparece en
 * ALGUNO de los campos buscables de `campos` — los fragmentos NO tienen
 * que coincidir en el mismo campo, así "galvis 2025" encuentra a un
 * solicitante Galvis cuya fecha de radicación cae en 2025, aunque
 * "galvis" viva en la columna Solicitante y "2025" en la de Fecha.
 *
 * Término vacío/solo espacios: coincide con todo — mismo criterio que el
 * filtro "TODOS", y permite que el caller (componente) llame esto sin
 * condicional propia cuando el campo de búsqueda está vacío.
 */
export function coincideBusquedaLibro(campos: CamposBusquedaLibro, termino: string): boolean {
  const fragmentos = normalizarBusqueda(termino).split(/\s+/).filter(Boolean);
  if (fragmentos.length === 0) return true;

  // Mismo patrón defensivo que `faltaEstadoJuridico` (arriba): el estado
  // puede no ser una de las 9 claves conocidas (dato legado/corrupto) — en
  // ese caso solo se busca por el código crudo, sin `label` inventado.
  const estadoLabel =
    (campos.estadoJuridico as string) in ESTILOS_ESTADO_JURIDICO
      ? ESTILOS_ESTADO_JURIDICO[campos.estadoJuridico as EstadoJuridicoLicencia].label
      : '';

  const haystack = normalizarBusqueda(
    [
      campos.numeroExpediente,
      campos.radicadoId ?? '',
      formatFechaColombia(campos.fechaApertura),
      campos.solicitanteNombre,
      campos.solicitanteDocumento,
      campos.matriculaInmobiliaria ?? '',
      ...campos.subtipoCodigos,
      ...campos.subtipos,
      campos.estadoJuridico,
      estadoLabel,
    ].join(' '),
  );

  return fragmentos.every((fragmento) => haystack.includes(fragmento));
}

/**
 * Adapta un `ExpedienteLicenciaDoc` crudo — lo que consume la Bandeja, que
 * NO construye `FilaLibroConsecutivo` — a `CamposBusquedaLibro`. Mismo
 * criterio de mapeo que usa `construirFilasLibroConsecutivo` para los
 * campos equivalentes (número de expediente, matrícula, radicado), sin
 * repetir el resto de esa función (vigencia, urgencia, año…) que la
 * Bandeja no necesita.
 */
export function camposBusquedaDesdeExpediente(exp: ExpedienteLicenciaDoc): CamposBusquedaLibro {
  const subtipoCodigos = exp.subtipos ?? [];
  return {
    numeroExpediente: numeroExpedienteTexto(exp),
    radicadoId: exp.radicadoId ?? null,
    fechaApertura: exp.creadoEn,
    solicitanteNombre: exp.solicitanteNombre,
    solicitanteDocumento: exp.solicitanteDocumento,
    matriculaInmobiliaria: exp.predio?.matriculaInmobiliaria ?? null,
    subtipoCodigos,
    subtipos: subtipoCodigos.map(nombreSubtipo),
    estadoJuridico: exp.estadoJuridico,
  };
}
