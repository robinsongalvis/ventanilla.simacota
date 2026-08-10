/**
 * Estructura de vigencias de actos de licencia — DF-8, ADR-0029.
 *
 * PURO, sin I/O. Define el TIPO de una regla de vigencia y las reglas que
 * la norma establece.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ACTIVACIÓN (10-ago-2026) — este módulo YA es consumible.
 *
 * Hasta el 10-ago-2026 estas reglas eran una semilla ⚖️ NO EJECUTABLE
 * (hueco 3, ADR-0029: "ningún valor legal se ejecuta sin ratificación") y
 * un contrato anti-consumo (`__tests__/vigencias-anti-consumo.test.ts`)
 * bloqueaba cualquier import desde `app/`. Ese candado se LEVANTA
 * deliberadamente aquí, con procedencia de DOBLE fuente:
 *  1. **Texto normativo verificado** — D.1077/2015 art. 2.2.6.1.2.4.1
 *     (D.1783/2021 art. 27), transcrito y verificado en
 *     `docs/planes/INVESTIGACION_NORMATIVA_LICENCIAS.md`: plazos, prórroga
 *     única (antelación en DÍAS HÁBILES, ver más abajo la discrepancia
 *     declarada) y revalidación de las vigencias, tal cual quedaron
 *     registradas abajo.
 *  2. **Acta de la mesa Jurídica+Planeación, 10-ago-2026**
 *     (`docs/planes/ACTA_MESA_JURIDICA_PLANEACION_2026-08-10.md`, PR #178):
 *     confirma que las VIGENCIAS (a diferencia del término/SAP/recursos,
 *     que siguen ⚖️ bloqueados por el hueco 1/2/4) NO están contradichas
 *     por ningún insumo verbal — es la materia con menos incertidumbre de
 *     las cuatro que trajo el anexo normativo.
 *  3. **Aprobación expresa del propietario** el mismo día, sobre esta
 *     activación puntual (no un concepto escrito de Jurídica genérico —
 *     ver la nota de discrepancia de antelación más abajo, que SIGUE sin
 *     resolver y por eso queda parametrizada, no hardcodeada).
 *
 * El candado se levanta SOLO para las vigencias. El resto de huecos ⚖️ del
 * ADR-0029 (efecto de la subsanación sobre el término — hueco 1; SAP —
 * hueco 2; segunda instancia de apelación — hueco 4) siguen exactamente
 * donde estaban: `termino.ts` sigue sin política por defecto, y este
 * módulo NO decide nada sobre esos temas.
 *
 * El contrato anti-consumo pasa de "nadie en `app/` puede importar este
 * archivo" a: "consumo permitido desde el motor/servidor, pero SIGUE
 * PROHIBIDO inventar valores fuera de lo que las reglas de abajo declaran"
 * — ver el test actualizado.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { sumarMesCalendario, diasRestantesHabiles } from '@/lib/tiempos-radicado';

/* ──────────────────────────────────────────────
   Tipos
────────────────────────────────────────────── */

export interface ReglaVigencia {
  /**
   * Códigos a los que aplica esta regla. Normalmente códigos de
   * `FiguraTramiteNormativa` (`./catalogo-subtipos-normativo.ts`, DF-4).
   * EXCEPCIÓN documentada: cuando el D.1783 distingue por MODALIDAD dentro
   * de una misma figura (construcción "obra nueva" vs. el resto — el
   * régimen de vigencias NO es uniforme para toda `CONSTRUCCION`), se usa
   * la convención `"<codigoFigura>:<codigoModalidad>"` (p. ej.
   * `"CONSTRUCCION:obra-nueva"`) — `MODALIDADES_CONSTRUCCION` no tiene un
   * código agregado para "todas las modalidades salvo obra nueva", así que
   * se usa `"CONSTRUCCION:no-obra-nueva"` como marcador explícito de ese
   * conjunto.
   */
  figuras: string[];
  meses: number;
  prorroga?: {
    meses: number;
    unica: true;
    /** Debe radicarse al menos este número de días hábiles antes del vencimiento. */
    radicarDiasHabilesAntesMin: number;
  };
  /** `true` si esta figura/modalidad NO admite prórroga (excluyente con `prorroga`). */
  improrrogable?: true;
  revalidacion?: {
    /** Ventana máxima, en meses, TRAS el vencimiento, para solicitar revalidación. */
    ventanaMesesTrasVencimiento: number;
    unica: true;
  };
}

export interface RegimenVigencias {
  id: string;
  /** ISO 8601 (solo fecha) — desde cuándo rige este régimen, si aplica. */
  vigenteDesde?: string;
  reglas: ReglaVigencia[];
}

/* ──────────────────────────────────────────────
   Reglas — ACTIVADAS (10-ago-2026), ver procedencia en la cabecera
────────────────────────────────────────────── */

/**
 * Régimen vigente D.1783/2021. Fundamento: D.1077/2015 art. 2.2.6.1.2.4.1
 * (D.1783/2021 art. 27) — todas las vigencias corren desde la FIRMEZA del
 * acto (`actoFinal.fechaFirmeza`, DF-6).
 *
 * Reglas registradas (ver JSDoc de `ReglaVigencia` sobre la convención
 * `"CONSTRUCCION:modalidad"`):
 *  1. Urbanización, parcelación, y construcción modalidad "obra nueva"
 *     (incl. sus revalidaciones): 36 meses + prórroga única de 12,
 *     revalidación única dentro de los 2 meses siguientes al vencimiento.
 *  2. Construcción en cualquier OTRA modalidad + espacio público: 24 meses
 *     + prórroga única de 12.
 *  3. Subdivisión (las 3 modalidades: rural, urbana, reloteo) y
 *     saneamientos: 12 meses, IMPRORROGABLE (sin prórroga ni revalidación,
 *     par. 4).
 *  4. Licencias combinadas en un mismo acto: 48 (o 36, según cuáles
 *     figuras se combinen) + prórroga única de 12 — la norma NO da, en el
 *     nivel investigado, un criterio mecánico para decidir 48 vs. 36 por
 *     combinación; se registra el valor único disponible (48) como dato de
 *     referencia — `seleccionarReglaVigencia` NO intenta desambiguar 36 vs
 *     48 (sería inventar un criterio que la norma no da).
 *
 * DISCREPANCIA DECLARADA — antelación mínima de la prórroga
 * (`radicarDiasHabilesAntesMin`): el registro normativo verificado dice
 * **30 días HÁBILES**. El 10-ago-2026 el propietario dictó "T-30 días
 * CALENDARIO" y, por separado, la mesa dijo "1 mes" — ninguna de las dos
 * lecturas verbales coincide exactamente con el dato verificado, y entre
 * sí tampoco coinciden (30 calendario ≈ 4.3 semanas; 1 mes ≈ 4.3 semanas;
 * 30 hábiles ≈ 6 semanas — la diferencia hábiles/calendario es real, no
 * redondeo). Se implementa el dato VERIFICADO (30 hábiles) porque es el
 * único con fuente documental transcrita; la UNIDAD queda como dato de la
 * semilla (`radicarDiasHabilesAntesMin`, un campo, no una rama de código)
 * para que, cuando el concepto escrito de Jurídica fije la unidad
 * definitiva, cambiar esto sea editar un número, no tocar
 * `validarSolicitudProrroga`.
 */
export const VIGENCIAS_D1783: RegimenVigencias = {
  id: 'D1783',
  vigenteDesde: '2021-12-20',
  reglas: [
    {
      figuras: ['URBANIZACION', 'PARCELACION', 'CONSTRUCCION:obra-nueva'],
      meses: 36,
      prorroga: { meses: 12, unica: true, radicarDiasHabilesAntesMin: 30 },
      revalidacion: { ventanaMesesTrasVencimiento: 2, unica: true },
    },
    {
      figuras: ['CONSTRUCCION:no-obra-nueva', 'ESPACIO_PUBLICO'],
      meses: 24,
      prorroga: { meses: 12, unica: true, radicarDiasHabilesAntesMin: 30 },
    },
    {
      figuras: ['SUBDIVISION_RURAL', 'SUBDIVISION_URBANA', 'RELOTEO', 'SANEAMIENTO'],
      meses: 12,
      improrrogable: true,
    },
    {
      // Ver punto 4 del JSDoc de cabecera — rango sin desambiguación mecánica.
      figuras: ['COMBINADA_EN_UN_MISMO_ACTO'],
      meses: 48,
      prorroga: { meses: 12, unica: true, radicarDiasHabilesAntesMin: 30 },
    },
  ],
};

/**
 * Régimen ANTERIOR (D.1469/2010 art. 47, texto histórico, DEROGADO por
 * D.1783/2021 pero aplicable por transición — ver `regimenAplicable` — a
 * solicitudes radicadas en legal y debida forma ANTES de la vigencia del
 * D.1783).
 *
 * El "6 meses" que aparece en el Excel histórico de Planeación para
 * subdivisión corresponde a ESTE régimen, no a una anomalía de captura —
 * es conforme SI la solicitud se radicó antes del 2021-12-20. Activado
 * (10-ago-2026) junto con el régimen D1783 por la misma procedencia — ver
 * cabecera del archivo. Los expedientes RECONSTRUIDOS (Fase 5, DF-9) NO
 * calculan vigencia (`cierreDesconocido: true` — sin `fechaFirmeza`
 * confiable), así que este régimen aplica en la práctica solo a
 * expedientes REALES cuya radicación caiga antes del corte (transición).
 */
export const VIGENCIAS_ANTERIORES_D1469: RegimenVigencias = {
  id: 'ANTERIOR',
  reglas: [
    {
      figuras: ['SUBDIVISION_RURAL', 'SUBDIVISION_URBANA', 'RELOTEO'],
      meses: 6,
      improrrogable: true,
    },
  ],
};

/* ──────────────────────────────────────────────
   Funciones puras
────────────────────────────────────────────── */

/**
 * Fecha de corte de la transición D.1783/2021 art. 36: las solicitudes
 * radicadas en legal y debida forma ANTES de esta fecha se rigen por la
 * norma ANTERIOR (D.1469/2010); las radicadas EN O DESPUÉS, por el D.1783.
 *
 * RESERVA DECLARADA (`INVESTIGACION_NORMATIVA_LICENCIAS.md`, "Reservas"):
 * la fecha de publicación en el Diario Oficial del D.1783/2021 no se
 * verificó de forma independiente en esa investigación — 2021-12-20 es el
 * dato usado por el anexo, no una fecha re-verificada por este módulo.
 */
export const FECHA_CORTE_D1783 = '2021-12-20';

/**
 * Régimen de vigencias aplicable según la fecha de RADICACIÓN (no la de
 * firmeza) — D.1783/2021 art. 36.
 */
export function regimenAplicable(fechaRadicacion: string | Date): 'D1783' | 'ANTERIOR' {
  const fecha = fechaRadicacion instanceof Date ? fechaRadicacion : new Date(fechaRadicacion);
  const corte = new Date(FECHA_CORTE_D1783);
  return fecha.getTime() >= corte.getTime() ? 'D1783' : 'ANTERIOR';
}

/**
 * Proyecta la fecha de vencimiento de una vigencia: `regla.meses` meses
 * calendario desde `fechaFirmeza` (D.1077/2015 art. 2.2.6.1.2.4.1: TODAS
 * las vigencias corren desde la firmeza). Reutiliza `sumarMesCalendario`
 * (`lib/tiempos-radicado.ts`, Código Civil art. 67) — NO reimplementa la
 * aritmética de meses.
 *
 * Función PURA sobre una `ReglaVigencia` dada por el caller — no decide
 * qué regla aplica (eso es `seleccionarReglaVigencia`/`calcularVencimientoVigencia`).
 */
export function proyectarVencimientoVigencia(regla: ReglaVigencia, fechaFirmeza: string | Date): Date {
  return sumarMesCalendario(fechaFirmeza, regla.meses);
}

export interface ErrorSeleccionRegla {
  codigo: 'FIGURA_SIN_REGLA' | 'MODALIDAD_REQUERIDA' | 'MULTIPLES_FIGURAS_SIN_COMBINAR';
  mensaje: string;
}

function esErrorSeleccionRegla(x: unknown): x is ErrorSeleccionRegla {
  return typeof x === 'object' && x !== null && 'codigo' in x;
}

/**
 * Selecciona la `ReglaVigencia` que aplica a un caso, dado su conjunto de
 * `subtipos` (códigos de figura, `Expediente.subtipos`) y, si el caso
 * incluye CONSTRUCCION, la `modalidadConstruccion` (necesaria para
 * distinguir "obra-nueva" del resto — eje aparte de la figura, ver JSDoc
 * de `ReglaVigencia`). NUNCA inventa una desambiguación que la norma no da
 * — devuelve error explícito en vez de adivinar.
 *
 * Reglas de selección:
 *  - Más de una figura en `subtipos` → combinada (`COMBINADA_EN_UN_MISMO_ACTO`,
 *    única fila registrada para ese caso — ver nota de la semilla sobre
 *    36 vs 48).
 *  - Una sola figura `CONSTRUCCION` sin `modalidadConstruccion` → error
 *    `MODALIDAD_REQUERIDA` (no se puede saber si es "obra-nueva" u otra).
 *  - Una sola figura `CONSTRUCCION` con modalidad → resuelve
 *    `CONSTRUCCION:obra-nueva` o `CONSTRUCCION:no-obra-nueva` según el
 *    código de modalidad reciba `'obra-nueva'` exacto o cualquier otro.
 *  - Cualquier otra figura simple → busca el código literal en `figuras`
 *    de cada regla del régimen.
 *  - Ninguna fila calza → error `FIGURA_SIN_REGLA`.
 */
export function seleccionarReglaVigencia(
  input: { subtipos: string[]; modalidadConstruccion?: string },
  regimen: RegimenVigencias,
): ReglaVigencia | ErrorSeleccionRegla {
  if (!Array.isArray(input.subtipos) || input.subtipos.length === 0) {
    return { codigo: 'FIGURA_SIN_REGLA', mensaje: 'El expediente no declara ningún subtipo (figura normativa); no hay regla de vigencia que seleccionar.' };
  }

  let clave: string;
  if (input.subtipos.length > 1) {
    clave = 'COMBINADA_EN_UN_MISMO_ACTO';
  } else {
    const figura = input.subtipos[0]!;
    if (figura === 'CONSTRUCCION') {
      if (!input.modalidadConstruccion) {
        return {
          codigo: 'MODALIDAD_REQUERIDA',
          mensaje: 'El régimen de vigencias de CONSTRUCCION distingue por modalidad (obra-nueva vs. el resto); falta "modalidadConstruccion" para decidir la regla.',
        };
      }
      clave = input.modalidadConstruccion === 'obra-nueva' ? 'CONSTRUCCION:obra-nueva' : 'CONSTRUCCION:no-obra-nueva';
    } else {
      clave = figura;
    }
  }

  const regla = regimen.reglas.find((r) => r.figuras.includes(clave));
  if (!regla) {
    return {
      codigo: 'FIGURA_SIN_REGLA',
      mensaje: `Ninguna regla de vigencia del régimen "${regimen.id}" cubre "${clave}".`,
    };
  }
  return regla;
}

export interface InputCalcularVencimientoVigencia {
  fechaFirmeza: string | Date;
  subtipos: string[];
  modalidadConstruccion?: string;
  /**
   * Fecha de RADICACIÓN — decide el régimen (D1783 vs ANTERIOR) vía
   * `regimenAplicable`. OPCIONAL: si se omite, se asume D.1783 (el régimen
   * vigente hoy para cualquier expediente `origen: 'REAL'` nuevo). Los
   * expedientes RECONSTRUIDOS (D6/DF-9) no llaman a esta función en la
   * práctica — no tienen `fechaFirmeza` confiable (`cierreDesconocido: true`).
   */
  fechaRadicacion?: string | Date;
}

export interface ResultadoVencimientoVigencia {
  vencimiento: Date;
  configAplicada: ReglaVigencia;
}

export type ErrorVigencia = ErrorSeleccionRegla;

/** Type guard exportado (patrón `esErrorExpediente` del resto del proyecto) — el caller (p. ej. una ruta) lo usa para distinguir un resultado exitoso de un error sin inspeccionar el shape a mano. */
export function esErrorVigencia(x: unknown): x is ErrorVigencia {
  return esErrorSeleccionRegla(x);
}

/**
 * Calcula el vencimiento de la vigencia de un expediente: selecciona el
 * régimen (D1783/ANTERIOR, por `fechaRadicacion` si se da) y la regla
 * (`seleccionarReglaVigencia`, por `subtipos`/`modalidadConstruccion`), y
 * proyecta desde `fechaFirmeza` (`proyectarVencimientoVigencia`). Función
 * de ORQUESTACIÓN pura — no reimplementa ninguna de las tres piezas.
 */
export function calcularVencimientoVigencia(
  input: InputCalcularVencimientoVigencia,
): ResultadoVencimientoVigencia | ErrorVigencia {
  const regimenId = input.fechaRadicacion ? regimenAplicable(input.fechaRadicacion) : 'D1783';
  const regimen = regimenId === 'D1783' ? VIGENCIAS_D1783 : VIGENCIAS_ANTERIORES_D1469;

  const regla = seleccionarReglaVigencia({ subtipos: input.subtipos, modalidadConstruccion: input.modalidadConstruccion }, regimen);
  if (esErrorVigencia(regla)) return regla;

  return {
    vencimiento: proyectarVencimientoVigencia(regla, input.fechaFirmeza),
    configAplicada: regla,
  };
}

export type ResultadoValidacionProrroga = 'OK' | 'EXTEMPORANEA' | 'NO_PRORROGABLE' | 'VIGENCIA_VENCIDA';

/**
 * Valida si una solicitud de prórroga, radicada en `fechaSolicitud`, llega
 * a tiempo frente al `vencimiento` de la vigencia y la `config`
 * (`ReglaVigencia`) aplicada:
 *  - `config.improrrogable` (o sin `config.prorroga`) → `NO_PRORROGABLE`,
 *    sin importar la fecha (subdivisión: SIEMPRE este resultado).
 *  - `fechaSolicitud` posterior al `vencimiento` → `VIGENCIA_VENCIDA` (ya
 *    no hay nada que prorrogar, la vigencia expiró).
 *  - Días hábiles restantes entre `fechaSolicitud` y `vencimiento` menores
 *    que `config.prorroga.radicarDiasHabilesAntesMin` → `EXTEMPORANEA`
 *    (caso de la mesa: a T-8 días hábiles, con el mínimo de 30, es
 *    extemporánea).
 *  - En cualquier otro caso → `OK`.
 *
 * Reutiliza `diasRestantesHabiles` (`lib/tiempos-radicado.ts`) — no
 * reimplementa el conteo de días hábiles.
 */
export function validarSolicitudProrroga(input: {
  fechaSolicitud: string | Date;
  vencimiento: string | Date;
  config: ReglaVigencia;
}): ResultadoValidacionProrroga {
  if (input.config.improrrogable || !input.config.prorroga) {
    return 'NO_PRORROGABLE';
  }

  const restantes = diasRestantesHabiles(input.vencimiento, input.fechaSolicitud);
  if (restantes < 0) {
    return 'VIGENCIA_VENCIDA';
  }
  if (restantes < input.config.prorroga.radicarDiasHabilesAntesMin) {
    return 'EXTEMPORANEA';
  }
  return 'OK';
}
