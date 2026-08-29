import { MODALIDADES_CONSTRUCCION } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { exigeModalidadConstruccion } from '@/lib/motor-expedientes/modalidad-construccion';

/* ══════════════════════════════════════════════════════════════
   Modalidades de construcción (art. 2.2.6.1.1.7) — hermano de
   `SelectorSubtiposNormativos`, mismo patrón de presentación PURA: el estado
   vive en el formulario que lo usa, este componente no llama al servidor.

   APARECE SOLO CUANDO LA FIGURA LA EXIGE. La condición no se escribe aquí a
   mano («si incluye CONSTRUCCION»): se pregunta a `exigeModalidadConstruccion`,
   la misma función que valida en el servidor. Si mañana otra figura gana un eje
   de modalidad, pantalla y servidor cambian juntos o no cambia ninguno.

   A quien pide una subdivisión NO se le pregunta: sus tres modalidades —rural,
   urbana y reloteo— ya están modeladas como figuras distintas en el catálogo,
   así que la pregunta ya se hizo arriba.

   MULTISELECCIÓN a propósito: el parágrafo 1 del mismo artículo permite
   combinar varias modalidades en una sola licencia (ampliación + demolición
   parcial, p. ej.). Un radio button obligaría a perder una.
══════════════════════════════════════════════════════════════ */

export interface SelectorModalidadesConstruccionProps {
  /** Figuras ya elegidas: deciden si esta pregunta procede. */
  subtipos: string[];
  seleccionadas: string[];
  onAlternar: (codigo: string) => void;
  error?: string | null;
}

export function SelectorModalidadesConstruccion({
  subtipos,
  seleccionadas,
  onAlternar,
  error,
}: SelectorModalidadesConstruccionProps) {
  if (!exigeModalidadConstruccion(subtipos)) return null;

  return (
    <fieldset>
      <legend className="mb-1 block text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
        Modalidad de la construcción — selecciona al menos una
      </legend>
      <p className="text-[11px] mb-1.5" style={{ color: '#94A3B8' }}>
        Puede marcar varias si la solicitud las combina (art. 2.2.6.1.1.7, par. 1).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
        {MODALIDADES_CONSTRUCCION.map((m) => (
          <label key={m.codigo} className="flex items-start gap-2 text-sm" style={{ color: '#1F2933' }}>
            <input
              type="checkbox"
              checked={seleccionadas.includes(m.codigo)}
              onChange={() => onAlternar(m.codigo)}
              className="mt-0.5 h-4 w-4 rounded border-[#D9E2D9] accent-[#14532D] focus-visible:outline-none focus-visible:ring-2"
            />
            <span>
              {m.nombre}{' '}
              <span className="font-mono text-[11px]" style={{ color: '#94A3B8' }}>
                (núm. {m.numeral})
              </span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs mt-2" style={{ color: 'var(--color-danger-text)' }}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
