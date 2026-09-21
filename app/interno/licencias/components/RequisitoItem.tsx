'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CondicionRequisito, RequisitoDefinicion } from '@/lib/motor-expedientes/tipos';
import type { DocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { ESTILOS_ESTADO_REQUISITO, type EstadoVisualRequisito } from '../estilos-estado-requisito';
import { ControlSubidaDocumento } from './ControlSubidaDocumento';

/* ══════════════════════════════════════════════════════════════
   Fila de UN requisito del checklist — rediseño de documentación.

   PRESENTACIONAL: el `estado` (`EstadoVisualRequisito`) ya viene CALCULADO
   por `ChecklistRequisitos` a partir de `ResultadoCompletitud` (el evaluador
   real, `lib/motor-expedientes/completitud.ts`). Este componente solo decide
   cómo se VE cada estado y qué acción ofrece — nunca reevalúa condiciones ni
   inventa datos.

   Jerarquía de un vistazo: NOMBRE (primario) · tipo (marca pequeña) · ESTADO
   (color evidente) · archivo (secundario) · ACCIÓN principal. Lo secundario
   (descargar, reemplazar, historial) vive en un menú de tres puntos para no
   llenar la fila.
══════════════════════════════════════════════════════════════ */

/** Plantilla de columnas del grid en escritorio — compartida por la fila y el encabezado de sección (misma alineación). En móvil (por defecto) cae a una sola columna. */
export const GRID_TEMPLATE_MD =
  'md:[grid-template-columns:26px_1.6fr_1.9fr_136px_1.5fr_150px]';

function formatValorCondicion(valor: string | number | boolean): string {
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  return String(valor);
}

/** Texto legible de una `CondicionRequisito` — genérico sobre el DSL categórico, sin diccionario de frases por clave. */
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

/** Etiqueta del chip de estado. Deriva del token, salvo DUPLICADO, que se
 *  presenta como "Requiere corrección" (la novedad roja que hoy alimenta el
 *  filtro "Rechazados"). */
function etiquetaEstado(estado: EstadoVisualRequisito, tipo: RequisitoDefinicion['tipo']): string {
  if (estado === 'DUPLICADO') return 'Requiere corrección';
  if (estado === 'NO_APLICA' && tipo === 'OPCIONAL') return 'Opcional';
  return ESTILOS_ESTADO_REQUISITO[estado].label;
}

function MarcadorTipo({ tipo }: { tipo: RequisitoDefinicion['tipo'] }) {
  if (tipo === 'OBLIGATORIO') {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold mt-0.5" style={{ color: '#5B6B7B' }}>
        <span aria-hidden className="inline-block h-[9px] w-[9px] rounded-full border-2" style={{ borderColor: '#B4BEC9' }} />
        Obligatorio
      </span>
    );
  }
  return (
    <span className="text-[10.5px] mt-0.5 inline-block" style={{ color: 'var(--text-muted)' }}>
      {tipo === 'OPCIONAL' ? 'Opcional' : 'Condicional'}
    </span>
  );
}

/* ── Iconos mínimos ─────────────────────────────────────────── */
function IconoVer() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconoKebab() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}
function IconoDescargar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Menú de tres puntos (accesible: click-fuera + Escape) ───── */
function MenuAcciones({ children }: { children: (cerrar: () => void) => ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alClicFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    function alTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alTecla);
    };
  }, [abierto]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Más acciones"
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        <IconoKebab />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 min-w-[196px] rounded-xl py-1 overflow-hidden md:left-auto md:right-0"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft), 0 8px 24px rgba(15,23,42,0.12)' }}
        >
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  );
}

export interface RequisitoItemProps {
  expedienteId: string;
  requisito: RequisitoDefinicion;
  estado: EstadoVisualRequisito;
  /** Documento LÓGICO vigente que satisface este requisito, si `estado === 'APORTADO'` (o el primero, si `DUPLICADO`). */
  documento: DocumentoExpedienteDoc | undefined;
  /** Solo si `estado === 'INDETERMINADO'` — claves de `contexto` que faltan para poder evaluar la condición. */
  clavesFaltantesIndeterminado?: string[];
  soloLectura: boolean;
  onDocumentoSubido: () => void;
  /** Posición dentro de su sección (columna «#»). */
  indice: number;
}

export function RequisitoItem({
  expedienteId,
  requisito,
  estado,
  documento,
  clavesFaltantesIndeterminado,
  soloLectura,
  onDocumentoSubido,
  indice,
}: RequisitoItemProps) {
  const estilo = ESTILOS_ESTADO_REQUISITO[estado];
  const atenuado = estado === 'NO_APLICA';
  const urlArchivo = documento
    ? `/api/interno/archivo?path=${encodeURIComponent(documento.versionVigente.storagePath)}`
    : null;

  /* Acción principal según el estado (la consigna: pendiente ⇒ "Adjuntar" es lo
     primero que se ve; aportado ⇒ "Ver" + menú; corrección ⇒ "Reemplazar"). */
  function accionPrincipal(): ReactNode {
    if (documento && urlArchivo) {
      return (
        <div className="flex flex-wrap items-center gap-1 justify-start md:flex-nowrap md:justify-end">
          <a
            href={urlArchivo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2"
            style={{ border: '1px solid var(--color-border)', color: '#14532D', background: 'var(--bg-surface)' }}
          >
            <IconoVer /> Ver
          </a>
          <MenuAcciones>
            {(cerrar) => (
              <>
                <a
                  role="menuitem"
                  href={urlArchivo}
                  download={documento.nombre}
                  onClick={cerrar}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors hover:bg-black/[0.04]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <IconoDescargar /> Descargar
                </a>
                {!soloLectura && (
                  <div className="px-3 py-1.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <ControlSubidaDocumento
                      expedienteId={expedienteId}
                      requisitoId={requisito.id}
                      nombre={requisito.nombre}
                      etiqueta="Reemplazar (nueva versión)"
                      onSubido={() => {
                        cerrar();
                        onDocumentoSubido();
                      }}
                    />
                  </div>
                )}
                <p className="px-3 pt-1.5 pb-1 text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  {documento.totalVersiones > 1
                    ? `${documento.totalVersiones} versiones · vigente v${documento.versionVigente.numeroVersion}`
                    : 'Versión única (v1)'}
                </p>
              </>
            )}
          </MenuAcciones>
        </div>
      );
    }

    if (estado === 'PENDIENTE' && !soloLectura) {
      return (
        <div className="flex md:justify-end">
          <ControlSubidaDocumento
            expedienteId={expedienteId}
            requisitoId={requisito.id}
            nombre={requisito.nombre}
            etiqueta="+ Adjuntar documento"
            onSubido={onDocumentoSubido}
          />
        </div>
      );
    }

    return <span className="text-xs md:text-right block" style={{ color: 'var(--text-muted)' }}>—</span>;
  }

  return (
    <li
      className="min-w-0 px-3 py-2.5 md:px-4"
      style={{ borderTop: '1px solid var(--color-border)', opacity: atenuado ? 0.66 : 1 }}
    >
      <div className={`grid min-w-0 items-center gap-x-3 gap-y-1.5 [grid-template-columns:minmax(0,1fr)] ${GRID_TEMPLATE_MD}`}>
        {/* # */}
        <span className="hidden md:block text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{indice}</span>

        {/* Documento: nombre + tipo */}
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{requisito.nombre}</p>
          <MarcadorTipo tipo={requisito.tipo} />
        </div>

        {/* Requisito / Descripción (secundario, hasta 2 líneas; completo en el tooltip) */}
        <div className="min-w-0">
          {requisito.descripcion ? (
            <p className="break-words text-xs leading-snug md:line-clamp-2" title={requisito.descripcion} style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              {requisito.descripcion}
            </p>
          ) : (
            <span className="hidden md:inline text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </div>

        {/* Estado */}
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
            style={{ background: estilo.fondo, color: estilo.texto }}
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: estilo.dot }} />
            {etiquetaEstado(estado, requisito.tipo)}
          </span>
        </div>

        {/* Archivo (secundario) */}
        <div className="min-w-0">
          {documento ? (
            <p className="break-words text-xs leading-tight" title={documento.nombre} style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              <span style={{ color: 'var(--text-primary)' }}>{documento.nombre}</span>
              <span className="block" style={{ color: 'var(--text-muted)' }}>
                v{documento.versionVigente.numeroVersion} · {formatFechaColombia(documento.versionVigente.subidoEn)}
              </span>
            </p>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin archivo</span>
          )}
        </div>

        {/* Acciones */}
        <div className="min-w-0">{accionPrincipal()}</div>
      </div>

      {/* Notas de estado a ancho completo (no compiten con el nombre) */}
      {estado === 'DUPLICADO' && (
        <p className="mt-2 text-xs rounded-lg px-3 py-2" style={{ background: '#FCEBEB', color: '#911111' }}>
          Este requisito tiene más de un aporte registrado en el expediente — revísalo y reemplaza por la versión correcta.
        </p>
      )}
      {estado === 'INDETERMINADO' && (
        <p className="mt-2 text-xs" style={{ color: '#1E4FA0' }}>
          Falta definir en «Hechos del caso»
          {clavesFaltantesIndeterminado && clavesFaltantesIndeterminado.length > 0 && <>: {clavesFaltantesIndeterminado.join(', ')}</>}
          {' '}para saber si se exige.
        </p>
      )}
      {estado === 'NO_APLICA' && requisito.tipo === 'CONDICIONAL' && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          No se exige en este caso ({condicionLegible(requisito.condicion)}).
        </p>
      )}
    </li>
  );
}
