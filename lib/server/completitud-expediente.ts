import { evaluarCompletitud } from '@/lib/motor-expedientes/completitud';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import type { AporteRequisito, ContextoEvaluacionRequisito } from '@/lib/motor-expedientes/tipos';

/**
 * Completitud calculada EN EL SERVIDOR y guardada en el expediente.
 *
 * QUÉ RESUELVE, Y QUÉ NO. Hasta ahora `evaluarCompletitud` tenía un único
 * llamador en todo el repositorio: un componente de navegador
 * (`ChecklistRequisitos.tsx`, marcado `'use client'`), y su efecto visible era
 * una etiqueta de color. El servidor nunca la consultaba, así que la
 * completitud no era un hecho del expediente sino una opinión de la pantalla:
 * dependía de quién estuviera mirando, y desaparecía si la funcionaria
 * trabajaba desde otra vista.
 *
 * Esto la convierte en dato: se calcula en el servidor con cada cambio de los
 * aportes y se guarda junto al expediente, igual que el espejo del término
 * (`fechaAlertaConservadora`).
 *
 * LO QUE ESTO **NO** HACE, a propósito: no bloquea nada. Qué se impide cuando
 * el expediente está incompleto —crear, transicionar, radicar— es la decisión
 * del ADR-0033, que depende de que exista un estado previo a
 * `RADICADA_EN_DEBIDA_FORMA`. Adelantar la compuerta antes de esa decisión
 * significaría elegir por defecto entre bloquear la creación (imposible: los
 * documentos se suben A un expediente que ya debe existir) o inventar un
 * estado. Aquí solo se produce el hecho; quien lo use vendrá después, y ya
 * tendrá una verdad del servidor que leer en vez de recalcularla.
 */
export interface CompletitudExpediente {
  /** `false` si falta un requisito aplicable, hay un indeterminado o un aporte duplicado. */
  completo: boolean;
  /** Requisitos que aplican al caso y aún no tienen documento. Es lo que la constancia impresa necesita listar (ADR-0033 §4.8). */
  faltantes: { requisitoId: string; nombre: string; motivo: string }[];
  /** Cuántos requisitos aplican de verdad a este caso — los condicionales que no aplicaron no cuentan. */
  aplicables: number;
  /** Instante del cálculo, en el reloj del SERVIDOR. */
  evaluadoEn: string;
  /**
   * INSTANTE EN QUE LA SOLICITUD QUEDÓ COMPLETA — el hecho que ancla el
   * término de 45 días hábiles (D.1077/2015 art. 2.2.6.1.2.1.1 par. 1).
   *
   * POR QUÉ NO BASTABA DEDUCIRLO. Antes de este campo, el acto de radicar
   * derivaba el ancla de la fecha del último documento aportado. Pero esa
   * fecha (`DocumentoExpedienteDoc.creadoEn`) es la del PRIMER archivo de ese
   * requisito, y el servidor no revisa contenido: un PDF equivocado subido el
   * día 1 marca el requisito como aportado, y la corrección posterior entra
   * como versión nueva sin moverla. El término habría arrancado el día 1 —
   * pudiendo nacer ya vencido, que es reconocer de oficio un silencio
   * administrativo positivo.
   *
   * Se GRABA la primera vez que `completo` pasa a `true` y se CONSERVA
   * mientras siga siéndolo: recalcular no debe reescribir un hecho ya
   * ocurrido. Si la completitud se pierde (se retira un documento, cambia el
   * contexto y aplica un requisito nuevo), se BORRA: cuando vuelva a
   * completarse, el término arranca desde la fecha nueva — el tiempo que el
   * expediente pasó incompleto no corre contra la Administración.
   *
   * Ausente (`undefined`) también en los expedientes evaluados antes de que
   * este campo existiera; quien lo lea debe distinguir «nunca estuvo
   * completo» de «no lo sabemos», y nunca inventar una fecha.
   */
  completoDesde?: string;
}

/**
 * Calcula el resumen persistible. Función PURA salvo por el `ahora` que recibe:
 * el instante entra por parámetro para que toda una operación use el mismo
 * reloj y para que la prueba pueda fijarlo.
 *
 * @param aportes  Estado de los requisitos DESPUÉS del cambio que motiva el recálculo.
 * @param contexto Hechos del caso (resuelven los requisitos condicionales).
 */
export function calcularCompletitudExpediente(
  aportes: AporteRequisito[],
  contexto: ContextoEvaluacionRequisito,
  ahora: Date,
  /** Lo que había guardado antes del cambio — de ahí se conserva `completoDesde`. */
  previa?: CompletitudExpediente,
): CompletitudExpediente {
  // La definición es hoy una constante compilada y única (la de obra nueva).
  // Cuando el checklist se parametrice por modalidad, este es el punto donde
  // entrará la definición que corresponda — de momento hay una sola y usarla
  // aquí no añade una suposición nueva.
  const tramite = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL;
  const r = evaluarCompletitud(tramite, aportes, contexto);

  /* `completoDesde` se conserva si ya estaba y la solicitud SIGUE completa;
     nace ahora si acaba de completarse; desaparece si dejó de estarlo. */
  const completoDesde = r.completo ? (previa?.completoDesde ?? ahora.toISOString()) : undefined;

  return {
    completo: r.completo,
    ...(completoDesde ? { completoDesde } : {}),
    faltantes: r.faltantes.map((f) => ({
      requisitoId: f.requisitoId,
      nombre: f.nombre,
      motivo: String(f.motivo),
    })),
    // Total de requisitos menos los condicionales que NO aplicaron a este caso.
    aplicables: tramite.requisitos.length - r.noAplicables.length,
    evaluadoEn: ahora.toISOString(),
  };
}

/** Lo que el ciudadano necesita ver en un acuse de recibo: qué entregó y qué le falta. */
export interface ResumenDocumentosAcuse {
  entregados: string[];
  faltantes: { nombre: string; motivo: string }[];
  aplicables: number;
  completo: boolean;
}

/**
 * Qué documentos entregó el ciudadano y cuáles le faltan, con nombres
 * legibles — no ids de requisito.
 *
 * PARA QUÉ EXISTE. El acuse de recibo tiene que decirle al ciudadano qué
 * queda pendiente; si no, no le sirve de nada haber venido. `CompletitudExpediente`
 * ya guarda los faltantes, pero no los ENTREGADOS: contar «12 de 19» sin poder
 * enumerar los 12 obliga a la persona a volver al mostrador a preguntar
 * exactamente lo que el acuse existe para evitar.
 *
 * Los requisitos condicionales que NO aplican a este caso no se listan en
 * ninguna de las dos columnas: pedirle a alguien un documento que su trámite
 * no exige es tan dañino como no pedirle el que sí.
 */
export function resumenDocumentosAcuse(
  aportes: AporteRequisito[],
  contexto: ContextoEvaluacionRequisito,
): ResumenDocumentosAcuse {
  const tramite = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL;
  const r = evaluarCompletitud(tramite, aportes, contexto);

  const noAplican = new Set(r.noAplicables);
  const faltanIds = new Set(r.faltantes.map((f) => f.requisitoId));
  const indeterminados = new Set(r.indeterminados.map((i) => i.requisitoId));

  const entregados = tramite.requisitos
    .filter((req) => !noAplican.has(req.id) && !faltanIds.has(req.id) && !indeterminados.has(req.id))
    .map((req) => req.nombre);

  return {
    entregados,
    faltantes: r.faltantes.map((f) => ({ nombre: f.nombre, motivo: String(f.motivo) })),
    aplicables: tramite.requisitos.length - r.noAplicables.length,
    completo: r.completo,
  };
}
