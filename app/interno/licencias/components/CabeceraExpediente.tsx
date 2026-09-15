'use client';

import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import type { TenantId } from '@/src/types/radicado';
import { describirTramiteDesdeSubtipos } from '@/lib/motor-expedientes/describir-tramite';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { rotuloDeSerie } from '@/lib/motor-expedientes/numeros-del-expediente';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import { leerElTermino } from '@/lib/motor-expedientes/lectura-del-termino';
import { COLOR_NIVEL_TERMINO } from '@/lib/motor-expedientes/semaforo-termino';
import { ESTILOS_ESTADO_JURIDICO } from '../estilos-estado-juridico';
import { PASOS, situacionDePaso } from '../camino-del-tramite';
import type { TerminoDualUI } from '../tipos-computos';

/* ══════════════════════════════════════════════════════════════
   CABECERA DEL EXPEDIENTE — tres zonas: quién, en qué estado, y el plazo.

   Todo lo que muestra sale de fuentes que YA existen, sin recalcular ni
   redactar nada nuevo:
    · la figura, de `describirTramiteDesdeSubtipos` (la de los papeles);
    · la dependencia, de `DIRECTORIO_TENANTS` (la del directorio oficial);
    · el estado y su color, de `ESTILOS_ESTADO_JURIDICO`;
    · la descripción del estado, de la fase ACTUAL del camino (`situacionDePaso`);
    · el plazo (vence, días restantes, día X de N, semáforo), de `leerElTermino`
      —la MISMA función que alimenta el panel del término y la proyección de
      ventanilla—: si esta cabecera hiciera su propia aritmética, el mostrador y
      Planeación podrían decirle al ciudadano dos plazos distintos.

   PRESENTACIÓN PURA. No decide, no calcula, no persiste.
══════════════════════════════════════════════════════════════ */

export interface CabeceraExpedienteProps {
  expediente: ExpedienteLicenciaDoc;
  /** ISO desde el que corre el plazo, o `null` si todavía no corre. */
  desdeCuandoCorreElPlazo: string | null;
  /** El término YA CALCULADO por el servidor — de aquí sale el plazo, no se recalcula. */
  terminoDual?: TerminoDualUI;
  /** Lleva a la sección de historial/estado. Opcional. */
  onVerEstado?: () => void;
}

export function CabeceraExpediente({
  expediente, desdeCuandoCorreElPlazo, terminoDual, onVerEstado,
}: CabeceraExpedienteProps) {
  const tramite = describirTramiteDesdeSubtipos(expediente.subtipos, expediente.modalidadesConstruccion);
  const dependencia = DIRECTORIO_TENANTS[expediente.tenantId as TenantId]?.nombreOficial;
  const estilo = ESTILOS_ESTADO_JURIDICO[expediente.estadoJuridico];

  /* La descripción del estado = subtexto de la fase ACTUAL del camino. Es texto
     que ya existe; no se inventa una frase nueva por estado. */
  const pasoActual = PASOS.find(
    (p) => situacionDePaso(p, expediente.estadoJuridico, expediente.completitud?.completo === true) === 'ACTUAL',
  );
  const descripcionEstado = pasoActual ? capitalizar(pasoActual.subtexto('ACTUAL')) : undefined;

  return (
    <div className="relative overflow-hidden">
      <PaisajeDecorativo />

      <header className="relative flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
        {/* ── ZONA 1 · IDENTIDAD ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 hidden shrink-0 items-center justify-center rounded-2xl sm:flex"
            style={{ width: 56, height: 56, background: '#E7F5EC', border: '1px solid #CDE9D6' }}
          >
            <IconoExpediente />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              Solicitante
            </p>
            <h1 className="font-headline text-2xl font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
              {expediente.solicitanteNombre}
              {expediente.solicitanteDocumento && (
                <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>
                  {' — CC '}{expediente.solicitanteDocumento}
                </span>
              )}
            </h1>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {expediente.numeroExpediente?.numero && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {rotuloDeSerie(expediente.numeroExpediente.serieId)}{' '}
                  <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>
                    {expediente.numeroExpediente.numero}
                  </strong>
                </span>
              )}
              <span aria-hidden style={{ color: 'var(--color-border-strong)' }}>|</span>
              <span className="first-letter:uppercase" style={{ color: 'var(--text-secondary)' }}>{tramite}</span>
            </div>

            <p className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <IconoInstitucion />
              Alcaldía de Simacota{dependencia && <> · {dependencia}</>}
            </p>
          </div>
        </div>

        {/* ── ZONA 2 · ESTADO ────────────────────────────────────────────── */}
        <TarjetaEstado
          label={estilo.label}
          dot={estilo.dot}
          fondo={estilo.fondo}
          texto={estilo.texto}
          descripcion={descripcionEstado}
          onVer={onVerEstado}
        />

        {/* ── ZONA 3 · PLAZO ─────────────────────────────────────────────── */}
        <PlazoLegal
          expedienteId={expediente.id}
          estadoJuridico={expediente.estadoJuridico}
          venceIso={terminoDual?.fechaAlertaConservadora ?? null}
          desdeIso={desdeCuandoCorreElPlazo}
          relojDetenido={terminoDual?.relojDetenido ?? null}
        />
      </header>
    </div>
  );
}

/* ── ZONA 2 ──────────────────────────────────────────────────────────────── */
function TarjetaEstado({
  label, dot, fondo, texto, descripcion, onVer,
}: {
  label: string; dot: string; fondo: string; texto: string; descripcion?: string; onVer?: () => void;
}) {
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-headline text-lg font-black" style={{ color: texto }}>
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />
          {label}
        </span>
        {onVer && <span aria-hidden style={{ color: texto }}>›</span>}
      </div>
      {descripcion && (
        <p className="mt-1 text-xs leading-relaxed" style={{ color: texto, opacity: 0.85 }}>
          {descripcion}
        </p>
      )}
    </>
  );
  const estilo = { background: fondo, border: `1px solid ${dot}22` } as const;
  const clase = 'rounded-xl px-4 py-3 lg:w-64 lg:shrink-0 text-left';
  return onVer ? (
    <button type="button" onClick={onVer} className={`microtarjeta-clic ${clase}`} style={estilo}>
      {contenido}
    </button>
  ) : (
    <div className={`microtarjeta ${clase}`} style={estilo}>{contenido}</div>
  );
}

/* ── ZONA 3 ──────────────────────────────────────────────────────────────── */
function PlazoLegal({
  expedienteId, estadoJuridico, venceIso, desdeIso, relojDetenido,
}: {
  expedienteId: string;
  estadoJuridico: ExpedienteLicenciaDoc['estadoJuridico'];
  venceIso: string | null;
  desdeIso: string | null;
  relojDetenido: TerminoDualUI['relojDetenido'];
}) {
  const lectura = venceIso
    ? leerElTermino({ expedienteId, estadoJuridico, venceIso, desdeIso: desdeIso ?? undefined, relojDetenido })
    : null;

  return (
    <div className="rounded-xl px-4 py-3 lg:w-72 lg:shrink-0" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2">
        <IconoCalendario />
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          Plazo legal
        </p>
      </div>

      {lectura?.situacion === 'CORRIENDO' ? (
        <PlazoCorriendo lectura={lectura} venceIso={venceIso!} desdeIso={desdeIso} />
      ) : venceIso ? (
        <>
          <p className="mt-1 font-headline text-lg font-black" style={{ color: 'var(--text-primary)' }}>
            {formatFechaColombia(venceIso)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {lectura?.situacion === 'SUSPENDIDO'
              ? 'El término está suspendido.'
              : lectura?.situacion === 'RESUELTO'
                ? 'Referencia — el plazo ya cerró con la decisión.'
                : 'Fecha de referencia.'}
          </p>
        </>
      ) : (
        /* La frase EXACTA del ADR-0034 — no un guion que obligue a interpretar. */
        <p className="mt-1 text-sm font-bold" style={{ color: '#9A6206' }}>
          Aún no ha empezado a correr
        </p>
      )}
    </div>
  );
}

function PlazoCorriendo({
  lectura, venceIso, desdeIso,
}: {
  lectura: Extract<ReturnType<typeof leerElTermino>, { situacion: 'CORRIENDO' }>;
  venceIso: string;
  desdeIso: string | null;
}) {
  const { diasHabilesRestantes: restantes, nivel, vencido, diaTranscurrido, totalDias, porcentaje } = lectura;
  const acento = nivel === 'EN_TERMINO' ? '#116932' : COLOR_NIVEL_TERMINO[nivel];
  return (
    <>
      <p className="mt-1 font-headline text-xl font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
        {formatFechaColombia(venceIso)}
      </p>
      {desdeIso && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Corre desde el {formatFechaColombia(desdeIso)}
        </p>
      )}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-surface)' }}>
        <div className="h-full rounded-full" style={{ width: `${porcentaje}%`, background: acento }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="font-bold" style={{ color: acento }}>
          {vencido
            ? `Vencido hace ${Math.abs(restantes)} días hábiles`
            : `${restantes} días hábiles restantes`}
        </span>
        <span style={{ color: 'var(--text-secondary)' }} className="tabular-nums">
          {diaTranscurrido} de {totalDias}
        </span>
      </div>
    </>
  );
}

function capitalizar(t: string): string {
  return t.length ? t[0]!.toUpperCase() + t.slice(1) : t;
}

/* ── Iconos e ilustración (decorativos) ──────────────────────────────────── */
function IconoExpediente() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 2.75h7.5L18.25 7.5V20A1.25 1.25 0 0 1 17 21.25H6A1.25 1.25 0 0 1 4.75 20V4A1.25 1.25 0 0 1 6 2.75Z" stroke="#14532D" strokeWidth="1.5" />
      <path d="M13 3v5h5" stroke="#14532D" strokeWidth="1.5" />
      <path d="M8 13.5l2 2 3.5-3.5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoInstitucion() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3.5 9.5L12 4l8.5 5.5M5 10v9m14-9v9M9 19v-5h6v5M3.5 19.5h17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoCalendario() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.75" y="4.75" width="16.5" height="15.5" rx="2" stroke="#2563EB" strokeWidth="1.5" />
      <path d="M3.75 9h16.5M8 3v3m8-3v3" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
/** Silueta muy tenue de Simacota — decorativa, no compite con el contenido. */
function PaisajeDecorativo() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 hidden h-full xl:block"
      width="280" height="150" viewBox="0 0 280 150" fill="none" preserveAspectRatio="xMaxYMid slice"
      style={{ opacity: 0.5 }}
    >
      <path d="M0 150 Q70 96 140 120 T280 104V150Z" fill="#EAF4EC" />
      <path d="M120 150 Q180 74 240 108 T280 120V150Z" fill="#DDEEE1" />
      <circle cx="232" cy="44" r="16" fill="#F4EAD0" />
      <path d="M198 122v-16l12-9 12 9v16" stroke="#BBD6C2" strokeWidth="2.4" fill="none" strokeLinejoin="round" />
      <path d="M205 106l5-4 5 4" stroke="#BBD6C2" strokeWidth="2.4" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
