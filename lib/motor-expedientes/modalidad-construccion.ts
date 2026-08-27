/**
 * lib/motor-expedientes/modalidad-construccion.ts
 *
 * La MODALIDAD de una licencia de construcción — obra nueva, ampliación,
 * demolición… — capturada como dato del expediente. Puro, sin I/O.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────
 *
 * El sistema validaba la modalidad contra el catálogo normativo y acto seguido
 * la descartaba: no era un subtipo, no era clave de contexto, no había campo
 * que la guardara. Nadie se la preguntaba al funcionario. Como consecuencia:
 *
 *  · el checklist evaluaba SIEMPRE contra la definición de obra nueva
 *    (`__tests__/checklist-ciego-a-la-modalidad.test.ts`);
 *  · los papeles del ciudadano tuvieron que dejar de nombrarla, porque
 *    nombrarla habría sido inventarla (#258);
 *  · `seleccionarReglaVigencia` devuelve `MODALIDAD_REQUERIDA` para toda
 *    licencia de construcción, porque el dato que necesita no existe
 *    (`./vigencias.ts`) — un consumidor esperando desde antes que este campo.
 *
 * Este módulo es el prerequisito de la matriz de requisitos por modalidad:
 * sin el campo, la matriz no tiene contra qué aplicarse.
 *
 * ── DOS EJES, UNA PALABRA: CUIDADO ────────────────────────────────────────
 *
 * `Expediente.subtipos` guarda códigos de FIGURA (`CONSTRUCCION`,
 * `URBANIZACION`…) del `CATALOGO_FIGURAS_NORMATIVAS`. El JSDoc de
 * `DefinicionTramite.subtipos` en `./tipos.ts` usa como ejemplo «Obra Nueva,
 * Ampliación» —que son MODALIDADES, no figuras—: es una imprecisión heredada
 * de la Fase 2, corregida en ese archivo. La modalidad NO va en `subtipos`.
 *
 * ── POR QUÉ UNA LISTA Y NO UN VALOR ───────────────────────────────────────
 *
 * El art. 2.2.6.1.1.7 par. 1 permite COMBINAR varias modalidades en una misma
 * licencia (ampliación + demolición parcial, p. ej.), y el catálogo lo advierte
 * expresamente. Guardar una sola obligaría a elegir cuál de las dos se escribe
 * y cuál se pierde. `seleccionarReglaVigencia` recibe hoy una modalidad
 * singular: alimentarla desde una combinación es una decisión de vigencias
 * —que tiene su propio error explícito para lo que no puede desambiguar— y NO
 * se resuelve aquí de tapadillo.
 *
 * ── LA AUSENCIA ES UN VALOR, Y SE RESPETA ─────────────────────────────────
 *
 * Un expediente creado antes de este campo no lo trae. Ese hueco significa
 * «nunca se capturó», que NO es «obra nueva». Nada en este módulo rellena la
 * ausencia con un valor por defecto: sería la misma invención que se corrigió
 * en los papeles, cambiada de sitio. Quien lea el campo distingue los dos
 * casos o no lo lee.
 */
import { MODALIDADES_CONSTRUCCION } from './catalogo-subtipos-normativo';

/**
 * La ÚNICA figura del catálogo con un eje de modalidad sin capturar.
 *
 * Las tres modalidades de subdivisión (rural, urbana y reloteo) NO necesitan
 * esta pregunta: el catálogo las modela como tres FIGURAS distintas agrupadas
 * por `claseDe: 'SUBDIVISION'`, así que ya viajan en `subtipos`.
 */
export const FIGURA_CON_MODALIDAD = 'CONSTRUCCION';

/** Códigos válidos, derivados del catálogo — nunca escritos a mano. */
const CODIGOS_MODALIDAD = new Set(MODALIDADES_CONSTRUCCION.map((m) => m.codigo));
const NOMBRE_POR_CODIGO = new Map(
  MODALIDADES_CONSTRUCCION.map((m) => [m.codigo, m.nombre.toLowerCase()]),
);

/** ¿Este conjunto de figuras exige preguntar por la modalidad? */
export function exigeModalidadConstruccion(subtipos: readonly string[] | undefined): boolean {
  return Array.isArray(subtipos) && subtipos.includes(FIGURA_CON_MODALIDAD);
}

/**
 * Valida las modalidades contra las figuras del mismo expediente.
 *
 * @returns Mensaje de error para el funcionario, o `null` si son válidas.
 *
 * NO exige que estén presentes cuando la figura las admite: capturarlas es
 * obligatorio en la pantalla, pero un expediente puede legítimamente no
 * traerlas —los creados antes de este campo— y esta función se usa también
 * para leerlos. Quien exija la captura es el llamador, no la validación.
 */
export function validarModalidadesConstruccion(
  subtipos: readonly string[] | undefined,
  modalidades: unknown,
): string | null {
  if (modalidades === undefined || modalidades === null) return null;

  if (!Array.isArray(modalidades)) {
    return 'Las modalidades de construcción deben venir como una lista de códigos.';
  }

  if (modalidades.length > 0 && !exigeModalidadConstruccion(subtipos)) {
    return (
      'Se indicaron modalidades de construcción, pero el expediente no incluye la figura ' +
      `"${FIGURA_CON_MODALIDAD}". La modalidad es un atributo DENTRO de la licencia de ` +
      'construcción (art. 2.2.6.1.1.7); las demás figuras no la tienen.'
    );
  }

  for (const codigo of modalidades) {
    if (typeof codigo !== 'string' || !CODIGOS_MODALIDAD.has(codigo)) {
      return (
        `La modalidad "${String(codigo)}" no está en el catálogo normativo de modalidades de ` +
        'construcción (art. 2.2.6.1.1.7, nueve modalidades). Revise la selección.'
      );
    }
  }

  const vistos = new Set<string>();
  for (const codigo of modalidades as string[]) {
    if (vistos.has(codigo)) return `La modalidad "${codigo}" está repetida en la solicitud.`;
    vistos.add(codigo);
  }

  return null;
}

/**
 * Nombra las modalidades para un texto dirigido a una persona.
 *
 * @returns Texto en minúsculas, o `null` si no hay ninguna capturada — `null`
 *   y no una cadena vacía, para que el llamador tenga que decidir qué dice
 *   ante la ausencia en vez de concatenar un hueco sin darse cuenta.
 */
export function describirModalidades(modalidades: readonly string[] | undefined): string | null {
  if (!Array.isArray(modalidades) || modalidades.length === 0) return null;

  const nombres = modalidades
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    /* Un código fuera del catálogo se TRANSCRIBE, no se descarta: descartarlo
       dejaría el papel describiendo de menos y en silencio. */
    .map((c) => NOMBRE_POR_CODIGO.get(c) ?? c);

  if (nombres.length === 0) return null;
  if (nombres.length === 1) return nombres[0];

  const ultimo = nombres[nombres.length - 1];
  return `${nombres.slice(0, -1).join(', ')} y ${ultimo}`;
}
