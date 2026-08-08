'use client';

/* ══════════════════════════════════════════════════════════════
   Detalle de Expediente — bloque "Integración UI y demo" (ADR-0029).

   Reemplaza `detalleLicencia()` (fixtures) por el contrato real
   `GET /api/licencias/expedientes/{id}` (expediente + actuaciones reales,
   asc por fecha). El panel de término reutiliza `proyectarVencimiento`
   (extraído de `fixtures.ts`, mismo cómputo dual REINICIO_A_CERO /
   SUSPENSION_REANUDACION que ya usaban los fixtures) — la única
   diferencia es de dónde vienen las `Actuacion[]`, tal como declaraba el
   JSDoc original de `fixtures.ts`.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ActuacionLicenciaDoc, ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { puedeTransicionar, type EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { atLocalNoon, diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { proyectarVencimiento, PLAZO_DIAS } from '../fixtures';
import { construirTimelineDesdeActuaciones } from '../presentacion-actuaciones';
import { nombreSubtipo } from '../presentacion-subtipos';
import { ChipEstadoJuridico } from '../components/ChipEstadoJuridico';
import { ChipPrueba } from '../components/ChipPrueba';
import { NumeroLegal } from '../components/NumeroLegal';
import { EventoTimeline } from '../components/EventoTimeline';
import { AvisoPoliticaSubsanacion } from '../components/AvisoPoliticaSubsanacion';
import { BotonAccionPlaceholder } from '../components/BotonAccionPlaceholder';
import { RegistrarActuacionModal } from '../components/RegistrarActuacionModal';

type EstadoCarga = 'cargando' | 'error' | 'no-encontrado' | 'listo';

/** Los dos tránsitos que esta pantalla puede disparar — mismo mapeo tipo→destino que `ESTADO_DESTINO_POR_TIPO_ACTUACION` en `lib/server/expedientes-licencias.ts` (no exportado; se declara aquí SOLO para decidir si el botón se muestra habilitado, la autoridad final sigue siendo el guard del servidor). */
const DESTINO_ACTA: EstadoJuridicoLicencia = 'CON_ACTA_DE_OBSERVACIONES';
const DESTINO_RESPUESTA: EstadoJuridicoLicencia = 'EN_VIABILIDAD';

export function DetalleLicenciaClient({ expedienteId }: { expedienteId: string }) {
  const { usuario, cargando: cargandoAuth } = useAuth();
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<ExpedienteLicenciaDoc | null>(null);
  const [actuaciones, setActuaciones] = useState<ActuacionLicenciaDoc[]>([]);
  const [modalActuacion, setModalActuacion] = useState<'acta-observaciones' | 'respuesta-subsanacion' | null>(null);

  const cargar = useCallback(async () => {
    setEstadoCarga('cargando');
    try {
      const res = await fetch(`/api/licencias/expedientes/${encodeURIComponent(expedienteId)}`, { credentials: 'include' });
      if (res.status === 404) {
        setEstadoCarga('no-encontrado');
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(body.error ?? 'No fue posible cargar el expediente.');
        setEstadoCarga('error');
        return;
      }
      setExpediente(body.expediente as ExpedienteLicenciaDoc);
      setActuaciones(Array.isArray(body.actuaciones) ? body.actuaciones : []);
      setEstadoCarga('listo');
    } catch {
      setErrorMsg('Error de red al cargar el expediente.');
      setEstadoCarga('error');
    }
  }, [expedienteId]);

  useEffect(() => {
    if (cargandoAuth || !usuario) return;
    void cargar();
  }, [cargandoAuth, usuario, cargar]);

  const yaHuboActa = actuaciones.some((a) => a.tipo === 'acta-observaciones');

  const proyeccion = useMemo(() => {
    if (!expediente || expediente.origen === 'RECONSTRUIDO') return null;
    const { eventos, vigente, ambiguo } = proyectarVencimiento(actuaciones);
    if (!vigente) return null;
    const radicacion = actuaciones.find((a) => a.tipo === 'radicacion-debida-forma');
    return {
      eventos,
      vigente,
      ambiguo,
      diasRestantes: diasRestantesHabiles(vigente),
      ancla: radicacion ? atLocalNoon(radicacion.fecha) : null,
    };
  }, [expediente, actuaciones]);

  const timeline = useMemo(
    () => (expediente ? construirTimelineDesdeActuaciones(actuaciones, expediente.origen, proyeccion?.vigente ?? null) : []),
    [expediente, actuaciones, proyeccion],
  );

  const progreso = proyeccion
    ? Math.min(100, Math.max(0, ((PLAZO_DIAS - proyeccion.diasRestantes) / PLAZO_DIAS) * 100))
    : 0;

  function alRegistrarActuacion(actuacion: ActuacionLicenciaDoc, nuevoEstadoJuridico: EstadoJuridicoLicencia) {
    setActuaciones((prev) => [...prev, actuacion]);
    setExpediente((prev) => (prev ? { ...prev, estadoJuridico: nuevoEstadoJuridico } : prev));
    setModalActuacion(null);
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
        <VolverBandeja />
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
        <VolverBandeja />
        <p role="alert" className="rounded-lg px-3 py-2 text-sm w-full" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {errorMsg ?? 'No fue posible cargar el expediente.'}
        </p>
      </div>
    );
  }

  const numero = expediente.numeroExpediente?.numero ?? expediente.id;
  const puedeRegistrarActa = puedeTransicionar(expediente.estadoJuridico, DESTINO_ACTA, { yaHuboActa });
  const puedeRegistrarRespuesta = yaHuboActa && puedeTransicionar(expediente.estadoJuridico, DESTINO_RESPUESTA, { yaHuboActa });

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1400px] mx-auto">
      <VolverBandeja />

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
          <Metadato label="Radicado de origen (Ventanilla)">
            {expediente.radicadoId ? <NumeroLegal value={expediente.radicadoId} variant="radicado" size="sm" /> : 'Sin vincular aún'}
          </Metadato>
          <Metadato label="Origen">{expediente.origen ?? 'REAL'}</Metadato>
          <Metadato label="Creado">{formatFechaColombia(expediente.creadoEn)}</Metadato>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* ── Panel término (o nota histórica) ── */}
        <div className="w-full lg:w-[430px] shrink-0 flex flex-col gap-3">
          {proyeccion ? (
            <>
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
              >
                <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                  Término para resolver
                </p>
                <p className="font-black mt-1" style={{ fontSize: 22, color: 'var(--text-primary)' }}>
                  Vence el {formatFechaColombia(proyeccion.vigente)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Quedan {proyeccion.diasRestantes} días hábiles de {PLAZO_DIAS}
                  {proyeccion.ancla && <> · ancla: radicación en debida forma ({formatFechaColombia(proyeccion.ancla)})</>}
                </p>
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(progreso)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso del término: ${Math.round(progreso)}%`}
                  className="mt-3 h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--bg-surface-2)' }}
                >
                  <div className="h-full rounded-full" style={{ width: `${progreso}%`, background: '#D97706' }} />
                </div>
              </div>

              <AvisoPoliticaSubsanacion eventos={proyeccion.eventos} plazoDias={PLAZO_DIAS} />

              <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!puedeRegistrarActa}
                  onClick={() => setModalActuacion('acta-observaciones')}
                  className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.98]"
                  style={{ background: '#D4A017', color: '#14532D', boxShadow: '0 2px 8px rgba(212,160,23,0.25)' }}
                >
                  Registrar acta de observaciones
                </button>
                {yaHuboActa && (
                  <button
                    type="button"
                    disabled={!puedeRegistrarRespuesta}
                    onClick={() => setModalActuacion('respuesta-subsanacion')}
                    className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.98]"
                    style={{ background: 'transparent', color: '#14532D', border: '1px solid #14532D' }}
                  >
                    Registrar respuesta de subsanación
                  </button>
                )}
                <BotonAccionPlaceholder
                  label="Emitir acto final"
                  variant="outline"
                  disabled
                  notaDeshabilitado="⚖️ emisión real pendiente de siembra autorizada (R10) y serie del acto (P3)"
                />
              </div>
            </>
          ) : (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {expediente.origen === 'RECONSTRUIDO'
                  ? 'Expediente histórico migrado — sin cómputo de término.'
                  : 'Sin radicación en debida forma registrada todavía — el término aún no arranca.'}
              </p>
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

      {modalActuacion && (
        <RegistrarActuacionModal
          expedienteId={expediente.id}
          tipo={modalActuacion}
          onCerrar={() => setModalActuacion(null)}
          onRegistrada={alRegistrarActuacion}
        />
      )}
    </div>
  );
}

function VolverBandeja() {
  return (
    <Link
      href="/interno/licencias"
      className="inline-flex items-center gap-1.5 text-sm font-medium w-fit rounded focus-visible:outline-none focus-visible:ring-2"
      style={{ color: '#14532D' }}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      Bandeja de Licencias
    </Link>
  );
}

function Metadato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <div className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>
        {children}
      </div>
    </div>
  );
}
