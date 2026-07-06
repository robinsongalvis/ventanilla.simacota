import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { esActivo } from '@/lib/kpis-operativos/calcular-kpis-operativos';

/**
 * Sprint Cola personal — la lista COMPLETA de trabajo del funcionario.
 *
 * "Atiende primero" (calcular-mi-gestion) muestra solo lo urgente; esta
 * es la cola entera: todo radicado activo asignado al uid, ordenado por
 * urgencia — vencidos arriba, luego por días restantes, y al final los
 * que no tienen término (los más viejos primero, que no se entierren).
 *
 * La fila no expone datos del solicitante: identidades reservadas y
 * anónimos quedan protegidos por diseño — id, estado, asunto y término
 * bastan para decidir qué atender.
 *
 * Función pura: sin React, sin Firestore. `ahora` inyectable.
 */

export type NivelPendiente = 'ROJO' | 'AMBAR' | 'VERDE' | 'SIN_TERMINO';

export interface PendientePersonal {
  radicadoId:    string;
  estado:        string;
  asunto:        string;
  /** Días hábiles restantes; null cuando el radicado no tiene término. */
  diasRestantes: number | null;
  /** "venció hace 3 d" · "vence hoy" · "vence en 5 días" · "sin término" */
  etiqueta:      string;
  nivel:         NivelPendiente;
}

function etiquetaTermino(d: number): { etiqueta: string; nivel: NivelPendiente } {
  if (d < 0)   return { etiqueta: `venció hace ${Math.abs(d)} d`, nivel: 'ROJO' };
  if (d === 0) return { etiqueta: 'vence hoy', nivel: 'ROJO' };
  if (d === 1) return { etiqueta: 'vence mañana', nivel: 'ROJO' };
  if (d === 2) return { etiqueta: 'vence en 2 días', nivel: 'AMBAR' };
  return { etiqueta: `vence en ${d} días`, nivel: 'VERDE' };
}

export function misPendientes(
  radicados: VentanillaRadicado[],
  uid: string,
  ahora: Date = new Date(),
): PendientePersonal[] {
  const conTermino: (PendientePersonal & { orden: number })[] = [];
  const sinTermino: (PendientePersonal & { orden: number })[] = [];

  for (const r of radicados) {
    if (r.clasificacion?.funcionarioResponsableUid !== uid) continue;
    if (!esActivo(r)) continue;

    const base = {
      radicadoId: r.radicadoId,
      estado:     r.estadoActual,
      asunto:     r.detalle?.asunto ?? '',
    };

    if (r.termino?.fechaVencimiento) {
      const d = diasRestantesHabiles(r.termino.fechaVencimiento, ahora);
      conTermino.push({ ...base, diasRestantes: d, ...etiquetaTermino(d), orden: d });
    } else {
      const radicadoEn = Date.parse(r.control?.fechaRadicado ?? '');
      sinTermino.push({
        ...base,
        diasRestantes: null,
        etiqueta: 'sin término',
        nivel: 'SIN_TERMINO',
        orden: Number.isNaN(radicadoEn) ? Number.MAX_SAFE_INTEGER : radicadoEn,
      });
    }
  }

  conTermino.sort((a, b) => a.orden - b.orden);
  sinTermino.sort((a, b) => a.orden - b.orden);

  return [...conTermino, ...sinTermino].map(({ orden: _orden, ...p }) => p);
}
