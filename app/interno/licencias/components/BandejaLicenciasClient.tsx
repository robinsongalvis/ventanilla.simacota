'use client';

/* ══════════════════════════════════════════════════════════════
   Bandeja de Licencias — bloque "Integración UI y demo" (ADR-0029).

   Reemplaza los fixtures locales por datos reales del contrato ya
   probado `GET /api/licencias/expedientes` (ver dev-backend). Patrón del
   panel interno: Client Component + `useAuth` + `fetch({credentials:
   'include'})`, igual que el resto de `/interno/*` (`app/interno/
   dashboard/page.tsx`).

   DIFERENCIA DE ALCANCE frente a los fixtures que reemplaza: la lista NO
   trae `actuaciones` (evitar N+1 lecturas por fila — el detalle sí las
   trae). Sin actuaciones no hay forma honesta de proyectar un vencimiento
   por fila aquí (el cómputo dual vive en el Detalle, que sí tiene los
   hechos). Por eso esta bandeja NUNCA muestra una fecha de "vence" ni un
   semáforo por fecha — el Estado que se pinta es el ESTADO JURÍDICO real
   (`ChipEstadoJuridico`), no el semáforo `EstadoLicenciaUI` que usaban los
   fixtures (ese sigue vivo en `ChipEstado`, pero solo para el preview de
   componentes — ver `fixtures.ts`).

   Bloque C: el botón "Exportar libro consecutivo ↓" del pie YA NO es
   `BotonAccionPlaceholder` — el Libro Consecutivo real existe
   (`LibroConsecutivoClient`, con su propio export CSV). Este botón solo
   LLEVA hasta esa pantalla (misma decisión que `onAbrirExpediente`): en
   ruta standalone es un `<Link>` a `/interno/licencias/libro-consecutivo`;
   embebido en `VistaLicencias` (Bloque B), `onIrALibroConsecutivo` cambia
   de sub-pestaña local sin navegar.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { nombreSubtipo } from '../presentacion-subtipos';
import { camposBusquedaDesdeExpediente, coincideBusquedaLibro } from '../presentacion-libro-consecutivo';
import { ChipEstadoJuridico } from './ChipEstadoJuridico';
import { ChipPrueba } from './ChipPrueba';
import { NumeroLegal } from './NumeroLegal';
import { TarjetaKPI } from './TarjetaKPI';
import { RadicarSolicitudModal } from './RadicarSolicitudModal';
import { CrearDesdeRadicadoModal } from './CrearDesdeRadicadoModal';
import { BuscadorRapidoLibro } from './BuscadorRapidoLibro';

const ID_TABLA_BANDEJA_LICENCIAS = 'tabla-bandeja-licencias';

/**
 * Partición del dominio de `EstadoJuridicoLicencia` en 3 baldes
 * mutuamente excluyentes para los KPIs — SUPUESTO EXPLÍCITO (Principio 13):
 * no hay guía operativa validada con Planeación todavía para agrupar los 9
 * estados jurídicos en un panorama de 3 tarjetas (a diferencia del umbral
 * "por vencer" de PQRSD, que sí está validado). Se declara aquí, fácil de
 * ajustar cuando exista esa validación.
 */
const ESTADOS_EN_TRAMITE: readonly EstadoJuridicoLicencia[] = ['RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION', 'EN_VIABILIDAD'];
const ESTADOS_RESUELTOS: readonly EstadoJuridicoLicencia[] = ['CONCEDIDA', 'NEGADA', 'DESISTIDA', 'NOTIFICADA', 'EN_FIRME'];

function esReconstruido(exp: ExpedienteLicenciaDoc): boolean {
  return exp.origen === 'RECONSTRUIDO';
}

export interface BandejaLicenciasClientProps {
  /**
   * Bloque B ("la ventanita") — cuando la Bandeja se monta EMBEBIDA dentro
   * de `VistaLicencias` (`app/interno/dashboard/components/licencias/
   * VistaLicencias.tsx`, `VistaActual === 'LICENCIAS'`), abrir un
   * expediente es un cambio de estado local del panel, no una navegación
   * de ruta. Si se recibe, las filas/enlaces a un expediente llaman esto
   * EN VEZ de `<Link href="/interno/licencias/{id}">`. Sin esta prop
   * (ruta standalone `/interno/licencias`, deep-links) el comportamiento
   * es exactamente el de antes: `<Link>`.
   */
  onAbrirExpediente?: (expedienteId: string) => void;
  /**
   * Bloque C — mismo principio que `onAbrirExpediente`: si se recibe, el
   * botón "Exportar libro consecutivo ↓" del pie cambia de sub-pestaña
   * LOCAL en `VistaLicencias` en vez de navegar de ruta. Sin esta prop
   * (ruta standalone), navega con `<Link>` a `/interno/licencias/
   * libro-consecutivo`.
   */
  onIrALibroConsecutivo?: () => void;
}

/**
 * Enlace a un expediente que se comporta como `<Link>` (ruta standalone) o
 * como botón de estado local (`onAbrirExpediente`, Bloque B) según lo que
 * reciba el padre — ver `BandejaLicenciasClientProps.onAbrirExpediente`.
 * Único punto que decide esa rama: evita duplicar el `if` en cada una de
 * las dos filas de esta pantalla que enlazan a un expediente.
 */
function EnlaceExpediente({
  id,
  onAbrirExpediente,
  className,
  children,
}: {
  id: string;
  onAbrirExpediente?: (expedienteId: string) => void;
  className: string;
  children: React.ReactNode;
}) {
  if (onAbrirExpediente) {
    return (
      <button type="button" onClick={() => onAbrirExpediente(id)} className={className}>
        {children}
      </button>
    );
  }
  return (
    <Link href={`/interno/licencias/${id}`} className={className}>
      {children}
    </Link>
  );
}

export function BandejaLicenciasClient({ onAbrirExpediente, onIrALibroConsecutivo }: BandejaLicenciasClientProps = {}) {
  const { usuario, cargando: cargandoAuth } = useAuth();
  const [expedientes, setExpedientes] = useState<ExpedienteLicenciaDoc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalDesdeRadicadoAbierto, setModalDesdeRadicadoAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/licencias/expedientes', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'No fue posible cargar la bandeja de licencias.');
        return;
      }
      setExpedientes(Array.isArray(body.expedientes) ? body.expedientes : []);
    } catch {
      setError('Error de red al cargar la bandeja de licencias.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (cargandoAuth || !usuario) return;
    void cargar();
  }, [cargandoAuth, usuario, cargar]);

  // R9: los RECONSTRUIDOS (si algún día llegan por migración, Fase 5) nunca
  // cuentan para los KPIs — mismo principio que aplicaban los fixtures.
  const kpis = useMemo(() => {
    const contables = expedientes.filter((e) => !esReconstruido(e));
    const enTramite = contables.filter((e) => ESTADOS_EN_TRAMITE.includes(e.estadoJuridico));
    const conActa = contables.filter((e) => e.estadoJuridico === 'CON_ACTA_DE_OBSERVACIONES');
    const resueltos = contables.filter((e) => ESTADOS_RESUELTOS.includes(e.estadoJuridico));

    // El que lleva más tiempo esperando respuesta — orden por `actualizadoEn`
    // ascendente, el primero es el más antiguo. Dato factual (no una
    // urgencia inventada): informa "quién espera hace más" sin fingir un
    // vencimiento que no se calculó.
    const esperandoHaceMas = [...conActa].sort((a, b) =>
      String(a.actualizadoEn ?? '').localeCompare(String(b.actualizadoEn ?? '')))[0] ?? null;

    return { enTramite, conActa, resueltos, esperandoHaceMas, totalContable: contables.length };
  }, [expedientes]);

  const totalPrueba = useMemo(() => expedientes.filter((e) => e.esPrueba).length, [expedientes]);

  const terminoBusqueda = busqueda.trim();
  /**
   * Buscador rápido (mismo pedido/función pura que el Libro Consecutivo —
   * ver JSDoc de `coincideBusquedaLibro`, `../presentacion-libro-
   * consecutivo.ts`). A diferencia del Libro, la Bandeja NO construye
   * `FilaLibroConsecutivo` (solo pinta `ExpedienteLicenciaDoc` crudo), así
   * que cada expediente pasa primero por `camposBusquedaDesdeExpediente`.
   * Los KPIs de arriba (`kpis`, `totalPrueba`) siguen sobre `expedientes`
   * completo — mismo criterio que en el Libro: buscar no debe distorsionar
   * el panorama general.
   */
  const expedientesVisibles = useMemo(() => {
    if (!terminoBusqueda) return expedientes;
    return expedientes.filter((exp) => coincideBusquedaLibro(camposBusquedaDesdeExpediente(exp), busqueda));
  }, [expedientes, busqueda, terminoBusqueda]);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1400px] mx-auto">
      {/* ── Encabezado ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Secretaría de Planeación · Licencias Urbanísticas
          </p>
          <h1 className="font-headline text-2xl md:text-[28px] mt-1" style={{ color: 'var(--text-primary)' }}>
            Bandeja de Licencias
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Estado jurídico del ciclo (D.1077/2015) · el término legal (45 días hábiles) se proyecta en el detalle de cada expediente.
          </p>
        </div>
        <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setModalDesdeRadicadoAbierto(true)}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]"
            style={{ background: 'transparent', color: '#14532D', border: '1px solid #14532D' }}
          >
            Crear desde radicado
          </button>
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]"
            style={{ background: '#D4A017', color: '#14532D', boxShadow: '0 2px 8px rgba(212,160,23,0.25)' }}
          >
            Radicar solicitud →
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {error}
        </p>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TarjetaKPI
          overline="Con acta de observaciones"
          valor={kpis.conActa.length}
          tono="advertencia"
          detalle={
            kpis.esperandoHaceMas ? (
              <div className="flex flex-col gap-0.5">
                <EnlaceExpediente
                  id={kpis.esperandoHaceMas.id}
                  onAbrirExpediente={onAbrirExpediente}
                  className="focus-visible:outline-none focus-visible:ring-2 rounded w-fit"
                >
                  <NumeroLegal value={kpis.esperandoHaceMas.numeroExpediente?.numero ?? kpis.esperandoHaceMas.id} variant="expediente" size="sm" />
                </EnlaceExpediente>
                <span>esperando respuesta hace más tiempo</span>
              </div>
            ) : (
              'Ninguno esperando respuesta'
            )
          }
        />
        <TarjetaKPI
          overline="En trámite"
          valor={kpis.enTramite.length}
          tono="normal"
          detalle={<span>Radicados, en revisión o en viabilidad — sin acta pendiente</span>}
        />
        <TarjetaKPI
          overline="Resueltos"
          valor={kpis.resueltos.length}
          tono="exito"
          detalle={<span>Concedidos, negados, desistidos, notificados o en firme</span>}
        />
      </div>

      {/* ── Buscador rápido ── */}
      <BuscadorRapidoLibro
        id="busqueda-bandeja-licencias"
        etiqueta="Buscar en la bandeja de licencias por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado"
        placeholder="Buscar por expediente, radicado, nombre, documento, matrícula, tipo o estado…"
        valor={busqueda}
        onChange={setBusqueda}
        idTabla={ID_TABLA_BANDEJA_LICENCIAS}
        totalVisible={expedientesVisibles.length}
      />

      {/* ── Tabla ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="overflow-x-auto">
          <table id={ID_TABLA_BANDEJA_LICENCIAS} className="w-full border-collapse text-sm">
            <caption className="sr-only">{`Bandeja de licencias${terminoBusqueda ? `, búsqueda "${terminoBusqueda}"` : ''}`}</caption>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Th ancho={210}>Expediente</Th>
                <Th>Solicitante</Th>
                <Th ancho={220}>Subtipos</Th>
                <Th ancho={200}>Estado jurídico</Th>
                <Th ancho={120}>Creado</Th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Cargando expedientes…
                  </td>
                </tr>
              )}
              {!cargando && !error && expedientes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Sin expedientes aún — radica el primero
                    </p>
                    <button
                      type="button"
                      onClick={() => setModalAbierto(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2"
                      style={{ background: '#D4A017', color: '#14532D' }}
                    >
                      Radicar solicitud →
                    </button>
                  </td>
                </tr>
              )}
              {!cargando && expedientes.length > 0 && expedientesVisibles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm" style={{ color: 'var(--text-primary)' }}>
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-medium">Sin resultados para &quot;{terminoBusqueda}&quot;</p>
                      <button
                        type="button"
                        onClick={() => setBusqueda('')}
                        className="text-xs font-bold underline focus-visible:outline-none focus-visible:ring-2 rounded"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        Limpiar búsqueda
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!cargando && expedientesVisibles.map((exp) => {
                const numero = exp.numeroExpediente?.numero ?? exp.id;
                return (
                  <tr key={exp.id} className="micro-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-3 py-2.5 align-top">
                      <EnlaceExpediente
                        id={exp.id}
                        onAbrirExpediente={onAbrirExpediente}
                        className="focus-visible:outline-none focus-visible:ring-2 rounded inline-flex items-center gap-1.5 flex-wrap"
                      >
                        <NumeroLegal value={numero} variant="expediente" size="sm" />
                        {exp.esPrueba && <ChipPrueba />}
                      </EnlaceExpediente>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {exp.radicadoId ? <NumeroLegal value={exp.radicadoId} variant="radicado" size="sm" /> : 'Sin radicado Ventanilla vinculado'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-primary)' }}>
                      <p>{exp.solicitanteNombre}</p>
                      <p style={{ color: 'var(--text-secondary)' }}>{exp.solicitanteDocumento}</p>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {(exp.subtipos ?? []).map((codigo) => (
                          <span
                            key={codigo}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
                          >
                            {nombreSubtipo(codigo)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <ChipEstadoJuridico estado={exp.estadoJuridico} />
                    </td>
                    <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-primary)' }}>
                      {formatFechaColombia(exp.creadoEn)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pie: conteos de reconciliación (sobre el TOTAL, no de la búsqueda activa) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <p>
          {kpis.totalContable} expediente{kpis.totalContable === 1 ? '' : 's'} · {totalPrueba} de prueba visible{totalPrueba === 1 ? '' : 's'}
          {terminoBusqueda &&
            ` · ${expedientesVisibles.length} visible${expedientesVisibles.length === 1 ? '' : 's'} con la búsqueda activa`}
        </p>
        <BotonIrALibroConsecutivo onIrALibroConsecutivo={onIrALibroConsecutivo} />
      </div>

      {modalAbierto && (
        <RadicarSolicitudModal onCerrar={() => setModalAbierto(false)} onCreado={() => void cargar()} />
      )}
      {modalDesdeRadicadoAbierto && (
        <CrearDesdeRadicadoModal onCerrar={() => setModalDesdeRadicadoAbierto(false)} onCreado={() => void cargar()} />
      )}
    </div>
  );
}

function Th({ children, ancho }: { children: React.ReactNode; ancho?: number }) {
  return (
    <th
      scope="col"
      className="text-left px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-widest"
      style={{ color: 'var(--text-secondary)', width: ancho }}
    >
      {children}
    </th>
  );
}

/**
 * "Exportar libro consecutivo ↓" — mismo estilo `outline` que tenía
 * `BotonAccionPlaceholder` (para que el reemplazo no cambie la jerarquía
 * visual del pie), pero ahora es un enlace/botón real: lleva al Libro
 * Consecutivo (`LibroConsecutivoClient`), que tiene su propio botón
 * "Exportar CSV ↓" — este botón NO exporta directamente (evita duplicar
 * el estado de año/filas aquí, la Bandeja no filtra por año).
 */
function BotonIrALibroConsecutivo({ onIrALibroConsecutivo }: { onIrALibroConsecutivo?: () => void }) {
  const claseBase =
    'inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]';
  const estiloOutline: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--color-border)',
  };

  if (onIrALibroConsecutivo) {
    return (
      <button type="button" onClick={onIrALibroConsecutivo} className={claseBase} style={estiloOutline}>
        Exportar libro consecutivo ↓
      </button>
    );
  }
  return (
    <Link href="/interno/licencias/libro-consecutivo" className={claseBase} style={estiloOutline}>
      Exportar libro consecutivo ↓
    </Link>
  );
}
