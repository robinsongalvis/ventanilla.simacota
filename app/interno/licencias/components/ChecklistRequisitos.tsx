'use client';

import { useMemo, type ReactNode } from 'react';
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

  /* Resumen por estado — TODOS salen de las mismas listas del evaluador, ningún
     número se inventa. «Requiere corrección» no es un estado nuevo: es
     `DUPLICADO`, que el propio `RequisitoItem` describe como «requiere
     corrección manual». «Condicionales» cuenta los requisitos de tipo
     CONDICIONAL (apliquen o no), que es la cifra que la funcionaria reconoce. */
  const pendientes = resultado.faltantes.length;
  const requiereCorreccion = resultado.aportesDuplicados.length;
  const condicionales = definicion.requisitos.filter((r) => r.tipo === 'CONDICIONAL').length;

  const otrosDocumentos = documentos.filter((d) => !d.requisitoId);

  return (
    <div className="flex flex-col gap-3">
      {/* BARRA DE PROGRESO. Sustituye a la tarjeta de resumen: el mismo dato
          —«aportados de aplicables»— pero visible de un vistazo y sin ocupar
          una tarjeta entera. Los números NO cambian: salen de las mismas
          listas del evaluador. */}
      <div
        className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-sm shrink-0" style={{ color: 'var(--text-primary)' }}>
          <strong>{aportados} de {aplicables}</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>documentos aportados</span>
        </p>

        <div
          className="flex-1 min-w-[120px] h-1.5 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={aportados}
          aria-valuemin={0}
          aria-valuemax={aplicables}
          aria-label="Documentos aportados"
          style={{ background: 'var(--bg-surface-2)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: aplicables > 0 ? `${Math.round((aportados / aplicables) * 100)}%` : '0%',
              background: resultado.completo ? '#14532D' : '#4E9A5F',
            }}
          />
        </div>

        <span className="text-sm font-bold shrink-0" style={{ color: resultado.completo ? '#116932' : '#4E9A5F' }}>
          {aplicables > 0 ? Math.round((aportados / aplicables) * 100) : 0}%
        </span>

        {/* El chip vuelve: lo quité al reemplazar la tarjeta de resumen y una
            prueba lo cazó. Dice de un vistazo si el checklist está completo,
            que es lo que decide si se puede radicar. */}
        <span
          className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0"
          style={resultado.completo ? { background: '#E7F6EC', color: '#116932' } : { background: '#FAEEDA', color: '#7A4F0A' }}
        >
          {resultado.completo ? 'Completo' : 'Incompleto'}
        </span>

        {resultado.aportesDuplicados.length > 0 && (
          <span className="text-xs w-full" style={{ color: '#9A6206' }}>
            {resultado.aportesDuplicados.length} con aportes duplicados
          </span>
        )}

        {soloLectura && motivoSoloLectura && (
          <p className="text-xs w-full" style={{ color: 'var(--text-secondary)' }}>{motivoSoloLectura}</p>
        )}
      </div>

      {/* RESUMEN POR ESTADO — de un vistazo, con los mismos números del
          evaluador. Presentación pura: no reevalúa nada. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TileEstado valor={aportados} label="Aportados" color="#16A34A" fondo="#E7F5EC" icono={<IconoCheck />} />
        <TileEstado valor={pendientes} label="Pendientes" color="#D97706" fondo="#FDF1DC" icono={<IconoReloj />} />
        <TileEstado valor={requiereCorreccion} label="Requiere corrección" color="#DC2626" fondo="#FCEAEA" icono={<IconoEquis />} />
        <TileEstado valor={condicionales} label="Condicionales" color="#7C3AED" fondo="#F1E9FE" icono={<IconoDocumento />} />
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

      {/* AGRUPADO: lo que FALTA arriba, lo APORTADO abajo. Antes era una lista
          plana donde un requisito pendiente y uno ya entregado se veían igual,
          y la funcionaria tenía que leerlos todos para saber qué le queda.

          Los NO APLICABLES van al final, atenuados, PERO SE LISTAN: la
          funcionaria tiene derecho a saber qué no se le exige y por qué, y
          esconderlos convertiría una decisión del sistema en algo invisible.
          (Los escondí en la primera versión de este rediseño; una prueba que ya
          existía lo cazó, y tenía razón.) */}
      {([
        { clave: 'faltan', titulo: 'Faltan', estados: ['PENDIENTE'] as const },
        /* SIN DEFINIR va aparte de FALTAN, y no es un detalle de maquetación:
           un indeterminado NO se sabe todavía si se exige —por eso el evaluador
           lo descuenta de «aplicables»—, así que meterlo en «Faltan» haría que
           el encabezado contara 3 mientras la barra dice «0 de 2». Y la acción
           es otra: uno se sube, el otro se responde en Hechos del caso. */
        { clave: 'sin-definir', titulo: 'Sin definir — dependen de Hechos del caso', estados: ['INDETERMINADO'] as const },
        { clave: 'aportados', titulo: 'Aportados', estados: ['APORTADO'] as const },
        { clave: 'no-aplican', titulo: 'No se exigen en este caso', estados: ['NO_APLICA'] as const },
      ] as const).map((grupo) => {
        const requisitos = definicion.requisitos.filter((r) =>
          (grupo.estados as readonly string[]).includes(estadoDe(r.id)),
        );
        if (requisitos.length === 0) return null;
        return (
          <div key={grupo.clave} className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: '#667085' }}>
              {`${grupo.titulo} · ${requisitos.length}`}
            </p>
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
            >
              <ul className="flex flex-col">
                {requisitos.map((requisito) => {
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
          </div>
        );
      })}

      <OtrosDocumentos
        expedienteId={expedienteId}
        documentos={otrosDocumentos}
        soloLectura={soloLectura}
        onDocumentoSubido={onDocumentoSubido}
      />
    </div>
  );
}

/** Una tarjeta del resumen por estado: icono en círculo de color + número + etiqueta. */
function TileEstado({
  valor, label, color, fondo, icono,
}: {
  valor: number; label: string; color: string; fondo: string; icono: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: fondo, color }}>
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block font-headline text-lg font-black leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>{valor}</span>
        <span className="mt-0.5 block text-xs leading-tight" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </span>
    </div>
  );
}

function IconoCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.3 12.2l2.4 2.4 5-5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoReloj() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoEquis() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconoDocumento() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3.75h6.5L18.25 8.5V19A1.25 1.25 0 0 1 17 20.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 4v5h5M8.5 13h7M8.5 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
