/**
 * lib/email/hitos-licencia.ts
 *
 * QUÉ HITOS del expediente de licencia se le comunican al ciudadano por correo,
 * y cuáles NO. Puro: decide y compone texto; no envía nada.
 *
 * ── EL ALCANCE, DECLARADO SOBRE EL DOMINIO ENTERO (ADR-0033 §4.6-bis) ─────
 *
 * `HITO_NOTIFICABLE` es un `Record` COMPLETO sobre los once estados jurídicos,
 * no una lista de los que sí. Si mañana se añade un estado y nadie decide qué
 * pasa con él, **no compila**. Una lista de «los que sí» habría dejado al
 * estado nuevo fuera en silencio — que es exactamente cómo un aviso deja de
 * llegar sin que nadie se entere.
 *
 * Cada exclusión lleva su razón. Excluir es legítimo; excluir sin darse cuenta
 * no.
 *
 * ── EL TEXTO NO SE ESCRIBE DOS VECES ──────────────────────────────────────
 *
 * El correo dice lo MISMO que la consulta pública, porque sale de la misma
 * fuente (`ESTADO_CIUDADANO_LICENCIA`). Dos redacciones del mismo hecho acaban
 * divergiendo, y entonces el ciudadano lee una cosa en el correo y otra en la
 * pantalla sobre el mismo expediente.
 *
 * ── LO QUE ESTE CORREO NO ES ──────────────────────────────────────────────
 *
 * NO es la notificación del acto administrativo. La notificación de una
 * decisión —concesión o negativa— tiene forma legal propia (Ley 1437, arts. 66
 * y ss.) y no se agota con un correo informativo. Por eso los textos de
 * `CONCEDIDA` y `NEGADA` avisan de que hay una decisión y de que debe
 * notificarse, sin dar por notificado a nadie: hacerlo sería atribuirle al
 * ciudadano un acto que no ha ocurrido, y de ahí cuelgan los plazos de recurso.
 */
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { ESTADO_CIUDADANO_LICENCIA } from '@/lib/seguridad/consulta-publica-licencia';

/** Un hito que se comunica, o la razón por la que no. */
export type DecisionHito =
  | { notifica: true; asuntoCorto: string }
  | { notifica: false; razon: string };

export const HITO_NOTIFICABLE: Readonly<Record<EstadoJuridicoLicencia, DecisionHito>> = {
  /* El hito que más importa: a partir de aquí corre el plazo legal, y el
     ciudadano tiene derecho a saber desde cuándo se le cuenta a la Alcaldía. */
  RADICADA_EN_DEBIDA_FORMA: { notifica: true, asuntoCorto: 'Su solicitud quedó radicada' },

  CON_ACTA_DE_OBSERVACIONES: {
    notifica: false,
    razon:
      'El acta YA tiene su propio aviso (`aviso-acta-observaciones`), y es mejor que este: imprime ' +
      'la fecha límite para responder, que el hito genérico no conoce. Al cablear el disparador de ' +
      'hitos este estado mandaba DOS correos por el mismo hecho — exactamente lo que entrena a la ' +
      'gente a ignorar los nuestros. Lo cazó una prueba que ya existía.',
  },

  /* Hay decisión. El correo avisa; la notificación formal es otra cosa. */
  CONCEDIDA: { notifica: true, asuntoCorto: 'Decisión sobre su licencia' },
  NEGADA: { notifica: true, asuntoCorto: 'Decisión sobre su licencia' },

  /* Cierre del trámite sin decisión de fondo: se avisa porque el ciudadano
     puede estar esperando una respuesta que ya no va a llegar. */
  DESISTIDA: { notifica: true, asuntoCorto: 'Su solicitud fue archivada' },

  PRESENTADA: {
    notifica: false,
    razon:
      'Ya se le envió el acuse de recibo al abrir el expediente. Un segundo correo diciendo lo ' +
      'mismo entrena a la gente a ignorar los nuestros.',
  },
  EN_REVISION: {
    notifica: false,
    razon:
      'Empezar a revisar es un hecho operativo interno, no mueve el reloj ni le pide nada al ' +
      'ciudadano. Avisarlo sería ruido.',
  },
  EN_VIABILIDAD: {
    notifica: false,
    razon: 'Misma razón que EN_REVISION: etapa interna del estudio, sin efecto para el ciudadano.',
  },
  NOTIFICADA: {
    notifica: false,
    razon:
      'La notificación ES el acto por el que el ciudadano queda enterado, y tiene forma legal ' +
      'propia. Un correo automático que diga «ya le notificamos» sobraría, y peor: podría leerse ' +
      'como la notificación misma.',
  },
  EN_FIRME: {
    notifica: false,
    razon:
      'La firmeza es el mero transcurso del plazo de recursos. No hay hecho nuevo que contar y no ' +
      'hay nada que el ciudadano pueda hacer ya.',
  },
  HISTORICO_SIN_RESOLVER: {
    notifica: false,
    razon:
      'Expediente migrado del libro histórico. Nunca hubo un hito: es la ausencia declarada de uno, ' +
      'y no hay a quién avisar de algo que no ocurrió hoy.',
  },
};

export interface CorreoHito {
  subject: string;
  titulo: string;
  explicacion: string;
  /** Frase de acción, o `null` si al ciudadano no le toca nada. */
  llamadoAAccion: string | null;
}

/**
 * Compone el correo de un hito, o devuelve `null` si ese estado no se comunica.
 *
 * @returns `null` cuando el estado no es notificable — el llamador no tiene que
 *   conocer la tabla, solo respetar el `null`.
 */
export function componerCorreoHito(
  estado: EstadoJuridicoLicencia,
  numeroExpediente: string,
): CorreoHito | null {
  const decision = HITO_NOTIFICABLE[estado];
  if (!decision.notifica) return null;

  const texto = ESTADO_CIUDADANO_LICENCIA[estado];
  return {
    subject: `${decision.asuntoCorto} — ${numeroExpediente}`,
    titulo: texto.titulo,
    explicacion: texto.explicacion,
    llamadoAAccion:
      texto.accionDelCiudadano === 'DEBE_COMPLETAR'
        ? 'Debe atender las observaciones para que su solicitud continúe.'
        : texto.accionDelCiudadano === 'DEBE_NOTIFICARSE'
          ? 'Debe notificarse de la decisión para que produzca efectos. La Secretaría de Planeación le indicará cómo.'
          : null,
  };
}
