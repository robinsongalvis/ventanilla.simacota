/**
 * app/interno/licencias/que-sigue.ts
 *
 * QUÉ SIGUE EN ESTE EXPEDIENTE — la acción del momento, y todo lo demás en su
 * sitio.
 *
 * ── EL PROBLEMA QUE RESUELVE ──────────────────────────────────────────────
 *
 * La columna de acciones era una PILA PLANA: «Registrar desistimiento» arriba,
 * en verde y habilitado, y lo que de verdad tocaba hacer —iniciar la revisión—
 * ni siquiera aparecía. Lo destructivo era lo más visible y lo urgente no se
 * veía. Un funcionario que baja la vista y pulsa el primer botón verde archiva
 * un trámite vivo.
 *
 * ── UNA SOLA FUENTE: EL MAPA DE TRANSICIONES ──────────────────────────────
 *
 * Todo lo que este módulo ofrece sale de `transicionesDesde()`, la MISMA
 * función que el servidor consulta para aceptar o rechazar una actuación.
 *
 * Y aquí estaba la segunda lista que había que matar: hasta ahora el mapa solo
 * cubría los destinos de CIERRE (`acciones-de-cierre.ts`), mientras «Iniciar
 * revisión» y «Registrar acta» vivían cableados a mano en la pantalla, con sus
 * propias condiciones. Dos fuentes para la misma pregunta. Ahora el catálogo
 * cubre TODOS los destinos del mapa y la pantalla no decide nada: solo presenta
 * con jerarquía lo que el dominio ya decidió.
 *
 * ── LA JERARQUÍA, Y POR QUÉ ES ASÍ ────────────────────────────────────────
 *
 *  1. PRINCIPAL — la acción que hace avanzar el trámite por su camino natural.
 *     Grande, y sola. Es la respuesta a «¿y ahora qué hago?».
 *  2. DISPONIBLES — lo demás que procede hoy, discreto.
 *  3. ESPERANDO — lo que NO procede todavía, atenuado y CON SU PORQUÉ. No se
 *     esconde: esconderlo obligaría a recordar que existe.
 *  4. PAPEL — imprimir y descargar. No cambian nada, así que no compiten.
 *  5. APARTE — lo destructivo, al final y sin destacar. Nunca el más visible.
 */
import {
  transicionesDesde,
  type EstadoJuridicoLicencia,
} from '@/lib/motor-expedientes/estados-licencia';
import type { TipoActuacionPermitida } from '@/lib/server/expedientes-licencias';

export type RangoAccion = 'PRINCIPAL' | 'DISPONIBLE' | 'APARTE';

export interface AccionQueSigue {
  tipo: TipoActuacionPermitida;
  etiqueta: string;
  /** Qué queda registrado al hacerlo. Se muestra bajo la principal. */
  nota?: string;
  rango: RangoAccion;
}

/**
 * Qué actuación produce cada destino del mapa, y con qué peso.
 *
 * `DESISTIDA` aparece dos veces a propósito: expreso y tácito son hechos
 * distintos con evidencia distinta, y el sistema no elige por el funcionario.
 * Los dos van APARTE: archivar un trámite no puede ser nunca el botón que
 * primero se encuentra la mano.
 */
/** Actuaciones que solo tienen sentido si ya hubo acta de observaciones. */
const EXIGEN_ACTA_PREVIA = new Set<TipoActuacionPermitida>(['desistimiento-tacito', 'respuesta-subsanacion']);

const ACCIONES_POR_DESTINO: Readonly<Record<string, AccionQueSigue[]>> = {
  EN_REVISION: [{
    tipo: 'inicio-revision',
    etiqueta: 'Iniciar revisión',
    nota: 'queda registrado con su fecha y su nombre',
    rango: 'PRINCIPAL',
  }],
  CON_ACTA_DE_OBSERVACIONES: [{
    tipo: 'acta-observaciones',
    etiqueta: 'Registrar acta de observaciones',
    nota: 'suspende el término mientras el ciudadano subsana',
    rango: 'DISPONIBLE',
  }],
  /* EN_VIABILIDAD lo produce `respuesta-subsanacion`, y SOLO tiene sentido si
     hubo acta: es la respuesta A ALGO. Por eso se filtra igual que el
     desistimiento tácito.

     CORRECCIÓN DE UN ERROR MÍO (30-ago-2026): primero declaré que ninguna
     actuación producía este estado y llegué a inventarme un `acto-viabilidad`
     que no existe. Lo cazó `tsc`. La actuación existía; lo que no existe es
     otra cosa, más estrecha y más interesante — ver `destinosSinActuacion`. */
  EN_VIABILIDAD: [{
    tipo: 'respuesta-subsanacion',
    etiqueta: 'Registrar respuesta de subsanación',
    nota: 'reanuda el término donde se detuvo (D.1077 art. 2.2.6.1.2.2.4)',
    rango: 'PRINCIPAL',
  }],
  CONCEDIDA: [{ tipo: 'resolucion-concede', etiqueta: 'Registrar resolución que concede', rango: 'PRINCIPAL' }],
  NEGADA: [{ tipo: 'resolucion-niega', etiqueta: 'Registrar resolución que niega', rango: 'DISPONIBLE' }],
  NOTIFICADA: [{ tipo: 'notificacion', etiqueta: 'Registrar notificación', rango: 'PRINCIPAL' }],
  EN_FIRME: [{ tipo: 'firmeza', etiqueta: 'Registrar firmeza del acto', rango: 'PRINCIPAL' }],
  DESISTIDA: [
    { tipo: 'desistimiento-expreso', etiqueta: 'El solicitante desiste del trámite', rango: 'APARTE' },
    { tipo: 'desistimiento-tacito', etiqueta: 'Archivar por desistimiento tácito', rango: 'APARTE' },
  ],
};

/** Una acción que NO procede hoy, con el motivo que lo explica. */
export interface AccionEsperando {
  etiqueta: string;
  /** Por qué no procede. Sale del SERVIDOR o del dominio, nunca se redacta aquí a ojo. */
  porque: string;
}

export interface QueSigue {
  /** La acción del momento. `null` cuando el expediente ya no avanza más. */
  principal: AccionQueSigue | null;
  disponibles: AccionQueSigue[];
  esperando: AccionEsperando[];
  aparte: AccionQueSigue[];
  /**
   * Destinos que el mapa declara alcanzables desde este estado y que NINGUNA
   * actuación produce. No se muestran al funcionario —un botón que el servidor
   * rechazaría es peor que ninguno— pero se declaran para que el hueco sea
   * visible y comprobable en vez de silencioso.
   */
  destinosSinActuacion: EstadoJuridicoLicencia[];
}

export interface EntradaQueSigue {
  estado: EstadoJuridicoLicencia;
  yaHuboActa: boolean;
  /**
   * Motivos por los que algo no procede, TAL COMO LOS DA EL SERVIDOR. La
   * pantalla no los redacta: los coloca.
   */
  motivos?: { acta?: string | null; respuesta?: string | null };
}

/**
 * Deriva el panel entero del estado. Función PURA: sin React, sin servidor.
 */
export function derivarQueSigue(entrada: EntradaQueSigue): QueSigue {
  const { estado, yaHuboActa, motivos } = entrada;

  const ofrecidas = transicionesDesde(estado, { yaHuboActa })
    .flatMap((t) => ACCIONES_POR_DESTINO[t.hacia] ?? [])
    /* El TÁCITO solo si hubo acta: es el único escenario en que ese hecho puede
       haber ocurrido. Ofrecerlo sin acta invitaría a archivar por un
       incumplimiento que nadie requirió. */
    /* Dos actuaciones piden acta previa, por el mismo motivo: son respuestas a
       un hecho que puede no haber ocurrido. El tácito, porque el incumplimiento
       que archiva nace del acta; la subsanación, porque es la respuesta A ella. */
    .filter((a) => !EXIGEN_ACTA_PREVIA.has(a.tipo) || yaHuboActa);

  const principales = ofrecidas.filter((a) => a.rango === 'PRINCIPAL');

  /* EL HUECO QUE SÍ EXISTE, declarado y no tapado: un destino que el mapa
     permite y para el que, EN ESTE ESTADO, no queda ninguna actuación ofrecible.
     El caso real es `EN_REVISION → EN_VIABILIDAD` sin acta previa: el comentario
     del mapa dice «si no requiere acta, pasa directo», pero la única actuación
     que produce EN_VIABILIDAD es la respuesta a un acta que no existe. Un
     expediente limpio, sin observaciones, no tiene por dónde avanzar. */
  const destinos = transicionesDesde(estado, { yaHuboActa }).map((t) => t.hacia);
  const ofrecidos = new Set(ofrecidas.map((a) => a.tipo));
  const destinosSinActuacion = destinos.filter(
    (d) => !(ACCIONES_POR_DESTINO[d] ?? []).some((a) => ofrecidos.has(a.tipo)),
  );

  return {
    destinosSinActuacion,
    /* Si el mapa ofreciera dos principales, gana la primera y las demás bajan a
       disponibles: DOS acciones «del momento» no son una jerarquía. */
    principal: principales[0] ?? null,
    disponibles: [
      ...principales.slice(1).map((a) => ({ ...a, rango: 'DISPONIBLE' as const })),
      ...ofrecidas.filter((a) => a.rango === 'DISPONIBLE'),
    ],
    esperando: motivoAEsperando(motivos),
    aparte: ofrecidas.filter((a) => a.rango === 'APARTE'),
  };
}

function motivoAEsperando(motivos: EntradaQueSigue['motivos']): AccionEsperando[] {
  const fuera: AccionEsperando[] = [];
  if (motivos?.acta) fuera.push({ etiqueta: 'Registrar acta de observaciones', porque: motivos.acta });
  if (motivos?.respuesta) fuera.push({ etiqueta: 'Registrar respuesta de subsanación', porque: motivos.respuesta });
  return fuera;
}
