/**
 * lib/server/proyeccion-ventanilla.ts
 *
 * La proyección REDUCIDA del expediente de licencias que ve ventanilla.
 * Pura: entra el documento del expediente, sale lo que la funcionaria puede
 * leerle al ciudadano. Sin Firestore, sin reloj propio.
 *
 * ── POR QUÉ EXISTE (ADR-0034) ─────────────────────────────────────────────
 *
 * En la Administración Municipal TODO entra por ventanilla —por eso las
 * licencias consumen la serie `1-110-`—, pero el expediente vive en
 * `expedientes`, cerrada a todo cliente y visible solo desde el módulo de
 * Planeación. El ciudadano entra por la puerta, pregunta en ventanilla, y la
 * respuesta era «suba a Planeación»: exactamente lo que la Ventanilla Única
 * vino a eliminar.
 *
 * ── EL ALCANCE, DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────
 *
 * QUÉ EXPONE — los cuatro datos del ADR-0034, y solo esos:
 *   1. En qué va               → `estadoJuridico` + su etiqueta legible
 *   2. Desde cuándo corre      → `fechaRadicacionDebidaForma`
 *   3. Cuándo vence            → `fechaAlertaConservadora`
 *   4. Qué documentos faltan   → `completitud.faltantes`
 *
 * QUÉ DEJA FUERA, Y NO ES UN OLVIDO — la lista es el objeto de la decisión:
 *   · Las ACTUACIONES. Quién hizo qué y cuándo es trabajo de Planeación.
 *   · Los DOCUMENTOS: ni la lista, ni metadatos, ni descargas. Ventanilla dice
 *     QUÉ FALTA; no puede ver QUÉ SE APORTÓ.
 *   · Las ACTAS DE OBSERVACIONES: son un acto administrativo dirigido al
 *     ciudadano por conducto de Planeación.
 *   · Toda DELIBERACIÓN interna: notas, conceptos, borradores, motivaciones.
 *   · Cualquier capacidad de ESCRITURA. Ventanilla informa; Planeación decide.
 *
 * REGLA DE AMPLIACIÓN: añadir un campo aquí exige modificar el ADR-0034. Que un
 * campo resulte útil no basta — la utilidad fue siempre el argumento con el que
 * las proyecciones crecen hasta dejar de ser proyecciones.
 */
import type { ExpedienteLicenciaDoc } from './expedientes-licencias';
/* Las etiquetas legibles YA existen en el mapa de estilos del módulo de
   licencias, y son las que la funcionaria de Planeación ya ve. Se reutilizan en
   vez de escribir once labels paralelas: dos fuentes para el mismo texto
   acabarían divergiendo, y entonces el mismo expediente diría una cosa en
   Planeación y otra en el mostrador.

   NOTA sobre el vocabulario: son etiquetas para FUNCIONARIOS, que es quien lee
   esta proyección. Un vocabulario CIUDADANO para los estados jurídicos es otra
   decisión y otro ADR (ADR-0034 §7). */
import { ESTILOS_ESTADO_JURIDICO } from '@/app/interno/licencias/estilos-estado-juridico';

/**
 * Lo que la funcionaria de ventanilla le lee al ciudadano cuando el plazo
 * todavía no empezó. NO es un guion ni un espacio en blanco: un guion la obliga
 * a interpretar, y lo que interprete será suyo y no del sistema (ADR-0034 §4).
 */
export const PLAZO_SIN_EMPEZAR = 'El plazo aún no ha empezado a correr.';

export interface ProyeccionVentanilla {
  numeroExpediente: string | null;
  /** Código del estado jurídico — para la interfaz, no para leérselo a nadie. */
  estadoJuridico: string;
  /** El estado en palabras que el ciudadano entiende. */
  estadoLegible: string;
  /** ISO, o `null` si el plazo no ha empezado. */
  fechaRadicacionDebidaForma: string | null;
  /** ISO, o `null`. Sin ancla no hay vencimiento que proyectar. */
  venceEl: string | null;
  /**
   * Frase EXACTA para el mostrador cuando no hay plazo corriendo. `null`
   * cuando sí corre — así la pantalla no tiene que decidir qué decir.
   */
  avisoPlazo: string | null;
  /** Nombres de los documentos que faltan. Lista vacía = no falta ninguno. */
  faltantes: string[];
  /**
   * `true` cuando la completitud NUNCA se evaluó en servidor. NO es lo mismo
   * que «no falta nada»: es «nadie lo ha revisado todavía», y confundirlos haría
   * que ventanilla le dijera al ciudadano que su solicitud está completa cuando
   * nadie la miró.
   */
  completitudSinEvaluar: boolean;
}

export function proyectarParaVentanilla(exp: ExpedienteLicenciaDoc): ProyeccionVentanilla {
  const ancla = exp.fechaRadicacionDebidaForma ?? null;

  return {
    numeroExpediente: exp.numeroExpediente?.numero ?? null,
    estadoJuridico: exp.estadoJuridico,
    estadoLegible: ESTILOS_ESTADO_JURIDICO[exp.estadoJuridico]?.label ?? exp.estadoJuridico,
    fechaRadicacionDebidaForma: ancla,
    /* Sin ancla NO se proyecta vencimiento, aunque el documento traiga la
       fecha: un vencimiento sin plazo corriendo es una alarma sobre algo que
       todavía no empezó. */
    venceEl: ancla ? exp.fechaAlertaConservadora ?? null : null,
    avisoPlazo: ancla ? null : PLAZO_SIN_EMPEZAR,
    faltantes: (exp.completitud?.faltantes ?? []).map((f) =>
      typeof f === 'string' ? f : (f as { nombre?: string })?.nombre ?? '',
    ).filter((n) => n.length > 0),
    completitudSinEvaluar: exp.completitud === undefined,
  };
}
