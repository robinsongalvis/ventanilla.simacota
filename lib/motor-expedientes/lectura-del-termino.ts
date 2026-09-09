/**
 * lib/motor-expedientes/lectura-del-termino.ts
 *
 * LO QUE UNA PANTALLA DICE DEL RELOJ — EN UN SOLO SITIO. Puro: sin Firestore,
 * sin correo, sin reloj propio más allá del `ahora` que se le pasa.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────
 *
 * `clasificarFrenteAlTermino` ya decidía la SITUACIÓN (corriendo, suspendido,
 * resuelto, sin anclar) para el cron y para la tarjeta de Planeación. Pero los
 * NÚMEROS que la persona lee —«39 días hábiles», «día 6 de 45», el porcentaje
 * del anillo— se calculaban dentro de `CabeceraTermino`, es decir, dentro de la
 * pantalla de Planeación y solo allí.
 *
 * Mientras hubo una sola pantalla eso no molestaba. En cuanto ventanilla tuvo
 * que responder «¿cuántos días faltan?» (ADR-0034), había dos caminos: copiar
 * la aritmética —y arriesgarse a que el mostrador dijera 39 y Planeación 38 del
 * MISMO expediente, delante del ciudadano— o subirla aquí. Es exactamente el
 * motivo por el que el criterio del semáforo subió en su día desde el cron.
 *
 * Lo pidió el propietario el 9-sep-2026 con estas palabras: «la idea es que
 * concuerde uno con el otro independientemente».
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECIDE: en qué situación está el término y, cuando corre, cuántos días
 * hábiles quedan, cuántos van corridos, sobre cuántos, y qué proporción de
 * avance representa.
 *
 * Esto NO DECIDE: qué PALABRAS acompañan al número. Planeación le dice a su
 * técnico qué hacer («o sale la resolución, o sale el acta»); ventanilla le lee
 * un hecho al ciudadano. Son audiencias distintas y cada pantalla escribe lo
 * suyo — lo que no puede divergir es el NÚMERO.
 *
 * Tampoco decide los colores (viven en `COLOR_NIVEL_TERMINO`) ni si la pantalla
 * tiene derecho a ver el expediente (eso es de la autorización, aguas arriba).
 */
import {
  clasificarFrenteAlTermino,
  PLAZO_DECISION_LICENCIA_DIAS_HABILES,
  type NivelTermino,
} from './semaforo-termino';
import type { EstadoJuridicoLicencia } from './estados-licencia';

/** Lo mínimo para leer el reloj. Los dos ISO son los que ya viajan a ambas pantallas. */
export interface EntradaLecturaTermino {
  expedienteId: string;
  estadoJuridico: EstadoJuridicoLicencia;
  /** ISO del vencimiento proyectado (`fechaAlertaConservadora`). `null` si el plazo no ha empezado. */
  venceIso: string | null;
  /** ISO del ancla — desde cuándo corre. Opcional: los expedientes anteriores al acto de radicar no la tienen. */
  desdeIso?: string | null;
}

export interface TerminoCorriendo {
  situacion: 'CORRIENDO';
  /** `EN_TERMINO` cuando no hay escalón de alerta — mismo vocabulario que el correo. */
  nivel: NivelTermino | 'EN_TERMINO';
  vencido: boolean;
  /** Negativo cuando ya venció: los días que lleva vencido, con signo. */
  diasHabilesRestantes: number;
  /** «día N de 45». Nunca menor que 0 ni mayor que el total. */
  diaTranscurrido: number;
  totalDias: number;
  /** 0-100, para anillos y barras. */
  porcentaje: number;
  venceIso: string;
  desdeIso: string | null;
}

export interface TerminoSuspendido {
  situacion: 'SUSPENDIDO';
  /** El artículo que detiene el reloj, para poder citarlo tal cual. */
  fundamento: string;
}

export interface TerminoSinAnclar { situacion: 'SIN_ANCLAR' }
export interface TerminoResuelto { situacion: 'RESUELTO' }

export type LecturaDelTermino =
  | TerminoCorriendo
  | TerminoSuspendido
  | TerminoSinAnclar
  | TerminoResuelto;

/**
 * El reloj, leído. La MISMA respuesta para el mostrador y para Planeación: si
 * un día divergieran, dos funcionarias darían dos plazos distintos del mismo
 * expediente y el ciudadano se llevaría el que le tocara en suerte.
 */
export function leerElTermino(
  entrada: EntradaLecturaTermino,
  ahora: Date = new Date(),
): LecturaDelTermino {
  const fila = clasificarFrenteAlTermino(
    {
      id: entrada.expedienteId,
      estadoJuridico: entrada.estadoJuridico,
      /* `creadoEn` solo lo usa la rama SIN_ANCLAR para contar la espera, un
         número que ninguna de las dos pantallas pinta. Se pasa un relleno en
         vez de exigir un dato que el mostrador no recibe. */
      creadoEn: entrada.desdeIso ?? entrada.venceIso ?? ahora.toISOString(),
      fechaAlertaConservadora: entrada.venceIso,
    },
    ahora,
  );

  if (fila.situacion === 'SUSPENDIDO') {
    return { situacion: 'SUSPENDIDO', fundamento: fila.fundamentoSuspension ?? '' };
  }
  if (fila.situacion === 'RESUELTO') return { situacion: 'RESUELTO' };
  if (fila.situacion === 'SIN_ANCLAR') return { situacion: 'SIN_ANCLAR' };

  /* CORRIENDO implica que hubo `fechaAlertaConservadora`: la rama SIN_ANCLAR es
     lo primero que descarta el clasificador. El `?? ''` no es alcanzable y
     existe solo para que el tipo salga estrecho sin un `!`. */
  const venceIso = entrada.venceIso ?? '';
  const restantes = fila.diasHabilesRestantes ?? 0;
  const total = PLAZO_DECISION_LICENCIA_DIAS_HABILES;
  const diaTranscurrido = Math.max(0, total - Math.max(0, restantes));

  return {
    situacion: 'CORRIENDO',
    nivel: fila.nivel ?? 'EN_TERMINO',
    vencido: fila.nivel === 'VENCIDO',
    diasHabilesRestantes: restantes,
    diaTranscurrido,
    totalDias: total,
    porcentaje: Math.min(100, Math.round((diaTranscurrido / total) * 100)),
    venceIso,
    desdeIso: entrada.desdeIso ?? null,
  };
}
