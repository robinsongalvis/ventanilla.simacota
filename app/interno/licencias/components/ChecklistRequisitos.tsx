'use client';

import { useMemo } from 'react';
import type { AporteRequisito, ContextoEvaluacionRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { evaluarCompletitud } from '@/lib/motor-expedientes/completitud';
import type { EstadoVisualRequisito } from '../estilos-estado-requisito';
import { PanelHechosCaso } from './PanelHechosCaso';
import { RequisitoItem } from './RequisitoItem';
import { OtrosDocumentos } from './OtrosDocumentos';

/* ══════════════════════════════════════════════════════════════
   Sección "Checklist de requisitos" — Bloque A·A3 (ADR-0026 D4/D7,
   ADR-0029). Orquesta el evaluador REAL (`evaluarCompletitud`,
   `lib/motor-expedientes/completitud.ts`) contra los `documentos` y
   `aportes` del expediente + el `contexto` vivo del caso — nunca
   reimplementa la evaluación de condiciones ni el cálculo de completitud,
   solo la traduce a estado visual por requisito.

   Componente CONTROLADO: no duplica `contexto`/`aportes`/`documentos` en
   estado local — recibe todo por props y reporta los dos únicos cambios
   posibles (contexto actualizado, documento subido) al padre
   (`DetalleLicenciaClient`), que es quien posee el expediente. Así el
   toggle de un hecho del caso reevalúa el checklist en el MISMO render en
   cuanto el padre re-renderiza con el `contexto` nuevo — sin duplicar la
   fuente de verdad.
══════════════════════════════════════════════════════════════ */

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
   * Traduce el `ResultadoCompletitud` (ya calculado por el evaluador real)
   * a UN estado visual por requisito. Cada requisito de la Definición cae
   * en EXACTAMENTE una de las 4 listas del resultado (duplicado > indeterminado
   * > no-aplica > faltante — mutuamente excluyentes por construcción de
   * `evaluarCompletitud`) o en ninguna, que son los dos casos que el
   * evaluador no reporta por diseño (ver su JSDoc): un OPCIONAL sin aporte
   * (nunca bloquea, nunca se lista) o un requisito ya APORTADO con éxito
   * (tampoco se lista: solo se reportan "problemas" + no-aplicables). Para
   * esos dos, se lee directamente `aporte.estado` — un campo de dato, no
   * una reevaluación de la lógica de condiciones/Kleene del evaluador.
   */
  function estadoDe(requisitoId: string): EstadoVisualRequisito {
    if (resultado.aportesDuplicados.some((d) => d.requisitoId === requisitoId)) return 'DUPLICADO';
    if (resultado.indeterminados.some((i) => i.requisitoId === requisitoId)) return 'INDETERMINADO';
    if (resultado.noAplicables.includes(requisitoId)) return 'NO_APLICA';
    if (resultado.faltantes.some((f) => f.requisitoId === requisitoId)) return 'PENDIENTE';
    const aporte = aportePorRequisito.get(requisitoId);
    const aportado = aporte?.estado === 'APORTADO' && aporte.documentoIds.length > 0;
    return aportado ? 'APORTADO' : 'NO_APLICA'; // opcional sin aportar: informativo, nunca bloquea.
  }

  // "Aplicables" = obligatorios + condicionales que SÍ aplican (se excluyen
  // opcionales, no-aplicables, indeterminados y duplicados — de estos dos
  // últimos el evaluador ni siquiera llegó a decidir su aplicación, ver
  // `completitud.ts`). Identidad exacta con las 4 listas de `resultado`
  // (demostrada en el JSDoc de `estadoDe`): ningún número se inventa fuera
  // de `resultado.*.length` + un conteo estático sobre `definicion.requisitos`.
  const totalNoOpcionales = definicion.requisitos.filter((r) => r.tipo !== 'OPCIONAL').length;
  const noResueltos = resultado.noAplicables.length + resultado.indeterminados.length + resultado.aportesDuplicados.length;
  const aplicables = Math.max(0, totalNoOpcionales - noResueltos);
  const aportados = Math.max(0, aplicables - resultado.faltantes.length);

  const otrosDocumentos = documentos.filter((d) => !d.requisitoId);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-headline text-base" style={{ color: 'var(--text-primary)' }}>Checklist de requisitos</p>
          <span
            className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={resultado.completo ? { background: '#E7F6EC', color: '#116932' } : { background: '#FAEEDA', color: '#7A4F0A' }}
          >
            {resultado.completo ? 'Completo' : 'Incompleto'}
          </span>
        </div>

        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {aportados} de {aplicables} requisitos aplicables aportados
          {resultado.faltantes.length > 0 && <> · faltan {resultado.faltantes.length}</>}
          {resultado.indeterminados.length > 0 && <> · {resultado.indeterminados.length} sin definir en Hechos del caso</>}
          {resultado.aportesDuplicados.length > 0 && <> · {resultado.aportesDuplicados.length} con aportes duplicados</>}
        </p>

        {soloLectura && motivoSoloLectura && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>{motivoSoloLectura}</p>
        )}

        <div
          role="note"
          aria-label="Aviso: checklist parcial"
          className="mt-3 rounded-lg px-3 py-2 text-xs flex gap-2"
          style={{ background: '#FDF2E2', border: '1px solid rgba(217,119,6,0.30)', color: '#7A4F0A' }}
        >
          <span aria-hidden="true" className="leading-none">⚠️</span>
          <span>
            <strong>Checklist PARCIAL</strong> — página 1 de 2 del formato oficial de Planeación; se completa cuando llegue la página 2.
          </span>
        </div>
      </div>

      {definicion.clavesContexto && definicion.clavesContexto.length > 0 && (
        <PanelHechosCaso
          expedienteId={expedienteId}
          clavesContexto={definicion.clavesContexto}
          contexto={contexto}
          soloLectura={soloLectura}
          onActualizado={onContextoActualizado}
        />
      )}

      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
      >
        <ul className="flex flex-col gap-2">
          {definicion.requisitos.map((requisito) => {
            const aporte = aportePorRequisito.get(requisito.id);
            const documentoId = aporte?.documentoIds?.[0];
            const indeterminado = resultado.indeterminados.find((i) => i.requisitoId === requisito.id);
            return (
              <RequisitoItem
                key={requisito.id}
                expedienteId={expedienteId}
                requisito={requisito}
                estado={estadoDe(requisito.id)}
                documento={documentoId ? documentoPorId.get(documentoId) : undefined}
                clavesFaltantesIndeterminado={indeterminado?.clavesFaltantes}
                soloLectura={soloLectura}
                onDocumentoSubido={onDocumentoSubido}
              />
            );
          })}
        </ul>
      </div>

      <OtrosDocumentos
        expedienteId={expedienteId}
        documentos={otrosDocumentos}
        soloLectura={soloLectura}
        onDocumentoSubido={onDocumentoSubido}
      />
    </div>
  );
}
