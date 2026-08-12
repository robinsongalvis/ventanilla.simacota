'use client';

/* ══════════════════════════════════════════════════════════════
   Panel lateral de detalle — rediseño del Libro Consecutivo (10-ago-2026).

   Vista RESUMEN de solo lectura: se abre al hacer clic en una fila de la
   tabla, hace su propio `fetch` a `GET /api/licencias/expedientes/{id}`
   (el MISMO contrato que ya consume `DetalleLicenciaClient` — `computos`,
   `actuaciones`, `documentos` incluidos) y reutiliza sus mismos paneles de
   presentación (`PanelTerminoDual`, `PanelVigenciaActo`, `EventoTimeline`)
   en vez de reimplementarlos. NO reemplaza la pantalla de Detalle completa
   ("Ver expediente completo →" enlaza a `/interno/licencias/{id}"): este
   panel no registra actuaciones ni sube documentos, es una consulta rápida
   sin salir del Libro.

   Dependencia declarada (para Backend/Datos, no implementada aquí): no
   existe hoy ningún campo estructurado de PREDIO (dirección, matrícula
   inmobiliaria, cédula catastral) en `ExpedienteLicenciaDoc` ni en las
   `clavesContexto` de la única Definición sembrada (`esApoderado`,
   `categoriaComplejidad`, `sujetoTituloENSR10`, `predioRodeadoEspacioPublico`
   — todas atributos de EVALUACIÓN de requisitos, no identificación del
   predio). Esta sección muestra el `contexto` real tal como existe, bajo
   el título "Datos del trámite" — nunca se inventa una dirección o
   matrícula que el modelo no tiene.

   Accesibilidad (regla dura del encargo): `role="dialog"` + `aria-modal`,
   foco atrapado dentro del panel (Tab/Shift+Tab no se escapan a la página
   de atrás), Escape cierra, y el foco vuelve al control que abrió el panel
   al desmontarse — ningún modal existente en el módulo hace las tres cosas
   juntas todavía (`RegistrarActuacionModal` solo maneja Escape), así que
   se implementa aquí en vez de copiar un patrón parcial.
══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { ActuacionLicenciaDoc, ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { formatFechaColombia, formatFechaHoraColombia } from '@/lib/fecha-colombia';
import type { ComputosExpedienteUI } from '../tipos-computos';
import { construirTimelineDesdeActuaciones } from '../presentacion-actuaciones';
import { subtiposConEstadoLibro } from '../presentacion-libro-consecutivo';
import { ChipEstadoJuridico } from './ChipEstadoJuridico';
import { ChipPrueba } from './ChipPrueba';
import { NumeroLegal } from './NumeroLegal';
import { EventoTimeline } from './EventoTimeline';
import { PanelTerminoDual } from './PanelTerminoDual';
import { PanelVigenciaActo } from './PanelVigenciaActo';

export interface PanelDetalleExpedienteProps {
  expedienteId: string;
  onCerrar: () => void;
}

type EstadoCargaPanel = 'cargando' | 'error' | 'listo';

/** Selector de elementos enfocables dentro del panel — mismo criterio estándar usado por implementaciones de focus-trap (enlaces con `href`, controles no deshabilitados, `tabindex` explícito no-negativo). */
const SELECTOR_FOCUSABLES = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function PanelDetalleExpediente({ expedienteId, onCerrar }: PanelDetalleExpedienteProps) {
  const [estadoCarga, setEstadoCarga] = useState<EstadoCargaPanel>('cargando');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<ExpedienteLicenciaDoc | null>(null);
  const [actuaciones, setActuaciones] = useState<ActuacionLicenciaDoc[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoExpedienteDoc[]>([]);
  const [computos, setComputos] = useState<ComputosExpedienteUI | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const cerrarBtnRef = useRef<HTMLButtonElement | null>(null);
  const elementoPrevioRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelado = false;
    setEstadoCarga('cargando');
    setErrorMsg(null);
    void (async () => {
      try {
        const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}`, { credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (!res.ok) {
          setErrorMsg(res.status === 404 ? 'Expediente no encontrado.' : (body.error ?? 'No fue posible cargar el expediente.'));
          setEstadoCarga('error');
          return;
        }
        setExpediente(body.expediente as ExpedienteLicenciaDoc);
        setActuaciones(Array.isArray(body.actuaciones) ? body.actuaciones : []);
        setDocumentos(Array.isArray(body.documentos) ? body.documentos : []);
        setComputos(body.computos && typeof body.computos === 'object' ? (body.computos as ComputosExpedienteUI) : null);
        setEstadoCarga('listo');
      } catch {
        if (!cancelado) {
          setErrorMsg('Error de red al cargar el expediente.');
          setEstadoCarga('error');
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [expedienteId]);

  // Foco atrapado + devuelto — efecto SEPARADO del fetch (debe correr una
  // sola vez por apertura del panel, no en cada recarga de `expedienteId`).
  // Captura el elemento activo ANTES de mover el foco (es el control de la
  // fila que abrió el panel) y lo restaura al desmontar.
  useEffect(() => {
    elementoPrevioRef.current = document.activeElement as HTMLElement | null;
    cerrarBtnRef.current?.focus();
    return () => {
      elementoPrevioRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCerrar();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focosables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLES)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focosables.length === 0) return;
      const primero = focosables[0];
      const ultimo = focosables[focosables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCerrar]);

  const fechaRadicacion = actuaciones.find((a) => a.tipo === 'radicacion-debida-forma')?.fecha;
  const fechaAlertaConservadoraIso = computos?.terminoDual.fechaAlertaConservadora ?? null;

  const timeline = useMemo(() => {
    if (!expediente) return [];
    const vigenteParaTimeline = fechaAlertaConservadoraIso ? new Date(fechaAlertaConservadoraIso) : null;
    return construirTimelineDesdeActuaciones(actuaciones, expediente.origen, vigenteParaTimeline);
  }, [expediente, actuaciones, fechaAlertaConservadoraIso]);

  const subtipos = useMemo(() => subtiposConEstadoLibro(expediente?.subtipos ?? []), [expediente]);
  const contextoEntradas = useMemo(() => Object.entries(expediente?.contexto ?? {}), [expediente]);

  const numero = expediente?.numeroExpediente?.numero ?? expediente?.id ?? expedienteId;
  const tituloId = 'panel-detalle-expediente-titulo';

  return (
    <>
      {/* Fondo — `div` con `onClick`, NO `button`: no debe ser alcanzable
          por Tab (mismo patrón que `BusquedaAvanzadaPanel`) para que el
          trampolín de foco de abajo no tenga que lidiar con un elemento
          enfocable FUERA del panel. Escape ya cubre el cierre por teclado. */}
      <div aria-hidden="true" onClick={onCerrar} className="fixed inset-0 z-40 print:hidden" style={{ background: 'rgba(15,23,20,0.45)' }} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] md:w-[460px] flex flex-col print:hidden"
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: 'var(--shadow-elevated)' }}
      >
        <header className="flex items-start justify-between gap-3 px-4 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="min-w-0 flex flex-col gap-2">
            <h2 id={tituloId} className="sr-only">
              Expediente {numero}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <NumeroLegal value={numero} variant="expediente" size="md" />
              {expediente?.esPrueba && <ChipPrueba />}
              {expediente && <ChipEstadoJuridico estado={expediente.estadoJuridico} />}
            </div>
            {subtipos.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {subtipos.map((s) => (
                  <span
                    key={s.codigo}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={
                      s.enCuarentena
                        ? { background: 'var(--color-warning)', color: '#4A2E02', opacity: 0.85 }
                        : { background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }
                    }
                    title={s.enCuarentena ? 'Subtipo histórico pendiente de identificar' : undefined}
                  >
                    {s.enCuarentena ? '? ' : ''}
                    {s.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            ref={cerrarBtnRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar panel de expediente"
            className="shrink-0 rounded-lg p-1.5 focus-visible:outline-none focus-visible:ring-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {estadoCarga === 'cargando' && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Cargando expediente…
            </p>
          )}

          {estadoCarga === 'error' && (
            <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
              {errorMsg}
            </p>
          )}

          {estadoCarga === 'listo' && expediente && (
            <>
              <Link
                href={`/interno/licencias/${expediente.id}`}
                className="self-start text-xs font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 rounded"
                style={{ color: 'var(--color-primary)' }}
              >
                Ver expediente completo →
              </Link>

              <Seccion titulo="Solicitante">
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{expediente.solicitanteNombre}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{expediente.solicitanteDocumento || 'Sin cédula registrada'}</p>
              </Seccion>

              <Seccion titulo="Datos del trámite">
                {contextoEntradas.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Sin datos de contexto adicionales registrados para este expediente.
                  </p>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {contextoEntradas.map(([clave, valor]) => (
                      <div key={clave} className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: 'var(--text-secondary)' }}>
                          {clave}
                        </dt>
                        <dd className="text-xs" style={{ color: 'var(--text-primary)' }}>
                          {String(valor)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Radicado de origen:{' '}
                  {expediente.radicadoId ? <NumeroLegal value={expediente.radicadoId} variant="radicado" size="sm" /> : 'sin vincular'}
                  {' · '}Creado el {formatFechaColombia(expediente.creadoEn)}
                </p>
              </Seccion>

              <PanelTerminoDual
                terminoDual={computos?.terminoDual ?? { suspension: null, reinicio: null, fechaAlertaConservadora: null }}
                origen={expediente.origen}
                estadoJuridico={expediente.estadoJuridico}
                fechaRadicacion={fechaRadicacion}
              />

              {computos?.vigencia !== undefined && <PanelVigenciaActo vigencia={computos.vigencia} />}

              <Seccion titulo="Historial del expediente">
                <EventoTimeline eventos={timeline} />
              </Seccion>

              <Seccion titulo="Documentos">
                {documentos.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sin documentos cargados todavía.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {documentos.map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="truncate max-w-full font-medium" style={{ color: 'var(--text-primary)' }}>{doc.nombre}</span>
                        <span className="shrink-0 font-mono" style={{ color: 'var(--text-secondary)' }}>v{doc.versionVigente.numeroVersion}</span>
                        <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{formatFechaHoraColombia(doc.versionVigente.subidoEn)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Seccion>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}>
      <p className="text-[10.5px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
        {titulo}
      </p>
      {children}
    </div>
  );
}
