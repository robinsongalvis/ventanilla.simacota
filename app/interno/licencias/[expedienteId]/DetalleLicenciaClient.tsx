'use client';

/* ══════════════════════════════════════════════════════════════
   Detalle de Expediente — bloque "Integración UI y demo" (ADR-0029).

   Reemplaza `detalleLicencia()` (fixtures) por el contrato real
   `GET /api/licencias/expedientes/{id}` (expediente + actuaciones reales,
   asc por fecha).

   Bloque "Términos y vigencias protectores" (10-ago-2026): el panel de
   término, la vigencia del acto y el estado de plazo de subsanación YA NO
   se recalculan en el cliente — consumen `computos`/`borradorActoDesistimiento`
   tal como los devuelve el servidor (`PanelTerminoDual`, `PanelVigenciaActo`,
   `PanelDesistimientoSemicontrolado`, ver `../tipos-computos.ts`). Antes de
   este bloque, esta pantalla reutilizaba `proyectarVencimiento` (client-side,
   `fixtures.ts`) — se retiró para que el servidor sea la ÚNICA fuente de
   verdad del cómputo (evita que cliente y servidor diverjan sobre la misma
   fecha legal).
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RadicarDebidaFormaModal, type VistaPreviaDebidaForma } from '../components/RadicarDebidaFormaModal';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ActuacionLicenciaDoc, ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { puedeTransicionar, type EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import type { ContextoEvaluacionRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import { construirTimelineDesdeActuaciones } from '../presentacion-actuaciones';
import { nombreSubtipo } from '../presentacion-subtipos';
import { ESTILOS_ESTADO_JURIDICO } from '../estilos-estado-juridico';
import type { ComputosExpedienteUI, BorradorActoDesistimiento } from '../tipos-computos';
import { ChipEstadoJuridico } from '../components/ChipEstadoJuridico';
import { ChipPrueba } from '../components/ChipPrueba';
import { NumeroLegal } from '../components/NumeroLegal';
import { EventoTimeline } from '../components/EventoTimeline';
import { PanelTerminoDual } from '../components/PanelTerminoDual';
import { VincularRadicadoModal } from '../components/VincularRadicadoModal';
import { PanelVigenciaActo } from '../components/PanelVigenciaActo';
import { PanelDesistimientoSemicontrolado } from '../components/PanelDesistimientoSemicontrolado';
import { BotonAccionPlaceholder } from '../components/BotonAccionPlaceholder';
import { RegistrarActuacionModal } from '../components/RegistrarActuacionModal';
import { ChecklistRequisitos } from '../components/ChecklistRequisitos';

type EstadoCarga = 'cargando' | 'error' | 'no-encontrado' | 'listo';

/**
 * Registro de Definiciones de Trámite conocidas por el CLIENTE — Bloque
 * A·A3. Hoy solo hay una sembrada (`DEFINICION_LICENCIA_CONSTRUCCION_
 * PARCIAL`, dato puro importable, ver su propio JSDoc); el servidor
 * (`GET .../[id]`) devuelve `definicionId` como STRING, no el objeto — la
 * UI resuelve aquí. Cuando exista resolución dinámica de Definiciones por
 * `tramiteId` (Fase 1, fuera de este bloque), este registro se reemplaza
 * por esa fuente sin tocar `ChecklistRequisitos` (recibe `DefinicionTramite`
 * ya resuelta, no un id).
 */
const DEFINICIONES_CONOCIDAS: Record<string, DefinicionTramite> = {
  [DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id]: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL,
};

/** Los dos tránsitos que esta pantalla puede disparar — mismo mapeo tipo→destino que `ESTADO_DESTINO_POR_TIPO_ACTUACION` en `lib/server/expedientes-licencias.ts` (no exportado; se declara aquí SOLO para decidir si el botón se muestra habilitado, la autoridad final sigue siendo el guard del servidor). */
const DESTINO_ACTA: EstadoJuridicoLicencia = 'CON_ACTA_DE_OBSERVACIONES';
const DESTINO_RESPUESTA: EstadoJuridicoLicencia = 'EN_VIABILIDAD';

export interface DetalleLicenciaClientProps {
  expedienteId: string;
  /**
   * Bloque B ("la ventanita") — cuando el Detalle se monta EMBEBIDO dentro
   * de `VistaLicencias` (`app/interno/dashboard/components/licencias/
   * VistaLicencias.tsx`), "← Bandeja de Licencias" es un cambio de estado
   * local del panel (volver a `expedienteSeleccionado = null`), no una
   * navegación de ruta. Si se recibe, `VolverBandeja` renderiza un botón
   * que llama esto en vez de `<Link href="/interno/licencias">`. Sin esta
   * prop (ruta standalone `/interno/licencias/{id}`) el comportamiento es
   * exactamente el de antes: `<Link>`.
   */
  onVolver?: () => void;
}

export function DetalleLicenciaClient({ expedienteId, onVolver }: DetalleLicenciaClientProps) {
  const { usuario, cargando: cargandoAuth } = useAuth();
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<ExpedienteLicenciaDoc | null>(null);
  const [actuaciones, setActuaciones] = useState<ActuacionLicenciaDoc[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoExpedienteDoc[]>([]);
  const [definicionId, setDefinicionId] = useState<string | null>(null);
  const [radicadoVinculado, setRadicadoVinculado] = useState<{ id: string; fecha: string } | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [modalActuacion, setModalActuacion] = useState<'acta-observaciones' | 'respuesta-subsanacion' | null>(null);
  const [modalRadicar, setModalRadicar] = useState(false);
  /** Bloque "Términos y vigencias protectores" (10-ago-2026) — `computos`/`borradorActoDesistimiento` YA CALCULADOS por el servidor (`GET .../[id]`), ver `../tipos-computos.ts`. */
  const [computos, setComputos] = useState<ComputosExpedienteUI | null>(null);
  /* La vista previa del acto de radicar. La ruta la devolvía desde #248 y nadie
     la consumía: el acto estaba construido y era inalcanzable desde el
     mostrador. */
  const [debidaForma, setDebidaForma] = useState<VistaPreviaDebidaForma | null>(null);
  const [borradorActoDesistimiento, setBorradorActoDesistimiento] = useState<BorradorActoDesistimiento | null>(null);

  /**
   * `opts.silencioso`: recarga tras una subida de documento (checklist) SIN
   * pasar por `estadoCarga: 'cargando'` — evita que el detalle entero
   * parpadee a la pantalla de carga cada vez que el funcionario sube un
   * papel (Bloque A·A3). Si la recarga silenciosa falla, se deja el último
   * estado bueno en pantalla en vez de reemplazarlo por una pantalla de
   * error — la subida en sí YA se confirmó con el funcionario (el propio
   * control de carga mostró su resultado); solo el refresco posterior no
   * llegó, y el próximo cambio (o recargar la página) lo reintenta.
   */
  const cargar = useCallback(async (opts?: { silencioso?: boolean }) => {
    const silencioso = opts?.silencioso ?? false;
    if (!silencioso) setEstadoCarga('cargando');
    try {
      const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}`, { credentials: 'include' });
      if (res.status === 404) {
        if (!silencioso) setEstadoCarga('no-encontrado');
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silencioso) {
          setErrorMsg(body.error ?? 'No fue posible cargar el expediente.');
          setEstadoCarga('error');
        }
        return;
      }
      setExpediente(body.expediente as ExpedienteLicenciaDoc);
      setActuaciones(Array.isArray(body.actuaciones) ? body.actuaciones : []);
      setDocumentos(Array.isArray(body.documentos) ? body.documentos : []);
      setDefinicionId(typeof body.definicionId === 'string' ? body.definicionId : null);
      setRadicadoVinculado(
        body.radicadoVinculado && typeof body.radicadoVinculado.fecha === 'string'
          ? { id: String(body.radicadoVinculado.id), fecha: body.radicadoVinculado.fecha }
          : null,
      );
      setComputos(body.computos && typeof body.computos === 'object' ? (body.computos as ComputosExpedienteUI) : null);
      setDebidaForma(
        body.debidaForma && typeof body.debidaForma === 'object'
          ? (body.debidaForma as VistaPreviaDebidaForma)
          : null,
      );
      setBorradorActoDesistimiento(
        body.borradorActoDesistimiento && typeof body.borradorActoDesistimiento === 'object'
          ? (body.borradorActoDesistimiento as BorradorActoDesistimiento)
          : null,
      );
      if (!silencioso) setEstadoCarga('listo');
    } catch {
      if (!silencioso) {
        setErrorMsg('Error de red al cargar el expediente.');
        setEstadoCarga('error');
      }
    }
  }, [expedienteId]);

  useEffect(() => {
    if (cargandoAuth || !usuario) return;
    void cargar();
  }, [cargandoAuth, usuario, cargar]);

  const yaHuboActa = actuaciones.some((a) => a.tipo === 'acta-observaciones');
  const esHistorico = expediente?.origen === 'RECONSTRUIDO';

  /** ISO de la primera `radicacion-debida-forma` — solo referencia del ancla para `PanelTerminoDual`, nunca insumo de cómputo (eso ya lo hizo el servidor). */
  const fechaRadicacion = actuaciones.find((a) => a.tipo === 'radicacion-debida-forma')?.fecha;

  /**
   * "Vencimiento calculado" del timeline usa `fechaAlertaConservadora`
   * (`computos.terminoDual`, servidor) — la MISMA fecha que ya destaca
   * `PanelTerminoDual` con la alerta roja, nunca una recomputada aparte en
   * el cliente (única fuente de verdad para el término). La dependencia del
   * `useMemo` es el ISO (primitivo estable), no el `Date` construido abajo
   * — un `Date` nuevo en cada render invalidaría la memoización.
   */
  const fechaAlertaConservadoraIso = computos?.terminoDual.fechaAlertaConservadora ?? null;

  const timeline = useMemo(() => {
    if (!expediente) return [];
    const vigenteParaTimeline = fechaAlertaConservadoraIso ? new Date(fechaAlertaConservadoraIso) : null;
    return construirTimelineDesdeActuaciones(actuaciones, expediente.origen, vigenteParaTimeline);
  }, [expediente, actuaciones, fechaAlertaConservadoraIso]);

  function alRegistrarActuacion(actuacion: ActuacionLicenciaDoc, nuevoEstadoJuridico: EstadoJuridicoLicencia) {
    setActuaciones((prev) => [...prev, actuacion]);
    setExpediente((prev) => (prev ? { ...prev, estadoJuridico: nuevoEstadoJuridico } : prev));
    setModalActuacion(null);
  }

  /**
   * El PATCH de `.../contexto` ya devuelve el `contexto` MERGEADO
   * (`planActualizarContexto`, `lib/server/expedientes-licencias.ts`) — se
   * aplica directo al expediente en memoria, sin recargar todo el detalle
   * (los `aportes`/`documentos` no cambian al editar un hecho del caso).
   */
  function alActualizarContexto(nuevoContexto: ContextoEvaluacionRequisito) {
    setExpediente((prev) => (prev ? { ...prev, contexto: nuevoContexto } : prev));
  }

  /** La subida de documento (D7) solo confirma ids/metadatos, no el `DocumentoExpedienteDoc` completo — se recarga en silencio para reflejar la versión/aporte reales que persistió el servidor. */
  function alSubirDocumento() {
    void cargar({ silencioso: true });
  }

  if (estadoCarga === 'cargando' || cargandoAuth) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cargando expediente…</p>
      </div>
    );
  }

  if (estadoCarga === 'no-encontrado') {
    return (
      <div className="p-4 md:p-6 max-w-[720px] mx-auto flex flex-col items-start gap-3">
        <VolverBandeja onVolver={onVolver} />
        <div className="rounded-xl p-5 w-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}>
          <h1 className="font-headline text-xl" style={{ color: 'var(--text-primary)' }}>Expediente no encontrado</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            No existe un expediente con este identificador, o fue eliminado.
          </p>
        </div>
      </div>
    );
  }

  if (estadoCarga === 'error' || !expediente) {
    return (
      <div className="p-4 md:p-6 max-w-[720px] mx-auto flex flex-col items-start gap-3">
        <VolverBandeja onVolver={onVolver} />
        <p role="alert" className="rounded-lg px-3 py-2 text-sm w-full" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {errorMsg ?? 'No fue posible cargar el expediente.'}
        </p>
      </div>
    );
  }

  const numero = expediente.numeroExpediente?.numero ?? expediente.id;
  const puedeRegistrarActa = puedeTransicionar(expediente.estadoJuridico, DESTINO_ACTA, { yaHuboActa });
  const puedeRegistrarRespuesta = yaHuboActa && puedeTransicionar(expediente.estadoJuridico, DESTINO_RESPUESTA, { yaHuboActa });

  // Motivo del bloqueo — MISMO patrón que `notaDeshabilitado` de
  // `BotonAccionPlaceholder` ("Emitir acto final", abajo), pero para
  // botones de acción REAL: el motivo se deriva del propio estado
  // jurídico actual (`ESTILOS_ESTADO_JURIDICO[...].label`, la única fuente
  // de etiquetas legibles del dominio) — nunca se inventa un estado o una
  // condición que el motor no exprese.
  const etiquetaEstadoActual = ESTILOS_ESTADO_JURIDICO[expediente.estadoJuridico].label;
  const notaActaDeshabilitada = puedeRegistrarActa
    ? undefined
    : yaHuboActa
      ? 'El acta procede por una sola vez (D.1077/2015 art. 2.2.6.1.2.2.4) — ya fue registrada en este expediente.'
      : `El acta solo procede con el expediente en revisión — estado actual: "${etiquetaEstadoActual}".`;
  const notaRespuestaDeshabilitada = puedeRegistrarRespuesta
    ? undefined
    : `La respuesta de subsanación solo procede con el expediente "con acta de observaciones" — estado actual: "${etiquetaEstadoActual}".`;

  // Checklist (Bloque A·A3) — solo-lectura para histórico migrado (no se
  // "aporta" a un expediente reconstruido) o expediente ya EN_FIRME (mismo
  // candado que aplica el propio servidor en `POST .../documentos`, 409).
  const definicion = definicionId ? DEFINICIONES_CONOCIDAS[definicionId] : undefined;
  const soloLecturaChecklist = expediente.origen === 'RECONSTRUIDO' || expediente.estadoJuridico === 'EN_FIRME';
  const motivoSoloLecturaChecklist =
    expediente.origen === 'RECONSTRUIDO'
      ? 'Expediente histórico migrado — no admite nuevos aportes.'
      : expediente.estadoJuridico === 'EN_FIRME'
        ? 'Expediente en firme — no admite nuevos aportes.'
        : undefined;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1400px] mx-auto">
      {/* Todo el "chrome" de pantalla vive dentro de este contenedor
          `print:hidden` — al imprimir (botón "Imprimir" del proyecto de
          acto de desistimiento, más abajo) solo debe salir la vista limpia
          del final, nunca la bandeja de botones ni los demás paneles. */}
      <div className="print:hidden flex flex-col gap-5">
      <VolverBandeja onVolver={onVolver} />

      {/* ── Tarjeta encabezado ── */}
      <div
        className="rounded-xl p-4 md:p-5 flex flex-col gap-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <NumeroLegal value={numero} variant="expediente" size="lg" />
          {expediente.esPrueba && <ChipPrueba />}
          <ChipEstadoJuridico estado={expediente.estadoJuridico} />
          <div className="flex flex-wrap gap-1.5">
            {(expediente.subtipos ?? []).map((codigo) => (
              <span
                key={codigo}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
              >
                {nombreSubtipo(codigo)}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <Metadato label="Solicitante">
            {expediente.solicitanteNombre}
            <span style={{ color: 'var(--text-secondary)' }}> · {expediente.solicitanteDocumento}</span>
          </Metadato>
          <Metadato label="Radicado de origen (Ventanilla)" truncar={false}>
            {expediente.radicadoId ? (
              <span className="flex flex-col gap-0.5">
                <NumeroLegal value={expediente.radicadoId} variant="radicado" size="sm" />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {radicadoVinculado?.fecha
                    ? `Vinculado el ${formatFechaColombia(radicadoVinculado.fecha)}`
                    : 'Fecha de vinculación no disponible'}
                </span>
              </span>
            ) : (
              // El expediente nació sin radicado («Radicar solicitud»).
              // Antes esto era un callejón sin salida permanente; ahora se
              // puede reparar desde aquí mismo.
              <span className="flex flex-col items-start gap-1">
                <span>Sin vincular aún</span>
                <button
                  type="button"
                  onClick={() => setVinculando(true)}
                  className="text-xs font-bold underline focus-visible:outline-none focus-visible:ring-2 rounded"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Vincular radicado de Ventanilla
                </button>
              </span>
            )}
          </Metadato>
          <Metadato label="Origen">{expediente.origen ?? 'REAL'}</Metadato>
          <Metadato label="Creado">{formatFechaColombia(expediente.creadoEn)}</Metadato>
        </div>
      </div>

      {/* ── Estado de plazo de subsanación (desistimiento SEMICONTROLADO) ──
          Se muestra ANTES del resto del detalle cuando es crítico
          (POR_ARCHIVAR): el funcionario debe verlo de inmediato. Cuando
          EN_PLAZO, es una línea discreta; cuando NO_APLICA, no renderiza
          nada (`PanelDesistimientoSemicontrolado`). */}
      {computos && (
        <PanelDesistimientoSemicontrolado
          plazoSubsanacion={computos.plazoSubsanacion}
          borrador={borradorActoDesistimiento}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* ── Panel término (doble fecha) + vigencia + acciones ── */}
        <div className="w-full lg:w-[430px] shrink-0 flex flex-col gap-3">
          <PanelTerminoDual
            terminoDual={computos?.terminoDual ?? { suspension: null, reinicio: null, fechaAlertaConservadora: null }}
            origen={expediente.origen}
            estadoJuridico={expediente.estadoJuridico}
            fechaRadicacion={fechaRadicacion}
          />

          {computos?.vigencia !== undefined && <PanelVigenciaActo vigencia={computos.vigencia} />}

          {!esHistorico && (
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-start">
              {/* EL ACTO DE RADICAR. Va primero porque es el que abre el
                  expediente al término legal; todo lo demás ocurre después de
                  él. El motivo por el que no procede sale del SERVIDOR y se
                  muestra entero: hoy el más frecuente es que el expediente es
                  de demostración, el candado que protege la serie legal. */}
              {debidaForma && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={!debidaForma.procede}
                    onClick={() => setModalRadicar(true)}
                    aria-describedby={!debidaForma.procede ? 'radicar-nota' : undefined}
                    className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.98]"
                    style={{ background: '#14532D', color: '#fff', boxShadow: '0 2px 8px rgba(20,83,45,0.25)' }}
                  >
                    Radicar en legal y debida forma
                  </button>
                  {!debidaForma.procede && debidaForma.motivo && (
                    <p id="radicar-nota" className="text-xs max-w-xs" style={{ color: '#9A6206' }}>
                      {debidaForma.motivo}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={!puedeRegistrarActa}
                  onClick={() => setModalActuacion('acta-observaciones')}
                  aria-describedby={notaActaDeshabilitada ? 'registrar-acta-nota' : undefined}
                  className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.98]"
                  style={{ background: '#D4A017', color: '#14532D', boxShadow: '0 2px 8px rgba(212,160,23,0.25)' }}
                >
                  Registrar acta de observaciones
                </button>
                {notaActaDeshabilitada && (
                  <p id="registrar-acta-nota" className="text-xs" style={{ color: '#9A6206' }}>
                    {notaActaDeshabilitada}
                  </p>
                )}
              </div>
              {yaHuboActa && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={!puedeRegistrarRespuesta}
                    onClick={() => setModalActuacion('respuesta-subsanacion')}
                    aria-describedby={notaRespuestaDeshabilitada ? 'registrar-respuesta-nota' : undefined}
                    className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.98]"
                    style={{ background: 'transparent', color: '#14532D', border: '1px solid #14532D' }}
                  >
                    Registrar respuesta de subsanación
                  </button>
                  {notaRespuestaDeshabilitada && (
                    <p id="registrar-respuesta-nota" className="text-xs" style={{ color: '#9A6206' }}>
                      {notaRespuestaDeshabilitada}
                    </p>
                  )}
                </div>
              )}
              <BotonAccionPlaceholder
                label="Emitir acto final"
                variant="outline"
                disabled
                notaDeshabilitado="⚖️ emisión real pendiente de siembra autorizada (R10) y serie del acto (P3)"
              />
            </div>
          )}
        </div>

        {/* ── Panel historial ── */}
        <div
          className="flex-1 min-w-0 rounded-xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
            Historial del expediente{' '}
            <span className="normal-case font-normal">(los eventos son los hechos; el vencimiento se calcula)</span>
          </p>
          <EventoTimeline eventos={timeline} />
        </div>
      </div>

      {/* ── Checklist de requisitos ── */}
      {definicion ? (
        <ChecklistRequisitos
          expedienteId={expediente.id}
          definicion={definicion}
          contexto={expediente.contexto ?? {}}
          aportes={expediente.aportes ?? []}
          documentos={documentos}
          soloLectura={soloLecturaChecklist}
          motivoSoloLectura={motivoSoloLecturaChecklist}
          onContextoActualizado={alActualizarContexto}
          onDocumentoSubido={alSubirDocumento}
        />
      ) : definicionId ? (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Definición de trámite &quot;{definicionId}&quot; no reconocida — no es posible mostrar el checklist.
          </p>
        </div>
      ) : null}

      {modalRadicar && debidaForma && (
        <RadicarDebidaFormaModal
          expedienteId={expedienteId}
          previa={debidaForma}
          onCerrar={() => setModalRadicar(false)}
          /* Recarga en silencio: tras el acto el expediente cambia de estado,
             gana una actuación y estrena número. */
          onRadicado={() => cargar({ silencioso: true })}
        />
      )}

      {modalActuacion && (
        <RegistrarActuacionModal
          expedienteId={expediente.id}
          tipo={modalActuacion}
          onCerrar={() => setModalActuacion(null)}
          onRegistrada={alRegistrarActuacion}
        />
      )}
      </div>

      {/* ── Vista SOLO impresión: proyecto de acto de desistimiento ──
          Sibling del contenedor `print:hidden` de arriba (nunca anidada
          dentro de él: un ancestro `display:none` oculta cualquier
          descendiente sin importar su propio `display`). El botón
          "Imprimir" de `PanelDesistimientoSemicontrolado` dispara
          `window.print()` sobre ESTA vista limpia — sin sidebar, sin
          botones, sin el resto de paneles del detalle. */}
      {borradorActoDesistimiento && (
        <div className="hidden print:block">
          <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0f172a' }}>
            Expediente {numero}
          </p>
          <h1 className="font-headline text-xl mt-1 mb-4" style={{ color: '#0f172a' }}>
            {borradorActoDesistimiento.titulo}
          </h1>
          <div className="text-sm whitespace-pre-wrap" style={{ color: '#0f172a', lineHeight: 1.6 }}>
            {borradorActoDesistimiento.cuerpo}
          </div>
        </div>
      )}

      {/* Reparación del expediente huérfano — ver `VincularRadicadoModal`. */}
      {vinculando && (
        <VincularRadicadoModal
          expedienteId={expedienteId}
          onCerrar={() => setVinculando(false)}
          onVinculado={() => {
            setVinculando(false);
            void cargar({ silencioso: true });
          }}
        />
      )}
    </div>
  );
}

function VolverBandeja({ onVolver }: { onVolver?: () => void }) {
  const className = 'inline-flex items-center gap-1.5 text-sm font-medium w-fit rounded focus-visible:outline-none focus-visible:ring-2';
  const contenido = (
    <>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      Bandeja de Licencias
    </>
  );
  if (onVolver) {
    return (
      <button type="button" onClick={onVolver} className={className} style={{ color: '#14532D' }}>
        {contenido}
      </button>
    );
  }
  return (
    <Link href="/interno/licencias" className={className} style={{ color: '#14532D' }}>
      {contenido}
    </Link>
  );
}

function Metadato({
  label,
  children,
  truncar = true,
}: {
  label: string;
  children: ReactNode;
  /** `false` cuando el contenido necesita más de una línea (p. ej. radicado + fecha de vinculación) — el resto de metadatos sigue truncando a una línea. */
  truncar?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <div className={`text-sm mt-0.5 ${truncar ? 'truncate' : ''}`} style={{ color: 'var(--text-primary)' }}>
        {children}
      </div>
    </div>
  );
}
