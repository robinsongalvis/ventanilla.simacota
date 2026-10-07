'use client';

/* ══════════════════════════════════════════════════════════════
   Bandeja de Licencias — bloque "Integración UI y demo" (ADR-0029).

   Reemplaza los fixtures locales por datos reales del contrato ya
   probado `GET /api/licencias/expedientes` (ver dev-backend). Patrón del
   panel interno: Client Component + `useAuth` + `fetch({credentials:
   'include'})`, igual que el resto de `/interno/*` (`app/interno/
   dashboard/page.tsx`).

   LA COLUMNA «VENCE» (31-ago-2026). Esta cabecera decía, hasta hoy, que la
   bandeja «NUNCA muestra una fecha de vence ni un semáforo por fecha»,
   porque la lista no trae `actuaciones` y sin ellas no había forma honesta
   de proyectar un vencimiento por fila.

   ERA CIERTO CUANDO SE ESCRIBIÓ Y DEJÓ DE SERLO. El bloque «Términos y
   vigencias protectores» (10-ago-2026) persistió `fechaAlertaConservadora`
   en el documento raíz del expediente PRECISAMENTE para que esta lista
   pudiera pintarlo sin lecturas nuevas — y nadie volvió a corregir este
   párrafo. Durante veinte días el dato viajó hasta el navegador y ninguna
   pantalla lo pintó: la funcionaria abría la bandeja y no podía ver a cuál
   se le acababa el tiempo sin entrar uno por uno.

   Sigue en pie lo que no ha cambiado: la lista NO trae `actuaciones`
   (evitar N+1 — el detalle sí las trae) y aquí NO se calcula nada. Se lee
   el espejo denormalizado y se clasifica con `clasificarFrenteAlTermino`,
   LA MISMA función que usa el cron del vigía y que pinta el detalle: si
   cada pantalla tuviera la suya, el correo diría una cosa y la bandeja otra
   sobre el mismo plazo.

   El Estado que se pinta sigue siendo el ESTADO JURÍDICO real
   (`ChipEstadoJuridico`), no el semáforo `EstadoLicenciaUI` de los fixtures
   (ese sigue vivo en `ChipEstado`, solo para el preview — ver
   `fixtures.ts`). Son dos cosas distintas y ahora conviven en dos columnas.

   Bloque C: el botón "Exportar libro consecutivo ↓" del pie YA NO es
   `BotonAccionPlaceholder` — el Libro Consecutivo real existe
   (`LibroConsecutivoClient`, con su propio export CSV). Este botón solo
   LLEVA hasta esa pantalla (misma decisión que `onAbrirExpediente`): en el
   panel, `onIrALibroConsecutivo` cambia de pestaña; sin él es un `<Link>` a
   la dirección canónica del libro (`rutas-licencias.ts`, ADR-0046 §7).
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { nombreSubtipo } from '../presentacion-subtipos';
import { camposBusquedaDesdeExpediente, coincideBusquedaLibro } from '../presentacion-libro-consecutivo';
import {
  clasificarFrenteAlTermino,
  ETIQUETA_NIVEL_TERMINO,
  COLOR_NIVEL_TERMINO,
} from '@/lib/motor-expedientes/semaforo-termino';
import { ChipEstadoJuridico } from './ChipEstadoJuridico';
import { ChipPrueba } from './ChipPrueba';
import { NumeroLegal } from './NumeroLegal';
import { CheckCircle2, FileWarning, FolderOpen } from 'lucide-react';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { PanelVigilanciaTermino } from './PanelVigilanciaTermino';
import { RadicarSolicitudModal } from './RadicarSolicitudModal';
import { CrearDesdeRadicadoModal } from './CrearDesdeRadicadoModal';
import { BuscadorRapidoLibro } from './BuscadorRapidoLibro';
import { urlLicencias } from '../rutas-licencias';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';

const ID_TABLA_BANDEJA_LICENCIAS = 'tabla-bandeja-licencias';

/**
 * Partición del dominio de `EstadoJuridicoLicencia` en 3 baldes
 * mutuamente excluyentes para los KPIs — SUPUESTO EXPLÍCITO (Principio 13):
 * no hay guía operativa validada con Planeación todavía para agrupar los 9
 * estados jurídicos en un panorama de 3 tarjetas (a diferencia del umbral
 * "por vencer" de PQRSD, que sí está validado). Se declara aquí, fácil de
 * ajustar cuando exista esa validación.
 */
// PRESENTADA va aquí o los expedientes en estado previo NO CAEN EN NINGÚN
// BALDE y desaparecen del panorama sin que nada falle (ADR-0033 §4.6, Caso 1:
// los arrays no avisan al compilador). Un expediente esperando documentos es
// trámite en curso: la Alcaldía lo tiene en su poder.
const ESTADOS_EN_TRAMITE: readonly EstadoJuridicoLicencia[] = ['PRESENTADA', 'RADICADA_EN_DEBIDA_FORMA', 'EN_REVISION', 'EN_VIABILIDAD'];
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
   * de ruta. Si se recibe, las filas/enlaces a un expediente llaman esto.
   * Sin esta prop son un `<Link>` a la dirección canónica del expediente
   * (`urlLicencias`, ADR-0046 §7).
   */
  onAbrirExpediente?: (expedienteId: string) => void;
  /**
   * Bloque C — mismo principio que `onAbrirExpediente`: si se recibe, el
   * botón "Exportar libro consecutivo ↓" del pie cambia de sub-pestaña
   * LOCAL en `VistaLicencias` en vez de navegar de ruta. Sin esta prop
   * navega con `<Link>` a la dirección canónica del libro.
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
    <Link href={urlLicencias({ expedienteId: id })} className={className}>
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

  // R9: los RECONSTRUIDOS (si algún día llegan por migración — Fase 5 en la
  // numeración canónica del PLAN_FASES_MOTOR_EXPEDIENTES; el blueprint §8 y
  // las adendas del ADR-0026 llaman «Fase 2» a esa misma etapa) nunca
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

  /* Una sola lectura del reloj por montaje: si cada fila llamara a `new Date()`
     por su cuenta, dos filas de la misma tabla podrían caer a lados distintos de
     la medianoche y la lista se contradiría consigo misma. */
  const ahora = useMemo(() => new Date(), []);

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
    <>
      {/* ── Encabezado: el subencabezado del panel (armazón único, ADR-0046
          §7). El título de pantalla («Licencias») ya está en el encabezado
          común. «Recibir solicitud» es la recepción del ciudadano en
          Planeación: superficie dorada, como «Nueva radicación». ── */}
      <SectionHeader
        titulo="Bandeja de Licencias"
        subtitulo="Secretaría de Planeación · Licencias Urbanísticas"
        nota="Estado jurídico del ciclo (D.1077/2015) · el término legal (45 días hábiles) se proyecta en el detalle de cada expediente."
        acciones={
          <>
            <BotonAccion onClick={() => setModalDesdeRadicadoAbierto(true)}>
              Crear desde radicado
            </BotonAccion>
            <BotonAccion variante="destacada" onClick={() => setModalAbierto(true)}>
              Recibir solicitud →
            </BotonAccion>
          </>
        }
      />
    <div className="px-4 pb-6 lg:px-6 flex flex-col gap-5">

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-991b1b)' }}>
          {error}
        </p>
      )}

      {/* ── Vigía del término: el agregado del cron, no un cálculo de pantalla ── */}
      <PanelVigilanciaTermino />

      {/* ── KPIs: tarjetas de la referencia visual (Ola 3). Mismos baldes y
          conteos; «Con acta» sigue en ámbar (pide atención sin afirmar una
          urgencia que el sistema no puede verificar) y conserva el enlace
          al que espera respuesta hace más tiempo. ── */}
      <FilaTarjetas etiqueta="Resumen de la bandeja de licencias">
        <TarjetaIndicador
          etiqueta="Con acta de observaciones"
          valor={kpis.conActa.length}
          tono="ambar"
          Icono={FileWarning}
          pie={
            <span className="mt-1 flex flex-col gap-0.5 text-[10px] leading-tight" style={{ color: 'var(--tema-texto-475569)' }}>
              {kpis.esperandoHaceMas ? (
                <>
                  <EnlaceExpediente
                    id={kpis.esperandoHaceMas.id}
                    onAbrirExpediente={onAbrirExpediente}
                    className="focus-visible:outline-none focus-visible:ring-2 rounded w-fit"
                  >
                    <NumeroLegal value={kpis.esperandoHaceMas.numeroExpediente?.numero ?? kpis.esperandoHaceMas.id} variant="expediente" size="sm" />
                  </EnlaceExpediente>
                  <span>esperando respuesta hace más tiempo</span>
                </>
              ) : (
                'Ninguno esperando respuesta'
              )}
            </span>
          }
        />
        <TarjetaIndicador
          etiqueta="En trámite"
          valor={kpis.enTramite.length}
          tono="azul"
          Icono={FolderOpen}
          descripcion="Solicitudes abiertas: presentadas, radicadas, en revisión o en viabilidad — sin acta pendiente"
          descripcionVisible
        />
        <TarjetaIndicador
          etiqueta="Resueltos"
          valor={kpis.resueltos.length}
          tono="verde"
          Icono={CheckCircle2}
          descripcion="Concedidos, negados, desistidos, notificados o en firme"
          descripcionVisible
        />
      </FilaTarjetas>

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
                <Th ancho={190}>Vence</Th>
                <Th ancho={120}>Creado</Th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Cargando expedientes…
                  </td>
                </tr>
              )}
              {!cargando && !error && expedientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Sin expedientes aún — radica el primero
                    </p>
                    <button
                      type="button"
                      onClick={() => setModalAbierto(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2"
                      style={{ background: '#E5A31A', color: '#03402A' }}
                    >
                      Recibir solicitud →
                    </button>
                  </td>
                </tr>
              )}
              {!cargando && expedientes.length > 0 && expedientesVisibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm" style={{ color: 'var(--text-primary)' }}>
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-medium">Sin resultados para &quot;{terminoBusqueda}&quot;</p>
                      <button
                        type="button"
                        onClick={() => setBusqueda('')}
                        className="text-xs font-bold underline focus-visible:outline-none focus-visible:ring-2 rounded"
                        style={{ color: 'var(--tema-texto-007049)' }}
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
                            /* #475569: el gris secundario sobre la superficie tintada quedaba en 4,47:1. */
                            style={{ background: 'var(--bg-surface-2)', color: 'var(--tema-texto-475569)' }}
                          >
                            {nombreSubtipo(codigo)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <ChipEstadoJuridico estado={exp.estadoJuridico} />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <CeldaVence expediente={exp} ahora={ahora} />
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
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   LA CELDA «VENCE».

   No calcula: lee el espejo `fechaAlertaConservadora` que el servidor persiste
   y lo pasa por `clasificarFrenteAlTermino` — la MISMA función del cron del
   vigía y del detalle. Las etiquetas y los colores también son los suyos
   (`ETIQUETA_NIVEL_TERMINO`, `COLOR_NIVEL_TERMINO`), que a su vez son los del
   correo carácter por carácter. Una sola verdad sobre el plazo.

   LAS CUATRO SITUACIONES SE PINTAN DISTINTO, y eso es el punto: un panel que
   pinta igual «no ha empezado», «está detenido» y «ya se resolvió» es el fallo
   PT-2 llevado a la pantalla. Ninguna de las tres es «le quedan N días».

   OJO CON `SIN_ANCLAR` (ADR-0033 §4.6-bis): tapa dos casos que el contrato del
   campo distingue — `undefined` (expediente anterior al campo: no se sabe) y
   `null` (histórico reconstruido: no hay término vivo que proyectar). Aquí se
   pintan igual, y NO se separan a propósito: quien conflaciona es
   `clasificarFrenteAlTermino`, y separarlos solo aquí haría que la pantalla
   dijera algo distinto del correo del mismo día. Si un día hay que
   distinguirlos, se distingue EN LA FUNCIÓN, y las dos lo heredan.
══════════════════════════════════════════════════════════════ */
function CeldaVence({ expediente, ahora }: { expediente: ExpedienteLicenciaDoc; ahora: Date }) {
  const fila = clasificarFrenteAlTermino(
    {
      id: expediente.id,
      estadoJuridico: expediente.estadoJuridico,
      creadoEn: expediente.creadoEn,
      numeroExpediente: expediente.numeroExpediente,
      fechaAlertaConservadora: expediente.fechaAlertaConservadora,
    },
    ahora,
  );

  if (fila.situacion === 'RESUELTO') {
    return <span style={{ color: 'var(--text-secondary)' }}>Resuelto</span>;
  }

  if (fila.situacion === 'SUSPENDIDO') {
    return (
      <span style={{ color: 'var(--text-secondary)' }} title={fila.fundamentoSuspension}>
        Suspendido
      </span>
    );
  }

  if (fila.situacion === 'SIN_ANCLAR') {
    return (
      <span style={{ color: 'var(--text-secondary)' }}>
        Sin anclar
        {typeof fila.diasHabilesEnEspera === 'number' && (
          <>
            {' · '}
            <span>{fila.diasHabilesEnEspera} d. hábiles esperando</span>
          </>
        )}
      </span>
    );
  }

  // CORRIENDO — la única situación con fecha y con escalón.
  const color = fila.nivel ? COLOR_NIVEL_TERMINO[fila.nivel] : 'var(--text-primary)';
  return (
    <span style={{ color }} title={fila.nivel ? ETIQUETA_NIVEL_TERMINO[fila.nivel] : undefined}>
      {formatFechaColombia(expediente.fechaAlertaConservadora as string)}
      {typeof fila.diasHabilesRestantes === 'number' && (
        <>
          {' · '}
          <span className={fila.nivel ? 'font-semibold' : undefined}>
            {fila.diasHabilesRestantes} d. hábiles
          </span>
        </>
      )}
    </span>
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
    <Link href={urlLicencias({ seccion: 'LIBRO_CONSECUTIVO' })} className={claseBase} style={estiloOutline}>
      Exportar libro consecutivo ↓
    </Link>
  );
}
