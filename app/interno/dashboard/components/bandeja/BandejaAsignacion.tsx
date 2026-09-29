'use client';

import { useState } from 'react';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';
import { useVentanilla } from '@/lib/store/ventanillaStore';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { NOMBRES_TENANT, DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import { asignarRadicado, asignarMasivo } from '@/lib/actions/asignarRadicado';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { formatFechaCortaColombia } from '@/lib/fecha-colombia';
import {
  documentoSolicitanteVisible,
  nombreSolicitanteVisible,
} from '@/lib/seguridad/identidad-protegida';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { EmptyState } from '@/app/components/design-system/EmptyState';
import { CabeceraTablaSticky, SuperficieTabla } from '@/app/components/design-system/SuperficieTabla';

/* ══════════════════════════════════════════════════════════════
   Bandeja de asignación — reparto de radicados pendientes a su
   dependencia destino (ADMIN y RECEPCIONISTA).

   Ola 3 (ADR-0046): trasladada SIN cambios desde
   `app/interno/dashboard/page.tsx` y después migrada al lenguaje del
   Tablero (encabezado, superficie de tabla y cabecera fija del sistema).
   Los ayudantes locales de la página se sustituyeron por las librerías a
   las que delegaban (`diasRestantesHabiles`, `formatFechaCortaColombia`):
   mismo resultado, sin duplicar lógica. La asignación no cambia.
══════════════════════════════════════════════════════════════ */

export function BandejaAsignacion({
  radicados,
  cargando,
  error,
  usuario,
}: {
  radicados: VentanillaRadicado[];
  cargando: boolean;
  error: string | null;
  usuario: UsuarioAutenticado;
}) {
  const { state, dispatch } = useVentanilla();
  const { seleccionMasiva, tenantMasivo } = state;

  const [tenantPorFila,   setTenantPorFila]   = useState<Record<string, TenantId>>({});
  const [asignandoFila,   setAsignandoFila]   = useState<Record<string, boolean>>({});
  const [exitoFila,       setExitoFila]       = useState<Record<string, boolean>>({});
  const [asignandoMasivo, setAsignandoMasivo] = useState(false);
  const [resultadoMasivo, setResultadoMasivo] = useState<string | null>(null);

  const todosIds = radicados.map((r) => r.radicadoId);
  const todosSeleccionados =
    todosIds.length > 0 && todosIds.every((id) => seleccionMasiva.has(id));

  function getTenantFila(id: string): TenantId {
    return tenantPorFila[id] ?? 'DESPACHO_ALCALDE';
  }

  async function asignarUno(r: VentanillaRadicado) {
    const tenant = getTenantFila(r.radicadoId);
    setAsignandoFila((p) => ({ ...p, [r.radicadoId]: true }));
    try {
      await asignarRadicado(r.radicadoId, tenant, { uid: usuario.uid, nombre: usuario.nombre });
      setExitoFila((p) => ({ ...p, [r.radicadoId]: true }));
      setTimeout(() => setExitoFila((p) => ({ ...p, [r.radicadoId]: false })), 3000);
    } finally {
      setAsignandoFila((p) => ({ ...p, [r.radicadoId]: false }));
    }
  }

  async function asignarSeleccionados() {
    if (!tenantMasivo || seleccionMasiva.size === 0) return;
    setAsignandoMasivo(true);
    setResultadoMasivo(null);
    try {
      const { asignados, fallidos } = await asignarMasivo(
        Array.from(seleccionMasiva),
        tenantMasivo as TenantId,
        { uid: usuario.uid, nombre: usuario.nombre },
      );
      dispatch({ type: 'LIMPIAR_SELECCION' });
      setResultadoMasivo(
        `${asignados} asignado${asignados !== 1 ? 's' : ''}` +
          (fallidos > 0 ? ` · ${fallidos} fallido${fallidos !== 1 ? 's' : ''}` : ''),
      );
    } finally {
      setAsignandoMasivo(false);
    }
  }

  /* #475569: el gris #64748B se queda en 4,47:1 sobre la fila seleccionada (tintada). */
  const ESTILO_SECUNDARIO = { color: 'var(--tema-texto-475569)' } as const;
  const spinner = <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* Encabezado (lenguaje del Tablero) */}
      <SectionHeader
        titulo="Bandeja de Asignación"
        contador={`${radicados.length} pendiente${radicados.length !== 1 ? 's' : ''}`}
        acciones={seleccionMasiva.size > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'LIMPIAR_SELECCION' })}
            className="rounded-md px-2 py-1 text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
            style={ESTILO_SECUNDARIO}
          >
            Limpiar selección ({seleccionMasiva.size})
          </button>
        )}
      />

      {/* Barra de asignación masiva */}
      {seleccionMasiva.size > 0 && (
        <div className="mx-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 shrink-0 sm:mx-4 lg:mx-6"
             style={{ background: 'var(--tema-fondo-f4f9f6)', border: '1px solid var(--tema-borde-dce4ea)' }}>
          <span className="text-xs font-bold shrink-0" style={{ color: 'var(--tema-texto-007049)' }}>
            {seleccionMasiva.size} seleccionado{seleccionMasiva.size !== 1 ? 's' : ''}
          </span>
          <select value={tenantMasivo}
            onChange={(e) => dispatch({ type: 'SET_TENANT_MASIVO', tenant: e.target.value as TenantId | '' })}
            aria-label="Dependencia destino de los seleccionados"
            className="select-internal min-w-0 flex-[1_1_12rem] text-xs">
            <option value="">— Selecciona dependencia destino —</option>
            {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
              <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
            ))}
          </select>
          <BotonAccion variante="primaria" onClick={asignarSeleccionados} disabled={!tenantMasivo || asignandoMasivo}>
            {asignandoMasivo && spinner}
            Asignar {seleccionMasiva.size}
          </BotonAccion>
        </div>
      )}

      {resultadoMasivo && (
        <div role="status" className="mx-3 mt-2 px-3 py-2 rounded-lg text-xs shrink-0 sm:mx-4 lg:mx-6"
             style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)', color: 'var(--tema-texto-006b45)' }}>
          {resultadoMasivo}
        </div>
      )}
      {error && (
        <div role="alert" className="mx-3 mt-2 p-3 rounded-xl text-xs shrink-0 sm:mx-4 lg:mx-6"
             style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)' }}>
          Error de conexión: {error}
        </div>
      )}

      {/* Tabla: superficie y cabecera fija del sistema; scroll interno */}
      <SuperficieTabla>
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--tema-fondo-ffffff)]">
          <table className="w-full text-sm">
            <CabeceraTablaSticky
              control={
                <input type="checkbox" checked={todosSeleccionados}
                  onChange={() => dispatch({ type: 'SELECCIONAR_TODOS', radicadoIds: todosIds })}
                  aria-label="Seleccionar todos los pendientes"
                  className="w-3.5 h-3.5 rounded cursor-pointer"
                  style={{ accentColor: '#007049' }} />
              }
              columnas={['Radicado', 'Solicitante', 'Tipo', 'Días', 'Dependencia destino', 'Acción']}
            />
            <tbody>
              {cargando && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse" style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-2 py-2.5">
                      <div className="h-3 rounded" style={{ width: `${40 + (j % 3) * 20}%`, background: 'var(--tema-fondo-f4f9f6)' }} />
                    </td>
                  ))}
                </tr>
              ))}

              {!cargando && radicados.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState titulo="Sin pendientes" descripcion="No hay radicados esperando asignación." />
                  </td>
                </tr>
              )}

              {!cargando && radicados.map((r) => {
                const dias       = diasRestantesHabiles(r.termino.fechaVencimiento);
                const seleccionado = seleccionMasiva.has(r.radicadoId);
                const esRojo     = r.prioridad === 'ROJO';
                const ok         = exitoFila[r.radicadoId];

                return (
                  <tr key={r.radicadoId} className="micro-row"
                      style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)', background: seleccionado ? 'var(--tema-fondo-f4f9f6)' : undefined }}>
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={seleccionado}
                        onChange={() => dispatch({ type: 'TOGGLE_SELECCION', radicadoId: r.radicadoId })}
                        aria-label={`Seleccionar ${r.radicadoId}`}
                        className="w-3.5 h-3.5 rounded cursor-pointer"
                        style={{ accentColor: '#007049' }} />
                    </td>

                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {esRojo && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />}
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--tema-texto-007049)' }}>{r.radicadoId}</span>
                      </div>
                      <p className="text-[10px] mt-0.5" style={ESTILO_SECUNDARIO}>{formatFechaCortaColombia(r.control.fechaRadicado)}</p>
                    </td>

                    <td className="px-2 py-2 max-w-[160px]">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--tema-texto-172033)' }}>{nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}</p>
                      <p className="text-[10px] font-mono" style={ESTILO_SECUNDARIO}>
                        {documentoSolicitanteVisible(r, r.solicitante.tipoDocumento, r.solicitante.numeroDocumento)}
                      </p>
                    </td>

                    <td className="px-2 py-2 whitespace-nowrap">
                      <p className="text-xs" style={{ color: 'var(--tema-texto-475569)' }}>{r.termino.tipoSolicitudNombre}</p>
                      <p className="text-[10px]" style={ESTILO_SECUNDARIO}>{r.termino.diasRespuesta}d</p>
                    </td>

                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={`text-sm font-bold tabular-nums ${
                        dias < 0 ? 'text-red-700 oscuro:text-red-300' : dias <= 2 ? 'text-orange-700 oscuro:text-orange-300' : ''
                      }`} style={dias > 2 ? { color: 'var(--tema-texto-64748b)' } : {}}>
                        {dias < 0 ? `${Math.abs(dias)}d venc.` : `${dias}d`}
                      </span>
                    </td>

                    <td className="px-2 py-2">
                      <select value={getTenantFila(r.radicadoId)}
                        onChange={(e) => setTenantPorFila((p) => ({ ...p, [r.radicadoId]: e.target.value as TenantId }))}
                        aria-label={`Dependencia destino de ${r.radicadoId}`}
                        className="select-internal text-[11px] min-w-[150px]">
                        {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
                          <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-2 py-2 whitespace-nowrap">
                      {ok ? (
                        <span role="status" className="text-xs font-bold text-green-700 oscuro:text-green-300">✓ Asignado</span>
                      ) : (
                        <BotonAccion
                          variante="primaria"
                          onClick={() => asignarUno(r)}
                          disabled={!!asignandoFila[r.radicadoId]}
                          aria-label={asignandoFila[r.radicadoId] ? `Asignando ${r.radicadoId}…` : undefined}
                        >
                          {asignandoFila[r.radicadoId] ? spinner : 'Asignar →'}
                        </BotonAccion>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SuperficieTabla>
    </div>
  );
}
