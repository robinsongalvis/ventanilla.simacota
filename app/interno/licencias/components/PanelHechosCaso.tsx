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
  const sinDefinir = clavesLegibles.filter((clave) => !Object.prototype.hasOwnProperty.call(contexto, clave.nombre));

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>
        Hechos del caso
      </p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Resuelven los requisitos condicionales del checklist.
      </p>

      {/* Aviso de faltantes (punto 4 del encargo). UN solo nodo estable con
          aria-live="polite": cambia el contenido interno según haya o no
          hechos "Sin definir", en vez de montar/desmontar dos elementos
          distintos — así el lector de pantalla anuncia la transición de
          "faltan N" a "todos definidos" de forma confiable. */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg px-3 py-2 text-xs mb-3 flex items-start gap-2"
        style={
          sinDefinir.length > 0
            ? { background: '#FDF2E2', border: '1px solid rgba(217,119,6,0.30)', color: '#7A4F0A' }
            : { background: 'transparent', border: '1px solid transparent', color: 'var(--color-success-text)' }
        }
      >
        {sinDefinir.length > 0 ? (
          <>
            <span aria-hidden="true" className="leading-none">⚠️</span>
            <span>
              {`Falta${sinDefinir.length === 1 ? '' : 'n'} ${sinDefinir.length} hecho${sinDefinir.length === 1 ? '' : 's'} del caso por definir — el checklist de requisitos condicionales puede estar incompleto mientras tanto.`}
            </span>
          </>
        ) : (
          <span>Todos los hechos del caso están definidos.</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {clavesLegibles.map((clave) => {
          const definido = Object.prototype.hasOwnProperty.call(contexto, clave.nombre);
          const valorActual = definido ? contexto[clave.nombre] : undefined;
          const idCampo = `hecho-${expedienteId}-${clave.nombre}`;
          const idAyuda = `${idCampo}-ayuda`;
          const idEfecto = `${idCampo}-efecto`;
          const deshabilitado = soloLectura || claveGuardando === clave.nombre;
          const etiqueta = clave.pregunta && clave.pregunta.trim().length > 0 ? clave.pregunta : prettyClave(clave.nombre);
          // El efecto se muestra mientras el hecho está "Sin definir": es ahí
          // donde le sirve al funcionario para decidir CÓMO responder. Una
          // vez respondido, el checklist de arriba ya refleja el resultado —
          // repetir "aparece/desaparece X" en pasado sería ruido, no ayuda.
          const mostrarEfecto = !definido && !!clave.efecto;
          const describedBy = [clave.ayuda ? idAyuda : null, mostrarEfecto ? idEfecto : null].filter(Boolean).join(' ') || undefined;

          return (
            <div key={clave.nombre} className="flex flex-col gap-1">
              <label htmlFor={idCampo} className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {etiqueta}
              </label>

              {clave.ayuda && (
                <p id={idAyuda} className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {clave.ayuda}
                </p>
              )}

              {mostrarEfecto && (
                <p id={idEfecto} className="text-[11px] leading-snug italic" style={{ color: 'var(--text-muted)' }}>
                  {clave.efecto}
                </p>
              )}

              {clave.tipo === 'boolean' ? (
                <select
                  id={idCampo}
                  aria-describedby={describedBy}
                  className="select-internal"
                  disabled={deshabilitado}
                  value={valorActual === undefined ? '' : String(valorActual)}
                  onChange={(e) => {
                    if (e.target.value === '') return;
                    void guardar(clave.nombre, e.target.value === 'true');
                  }}
                >
                  <option value="" disabled>— Sin definir —</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : clave.dominio ? (
                <select
                  id={idCampo}
                  aria-describedby={describedBy}
                  className="select-internal"
                  disabled={deshabilitado}
                  value={valorActual === undefined ? '' : String(valorActual)}
                  onChange={(e) => {
                    const seleccion = e.target.value;
                    if (seleccion === '') return;
                    const valorOriginal = clave.dominio!.find((v) => String(v) === seleccion) ?? seleccion;
                    void guardar(clave.nombre, valorOriginal);
                  }}
                >
                  <option value="" disabled>— Sin definir —</option>
                  {clave.dominio.map((v) => (
                    <option key={String(v)} value={String(v)}>{prettyValorDominio(v)}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={idCampo}
                  aria-describedby={describedBy}
                  type={clave.tipo === 'number' ? 'number' : 'text'}
                  className="input-internal"
                  disabled={deshabilitado}
                  defaultValue={valorActual === undefined ? '' : String(valorActual)}
                  onBlur={(e) => {
                    const bruto = e.target.value.trim();
                    if (!bruto) return;
                    if (clave.tipo === 'number') {
                      const n = Number(bruto);
                      if (!Number.isNaN(n)) void guardar(clave.nombre, n);
                      return;
                    }
                    void guardar(clave.nombre, bruto);
                  }}
                />
              )}

              {claveGuardando === clave.nombre && (
                <span role="status" className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Guardando…
                </span>
              )}
              {claveRecienGuardada === clave.nombre && claveGuardando !== clave.nombre && (
                <span role="status" className="text-[11px]" style={{ color: 'var(--color-success-text)' }}>
                  Guardado — el checklist de requisitos puede haber cambiado.
                </span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-xs mt-3"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
