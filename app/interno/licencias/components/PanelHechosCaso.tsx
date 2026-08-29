'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClaveContextoDeclarada, ContextoEvaluacionRequisito } from '@/lib/motor-expedientes/tipos';

/* ══════════════════════════════════════════════════════════════
   Panel "Hechos del caso" — Bloque A·A3. Controles para los `contexto[]`
   que `evaluarCondicion` (`lib/motor-expedientes/completitud.ts`) necesita
   para resolver los requisitos CONDICIONALES del checklist EN VIVO: al
   guardar un hecho, el padre (`ChecklistRequisitos`) recibe el `contexto`
   mergeado que devuelve el propio PATCH y vuelve a evaluar el checklist en
   el siguiente render — sin volver a pedir el expediente completo.

   Boolean → SELECT de 3 estados (Sin definir / Sí / No), NO un toggle
   binario: `evaluarCondicion` distingue FAIL-CLOSED entre "el hecho es
   falso" e "el hecho no se ha capturado" (INDETERMINADO, ver JSDoc de
   cabecera de completitud.ts) — un toggle sí/no de dos posiciones fuerza
   siempre un valor y le quita al funcionario la posibilidad honesta de
   dejar un condicional genuinamente sin definir. El servidor
   (`planActualizarContexto`) tampoco admite "desmarcar" una clave ya
   capturada (solo hace merge, nunca borra) — coherente con esa fase: una
   vez fijado un hecho del caso, se corrige entre Sí/No, no se revierte a
   "sin definir".

   Dominio (`ClaveContextoDeclarada.dominio`) → SELECT con esos valores.
   Sin dominio (string/number libre) → input de texto/número, con guardado
   al perder el foco — caso no usado hoy por la Definición sembrada, pero
   el tipo lo permite (D9: una Definición futura puede declarar una clave
   así sin tocar este componente).

   Lenguaje natural (`pregunta`/`ayuda`/`efecto`) — el propietario reportó en
   producción que `prettyClave()` sola (p. ej. "Sujeto Titulo ENSR10") no le
   dice a la funcionaria qué se le pregunta ni para qué. Una Definición
   puede declarar estos tres campos opcionales por clave para reemplazar esa
   jerga: la pregunta en español natural, la ayuda (qué significa + cita
   normativa) y el efecto (qué requisito aparece/desaparece según la
   respuesta). Los tres son ADITIVOS y se leen de forma defensiva — una
   clave que no los declare (o mientras el tipo en `lib/` termine de
   incorporarlos) cae exactamente al comportamiento de hoy: `prettyClave()`,
   sin ayuda ni efecto. Ningún texto se inventa aquí: si la Definición no
   trae el texto, no se muestra.
══════════════════════════════════════════════════════════════ */

/** Transforma una clave camelCase (`sujetoTituloENSR10`) en texto legible, SOLO para mostrar — el valor que viaja al servidor sigue siendo `clave.nombre` tal cual. Respaldo cuando la Definición no declara `pregunta`. */
function prettyClave(nombre: string): string {
  const conEspacios = nombre.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

/**
 * `ClaveContextoDeclarada` ampliada con los campos de lenguaje natural
 * (`pregunta`/`ayuda`/`efecto`). Cast LOCAL a este componente — no toca
 * `lib/motor-expedientes/tipos.ts` (otro agente lo está incorporando ahí en
 * paralelo). Los tres campos son opcionales, así que esta intersección es
 * segura tanto si el tipo real en `lib/` ya los declara (no cambia nada)
 * como si todavía no lo hace (este componente igual compila y lee `undefined`
 * para los tres, que es exactamente el caso de respaldo).
 */
type ClaveContextoLegible = ClaveContextoDeclarada & {
  /** Pregunta en español natural, p. ej. "¿El solicitante actúa mediante apoderado?". Respaldo: `prettyClave(nombre)`. */
  pregunta?: string;
  /** Qué significa el hecho para el trámite, con la referencia normativa al final. Se muestra siempre que exista, sin acción del funcionario. */
  ayuda?: string;
  /** Qué requisito del checklist aparece o desaparece según la respuesta. Se muestra mientras el hecho esté "Sin definir" (ver justificación en el componente). */
  efecto?: string;
};

function prettyValorDominio(valor: string | number | boolean): string {
  if (typeof valor !== 'string' || valor.length === 0) return String(valor);
  return valor.charAt(0) + valor.slice(1).toLowerCase();
}

export interface PanelHechosCasoProps {
  expedienteId: string;
  clavesContexto: ClaveContextoDeclarada[];
  contexto: ContextoEvaluacionRequisito;
  soloLectura: boolean;
  onActualizado: (nuevoContexto: ContextoEvaluacionRequisito) => void;
}

export function PanelHechosCaso({ expedienteId, clavesContexto, contexto, soloLectura, onActualizado }: PanelHechosCasoProps) {
  const [claveGuardando, setClaveGuardando] = useState<string | null>(null);
  /**
   * Última clave guardada con éxito — alimenta el aviso "Guardado, el
   * checklist puede haber cambiado" (punto 5 del encargo). NO es el delta
   * real de requisitos agregados/retirados: ese cálculo vive en
   * `evaluarCompletitud` (`lib/motor-expedientes/completitud.ts`), que este
   * componente no ejecuta ni duplica. Se limita a confirmar honestamente
   * que el guardado ocurrió y que el checklist (arriba, en
   * `ChecklistRequisitos`) puede haberse actualizado como consecuencia.
   */
  const [claveRecienGuardada, setClaveRecienGuardada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const temporizadorConfirmacion = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (temporizadorConfirmacion.current) clearTimeout(temporizadorConfirmacion.current);
    };
  }, []);

  async function guardar(clave: string, valor: string | number | boolean) {
    setError(null);
    setClaveGuardando(clave);
    if (temporizadorConfirmacion.current) clearTimeout(temporizadorConfirmacion.current);
    setClaveRecienGuardada(null);
    try {
      const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}/contexto`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [clave]: valor }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'No fue posible guardar el hecho del caso.');
        return;
      }
      onActualizado(body.contexto as ContextoEvaluacionRequisito);
      setClaveRecienGuardada(clave);
      temporizadorConfirmacion.current = setTimeout(() => setClaveRecienGuardada(null), 5000);
    } catch {
      setError('Error de red al guardar el hecho del caso.');
    } finally {
      setClaveGuardando(null);
    }
  }

  if (clavesContexto.length === 0) return null;

  const clavesLegibles = clavesContexto as ClaveContextoLegible[];
  const definidas = clavesLegibles.filter((c) => Object.prototype.hasOwnProperty.call(contexto, c.nombre));
  const sinDefinir = clavesLegibles.length - definidas.length;

  return (
    <section
      aria-label="Hechos del caso"
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
    >
      {/* CABECERA con progreso. Sustituye al banner ámbar de advertencia: decir
          «1 de 4 definidas» informa lo mismo sin regañar, y el aria-live sigue
          anunciando el avance. */}
      <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3"
           style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
            Hechos del caso
          </p>
          <p className="font-headline text-lg font-black mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {`${clavesLegibles.length} respuestas ajustan el checklist a este caso`}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Nada se exige de más ni de menos: cada respuesta activa o retira requisitos al instante.
          </p>
        </div>

        <div role="status" aria-live="polite" className="text-right shrink-0">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{`${definidas.length} de ${clavesLegibles.length}`}</strong>{' '}
            definidas
          </p>
          <div className="flex gap-1 mt-1.5 justify-end" aria-hidden>
            {clavesLegibles.map((c) => (
              <span
                key={c.nombre}
                className="block h-1.5 w-7 rounded-full"
                style={{
                  background: Object.prototype.hasOwnProperty.call(contexto, c.nombre) ? '#14532D' : 'var(--bg-surface-2)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <ul className="flex flex-col">
        {clavesLegibles.map((clave, indice) => (
          <FilaHecho
            key={clave.nombre}
            clave={clave}
            indice={indice + 1}
            expedienteId={expedienteId}
            contexto={contexto}
            soloLectura={soloLectura}
            guardando={claveGuardando === clave.nombre}
            onElegir={(valor) => guardar(clave.nombre, valor)}
          />
        ))}
      </ul>

      {/* CONFIRMACIÓN HONESTA tras guardar. La perdí al reescribir esta pantalla
          y una prueba la reclamó: dice que el checklist PUEDE haber cambiado,
          sin afirmar cuántos requisitos —ese número no se conoce aquí, y
          inventarlo sería justo lo que el nombre de su prueba prohíbe—. */}
      {claveRecienGuardada && (
        <p role="status" aria-live="polite" className="px-5 py-2 text-xs" style={{ color: 'var(--color-success-text)' }}>
          Guardado — el checklist de requisitos puede haber cambiado.
        </p>
      )}

      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
           style={{ borderTop: '1px solid var(--color-border)', background: 'var(--bg-surface-2)' }}>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          El checklist queda <strong>completo y exacto</strong> al responder las {clavesLegibles.length} —
          hoy exige lo general mientras tanto.
        </p>
        {/* El pie cambia de estado al completarlas: mientras faltan avisa
            cuántas; al terminar, CONFIRMA que el checklist quedó exacto — que
            es el hecho que la funcionaria necesita para seguir. */}
        <span
          className="text-xs font-bold px-3 py-2 rounded-lg"
          style={
            sinDefinir === 0
              ? { background: '#116932', color: '#fff' }
              : { background: 'var(--bg-surface-1)', color: '#9A6206', border: '1px solid var(--color-border)' }
          }
        >
          {sinDefinir === 0
            ? '✓ Hechos completos — el checklist quedó exacto'
            : `Falta${sinDefinir === 1 ? '' : 'n'} ${sinDefinir} respuesta${sinDefinir === 1 ? '' : 's'}`}
        </span>
      </div>

      {error && (
        <p role="alert" className="px-5 py-2 text-xs" style={{ color: 'var(--color-danger-text)' }}>{error}</p>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   UNA PREGUNTA POR FILA.

   La ayuda larga va COLAPSADA tras «ⓘ»: quien sabe responde en un clic y quien
   duda la abre. Sigue estando en el DOM y asociada por `aria-describedby` —lo
   que la prueba de accesibilidad custodia es que EXISTA y esté asociada, no que
   ocupe sitio siempre—.

   Y la consecuencia va DENTRO de la opción: la funcionaria ve lo que cuesta
   cada respuesta antes de tocarla, no después.
══════════════════════════════════════════════════════════════ */
function FilaHecho({
  clave,
  indice,
  expedienteId,
  contexto,
  soloLectura,
  guardando,
  onElegir,
}: {
  clave: ClaveContextoLegible;
  indice: number;
  expedienteId: string;
  contexto: ContextoEvaluacionRequisito;
  soloLectura: boolean;
  guardando: boolean;
  onElegir: (valor: string | number | boolean) => void;
}) {
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const definido = Object.prototype.hasOwnProperty.call(contexto, clave.nombre);
  const valorActual = definido ? contexto[clave.nombre] : undefined;
  const idCampo = `hecho-${expedienteId}-${clave.nombre}`;
  const idAyuda = `${idCampo}-ayuda`;
  const idEfecto = `${idCampo}-efecto`;

  /* La línea corta de contexto se muestra SIEMPRE. Antes solo aparecía sin
     definir, porque el texto era una consecuencia en futuro —«Si responde Sí,
     se exigirá…»— que en pasado sobraba. Ahora es contexto —«Solo decide qué
     planos técnicos se exigen»—, y eso sigue siendo cierto después de
     responder. */
  const mostrarEfecto = !!clave.efecto;
  const describedBy = [clave.ayuda ? idAyuda : null, mostrarEfecto ? idEfecto : null]
    .filter(Boolean).join(' ') || undefined;

  /* Las opciones salen de la Definición. Sin `opciones` declaradas se cae al
     comportamiento de siempre —Sí / No, o los valores del dominio— sin
     inventar ningún texto. */
  /* EL VALOR VA TIPADO, NO COMO TEXTO.
     Al pasar de `<select>` a botones perdí la conversión que hacía el
     `onChange` (`value === 'true'`), y la pantalla empezó a enviar la CADENA
     'true'. El servidor la rechazaba con «la clave "esApoderado" espera
     boolean, se recibió string» — un error que las pruebas no vieron porque
     mockean `fetch` y no validan el tipo.

     Ahora `valor` ES el valor del dominio: `true`/`false` de verdad, o la
     entrada tal cual de `dominio`. La etiqueta es SOLO presentación y no viaja
     nunca. */
  type OpcionRender = { valor: string | number | boolean; etiqueta: string; consecuencia?: string; resumen?: string };
  const opciones: OpcionRender[] =
    clave.tipo === 'boolean'
      ? [
          { valor: false, etiqueta: clave.opciones?.no?.etiqueta ?? 'No', consecuencia: clave.opciones?.no?.consecuencia, resumen: clave.opciones?.no?.resumen },
          { valor: true, etiqueta: clave.opciones?.si?.etiqueta ?? 'Sí', consecuencia: clave.opciones?.si?.consecuencia, resumen: clave.opciones?.si?.resumen },
        ]
      : (clave.dominio ?? []).map((v) => ({
          valor: v,
          etiqueta: clave.opciones?.porValor?.[String(v)]?.etiqueta ?? String(v),
          consecuencia: clave.opciones?.porValor?.[String(v)]?.consecuencia,
          resumen: clave.opciones?.porValor?.[String(v)]?.resumen,
        }));

  /* Se compara por VALOR, no por su texto: `String(v)` colapsaría `true` y
     `'true'`, que es justo la confusión que causó el error. */
  const opcionDeValor = (v: unknown) => opciones.find((x) => x.valor === v);

  return (
    <li
      className="px-5 py-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3"
      style={{
        borderTop: indice === 1 ? undefined : '1px solid var(--color-border)',
        /* El verde recorre la fila entera y se apaga hacia la derecha, para
           que la respondida se distinga de un vistazo sin gritar. */
        background: definido
          ? 'linear-gradient(90deg, rgba(20,83,45,0.07) 0%, rgba(20,83,45,0.03) 60%, transparent 100%)'
          : undefined,
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black"
            style={
              definido
                ? { background: '#14532D', color: '#fff' }
                : { background: 'var(--bg-surface-2)', color: '#94A3B8', border: '1px solid var(--color-border)' }
            }
          >
            {definido ? '✓' : indice}
          </span>
          <div className="min-w-0">
            <p id={idCampo} className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {clave.pregunta ?? prettyClave(clave.nombre)}
            </p>

            {mostrarEfecto && (
              <p id={idEfecto} className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {clave.efecto}
              </p>
            )}

            {/* CHIP de lo decidido: la funcionaria ve la consecuencia ya
                aplicada sin tener que recordar qué eligió. */}
            {definido && opcionDeValor(valorActual) && (
              <span
                className="inline-block mt-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: '#E7F6EC', color: '#116932' }}
              >
                {/* El chip tiene TEXTO PROPIO, no la etiqueta más la
                    consecuencia pegadas: al decidir se puede ser más explícito
                    que en un botón, porque ya no compite por espacio. */}
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full mr-1.5" style={{ background: 'currentColor' }} />
                {opcionDeValor(valorActual)!.resumen ?? opcionDeValor(valorActual)!.etiqueta}
              </span>
            )}

            {clave.ayuda && (
              <>
                <button
                  type="button"
                  onClick={() => setAyudaAbierta((v) => !v)}
                  aria-expanded={ayudaAbierta}
                  aria-controls={idAyuda}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 rounded"
                  style={{ color: '#14532D' }}
                >
                  <span aria-hidden>ⓘ</span>
                  {/* Cada pregunta con SU enlace: cuatro «¿Cómo se clasifica?»
                      clonados no ayudan a decidir cuál abrir. */}
                  {ayudaAbierta ? 'Ocultar ayuda' : (clave.ayudaEnlace ?? 'Ver ayuda')}
                </button>
                {/* Sigue en el DOM y asociada por aria aunque esté plegada: lo
                    que importa es que exista y se pueda alcanzar. */}
                <p
                  id={idAyuda}
                  hidden={!ayudaAbierta}
                  className="text-xs leading-relaxed mt-2 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(20,83,45,0.05)', borderLeft: '3px solid #14532D', color: 'var(--text-secondary)' }}
                >
                  {clave.ayuda}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* BOTONES SEGMENTADOS — mueren los dropdowns «— Sin definir —». */}
      <div
        role="group"
        aria-labelledby={idCampo}
        aria-describedby={describedBy}
        /* Reparto UNIFORME: `flex-1 basis-0` en cada opción, para que «No» no
           quede raquítico al lado de «No — rodeado de espacio público». */
        className="flex gap-1 p-1 rounded-xl shrink-0 w-full sm:w-[360px]"
        style={{ background: 'var(--bg-surface-2)' }}
      >
        {opciones.map((o) => {
          const elegida = definido && valorActual === o.valor;
          return (
            <button
              key={String(o.valor)}
              type="button"
              disabled={soloLectura || guardando}
              aria-pressed={elegida}
              onClick={() => onElegir(o.valor)}
              className="flex-1 basis-0 px-4 py-2.5 text-sm text-center rounded-lg transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2"
              style={
                elegida
                  ? { background: '#14532D', color: '#fff', fontWeight: 800 }
                  : { background: 'transparent', color: 'var(--text-primary)', fontWeight: 700 }
              }
            >
              <span className="block">{o.etiqueta}</span>
              {o.consecuencia && (
                <span
                  className="block text-[11px] font-normal"
                  style={{ color: elegida ? 'rgba(255,255,255,0.8)' : '#94A3B8' }}
                >
                  {o.consecuencia}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </li>
  );
}
