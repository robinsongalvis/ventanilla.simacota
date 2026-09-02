import { identidadProtegida, type RadicadoConReserva } from '@/lib/seguridad/identidad-protegida';

/* ══════════════════════════════════════════════════════════════
   Predicado de filtro rápido de cliente — ADR-0012 (R9, Ola 2).

   El servidor ya excluye la identidad reservada de la búsqueda
   (`lib/busqueda/filtros-radicado.ts`), pero los filtros rápidos de
   cliente (mostrador de Ventanilla y buscador del Tablero) matcheaban
   `solicitante.nombreCompleto` / `numeroDocumento` sin ninguna guarda:
   teclear el nombre o documento de un solicitante con identidad
   reservada lo hacía aparecer en los resultados, permitiendo inferir
   la existencia del radicado — Ley 1581/2012 art. 4 f/g (agravado si
   es denunciante, Ley 1474/2011).

   Esta función es la ÚNICA fuente de verdad del predicado y reutiliza
   el criterio de reserva ya existente `identidadProtegida` (ADR-0006,
   H2) — Principio 3, no duplicar. Se aplica en:
   - `app/interno/dashboard/page.tsx` (buscador del Tablero)
   - `app/interno/dashboard/components/ventanilla/VistaVentanilla.tsx`
     (mostrador de Ventanilla)
══════════════════════════════════════════════════════════════ */

/** Subconjunto de campos que necesita el predicado — evita acoplarlo
 *  a más de `VentanillaRadicado` de lo necesario. */
export interface RadicadoParaFiltroRapido extends RadicadoConReserva {
  radicadoId: string;
  solicitante: {
    nombreCompleto: string;
    numeroDocumento: string;
  };
  /** Espejo del expediente vinculado — el `68745-…` (ADR-0041). */
  vinculoExpediente?: { numeroExpediente?: string | null } | null;
}

/**
 * Decide si un radicado coincide con un término de búsqueda tecleado en
 * un filtro rápido de cliente, por `radicadoId`, nombre o documento del
 * solicitante.
 *
 * Si la identidad del radicado está reservada (`identidadProtegida`), NO
 * coincide por nombre ni documento — solo por `radicadoId` (que ya conoce
 * quien lo teclea, no se infiere nada nuevo). Si no está reservada,
 * coincide normalmente por cualquiera de los tres campos.
 *
 * @param qNormalizado término de búsqueda ya en minúsculas y sin espacios
 *   sobrantes (`.toLowerCase().trim()`) — esta función no normaliza.
 */
export function coincideIdentidadFiltroRapido(
  r: RadicadoParaFiltroRapido,
  qNormalizado: string,
): boolean {
  if (r.radicadoId.toLowerCase().includes(qNormalizado)) return true;
  /* Y el número del EXPEDIENTE vinculado (ADR-0041 §3.7): el ciudadano llega
     al mostrador leyendo el `68745-…` que le imprimimos en su constancia, y
     quien atiende tiene que encontrarlo con eso. Va aquí arriba, junto al
     radicado, porque es de la misma categoría —un número del trámite— y NO es
     dato de identidad: la guarda de abajo no le aplica, igual que no le aplica
     al radicado. */
  const numeroExpediente = r.vinculoExpediente?.numeroExpediente;
  if (numeroExpediente && numeroExpediente.toLowerCase().includes(qNormalizado)) return true;
  if (identidadProtegida(r)) return false;
  return (
    r.solicitante.nombreCompleto.toLowerCase().includes(qNormalizado)
    || r.solicitante.numeroDocumento.includes(qNormalizado)
  );
}
