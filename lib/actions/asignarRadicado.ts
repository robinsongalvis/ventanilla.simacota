import type { TenantId }      from '@/src/types/radicado';
import type { RolInterno }    from '@/lib/hooks/useAuth';

/* ── Tipos públicos ─────────────────────────────────────────── */

export interface ActorAsignacion {
  uid:    string;
  nombre: string;
  rol?:   RolInterno;
}

/**
 * MIPG-2 — Snapshot del responsable funcional al momento de asignación.
 * Inmutable: si el usuario cambia de nombre/cargo/rol, el radicado histórico
 * conserva los datos originales.
 */
export interface ResponsableFuncionario {
  uid:    string;
  nombre: string;
  email:  string;
  rol:    RolInterno;
  cargo?: string;
}

export interface ResultadoAsignacion {
  asignados: number;
  fallidos:  number;
}

/* ══════════════════════════════════════════════════════════════
   ASIGNACIÓN INDIVIDUAL — con snapshot MIPG-2
══════════════════════════════════════════════════════════════ */

export async function asignarRadicado(
  radicadoId:    string,
  tenantDestino: TenantId,
  actor:         ActorAsignacion,
  /** Snapshot del responsable funcional. Si es null no se asigna responsable. */
  responsable?:  ResponsableFuncionario | null,
  /** Tenant de origen (para trazabilidad) */
  tenantOrigen?: TenantId,
): Promise<void> {
  void actor;
  void tenantOrigen;
  const response = await fetch(`/api/radicados/${encodeURIComponent(radicadoId)}/asignar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tenantDestino, responsable: responsable ?? null }),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(data?.error ?? 'Error al asignar el radicado.');
  }
}

/* ══════════════════════════════════════════════════════════════
   ASIGNACIÓN MASIVA — writeBatch en bloques de 400
   No incluye snapshot de responsable individual (se asigna después
   por el funcionario o jefe de la dependencia destino).
══════════════════════════════════════════════════════════════ */

export async function asignarMasivo(
  radicadoIds:   string[],
  tenantDestino: TenantId,
  actor:         ActorAsignacion,
  onProgress?:   (asignados: number, total: number) => void,
): Promise<ResultadoAsignacion> {
  let asignados = 0;
  let fallidos  = 0;

  for (const id of radicadoIds) {
    try {
      await asignarRadicado(id, tenantDestino, actor);
      asignados += 1;
    } catch {
      fallidos += 1;
    }
    onProgress?.(asignados, radicadoIds.length);
  }

  return { asignados, fallidos };
}
