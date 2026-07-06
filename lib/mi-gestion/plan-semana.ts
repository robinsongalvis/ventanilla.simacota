import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  esActivo,
  fechaYmdColombia,
} from '@/lib/kpis-operativos/calcular-kpis-operativos';
import { lunesDe, sumarDiasYmd } from '@/lib/mi-gestion/calcular-mi-gestion';

/**
 * Sprint Semana + badge — "¿cómo viene mi semana?".
 *
 * La cola de pendientes dice qué está urgente YA; este plan responde la
 * pregunta del lunes en la mañana: cuántos casos me vencen cada día de
 * esta semana. Siete celdas (lunes a domingo Colombia), lo ya vencido
 * aparte (es deuda, no agenda) y lo que cae después de la semana como
 * un solo número tranquilizador.
 *
 * Función pura: sin React, sin Firestore. `ahora` inyectable.
 */

export interface DiaPlanSemana {
  ymd:      string;
  /** "Lun 6", "Mar 7"… */
  etiqueta: string;
  esHoy:    boolean;
  vencen:   number;
}

export interface PlanSemana {
  /** Lunes a domingo de la semana actual. */
  dias:        DiaPlanSemana[];
  /** Activos ya vencidos (antes de hoy) — deuda, no agenda. */
  vencidos:    number;
  /** Activos que vencen después del domingo. */
  despues:     number;
  /** Suma de lo que vence de hoy al domingo. */
  totalSemana: number;
}

const NOMBRES_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function planDeSemana(
  radicados: VentanillaRadicado[],
  uid: string,
  ahora: Date = new Date(),
): PlanSemana {
  const hoy = fechaYmdColombia(ahora);
  const lunes = lunesDe(hoy);
  const domingo = sumarDiasYmd(lunes, 6);

  const porDia = new Map<string, number>();
  let vencidos = 0;
  let despues = 0;

  for (const r of radicados) {
    if (r.clasificacion?.funcionarioResponsableUid !== uid) continue;
    if (!esActivo(r)) continue;
    if (!r.termino?.fechaVencimiento) continue;

    const vence = fechaYmdColombia(r.termino.fechaVencimiento);
    if (!vence) continue;

    // YMD compara bien lexicográficamente.
    if (vence < hoy) vencidos += 1;
    else if (vence > domingo) despues += 1;
    else porDia.set(vence, (porDia.get(vence) ?? 0) + 1);
  }

  const dias: DiaPlanSemana[] = NOMBRES_DIA.map((nombre, i) => {
    const ymd = sumarDiasYmd(lunes, i);
    return {
      ymd,
      etiqueta: `${nombre} ${Number(ymd.slice(8, 10))}`,
      esHoy:    ymd === hoy,
      vencen:   porDia.get(ymd) ?? 0,
    };
  });

  return {
    dias,
    vencidos,
    despues,
    totalSemana: dias.reduce((acc, d) => acc + d.vencen, 0),
  };
}
