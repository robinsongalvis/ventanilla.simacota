import type { TenantId } from '@/src/types/radicado';
import type { MedioEnvioSalida, SalidaOficial } from '@/src/types/salida';
import { fechaYmdColombia } from '@/lib/kpis-operativos/calcular-kpis-operativos';
import { rangoDePreset, type PresetReporte } from '@/lib/reportes/filtrar-por-preset';

/**
 * Fase B de salidas — la serie 2-SAL entra al reporte del período.
 *
 * Misma mecánica del reporte de entradas (Sprint 3C): cortes por día
 * calendario colombiano vía rangoDePreset, todo calculado en frontend
 * sobre las salidas ya en memoria. Así "¿qué llegó este mes?" y
 * "¿qué despachamos este mes?" usan exactamente los mismos cortes y
 * nunca se contradicen.
 *
 * Funciones puras: sin React, sin Firestore. `ahora` inyectable.
 */

/** Subconjunto del período (por fecha de despacho) y dependencia que despacha. */
export function filtrarSalidasPorPreset(
  salidas: SalidaOficial[],
  preset: PresetReporte,
  dependencia: TenantId | 'TODAS' = 'TODAS',
  ahora: Date = new Date(),
): SalidaOficial[] {
  const rango = rangoDePreset(preset, ahora);

  return salidas.filter((s) => {
    if (dependencia !== 'TODAS' && s.dependenciaOrigen !== dependencia) {
      return false;
    }
    if (!rango) return true;
    if (!s.fechaSalida) return false;
    const ymd = fechaYmdColombia(s.fechaSalida);
    // YMD compara bien lexicográficamente.
    return ymd >= rango.desde && ymd <= rango.hasta;
  });
}

export interface ResumenSalidas {
  total:      number;
  /** Salidas amarradas a un radicado de entrada. */
  respuestas: number;
  /** Correspondencia propia de la administración, sin amarre. */
  oficios:    number;
  /** Conteo por medio de envío, solo medios con al menos una salida. */
  porMedio:   { medio: MedioEnvioSalida; cantidad: number }[];
}

export function resumenSalidas(salidas: SalidaOficial[]): ResumenSalidas {
  const respuestas = salidas.filter((s) => s.tipoSalida === 'RESPUESTA').length;

  const conteo = new Map<MedioEnvioSalida, number>();
  for (const s of salidas) {
    conteo.set(s.medioEnvio, (conteo.get(s.medioEnvio) ?? 0) + 1);
  }

  return {
    total:      salidas.length,
    respuestas,
    oficios:    salidas.length - respuestas,
    porMedio:   [...conteo.entries()]
      .map(([medio, cantidad]) => ({ medio, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
  };
}
