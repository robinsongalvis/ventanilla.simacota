/**
 * Validador de la Definición de Trámite (D4, ADR-0026 §A2 #4).
 *
 * PURO: sin I/O, sin Firestore. Se ejecuta ANTES de publicar/activar una
 * Definición (Fase 2, endpoint de administración) para cerrar fallos
 * silenciosos detectados en la revisión cruzada de la Fase 0 y, sobre esta
 * misma versión, en la revisión cruzada de la Fase 1 (Datos + Arquitecto,
 * APROBADO_CON_OBSERVACIONES) que encontró GEMELOS de los mismos patrones:
 *
 *  - **H1 — condición vacía**: una condición `Y`/`O` con `condiciones: []`
 *    es un veredicto VACUO. Con la lógica de Kleene de `evaluarCondicion`,
 *    `Y([]) → CUMPLE` (ningún elemento es `NO_CUMPLE` ni `INDETERMINADO`,
 *    por vacuidad de `.some()` sobre `[]`) y `O([]) → NO_CUMPLE` (por la
 *    misma razón). ES DECIR: un requisito CONDICIONAL con `Y: []` APLICA
 *    SIEMPRE y uno con `O: []` NUNCA APLICA — silenciosamente, sin que
 *    nadie haya escrito esa regla a propósito. Esto nunca refleja una
 *    intención real de quien redactó el checklist; se rechaza al publicar.
 *  - **GEMELO de H1 — `EN` con `valores: []`**: misma patología, otro
 *    operador. `evaluarCondicion` hace `[].includes(x) → false → NO_CUMPLE`,
 *    es decir, el requisito "nunca aplica" en silencio. Se rechaza igual
 *    que `Y`/`O` vacíos (mismo código de familia conceptual, código propio
 *    `VALORES_VACIOS` porque el mensaje debe nombrar la clave y el operador).
 *  - **Typo de clave → INDETERMINADO indistinguible de un hecho ausente**:
 *    hoy, una condición que referencia una clave de contexto mal escrita
 *    evalúa como INDETERMINADO en tiempo de EVALUACIÓN (comportamiento
 *    correcto y ya blindado por `evaluarCondicion` — fail-closed). Pero es
 *    indistinguible de un caso real donde el hecho legítimamente no se ha
 *    capturado todavía. El validador cierra esto en el momento de PUBLICAR:
 *    exige que toda clave referenciada por una condición esté DECLARADA en
 *    `clavesContexto` de la Definición.
 *  - **GEMELO de H2 — nombre de clave duplicado en `clavesContexto`**: H2
 *    (ver `completitud.ts`) era `aportes` duplicados perdiendo una entrada en
 *    silencio vía `new Map(...)`. El mismo patrón existía aquí: `new
 *    Map(clavesContexto.map(c => [c.nombre, c]))` deja ganar la ÚLTIMA
 *    declaración de una clave repetida en silencio. Se rechaza (fail-closed,
 *    `CLAVE_DUPLICADA`) en vez de decidir cuál copia es la válida.
 *
 * FAIL-CLOSED: cualquier error impide publicar/activar la Definición
 * (`valida: false`). Este módulo NO decide activar/desactivar ni persiste
 * nada — esa es responsabilidad del caller (endpoint de administración,
 * Fase 2). NO valida reglas de negocio de ningún trámite concreto (p. ej.
 * Licencia): valida únicamente que la ESTRUCTURA de la Definición sea
 * internamente consistente.
 *
 * FUERA DE ALCANCE de este módulo, DIFERIDO a Fase 2 (persistencia,
 * `registrado_para_fase2`): el modelo de almacenamiento de
 * `definiciones-tramite` (¿colección global de plantillas vs. copia
 * por-tenant?) y sus reglas de seguridad son DECISIÓN del Especialista de
 * Firestore, no de este validador puro. Tampoco define aquí el contrato
 * docId-seguro para `requisitoId` / `clave.nombre` (qué caracteres son
 * válidos como componente de un id de documento de Firestore) — eso también
 * es de la capa de persistencia. Este validador solo exige unicidad e
 * higiene ESTRUCTURAL (ids no vacíos y sin duplicar); no decide cómo se
 * guardan.
 */

import { clavesReferenciadas } from './completitud';
import type {
  ClaveContextoDeclarada,
  CondicionRequisito,
  DefinicionTramite,
  RequisitoDefinicion,
} from './tipos';

/**
 * Límite de anidamiento de condiciones (`Y`/`O`/`NO`). NO es solo una cota
 * defensiva contra árboles patológicos: es el límite máximo que Firestore
 * puede FÍSICAMENTE persistir sin rechazar el documento (Fase 2 guarda la
 * Definición completa, condiciones incluidas, dentro de un único documento).
 * Firestore impone un límite duro documentado de 20 niveles de anidamiento
 * de mapas/arreglos dentro de un mismo documento.
 *
 * Cálculo del cap seguro (aproximado y declarado explícitamente como
 * supuesto — Principio 13, no hay medición directa de un documento
 * persistido real todavía porque el modelo de persistencia es de Fase 2):
 *
 *   - Envoltorio fijo hasta llegar a la raíz de UNA condición dentro del
 *     documento `DefinicionTramite`: `requisitos[]` → `requisito{}` →
 *     `condicion{}` = 3 niveles físicos.
 *   - Cada nivel ADICIONAL de anidamiento del DSL (una condición `Y`/`O`/`NO`
 *     que envuelve a otra condición) añade, físicamente, `condiciones[]`
 *     (arreglo) → `condicion{}` (mapa) = 2 niveles físicos más.
 *   - Con `P` = `profundidad` tal como la cuenta este validador (1-indexada:
 *     la condición raíz del requisito ya es `P = 1`), el anidamiento físico
 *     total es: `3 + (P - 1) * 2`.
 *   - Se deja un margen de seguridad de 3 niveles físicos por debajo del
 *     límite duro de Firestore (20), porque "envoltorio" y "costo por nivel"
 *     son estimaciones, y Fase 2 podría necesitar envolver el documento con
 *     un nivel adicional (p. ej. metadata de tenant o versión) sin tener que
 *     revisar esta constante cada vez: `3 + (P - 1) * 2 ≤ 17` ⇒ `P ≤ 8`.
 *
 * Si Fase 2 mide el anidamiento físico real de un documento persistido y el
 * dato difiere de esta estimación, esta constante se ajusta con evidencia
 * (Principio 13: medición antes que opinión), no por intuición.
 */
export const PROFUNDIDAD_MAXIMA_CONDICION = 8;

export type CodigoErrorValidacionDefinicion =
  | 'CONDICION_VACIA'
  | 'VALORES_VACIOS'
  | 'CLAVE_NO_DECLARADA'
  | 'CLAVE_DUPLICADA'
  | 'PROFUNDIDAD_EXCEDIDA'
  | 'REQUISITO_ID_DUPLICADO'
  | 'TIPO_INCOHERENTE'
  | 'VALOR_FUERA_DE_DOMINIO'
  | 'DOMINIO_TIPO_INCOHERENTE';

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
 *  a') Toda condición `EN` con `valores.length === 0` es un error (GEMELO de
 *      H1: `[].includes(x)` siempre es `false`, el requisito "nunca aplica"
 *      en silencio).
 *  b) Toda clave referenciada por cualquier condición debe estar declarada
 *     en `clavesContexto` (cierra el typo → INDETERMINADO indistinguible).
 *     Se reporta UNA vez por clave no declarada distinta dentro de un mismo
 *     requisito, aunque el árbol la referencie varias veces.
 *  b') Ninguna clave puede estar declarada más de una vez en
 *      `clavesContexto` (GEMELO de H2: `new Map` dejaba ganar la última
 *      declaración en silencio).
 *  c) La profundidad de anidamiento de una condición no puede exceder
 *     `PROFUNDIDAD_MAXIMA_CONDICION`.
 *  d) Los `id` de requisito deben ser únicos dentro de la Definición.
 *  e) El tipo (y, si está declarado, el dominio) del/de los valor(es) de una
 *     condición debe ser coherente con el `tipo` declarado de su clave.
 *  f) Cada elemento de `clave.dominio`, para toda clave declarada en
 *     `clavesContexto`, debe ser del mismo `tipo` primitivo que la propia
 *     clave — error del CATÁLOGO en sí, no de ninguna condición que lo use
 *     (se reporta aunque ninguna condición referencie todavía esa clave).
 */
export function validarDefinicionTramite(definicion: DefinicionTramite): ResultadoValidacionDefinicion {
  const errores: ErrorValidacionDefinicion[] = [];
  const clavesContexto = definicion.clavesContexto ?? [];
  const clavesDeclaradas = new Map<string, ClaveContextoDeclarada>(clavesContexto.map((c) => [c.nombre, c] as const));

  errores.push(...detectarIdsDuplicados(definicion.requisitos));
  errores.push(...detectarClavesContextoDuplicadas(clavesContexto));
  errores.push(...detectarDominioIncoherenteConTipo(clavesContexto));

  for (const requisito of definicion.requisitos) {
    if (requisito.tipo !== 'CONDICIONAL') continue;

    // (b): reutiliza `clavesReferenciadas` de completitud.ts (mismo recorrido
    // del árbol que ya usa el evaluador; evita duplicar esa lógica aquí).
    // Dedup con `Set`: `clavesReferenciadas` devuelve una entrada POR
    // APARICIÓN en el árbol, no por clave distinta — sin el `Set`, la misma
    // clave no declarada referenciada N veces producía N errores idénticos.
    for (const clave of new Set(clavesReferenciadas(requisito.condicion))) {
      if (!clavesDeclaradas.has(clave)) {
        errores.push({
          codigo: 'CLAVE_NO_DECLARADA',
          mensaje: `El requisito "${requisito.id}" referencia la clave de contexto "${clave}", que no está declarada en "clavesContexto" de la Definición.`,
          requisitoId: requisito.id,
        });
      }
    }

    // (a), (a'), (c), (e): recorrido propio, porque necesitan posición exacta
    // en el árbol (qué nodo está vacío, a qué profundidad, con qué valor).
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

/**
 * (b') GEMELO de H2: `clavesContexto` no puede declarar el mismo `nombre`
 * más de una vez. `new Map(clavesContexto.map(c => [c.nombre, c]))` (como se
 * construye `clavesDeclaradas` arriba) deja ganar SILENCIOSAMENTE la última
 * declaración cuando hay un nombre repetido — igual que el `aportes`
 * duplicados de H2 en `completitud.ts`. Se rechaza en vez de decidir cuál
 * declaración es la válida.
 */
function detectarClavesContextoDuplicadas(clavesContexto: ClaveContextoDeclarada[]): ErrorValidacionDefinicion[] {
  const vistas = new Set<string>();
  const duplicadas = new Set<string>();
  for (const clave of clavesContexto) {
    if (vistas.has(clave.nombre)) duplicadas.add(clave.nombre);
    vistas.add(clave.nombre);
  }
  return [...duplicadas].map((nombre) => ({
    codigo: 'CLAVE_DUPLICADA' as const,
    mensaje: `La clave de contexto "${nombre}" está declarada más de una vez en "clavesContexto"; el catálogo debe tener nombres únicos (una declaración repetida se descartaría en silencio al construir el mapa de búsqueda).`,
  }));
}

/**
 * (f) Coherencia interna del catálogo: cada elemento de `dominio` debe ser
 * del mismo `tipo` primitivo que la clave declara. Un dominio con un valor
 * de tipo distinto (p. ej. `{ nombre: 'categoria', tipo: 'string', dominio:
 * ['A', 1] }`) es un error del CATÁLOGO en sí — se reporta sin depender de
 * que alguna condición use esa clave, porque el defecto está en la
 * declaración, no en su uso.
 */
function detectarDominioIncoherenteConTipo(clavesContexto: ClaveContextoDeclarada[]): ErrorValidacionDefinicion[] {
  const errores: ErrorValidacionDefinicion[] = [];
  for (const clave of clavesContexto) {
    if (!clave.dominio) continue;
    for (const valor of clave.dominio) {
      if (typeof valor !== clave.tipo) {
        errores.push({
          codigo: 'DOMINIO_TIPO_INCOHERENTE',
          mensaje: `La clave de contexto "${clave.nombre}" declara en su "dominio" el valor "${String(valor)}" de tipo "${typeof valor}", incoherente con su tipo declarado "${clave.tipo}".`,
        });
      }
    }
  }
  return errores;
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
      if (condicion.valores.length === 0) {
        errores.push({
          codigo: 'VALORES_VACIOS',
          mensaje: `La condición "EN" del requisito "${requisito.id}" (clave "${condicion.clave}") no tiene valores (\`valores: []\`); produce un veredicto que "nunca aplica" en silencio (\`[].includes(x)\` siempre es \`false\` — GEMELO de H1/CONDICION_VACIA), y nunca refleja una regla real escrita a propósito.`,
          requisitoId: requisito.id,
        });
        return;
      }
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
