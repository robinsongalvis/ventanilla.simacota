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
): CompletitudExpediente {
  // La definición es hoy una constante compilada y única (la de obra nueva).
  // Cuando el checklist se parametrice por modalidad, este es el punto donde
  // entrará la definición que corresponda — de momento hay una sola y usarla
  // aquí no añade una suposición nueva.
  const tramite = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL;
  const r = evaluarCompletitud(tramite, aportes, contexto);

  return {
    completo: r.completo,
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
