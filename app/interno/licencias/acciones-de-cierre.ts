/**
 * app/interno/licencias/acciones-de-cierre.ts
 *
 * QUÉ ACTUACIONES DE CIERRE ofrece la pantalla, dado el estado del expediente.
 * Puro: sin React y sin servidor, para que se pueda probar sin montar nada.
 *
 * ── SE DERIVAN DEL MAPA DE TRANSICIONES, NO DE UNA LISTA A MANO ───────────
 *
 * Los botones salen de `transicionesDesde()`, la misma función que el servidor
 * consulta para aceptar o rechazar la actuación. Una lista escrita aquí podría
 * ofrecer un botón que el servidor rechaza —o, peor, esconder uno que sí
 * procede— y las dos versiones divergirían sin que nada avisara.
 *
 * El caso concreto que esto evita: `DESISTIDA` es alcanzable desde CUATRO
 * estados distintos, y `NOTIFICADA` desde tres. Mantener eso a mano en la
 * interfaz es una lista que se queda corta la primera vez que alguien toca el
 * mapa.
 *
 * ── DOS ACTUACIONES PARA UN MISMO DESTINO ─────────────────────────────────
 *
 * `DESISTIDA` se alcanza por dos caminos que la ley distingue —expreso y
 * tácito— y el sistema no puede elegir por el funcionario: son hechos
 * distintos, con evidencia distinta. Por eso el mapa de destino a actuación no
 * es 1:1 y el tácito solo se ofrece cuando hay acta de por medio, que es la
 * única situación en la que ese hecho puede haber ocurrido.
 */
import {
  transicionesDesde,
  type EstadoJuridicoLicencia,
} from '@/lib/motor-expedientes/estados-licencia';
import type { TipoActuacionPermitida } from '@/lib/server/expedientes-licencias';

export interface AccionDeCierre {
  tipo: TipoActuacionPermitida;
  etiqueta: string;
  /** `true` en las que cierran a favor o en contra: la interfaz las destaca. */
  esDecisionDeFondo: boolean;
}

/**
 * Qué actuación produce cada destino. `DESISTIDA` aparece dos veces a
 * propósito: son dos hechos distintos con evidencia distinta.
 */
const ACCIONES_POR_DESTINO: Readonly<Record<string, AccionDeCierre[]>> = {
  CONCEDIDA: [{ tipo: 'resolucion-concede', etiqueta: 'Registrar resolución que concede', esDecisionDeFondo: true }],
  NEGADA: [{ tipo: 'resolucion-niega', etiqueta: 'Registrar resolución que niega', esDecisionDeFondo: true }],
  DESISTIDA: [
    { tipo: 'desistimiento-expreso', etiqueta: 'Registrar desistimiento del solicitante', esDecisionDeFondo: false },
    { tipo: 'desistimiento-tacito', etiqueta: 'Archivar por desistimiento tácito', esDecisionDeFondo: false },
  ],
  NOTIFICADA: [{ tipo: 'notificacion', etiqueta: 'Registrar notificación', esDecisionDeFondo: false }],
  EN_FIRME: [{ tipo: 'firmeza', etiqueta: 'Registrar firmeza del acto', esDecisionDeFondo: false }],
};

export function accionesDeCierreDisponibles(
  estado: EstadoJuridicoLicencia,
  opciones: { yaHuboActa: boolean },
): AccionDeCierre[] {
  return transicionesDesde(estado, opciones)
    .flatMap((t) => ACCIONES_POR_DESTINO[t.hacia] ?? [])
    /* El TÁCITO solo se ofrece si hubo acta: es el único escenario en que ese
       hecho puede haber ocurrido. Ofrecerlo sin acta invitaría a archivar por
       un incumplimiento que nadie requirió. */
    .filter((a) => a.tipo !== 'desistimiento-tacito' || opciones.yaHuboActa);
}

/**
 * ¿Están todos los eslabones para expedir la constancia de ejecutoria?
 *
 * Es la misma doctrina de la constancia de radicación: sin los hechos, no se
 * compone un papel «provisional» — sería certificar algo que no consta.
 */
export function puedeExpedirEjecutoria(estado: EstadoJuridicoLicencia): boolean {
  return estado === 'EN_FIRME';
}
