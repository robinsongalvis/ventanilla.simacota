import type { CondicionRequisito, RequisitoDefinicion } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { formatFechaHoraColombia } from '@/lib/fecha-colombia';
import { ESTILOS_ESTADO_REQUISITO, type EstadoVisualRequisito } from '../estilos-estado-requisito';
import { ControlSubidaDocumento } from './ControlSubidaDocumento';

/* ══════════════════════════════════════════════════════════════
   Fila de UN requisito del checklist — Bloque A·A3. Presentacional: el
   `estado` (`EstadoVisualRequisito`) ya viene CALCULADO por
   `ChecklistRequisitos` a partir de `ResultadoCompletitud` (el evaluador
   real, `lib/motor-expedientes/completitud.ts`) — este componente solo
   decide cómo se VE cada estado, nunca reevalúa condiciones.
══════════════════════════════════════════════════════════════ */

function formatValorCondicion(valor: string | number | boolean): string {
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  return String(valor);
}

/**
 * Texto legible de una `CondicionRequisito` — genérico sobre el DSL
 * categórico (`lib/motor-expedientes/tipos.ts`), SIN diccionario de frases
 * por clave: una Definición de Trámite nueva con claves de contexto
 * propias se lee correctamente aquí sin tocar este archivo (D9). Trade-off
 * declarado: el resultado es técnico ("esApoderado = no"), no una frase
 * 100% natural ("no hay apoderado") — se prefiere la generalidad sobre el
 * pulido de copy para una sola Definición.
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
  // NO_APLICA cubre tanto "condicional que no aplica" como "opcional sin
  // aportar" (ver JSDoc de `EstadoVisualRequisito`) — el color es el mismo,
  // pero llamar "No aplica" a un opcional es confuso; el badge distingue
  // el texto por `tipo`, no crea un 6º estado en el evaluador.
  const etiquetaEstado = estado === 'NO_APLICA' && requisito.tipo === 'OPCIONAL' ? 'Opcional' : estilo.label;
  const puedeSubir = !soloLectura && (estado === 'PENDIENTE' || estado === 'APORTADO');

  return (
    <li className="rounded-lg p-3 flex flex-col gap-2" style={{ border: '1px solid var(--color-border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{requisito.nombre}</p>
          {requisito.descripcion && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{requisito.descripcion}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
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
        </div>
      </div>

      {estado === 'NO_APLICA' && requisito.tipo === 'CONDICIONAL' && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          No aplica a este caso: {condicionLegible(requisito.condicion)}.
        </p>
      )}
      {estado === 'NO_APLICA' && requisito.tipo === 'OPCIONAL' && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Opcional — no bloquea la completitud del checklist.
        </p>
      )}

      {estado === 'INDETERMINADO' && (
        <p className="text-xs" style={{ color: '#1E4FA0' }}>
          Falta definir en «Hechos del caso»
          {clavesFaltantesIndeterminado && clavesFaltantesIndeterminado.length > 0 && <>: {clavesFaltantesIndeterminado.join(', ')}</>}
          {' '}para saber si aplica.
        </p>
      )}

      {estado === 'DUPLICADO' && (
        <p className="text-xs" style={{ color: '#911111' }}>
          Este requisito tiene más de un aporte registrado en el expediente — requiere corrección manual.
        </p>
      )}

      {documento && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="truncate max-w-full" style={{ color: 'var(--text-primary)' }}>{documento.nombre}</span>
          <span className="shrink-0 font-mono">v{documento.versionVigente.numeroVersion}</span>
          <a
            href={`/api/interno/archivo?path=${encodeURIComponent(documento.versionVigente.storagePath)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 rounded"
            style={{ color: '#14532D' }}
          >
            Descargar
          </a>
          <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{formatFechaHoraColombia(documento.versionVigente.subidoEn)}</span>
        </div>
      )}

      {puedeSubir && (
        <ControlSubidaDocumento
          expedienteId={expedienteId}
          requisitoId={requisito.id}
          nombre={requisito.nombre}
          etiqueta={documento ? 'Reemplazar (nueva versión)' : 'Subir documento'}
          onSubido={onDocumentoSubido}
        />
      )}
    </li>
  );
}
