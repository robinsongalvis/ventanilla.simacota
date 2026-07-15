import type { VentanillaRadicado } from '@/src/types/ventanilla';

/* ══════════════════════════════════════════════════════════════
   Enmascaramiento de identidad reservada — ADR-0006 (H2, variante A:
   enmascarar por defecto).

   Antes de esta utilidad, el criterio vivía duplicable y LOCAL a
   `VistaVentanilla.tsx:75` (`identidadProtegida`), y se aplicaba solo en
   el mostrador. Las demás vistas internas de gestión (panel de detalle,
   bandeja de asignación, filas de lista) y la exportación CSV/Excel
   emitían nombre y documento en texto plano sin ninguna guarda —
   hallazgo H2 (`docs/REGISTRO_RIESGOS.md`).

   Esta utilidad se aplica de forma TRANSVERSAL en todas esas superficies:
   la identidad reservada NUNCA se muestra en claro en vistas internas de
   gestión ni en la exportación. La revelación controlada por rol y
   necesidad de conocer (variante B) queda diferida como candidata
   post-Ola-1 — ver ADR-0006.
══════════════════════════════════════════════════════════════ */

export const MARCADOR_NOMBRE_PROTEGIDO = 'Identidad protegida';
export const MARCADOR_DOCUMENTO_PROTEGIDO = 'Documento protegido';

/** Subconjunto de campos que determinan la reserva — evita acoplar la
 *  utilidad a más de `VentanillaRadicado` de lo necesario. */
export type RadicadoConReserva = Pick<
  VentanillaRadicado,
  'esAnonimo' | 'identidadReservada' | 'tipoPresentacion'
>;

/**
 * Criterio único de reserva de identidad. Reutiliza el mismo criterio ya
 * aplicado en `lib/seguridad/consulta-publica-radicado.ts` y
 * `lib/reportes-mipg/sanitizar.ts`: anónimo, marcado explícitamente como
 * reservado, o `tipoPresentacion` lo declara.
 */
export function identidadProtegida(r: RadicadoConReserva): boolean {
  return (
    r.esAnonimo === true
    || r.identidadReservada === true
    || r.tipoPresentacion === 'ANONIMA'
    || r.tipoPresentacion === 'RESERVADA'
  );
}

/** Nombre del solicitante listo para mostrar: el real, o el marcador
 *  protegido cuando la identidad está reservada. */
export function nombreSolicitanteVisible(r: RadicadoConReserva, nombreCompleto: string): string {
  return identidadProtegida(r) ? MARCADOR_NOMBRE_PROTEGIDO : nombreCompleto;
}

/** Documento completo ("CC 1234567") listo para mostrar, o el marcador
 *  protegido cuando la identidad está reservada. */
export function documentoSolicitanteVisible(
  r: RadicadoConReserva,
  tipoDocumento: string,
  numeroDocumento: string,
): string {
  return identidadProtegida(r) ? MARCADOR_DOCUMENTO_PROTEGIDO : `${tipoDocumento} ${numeroDocumento}`;
}

/** Solo el número de documento (columnas de exportación que no incluyen
 *  el tipo por separado), o el marcador protegido. */
export function numeroDocumentoVisible(r: RadicadoConReserva, numeroDocumento: string): string {
  return identidadProtegida(r) ? MARCADOR_DOCUMENTO_PROTEGIDO : numeroDocumento;
}
