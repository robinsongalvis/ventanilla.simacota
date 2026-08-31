/**
 * lib/motor-expedientes/cierre-licencia.ts
 *
 * LA CADENA DE CIERRE: resolución → notificación → plazo de recursos → firmeza.
 * Puro: valida y calcula; no escribe nada.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────
 *
 * El mapa de transiciones admitía los cinco estados de cierre desde siempre,
 * con su fundamento normativo escrito. Pero NINGUNA ruta los escribía: el
 * expediente llegaba a `EN_VIABILIDAD` y se quedaba ahí para siempre, con el
 * término corriendo contra la Alcaldía indefinidamente y el vigía contándolo
 * como vivo. Un trámite que no puede cerrarse es peor que uno que no puede
 * empezar.
 *
 * ── LO QUE ESTE MÓDULO NO DEJA HACER, Y ES EL PUNTO ───────────────────────
 *
 * Cada eslabón tiene una FECHA que produce efectos jurídicos, y el sistema las
 * VERIFICA en vez de creerlas:
 *
 *  · La notificación no puede ser futura: de ella arrancan los plazos de
 *    recurso del ciudadano, y adelantarla se los recorta.
 *  · La firmeza NO se puede declarar antes de que venza el plazo de recursos,
 *    salvo por los motivos que la propia ley reconoce (renuncia expresa,
 *    recursos ya resueltos). Declararla antes le quitaría al ciudadano un
 *    recurso que todavía tenía.
 *  · El desistimiento TÁCITO exige que los 30 días hábiles hayan transcurrido
 *    DE VERDAD desde la comunicación del acta. El vigía lo detecta, pero el
 *    acto lo vuelve a comprobar: entre que el cron mira y el funcionario pulsa
 *    puede haber entrado la respuesta del ciudadano.
 *
 * Esa es la diferencia entre registrar un hecho y afirmarlo.
 *
 * ── LA CONSTANCIA DE EJECUTORIA ───────────────────────────────────────────
 *
 * El documento que el sistema debe poder sustentar necesita cuatro datos, y por
 * eso se persisten ESTRUCTURADOS y no en el texto libre del detalle: número y
 * fecha de la resolución, fecha de la notificación, si se interpusieron
 * recursos, y fecha y motivo de la firmeza. Un dato dentro de una frase no se
 * puede verificar ni volver a imprimir.
 */
import { sumarDiasHabiles, diasHabilesTranscurridos } from '@/lib/tiempos-radicado';

/** CPACA (Ley 1437/2011) art. 76 — recursos dentro de los 10 días hábiles siguientes a la notificación. */
export const DIAS_HABILES_RECURSOS = 10;

/** D.1077/2015 art. 2.2.6.1.2.3.4 — el requerimiento debe atenderse en 30 días hábiles. */
export const DIAS_HABILES_SUBSANACION_TACITO = 30;

/**
 * La PRÓRROGA del ciudadano — D.1077/2015 art. 2.2.6.1.2.2.4:
 *
 *   «Este plazo podrá ser ampliado, a solicitud de parte, hasta por un término
 *    adicional de quince (15) días hábiles»
 *
 * ADR-0038 §2.3. Hasta ahora esto vivía SOLO en el texto del correo al
 * ciudadano (`lib/email/templates/aviso-acta-observaciones.ts`, que ya la
 * nombra): el correo prometía quince días que el reloj no sabía contar, y un
 * desistimiento tácito podía declararse mientras la prórroga corría.
 *
 * «A SOLICITUD DE PARTE»: no se concede sola. Por eso el cómputo la aplica solo
 * cuando consta que se concedió — la ausencia del dato NO es una prórroga.
 */
export const DIAS_HABILES_PRORROGA_SUBSANACION = 15;

/**
 * El plazo del ciudadano para aportar los comprobantes de pago cuando el
 * expediente entra en VIABILIDAD — D.1077/2015 art. 2.2.6.6.8.2:
 *
 *   «contará con un término de treinta (30) días hábiles, contados a partir del
 *    requerimiento de aportar los comprobantes de pago por tales conceptos.
 *    Dentro de este mismo término se deberán cancelar al curador urbano las
 *    expensas correspondientes al cargo variable.»
 *
 * ADR-0038 §9.3. Estuvo en duda porque el art. 2.2.6.1.2.3.1 par. 1 —el que
 * declara la suspensión— dice «treinta (30) días» sin la palabra «hábiles»: no
 * la dice porque REMITE a este artículo, que sí la escribe.
 *
 * UN ARTÍCULO QUE REMITE A OTRO NO ESTÁ CALLANDO: ESTÁ CITANDO. Leer solo el
 * que remite habría dejado la duda abierta para siempre.
 */
export const DIAS_HABILES_PAGO_VIABILIDAD = 30;

/**
 * Motivos por los que un acto queda en firme (CPACA art. 87). Se enumeran
 * porque la firmeza NO es solo «pasó el plazo»: hay tres caminos, y cada uno
 * exige comprobar algo distinto.
 */
export type MotivoFirmeza =
  /** Venció el plazo de recursos sin que se interpusiera ninguno (art. 87 nº 1). */
  | 'PLAZO_VENCIDO_SIN_RECURSOS'
  /** Se interpusieron y ya fueron resueltos (art. 87 nº 2). */
  | 'RECURSOS_RESUELTOS'
  /** El interesado renunció expresamente a recurrir (art. 87 nº 3). */
  | 'RENUNCIA_EXPRESA';

export interface EvidenciaResolucion {
  /** Número del acto administrativo, tal como lo expide Planeación. */
  numeroResolucion: string;
  /** ISO — fecha de expedición del acto. */
  fechaResolucion: string;
}

export interface EvidenciaNotificacion {
  /** ISO — fecha en que el ciudadano quedó notificado. De aquí corren los recursos. */
  fechaNotificacion: string;
  /** Cómo se surtió. Personal es la regla; las demás son subsidiarias. */
  modo: 'PERSONAL' | 'AVISO' | 'ELECTRONICA';
}

export interface EvidenciaFirmeza {
  motivo: MotivoFirmeza;
  /** ISO — fecha desde la que el acto está en firme. */
  fechaFirmeza: string;
}

export type ErrorCierre = { campo: string; mensaje: string };

function esIsoValido(iso: string): boolean {
  return typeof iso === 'string' && !Number.isNaN(new Date(iso).getTime());
}

/** Compara por DÍA CIVIL: las fechas de estos actos son días, no instantes. */
function esPosteriorAlDia(a: string, b: string): boolean {
  return new Date(a).toISOString().slice(0, 10) > new Date(b).toISOString().slice(0, 10);
}

export function validarEvidenciaResolucion(
  e: Partial<EvidenciaResolucion> | undefined,
  ahora: Date,
): ErrorCierre | null {
  if (!e?.numeroResolucion?.trim()) {
    return { campo: 'numeroResolucion', mensaje: 'Escriba el número de la resolución tal como fue expedida.' };
  }
  if (!e.fechaResolucion || !esIsoValido(e.fechaResolucion)) {
    return { campo: 'fechaResolucion', mensaje: 'Indique la fecha de expedición de la resolución.' };
  }
  if (esPosteriorAlDia(e.fechaResolucion, ahora.toISOString())) {
    return {
      campo: 'fechaResolucion',
      mensaje: 'La fecha de la resolución no puede ser futura: sería registrar un acto que todavía no se expidió.',
    };
  }
  return null;
}

export function validarEvidenciaNotificacion(
  e: Partial<EvidenciaNotificacion> | undefined,
  fechaResolucion: string | undefined,
  ahora: Date,
): ErrorCierre | null {
  if (!e?.fechaNotificacion || !esIsoValido(e.fechaNotificacion)) {
    return { campo: 'fechaNotificacion', mensaje: 'Indique la fecha en que el ciudadano quedó notificado.' };
  }
  if (esPosteriorAlDia(e.fechaNotificacion, ahora.toISOString())) {
    /* Adelantar la notificación adelanta el vencimiento de los recursos, y le
       recorta al ciudadano un plazo que la ley le da. */
    return {
      campo: 'fechaNotificacion',
      mensaje: 'La fecha de notificación no puede ser futura: de ella corren los plazos de recurso del ciudadano.',
    };
  }
  if (fechaResolucion && esPosteriorAlDia(fechaResolucion, e.fechaNotificacion)) {
    return {
      campo: 'fechaNotificacion',
      mensaje: 'La notificación no puede ser anterior a la resolución que notifica.',
    };
  }
  if (!e.modo) {
    return { campo: 'modo', mensaje: 'Indique cómo se surtió la notificación (personal, por aviso o electrónica).' };
  }
  return null;
}

/** Cuándo vence el plazo de recursos, contado desde la notificación. */
export function vencimientoRecursos(fechaNotificacion: string): string {
  return sumarDiasHabiles(new Date(fechaNotificacion), DIAS_HABILES_RECURSOS).toISOString();
}

export function validarEvidenciaFirmeza(
  e: Partial<EvidenciaFirmeza> | undefined,
  fechaNotificacion: string | undefined,
  ahora: Date,
): ErrorCierre | null {
  if (!e?.motivo) {
    return { campo: 'motivo', mensaje: 'Indique por qué el acto quedó en firme (CPACA art. 87).' };
  }
  if (!e.fechaFirmeza || !esIsoValido(e.fechaFirmeza)) {
    return { campo: 'fechaFirmeza', mensaje: 'Indique la fecha desde la que el acto está en firme.' };
  }
  if (esPosteriorAlDia(e.fechaFirmeza, ahora.toISOString())) {
    return { campo: 'fechaFirmeza', mensaje: 'La fecha de firmeza no puede ser futura.' };
  }

  /* EL CONTROL QUE IMPORTA. Por vencimiento del plazo, la firmeza NO puede
     declararse antes de que ese plazo venza de verdad: hacerlo le quitaría al
     ciudadano un recurso que todavía tenía. Los otros dos motivos no dependen
     del calendario —el interesado renunció, o los recursos ya se resolvieron—
     y por eso no se les aplica esta comprobación. */
  if (e.motivo === 'PLAZO_VENCIDO_SIN_RECURSOS') {
    if (!fechaNotificacion) {
      return {
        campo: 'motivo',
        mensaje: 'No consta la fecha de notificación, así que no se puede afirmar que el plazo de recursos venció.',
      };
    }
    const vence = vencimientoRecursos(fechaNotificacion);
    if (!esPosteriorAlDia(e.fechaFirmeza, vence) && e.fechaFirmeza.slice(0, 10) !== vence.slice(0, 10)) {
      return {
        campo: 'fechaFirmeza',
        mensaje:
          `El plazo de recursos vence el ${vence.slice(0, 10)} (10 días hábiles desde la notificación, ` +
          'CPACA art. 76). No se puede declarar la firmeza por vencimiento antes de esa fecha.',
      };
    }
  }
  return null;
}

/**
 * ¿Procede el desistimiento TÁCITO?
 *
 * Se vuelve a comprobar aquí aunque el vigía ya lo haya detectado: entre que el
 * cron mira y el funcionario pulsa pueden haber pasado días, y puede haber
 * entrado la respuesta del ciudadano. Ejecutar sobre la foto de ayer archivaría
 * una solicitud que hoy está viva.
 */
export function procedeDesistimientoTacito(entrada: {
  fechaComunicacionActa: string | undefined;
  huboRespuestaSubsanacion: boolean;
  ahora: Date;
  /**
   * ¿Consta que se concedió la prórroga de 15 días hábiles? Solo con este dato
   * se amplía el plazo: «a solicitud de parte» significa que no se presume.
   */
  prorrogaConcedida?: boolean;
}): ErrorCierre | null {
  if (entrada.huboRespuestaSubsanacion) {
    return {
      campo: 'tipo',
      mensaje:
        'El ciudadano ya respondió el acta de observaciones: no procede el desistimiento tácito. ' +
        'Si la respuesta es insuficiente, eso se decide en el acto de fondo, no archivando.',
    };
  }
  if (!entrada.fechaComunicacionActa || !esIsoValido(entrada.fechaComunicacionActa)) {
    /* Sin fecha de comunicación NO se puede contar el plazo. Y el plazo corre
       desde la COMUNICACIÓN, no desde la expedición del acta — dictamen de
       gobierno-digital del 8-ago. */
    return {
      campo: 'fechaComunicacion',
      mensaje:
        'No consta la fecha en que el acta se comunicó al ciudadano, así que no se puede afirmar ' +
        'que hayan transcurrido los 30 días hábiles. Registre la comunicación antes de archivar.',
    };
  }
  const transcurridos = diasHabilesTranscurridos(entrada.fechaComunicacionActa, entrada.ahora);
  /* CON PRÓRROGA CONCEDIDA, el plazo del ciudadano son 45, no 30. Archivar a los
     30 con la prórroga corriendo sería declarar un incumplimiento que no
     ocurrió. */
  const plazo = entrada.prorrogaConcedida === true
    ? DIAS_HABILES_SUBSANACION_TACITO + DIAS_HABILES_PRORROGA_SUBSANACION
    : DIAS_HABILES_SUBSANACION_TACITO;
  if (transcurridos < plazo) {
    return {
      campo: 'plazo',
      mensaje:
        `Han transcurrido ${transcurridos} días hábiles desde la comunicación del acta; el ` +
        `desistimiento tácito procede a los ${plazo}` +
        (entrada.prorrogaConcedida === true
          ? ` (30 + ${DIAS_HABILES_PRORROGA_SUBSANACION} de prórroga concedida, D.1077/2015 art. 2.2.6.1.2.2.4)`
          : ' (D.1077/2015 art. 2.2.6.1.2.3.4)') + '.',
    };
  }
  return null;
}
