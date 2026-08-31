import { CATALOGO_FIGURAS_NORMATIVAS, type FiguraTramiteNormativa, type TipoFigura } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import './licencias-tema.css';

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

   REDISEÑO VISUAL (mockup de Figma aprobado por el propietario, 31-ago-2026).
   Presentación pura otra vez: mismos props, mismo dato que viaja (`codigo`),
   mismo nombre accesible por casilla — solo cambia el markup y el estilo.
     · Las 7 figuras de tipo LICENCIA van en una grilla de 2 columnas como
       tarjetas seleccionables; ESPACIO_PUBLICO ("Licencia de intervención y
       ocupación del espacio público") ocupa la fila completa — así lo fija
       el mockup, y coincide con que es la 7.ª de una grilla par (queda sola
       en su fila de todos modos).
     · ACTO_RECONOCIMIENTO y OTRA_ACTUACION tienen una sola figura cada uno:
       van lado a lado, cada uno con su propia etiqueta encima.
     · El aviso "selecciona al menos uno" en mayúsculas se retira del
       `<legend>` (ahora solo el título "Subtipos (figuras normativas)") y
       reaparece como chip visual aparte — el `<legend>` sigue siendo hijo
       DIRECTO de `<fieldset>` (así lo exige el HTML vivo para que el nombre
       accesible del grupo se calcule bien); el chip se posiciona con CSS,
       no anidado dentro del legend, para no inflarle el nombre accesible.
══════════════════════════════════════════════════════════════ */

const TITULO_GRUPO_SOLO: Partial<Record<TipoFigura, string>> = {
  ACTO_RECONOCIMIENTO: 'Actos de reconocimiento',
  OTRA_ACTUACION: 'Otras actuaciones',
};

/** Única figura que el mockup fija a ancho completo en la grilla de licencias. */
const CODIGO_ANCHO_COMPLETO = 'ESPACIO_PUBLICO';

export interface SelectorSubtiposNormativosProps {
  seleccionados: string[];
  onAlternar: (codigo: string) => void;
  /** Error de validación local ("selecciona al menos uno") — mostrado literal, `role="alert"`. */
  error?: string | null;
}

function TarjetaFigura({
  figura,
  seleccionado,
  onAlternar,
  anchoCompleto,
}: {
  figura: FiguraTramiteNormativa;
  seleccionado: boolean;
  onAlternar: (codigo: string) => void;
  anchoCompleto?: boolean;
}) {
  return (
    <label
      className={
        'flex items-start gap-2 cursor-pointer transition-colors '
        + 'hover:border-[var(--verde-institucional)] '
        + 'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 '
        + 'has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--verde-institucional)] '
        + (anchoCompleto ? 'col-span-2' : '')
      }
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radio-control)',
        border: seleccionado ? '1.5px solid var(--verde-institucional)' : '1px solid var(--borde)',
        background: seleccionado ? 'var(--superficie-tinte)' : 'var(--superficie)',
      }}
    >
      <input
        type="checkbox"
        checked={seleccionado}
        onChange={() => onAlternar(figura.codigo)}
        className="mt-0.5 shrink-0 focus-visible:outline-none"
        style={{ width: '20px', height: '20px', borderRadius: '6px', accentColor: 'var(--verde-institucional)' }}
      />
      <span
        className="text-[13.5px]"
        style={{ color: 'var(--texto)', fontWeight: seleccionado ? 500 : 400 }}
      >
        {figura.nombre}
      </span>
    </label>
  );
}

export function SelectorSubtiposNormativos({ seleccionados, onAlternar, error }: SelectorSubtiposNormativosProps) {
  const figurasLicencia = CATALOGO_FIGURAS_NORMATIVAS.filter((f) => f.tipoFigura === 'LICENCIA');
  const gruposSolos: TipoFigura[] = ['ACTO_RECONOCIMIENTO', 'OTRA_ACTUACION'];

  return (
    <fieldset className="relative tema-licencias">
      <legend className="text-[15px] font-semibold pr-36" style={{ color: 'var(--texto)' }}>
        Subtipos (figuras normativas)
      </legend>
      <span
        className="absolute top-0 right-0 text-[11px] font-medium px-2.5 py-1 rounded-full"
        style={{ background: 'var(--superficie-tinte)', color: 'var(--verde-institucional)' }}
      >
        Selecciona al menos una
      </span>

      <div className="grid grid-cols-2 gap-3 items-stretch mt-2">
        {figurasLicencia.map((f) => (
          <TarjetaFigura
            key={f.codigo}
            figura={f}
            seleccionado={seleccionados.includes(f.codigo)}
            onAlternar={onAlternar}
            anchoCompleto={f.codigo === CODIGO_ANCHO_COMPLETO}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 items-stretch mt-3">
        {gruposSolos.map((grupo) => {
          const figuras = CATALOGO_FIGURAS_NORMATIVAS.filter((f) => f.tipoFigura === grupo);
          if (figuras.length === 0) return null;
          return (
            <div key={grupo}>
              <p
                className="mb-1 text-[11px] font-semibold uppercase"
                style={{ color: 'var(--texto-suave)', letterSpacing: '0.06em' }}
              >
                {TITULO_GRUPO_SOLO[grupo]}
              </p>
              {figuras.map((f) => (
                <TarjetaFigura
                  key={f.codigo}
                  figura={f}
                  seleccionado={seleccionados.includes(f.codigo)}
                  onAlternar={onAlternar}
                />
              ))}
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
