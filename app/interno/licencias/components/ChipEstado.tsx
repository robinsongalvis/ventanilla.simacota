import type { EstadoLicenciaUI } from '../tipos';
import { ESTILOS_CHIP_ESTADO } from '../estilos-chip-estado';

/**
 * Pill de estado del semáforo de Licencias (dot 6px + etiqueta 11 SemiBold).
 *
 * REGLA (spec Pantalla 01/02): HISTÓRICO (origen RECONSTRUIDO) jamás entra
 * al semáforo ni a las alertas — este componente solo PINTA el estado que
 * ya viene decidido por `fixtures.ts`; no reinterpreta ni recalcula nada.
 */
export function ChipEstado({ estado }: { estado: EstadoLicenciaUI }) {
  const t = ESTILOS_CHIP_ESTADO[estado];
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
