'use client';

import { useMemo, useState } from 'react';
import type { AporteRequisito, ContextoEvaluacionRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { evaluarCompletitud } from '@/lib/motor-expedientes/completitud';
import type { EstadoVisualRequisito } from '../estilos-estado-requisito';
import { CATEGORIAS_DOCUMENTOS, categoriaDeRequisito } from '../categorias-documentos';
import { PanelHechosCaso } from './PanelHechosCaso';
import { RequisitoItem } from './RequisitoItem';
import { OtrosDocumentos } from './OtrosDocumentos';
import { DocumentSummary } from './DocumentSummary';
import { DocumentFilters, type ConteosFiltro, type FiltroDoc } from './DocumentFilters';
import { DocumentCategory } from './DocumentCategory';

/* ══════════════════════════════════════════════════════════════
   Vista «Documentos del trámite» — Bloque A·A3 (ADR-0026 D4/D7, ADR-0029).
   Orquesta el evaluador REAL (`evaluarCompletitud`) contra `documentos`,
   `aportes` y el `contexto` vivo del caso — nunca reimplementa la evaluación,
   solo la traduce a estado visual por requisito.

   FASE 2 (rediseño): resumen por estado → filtros + buscador → categorías
   colapsables (01–06) → filas compactas. Las categorías son una capa de
   PRESENTACIÓN (`../categorias-documentos.ts`): NO cambian el resultado del
   evaluador. El filtro, la búsqueda y el expandido son estado LOCAL de UI —
   la fuente de verdad sigue siendo el expediente, propiedad del padre.
══════════════════════════════════════════════════════════════ */

/** Minúsculas y sin tildes, para que la búsqueda no dependa de acentos. */
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface ChecklistRequisitosProps {
  expedienteId: string;
  definicion: DefinicionTramite;
  contexto: ContextoEvaluacionRequisito;
  aportes: AporteRequisito[];
  documentos: DocumentoExpedienteDoc[];
  soloLectura: boolean;
  /** Motivo mostrado al funcionario cuando `soloLectura` — p. ej. "Expediente histórico migrado" o "Expediente en firme". */
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

  /**
   * Traduce el `ResultadoCompletitud` (ya calculado por el evaluador real) a UN
   * estado visual por requisito. Idéntico a la versión anterior — NO cambia la
   * lógica. Ver JSDoc histórico en el evaluador para el orden de exclusión.
   */
  const estadoDe = useMemo(() => {
    return (requisitoId: string): EstadoVisualRequisito => {
      if (resultado.aportesDuplicados.some((d) => d.requisitoId === requisitoId)) return 'DUPLICADO';
      if (resultado.indeterminados.some((i) => i.requisitoId === requisitoId)) return 'INDETERMINADO';
      if (resultado.noAplicables.includes(requisitoId)) return 'NO_APLICA';
      if (resultado.faltantes.some((f) => f.requisitoId === requisitoId)) return 'PENDIENTE';
      const aporte = aportePorRequisito.get(requisitoId);
      const aportado = aporte?.estado === 'APORTADO' && aporte.documentoIds.length > 0;
      return aportado ? 'APORTADO' : 'NO_APLICA';
    };
  }, [resultado, aportePorRequisito]);

  // ── Contadores del resumen — IDÉNTICOS (D-1). Un solo eje de ESTADO. ─────
  const totalNoOpcionales = definicion.requisitos.filter((r) => r.tipo !== 'OPCIONAL').length;
  const noResueltos = resultado.noAplicables.length + resultado.indeterminados.length + resultado.aportesDuplicados.length;
  const aplicables = Math.max(0, totalNoOpcionales - noResueltos);
  const aportados = Math.max(0, aplicables - resultado.faltantes.length);
  const pendientes = resultado.faltantes.length;
  const requiereCorreccion = resultado.aportesDuplicados.length;
  const sinDefinir = resultado.indeterminados.length;

  // ── Cada requisito con su estado y su categoría (presentación) ───────────
  const listaVista = useMemo(
    () => definicion.requisitos.map((r) => ({ requisito: r, estado: estadoDe(r.id), categoria: categoriaDeRequisito(r.id) })),
    [definicion, estadoDe],
  );

  // ── Conteos por filtro (sobre requisitos REALES) ─────────────────────────
  const conteos: ConteosFiltro = useMemo(() => {
    const c: ConteosFiltro = { TODOS: 0, APORTADO: 0, PENDIENTE: 0, CONDICIONAL: 0, DUPLICADO: 0, INDETERMINADO: 0 };
    for (const { requisito, estado } of listaVista) {
      c.TODOS++;
      if (estado === 'APORTADO') c.APORTADO++;
      if (estado === 'PENDIENTE') c.PENDIENTE++;
      if (estado === 'DUPLICADO') c.DUPLICADO++;
      if (estado === 'INDETERMINADO') c.INDETERMINADO++;
      if (requisito.tipo === 'CONDICIONAL') c.CONDICIONAL++;
    }
    return c;
  }, [listaVista]);

  // ── Avance por categoría (global, no del subconjunto filtrado) ───────────
  const statsCategoria = useMemo(() => {
    const m = new Map<string, { aportados: number; exigibles: number }>();
    for (const { estado, categoria } of listaVista) {
      const s = m.get(categoria) ?? { aportados: 0, exigibles: 0 };
      if (estado !== 'NO_APLICA') s.exigibles++;
      if (estado === 'APORTADO') s.aportados++;
      m.set(categoria, s);
    }
    return m;
  }, [listaVista]);

  const [filtro, setFiltro] = useState<FiltroDoc>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  // Por defecto se expanden las categorías INCOMPLETAS (donde aún falta trabajo).
  const [expandidas, setExpandidas] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const cat of CATEGORIAS_DOCUMENTOS) {
      const s = statsCategoria.get(cat.numero);
      if (s && s.exigibles > 0 && s.aportados < s.exigibles) set.add(cat.numero);
    }
    return set;
  });

  const filtroActivo = filtro !== 'TODOS' || busqueda.trim() !== '';
  const q = normalizar(busqueda.trim());

  function coincideFiltro(estado: EstadoVisualRequisito, tipo: string): boolean {
    switch (filtro) {
      case 'TODOS': return true;
      case 'CONDICIONAL': return tipo === 'CONDICIONAL';
      default: return estado === filtro;
    }
  }
  function coincideBusqueda(nombre: string, descripcion?: string): boolean {
    if (q === '') return true;
    return normalizar(`${nombre} ${descripcion ?? ''}`).includes(q);
  }
  function alternarCategoria(numero: string) {
    setExpandidas((prev) => {
      const n = new Set(prev);
      if (n.has(numero)) n.delete(numero); else n.add(numero);
      return n;
    });
  }

  const otrosDocumentos = documentos.filter((d) => !d.requisitoId);

  return (
    <div className="flex flex-col gap-3">
      <DocumentSummary
        aportados={aportados}
        aplicables={aplicables}
        pendientes={pendientes}
        requiereCorreccion={requiereCorreccion}
        sinDefinir={sinDefinir}
        completo={resultado.completo}
      />

      {soloLectura && motivoSoloLectura && (
        <p className="text-xs px-1" style={{ color: 'var(--text-secondary)' }}>{motivoSoloLectura}</p>
      )}

      {definicion.clavesContexto && definicion.clavesContexto.length > 0 && (
        <PanelHechosCaso
          expedienteId={expedienteId}
          clavesContexto={definicion.clavesContexto}
          contexto={contexto}
          soloLectura={soloLectura}
          onActualizado={onContextoActualizado}
        />
      )}

      <DocumentFilters activo={filtro} onCambiar={setFiltro} conteos={conteos} busqueda={busqueda} onBuscar={setBusqueda} />

      {/* CATEGORÍAS 01–06 — capa de presentación; el evaluador no las mira. */}
      <div className="flex flex-col gap-2.5">
        {CATEGORIAS_DOCUMENTOS.map((cat) => {
          const items = listaVista.filter((v) => v.categoria === cat.numero);
          if (items.length === 0) return null;
          const filtrados = items.filter(
            (v) => coincideFiltro(v.estado, v.requisito.tipo) && coincideBusqueda(v.requisito.nombre, v.requisito.descripcion),
          );
          // Con filtro/búsqueda activos, una categoría sin coincidencias se oculta.
          if (filtroActivo && filtrados.length === 0) return null;
          const mostrar = filtroActivo ? filtrados : items;
          const st = statsCategoria.get(cat.numero) ?? { aportados: 0, exigibles: 0 };
          return (
            <DocumentCategory
              key={cat.numero}
              numero={cat.numero}
              titulo={cat.titulo}
              descripcion={cat.descripcion}
              aportados={st.aportados}
              total={st.exigibles}
              expandido={filtroActivo || expandidas.has(cat.numero)}
              onToggle={() => alternarCategoria(cat.numero)}
              idContenido={`categoria-${cat.numero}`}
            >
              <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {mostrar.map(({ requisito, estado }) => {
                  const aporte = aportePorRequisito.get(requisito.id);
                  const documentoId = aporte?.documentoIds?.[0];
                  const indeterminado = resultado.indeterminados.find((i) => i.requisitoId === requisito.id);
                  return (
                    <RequisitoItem
                      key={requisito.id}
                      expedienteId={expedienteId}
                      requisito={requisito}
                      estado={estado}
                      documento={documentoId ? documentoPorId.get(documentoId) : undefined}
                      clavesFaltantesIndeterminado={indeterminado?.clavesFaltantes}
                      soloLectura={soloLectura}
                      onDocumentoSubido={onDocumentoSubido}
                    />
                  );
                })}
              </ul>
            </DocumentCategory>
          );
        })}
      </div>

      <OtrosDocumentos
        expedienteId={expedienteId}
        documentos={otrosDocumentos}
        soloLectura={soloLectura}
        onDocumentoSubido={onDocumentoSubido}
      />

      {/* AYUDA — secundaria, no compite con los documentos. */}
      <p className="mt-1 flex items-center gap-1.5 px-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M9.6 9.4a2.4 2.4 0 0 1 4.2 1.5c0 1.6-2.4 1.8-2.4 3.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="11.4" cy="16.4" r="0.9" fill="currentColor" /></svg>
        </span>
        ¿Necesitas ayuda? Consulta la guía del trámite o comunícate con Planeación.
      </p>
    </div>
  );
}
