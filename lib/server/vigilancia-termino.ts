/**
 * lib/server/vigilancia-termino.ts
 *
 * El vigía del término de licencias RECORDABA nada: clasificaba los
 * expedientes, devolvía el recuento en la respuesta HTTP y se evaporaba. Nadie
 * recibía la alerta y nadie podía saber, al día siguiente, qué había cambiado.
 *
 * Este módulo es la memoria del vigía. PURO: sin Firestore y sin reloj propio.
 *
 * ── POR QUÉ TRANSICIONES Y NO LA LISTA ENTERA ─────────────────────────────
 *
 * El cron de vencimientos de PQRSD reenvía su alerta en CADA corrida mientras
 * el radicado siga dentro del umbral. Un correo diario con los mismos seis
 * vencidos se convierte en ruido filtrado en una semana — y entonces la alarma
 * deja de funcionar exactamente cuando hace falta. Aquí se avisa de lo que
 * CAMBIÓ; la lista completa se manda una vez por semana, un día fijo, para que
 * su AUSENCIA también informe.
 *
 * ── LA ESCALERA, Y LO QUE NO ESTÁ EN ELLA ─────────────────────────────────
 *
 * AVISO < CRITICO < VENCIDO es una escalera de gravedad: se puede empeorar o
 * aliviar. `ESPERA_EXCESIVA` NO está en esa escalera y no se le asigna un
 * peldaño falso: describe otra cosa —un expediente que lleva demasiado tiempo
 * sin que el plazo siquiera empiece a correr— y compararla con «vencido» sería
 * inventar un orden que la norma no da. Por eso las transiciones hacia y desde
 * ella se reportan como entrada y salida, nunca como agravamiento.
 *
 * Es, además, la categoría que Planeación puede resolver EL MISMO DÍA: son
 * solicitudes presentadas que nunca llegaron a radicarse.
 *
 * ── LA TRAMPA DEL TECHO DE LECTURA ────────────────────────────────────────
 *
 * El cron lee `expedientes` con `limit(1000)`. Si algún día la colección lo
 * supera, los que no se leyeron aparecerían como AUSENTES — y ausente se
 * interpretaría como «ya no está en alerta», que es exactamente al revés.
 * `calcularTransiciones` recibe por eso `lecturaCompleta` y, cuando es falsa,
 * SE NIEGA a declarar salidas. Un vigía que no leyó todo no puede afirmar que
 * algo dejó de estar.
 */

/** Los cuatro niveles que el vigía sabe nombrar. */
export type NivelVigilancia = 'AVISO' | 'CRITICO' | 'VENCIDO' | 'ESPERA_EXCESIVA';

/**
 * Escalera de gravedad. `ESPERA_EXCESIVA` está DELIBERADAMENTE fuera: no es
 * más ni menos grave que un vencimiento, es otro eje.
 */
const PELDANO: Partial<Record<NivelVigilancia, number>> = {
  AVISO: 1,
  CRITICO: 2,
  VENCIDO: 3,
};

/** Estado vigilado de UN expediente, tal como se persiste. */
export interface EstadoVigilado {
  expedienteId: string;
  numeroExpediente: string | null;
  nivel: NivelVigilancia;
}

export interface Transicion {
  expedienteId: string;
  numeroExpediente: string | null;
  anterior: NivelVigilancia | null;
  actual: NivelVigilancia | null;
}

export interface Transiciones {
  /** No estaba vigilado y ahora sí. */
  entraron: Transicion[];
  /** Subió de peldaño dentro de la escalera (AVISO→CRITICO→VENCIDO). */
  agravaron: Transicion[];
  /** Bajó de peldaño, o cambió a un nivel de otro eje. */
  cambiaron: Transicion[];
  /** Estaba vigilado y ya no. Vacío si la lectura fue incompleta. */
  salieron: Transicion[];
  /**
   * `true` cuando NO se pudieron calcular las salidas por lectura truncada.
   * Quien informe tiene que decirlo: callarlo convierte «no pude mirar» en
   * «no había nada».
   */
  salidasNoCalculables: boolean;
}

/**
 * Compara el estado vigilado anterior con el actual.
 *
 * @param lecturaCompleta `false` si la consulta tocó su techo. Con lectura
 *   incompleta NO se declaran salidas: la ausencia de un expediente puede ser
 *   que no se leyó, no que se resolvió.
 */
export function calcularTransiciones(
  anterior: readonly EstadoVigilado[],
  actual: readonly EstadoVigilado[],
  lecturaCompleta: boolean,
): Transiciones {
  const antes = new Map(anterior.map((e) => [e.expedienteId, e]));
  const ahora = new Map(actual.map((e) => [e.expedienteId, e]));

  const entraron: Transicion[] = [];
  const agravaron: Transicion[] = [];
  const cambiaron: Transicion[] = [];
  const salieron: Transicion[] = [];

  for (const [id, act] of ahora) {
    const ant = antes.get(id);
    const base = { expedienteId: id, numeroExpediente: act.numeroExpediente };

    if (!ant) {
      entraron.push({ ...base, anterior: null, actual: act.nivel });
      continue;
    }
    if (ant.nivel === act.nivel) continue;

    const t = { ...base, anterior: ant.nivel, actual: act.nivel };
    const pAnt = PELDANO[ant.nivel];
    const pAct = PELDANO[act.nivel];
    /* Solo es «agravamiento» si AMBOS niveles están en la escalera. Si uno de
       los dos es de otro eje, es un cambio y se nombra como tal. */
    if (pAnt !== undefined && pAct !== undefined && pAct > pAnt) agravaron.push(t);
    else cambiaron.push(t);
  }

  if (lecturaCompleta) {
    for (const [id, ant] of antes) {
      if (ahora.has(id)) continue;
      salieron.push({
        expedienteId: id,
        numeroExpediente: ant.numeroExpediente,
        anterior: ant.nivel,
        actual: null,
      });
    }
  }

  return { entraron, agravaron, cambiaron, salieron, salidasNoCalculables: !lecturaCompleta };
}

/** ¿Hay algo que contarle a alguien? */
export function hayNovedades(t: Transiciones): boolean {
  return (
    t.entraron.length > 0 ||
    t.agravaron.length > 0 ||
    t.cambiaron.length > 0 ||
    t.salieron.length > 0
  );
}

/**
 * El resumen de UNA corrida, tal como se persiste para el tablero y para el
 * resumen semanal.
 *
 * `conjuntoVacio` se guarda EXPLÍCITO en vez de deducirse de los ceros: el
 * propietario pidió que el resumen semanal diga «no hay nada vigilado» cuando
 * toque, para que Planeación aprenda a esperar ese correo y su ausencia
 * también informe. Un cero que nadie declaró es indistinguible de un cron que
 * no corrió.
 */
export interface ResumenCorrida {
  corridaIso: string;
  revisados: number;
  lecturaCompleta: boolean;
  conjuntoVacio: boolean;
  porNivel: Record<NivelVigilancia, number>;
  transiciones: { entraron: number; agravaron: number; cambiaron: number; salieron: number };
  salidasNoCalculables: boolean;
}

export function componerResumen(
  corridaIso: string,
  revisados: number,
  actual: readonly EstadoVigilado[],
  transiciones: Transiciones,
  lecturaCompleta: boolean,
): ResumenCorrida {
  const porNivel: Record<NivelVigilancia, number> = {
    AVISO: 0,
    CRITICO: 0,
    VENCIDO: 0,
    ESPERA_EXCESIVA: 0,
  };
  for (const e of actual) porNivel[e.nivel] += 1;

  return {
    corridaIso,
    revisados,
    lecturaCompleta,
    /* Vacío = nada VIGILADO, no «cero expedientes». Hoy es el caso normal: con
       el candado R10 cerrado todo expediente nace `esPrueba`, y el vigía los
       excluye. El conjunto está vacío POR CONSTRUCCIÓN, y decirlo evita que un
       silencio se lea como salud. */
    conjuntoVacio: actual.length === 0,
    porNivel,
    transiciones: {
      entraron: transiciones.entraron.length,
      agravaron: transiciones.agravaron.length,
      cambiaron: transiciones.cambiaron.length,
      salieron: transiciones.salieron.length,
    },
    salidasNoCalculables: transiciones.salidasNoCalculables,
  };
}
