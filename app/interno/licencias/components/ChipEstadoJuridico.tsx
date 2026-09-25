import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { ESTILOS_ESTADO_JURIDICO } from '../estilos-estado-juridico';

/**
 * Pill del ESTADO JURÍDICO real (los 9 hitos de `estados-licencia.ts`,
 * DF-5/ADR-0029) — hermano de `ChipEstado` (que pinta el semáforo
 * `EstadoLicenciaUI` de los fixtures/preview). Mismo lenguaje visual
 * (dot 6px + etiqueta 11 SemiBold) para que ambos chips se sientan del
 * mismo sistema, pero consume el mapa de `estilos-estado-juridico.ts` —
 * nunca se mezclan los dos dominios de estado en el mismo componente.
 */
export function ChipEstadoJuridico({ estado }: { estado: EstadoJuridicoLicencia }) {
  const t = ESTILOS_ESTADO_JURIDICO[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: t.fondo, color: t.texto }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: t.dot }}
      />
      {t.label}
    </span>
  );
}
