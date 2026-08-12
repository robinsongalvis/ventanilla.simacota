'use client';

/* ══════════════════════════════════════════════════════════════
   Libro consecutivo — Bloque C ("el reemplazo funcional del Excel").

   Reemplaza el placeholder honesto que existía hasta ahora (Fase 2,
   arranque): la colección `expedientes` YA es real (`GET /api/licencias/
   expedientes`, bloque "Integración UI y demo") — este componente consume
   el MISMO endpoint que `BandejaLicenciasClient`, sin filtro de año en el
   servidor (la cota del endpoint por tenant ya gobierna el volumen; el
   año se filtra en cliente, ver `presentacion-libro-consecutivo.ts`).

   Patrón dual (mismo que Bloque B): este componente único se monta desde
   la ruta standalone (`app/interno/licencias/libro-consecutivo/page.tsx`)
   Y desde la sub-pestaña "Libro consecutivo" de `VistaLicencias`
   (`app/interno/dashboard/components/licencias/VistaLicencias.tsx`) sin
   duplicar lógica. No necesita props de navegación (a diferencia de
   `BandejaLicenciasClient`/`DetalleLicenciaClient`): es una vista hoja,
   no abre otra pantalla — el detalle rápido vive en un panel lateral
   propio (`PanelDetalleExpediente`), no en una navegación.

   Rediseño (10-ago-2026, diseño validado por el propietario): de lista
   suelta a tabla densa con KPIs, filtros con conteo y franja de urgencia
   por fila. Las funciones de conteo/filtrado/urgencia son PURAS
   (`presentacion-libro-consecutivo.ts`) — este componente solo las
   invoca y pinta el resultado.

   Honestidad de datos (RF-5/RF-9, `docs/planes/
   ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`): "N.° LICENCIA" muestra "—"
   cuando `actoFinal` está ausente — HOY la norma, no la excepción (0/202
   expedientes del Excel histórico tienen fecha de resolución). Nunca se
   calcula ni se infiere ese dato. "Vence" sale de `fechaAlertaConservadora`,
   espejo que el servidor YA persiste en el documento raíz del expediente
   en la misma transacción que cada actuación (ver su JSDoc en
   `lib/server/expedientes-licencias.ts`): llega gratis en esta lista, sin
   leer la subcolección `actuaciones` (R11). Cuando el servidor no pudo
   proyectar término — expedientes anteriores al campo, y RECONSTRUIDOS,
   cuyas actuaciones no mueven relojes legales (R9) — la columna se ve
   honestamente vacía; jamás se recalcula aquí.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';
import { ChipEstadoJuridico } from './ChipEstadoJuridico';
import { ChipPrueba } from './ChipPrueba';
import { NumeroLegal } from './NumeroLegal';
import { TarjetaKpiLibro } from './TarjetaKpiLibro';
import { ChipFiltroLibro } from './ChipFiltroLibro';
import { EtiquetaDatoFaltante } from './EtiquetaDatoFaltante';
import { EtiquetaColisionNumero } from './EtiquetaColisionNumero';
import { PanelDetalleExpediente } from './PanelDetalleExpediente';
import { BuscadorRapidoLibro } from './BuscadorRapidoLibro';
import {
  añosDisponiblesLibro,
  calcularConteosKpiLibro,
  calcularConteosPorFiltroLibro,
  coincideBusquedaLibro,
  COLOR_URGENCIA_LIBRO,
  COLOR_TEXTO_URGENCIA_LIBRO,
  construirFilasLibroConsecutivo,
  FILTROS_LIBRO_CONSECUTIVO,
  filtrarFilasLibro,
  generarCsvLibroConsecutivo,
  nombreArchivoCsvLibroConsecutivo,
  subtiposConEstadoLibro,
  textoColisionLibro,
  textoDiasVencimientoLibro,
  urgenciaFilaLibro,
  type FiltroLibroConsecutivo,
} from '../presentacion-libro-consecutivo';

const ID_TABLA_LIBRO_CONSECUTIVO = 'tabla-libro-consecutivo';

/** Id de la hoja de estilos que este componente inyecta durante su impresión. */
const ID_HOJA_IMPRESION_LIBRO = 'libro-consecutivo-print-styles';

/**
 * Clase que el `<body>` lleva SOLO mientras dura la impresión del libro —
 * el CSS de `app/globals.css` la usa para desrecortar el armazón de pantalla
 * (`h-screen overflow-hidden`, `overflow-y-auto`) sin tocarlo el resto del
 * tiempo ni afectar a las demás superficies que imprimen.
 */
const CLASE_IMPRIMIENDO_LIBRO = 'imprimiendo-libro-consecutivo';

/**
 * `@page` es la ÚNICA pieza de esta corrección que CSS no sabe acotar: su
 * gramática no admite selectores, así que cualquier `@page` cargado en el
 * documento gobierna TODA la impresión. Dejarlo en `app/globals.css` pondría
 * en horizontal la constancia de radicación (190 mm), los sellos, la planilla
 * de reparto y el proyecto de acto de desistimiento de este MISMO módulo.
 *
 * Se acota en el TIEMPO, no por selector: la hoja existe solo mientras dura
 * la impresión que dispara este botón. Es el patrón que el repo ya usa cinco
 * veces (`ComprobanteRadicado`, `SelloRecibido`, `SelloDespacho`, reporte
 * MIPG, `PanelReparto`) — Principio 3: se reutiliza, no se inventa.
 *
 * Consecuencia honesta y asumida: si la funcionaria pulsa Ctrl+P en vez del
 * botón, no hay horizontal. Por eso las reglas permanentes de `globals.css`
 * son independientes y garantizan que en vertical la tabla salga COMPLETA
 * (más densa), nunca recortada.
 */
const HOJA_IMPRESION_LIBRO = `
@page { size: A4 landscape; margin: 10mm 8mm; }
`;

/**
 * Hojas de impresión de OTRAS pantallas del mismo documento que hay que
 * apagar antes de imprimir el libro.
 *
 * POR QUÉ: `ComprobanteRadicado` y `PanelReparto` inyectan su hoja UNA sola
 * vez (`stylesInjected.current`) y NO la retiran nunca — y ambas contienen
 * `body * { visibility: hidden !important; }`. El libro se monta también como
 * sub-pestaña de `/interno/dashboard` (`VistaLicencias`), el MISMO documento
 * donde vive Radicación Rápida, así que el camino real "radicar → imprimir
 * constancia → pestaña Licencias → Libro → Imprimir" dejaría N hojas EN
 * BLANCO. Se apagan aquí y se restauran al terminar; el mecanismo (`disabled`)
 * es el que ya usa `SelloDespacho`.
 */
const HOJAS_IMPRESION_AJENAS = [
  'comprobante-print-styles',
  'planilla-reparto-print-styles',
  'sello-recibido-print-styles',
  'sello-despacho-print-styles',
  'reporte-mipg-print-styles',
];

export function LibroConsecutivoClient() {
  const { usuario, cargando: cargandoAuth } = useAuth();
  const [expedientes, setExpedientes] = useState<ExpedienteLicenciaDoc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default = año en curso (spec) — el selector se recalcula con datos
  // reales en cuanto llega la respuesta (`añosDisponiblesLibro`).
  const [año, setAño] = useState<number>(() => new Date().getFullYear());
  const [filtro, setFiltro] = useState<FiltroLibroConsecutivo>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [expedienteSeleccionadoId, setExpedienteSeleccionadoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/licencias/expedientes', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'No fue posible cargar el libro consecutivo.');
        return;
      }
      setExpedientes(Array.isArray(body.expedientes) ? body.expedientes : []);
    } catch {
      setError('Error de red al cargar el libro consecutivo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (cargandoAuth || !usuario) return;
    void cargar();
  }, [cargandoAuth, usuario, cargar]);

  const años = useMemo(() => añosDisponiblesLibro(expedientes), [expedientes]);
  const filas = useMemo(() => construirFilasLibroConsecutivo(expedientes, año), [expedientes, año]);
  // KPIs y conteos de chips SIEMPRE sobre `filas` (el año completo) — la
  // búsqueda nunca los distorsiona, mismo criterio que ya aplicaba el
  // filtro de chip (ver JSDoc de `filasVisibles` abajo).
  const conteosKpi = useMemo(() => calcularConteosKpiLibro(filas), [filas]);
  const conteosFiltro = useMemo(() => calcularConteosPorFiltroLibro(filas), [filas]);
  const filasPorFiltro = useMemo(() => filtrarFilasLibro(filas, filtro), [filas, filtro]);
  const terminoBusqueda = busqueda.trim();
  /**
   * Buscador rápido — corre DENTRO del filtro de chip activo (sobre
   * `filasPorFiltro`, no sobre `filas`), para que "buscar" y "filtrar" se
   * combinen en vez de pelearse: si el chip "Vencidos" está activo, buscar
   * "galvis" solo encuentra vencidos de Galvis. `coincideBusquedaLibro` es
   * PURA (`../presentacion-libro-consecutivo.ts`) — `FilaLibroConsecutivo`
   * calza su forma sin adaptador.
   */
  const filasVisibles = useMemo(() => {
    if (!terminoBusqueda) return filasPorFiltro;
    return filasPorFiltro.filter((f) => coincideBusquedaLibro(f, busqueda));
  }, [filasPorFiltro, busqueda, terminoBusqueda]);
  const conteos = useMemo(
    () => ({
      total: filas.length,
      prueba: filas.filter((f) => f.esPrueba).length,
      conActoFinal: filas.filter((f) => f.numeroLicencia !== null).length,
    }),
    [filas],
  );

  // El filtro que quedó activo puede vaciarse al cambiar de año (p. ej.
  // "Vencidos" con 3 filas en 2026 pasa a 0 en 2025) — se resetea a
  // 'TODOS' para no dejar la tabla en un vacío silencioso que parezca un
  // error de carga.
  useEffect(() => {
    setFiltro('TODOS');
  }, [año]);

  // El chip "Colisiones" solo se renderiza cuando hay al menos una (es 0 en
  // todo año limpio, y un chip permanente en 0 sería ruido). Si el conteo
  // cae a 0 mientras ese filtro está activo, el control desaparecería y
  // dejaría la tabla filtrada por algo invisible: se resetea.
  useEffect(() => {
    if (filtro === 'COLISIONES' && conteosFiltro.COLISIONES === 0) setFiltro('TODOS');
  }, [filtro, conteosFiltro]);

  /**
   * Deja el documento como estaba antes de imprimir. Idempotente a
   * propósito: la llaman `afterprint`, el retorno de `window.print()` y el
   * desmontaje del componente, y cualquiera de las tres puede ganar.
   */
  const limpiarModoImpresionLibro = useCallback(() => {
    document.getElementById(ID_HOJA_IMPRESION_LIBRO)?.remove();
    document.body.classList.remove(CLASE_IMPRIMIENDO_LIBRO);
    for (const id of HOJAS_IMPRESION_AJENAS) {
      const hoja = document.getElementById(id) as HTMLStyleElement | null;
      if (hoja) hoja.disabled = false;
    }
  }, []);

  const imprimirLibro = useCallback(() => {
    for (const id of HOJAS_IMPRESION_AJENAS) {
      const hoja = document.getElementById(id) as HTMLStyleElement | null;
      if (hoja) hoja.disabled = true;
    }
    document.body.classList.add(CLASE_IMPRIMIENDO_LIBRO);
    const tag = document.createElement('style');
    tag.id = ID_HOJA_IMPRESION_LIBRO;
    tag.textContent = HOJA_IMPRESION_LIBRO;
    document.head.appendChild(tag);

    window.print();
    limpiarModoImpresionLibro();
  }, [limpiarModoImpresionLibro]);

  // Red de seguridad: en los navegadores donde `window.print()` NO bloquea,
  // la limpieza de arriba correría antes de que se genere el papel. `after
  // print` cubre ese caso; el desmontaje cubre el de navegar durante el
  // diálogo. Dejar la hoja viva pondría horizontal la siguiente constancia.
  useEffect(() => {
    window.addEventListener('afterprint', limpiarModoImpresionLibro);
    return () => {
      window.removeEventListener('afterprint', limpiarModoImpresionLibro);
      limpiarModoImpresionLibro();
    };
  }, [limpiarModoImpresionLibro]);

  const exportarCsv = useCallback(() => {
    const csv = generarCsvLibroConsecutivo(filas);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivoCsvLibroConsecutivo(año);
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }, [filas, año]);

  return (
    // `w-full min-w-0` es el simétrico horizontal del `min-h-0` del layout
    // (ver `app/interno/licencias/layout.tsx`). Este contenedor es un hijo
    // flex, y un hijo flex tiene `min-width: auto` implícito: sin anchura
    // definida se dimensiona por su contenido, y la tabla del libro (~1036 px)
    // lo estiraba a 1070 px. En un teléfono de 375 px eso cortaba el
    // subtítulo, el aviso de migración y el buscador, y además dejaba muerto
    // el `overflow-x-auto` de la tabla — el contenedor crecía en vez de que
    // la tabla se desplazara (medido en la verificación E2E del 12-ago-2026).
    // `w-full` le da anchura definida = la del viewport; `min-w-0` impide que
    // el mínimo automático la vuelva a inflar.
    <div className="libro-consecutivo w-full min-w-0 p-4 md:p-6 flex flex-col gap-5 max-w-[1400px] mx-auto">
      {/* ── Encabezado de pantalla (oculto al imprimir) ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 print:hidden">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Secretaría de Planeación · Licencias Urbanísticas
          </p>
          <h1 className="font-headline text-2xl md:text-[28px] mt-1" style={{ color: 'var(--text-primary)' }}>
            Libro consecutivo
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Un expediente por fila, en el orden en que se radicó — reemplaza el Excel de consecutivo de Planeación.
          </p>
        </div>
        <div className="shrink-0 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              Año
            </span>
            <select
              className="select-internal"
              value={año}
              onChange={(e) => setAño(Number(e.target.value))}
              aria-label="Año del libro consecutivo"
            >
              {años.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={exportarCsv}
            disabled={cargando || filas.length === 0}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
            style={{ background: 'var(--color-accent)', color: 'var(--color-primary)', boxShadow: '0 2px 8px rgba(212,160,23,0.25)' }}
          >
            Exportar CSV ↓
          </button>
          <button
            type="button"
            onClick={imprimirLibro}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:brightness-95 active:scale-[0.98]"
            style={{ background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
          >
            Imprimir
          </button>
        </div>
      </div>

      {/* ── Encabezado SOLO impresión: institucional + año, sin controles ── */}
      <div className="hidden print:block">
        <InstitucionalHeader
          variant="print"
          eyebrow="Secretaría de Planeación · Licencias Urbanísticas"
          title="Libro consecutivo de licencias"
          subtitle={`Año ${año}`}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm print:hidden" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {error}
        </p>
      )}

      {/* ── Aviso permanente de alcance (RF-6/RF-7) ── */}
      <div
        role="note"
        aria-label="Aviso sobre el alcance histórico del libro"
        className="rounded-xl p-3.5 print:hidden"
        style={{ background: '#E9F0FC', border: '1px solid rgba(37,99,235,0.25)' }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: '#1E4FA0' }}>
          <strong>Libro del sistema</strong> — incluye los expedientes históricos del Excel de Planeación (2022–2026),
          migrados el 11-ago-2026. Entraron como <em>Histórico sin resolver</em>: conservan lo que decía el libro,
          pero les falta completar cédula y estado desde los expedientes físicos — el filtro
          «Históricos incompletos» los agrupa.
        </p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <TarjetaKpiLibro overline="Total" valor={conteosKpi.total} tono="normal" detalle={<span>Expedientes de {año}</span>} />
        <TarjetaKpiLibro overline="En trámite" valor={conteosKpi.enTramite} tono="normal" detalle={<span>Radicados, en revisión, con acta o en viabilidad</span>} />
        <TarjetaKpiLibro
          overline="Por vencer"
          valor={conteosKpi.porVencer}
          tono="peligro"
          detalle={<span>Con alerta de término calculada por el sistema</span>}
        />
        <TarjetaKpiLibro
          overline="Históricos incompletos"
          valor={conteosKpi.historicosIncompletos}
          tono="advertencia"
          detalle={<span>Migrados sin cédula o sin estado registrado</span>}
        />
      </div>

      {/* ── Buscador rápido ── */}
      <div className="print:hidden">
        <BuscadorRapidoLibro
          id="busqueda-libro-consecutivo"
          etiqueta="Buscar en el libro consecutivo por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado"
          placeholder="Buscar por expediente, radicado, nombre, documento, matrícula, tipo o estado…"
          valor={busqueda}
          onChange={setBusqueda}
          idTabla={ID_TABLA_LIBRO_CONSECUTIVO}
          totalVisible={filasVisibles.length}
        />
      </div>

      {/* ── Chips de filtro ── */}
      <div role="group" aria-label="Filtrar libro consecutivo" className="flex flex-wrap gap-2 print:hidden">
        {FILTROS_LIBRO_CONSECUTIVO.filter(({ id }) => id !== 'COLISIONES' || conteosFiltro.COLISIONES > 0).map(({ id, etiqueta }) => (
          <ChipFiltroLibro key={id} etiqueta={etiqueta} conteo={conteosFiltro[id]} activo={filtro === id} onClick={() => setFiltro(id)} />
        ))}
      </div>

      {/* ── Tabla ──
          `min-w-0`: esta tarjeta también es hija flex, así que necesita la
          misma protección que el contenedor de página (ver arriba) para no
          re-inflarse por el mínimo automático. Con ella, el desbordamiento de
          la tabla se queda DENTRO del `overflow-x-auto` de abajo: conserva
          todas sus columnas y se desplaza de lado, sin sacrificar
          información ni romper la página. */}
      <div
        className="libro-consecutivo__tarjeta rounded-xl overflow-hidden min-w-0"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="libro-consecutivo__scroll overflow-x-auto">
          <table id={ID_TABLA_LIBRO_CONSECUTIVO} className="w-full border-collapse text-sm">
            <caption className="sr-only">{`Libro consecutivo de licencias, año ${año}, filtro ${filtro}${terminoBusqueda ? `, búsqueda "${terminoBusqueda}"` : ''}`}</caption>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Th ancho={190}>N.° expediente</Th>
                <Th ancho={110}>Fecha radicación</Th>
                <Th>Solicitante</Th>
                <Th ancho={150}>Tipo</Th>
                <Th ancho={190}>Estado</Th>
                <Th ancho={130}>Vence</Th>
                <Th ancho={120}>Vigencia hasta</Th>
                <Th ancho={110}>N.° licencia</Th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Cargando libro consecutivo…
                  </td>
                </tr>
              )}
              {!cargando && !error && filas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Sin expedientes en {año}
                  </td>
                </tr>
              )}
              {!cargando && filas.length > 0 && filasVisibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm" style={{ color: 'var(--text-primary)' }}>
                    {terminoBusqueda ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="font-medium">
                          Sin resultados para &quot;{terminoBusqueda}&quot;{filtro !== 'TODOS' ? ' en el filtro activo' : ''}
                        </p>
                        <button
                          type="button"
                          onClick={() => setBusqueda('')}
                          className="text-xs font-bold underline focus-visible:outline-none focus-visible:ring-2 rounded"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          Limpiar búsqueda
                        </button>
                      </div>
                    ) : (
                      <p className="font-medium">Ningún expediente de {año} coincide con este filtro</p>
                    )}
                  </td>
                </tr>
              )}
              {!cargando &&
                filasVisibles.map((fila) => {
                  const urgencia = urgenciaFilaLibro(fila);
                  const colorUrgencia = COLOR_URGENCIA_LIBRO[urgencia];
                  const colorTextoUrgencia = COLOR_TEXTO_URGENCIA_LIBRO[urgencia];
                  const textoDias = textoDiasVencimientoLibro(fila);
                  const textoColision = textoColisionLibro(fila);
                  const subtipos = subtiposConEstadoLibro(fila.subtipoCodigos);
                  const tituloSubtipos = fila.subtipos.join(', ');

                  return (
                    // `data-urgencia`: gancho de impresión. En papel los tokens
                    // `--color-warning`/`--color-success` son ilegibles (2,15:1
                    // y 3,30:1, ver ADR-0030) y encima el color viene de un
                    // estilo en línea, así que `globals.css` necesita este
                    // selector para poder oscurecerlos.
                    <tr key={fila.id} className="micro-row" data-urgencia={urgencia} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {/* `borderLeftColor` es INVISIBLE en pantalla (ancho 0):
                          existe para que al imprimir, donde la sombra no sale,
                          `globals.css` pueda darle ancho al borde y la franja
                          de urgencia sobreviva al papel. */}
                      <td className="px-3 py-2.5 align-top" style={{ boxShadow: `inset 4px 0 0 0 ${colorUrgencia}`, borderLeftColor: colorUrgencia }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setExpedienteSeleccionadoId(fila.id)}
                            className="focus-visible:outline-none focus-visible:ring-2 rounded"
                            aria-haspopup="dialog"
                          >
                            <NumeroLegal value={fila.numeroExpediente} variant="expediente" size="sm" />
                          </button>
                          {fila.esPrueba && <ChipPrueba />}
                          {/* La marca se enciende SOLO con el flag persistido del
                              importador, nunca comparando números repetidos en la
                              vista — ver el JSDoc de `colision` en
                              `presentacion-libro-consecutivo.ts`. */}
                          {textoColision !== null && <EtiquetaColisionNumero explicacion={textoColision} />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {formatFechaColombia(fila.fechaRadicacion)}
                      </td>
                      <td className="px-3 py-2.5 align-top" style={{ maxWidth: 220 }}>
                        {fila.faltaCedula ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{fila.solicitanteNombre || 'Sin nombre registrado'}</span>
                            <EtiquetaDatoFaltante texto="Sin cédula" />
                          </div>
                        ) : (
                          <>
                            <p style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{fila.solicitanteNombre}</p>
                            <p style={{ color: 'var(--text-secondary)' }}>{fila.solicitanteDocumento}</p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top" style={{ maxWidth: 150 }}>
                        <div className="truncate" title={tituloSubtipos}>
                          {subtipos.map((s, i) => (
                            <span
                              key={s.codigo + i}
                              className="text-xs"
                              style={s.enCuarentena ? { color: '#9A6206', fontStyle: 'italic' } : { color: 'var(--text-secondary)' }}
                            >
                              {i > 0 ? ' · ' : ''}
                              {s.enCuarentena ? `? ${s.nombre}` : s.nombre}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {fila.faltaEstadoJuridico ? (
                          <EtiquetaDatoFaltante texto="Sin estado" />
                        ) : (
                          <ChipEstadoJuridico estado={fila.estadoJuridico} />
                        )}
                      </td>
                      <td className="libro-consecutivo__vence px-3 py-2.5 align-top whitespace-nowrap">
                        {fila.fechaAlertaConservadora ? (
                          <>
                            <p className="font-bold" style={{ color: colorTextoUrgencia }}>
                              {formatFechaColombia(fila.fechaAlertaConservadora)}
                            </p>
                            {textoDias !== null && (
                              <p className="text-[11px]" style={{ color: colorTextoUrgencia }}>
                                {textoDias}
                              </p>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap" style={{ color: 'var(--text-primary)' }} title={fila.vigenciaHastaError}>
                        {fila.vigenciaHasta ? formatFechaColombia(fila.vigenciaHasta) : '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {fila.numeroLicencia ?? '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pie: conteos de reconciliación (sobre el TOTAL del año, no del filtro/búsqueda activos) ── */}
      <p className="text-xs print:hidden" style={{ color: 'var(--text-secondary)' }}>
        {conteos.total} expediente{conteos.total === 1 ? '' : 's'} en {año} · {conteos.prueba} de prueba · {conteos.conActoFinal} con acto final
        {(filtro !== 'TODOS' || terminoBusqueda) &&
          ` · ${filasVisibles.length} visible${filasVisibles.length === 1 ? '' : 's'} con ${
            filtro !== 'TODOS' && terminoBusqueda ? 'el filtro y la búsqueda activos' : filtro !== 'TODOS' ? 'el filtro activo' : 'la búsqueda activa'
          }`}
      </p>

      {expedienteSeleccionadoId && (
        <PanelDetalleExpediente
          expedienteId={expedienteSeleccionadoId}
          onCerrar={() => setExpedienteSeleccionadoId(null)}
          // El panel sabe SOLO si hay colisión (viaja en su propio fetch);
          // con quién colisiona se deriva del índice de filas del año, que
          // vive aquí. Se le pasa ya redactado por la misma función pura.
          textoColision={textoColisionLibro(
            filas.find((f) => f.id === expedienteSeleccionadoId) ?? { colision: false, numeroExpediente: '', otrosConMismoNumero: [] },
          )}
        />
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
