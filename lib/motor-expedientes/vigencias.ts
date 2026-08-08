/**
 * Estructura de vigencias de actos de licencia — DF-8, ADR-0029.
 *
 * PURO, sin I/O. Define el TIPO de una regla de vigencia y SEMILLAS
 * documentadas de los valores que la norma establece — pero estas semillas
 * son ⚖️ NO EJECUTABLES (hueco 3, ADR-0029): "ningún valor legal se
 * ejecuta sin ratificación" es una regla del proyecto, no una sugerencia.
 * Ninguna ruta ni UI debe importar este módulo todavía — ver el contrato
 * anti-consumo en `__tests__/vigencias-anti-consumo.test.ts` (grep de
 * fuente, mismo patrón que `__tests__/subsanacion-rutas.test.ts`).
 */

import { sumarMesCalendario } from '@/lib/tiempos-radicado';

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
   * conjunto. Esta convención NO tiene lógica de resolución/desambiguación
   * en este módulo (sería lógica EJECUTABLE sobre un dato que no debe
   * ejecutarse todavía) — es solo una forma más precisa de REGISTRAR el
   * dato para cuando se ratifique.
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
   Semillas documentadas — ⚖️ NO EJECUTABLES (hueco 3, ADR-0029)
────────────────────────────────────────────── */

/**
 * ⚖️ SEMILLA DOCUMENTADA NO EJECUTABLE — PROHIBIDO consumirla desde
 * rutas/UI hasta ratificación jurídica (ADR-0029 hueco 3: "ningún valor
 * legal se ejecuta sin ratificación"). Existe para dejar registrado, con
 * su fundamento exacto, lo que la investigación normativa confirmó — NO
 * para que ningún endpoint la lea y calcule una vigencia real. El contrato
 * anti-consumo (`__tests__/vigencias-anti-consumo.test.ts`) falla si algo
 * bajo `app/` llega a importar este archivo.
 *
 * Fundamento: D.1077/2015 art. 2.2.6.1.2.4.1 (D.1783/2021 art. 27) — todas
 * las vigencias corren desde la FIRMEZA del acto (`actoFinal.fechaFirmeza`,
 * DF-6).
 *
 * Reglas registradas (las exigidas por el encargo de DF-8; ver JSDoc de
 * `ReglaVigencia` sobre la convención `"CONSTRUCCION:modalidad"`):
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
 *     combinación; se registra el rango como dato de referencia, sin
 *     regla de desambiguación (deliberadamente incompleto: completar esto
 *     sería empezar a "ejecutar" el dato antes de la ratificación).
 */
export const VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE: RegimenVigencias = {
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
 * ⚖️ SEMILLA DOCUMENTADA NO EJECUTABLE — PROHIBIDO consumirla desde
 * rutas/UI hasta ratificación jurídica (ADR-0029 hueco 3). Régimen ANTERIOR
 * (D.1469/2010 art. 47, texto histórico, DEROGADO por D.1783/2021 pero
 * aplicable por transición — ver `regimenAplicable` — a solicitudes
 * radicadas en legal y debida forma ANTES de la vigencia del D.1783).
 *
 * El "6 meses" que aparece en el Excel histórico de Planeación para
 * subdivisión corresponde a ESTE régimen, no a una anomalía de captura —
 * es conforme SI la solicitud se radicó antes del 2021-12-20 (PENDIENTE
 * verificar por expediente, no se resuelve aquí).
 */
export const VIGENCIAS_ANTERIORES_D1469_SEMILLA: RegimenVigencias = {
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
 * firmeza) — D.1783/2021 art. 36. Pura: solo compara fechas, no consume
 * ninguna de las dos semillas (⚖️ siguen NO EJECUTABLES aunque esta
 * función SÍ pueda usarse — decide el RÉGIMEN, no un valor de vigencia).
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
 * Función PURA sobre una `ReglaVigencia` dada por el caller — NO decide
 * qué regla aplica ni lee las semillas ⚖️ de este archivo; eso es
 * exactamente lo que el contrato anti-consumo prohíbe hacer todavía.
 */
export function proyectarVencimientoVigencia(regla: ReglaVigencia, fechaFirmeza: string | Date): Date {
  return sumarMesCalendario(fechaFirmeza, regla.meses);
}
