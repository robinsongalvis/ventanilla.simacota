import { useMemo } from 'react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { DIRECTORIO_TENANTS, NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);
const ESTADOS_EN_PROCESO = new Set<string>(['ASIGNADO', 'EN_REVISION', 'EN_PROCESO']);

export type AlertaTono = 'rose' | 'amber' | 'indigo' | 'slate';

export interface CargaDependencia {
  tenantId: TenantId;
  nombre: string;
  total: number;
  pendientes: number;
  enProceso: number;
  porVencer: number;
  vencidos: number;
  resueltos: number;
  alertaTono: AlertaTono;
  cargaRelativa: number;
}

interface Contadores {
  total: number;
  pendientes: number;
  enProceso: number;
  porVencer: number;
  vencidos: number;
  resueltos: number;
}

export function useCargaDependencias(radicados: VentanillaRadicado[]): CargaDependencia[] {
  return useMemo(() => {
    const tenantIds = Object.keys(DIRECTORIO_TENANTS) as TenantId[];

    const map = new Map<TenantId, Contadores>();
    for (const id of tenantIds) {
      map.set(id, { total: 0, pendientes: 0, enProceso: 0, porVencer: 0, vencidos: 0, resueltos: 0 });
    }

    for (const r of radicados) {
      const c = map.get(r.clasificacion.oficinaDestino);
      if (!c) continue;

      c.total++;
      const activo = !ESTADOS_RESUELTOS.has(r.estadoActual);

      if (r.estadoActual === 'PENDIENTE') {
        c.pendientes++;
      } else if (ESTADOS_EN_PROCESO.has(r.estadoActual)) {
        c.enProceso++;
      } else if (ESTADOS_RESUELTOS.has(r.estadoActual)) {
        c.resueltos++;
      }

      if (activo) {
        const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
        if (dias < 0) c.vencidos++;
        else if (dias <= 2) c.porVencer++;
      }
    }

    const maxTotal = Math.max(1, ...Array.from(map.values()).map((c) => c.total));

    return tenantIds
      .map((id) => {
        const c = map.get(id)!;
        const alertaTono: AlertaTono =
          c.vencidos > 0   ? 'rose'  :
          c.porVencer > 0  ? 'amber' :
          c.total > 0      ? 'indigo': 'slate';

        return {
          tenantId: id,
          nombre:   NOMBRES_TENANT[id],
          ...c,
          alertaTono,
          cargaRelativa: Math.round((c.total / maxTotal) * 100),
        };
      })
      .sort((a, b) => {
        if (b.vencidos  !== a.vencidos)  return b.vencidos  - a.vencidos;
        if (b.porVencer !== a.porVencer) return b.porVencer - a.porVencer;
        return b.total - a.total;
      });
  }, [radicados]);
}
