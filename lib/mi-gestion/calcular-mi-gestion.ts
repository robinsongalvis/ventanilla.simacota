import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import {
  esActivo,
  fechaResolucion,
  fechaYmdColombia,
} from '@/lib/kpis-operativos/calcular-kpis-operativos';

/**
 * Sprint Mi gestión — el desempeño personal del funcionario, calculado
 * sobre los radicados que ya están en memoria. Autocontrol, no
 * vigilancia: cada quien ve solo lo suyo.
 *
 * El semáforo (fórmula aprobada) prioriza el PRESENTE sobre el
 * histórico: puedes tener 95% de cumplimiento, pero si algo venció o
 * vence ya, la barra te lo dice.
 *
 *  - ROJO:  vencidos activos > 0, o cumplimiento < 60%.
 *  - ÁMBAR: por vencer (≤ 2 días) > 0, o cumplimiento entre 60% y 85%.
 *  - VERDE: sin vencimientos encima y cumplimiento ≥ 85% (o sin dato).
 *
 * Función pura: sin React, sin Firestore. `ahora` inyectable.
 */

export type SemaforoGestion = 'VERDE' | 'AMBAR' | 'ROJO';

export interface AtencionPrioritaria {
  radicadoId:    string;
  diasRestantes: number;
  /** "venció hace 3 d" · "vence hoy" · "vence mañana" · "vence en 2 días" */
  etiqueta:      string;
  nivel:         'ROJO' | 'AMBAR';
}

export interface SemanaTendencia {
  /** "S-3", "S-2", "S-1", "Esta" */
  etiqueta:  string;
  resueltos: number;
}

export interface MiGestion {
  asignados:          number;
  respondidos:        number;
  pendientes:         number;
  /** Días calendario promedio de resolución, 1 decimal; null sin resueltos fechables. */
  tiempoPromedioDias: number | null;
  /** % de resueltos dentro del término; null sin datos de cumplimiento. */
  pctCumplimiento:    number | null;
  porVencer:          number;
  vencidos:           number;
  semaforo:           SemaforoGestion;
  /** Lo más urgente primero; máximo 5. */
  atencionPrioritaria: AtencionPrioritaria[];
  /** 4 semanas calendario Colombia (lunes a domingo), la actual de última. */
  tendencia:          SemanaTendencia[];
}

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);
const DIA_MS = 24 * 60 * 60 * 1000;

function etiquetaVencimiento(d: number): { etiqueta: string; nivel: 'ROJO' | 'AMBAR' } {
  if (d < 0)   return { etiqueta: `venció hace ${Math.abs(d)} d`, nivel: 'ROJO' };
  if (d === 0) return { etiqueta: 'vence hoy', nivel: 'ROJO' };
  if (d === 1) return { etiqueta: 'vence mañana', nivel: 'ROJO' };
  return { etiqueta: `vence en ${d} días`, nivel: 'AMBAR' };
}

/** Lunes (YMD Colombia) de la semana que contiene `ymd`. */
export function lunesDe(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function sumarDiasYmd(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function calcularMiGestion(
  radicados: VentanillaRadicado[],
  uid: string,
  ahora: Date = new Date(),
): MiGestion {
  const mios = radicados.filter(
    (r) => r.clasificacion?.funcionarioResponsableUid === uid,
  );

  const resueltos = mios.filter((r) => ESTADOS_RESUELTOS.has(r.estadoActual));
  const activos = mios.filter((r) => esActivo(r));

  let porVencer = 0;
  let vencidos = 0;
  const urgentes: AtencionPrioritaria[] = [];

  for (const r of activos) {
    if (!r.termino?.fechaVencimiento) continue;
    const d = diasRestantesHabiles(r.termino.fechaVencimiento, ahora);
    if (d < 0) vencidos += 1;
    else if (d <= 2) porVencer += 1;
    if (d <= 2) {
      urgentes.push({
        radicadoId:    r.radicadoId,
        diasRestantes: d,
        ...etiquetaVencimiento(d),
      });
    }
  }
  urgentes.sort((a, b) => a.diasRestantes - b.diasRestantes);

  // Cumplimiento: solo los resueltos que traen el dato MIPG.
  const conDato = resueltos.filter(
    (r) => r.cumplioTermino !== undefined && r.cumplioTermino !== null,
  );
  const aTiempo = conDato.filter((r) => r.cumplioTermino === true).length;
  const pctCumplimiento = conDato.length > 0
    ? Math.round((aTiempo / conDato.length) * 100)
    : null;

  // Tiempo promedio de respuesta (días calendario, 1 decimal).
  const duraciones = resueltos.flatMap((r) => {
    const fin = fechaResolucion(r);
    const inicio = r.control?.fechaRadicado;
    if (!fin || !inicio) return [];
    const ms = new Date(fin).getTime() - new Date(inicio).getTime();
    return Number.isNaN(ms) || ms < 0 ? [] : [ms / DIA_MS];
  });
  const tiempoPromedioDias = duraciones.length > 0
    ? Math.round((duraciones.reduce((a, b) => a + b, 0) / duraciones.length) * 10) / 10
    : null;

  // Semáforo: el presente manda sobre el histórico.
  let semaforo: SemaforoGestion = 'VERDE';
  if (vencidos > 0 || (pctCumplimiento !== null && pctCumplimiento < 60)) {
    semaforo = 'ROJO';
  } else if (porVencer > 0 || (pctCumplimiento !== null && pctCumplimiento < 85)) {
    semaforo = 'AMBAR';
  }

  // Tendencia: 4 semanas calendario colombiano, la actual de última.
  const lunesActual = lunesDe(fechaYmdColombia(ahora));
  const tendencia: SemanaTendencia[] = [3, 2, 1, 0].map((atras) => {
    const desde = sumarDiasYmd(lunesActual, -7 * atras);
    const hasta = sumarDiasYmd(desde, 6);
    const cuenta = resueltos.filter((r) => {
      const fin = fechaResolucion(r);
      if (!fin) return false;
      const ymd = fechaYmdColombia(fin);
      return ymd >= desde && ymd <= hasta;
    }).length;
    return { etiqueta: atras === 0 ? 'Esta' : `S-${atras}`, resueltos: cuenta };
  });

  return {
    asignados:   mios.length,
    respondidos: resueltos.length,
    pendientes:  activos.length,
    tiempoPromedioDias,
    pctCumplimiento,
    porVencer,
    vencidos,
    semaforo,
    atencionPrioritaria: urgentes.slice(0, 5),
    tendencia,
  };
}
