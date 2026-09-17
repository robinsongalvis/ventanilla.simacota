import type { CondicionRequisito, RequisitoDefinicion } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';
import { ESTILOS_ESTADO_REQUISITO, type EstadoVisualRequisito } from '../estilos-estado-requisito';
import { ControlSubidaDocumento } from './ControlSubidaDocumento';

/* ══════════════════════════════════════════════════════════════
   Fila COMPACTA de UN requisito del checklist — Bloque A·A3. Presentacional: el
   `estado` (`EstadoVisualRequisito`) ya viene CALCULADO por
   `ChecklistRequisitos` a partir de `ResultadoCompletitud` (el evaluador real,
   `lib/motor-expedientes/completitud.ts`) — este componente solo decide cómo se
   VE cada estado, nunca reevalúa condiciones.

   REDISEÑO Fase 2 (vista «Documentos del trámite»): deja de ser una tarjeta
   grande y pasa a una FILA compacta —nombre a la izquierda; tipo, estado,
   versión, fecha y acciones a la derecha— que en móvil se reorganiza en
   vertical. Mismos props, misma lógica, mismos textos: solo cambia la
   maquetación. La info larga (condición, indeterminado, duplicado) va debajo,
   a ancho completo.
══════════════════════════════════════════════════════════════ */

function formatValorCondicion(valor: string | number | boolean): string {
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  return String(valor);
}

/**
 * Texto legible de una `CondicionRequisito` — genérico sobre el DSL
 * categórico (`lib/motor-expedientes/tipos.ts`), SIN diccionario de frases
 * por clave: una Definición de Trámite nueva con claves de contexto
 * propias se lee correctamente aquí sin tocar este archivo (D9).
 */
function condicionLegible(condicion: CondicionRequisito): string {
  switch (condicion.operador) {
    case 'IGUAL':
      return `${condicion.clave} = ${formatValorCondicion(condicion.valor)}`;
    case 'DISTINTO':
      return `${condicion.clave} ≠ ${formatValorCondicion(condicion.valor)}`;
    case 'EN':
      return `${condicion.clave} ∈ {${condicion.valores.map(formatValorCondicion).join(', ')}}`;
    case 'Y':
      return condicion.condiciones.map(condicionLegible).join(' Y ');
    case 'O':
      return condicion.condiciones.map(condicionLegible).join(' O ');
    case 'NO':
      return `NO (${condicionLegible(condicion.condicion)})`;
  }
}

const ETIQUETA_TIPO: Record<RequisitoDefinicion['tipo'], string> = {
  OBLIGATORIO: 'Obligatorio',
  OPCIONAL: 'Opcional',
  CONDICIONAL: 'Condicional',
};

export interface RequisitoItemProps {
  expedienteId: string;
  requisito: RequisitoDefinicion;
  estado: EstadoVisualRequisito;
  /** Documento LÓGICO vigente que satisface este requisito, si `estado === 'APORTADO'`. */
  documento: DocumentoExpedienteDoc | undefined;
  /** Solo si `estado === 'INDETERMINADO'` — claves de `contexto` que faltan para poder evaluar la condición. */
  clavesFaltantesIndeterminado?: string[];
  soloLectura: boolean;
  onDocumentoSubido: () => void;
}

export function RequisitoItem({
  expedienteId,
  requisito,
  estado,
  documento,
  clavesFaltantesIndeterminado,
  soloLectura,
  onDocumentoSubido,
}: RequisitoItemProps) {
  const estilo = ESTILOS_ESTADO_REQUISITO[estado];
  const etiquetaEstado = estado === 'NO_APLICA' && requisito.tipo === 'OPCIONAL' ? 'Opcional' : estilo.label;
  const puedeSubir = !soloLectura && (estado === 'PENDIENTE' || estado === 'APORTADO');
  const atenuada = estado === 'NO_APLICA';

  return (
    <li
      className="px-4 py-2.5 transition-colors duration-150 hover:bg-black/[0.02] motion-reduce:transition-none"
      style={{ opacity: atenuada ? 0.7 : 1 }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {/* DOCUMENTO */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{requisito.nombre}</p>
          {requisito.descripcion && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{requisito.descripcion}</p>
          )}
        </div>

        {/* REQUISITO · ESTADO · VERSIÓN · FECHA · ACCIONES */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:justify-end sm:shrink-0">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
          >
            {ETIQUETA_TIPO[requisito.tipo]}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
            style={{ background: estilo.fondo, color: estilo.texto }}
          >
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: estilo.dot }} />
            {etiquetaEstado}
          </span>

          {documento && (
            <>
              <span className="font-mono text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>v{documento.versionVigente.numeroVersion}</span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted, var(--text-secondary))' }}>{formatFechaHoraColombia(documento.versionVigente.subidoEn)}</span>
              <a
                href={`/api/interno/archivo?path=${encodeURIComponent(documento.versionVigente.storagePath)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1 transition-colors duration-150 hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                style={{ color: '#14532D', border: '1px solid var(--color-border)' }}
              >
                Descargar
              </a>
            </>
          )}

          {puedeSubir && (
            <ControlSubidaDocumento
              expedienteId={expedienteId}
              requisitoId={requisito.id}
              nombre={requisito.nombre}
              etiqueta={documento ? 'Reemplazar' : 'Subir documento'}
              onSubido={onDocumentoSubido}
            />
          )}
        </div>
      </div>

      {/* INFO LARGA — a ancho completo, debajo de la fila. */}
      {estado === 'NO_APLICA' && requisito.tipo === 'CONDICIONAL' && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          No aplica a este caso: {condicionLegible(requisito.condicion)}.
        </p>
      )}
      {estado === 'NO_APLICA' && requisito.tipo === 'OPCIONAL' && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          Opcional — no bloquea la completitud del checklist.
        </p>
      )}
      {estado === 'INDETERMINADO' && (
        <p className="text-xs mt-1.5" style={{ color: '#1E4FA0' }}>
          Falta definir en «Hechos del caso»
          {clavesFaltantesIndeterminado && clavesFaltantesIndeterminado.length > 0 && <>: {clavesFaltantesIndeterminado.join(', ')}</>}
          {' '}para saber si aplica.
        </p>
      )}
      {estado === 'DUPLICADO' && (
        <p className="text-xs mt-1.5" style={{ color: '#911111' }}>
          Este requisito tiene más de un aporte registrado en el expediente — requiere corrección manual.
        </p>
      )}
      {documento && (
        <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--text-secondary)' }}>
          Archivo: <span style={{ color: 'var(--text-primary)' }}>{documento.nombre}</span>
        </p>
      )}
    </li>
  );
}
