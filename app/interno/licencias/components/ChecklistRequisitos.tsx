'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { AporteRequisito, ContextoEvaluacionRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { evaluarCompletitud, type ResultadoCompletitud } from '@/lib/motor-expedientes/completitud';
import type { EstadoVisualRequisito } from '../estilos-estado-requisito';
import {
  CATEGORIAS_DOCUMENTOS,
  categoriaDeRequisito,
  type CategoriaDocumentoId,
} from '../categorias-documentos';
import { PanelHechosCaso } from './PanelHechosCaso';
import { RequisitoItem, GRID_TEMPLATE_MD } from './RequisitoItem';
import { OtrosDocumentos } from './OtrosDocumentos';

/* ══════════════════════════════════════════════════════════════
   DOCUMENTACIÓN DEL TRÁMITE — rediseño de la vista (solo presentación).

   Orquesta el evaluador REAL (`evaluarCompletitud`) contra `documentos`,
   `aportes` y el `contexto` vivo del caso. NUNCA reimplementa la evaluación de
   condiciones ni el cálculo de completitud: solo lo traduce a una vista clara
   —resumen, filtros, buscador y secciones colapsables por categoría—. Todos
   los contadores salen de las listas del evaluador; ninguno se escribe a mano.

   Componente CONTROLADO: recibe todo por props y reporta los dos únicos
   cambios posibles (contexto actualizado, documento subido) al padre. El único
   estado LOCAL es de presentación (filtro activo, búsqueda, sección abierta) —
   no duplica la fuente de verdad del expediente.

   La categoría de cada requisito es presentación pura (`categorias-documentos.ts`),
   no un dato del modelo.
══════════════════════════════════════════════════════════════ */

type FiltroDoc = 'todos' | 'aportados' | 'pendientes' | 'rechazados';

function estadoDe(
  requisitoId: string,
  resultado: ResultadoCompletitud,
  aportePorRequisito: Map<string, AporteRequisito>,
): EstadoVisualRequisito {
  if (resultado.aportesDuplicados.some((d) => d.requisitoId === requisitoId)) return 'DUPLICADO';
  if (resultado.indeterminados.some((i) => i.requisitoId === requisitoId)) return 'INDETERMINADO';
  if (resultado.noAplicables.includes(requisitoId)) return 'NO_APLICA';
  if (resultado.faltantes.some((f) => f.requisitoId === requisitoId)) return 'PENDIENTE';
  const aporte = aportePorRequisito.get(requisitoId);
  const aportado = aporte?.estado === 'APORTADO' && aporte.documentoIds.length > 0;
  return aportado ? 'APORTADO' : 'NO_APLICA'; // opcional sin aportar: informativo, nunca bloquea.
}

/** Normaliza para búsqueda: minúsculas + sin tildes. */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ESTADOS_EN_JUEGO: readonly EstadoVisualRequisito[] = ['APORTADO', 'PENDIENTE', 'INDETERMINADO', 'DUPLICADO'];

function pasaFiltro(estado: EstadoVisualRequisito, filtro: FiltroDoc): boolean {
  switch (filtro) {
    case 'aportados': return estado === 'APORTADO';
    case 'pendientes': return estado === 'PENDIENTE' || estado === 'INDETERMINADO';
    case 'rechazados': return estado === 'DUPLICADO';
    case 'todos': return (ESTADOS_EN_JUEGO as readonly string[]).includes(estado);
  }
}

export interface ChecklistRequisitosProps {
  expedienteId: string;
  definicion: DefinicionTramite;
  contexto: ContextoEvaluacionRequisito;
  aportes: AporteRequisito[];
  documentos: DocumentoExpedienteDoc[];
  soloLectura: boolean;
  motivoSoloLectura?: string;
  onContextoActualizado: (nuevoContexto: ContextoEvaluacionRequisito) => void;
  onDocumentoSubido: () => void;
}

export function ChecklistRequisitos({
  expedienteId,
  definicion,
  contexto,
  aportes,
  documentos,
  soloLectura,
  motivoSoloLectura,
  onContextoActualizado,
  onDocumentoSubido,
}: ChecklistRequisitosProps) {
  const resultado = useMemo(() => evaluarCompletitud(definicion, aportes, contexto), [definicion, aportes, contexto]);
  const documentoPorId = useMemo(() => new Map(documentos.map((d) => [d.id, d] as const)), [documentos]);
  const aportePorRequisito = useMemo(() => new Map(aportes.map((a) => [a.requisitoId, a] as const)), [aportes]);

  /** Un registro por requisito, con su estado ya calculado y su documento vigente. */
  const filas = useMemo(() => definicion.requisitos.map((requisito) => {
    const estado = estadoDe(requisito.id, resultado, aportePorRequisito);
    const documentoId = aportePorRequisito.get(requisito.id)?.documentoIds?.[0];
    return {
      requisito,
      estado,
      categoria: categoriaDeRequisito(requisito.id),
      documento: documentoId ? documentoPorId.get(documentoId) : undefined,
      clavesFaltantes: resultado.indeterminados.find((i) => i.requisitoId === requisito.id)?.clavesFaltantes,
    };
  }), [definicion, resultado, aportePorRequisito, documentoPorId]);

  /* Contadores GLOBALES — todos derivados de `filas` (que sale del evaluador). */
  const conteo = useMemo(() => {
    const c = { aportado: 0, pendiente: 0, indeterminado: 0, duplicado: 0, noAplica: 0 };
    for (const f of filas) {
      if (f.estado === 'APORTADO') c.aportado++;
      else if (f.estado === 'PENDIENTE') c.pendiente++;
      else if (f.estado === 'INDETERMINADO') c.indeterminado++;
      else if (f.estado === 'DUPLICADO') c.duplicado++;
      else c.noAplica++;
    }
    return c;
  }, [filas]);

  // Denominador de progreso: lo que se SABE exigible (aportado + pendiente +
  // por-corregir). Los INDETERMINADOS se excluyen a propósito —aún no se sabe
  // si se exigen: dependen de «Hechos del caso», y el evaluador también los
  // descuenta— y se muestran aparte como «por definir». Criterio histórico.
  const aplicables = conteo.aportado + conteo.pendiente + conteo.duplicado;
  const aportados = conteo.aportado;
  const porDefinir = conteo.indeterminado;
  const pct = aplicables > 0 ? Math.round((aportados / aplicables) * 100) : 0;
  const completo = resultado.completo;

  const contadoresFiltro: Record<FiltroDoc, number> = {
    todos: aplicables + porDefinir,
    aportados: conteo.aportado,
    pendientes: conteo.pendiente + conteo.indeterminado,
    rechazados: conteo.duplicado,
  };

  const [filtro, setFiltro] = useState<FiltroDoc>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seccionAbierta, setSeccionAbierta] = useState<CategoriaDocumentoId | null>(() => {
    // Abre por defecto la primera sección con algo pendiente; si todo está
    // completo, la primera con documentos aplicables.
    const inicialResultado = evaluarCompletitud(definicion, aportes, contexto);
    const apPorReq = new Map(aportes.map((a) => [a.requisitoId, a] as const));
    const porCategoria = new Map<CategoriaDocumentoId, { aplic: number; falta: number }>();
    for (const r of definicion.requisitos) {
      const est = estadoDe(r.id, inicialResultado, apPorReq);
      const cat = categoriaDeRequisito(r.id);
      const acc = porCategoria.get(cat) ?? { aplic: 0, falta: 0 };
      if ((ESTADOS_EN_JUEGO as readonly string[]).includes(est)) acc.aplic++;
      if (est !== 'APORTADO' && (ESTADOS_EN_JUEGO as readonly string[]).includes(est)) acc.falta++;
      porCategoria.set(cat, acc);
    }
    for (const cat of CATEGORIAS_DOCUMENTOS) {
      if ((porCategoria.get(cat.id)?.falta ?? 0) > 0) return cat.id;
    }
    for (const cat of CATEGORIAS_DOCUMENTOS) {
      if ((porCategoria.get(cat.id)?.aplic ?? 0) > 0) return cat.id;
    }
    return CATEGORIAS_DOCUMENTOS[0]?.id ?? null;
  });

  const filtrando = filtro !== 'todos' || busqueda.trim() !== '';
  const busquedaNorm = normalizar(busqueda.trim());

  function coincideBusqueda(fila: (typeof filas)[number]): boolean {
    if (!busquedaNorm) return true;
    const enNombre = normalizar(fila.requisito.nombre).includes(busquedaNorm);
    const enDesc = fila.requisito.descripcion ? normalizar(fila.requisito.descripcion).includes(busquedaNorm) : false;
    const enArchivo = fila.documento ? normalizar(fila.documento.nombre).includes(busquedaNorm) : false;
    return enNombre || enDesc || enArchivo;
  }

  /** Datos por sección (categoría), en el orden declarado. */
  const secciones = useMemo(() => CATEGORIAS_DOCUMENTOS.map((cat) => {
    const propias = filas.filter((f) => f.categoria === cat.id);
    const enJuego = propias.filter((f) => (ESTADOS_EN_JUEGO as readonly string[]).includes(f.estado));
    // El denominador «X de Y» cuenta lo SABIDO exigible; los indeterminados no
    // entran (aún no se sabe si aplican) — se muestran, pero no en el total.
    const aplicablesCat = enJuego.filter((f) => f.estado !== 'INDETERMINADO').length;
    const aportadosCat = enJuego.filter((f) => f.estado === 'APORTADO').length;
    // Vista filtrada
    const visiblesEnJuego = propias.filter((f) => pasaFiltro(f.estado, filtro) && coincideBusqueda(f));
    const visiblesNoAplica = filtro === 'todos'
      ? propias.filter((f) => f.estado === 'NO_APLICA' && coincideBusqueda(f))
      : [];
    return { cat, asignados: propias.length, aplicablesCat, aportadosCat, visiblesEnJuego, visiblesNoAplica, totalVisibles: visiblesEnJuego.length + visiblesNoAplica.length };
  }), [filas, filtro, busquedaNorm]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalResultados = secciones.reduce((n, s) => n + s.totalVisibles, 0);

  function estaExpandida(catId: CategoriaDocumentoId): boolean {
    return filtrando ? true : seccionAbierta === catId;
  }
  function alternarSeccion(catId: CategoriaDocumentoId) {
    setSeccionAbierta((prev) => (prev === catId ? null : catId));
  }

  const nombrePendientes = filas
    .filter((f) => f.estado === 'PENDIENTE')
    .slice(0, 4)
    .map((f) => f.requisito.nombre);

  return (
    <section className="flex w-full min-w-0 flex-col gap-4" aria-label="Documentación del trámite">
      {/* ── Encabezado del módulo ── */}
      <header className="flex flex-wrap items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: '#E7F6EC', color: '#14532D' }}
        >
          <IconoTecnicos />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Documentación del trámite
          </p>
          <h2 className="break-words font-headline text-xl leading-tight md:text-2xl" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
            {definicion.nombre}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Adjunta los documentos requeridos para continuar con tu trámite.
          </p>
        </div>
      </header>

      {/* ── Tarjeta de resumen (lo primero que se identifica) ── */}
      <TarjetaResumen
        completo={completo}
        aportados={aportados}
        aplicables={aplicables}
        porDefinir={porDefinir}
        pct={pct}
        pendientes={contadoresFiltro.pendientes}
        rechazados={contadoresFiltro.rechazados}
        nombrePendientes={nombrePendientes}
        onVerPendientes={() => { setFiltro('pendientes'); setBusqueda(''); }}
      />

      {soloLectura && motivoSoloLectura && (
        <p className="rounded-xl px-4 py-2.5 text-sm" style={{ background: '#EEF2F5', color: 'var(--text-secondary)', border: '1px solid var(--color-border)' }}>
          {motivoSoloLectura}
        </p>
      )}

      {/* ── Hechos del caso (definen QUÉ se exige) ── */}
      {definicion.clavesContexto && definicion.clavesContexto.length > 0 && (
        <PanelHechosCaso
          expedienteId={expedienteId}
          clavesContexto={definicion.clavesContexto}
          contexto={contexto}
          soloLectura={soloLectura}
          onActualizado={onContextoActualizado}
        />
      )}

      {/* ── Filtros + buscador ── */}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
        <div role="group" aria-label="Filtrar documentos" className="flex min-w-0 flex-wrap gap-1.5">
          <ChipFiltro etiqueta="Todos" n={contadoresFiltro.todos} activo={filtro === 'todos'} onClick={() => setFiltro('todos')} color="verde" icono={<IconoLista />} />
          <ChipFiltro etiqueta="Aportados" n={contadoresFiltro.aportados} activo={filtro === 'aportados'} onClick={() => setFiltro('aportados')} color="verde" icono={<IconoCheck />} />
          <ChipFiltro etiqueta="Pendientes" n={contadoresFiltro.pendientes} activo={filtro === 'pendientes'} onClick={() => setFiltro('pendientes')} color="ambar" icono={<IconoReloj />} />
          <ChipFiltro etiqueta="Rechazados" n={contadoresFiltro.rechazados} activo={filtro === 'rechazados'} onClick={() => setFiltro('rechazados')} color="rojo" icono={<IconoAlerta />} />
        </div>
        <div className="relative w-full min-w-0 lg:ml-auto lg:w-72">
          <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#2563EB' }}><IconoBuscar /></span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar documento…"
            aria-label="Buscar documento por nombre"
            className="w-full rounded-xl pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {filtrando && (
        <p className="text-xs -mt-1" style={{ color: 'var(--text-secondary)' }}>
          {totalResultados === 0
            ? 'Ningún documento coincide con el filtro o la búsqueda.'
            : `${totalResultados} documento${totalResultados === 1 ? '' : 's'} coinciden.`}
        </p>
      )}

      {/* ── Secciones por categoría (acordeón) ── */}
      <div className="flex w-full min-w-0 flex-col gap-3">
        {secciones.map(({ cat, asignados, aplicablesCat, aportadosCat, visiblesEnJuego, visiblesNoAplica, totalVisibles }) => {
          if (asignados === 0) return null; // categoría sin requisitos asignados: no se muestra
          if (filtrando && totalVisibles === 0) return null; // oculta secciones sin coincidencias al filtrar
          const completoCat = aplicablesCat > 0 && aportadosCat === aplicablesCat;
          const expandida = estaExpandida(cat.id);
          return (
            <div key={cat.id} className="w-full min-w-0 overflow-hidden rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}>
              <button
                type="button"
                onClick={() => alternarSeccion(cat.id)}
                aria-expanded={expandida}
                className="flex w-full min-w-0 flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset md:flex-nowrap"
              >
                <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#14532D', color: '#fff' }}>
                  {cat.numero}
                </span>
                <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#E7F6EC', color: '#14532D' }}>
                  <IconoCategoria id={cat.id} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-bold leading-snug line-clamp-2 md:text-[15px] md:truncate" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{cat.nombre}</span>
                  <span className="block break-words text-xs leading-snug line-clamp-2 md:truncate" style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{cat.descripcion}</span>
                </span>
                <span className="order-4 ml-auto flex basis-full justify-end md:order-none md:ml-0 md:basis-auto">
                  <ContadorSeccion aportados={aportadosCat} aplicables={aplicablesCat} completo={completoCat} />
                </span>
                <span aria-hidden className="shrink-0 transition-transform duration-200" style={{ color: 'var(--text-secondary)', transform: expandida ? 'rotate(180deg)' : 'none' }}>
                  <IconoChevron />
                </span>
              </button>

              {expandida && (
                <div style={{ borderTop: '1px solid var(--color-border)' }}>
                  {/* Encabezado de columnas (solo escritorio) */}
                  {totalVisibles > 0 && (
                    <div className={`hidden md:grid items-center gap-x-3 px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider ${GRID_TEMPLATE_MD}`} style={{ color: 'var(--text-muted)' }}>
                      <span>#</span><span>Documento</span><span>Requisito / Descripción</span><span>Estado</span><span>Archivo</span><span className="text-right">Acciones</span>
                    </div>
                  )}
                  {totalVisibles === 0 ? (
                    <p className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Sin documentos en esta vista.</p>
                  ) : (
                    <ul className="flex flex-col">
                      {visiblesEnJuego.map((f, i) => (
                        <RequisitoItem
                          key={f.requisito.id}
                          expedienteId={expedienteId}
                          requisito={f.requisito}
                          estado={f.estado}
                          documento={f.documento}
                          clavesFaltantesIndeterminado={f.clavesFaltantes}
                          soloLectura={soloLectura}
                          onDocumentoSubido={onDocumentoSubido}
                          indice={i + 1}
                        />
                      ))}
                    </ul>
                  )}

                  {visiblesNoAplica.length > 0 && (
                    <div style={{ borderTop: '1px dashed var(--color-border)' }}>
                      <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        No se exigen en este caso · {visiblesNoAplica.length}
                      </p>
                      <ul className="flex flex-col">
                        {visiblesNoAplica.map((f, i) => (
                          <RequisitoItem
                            key={f.requisito.id}
                            expedienteId={expedienteId}
                            requisito={f.requisito}
                            estado={f.estado}
                            documento={f.documento}
                            soloLectura={soloLectura}
                            onDocumentoSubido={onDocumentoSubido}
                            indice={i + 1}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Otros documentos (anexos sin requisito) ── */}
      <OtrosDocumentos
        expedienteId={expedienteId}
        documentos={documentos.filter((d) => !d.requisitoId)}
        soloLectura={soloLectura}
        onDocumentoSubido={onDocumentoSubido}
      />

      {/* ── Nota informativa ── */}
      <p className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs" style={{ background: '#EEF4FF', color: '#1E4FA0' }}>
        <span aria-hidden className="mt-0.5 shrink-0"><IconoInfo /></span>
        <span><strong>Importante:</strong> asegúrate de que los documentos sean legibles y no superen 10 MB por archivo.</span>
      </p>
    </section>
  );
}

/* ════════════════ Subcomponentes de presentación ════════════════ */

function TarjetaResumen({
  completo, aportados, aplicables, porDefinir, pct, pendientes, rechazados, nombrePendientes, onVerPendientes,
}: {
  completo: boolean; aportados: number; aplicables: number; porDefinir: number; pct: number;
  pendientes: number; rechazados: number; nombrePendientes: string[]; onVerPendientes: () => void;
}) {
  const faltan = Math.max(0, aplicables - aportados);
  return (
    <div
      className="rounded-2xl p-5 md:p-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-center"
      style={completo
        ? { background: '#F1F9F3', border: '1px solid #CDE9D6' }
        : { background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
    >
      {/* Estado */}
      <div className="flex items-center gap-3.5 min-w-0">
        <span aria-hidden className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={completo ? { background: '#16A34A', color: '#fff' } : { background: '#FAEEDA', color: '#B7791F' }}>
          {completo ? <IconoCheckGrande /> : <IconoReloj />}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight" style={{ color: completo ? '#116932' : 'var(--text-primary)' }}>
            {completo ? 'Trámite completo' : `${faltan} documento${faltan === 1 ? '' : 's'} por completar`}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {completo
              ? 'Todos los documentos requeridos han sido aportados.'
              : 'Estos documentos requieren tu atención para continuar.'}
          </p>
        </div>
      </div>

      {/* Progreso */}
      <div className="min-w-0">
        <p className="text-sm mb-1.5" style={{ color: 'var(--text-primary)' }}>
          <strong className="text-base">{aportados} de {aplicables}</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>documentos</span>
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" role="progressbar" aria-label="Documentos aportados" aria-valuenow={aportados} aria-valuemin={0} aria-valuemax={aplicables} style={{ background: '#E4EAE6' }}>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: completo ? '#16A34A' : '#4E9A5F' }} />
          </div>
          <span className="text-sm font-bold shrink-0" style={{ color: completo ? '#116932' : '#4E9A5F' }}>{pct}%</span>
        </div>
        {rechazados > 0 && (
          <p className="text-xs mt-1.5" style={{ color: '#911111' }}>{rechazados} requiere{rechazados === 1 ? '' : 'n'} corrección.</p>
        )}
        {porDefinir > 0 && (
          <p className="text-xs mt-1.5" style={{ color: '#1E4FA0' }}>{porDefinir} por definir en «Hechos del caso».</p>
        )}
      </div>

      {/* Acción / mensaje lateral */}
      {completo ? (
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 md:max-w-[220px]" style={{ background: '#E7F6EC' }}>
          <span aria-hidden style={{ color: '#14532D' }}><IconoTecnicos /></span>
          <p className="text-sm font-semibold leading-snug" style={{ color: '#14532D' }}>Puedes continuar con tu trámite</p>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2 md:max-w-[240px]">
          <button
            type="button"
            onClick={onVerPendientes}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:brightness-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2"
            style={{ background: '#14532D', color: '#fff', boxShadow: '0 2px 8px rgba(20,83,45,0.25)' }}
          >
            Ver pendientes
          </button>
          {nombrePendientes.length > 0 && (
            <p className="break-words text-xs leading-snug" style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              {nombrePendientes.join(' · ')}{pendientes > nombrePendientes.length ? ' …' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ChipFiltro({ etiqueta, n, activo, onClick, color, icono }: {
  etiqueta: string; n: number; activo: boolean; onClick: () => void;
  color: 'verde' | 'ambar' | 'rojo'; icono: ReactNode;
}) {
  const acento = color === 'verde' ? '#14532D' : color === 'ambar' ? '#8E5C06' : '#911111';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
      style={activo
        ? { background: '#14532D', color: '#fff', border: '1px solid #14532D' }
        : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--color-border)' }}
    >
      <span aria-hidden style={{ color: activo ? '#fff' : acento }}>{icono}</span>
      {etiqueta}
      <span
        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold"
        style={activo ? { background: 'rgba(255,255,255,0.22)', color: '#fff' } : { background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
      >
        {n}
      </span>
    </button>
  );
}

function ContadorSeccion({ aportados, aplicables, completo }: { aportados: number; aplicables: number; completo: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap"
      style={completo ? { background: '#E7F6EC', color: '#116932' } : { background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
    >
      {aportados} de {aplicables}
      {completo && <span aria-hidden style={{ color: '#16A34A' }}><IconoCheck /></span>}
    </span>
  );
}

/* ════════════════ Iconos (simples y consistentes) ════════════════ */

function IconoCategoria({ id }: { id: CategoriaDocumentoId }) {
  if (id === 'solicitante') return <IconoUsuario />;
  if (id === 'inmueble') return <IconoInmueble />;
  if (id === 'tecnicos') return <IconoTecnicos />;
  return <IconoCarpeta />;
}
function IconoUsuario() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" /><path d="M5.5 19c.6-3.2 3.2-5 6.5-5s5.9 1.8 6.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>);
}
function IconoInmueble() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 10.5 12 4l8 6.5M6 9.5V19h12V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M10 19v-4.5h4V19" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>);
}
function IconoTecnicos() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M7 3.75h6.5L18.25 8.5V19A1.25 1.25 0 0 1 17 20.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" stroke="currentColor" strokeWidth="1.5" /><path d="M13 4v5h5M8.5 13h7M8.5 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>);
}
function IconoCarpeta() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10l2 2h6.5A1.5 1.5 0 0 1 20 8.5V17a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V6.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>);
}
function IconoChevron() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconoBuscar() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>);
}
function IconoCheck() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconoCheckGrande() {
  return (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconoReloj() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" /><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconoAlerta() {
  return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 4.5 21 19H3L12 4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 10v3.5M12 16.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>);
}
function IconoLista() {
  return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>);
}
function IconoInfo() {
  return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" /><path d="M12 11v5M12 8v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>);
}
