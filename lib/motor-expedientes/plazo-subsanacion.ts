/**
 * lib/motor-expedientes/plazo-subsanacion.ts
 *
 * EL PLAZO DEL CIUDADANO PARA SUBSANAR — UN SOLO CÁLCULO. Puro: sin Firestore,
 * sin reloj propio más allá del `ahora` que se le pasa.
 *
 * ── EL DEFECTO QUE LO OBLIGA ──────────────────────────────────────────────
 *
 * El mismo plazo legal se calculaba en DOS sitios, con reglas distintas:
 *
 *   · `procedeDesistimientoTacito` (`./cierre-licencia.ts`) — el guard que
 *     autoriza archivar. Contaba 30 días hábiles, o 45 si constaba la prórroga.
 *   · `evaluarPlazoSubsanacion` (`@/lib/server/expedientes-licencias`) — el que
 *     alimenta la pantalla. Contaba 30. Siempre 30.
 *
 * Hoy coincidían por accidente: el único llamador del guard nunca pasaba el
 * dato de la prórroga, así que en licencias el plazo era 30 en ambos. La
 * maquinaria de los quince días estaba completa, probada y SIN UN SOLO
 * LLAMADOR — la tercera vez de ese patrón en este módulo (la emisión del
 * 68745 y el bloque de ventanilla fueron las dos anteriores).
 *
 * El momento peligroso era justo este: cablear la prórroga en un solo lado.
 * La pantalla le habría dicho a la funcionaria «el plazo venció, proceda a
 * archivar» y el servidor se lo habría negado quince días hábiles seguidos —
 * el mismo callejón del #328, en el otro sentido.
 *
 * Por eso el cálculo sube aquí y los dos lo consumen. Un solo plazo, una sola
 * respuesta.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECIDE: cuántos días hábiles tiene el ciudadano (30, o 45 con prórroga
 * válida), cuándo vencen, cuántos quedan, y si una prórroga registrada cuenta
 * o no.
 *
 * Esto NO DECIDE, y es deliberado: nada del término de 45 días hábiles de la
 * ADMINISTRACIÓN. Cuándo se reanuda ese reloj, qué efecto tiene la renuncia
 * expresa al plazo restante, y el descuento entre la expedición y la
 * comunicación del acta siguen ⚖️ BLOQUEADOS a la espera del concepto escrito
 * de Jurídica (hueco 1, ADR-0029). Este módulo cuenta el plazo del ciudadano;
 * no mueve el de la Secretaría.
 */
import { sumarDiasHabiles, diasRestantesHabiles } from '@/lib/tiempos-radicado';

/** D.1077/2015 art. 2.2.6.1.2.3.4 — el requerimiento debe atenderse en 30 días hábiles. */
export const DIAS_HABILES_SUBSANACION_BASE = 30;

/**
 * La PRÓRROGA del ciudadano — D.1077/2015 art. 2.2.6.1.2.2.4:
 *
 *   «Este plazo podrá ser ampliado, a solicitud de parte, hasta por un término
 *    adicional de quince (15) días hábiles»
 *
 * «A SOLICITUD DE PARTE»: no se concede sola. El cómputo la aplica solo cuando
 * consta que se pidió — la ausencia del dato NO es una prórroga (ADR-0038 §3).
 */
export const DIAS_HABILES_PRORROGA_SUBSANACION = 15;

/**
 * El slug de la actuación que deja constancia de la prórroga.
 *
 * NO entra en `ESTADO_DESTINO_POR_TIPO_ACTUACION`, y es deliberado: ese mapa
 * declara las actuaciones que MUEVEN el estado jurídico, y una prórroga no lo
 * mueve — el expediente sigue `CON_ACTA_DE_OBSERVACIONES`. Se registra por su
 * propia ruta, igual que los movimientos documentales.
 *
 * Tampoco entra en `SLUG_A_TIPO_EVENTO` (`./termino.ts`): no toca el término de
 * la ADMINISTRACIÓN. Amplía el plazo del ciudadano, que es otro reloj.
 */
export const SLUG_PRORROGA_SUBSANACION = 'prorroga-subsanacion';

/** Por qué una prórroga registrada no se tuvo en cuenta. `null` = sí se tuvo. */
export type ProrrogaDescartada = 'SOLICITADA_FUERA_DE_PLAZO';

/**
 * Los hechos que deciden el plazo. Se declaran como DATOS y no se leen de
 * Firestore aquí: quien llama ya los tiene resueltos, y así esto se prueba sin
 * levantar nada.
 */
export interface HechosDelPlazoSubsanacion {
  /**
   * ISO — día en que el acta se COMUNICÓ al ciudadano. No la expedición: el
   * plazo corre desde que él se entera.
   */
  comunicadaEl: string | null;
  /**
   * La prórroga, si consta. `solicitadaEl` es la fecha del hecho del CIUDADANO
   * —que es la que la norma condiciona—, no la del día en que la funcionaria
   * la registró en el sistema.
   */
  prorroga: { solicitadaEl: string } | null;
}

export interface PlazoSubsanacion {
  /** 30, o 45 cuando la prórroga cuenta. */
  diasHabiles: number;
  conProrroga: boolean;
  /** ISO — el día en que se le acaba el tiempo al ciudadano. */
  venceEl: string;
  /** Negativo cuando ya venció. */
  diasHabilesRestantes: number;
  vencido: boolean;
  /**
   * Presente cuando SE REGISTRÓ una prórroga y aun así no se aplicó. No se
   * calla: una prórroga descartada en silencio es peor que ninguna — la
   * funcionaria creería tener quince días que no tiene.
   */
  prorrogaDescartada?: ProrrogaDescartada;
}

/**
 * El plazo del ciudadano. `null` cuando no hay nada que contar — sin
 * comunicación del acta no corre plazo contra nadie, y afirmar lo contrario
 * sería contar tiempo desde un hecho que no consta.
 */
export function calcularPlazoSubsanacion(
  hechos: HechosDelPlazoSubsanacion,
  ahora: Date,
): PlazoSubsanacion | null {
  if (!hechos.comunicadaEl) return null;
  const base = new Date(hechos.comunicadaEl);
  if (Number.isNaN(base.getTime())) return null;

  const venceBase = sumarDiasHabiles(hechos.comunicadaEl, DIAS_HABILES_SUBSANACION_BASE);

  /* LA PRÓRROGA SOLO CUENTA SI SE PIDIÓ A TIEMPO. Pedirla cuando el plazo ya
     venció no revive un término extinguido: para entonces la solicitud ya
     estaba incumplida y lo que procede es el desistimiento, no una ampliación.
     Se descarta con su motivo, nunca en silencio. */
  const prorroga = hechos.prorroga;
  if (prorroga) {
    const solicitada = new Date(prorroga.solicitadaEl);
    const fueraDePlazo = Number.isNaN(solicitada.getTime()) || solicitada.getTime() > venceBase.getTime();
    if (fueraDePlazo) {
      return conVencimiento(venceBase, DIAS_HABILES_SUBSANACION_BASE, false, ahora, 'SOLICITADA_FUERA_DE_PLAZO');
    }
    const dias = DIAS_HABILES_SUBSANACION_BASE + DIAS_HABILES_PRORROGA_SUBSANACION;
    return conVencimiento(sumarDiasHabiles(hechos.comunicadaEl, dias), dias, true, ahora);
  }

  return conVencimiento(venceBase, DIAS_HABILES_SUBSANACION_BASE, false, ahora);
}

function conVencimiento(
  vence: Date,
  diasHabiles: number,
  conProrroga: boolean,
  ahora: Date,
  prorrogaDescartada?: ProrrogaDescartada,
): PlazoSubsanacion {
  const diasHabilesRestantes = diasRestantesHabiles(vence, ahora);
  return {
    diasHabiles,
    conProrroga,
    venceEl: vence.toISOString(),
    diasHabilesRestantes,
    vencido: diasHabilesRestantes < 0,
    ...(prorrogaDescartada ? { prorrogaDescartada } : {}),
  };
}

/**
 * ¿Esta solicitud de prórroga llega a tiempo? Se pregunta ANTES de registrarla,
 * para no dejar en el expediente un hecho que el cómputo va a descartar.
 *
 * Misma frontera que usa `calcularPlazoSubsanacion`, en una sola función: si
 * fueran dos comparaciones separadas, la ruta podría aceptar una prórroga que
 * el cálculo no honra, y el expediente diría una cosa y el reloj otra.
 */
export function prorrogaLlegaATiempo(comunicadaEl: string, solicitadaEl: string | Date): boolean {
  const solicitada = solicitadaEl instanceof Date ? solicitadaEl : new Date(solicitadaEl);
  if (Number.isNaN(solicitada.getTime())) return false;
  return solicitada.getTime() <= sumarDiasHabiles(comunicadaEl, DIAS_HABILES_SUBSANACION_BASE).getTime();
}
