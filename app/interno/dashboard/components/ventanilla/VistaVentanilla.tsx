'use client';

import { useMemo, useState } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  filtrarTrabajoHoy,
  trabajoDeHoy,
  type FilaTrabajoHoy,
  type FiltroTrabajoHoy,
  type PendienteMostrador,
} from '@/lib/mostrador/trabajo-de-hoy';
import { nombreSolicitanteVisible } from '@/lib/seguridad/identidad-protegida';
import { coincideIdentidadFiltroRapido } from '@/lib/busqueda/coincidencia-filtro-rapido';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { EmptyState } from '@/app/components/design-system/EmptyState';
import { StatusBadge } from '@/app/components/design-system/StatusBadge';
import { BarraTrabajo } from '@/app/components/design-system/BarraTrabajo';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { ChipFiltro } from '@/app/components/design-system/ChipFiltro';
import type { TonoIndicador } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { ArrowRight, BookOpen, ClipboardList, Clock3, FileWarning, Inbox, MailX, Plus, Send, SlidersHorizontal, UserRoundX } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Ventanilla · módulo de mostrador — "Atención al ciudadano".

   Centro operativo de la recepción (decisión del propietario, 23-sep-2026):
   arriba, el estado de la operación en tarjetas (mismas cifras que el
   Tablero y la Bandeja) y todas las herramientas de recepción; debajo, el
   mostrador de siempre. Cada tarjeta LLEVA a donde ese estado se gestiona
   (Bandeja o Tablero filtrado); no filtra aquí. Sin flujos nuevos: solo
   se reúne lo que ya existe. La búsqueda sigue siendo la protagonista y
   "Nueva radicación" la acción primaria (única superficie dorada).

   La búsqueda tiene estado PROPIO: no comparte el `busqueda` del
   reducer del Tablero para no arrastrar filtros apilados entre
   módulos (lección del Nivel 3A).
══════════════════════════════════════════════════════════════ */

/* Ola 3 (ADR-0046): colores por token de tema (claro/oscuro). El dorado del
   punto del encabezado es la marca del mostrador y no cambia con el tema. */
const VERDE_INST = 'var(--tema-texto-007049)';
const DORADO     = '#E5A31A';
const MAX_RESULTADOS = 8;

/** Trío visual de cada chip de pendiente (color = estado, nunca decora). */
const CHIP_PENDIENTE: Record<PendienteMostrador, { label: string; bg: string; texto: string }> = {
  SELLAR_PDF:            { label: 'PDF sin sellar',        bg: 'var(--tema-fondo-faeeda)', texto: 'var(--tema-texto-7a4f0a)' },
  DATOS_INCOMPLETOS:     { label: 'Datos incompletos',     bg: 'var(--tema-fondo-faeeda)', texto: 'var(--tema-texto-7a4f0a)' },
  CORREO_FALLIDO:        { label: 'Correo fallido',        bg: 'var(--tema-fondo-fcebeb)', texto: 'var(--tema-texto-911111)' },
  CONSTANCIA_SIN_ENVIAR: { label: 'Constancia sin enviar', bg: 'var(--tema-fondo-faeeda)', texto: 'var(--tema-texto-7a4f0a)' },
};

/** Riel izquierdo de la fila según su pendiente más urgente. */
function rielFila(f: FilaTrabajoHoy): string {
  if (f.pendientes.includes('CORREO_FALLIDO')) return 'var(--tema-texto-d81e1e)';
  if (f.pendientes.length > 0)                 return 'var(--tema-texto-d97706)';
  return VERDE_INST;
}

/** Chips de «Trabajo de hoy»: mismo orden, conteos y alternancia de antes. */
const CHIPS_HOY: readonly { id: Exclude<FiltroTrabajoHoy, 'TODOS'>; conteo: keyof ReturnType<typeof trabajoDeHoy>['conteos']; tono: TonoIndicador }[] = [
  { id: 'SELLAR_PDF',            conteo: 'sellarPdf',           tono: 'ambar' },
  { id: 'DATOS_INCOMPLETOS',     conteo: 'datosIncompletos',    tono: 'ambar' },
  { id: 'CORREO_FALLIDO',        conteo: 'correoFallido',       tono: 'rojo' },
  { id: 'CONSTANCIA_SIN_ENVIAR', conteo: 'constanciaSinEnviar', tono: 'ambar' },
];

/** Destinos del Tablero a los que lleva una tarjeta del hub (filtros que ya existen). */
export type DestinoTableroVentanilla = 'DATOS_INCOMPLETOS' | 'CORREOS_FALLIDOS' | 'POR_VENCER';

/**
 * Estado de la operación para el hub. Lo calcula la página con las MISMAS
 * fuentes del Tablero y de la Bandeja, así que al pulsar una tarjeta la
 * cifra coincide con las filas que se ven al llegar.
 */
export interface ResumenOperacionVentanilla {
  /** Radicados en la Bandeja de asignación. */
  porAsignar: number;
  /** Radicados con datos no aportados por el solicitante. */
  datosIncompletos: number;
  /** Notificaciones fallidas («Con errores» del Tablero). */
  conErrores: number;
  /** «Por vencer» del Tablero. */
  porVencer: number;
}

export interface VistaVentanillaProps {
  radicados: VentanillaRadicado[];
  puedeRadicar: boolean;
  onNuevaRadicacion: () => void;
  onAbrirBusquedaAvanzada: () => void;
  onAbrirRadicado: (radicadoId: string) => void;
  /** Sprint Radicación de salida — presente solo para roles que
   *  registran despachos; abre el modal de oficio independiente. */
  onRegistrarSalida?: () => void;
  /** Sprint Planilla de reparto — presente solo para Recepción/Admin;
   *  abre el panel de entrega de documentos físicos. */
  onAbrirReparto?: () => void;
  /** Hub: estado de la operación. Sin él, la vista es solo el mostrador. */
  resumenOperacion?: ResumenOperacionVentanilla;
  /** Hub: abre la Bandeja de asignación (solo con permiso de usarla). */
  onAbrirBandeja?: () => void;
  /** Hub: abre el Tablero con el filtro existente de ese estado. */
  onVerEnTablero?: (destino: DestinoTableroVentanilla) => void;
  /** Hub: abre el libro de salidas (solo con permiso de leerlo). */
  onAbrirSalidas?: () => void;
  /** Referencia temporal inyectable para tests deterministas. */
  ahora?: Date;
}

/**
 * Coincidencia de mostrador: radicado, cédula o nombre del ciudadano —
 * exactamente lo que promete el placeholder. Para todo lo demás está
 * la búsqueda avanzada.
 *
 * Delega el predicado en `coincideIdentidadFiltroRapido` (ADR-0012, R9):
 * un radicado con identidad reservada NO coincide por nombre ni
 * documento, solo por `radicadoId` — evita inferir su existencia
 * tecleando el nombre/documento del ciudadano.
 */
function coincideMostrador(r: VentanillaRadicado, q: string): boolean {
  return coincideIdentidadFiltroRapido(r, q);
}

export function VistaVentanilla({
  radicados,
  puedeRadicar,
  onNuevaRadicacion,
  onAbrirBusquedaAvanzada,
  onAbrirRadicado,
  onRegistrarSalida,
  onAbrirReparto,
  resumenOperacion,
  onAbrirBandeja,
  onVerEnTablero,
  onAbrirSalidas,
  ahora,
}: VistaVentanillaProps) {
  const [consulta, setConsulta] = useState('');
  const [filtroHoy, setFiltroHoy] = useState<FiltroTrabajoHoy>('TODOS');
  const q = consulta.toLowerCase().trim();

  const hoy = useMemo(
    () => trabajoDeHoy(radicados, ahora ?? new Date()),
    [radicados, ahora],
  );
  const filasVisibles = useMemo(
    () => filtrarTrabajoHoy(hoy.filas, filtroHoy),
    [hoy.filas, filtroHoy],
  );

  const fechaLegible = (ahora ?? new Date()).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
  });

  const resultados = useMemo(() => {
    if (!q) return [];
    return radicados.filter((r) => coincideMostrador(r, q)).slice(0, MAX_RESULTADOS);
  }, [radicados, q]);

  /* Enter abre el radicado si la coincidencia es inequívoca: id exacto
     o un único resultado. */
  const abrirCoincidenciaExacta = () => {
    const exacto = resultados.find((r) => r.radicadoId.toLowerCase() === q);
    const unico  = resultados.length === 1 ? resultados[0] : null;
    const destino = exacto ?? unico;
    if (destino) onAbrirRadicado(destino.radicadoId);
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      {/* ── Header del mostrador ── */}
      <SectionHeader
        titulo="Ventanilla · Atención al ciudadano"
        variante="default"
        indicador={
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: DORADO }} />
        }
        acciones={
          <>
            {onAbrirSalidas && (
              <BotonAccion Icono={BookOpen} onClick={onAbrirSalidas}>Libro de salidas</BotonAccion>
            )}
            {onAbrirReparto && (
              <BotonAccion Icono={ClipboardList} onClick={onAbrirReparto}>Reparto del día</BotonAccion>
            )}
            {onRegistrarSalida && (
              <BotonAccion Icono={Send} onClick={onRegistrarSalida}>Registrar salida</BotonAccion>
            )}
            {puedeRadicar && (
              <BotonAccion variante="destacada" Icono={Plus} onClick={onNuevaRadicacion}>Nueva radicación</BotonAccion>
            )}
          </>
        }
      />

      {/* ── Estado de la operación: tarjetas que llevan a donde se gestiona ── */}
      {resumenOperacion && (
        <div className="px-3 pt-1 pb-1 sm:px-4 lg:px-6">
          <FilaTarjetas etiqueta="Estado de la operación de recepción">
            <TarjetaIndicador
              etiqueta="Radicados hoy"
              valor={hoy.filas.length}
              descripcion="Recibidos hoy en la Ventanilla"
              tono="gris"
              Icono={Inbox}
            />
            <TarjetaIndicador
              etiqueta="Por asignar"
              valor={resumenOperacion.porAsignar}
              descripcion="En la bandeja de asignación"
              tono="ambar"
              Icono={UserRoundX}
              onAbrir={onAbrirBandeja}
              etiquetaAbrir="Abrir la bandeja de asignación"
            />
            <TarjetaIndicador
              etiqueta="Datos incompletos"
              valor={resumenOperacion.datosIncompletos}
              descripcion="Datos no aportados por el solicitante"
              tono="ambar"
              Icono={FileWarning}
              onAbrir={onVerEnTablero ? () => onVerEnTablero('DATOS_INCOMPLETOS') : undefined}
              etiquetaAbrir="Ver en el Tablero"
            />
            <TarjetaIndicador
              etiqueta="Con errores"
              valor={resumenOperacion.conErrores}
              descripcion="Notificaciones fallidas"
              tono="rojo"
              Icono={MailX}
              onAbrir={onVerEnTablero ? () => onVerEnTablero('CORREOS_FALLIDOS') : undefined}
              etiquetaAbrir="Ver en el Tablero"
            />
            <TarjetaIndicador
              etiqueta="Por vencer"
              valor={resumenOperacion.porVencer}
              descripcion="Próximos a vencer"
              tono="ambar"
              Icono={Clock3}
              onAbrir={onVerEnTablero ? () => onVerEnTablero('POR_VENCER') : undefined}
              etiquetaAbrir="Ver en el Tablero"
            />
          </FilaTarjetas>
        </div>
      )}

      {/* ── Búsqueda protagonista: la barra de trabajo del Tablero ── */}
      <BarraTrabajo
        busqueda={consulta}
        onBusquedaChange={setConsulta}
        placeholder="Radicado, expediente, cédula o nombre…"
        ariaLabel="Buscar radicado por número, cédula o nombre"
        onEnter={abrirCoincidenciaExacta}
        limpiable
      >
        <BotonAccion Icono={SlidersHorizontal} onClick={onAbrirBusquedaAvanzada} title="Búsqueda histórica y filtros avanzados">
          Búsqueda avanzada
        </BotonAccion>
      </BarraTrabajo>
      <p className="px-3 pt-1 text-[11px] sm:px-4 lg:px-6" style={{ color: 'var(--tema-texto-64748b)' }}>
        Un radicado completo abre el detalle con Enter
      </p>

      {/* ── Resultados de la consulta ── */}
      {q && (
        <div className="px-3 py-3 sm:px-4 lg:px-6">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--tema-texto-007049)' }}>
            {resultados.length === 0
              ? 'Sin coincidencias'
              : `${resultados.length} coincidencia${resultados.length === 1 ? '' : 's'}`}
          </p>
          {resultados.length > 0 && (
            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] overflow-hidden" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
              {resultados.map((r, i) => (
                <button
                  key={r.radicadoId}
                  type="button"
                  onClick={() => onAbrirRadicado(r.radicadoId)}
                  aria-label={`Abrir radicado ${r.radicadoId}`}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--tema-fondo-f4f8f4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700/30"
                  style={i > 0 ? { borderTop: '1px solid var(--tema-borde-eef2ee)' } : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[13px] font-bold truncate" style={{ color: 'var(--tema-texto-172033)' }}>
                      {r.radicadoId}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--tema-texto-5f6f64)' }}>
                      {nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}
                      {' · '}
                      {NOMBRES_TENANT[r.clasificacion.oficinaDestino] ?? r.clasificacion.oficinaDestino}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold shrink-0" style={{ color: VERDE_INST }}>
                    Abrir
                    <ArrowRight className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          )}
          {resultados.length === 0 && (
            <EmptyState
              titulo="Sin coincidencias"
              descripcion={`Nada con "${consulta.trim()}" en la bandeja actual. Prueba la búsqueda avanzada para el histórico completo.`}
            />
          )}
        </div>
      )}

      {/* ── Trabajo de hoy (oculto mientras se busca) ── */}
      {!q && (
        <div className="px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>
              Trabajo de hoy
            </span>
            <span className="text-[11px] truncate" style={{ color: 'var(--tema-texto-64748b)' }}>
              {fechaLegible} · {hoy.filas.length} radicado{hoy.filas.length === 1 ? '' : 's'}
            </span>
          </div>
          {hoy.filas.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Filtros de trabajo de hoy">
              <ChipFiltro
                etiqueta="Todos"
                valor={hoy.filas.length}
                activo={filtroHoy === 'TODOS'}
                onClick={() => setFiltroHoy('TODOS')}
                ariaLabel={`Filtrar trabajo de hoy: Todos (${hoy.filas.length})`}
              />
              {CHIPS_HOY.filter((c) => hoy.conteos[c.conteo] > 0).map((c) => (
                <ChipFiltro
                  key={c.id}
                  etiqueta={CHIP_PENDIENTE[c.id].label}
                  valor={hoy.conteos[c.conteo]}
                  tono={c.tono}
                  activo={filtroHoy === c.id}
                  onClick={() => setFiltroHoy(filtroHoy === c.id ? 'TODOS' : c.id)}
                  ariaLabel={`Filtrar trabajo de hoy: ${CHIP_PENDIENTE[c.id].label} (${hoy.conteos[c.conteo]})`}
                />
              ))}
            </div>
          )}

          {hoy.filas.length === 0 ? (
            <EmptyState
              titulo="Sin radicados hoy"
              descripcion="Hoy no se han radicado documentos. El primero del día aparecerá aquí con sus pendientes de recepción."
            />
          ) : (
            <div className="mt-2.5 rounded-xl bg-[var(--tema-fondo-ffffff)] overflow-hidden" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
              {filasVisibles.map((f, i) => (
                <FilaTrabajoHoyItem
                  key={f.radicadoId}
                  fila={f}
                  primera={i === 0}
                  onAbrir={() => onAbrirRadicado(f.radicadoId)}
                />
              ))}
              {filasVisibles.length === 0 && (
                <EmptyState
                  titulo="Sin resultados para este filtro"
                  descripcion="Ninguna fila coincide con el filtro elegido."
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Recordatorio de límites del módulo ── */}
      <p className="px-3 pb-3 text-[11px] sm:px-4 lg:px-6" style={{ color: 'var(--tema-texto-64748b)' }}>
        ¿Panorama del municipio y prioridades? Eso vive en el Tablero.
      </p>
    </div>
  );
}

function FilaTrabajoHoyItem({
  fila,
  primera,
  onAbrir,
}: {
  fila: FilaTrabajoHoy;
  primera: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Abrir radicado ${fila.radicadoId}`}
      /* Móvil: rejilla de dos líneas (las insignias bajan bajo el número y no
         lo estrujan). Desde `sm`: una sola línea, como siempre. */
      className="w-full grid grid-cols-[3px_2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 pr-3 text-left hover:bg-[var(--tema-fondo-f4f8f4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700/30 sm:flex"
      style={primera ? undefined : { borderTop: '1px solid var(--tema-borde-eef2ee)' }}
    >
      <span className="w-[3px] self-stretch shrink-0 row-span-2" style={{ background: rielFila(fila) }} />
      <span className="text-[11px] w-10 shrink-0 py-3 tabular-nums row-span-2 self-start sm:self-auto" style={{ color: 'var(--tema-texto-64748b)' }}>
        {fila.horaRadicado}
      </span>
      <span className="flex-1 min-w-0 py-2.5">
        <span className="block font-mono text-[13px] font-bold truncate" style={{ color: 'var(--tema-texto-172033)' }}>
          {fila.radicadoId}
        </span>
        <span className="block text-[11px] truncate" style={{ color: 'var(--tema-texto-5f6f64)' }}>
          {fila.tipoSolicitudNombre} · {NOMBRES_TENANT[fila.oficinaDestino] ?? fila.oficinaDestino}
        </span>
      </span>
      <span className="col-start-3 col-span-2 row-start-2 flex items-center gap-1.5 flex-wrap justify-start pb-2.5 shrink-0 sm:justify-end sm:pb-0">
        {fila.identidadReservada && (
          <StatusBadge tono="neutral" tamano="sm">Identidad reservada</StatusBadge>
        )}
        {fila.pendientes.map((p) => {
          const tonoMap: Record<PendienteMostrador, 'warning' | 'danger'> = {
            SELLAR_PDF: 'warning',
            DATOS_INCOMPLETOS: 'warning',
            CORREO_FALLIDO: 'danger',
            CONSTANCIA_SIN_ENVIAR: 'warning',
          };
          return (
            <StatusBadge key={p} tono={tonoMap[p]} tamano="sm">
              {CHIP_PENDIENTE[p].label}
            </StatusBadge>
          );
        })}
        {fila.pendientes.length === 0 && (
          <StatusBadge tono="success" tamano="sm">Al día</StatusBadge>
        )}
      </span>
      <span className="col-start-4 row-start-1 inline-flex items-center gap-1 text-[11.5px] font-semibold shrink-0" style={{ color: VERDE_INST }}>
        <span className="hidden sm:inline">Abrir</span>
        <ArrowRight className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
      </span>
    </button>
  );
}
