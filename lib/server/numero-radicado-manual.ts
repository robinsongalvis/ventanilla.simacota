import { CODIGO_OFICINA_RADICADORA } from '@/lib/radicado-institucional';

/**
 * EL NÚMERO QUE EL OPERARIO TRANSCRIBE DEL LIBRO DE VENTANILLA.
 *
 * DECISIÓN DEL PROPIETARIO (26-ago-2026). En la Administración Municipal todo
 * entra por ventanilla, y el número de ventanilla es **el oficial, el único, el
 * que vale**. Una licencia no recibe un número propio: recibe el que ya tiene
 * en el libro de la Alcaldía.
 *
 * Por eso el acto de radicar dejó de EMITIR y pasó a RECIBIR: el operario mira
 * el libro, escribe el número, el sistema lo valida y lo graba. Un solo número,
 * no dos.
 *
 * ── POR QUÉ ESTO ES UNA TRANSCRIPCIÓN, Y QUÉ IMPLICA ─────────────────────
 *
 * El dato no nace aquí: nace en un libro de papel, escrito a mano. Este módulo
 * no lo genera ni lo corrige — lo VALIDA y lo NORMALIZA, que son dos cosas
 * distintas y las dos necesarias:
 *
 *  · VALIDAR, porque un número mal transcrito se convierte en la identidad
 *    legal de un trámite y no hay forma de repararlo después.
 *
 *  · NORMALIZAR, porque el mismo número admite varias escrituras. El libro
 *    puede decir `01342` y el sistema escribe `00001342`. Si se guardaran tal
 *    cual, dos transcripciones del MISMO número parecerían números distintos —
 *    y la comprobación de unicidad, que es la que impide que dos licencias
 *    compartan radicado, no vería la colisión.
 *
 * Se acepta cualquier ancho de 1 a 8 dígitos y se rellena a la izquierda hasta
 * la forma canónica del sistema. Así el operario puede escribir lo que ve en el
 * libro, y lo que queda grabado es lo mismo que emitiría la plataforma — de
 * modo que la búsqueda, la consulta pública y el Libro lo encuentran.
 *
 * FAIL-CLOSED: ante la duda, se rechaza. Un rechazo cuesta que el operario
 * vuelva a mirar el libro; un número mal grabado cuesta un expediente que se
 * pisa con otro.
 */

/** Forma canónica: `1-{oficina}-{AAAAMM}-{8 dígitos}`. La misma que emite la plataforma. */
const CANONICO_RE = new RegExp(`^1-${CODIGO_OFICINA_RADICADORA}-(\\d{4})(0[1-9]|1[0-2])-(\\d{8})$`);

/** Lo que se acepta TECLEAR: el mismo formato con 1 a 8 dígitos en el consecutivo. */
const ENTRADA_RE = new RegExp(`^1-${CODIGO_OFICINA_RADICADORA}-(\\d{4})(0[1-9]|1[0-2])-(\\d{1,8})$`);

export type NumeroRadicadoManual =
  | {
      ok: true;
      /** Forma canónica, la que se graba y con la que se comprueba la unicidad. */
      canonico: string;
      /** Exactamente lo que el operario escribió, ya sin espacios. Se conserva para el acta. */
      transcrito: string;
      /** `true` si normalizar cambió el texto — la pantalla debe enseñárselo antes de grabar. */
      seNormalizo: boolean;
      anio: number;
      mes: number;
      consecutivo: number;
    }
  | { ok: false; motivo: string };

/**
 * Valida y normaliza el número que el operario transcribió del libro.
 *
 * @param entrada Lo tecleado, tal cual.
 * @param hoy     Para comprobar que el número no viene del futuro. Entra por
 *                parámetro para que la prueba pueda fijarlo.
 */
export function validarNumeroRadicadoManual(
  entrada: unknown,
  hoy: Date = new Date(),
): NumeroRadicadoManual {
  if (typeof entrada !== 'string' || !entrada.trim()) {
    return { ok: false, motivo: 'Escriba el número de radicado que aparece en el libro de ventanilla.' };
  }

  // Se tolera lo que un teclado añade sin querer, no lo que cambia el número.
  const transcrito = entrada.trim().replace(/\s+/g, '');

  const m = ENTRADA_RE.exec(transcrito);
  if (!m) {
    return {
      ok: false,
      motivo:
        `El número no tiene la forma del libro de ventanilla. Debe ser ` +
        `1-${CODIGO_OFICINA_RADICADORA}-{año}{mes}-{consecutivo}, por ejemplo ` +
        `1-${CODIGO_OFICINA_RADICADORA}-202608-01342. Revise el libro y vuelva a escribirlo.`,
    };
  }

  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const consecutivo = Number(m[3]);

  if (consecutivo === 0) {
    return { ok: false, motivo: 'El consecutivo no puede ser cero: el libro no empieza en cero.' };
  }

  /* Un número del futuro es casi siempre un dedazo en el año o el mes, y es un
     dedazo caro: fija la serie anual a la que se imputa el trámite. */
  const añoHoy = hoy.getFullYear();
  const mesHoy = hoy.getMonth() + 1;
  if (anio > añoHoy || (anio === añoHoy && mes > mesHoy)) {
    return {
      ok: false,
      motivo: `El número dice ${String(mes).padStart(2, '0')}/${anio}, que todavía no ha llegado. Revise el año y el mes en el libro.`,
    };
  }
  /* Y uno demasiado viejo: el libro de este trámite es el corriente. Cinco años
     es holgado a propósito — un radicado antiguo legítimo existe, y esto solo
     pretende cazar el dedazo evidente (2016 por 2026). */
  if (anio < añoHoy - 5) {
    return {
      ok: false,
      motivo: `El número dice ${anio}, más de cinco años atrás. Si es correcto, regístrelo por el camino de expedientes históricos.`,
    };
  }

  const canonico = `1-${CODIGO_OFICINA_RADICADORA}-${anio}${String(mes).padStart(2, '0')}-${String(consecutivo).padStart(8, '0')}`;

  return {
    ok: true,
    canonico,
    transcrito,
    seNormalizo: canonico !== transcrito,
    anio,
    mes,
    consecutivo,
  };
}

/** ¿Ya está en forma canónica? Útil para pruebas y para no re-normalizar lo emitido. */
export function esNumeroCanonico(valor: string): boolean {
  return CANONICO_RE.test(valor);
}
