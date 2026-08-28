/**
 * lib/seguridad/consulta-publica-licencia.ts
 *
 * Lo que el CIUDADANO ve de su licencia cuando consulta su radicado. Puro: sin
 * Firestore, sin reloj propio.
 *
 * ── POR QUÉ NO ES UNA CONSULTA APARTE ─────────────────────────────────────
 *
 * El ADR-0034 §7 dejó abierta la consulta ciudadana de licencias con dos
 * reparos: hacía falta un vocabulario ciudadano para los estados jurídicos, y
 * un segundo factor propio.
 *
 * El segundo reparo desapareció solo. Desde #252 el número del expediente ES el
 * del libro de ventanilla, y el radicado guarda `vinculoExpediente`: el
 * ciudadano ya consulta con el número que tiene en la mano, por la ruta que ya
 * existe, verificado con el mismo segundo factor —correo, últimos cuatro del
 * documento o token— y bajo el mismo límite de tasa. No se inventa superficie
 * nueva: se añade un bloque a la respuesta que ya se devuelve.
 *
 * El primero es este archivo.
 *
 * ── EL VOCABULARIO, Y POR QUÉ NO SE REUTILIZAN LAS ETIQUETAS INTERNAS ─────
 *
 * «Con acta de observaciones» es exacto y no significa nada para quien no
 * trabaja en Planeación. «En viabilidad» tampoco. Reutilizar esas etiquetas
 * habría sido gratis y habría dejado al ciudadano igual de perdido que antes,
 * con la diferencia de que ahora creería que le informamos.
 *
 * Cada estado se traduce a lo que el ciudadano necesita saber: qué pasó, y si
 * le toca hacer algo. Ese segundo dato —`accionDelCiudadano`— es el que
 * convierte una pantalla informativa en una útil.
 *
 * ── LO QUE NO SE DICE ─────────────────────────────────────────────────────
 *
 * Ni actuaciones, ni documentos, ni actas, ni deliberación: el mismo recorte
 * del ADR-0034, que aquí es MÁS estricto porque el destinatario es el público.
 * No se dice qué documentos faltan —eso exige una conversación, y el listado
 * crudo de requisitos incumplidos leído sin contexto asusta más que orienta—;
 * se dice que hay observaciones y a dónde acudir.
 */
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

/** Qué le toca hacer al ciudadano, si es que le toca algo. */
export type AccionCiudadanoLicencia = 'NINGUNA' | 'DEBE_COMPLETAR' | 'DEBE_NOTIFICARSE';

export interface EstadoLicenciaCiudadano {
  /** Una frase, en el idioma de quien no trabaja aquí. */
  titulo: string;
  /** Qué significa, sin tecnicismos y sin prometer nada. */
  explicacion: string;
  accionDelCiudadano: AccionCiudadanoLicencia;
}

/**
 * Traducción de los once estados jurídicos.
 *
 * Es un `Record` COMPLETO a propósito, no un `switch` con `default`: si mañana
 * se añade un estado al tipo y nadie escribe su texto, **no compila**. Un
 * `default` habría dejado al ciudadano leyendo «en trámite» sobre un estado que
 * nadie decidió cómo explicarle.
 */
export const ESTADO_CIUDADANO_LICENCIA: Record<EstadoJuridicoLicencia, EstadoLicenciaCiudadano> = {
  PRESENTADA: {
    titulo: 'Recibimos su solicitud',
    explicacion:
      'Tenemos sus documentos y estamos verificando que estén completos. El plazo legal de ' +
      'respuesta todavía no ha empezado a correr: empieza cuando la solicitud esté completa.',
    accionDelCiudadano: 'NINGUNA',
  },
  RADICADA_EN_DEBIDA_FORMA: {
    titulo: 'Su solicitud quedó radicada en debida forma',
    explicacion:
      'La documentación está completa y el plazo legal de respuesta empezó a correr.',
    accionDelCiudadano: 'NINGUNA',
  },
  EN_REVISION: {
    titulo: 'Su solicitud está en estudio',
    explicacion:
      'La Secretaría de Planeación está revisando el proyecto. No necesita hacer nada por ahora.',
    accionDelCiudadano: 'NINGUNA',
  },
  CON_ACTA_DE_OBSERVACIONES: {
    titulo: 'Le hicimos observaciones y necesitamos su respuesta',
    explicacion:
      'La revisión encontró aspectos que usted debe corregir o completar. Las observaciones se le ' +
      'comunican por escrito; mientras las atiende, el plazo de respuesta está suspendido.',
    accionDelCiudadano: 'DEBE_COMPLETAR',
  },
  EN_VIABILIDAD: {
    titulo: 'Su solicitud está en la etapa final de estudio',
    explicacion:
      'La Secretaría de Planeación está preparando la decisión sobre su solicitud.',
    accionDelCiudadano: 'NINGUNA',
  },
  CONCEDIDA: {
    titulo: 'Su licencia fue concedida',
    explicacion:
      'La Alcaldía decidió a favor de su solicitud. Para que la licencia produzca efectos debe ' +
      'notificarse; le indicaremos cómo hacerlo.',
    accionDelCiudadano: 'DEBE_NOTIFICARSE',
  },
  NEGADA: {
    titulo: 'Su solicitud fue negada',
    explicacion:
      'La Alcaldía decidió no conceder la licencia. La decisión se le notifica por escrito con sus ' +
      'motivos y con los recursos que puede interponer.',
    accionDelCiudadano: 'DEBE_NOTIFICARSE',
  },
  DESISTIDA: {
    titulo: 'Su solicitud se archivó por desistimiento',
    explicacion:
      'La solicitud se archivó porque no se completó la información requerida dentro del plazo. ' +
      'Puede presentar una solicitud nueva cuando lo desee.',
    accionDelCiudadano: 'NINGUNA',
  },
  NOTIFICADA: {
    titulo: 'La decisión ya le fue notificada',
    explicacion:
      'Usted quedó formalmente enterado de la decisión. A partir de la notificación corren los ' +
      'plazos para interponer recursos, si desea hacerlo.',
    accionDelCiudadano: 'NINGUNA',
  },
  EN_FIRME: {
    titulo: 'La decisión sobre su solicitud quedó en firme',
    explicacion:
      'Venció el plazo para interponer recursos, así que la decisión ya no admite discusión en la ' +
      'vía administrativa. No necesita hacer nada más.',
    accionDelCiudadano: 'NINGUNA',
  },
  HISTORICO_SIN_RESOLVER: {
    titulo: 'Su solicitud está en el archivo histórico',
    explicacion:
      'Su expediente viene del libro histórico de la Secretaría de Planeación y en los registros no ' +
      'consta cómo terminó. Para conocer su situación, acérquese a la Secretaría de Planeación con ' +
      'este número.',
    accionDelCiudadano: 'NINGUNA',
  },
};

/** Lo que viaja al ciudadano. Lista positiva: nada del expediente se propaga solo. */
export interface LicenciaPublica {
  numeroExpediente: string | null;
  estado: EstadoLicenciaCiudadano;
  /** ISO — desde cuándo corre el plazo. `null` si todavía no corre. */
  desdeCuandoCorreElPlazo: string | null;
  /** Frase EXACTA para cuando no corre; `null` cuando sí. Doctrina del ADR-0034 §4. */
  avisoPlazo: string | null;
}

export const PLAZO_SIN_EMPEZAR_CIUDADANO =
  'El plazo de respuesta aún no ha empezado a correr.';

/**
 * Compone el bloque de licencia de la consulta pública.
 *
 * NO recibe el expediente entero sino los tres campos que necesita: así es
 * imposible que un campo nuevo del documento se cuele en la respuesta pública
 * por olvido — el defecto que el mapper de PQRSD documenta y que aquí se evita
 * por construcción en vez de por lista de exclusiones.
 */
export function aLicenciaPublica(entrada: {
  numeroExpediente: string | null;
  estadoJuridico: EstadoJuridicoLicencia;
  fechaRadicacionDebidaForma: string | null;
}): LicenciaPublica {
  const corre = Boolean(entrada.fechaRadicacionDebidaForma);
  return {
    numeroExpediente: entrada.numeroExpediente,
    estado: ESTADO_CIUDADANO_LICENCIA[entrada.estadoJuridico],
    desdeCuandoCorreElPlazo: entrada.fechaRadicacionDebidaForma,
    avisoPlazo: corre ? null : PLAZO_SIN_EMPEZAR_CIUDADANO,
  };
}
