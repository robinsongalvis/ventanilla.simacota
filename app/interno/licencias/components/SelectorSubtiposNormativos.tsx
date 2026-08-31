import { CATALOGO_FIGURAS_NORMATIVAS, type TipoFigura } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';

/* ══════════════════════════════════════════════════════════════
   Checklist de subtipos (figuras normativas, catálogo DF-4) — EXTRAÍDO de
   `RadicarSolicitudModal` (bloque "Integración UI y demo") para que
   `CrearDesdeRadicadoModal` (Bloque A·A4, handoff radicado⇄expediente) lo
   reutilice sin duplicar el mapa de grupos ni el catálogo (Principio 3,
   reutilización por defecto — el encargo de A·A4 lo pide explícitamente:
   "no dupliques el checklist de subtipos").

   Presentación PURA: el estado de selección vive en el formulario que lo
   usa (mismo patrón `checked` + `onChange` que tenía el modal original) —
   este componente no llama al servidor ni conoce el resto del formulario.

   SIN CÓDIGOS INTERNOS (31-ago-2026, decisión del propietario). Cada opción
   mostraba su `codigo` entre paréntesis —`(SUBDIVISION_RURAL)`, `(CONSTRUCCION)`—
   ocupando casi la mitad del renglón. Se quitaron porque NO le sirven a nadie
   de este lado del mostrador, y eso está verificado contra la fuente, no
   supuesto: el ingeniero de Planeación escribe `LSR`, `LSU`, `LC`, `LU`, `LR`,
   `PH` en su planilla, y existe una tabla —`EQUIVALENCIAS_MIGRACION_SEMILLA_
   LICENCIAS`, en el catálogo— cuyo único trabajo es traducir lo suyo a estos
   códigos. Son dos vocabularios distintos, y ni siquiera uno a uno: `LC y PH`
   se traduce en DOS códigos. Mostrar el nuestro no ayuda a casar con el
   expediente físico; solo estorba la lectura.

   El código sigue siendo la identidad del subtipo en los datos y en la API —
   solo deja de pintarse. `__tests__/subtipos-sin-codigos-internos.test.tsx`
   se pone rojo si vuelve.
══════════════════════════════════════════════════════════════ */

const TITULO_GRUPO: Record<TipoFigura, string> = {
  LICENCIA: 'Licencias',
  ACTO_RECONOCIMIENTO: 'Actos de reconocimiento',
  OTRA_ACTUACION: 'Otras actuaciones',
};

const GRUPOS: TipoFigura[] = ['LICENCIA', 'ACTO_RECONOCIMIENTO', 'OTRA_ACTUACION'];

export interface SelectorSubtiposNormativosProps {
  seleccionados: string[];
  onAlternar: (codigo: string) => void;
  /** Error de validación local ("selecciona al menos uno") — mostrado literal, `role="alert"`. */
  error?: string | null;
}

export function SelectorSubtiposNormativos({ seleccionados, onAlternar, error }: SelectorSubtiposNormativosProps) {
  const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-widest';
  const labelStyle = { color: '#667085' };

  return (
    <fieldset>
      <legend className={labelCls} style={labelStyle}>
        Subtipos (figuras normativas) — selecciona al menos uno
      </legend>
      <div className="flex flex-col gap-3 mt-1">
        {GRUPOS.map((grupo) => {
          const figuras = CATALOGO_FIGURAS_NORMATIVAS.filter((f) => f.tipoFigura === grupo);
          if (figuras.length === 0) return null;
          return (
            <div key={grupo}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>
                {TITULO_GRUPO[grupo]}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                {figuras.map((f) => (
                  <label key={f.codigo} className="flex items-start gap-2 text-sm" style={{ color: '#1F2933' }}>
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(f.codigo)}
                      onChange={() => onAlternar(f.codigo)}
                      className="mt-0.5 h-4 w-4 rounded border-[#D9E2D9] accent-[#14532D] focus-visible:outline-none focus-visible:ring-2"
                    />
                    <span>{f.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-xs mt-2" style={{ color: 'var(--color-danger-text)' }}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
