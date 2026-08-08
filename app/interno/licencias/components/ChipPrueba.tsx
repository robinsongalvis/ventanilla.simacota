/**
 * Badge "PRUEBA" — marca expedientes creados con `esPrueba: true`
 * (candado de emisión real cerrado, R10; ver `lib/server/
 * expedientes-licencias.ts`). Mismo lenguaje visual que `ChipEstado`/
 * `ChipEstadoJuridico` (dot + etiqueta), pero en ámbar de advertencia —
 * DELIBERADAMENTE distinto del azul que usa `HISTORICO`
 * (`estilos-chip-estado.ts`): "prueba" (dato de demo, real pero no
 * legalmente válido) y "histórico" (dato real migrado) son dos
 * advertencias de naturaleza distinta y no deben confundirse a simple
 * vista. Reutiliza el mismo trío ámbar ya usado para "advertencia" en el
 * resto del módulo (`POR_VENCER`, `CON_ACTA_DE_OBSERVACIONES`).
 */
export function ChipPrueba() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: '#FAEEDA', color: '#7A4F0A' }}
      title="Expediente de demostración — la emisión real está bloqueada hasta autorizar la siembra del consecutivo (R10)."
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#D97706' }} />
      Prueba
    </span>
  );
}
