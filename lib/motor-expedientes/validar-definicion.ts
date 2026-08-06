/**
 * Validador de la Definición de Trámite (D4, ADR-0026 §A2 #4).
 *
 * PURO: sin I/O, sin Firestore. Se ejecuta ANTES de publicar/activar una
 * Definición (Fase 2, endpoint de administración) para cerrar dos fallos
 * silenciosos detectados en la revisión cruzada de la Fase 0:
 *
 *  - **H1 — condición vacía**: una condición `Y`/`O` con `condiciones: []`
 *    es un veredicto VACUO. Con la lógica de Kleene de `evaluarCondicion`,
 *    `Y([]) → CUMPLE` (ningún elemento es `NO_CUMPLE` ni `INDETERMINADO`,
 *    por vacuidad de `.some()` sobre `[]`) y `O([]) → NO_CUMPLE` (por la
 *    misma razón). ES DECIR: un requisito CONDICIONAL con `Y: []` APLICA
 *    SIEMPRE y uno con `O: []` NUNCA APLICA — silenciosamente, sin que
 *    nadie haya escrito esa regla a propósito. Esto nunca refleja una
 *    intención real de quien redactó el checklist; se rechaza al publicar.
 *  - **Typo de clave → INDETERMINADO indistinguible de un hecho ausente**:
 *    hoy, una condición que referencia una clave de contexto mal escrita
 *    evalúa como INDETERMINADO en tiempo de EVALUACIÓN (comportamiento
 *    correcto y ya blindado por `evaluarCondicion` — fail-closed). Pero es
 *    indistinguible de un caso real donde el hecho legítimamente no se ha
 *    capturado todavía. El validador cierra esto en el momento de PUBLICAR:
 *    exige que toda clave referenciada por una condición esté DECLARADA en
 *    `clavesContexto` de la Definición.
 *
 * FAIL-CLOSED: cualquier error impide publicar/activar la Definición
 * (`valida: false`). Este módulo NO decide activar/desactivar ni persiste
 * nada — esa es responsabilidad del caller (endpoint de administración,
 * Fase 2). NO valida reglas de negocio de ningún trámite concreto (p. ej.
 * Licencia): valida únicamente que la ESTRUCTURA de la Definición sea
 * internamente consistente.
 */

import { clavesReferenciadas } from './completitud';
import type {
  ClaveContextoDeclarada,
  CondicionRequisito,
  DefinicionTramite,
  RequisitoDefinicion,
} from './tipos';

/** Límite de anidamiento de condiciones (`Y`/`O`/`NO`). Cota defensiva contra árboles patológicos o mal generados, no una regla de negocio de ningún trámite. */
export const PROFUNDIDAD_MAXIMA_CONDICION = 10;

export type CodigoErrorValidacionDefinicion =
  | 'CONDICION_VACIA'
  | 'CLAVE_NO_DECLARADA'
  | 'PROFUNDIDAD_EXCEDIDA'
  | 'REQUISITO_ID_DUPLICADO'
  | 'TIPO_INCOHERENTE'
  | 'VALOR_FUERA_DE_DOMINIO';

export interface ErrorValidacionDefinicion {
  codigo: CodigoErrorValidacionDefinicion;
  mensaje: string;
  /** Requisito donde se detectó el error, cuando aplica (p. ej. no aplica a nivel de toda la Definición). */
  requisitoId?: string;
}

export interface ResultadoValidacionDefinicion {
  /** `true` únicamente si `errores` está vacío. Fail-closed: cualquier error impide publicar. */
  valida: boolean;
  errores: ErrorValidacionDefinicion[];
}

/**
 * Valida la Definición de Trámite antes de publicarla/activarla.
 *
 * Reglas (todas fail-closed — cualquier incumplimiento produce un error):
 *  a) Toda condición `Y`/`O` con `condiciones.length === 0` es un error
 *     (cierra H1).
 *  b) Toda clave referenciada por cualquier condición debe estar declarada
 *     en `clavesContexto` (cierra el typo → INDETERMINADO indistinguible).
 *  c) La profundidad de anidamiento de una condición no puede exceder
 *     `PROFUNDIDAD_MAXIMA_CONDICION`.
 *  d) Los `id` de requisito deben ser únicos dentro de la Definición.
 *  e) El tipo (y, si está declarado, el dominio) del/de los valor(es) de una
 *     condición debe ser coherente con el `tipo` declarado de su clave.
 */
export function validarDefinicionTramite(definicion: DefinicionTramite): ResultadoValidacionDefinicion {
  const errores: ErrorValidacionDefinicion[] = [];
  const clavesDeclaradas = new Map<string, ClaveContextoDeclarada>(
    (definicion.clavesContexto ?? []).map((c) => [c.nombre, c] as const),
  );

  errores.push(...detectarIdsDuplicados(definicion.requisitos));

  for (const requisito of definicion.requisitos) {
    if (requisito.tipo !== 'CONDICIONAL') continue;

    // (b): reutiliza `clavesReferenciadas` de completitud.ts (mismo recorrido
    // del árbol que ya usa el evaluador; evita duplicar esa lógica aquí).
    for (const clave of clavesReferenciadas(requisito.condicion)) {
      if (!clavesDeclaradas.has(clave)) {
        errores.push({
          codigo: 'CLAVE_NO_DECLARADA',
          mensaje: `El requisito "${requisito.id}" referencia la clave de contexto "${clave}", que no está declarada en "clavesContexto" de la Definición.`,
          requisitoId: requisito.id,
        });
      }
    }

    // (a), (c), (e): recorrido propio, porque necesitan posición exacta en
    // el árbol (qué nodo está vacío, a qué profundidad, con qué valor).
    recorrerArbolCondicion(requisito, requisito.condicion, clavesDeclaradas, 1, errores);
  }

  return { valida: errores.length === 0, errores };
}

function detectarIdsDuplicados(requisitos: RequisitoDefinicion[]): ErrorValidacionDefinicion[] {
  const vistos = new Set<string>();
  const duplicados = new Set<string>();
  for (const requisito of requisitos) {
    if (vistos.has(requisito.id)) duplicados.add(requisito.id);
    vistos.add(requisito.id);
  }
  return [...duplicados].map((id) => ({
    codigo: 'REQUISITO_ID_DUPLICADO' as const,
    mensaje: `El id de requisito "${id}" está repetido; cada requisito debe tener un id único dentro de la Definición.`,
    requisitoId: id,
  }));
}

function recorrerArbolCondicion(
  requisito: RequisitoDefinicion,
  condicion: CondicionRequisito,
  clavesDeclaradas: Map<string, ClaveContextoDeclarada>,
  profundidad: number,
  errores: ErrorValidacionDefinicion[],
): void {
  if (profundidad > PROFUNDIDAD_MAXIMA_CONDICION) {
    errores.push({
      codigo: 'PROFUNDIDAD_EXCEDIDA',
      mensaje: `La condición del requisito "${requisito.id}" supera la profundidad máxima permitida (${PROFUNDIDAD_MAXIMA_CONDICION}).`,
      requisitoId: requisito.id,
    });
    return; // no seguir bajando: ya reportado, evita un error por cada nivel adicional
  }

  switch (condicion.operador) {
    case 'IGUAL':
    case 'DISTINTO':
      validarCoherenciaValor(requisito, condicion.clave, [condicion.valor], clavesDeclaradas, errores);
      return;
    case 'EN':
      validarCoherenciaValor(requisito, condicion.clave, condicion.valores, clavesDeclaradas, errores);
      return;
    case 'NO':
      recorrerArbolCondicion(requisito, condicion.condicion, clavesDeclaradas, profundidad + 1, errores);
      return;
    case 'Y':
    case 'O':
      if (condicion.condiciones.length === 0) {
        errores.push({
          codigo: 'CONDICION_VACIA',
          mensaje: `La condición "${condicion.operador}" del requisito "${requisito.id}" no tiene sub-condiciones (\`condiciones: []\`); produce un veredicto vacío que nunca refleja una regla real (ver H1, ADR-0026 §A2 #4).`,
          requisitoId: requisito.id,
        });
        return;
      }
      for (const sub of condicion.condiciones) {
        recorrerArbolCondicion(requisito, sub, clavesDeclaradas, profundidad + 1, errores);
      }
      return;
  }
}

/** (e) Coherencia de tipo — y, si está declarado, de dominio — de cada valor de una condición hoja con la clave de contexto que referencia. */
function validarCoherenciaValor(
  requisito: RequisitoDefinicion,
  clave: string,
  valores: ReadonlyArray<string | number | boolean>,
  clavesDeclaradas: Map<string, ClaveContextoDeclarada>,
  errores: ErrorValidacionDefinicion[],
): void {
  const declarada = clavesDeclaradas.get(clave);
  if (!declarada) return; // ya reportado como CLAVE_NO_DECLARADA; sin declaración no hay tipo contra el cual comparar

  for (const valor of valores) {
    if (typeof valor !== declarada.tipo) {
      errores.push({
        codigo: 'TIPO_INCOHERENTE',
        mensaje: `El requisito "${requisito.id}" usa un valor de tipo "${typeof valor}" para la clave "${clave}", declarada como "${declarada.tipo}".`,
        requisitoId: requisito.id,
      });
      continue; // tipo ya incoherente: comprobar dominio no aporta información nueva
    }
    if (declarada.dominio && !declarada.dominio.includes(valor)) {
      errores.push({
        codigo: 'VALOR_FUERA_DE_DOMINIO',
        mensaje: `El requisito "${requisito.id}" usa el valor "${String(valor)}" para la clave "${clave}", que no pertenece a su dominio declarado (${declarada.dominio.join(', ')}).`,
        requisitoId: requisito.id,
      });
    }
  }
}
