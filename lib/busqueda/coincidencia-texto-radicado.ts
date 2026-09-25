import { identidadProtegida, type RadicadoConReserva } from '@/lib/seguridad/identidad-protegida';

/**
 * ¿ESTE RADICADO COINCIDE CON ESTE TEXTO? — UNA sola respuesta para todo el
 * sistema (ADR-0041 §3.7, paso 2).
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────
 *
 * Hasta el 1-sep-2026 esta pregunta se respondía en DOS sitios distintos:
 * `matchTextoLibre` (`filtros-radicado.ts`, que usan el servidor y la búsqueda
 * avanzada del mostrador) y un filtro en línea dentro de la página del Tablero.
 * Hacían casi lo mismo, con diferencias que nadie había decidido:
 *
 *   · el mostrador buscaba en el correo del solicitante y en el nombre del
 *     tipo de trámite; el Tablero, no;
 *   · el Tablero buscaba el nombre HUMANO de la dependencia
 *     («Secretaría de Planeación»); el mostrador, solo su código interno;
 *   · y —lo más delicado— cada uno traía su propia copia de la guarda de
 *     identidad reservada: el Tablero usaba el predicado canónico del ADR-0006
 *     y el mostrador lo REIMPLEMENTABA.
 *
 * Esa última es la familia que este proyecto ya conoce: el criterio que vive en
 * más de un sitio se olvida en uno de ellos. Pasó con los datos de prueba que
 * Control Interno no excluía, y estuvo a punto de pasar aquí — el oficio que no
 * reconocía los cuatro marcadores de reserva (issue #301) es exactamente el
 * mismo defecto en otra superficie.
 *
 * El disparador fue una pregunta del propietario: «¿qué pasa cuando alguien
 * busca con el 1-110 pero es 68745, y al revés?». Al ir a añadir el número del
 * expediente en tres sitios apareció que el sitio debía ser UNO.
 *
 * ── QUÉ CAMBIA PARA QUIEN BUSCA ───────────────────────────────────────────
 *
 * Nadie pierde nada: se toma la UNIÓN de lo que cada uno buscaba, así que el
 * Tablero gana el correo y el tipo de trámite, y el mostrador gana el nombre
 * humano de la dependencia. Y las dos superficies ganan el número del
 * expediente vinculado, que es lo que el ADR-0041 vino a resolver.
 *
 * ── LO QUE NO CAMBIA, Y ES DELIBERADO ─────────────────────────────────────
 *
 * La guarda de identidad. Un radicado con identidad protegida NO coincide por
 * nombre, documento ni correo — solo por sus números y por los datos que no son
 * del solicitante. Buscar «Juan Pérez» y ver aparecer una fila protegida sería
 * revelar por inferencia lo que la pantalla oculta (ADR-0012 / R9). Y el número
 * de expediente NO es dato de identidad: entra al texto libre sin excepción,
 * igual que el radicado.
 *
 * ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA: qué campos participan y
 * cuáles quedan detrás de la guarda de identidad. Esto NO decide: qué
 * conjunto de radicados se le muestra a quien busca (eso es de la autorización
 * por tenant, aguas arriba) ni cómo se ordenan los resultados.
 */

/** Lo mínimo para responder la pregunta — no acopla al documento entero. */
export interface RadicadoParaTexto extends RadicadoConReserva {
  radicadoId: string;
  solicitante?: {
    nombreCompleto?: string | null;
    numeroDocumento?: string | null;
    email?: string | null;
  } | null;
  detalle?: { asunto?: string | null } | null;
  clasificacion?: {
    oficinaDestino?: string | null;
    funcionarioResponsableNombre?: string | null;
  } | null;
  termino?: { tipoSolicitudNombre?: string | null } | null;
  /** El espejo del expediente vinculado — el `68745-…` del ADR-0041. */
  vinculoExpediente?: { numeroExpediente?: string | null } | null;
}

/**
 * Minúsculas, sin tildes y sin espacios sobrantes: «MARÍA», « María » y «maria»
 * son el mismo término.
 *
 * El recorte NO es cosmético. Sin él, un campo de búsqueda con solo espacios
 * —lo que queda al borrar con la tecla y dejar uno suelto— no vale «sin
 * filtro» sino «busca tres espacios seguidos», y la pantalla se queda en
 * blanco sin que nadie entienda por qué.
 */
export function normalizarTextoBusqueda(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Campos que participan SIEMPRE — ninguno es dato personal del solicitante.
 *
 * `nombreDependencia` lo inyecta el llamador porque el nombre humano de una
 * dependencia vive en el directorio de tenants, que este módulo no debe
 * importar (lo usa tanto el servidor como el cliente).
 */
function camposPublicos(r: RadicadoParaTexto, nombreDependencia?: string | null): unknown[] {
  return [
    r.radicadoId,
    r.vinculoExpediente?.numeroExpediente,
    r.detalle?.asunto,
    r.termino?.tipoSolicitudNombre,
    r.clasificacion?.oficinaDestino,
    nombreDependencia,
    r.clasificacion?.funcionarioResponsableNombre,
  ];
}

/** Campos del SOLICITANTE — solo cuando su identidad no está protegida. */
function camposDeIdentidad(r: RadicadoParaTexto): unknown[] {
  return [
    r.solicitante?.nombreCompleto,
    r.solicitante?.numeroDocumento,
    r.solicitante?.email,
  ];
}

/**
 * `true` si `termino` (ya normalizado) aparece en algún campo buscable.
 *
 * Término vacío coincide con todo — mismo criterio que «sin filtro», y permite
 * al llamador invocarla sin un condicional propio.
 */
export function coincideTextoRadicado(
  r: RadicadoParaTexto,
  terminoNormalizado: string,
  opciones: { nombreDependencia?: string | null } = {},
): boolean {
  if (!terminoNormalizado) return true;

  const campos = [
    ...camposPublicos(r, opciones.nombreDependencia),
    ...(identidadProtegida(r) ? [] : camposDeIdentidad(r)),
  ];

  for (const campo of campos) {
    if (!campo) continue;
    if (normalizarTextoBusqueda(campo).includes(terminoNormalizado)) return true;
  }
  return false;
}
