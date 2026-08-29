/**
 * lib/server/comunicacion-fallida.ts
 *
 * LA MARCA DE COMUNICACIÓN FALLIDA en expedientes de licencia. Pura: calcula
 * cómo queda la marca; no escribe en Firestore.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────
 *
 * El ADR-0033 §4.7-bis lo dejó como requisito vinculante: la marca de envío
 * fallido debe verse en la PANTALLA del expediente, no solo en un registro.
 * Estaba incumplido. Las tres rutas que escriben al ciudadano guardaban el
 * resultado en una variable —`constanciaEnviada`, `avisoEnviado`,
 * `hitoEnviado`— que viajaba en la respuesta HTTP y **se evaporaba al terminar
 * la petición**.
 *
 * Consecuencia: la funcionaria veía la actuación registrada y nada le decía que
 * el aviso al ciudadano no salió. Peor que no avisar, porque el sistema parece
 * haber avisado.
 *
 * ── POR QUÉ NO ES UN BOOLEANO, COMO EN PQRSD ──────────────────────────────
 *
 * PQRSD usa `alertaNotificacionFallida: true` porque allí solo hay una clase de
 * notificación. Aquí hay TRES, y saber cuál falló decide qué hay que hacer:
 *
 *  · ACUSE — se puede reenviar sin más; no tiene efecto sobre plazos.
 *  · ACTA  — el plazo de subsanación corre desde la COMUNICACIÓN. Si no salió,
 *            no hay plazo corriendo, y tratarlo como si corriera archivaría por
 *            desistimiento tácito a alguien a quien nunca se le requirió.
 *  · HITO  — informativo; su fallo no cambia ningún plazo.
 *
 * Un booleano las confundiría, y la más grave —el acta— quedaría indistinguible
 * de la más inocua.
 *
 * ── POR QUÉ CADA CLASE SE LIMPIA POR SEPARADO ─────────────────────────────
 *
 * Un envío exitoso limpia SOLO su propia clase. Si el acta falló y semanas
 * después sale bien un correo de hito, la marca del acta SIGUE EN PIE: son
 * hechos distintos, y dejar que uno borre al otro escondería justo el que tiene
 * efecto jurídico.
 */

/** Las tres clases de correo que el módulo de licencias envía al ciudadano. */
export type ClaseComunicacion = 'ACUSE' | 'ACTA' | 'HITO';

export interface FalloComunicacion {
  /** ISO — cuándo se intentó y falló. */
  fechaIso: string;
  /** A quién se intentó escribir. */
  destinatario: string;
}

/** Marca persistida en la raíz del expediente. Una entrada por clase. */
export type ComunicacionesFallidas = Partial<Record<ClaseComunicacion, FalloComunicacion>>;

/**
 * Qué hay que hacer ante el fallo de cada clase, dicho para quien lo lee en
 * pantalla. El del ACTA es el que importa: su fallo tiene efecto sobre el plazo.
 */
export const QUE_HACER: Readonly<Record<ClaseComunicacion, string>> = {
  ACUSE:
    'Vuelva a enviarlo o entrégueselo en el mostrador. No afecta ningún plazo: ' +
    'el acuse solo informa que la solicitud se recibió.',
  ACTA:
    'ATENCIÓN: el plazo de subsanación corre desde que el acta se COMUNICA. Si el ' +
    'correo no salió, ese plazo NO ha empezado, y el expediente no puede archivarse ' +
    'por desistimiento tácito. Comunique el acta por otro medio y registre la fecha.',
  HITO:
    'Informe al ciudadano por otro medio si lo considera necesario. No cambia ningún plazo.',
};

/** Cómo se llama cada clase en pantalla. */
export const NOMBRE_CLASE: Readonly<Record<ClaseComunicacion, string>> = {
  ACUSE: 'acuse de recibo',
  ACTA: 'aviso del acta de observaciones',
  HITO: 'aviso de avance del trámite',
};

/**
 * Calcula cómo queda la marca tras un intento de envío.
 *
 * @returns El objeto completo a persistir, o `null` si no queda ninguna marca
 *   —para que el llamador borre el campo en vez de guardar un objeto vacío, que
 *   se leería como «hay algo» al comprobar la existencia.
 */
export function aplicarResultadoEnvio(
  actual: ComunicacionesFallidas | undefined,
  clase: ClaseComunicacion,
  resultado: { exito: boolean; destinatario: string; fechaIso: string },
): ComunicacionesFallidas | null {
  const siguiente: ComunicacionesFallidas = { ...(actual ?? {}) };

  if (resultado.exito) {
    /* Limpia SOLO su clase. Las otras siguen en pie: son hechos distintos. */
    delete siguiente[clase];
  } else {
    siguiente[clase] = { fechaIso: resultado.fechaIso, destinatario: resultado.destinatario };
  }

  return Object.keys(siguiente).length === 0 ? null : siguiente;
}

/** ¿Hay algún fallo sin resolver? */
export function hayComunicacionFallida(m: ComunicacionesFallidas | undefined): boolean {
  return Boolean(m && Object.keys(m).length > 0);
}

/**
 * ¿Falló el aviso del ACTA y sigue sin resolverse?
 *
 * Se expone aparte porque no es un fallo más: mientras esté en pie, el plazo de
 * subsanación NO ha empezado a correr, y el desistimiento tácito no procede.
 */
export function elActaNoSeComunico(m: ComunicacionesFallidas | undefined): boolean {
  return Boolean(m?.ACTA);
}
