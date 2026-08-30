import { debeNotificarCiudadano, type CriterioNotificacion } from '@/lib/email/debe-notificar-ciudadano';

/* ══════════════════════════════════════════════════════════════
   ¿A QUIÉN SE LE ESCRIBE? — UNA FUENTE, CON LA PRECEDENCIA ESCRITA.

   EL HUECO QUE ESTO CIERRA (visto por el propietario el 29-ago-2026 llenando
   una solicitud): el expediente de licencias guarda `solicitanteNombre` y
   `solicitanteDocumento` y NADA MÁS. Ni correo ni celular. Todo el sistema de
   avisos al ciudadano —acuse, aviso de acta, hitos— se construyó sobre un dato
   que el expediente nunca tuvo.

   No fallaba en silencio, y eso estaba bien resuelto: `procedeComunicacion`
   devolvía «el expediente no tiene radicado vinculado con datos de contacto».
   Pero decir por qué no se puede avisar no es poder avisar. Cada solicitud que
   entraba sin radicado vinculado era un ciudadano al que nunca podríamos
   escribirle.

   ── LA REGLA, decidida por el propietario ────────────────────────────────

   EL EXPEDIENTE NUNCA COPIA EL CONTACTO. Copiarlo crearía dos ejemplares del
   mismo dato: el ciudadano actualiza su correo en ventanilla, licencias sigue
   escribiendo al viejo, y nadie se entera. Es la clase de divergencia
   silenciosa que el R12 del registro de riesgos ya documenta para otro
   predicado.

   La precedencia es esta, y en este orden:

     1. HAY RADICADO VINCULADO → manda el radicado. Siempre. Incluso si el
        radicado no trae correo: entonces NO hay destinatario, y punto. La
        captura propia no lo suple — sería volver a tener dos fuentes por la
        puerta de atrás.
     2. NO HAY RADICADO → manda la captura propia del expediente, que existe
        precisamente para los que nacen huérfanos.
     3. Nadie de los dos → no hay destinatario, con el motivo dicho.

   Y AL VINCULARSE UN RADICADO, la captura propia NO se borra: queda como
   HISTÓRICO de lo que se recogió en mostrador, pero deja de ser destinataria.
   Un dato que fue cierto no se destruye; se le retira la autoridad.

   ── LO QUE ESTE MÓDULO **NO** HACE ───────────────────────────────────────

   NO revalida el correo por su cuenta. Si un correo sirve para escribirle a un
   ciudadano lo decide `debeNotificarCiudadano`, que ya conoce los anónimos, las
   identidades reservadas, el formato y los correos de relleno. Reimplementar
   ese criterio aquí sería crear el gemelo silencioso del R12: dos definiciones
   de «correo notificable» que hoy coinciden y mañana no.
══════════════════════════════════════════════════════════════ */

/** De dónde salió —o por qué no salió— el destinatario. Va a la traza, no solo a la pantalla. */
export type OrigenDestinatario =
  /** Del radicado de ventanilla vinculado: la fuente con precedencia. */
  | 'RADICADO_VINCULADO'
  /** De la captura hecha en el propio expediente, que nació sin radicado. */
  | 'CAPTURA_PROPIA'
  /** El ciudadano DECLARÓ no tener correo. No es un vacío: es un hecho registrado. */
  | 'DECLARADO_SIN_CORREO'
  /** No hay dato, y nadie declaró que no lo hubiera. Este es el que hay que corregir. */
  | 'SIN_DATOS';

/** Contacto recogido en el propio expediente. Mismo mecanismo que ventanilla, incluido el «declara no tener». */
export interface ContactoCapturado {
  correo?: string | null;
  celular?: string | null;
  /** Espejo de `DatosNoAportados` de ventanilla — se declara la ausencia, no se calla. */
  datosNoAportados?: { correo?: boolean; telefono?: boolean };
  /** ISO — cuándo se recogió. Lo que fue cierto queda fechado. */
  capturadoEn?: string;
}

export interface DestinatarioResuelto {
  /** Correo al que escribir, o `null` si no hay a quién. */
  correo: string | null;
  origen: OrigenDestinatario;
  /** Por qué no hay destinatario. Presente solo cuando `correo` es null. */
  motivo?: string;
  /** ¿La captura propia existe pero NO manda por haber radicado? Para mostrarla como histórico. */
  capturaPropiaDesplazada: boolean;
}

export interface EntradaDestinatario {
  /** El radicado de ventanilla vinculado, si lo hay. `null`/`undefined` = expediente huérfano. */
  radicado?: CriterioNotificacion | null;
  /** Lo capturado en el propio expediente. */
  capturaPropia?: ContactoCapturado | null;
}

/**
 * Resuelve a quién se le escribe, aplicando la precedencia declarada arriba.
 *
 * Función PURA: sin Firestore, sin red, sin reloj. Es el único sitio del
 * sistema que decide esto — pantalla y correo la consultan, ninguno la repite.
 */
export function resolverDestinatario(entrada: EntradaDestinatario): DestinatarioResuelto {
  const { radicado, capturaPropia } = entrada;
  const hayCapturaPropia =
    !!capturaPropia?.correo?.trim() || capturaPropia?.datosNoAportados?.correo === true;

  /* ── 1 · EL RADICADO MANDA ─────────────────────────────────────────────
     Si está vinculado, es la fuente. No se cae a la captura propia cuando el
     radicado viene sin correo: caerse sería tener dos fuentes disfrazadas de
     una, que es justo lo que esta precedencia existe para impedir. */
  if (radicado) {
    if (debeNotificarCiudadano(radicado)) {
      return {
        correo: radicado.solicitante?.email?.trim() ?? null,
        origen: 'RADICADO_VINCULADO',
        capturaPropiaDesplazada: hayCapturaPropia,
      };
    }
    return {
      correo: null,
      origen: 'SIN_DATOS',
      motivo:
        'El radicado de ventanilla vinculado no tiene un correo al que escribir ' +
        '(o la presentación es anónima o de identidad reservada). El contacto del ' +
        'expediente lo manda el radicado: actualícelo allí.',
      capturaPropiaDesplazada: hayCapturaPropia,
    };
  }

  /* ── 2 · SIN RADICADO, MANDA LA CAPTURA PROPIA ─────────────────────── */
  if (capturaPropia?.datosNoAportados?.correo === true) {
    return {
      correo: null,
      origen: 'DECLARADO_SIN_CORREO',
      motivo:
        'El solicitante manifestó no tener correo electrónico. No recibirá avisos ' +
        'automáticos: las comunicaciones deben entregarse por otro medio.',
      capturaPropiaDesplazada: false,
    };
  }

  const propio = capturaPropia?.correo?.trim();
  if (propio) {
    /* Se valida con el MISMO criterio que ventanilla, no con uno propio. */
    const sirve = debeNotificarCiudadano({ solicitante: { email: propio } });
    if (sirve) {
      return { correo: propio, origen: 'CAPTURA_PROPIA', capturaPropiaDesplazada: false };
    }
    return {
      correo: null,
      origen: 'SIN_DATOS',
      motivo: 'El correo registrado en el expediente no tiene una forma válida para notificar.',
      capturaPropiaDesplazada: false,
    };
  }

  /* ── 3 · NI LO UNO NI LO OTRO ──────────────────────────────────────── */
  return {
    correo: null,
    origen: 'SIN_DATOS',
    motivo:
      'No se registró correo del solicitante ni se declaró que no lo tuviera. ' +
      'Este ciudadano no recibirá ningún aviso automático.',
    capturaPropiaDesplazada: false,
  };
}

/** ¿Hay que advertirlo en pantalla? Solo cuando NO se puede escribir. */
export function debeAdvertirSinDestinatario(d: DestinatarioResuelto): boolean {
  return d.correo === null;
}
