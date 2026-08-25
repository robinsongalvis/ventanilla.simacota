/**
 * Esqueleto de estados JURÍDICOS del ciclo de licencias — DF-5, ADR-0029.
 *
 * PURO, sin I/O. Modela los HITOS que el Decreto 1077/2015 (compilado,
 * D.1203/2017 + D.1783/2021) exige para el procedimiento de licencias —
 * verificados por norma en `docs/planes/INVESTIGACION_NORMATIVA_LICENCIAS.md`
 * (P4). Es un esqueleto JURÍDICO, NO el mapeo de estados OPERATIVOS del
 * panel (`REVISADO`, `TERMINADO` y la cohorte 2022-2024 del Excel de
 * Planeación no tienen correlato normativo directo — P4′, ADR-0029, PENDIENTE
 * del ingeniero). Un estado operativo futuro se mapeará A estos hitos, no
 * al revés.
 *
 * DELIBERADAMENTE NO vive aquí: el EFECTO del acta de observaciones sobre
 * el término (⚖️ hueco 1 del ADR-0029 — `PoliticaTermino` dual en
 * `./termino.ts` sigue sin default). Este módulo solo modela QUÉ estados
 * jurídicos existen y CUÁNDO se puede pasar de uno a otro — no CUÁNTOS
 * días hábiles cuesta cada tránsito.
 *
 * También incluye `validarCierreExpediente` (DF-6): comparte módulo con
 * los estados porque "cerrar" un expediente ES, jurídicamente, alcanzar
 * `EN_FIRME` — la validación de qué datos exige ese cierre pertenece al
 * mismo concepto que las transiciones que llevan hasta ahí.
 */

import type { Expediente } from './tipos';

export type EstadoJuridicoLicencia =
  /**
   * La solicitud está en poder de la Alcaldía; su completitud AÚN NO se ha
   * verificado. Un expediente aquí puede recibir documentos, NO tiene número
   * de la serie oficial y NO tiene término corriendo (ADR-0033 §0).
   *
   * Es el estado del caso cotidiano: entrega parcial en mostrador — el
   * ciudadano llega con 9 de 19 documentos y vuelve días después con el resto.
   * Nombre PROVISIONAL: es lenguaje institucional y lo decide Planeación.
   */
  | 'PRESENTADA'
  | 'RADICADA_EN_DEBIDA_FORMA'
  | 'EN_REVISION'
  | 'CON_ACTA_DE_OBSERVACIONES'
  | 'EN_VIABILIDAD'
  | 'CONCEDIDA'
  | 'NEGADA'
  | 'DESISTIDA'
  | 'NOTIFICADA'
  | 'EN_FIRME'
  /**
   * DF-10 — expediente MIGRADO del libro histórico de Planeación cuyo
   * desenlace NO consta (decisión del propietario, 11-ago-2026, tras
   * consultar al ingeniero: *"No conviertas 'terminado' en 'Concedida' sin
   * acto final verificable"*).
   *
   * NO es un hito del ciclo de vida: es la ausencia declarada de uno. Existe
   * como valor propio —en vez de reutilizar `RADICADA_EN_DEBIDA_FORMA`, que
   * era la alternativa considerada— porque ese hito AFIRMA un hecho jurídico
   * que en un histórico no consta: que la solicitud se presentó con la
   * documentación completa verificada (art. 2.2.6.1.2.1.1 par. 1), lo que
   * además ancla el término. Del libro solo consta que hubo un radicado.
   *
   * Consecuencia buscada: al no pertenecer a ninguna lista de estados
   * activos (p. ej. `ESTADOS_EN_TRAMITE_LIBRO`), estos expedientes no
   * aparecen como trabajo pendiente ni inflan los contadores de la Bandeja
   * y el Libro — el ingeniero fue explícito en que "revisado" significaba
   * que se revisó y ahí quedó, no que siga en trámite.
   */
  | 'HISTORICO_SIN_RESOLVER';

export interface OpcionesTransicionLicencia {
  /**
   * `true` si esta solicitud YA tuvo una acta de observaciones antes. El
   * acta procede "por una sola vez" (art. 2.2.6.1.2.2.4) — con este guard
   * en `EN_REVISION → CON_ACTA_DE_OBSERVACIONES` en vez de un estado
   * "CON_ACTA_2" o similar: el motor no necesita un estado nuevo por cada
   * invariante de cardinalidad, solo un parámetro que el caller (que sí
   * sabe cuántas actas hubo, vía la trazabilidad real del expediente) debe
   * proveer honestamente.
   */
  yaHuboActa?: boolean;
}

interface TransicionPermitida {
  hacia: EstadoJuridicoLicencia;
  /** Cita normativa exacta que sustenta este tránsito. */
  fundamento: string;
  /** `true` si esta transición exige `!opciones.yaHuboActa` para proceder. */
  requiereNoHuboActaPrevia?: boolean;
}

/**
 * Mapa de transiciones permitidas, con su fundamento normativo:
 *
 * - `RADICADA_EN_DEBIDA_FORMA → EN_REVISION`: la radicación en legal y
 *   debida forma es el ancla del término y del expediente (art.
 *   2.2.6.1.2.1.1 par. 1); sin ella el término NO corre (art.
 *   2.2.6.1.2.2.3 inc. 2) — de ahí entra a revisión (citación/valla,
 *   art. 2.2.6.1.2.2.1-2).
 * - `EN_REVISION → CON_ACTA_DE_OBSERVACIONES`: acta de observaciones, POR
 *   UNA SOLA VEZ (art. 2.2.6.1.2.2.4, redacción D.1783/2021 art. 19) —
 *   guardada con `requiereNoHuboActaPrevia` (ver `OpcionesTransicionLicencia`).
 * - `EN_REVISION → EN_VIABILIDAD`: si no requiere acta, pasa directo al
 *   acto de viabilidad (art. 2.2.6.1.2.3.1 par. 1: pide SOLO documentos de
 *   pago, máx. 30 días hábiles con trámite suspendido).
 * - `CON_ACTA_DE_OBSERVACIONES → EN_VIABILIDAD`: superada la observación,
 *   continúa a viabilidad (art. 2.2.6.1.2.3.1 par. 1).
 * - `CON_ACTA_DE_OBSERVACIONES → DESISTIDA`: incumplir el acta (no
 *   responder o no aportar lo pedido) "se entenderá desistida" (art.
 *   2.2.6.1.2.3.4).
 * - `EN_VIABILIDAD → CONCEDIDA` / `→ NEGADA`: decisión en 45 días hábiles
 *   — "viabilidad, negación o desistimiento" (art. 2.2.6.1.2.3.1 inc. 1).
 * - `EN_VIABILIDAD → DESISTIDA`: no aportar los documentos de pago exigidos
 *   en viabilidad (art. 2.2.6.1.2.3.1 par. 1 / art. 2.2.6.1.2.3.4).
 * - `{RADICADA_EN_DEBIDA_FORMA,EN_REVISION,CON_ACTA_DE_OBSERVACIONES,
 *   EN_VIABILIDAD} → DESISTIDA`: desistimiento EXPRESO, procede desde
 *   cualquier estado ANTES de la decisión (art. 2.2.6.1.2.3.4) — distinto
 *   del desistimiento TÁCITO por incumplimiento del acta/viabilidad (mismo
 *   estado destino; la distinción expreso/tácito es un atributo del
 *   EVENTO, no un estado separado).
 * - `{CONCEDIDA,NEGADA,DESISTIDA} → NOTIFICADA`: todo acto que resuelve
 *   (favorable, desfavorable o desistimiento) se notifica — CPACA,
 *   notificación electrónica SOLO si fue aceptada (art. 2.2.6.1.2.3.7).
 * - `NOTIFICADA → EN_FIRME`: firmeza del acto administrativo (CPACA art. 87).
 */
const TRANSICIONES: Readonly<Record<EstadoJuridicoLicencia, readonly TransicionPermitida[]>> = {
  /**
   * DF-10 — desde "histórico sin resolver" NO hay transición automática: la
   * salida es un acto humano. Cuando un funcionario revise el expediente
   * FÍSICO y establezca qué pasó, asigna el estado que corresponda con su
   * fundamento documental (y queda registrado quién y cuándo, ver
   * `completarRevisionHistorica`). Dejarlo VACÍO es la garantía de que
   * ningún flujo del sistema pueda sacarlo de aquí por su cuenta e
   * inventarle un desenlace — fail-closed, mismo criterio que el resto del
   * motor.
   */
  /**
   * ADR-0033 §0 — la solicitud está en poder de la Alcaldía y su completitud
   * aún no se ha verificado. DOS salidas y ninguna más:
   *  · a debida forma, cuando el checklist se verifica en SERVIDOR — y es ahí,
   *    no antes, donde se emite el número oficial y arranca el término;
   *  · a desistida, si el solicitante retira la solicitud antes de completarla.
   * No hay arco a EN_REVISION: revisar algo que no consta completo es
   * exactamente lo que este estado existe para impedir.
   */
  PRESENTADA: [
    { hacia: 'RADICADA_EN_DEBIDA_FORMA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.1.1 par. 1 — la radicación en legal y debida forma se declara cuando la documentación está completa; solo entonces ancla el término.' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.4 — desistimiento expreso, procede antes de la decisión.' },
  ],
  HISTORICO_SIN_RESOLVER: [],
  RADICADA_EN_DEBIDA_FORMA: [
    { hacia: 'EN_REVISION', fundamento: 'D.1077/2015 art. 2.2.6.1.2.1.1 par. 1 (ancla del término); art. 2.2.6.1.2.2.1-2 (citación/valla).' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.4 — desistimiento expreso, procede antes de la decisión.' },
  ],
  EN_REVISION: [
    { hacia: 'CON_ACTA_DE_OBSERVACIONES', fundamento: 'D.1077/2015 art. 2.2.6.1.2.2.4 (D.1783/2021 art. 19) — acta por UNA SOLA VEZ.', requiereNoHuboActaPrevia: true },
    { hacia: 'EN_VIABILIDAD', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 par. 1 — sin observaciones, pasa directo al acto de viabilidad.' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.4 — desistimiento expreso, procede antes de la decisión.' },
  ],
  CON_ACTA_DE_OBSERVACIONES: [
    { hacia: 'EN_VIABILIDAD', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 par. 1 — observación superada, continúa a viabilidad.' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.4 — incumplir el acta "se entenderá desistida" (tácito) o desistimiento expreso.' },
  ],
  EN_VIABILIDAD: [
    { hacia: 'CONCEDIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 inc. 1 — decisión en 45 días hábiles.' },
    { hacia: 'NEGADA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 inc. 1 — decisión en 45 días hábiles.' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 par. 1 / art. 2.2.6.1.2.3.4 — no aportar documentos de pago exigidos en viabilidad, o desistimiento expreso.' },
  ],
  CONCEDIDA: [
    { hacia: 'NOTIFICADA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.7 — notificación CPACA (electrónica solo si fue aceptada).' },
  ],
  NEGADA: [
    { hacia: 'NOTIFICADA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.7 — notificación CPACA (electrónica solo si fue aceptada).' },
  ],
  DESISTIDA: [
    { hacia: 'NOTIFICADA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.7 — el acto de desistimiento también se notifica.' },
  ],
  NOTIFICADA: [
    { hacia: 'EN_FIRME', fundamento: 'CPACA (Ley 1437/2011) art. 87 — firmeza del acto administrativo.' },
  ],
  EN_FIRME: [],
};

/**
 * Estados en los que la solicitud YA FUE RESUELTA — la Administración se
 * pronunció y el trámite salió de su escritorio (D.1077/2015 art.
 * 2.2.6.1.2.3.1: la decisión es lo que cierra el plazo de los 45 días
 * hábiles; NOTIFICADA y EN_FIRME son hitos POSTERIORES a esa decisión).
 *
 * Vivía duplicada como constante local en `BandejaLicenciasClient.tsx`.
 * Es una regla de DOMINIO, no de presentación: sube al motor para que el
 * Libro, la Bandeja y el panel de término la lean del mismo sitio.
 */
export const ESTADOS_RESUELTOS_LICENCIA: readonly EstadoJuridicoLicencia[] = [
  'CONCEDIDA', 'NEGADA', 'DESISTIDA', 'NOTIFICADA', 'EN_FIRME',
];

/**
 * ¿El término legal para RESOLVER sigue corriendo en este estado?
 *
 * Corrige un defecto encontrado en la verificación E2E del 12-ago-2026: un
 * expediente `EN_FIRME` —ya resuelto— mostraba «Vencido hace 88 días
 * hábiles». El plazo de los 45 días hábiles dejó de correr cuando la
 * Administración decidió; seguir midiéndolo contra "hoy" convierte el paso
 * del tiempo en un incumplimiento que no existe, y le dice al funcionario
 * exactamente lo contrario de lo que el módulo existe para hacer:
 * protegerlo. Lo mismo aplica a los históricos migrados, que nunca tuvieron
 * un término proyectable (R9).
 *
 * NO se limita a ocultar el dato: cambia la interpretación. La fecha
 * proyectada se sigue mostrando como referencia de cuándo VENCÍA el plazo,
 * pero deja de leerse como una alerta de mora.
 */
export function terminoResolucionSigueCorriendo(estado: EstadoJuridicoLicencia): boolean {
  if (estado === 'HISTORICO_SIN_RESOLVER') return false;
  /* PRESENTADA: el término NO ha arrancado todavía — ni siquiera está
     suspendido, simplemente no existe. Esta rama es OBLIGATORIA y el
     compilador NO la habría exigido: la función decide con un ARRAY
     (`ESTADOS_RESUELTOS_LICENCIA`), no con un Record, así que sin ella un
     estado nuevo devolvería `true` y el sistema afirmaría que los 45 días YA
     CORREN para un expediente que aún no los ancló — lo contrario exacto del
     propósito de este estado. Está registrado como Caso 1 en el ADR-0033 §4.6. */
  if (estado === 'PRESENTADA') return false;
  return !ESTADOS_RESUELTOS_LICENCIA.includes(estado);
}

/**
 * ¿Es válida la transición `desde → hacia`? Incluye el guard de acta única
 * (`opciones.yaHuboActa`) — si la transición exige "no hubo acta previa" y
 * `yaHuboActa` es `true`, se rechaza aunque el par de estados esté en el
 * mapa (fail-closed: el guard SIEMPRE se evalúa cuando la transición lo
 * declara, sin excepción implícita).
 */
export function puedeTransicionar(
  desde: EstadoJuridicoLicencia,
  hacia: EstadoJuridicoLicencia,
  opciones: OpcionesTransicionLicencia = {},
): boolean {
  const permitida = TRANSICIONES[desde].find((t) => t.hacia === hacia);
  if (!permitida) return false;
  if (permitida.requiereNoHuboActaPrevia && opciones.yaHuboActa === true) return false;
  return true;
}

/**
 * Transiciones posibles DESDE un estado, con su fundamento — para pintar
 * un panel operativo (Fase 3, no esta tanda) o para mensajes de error que
 * expliquen POR QUÉ una transición no procede. Aplica el guard de acta:
 * `CON_ACTA_DE_OBSERVACIONES` se excluye de la lista si `opciones.yaHuboActa`.
 */
export function transicionesDesde(
  estado: EstadoJuridicoLicencia,
  opciones: OpcionesTransicionLicencia = {},
): { hacia: EstadoJuridicoLicencia; fundamento: string }[] {
  return TRANSICIONES[estado]
    .filter((t) => !(t.requiereNoHuboActaPrevia && opciones.yaHuboActa === true))
    .map((t) => ({ hacia: t.hacia, fundamento: t.fundamento }));
}

/* ──────────────────────────────────────────────
   Validación de cierre (DF-6, ADR-0029)
────────────────────────────────────────────── */

export interface ResultadoValidacionCierreExpediente {
  valido: boolean;
  errores: string[];
}

/**
 * Valida que un expediente tenga los datos exigidos para cerrar (alcanzar
 * `EN_FIRME`). PURA — no cambia el estado, no persiste; el caller decide
 * qué hacer con el resultado. Sin cableado a rutas todavía (no hay
 * persistencia de expedientes en esta tanda) — función + tests únicamente.
 *
 * - `origen: 'REAL'` (o ausente — mismo criterio de default que el resto
 *   del motor: REAL es el caso normal, RECONSTRUIDO es la excepción que se
 *   declara explícitamente): exige `actoFinal.numero`, `actoFinal.fecha` Y
 *   `actoFinal.fechaFirmeza`. `fechaFirmeza` es la más importante de las
 *   tres (DF-6): sin ella no corren vigencias ni nace el reporte ELIC.
 * - `origen: 'RECONSTRUIDO'`: puede cerrar con `actoFinal.cierreDesconocido
 *   === true` en vez de los tres datos — el registro histórico de
 *   Planeación no siempre los conserva (D6, ADR-0026).
 */
export function validarCierreExpediente(
  expediente: Pick<Expediente, 'origen' | 'actoFinal'>,
): ResultadoValidacionCierreExpediente {
  const errores: string[] = [];
  const actoFinal = expediente.actoFinal;

  if (expediente.origen === 'RECONSTRUIDO') {
    const tieneDatosCompletos = !!(actoFinal?.numero && actoFinal?.fecha && actoFinal?.fechaFirmeza);
    if (!tieneDatosCompletos && actoFinal?.cierreDesconocido !== true) {
      errores.push('Expediente RECONSTRUIDO sin acto final completo debe declarar actoFinal.cierreDesconocido === true (D6, ADR-0026).');
    }
    return { valido: errores.length === 0, errores };
  }

  // REAL (o sin origen declarado — default REAL).
  if (!actoFinal?.numero) errores.push('actoFinal.numero es obligatorio para cerrar un expediente REAL.');
  if (!actoFinal?.fecha) errores.push('actoFinal.fecha es obligatoria para cerrar un expediente REAL.');
  if (!actoFinal?.fechaFirmeza) errores.push('actoFinal.fechaFirmeza es obligatoria para cerrar un expediente REAL (DF-6, ADR-0029: dispara vigencias y el reporte ELIC).');
  return { valido: errores.length === 0, errores };
}

/* ──────────────────────────────────────────────
   "Histórico sin resolver" (DF-10) — decisión del propietario, 11-ago-2026,
   tras consultar al ingeniero de Planeación (bloque "Históricos sin
   resolver").
────────────────────────────────────────────── */

/**
 * Ejes de completitud que un expediente RECONSTRUIDO del importador de
 * históricos puede tener pendientes AL MOMENTO DE IMPORTAR (`lib/migracion/
 * planificar-importacion-consecutivo.ts`). No es un catálogo cerrado de
 * "todo lo que puede faltar" en cualquier expediente — es específico de la
 * migración Fase 5 (DF-9):
 *  - `IDENTIDAD`: falta el nombre y/o el número de documento del
 *    solicitante (el libro histórico NUNCA registró documento; el nombre
 *    falta solo en la versión sanitizada de PII que corre en CI).
 *  - `ESTADO_JURIDICO`: no hay acto final verificable que sustente un hito
 *    de `EstadoJuridicoLicencia` — el caso de TODO expediente migrado hoy
 *    (ver `RevisionHistoricaLicencia` más abajo).
 *  - `ACTO_FINAL`: `actoFinal.cierreDesconocido === true` — mismo criterio
 *    que DF-6 (`validarCierreExpediente`).
 *  - `SUBTIPO`: el texto histórico de "tipo" no resolvió contra el catálogo
 *    normativo (P1′, `equivalencia-migracion.ts`) — se importó con el texto
 *    crudo en `subtipos` en vez de un código de `CATALOGO_FIGURAS_NORMATIVAS`.
 */
export type EjeCompletitudHistorico = 'IDENTIDAD' | 'ESTADO_JURIDICO' | 'ACTO_FINAL' | 'SUBTIPO';

/**
 * Marca "histórico sin resolver" — DF-10. Representa un expediente
 * RECONSTRUIDO (Fase 5, migración del libro de consecutivo de Planeación)
 * para el que NINGÚN acto final verificable respalda un desenlace jurídico
 * — ni siquiera cuando el libro dice "terminado" o "revisado": esos textos
 * son estado OPERATIVO del panel legado, sin fecha de resolución que los
 * sustente (verificado contra las 202 filas reales: NINGUNA la trae). El
 * propietario RECTIFICÓ expresamente un intento previo de mapear
 * "terminado" → `CONCEDIDA`: *"No conviertas 'terminado' en 'Concedida' sin
 * acto final verificable"* — este tipo existe para que esa regla sea
 * IMPOSIBLE de violar por accidente, no solo una convención de buena fe.
 *
 * DELIBERADAMENTE NO es un valor de `EstadoJuridicoLicencia`, por dos
 * razones independientes, cada una suficiente por sí sola:
 *  1. **Semántica**: ese enum son HITOS del ciclo (D.1077/2015), cada uno
 *     con fundamento normativo verificado — "histórico sin resolver" no es
 *     un hito jurídico, es la ausencia declarada de evidencia para asignar
 *     uno. Mezclar los dos ejes obligaría a inventar cuál hito real
 *     corresponde, exactamente lo que el propietario prohibió.
 *  2. **Blast radius**: `ESTILOS_ESTADO_JURIDICO` (`app/interno/licencias/
 *     estilos-estado-juridico.ts`) es un `Record<EstadoJuridicoLicencia,
 *     EstiloChipEstado>` EXHAUSTIVO — añadir un valor nuevo al enum rompe
 *     esa tabla (y todo switch/Record exhaustivo que dependa de él) en un
 *     directorio (`app/interno/**`) que este rol tiene prohibido tocar.
 *
 * Como marca APARTE, el importador (`planificar-importacion-consecutivo.ts`)
 * asigna a `estadoJuridico` el hito MENOS comprometido de los 9 —
 * `RADICADA_EN_DEBIDA_FORMA` — porque es el único hecho verificable (el
 * libro SÍ acredita que hubo una solicitud con radicado asignado) sin
 * afirmar ningún desenlace. Esto tiene un costo conocido y DECLARADO (no
 * oculto): hoy `ESTADOS_EN_TRAMITE_LIBRO`/`ESTADOS_EN_TRAMITE`
 * (`app/interno/licencias`) clasifican por `estadoJuridico` sin mirar
 * `origen`/esta marca, así que el KPI "En trámite" del Libro Consecutivo SÍ
 * contará estos expedientes hasta que ese archivo (fuera del alcance de
 * este rol) excluya `revisionHistorica?.pendiente === true` — MISMO patrón
 * que `BandejaLicenciasClient.tsx` ya aplica hoy vía `esReconstruido`/
 * `contables` para sus propios KPIs. Se prefiere este costo, TRANSPARENTE y
 * corregible en una capa que no es la mía, a la alternativa de asignar
 * `CONCEDIDA`/`NEGADA`/`DESISTIDA`/`NOTIFICADA`/`EN_FIRME` (los 5 valores
 * que SÍ evitarían el KPI) — cualquiera de esos cinco MENTIRÍA sobre un
 * desenlace, violando la instrucción explícita y más importante del
 * propietario.
 *
 * Fail-closed (criterio (c) del encargo): un expediente con `pendiente:
 * true` no se toca por ningún cómputo de plazo — R9 ya excluye del término
 * toda `Actuacion` con `origen: 'RECONSTRUIDO'` (`derivarEventosTermino`,
 * `./termino.ts`), y el importador solo produce actuaciones con ese origen
 * para estos expedientes — ni por ninguna transición de `puedeTransicionar`:
 * completar la revisión es un acto EDITORIAL del funcionario (ver
 * `completarRevisionHistorica`), nunca una transición del ciclo jurídico.
 * Transiciones fuera de la marca son SIEMPRE explícitas (criterio (b)):
 * `completarRevisionHistorica` es la ÚNICA función de este módulo que la
 * retira; nada en el importador, ni en ningún otro punto de este archivo,
 * la muta automáticamente.
 */
export interface RevisionHistoricaLicencia {
  /**
   * `true`: el expediente migrado sigue sin desenlace jurídico verificable
   * — "histórico sin resolver". `false`: un funcionario ya completó la
   * revisión (ver `completarRevisionHistorica`).
   */
  pendiente: boolean;
  /**
   * Qué ejes seguían sin completar AL MOMENTO DE IMPORTAR — para que el
   * panel pueda filtrar "faltan cédulas" o "falta acto final" sin inspeccionar
   * cada campo del documento. Se congela en la importación; `completarRevisionHistorica`
   * no lo recalcula (una vez `pendiente: false`, el detalle de qué faltaba
   * queda como historial de la brecha original, no se borra).
   */
  pendientesAlImportar: EjeCompletitudHistorico[];
  /**
   * Presente SOLO cuando `pendiente === false` — quién completó la revisión
   * y cuándo (decisión del propietario, 11-ago-2026: "cada registro editable
   * y trazable"). Mismo trío `{actorUid, actorNombre, fecha}` ya usado en
   * `Actuacion`/`ActuacionLicenciaDoc` — no se inventa un formato de
   * auditoría nuevo.
   */
  completadoPor?: { actorUid: string; actorNombre: string; fecha: string };
}

/**
 * Retira la marca "histórico sin resolver" — la ÚNICA función de este
 * módulo (o de cualquier otro consumido por el importador) autorizada a
 * hacerlo; es SIEMPRE una acción explícita de un funcionario (vía una ruta
 * futura, fuera de esta tanda — este módulo solo declara el soporte de
 * datos, no la UI ni la API).
 *
 * Fail-closed (criterio (c) del encargo): `null` si `revision.pendiente`
 * YA es `false` — no tiene sentido "completar" dos veces, y permitirlo
 * pisaría en silencio el `completadoPor` de la primera vez, perdiendo quién
 * la completó realmente. `null` (no una excepción) por el mismo criterio
 * que el resto del motor usa para "no se puede resolver esto, decide el
 * caller" (`resolverEquivalencia`, `calcularVencimiento`) en vez de lanzar.
 *
 * PURA: no decide QUÉ cambió en el expediente (cédula/estado/acto final) —
 * eso lo escribe el caller en los campos correspondientes de
 * `ExpedienteLicenciaDoc`, en la MISMA operación que llama a esta función;
 * `pendientesAlImportar` no se recalcula (ver su JSDoc).
 */
export function completarRevisionHistorica(
  revision: RevisionHistoricaLicencia,
  actor: { uid: string; nombre: string },
  ahora: Date,
): RevisionHistoricaLicencia | null {
  if (!revision.pendiente) return null;
  return {
    ...revision,
    pendiente: false,
    completadoPor: { actorUid: actor.uid, actorNombre: actor.nombre, fecha: ahora.toISOString() },
  };
}
