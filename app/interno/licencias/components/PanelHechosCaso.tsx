'use client';

import { useState } from 'react';
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
══════════════════════════════════════════════════════════════ */

/** Transforma una clave camelCase (`sujetoTituloENSR10`) en texto legible, SOLO para mostrar — el valor que viaja al servidor sigue siendo `clave.nombre` tal cual. */
function prettyClave(nombre: string): string {
  const conEspacios = nombre.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

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
  const [error, setError] = useState<string | null>(null);

  async function guardar(clave: string, valor: string | number | boolean) {
    setError(null);
    setClaveGuardando(clave);
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
    } catch {
      setError('Error de red al guardar el hecho del caso.');
    } finally {
      setClaveGuardando(null);
    }
  }

  if (clavesContexto.length === 0) return null;

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

      <div className="flex flex-col gap-3">
        {clavesContexto.map((clave) => {
          const definido = Object.prototype.hasOwnProperty.call(contexto, clave.nombre);
          const valorActual = definido ? contexto[clave.nombre] : undefined;
          const idCampo = `hecho-${expedienteId}-${clave.nombre}`;
          const deshabilitado = soloLectura || claveGuardando === clave.nombre;

          return (
            <div key={clave.nombre} className="flex flex-col gap-1">
              <label htmlFor={idCampo} className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {prettyClave(clave.nombre)}
              </label>

              {clave.tipo === 'boolean' ? (
                <select
                  id={idCampo}
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
