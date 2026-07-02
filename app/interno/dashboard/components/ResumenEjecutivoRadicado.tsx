'use client';

import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { calcularSemaforo } from '@/app/interno/dashboard/components/mipg/SemaforoTermino';
import { calcularProximaAccion, type UrgenciaAccion } from '@/lib/proxima-accion/calcular-proxima-accion';
import { etiquetarUltimaActuacion } from '@/lib/proxima-accion/etiquetar-trazabilidad';
import { tieneDatosNoAportados } from '@/lib/busqueda/filtros-radicado';
import { formatFechaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 1 — Resumen Ejecutivo del Radicado.

   Compacto, institucional, ubicado al inicio del tab Info del
   PanelDerecho. Complementa el SelloRadicado, no lo reemplaza.

   Muestra en un vistazo lo esencial para responder consultas
   internas o ciudadanas sobre el radicado: cuándo llegó, quién lo
   radicó, quién lo tiene, en qué estado va, qué falta, qué riesgo
   tiene, cuál fue la última actuación y qué acción sigue.
══════════════════════════════════════════════════════════════ */

const LABEL_ESTADO: Record<string, string> = {
  PENDIENTE:   'Pendiente',
  EN_REVISION: 'En revisión',
  EN_PROCESO:  'En proceso',
  ASIGNADO:    'Asignado',
  RESUELTO:    'Resuelto',
  DEVUELTO:    'Devuelto',
  RECHAZADO:   'Rechazado',
  POR_VENCER:  'Por vencer',
  VENCIDO:     'Vencido',
  PRORROGA:    'Prórroga',
};

const COLOR_URGENCIA: Record<UrgenciaAccion, { bg: string; text: string; border: string }> = {
  critica: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  alta:    { bg: '#FEF3C7', text: '#92400E', border: '#FBBF24' },
  media:   { bg: '#EEF4EE', text: '#14532D', border: '#D9E2D9' },
  ninguna: { bg: '#F8FAF7', text: '#667085', border: '#E5E7EB' },
};

export interface ResumenEjecutivoRadicadoProps {
  radicado:     VentanillaRadicado;
  ultimoEvento: TrazabilidadRadicado | null;
  ahora?:       Date;   // Inyectable para tests.
}

export function ResumenEjecutivoRadicado({
  radicado,
  ultimoEvento,
  ahora,
}: ResumenEjecutivoRadicadoProps) {
  const semaforo    = calcularSemaforo(radicado);
  const proxima     = calcularProximaAccion(radicado);
  const ultima      = ultimoEvento ? etiquetarUltimaActuacion(ultimoEvento, ahora) : null;
  const datosIncompletos = tieneDatosNoAportados(radicado.solicitante.datosNoAportados);

  const responsableNombre = radicado.clasificacion.funcionarioResponsableNombre ?? 'Sin asignar';
  const dependenciaNombre = NOMBRES_TENANT[radicado.clasificacion.oficinaDestino]
    ?? radicado.clasificacion.oficinaDestino;

  const anexosCount    = radicado.archivos.length;
  const selladosCount  = radicado.archivos.filter((a) => a.sellado).length;
  const tieneRespuesta = Boolean(radicado.respuestaOficial);

  const colorUrgencia = COLOR_URGENCIA[proxima.urgencia];

  return (
    <section
      className="rounded-xl bg-white p-4 space-y-3"
      style={{ border: '1px solid #D9E2D9' }}
      aria-label="Resumen ejecutivo del radicado"
    >
      {/* Título + estado + semáforo */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
            Resumen ejecutivo
          </p>
          <p className="mt-0.5 font-mono text-sm font-bold truncate" style={{ color: '#1F2933' }}>
            {radicado.radicadoId}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
            style={{ background: '#F8FAF7', color: '#1F2933', borderColor: '#D9E2D9' }}
          >
            {LABEL_ESTADO[radicado.estadoActual] ?? radicado.estadoActual}
          </span>
          <span className={`text-[11px] tabular-nums ${semaforo.textoClass}`}>{semaforo.label}</span>
        </div>
      </div>

      {/* Grid de datos claves — 2 columnas */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <ResumenFila label="Llegada" value={`${formatFechaColombia(radicado.control.fechaRadicado)} · ${radicado.control.horaRadicado}`} />
        <ResumenFila label="Solicitante" value={radicado.solicitante.nombreCompleto} />
        <ResumenFila label="Dependencia" value={dependenciaNombre} />
        <ResumenFila label="Responsable" value={responsableNombre} muted={responsableNombre === 'Sin asignar'} />
        <ResumenFila label="Tipo" value={radicado.termino.tipoSolicitudNombre} />
        <ResumenFila label="Vencimiento" value={formatFechaColombia(radicado.termino.fechaVencimiento)} />
      </div>

      {/* Chips de estado operativo */}
      <div className="flex flex-wrap gap-1.5">
        <Chip
          text={`${anexosCount} ${anexosCount === 1 ? 'anexo' : 'anexos'}`}
          bg="#EEF4EE" color="#14532D" border="#D9E2D9"
        />
        {selladosCount > 0 && (
          <Chip
            text={`${selladosCount} sellado${selladosCount === 1 ? '' : 's'}`}
            bg="#F0FDF4" color="#166534" border="#BBF7D0"
          />
        )}
        {tieneRespuesta && (
          <Chip
            text="Respuesta oficial"
            bg="#EFF6FF" color="#1D4ED8" border="#BFDBFE"
          />
        )}
        {radicado.alertaNotificacionFallida === true && (
          <Chip
            text="Correo institucional falló"
            bg="#FEF2F2" color="#B91C1C" border="#FECACA"
          />
        )}
        {datosIncompletos && (
          <Chip
            text="Datos incompletos"
            bg="#FEF3C7" color="#92400E" border="#FBBF24"
          />
        )}
      </div>

      {/* Última actuación + próxima acción */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1" style={{ borderTop: '1px dashed #D9E2D9' }}>
        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
            Última actuación
          </p>
          {ultima ? (
            <p className="mt-0.5 text-xs" style={{ color: '#1F2933' }}>
              <span className="font-semibold">{ultima.label}</span>
              <span className="ml-1.5 text-[11px]" style={{ color: '#94A3B8' }}>· {ultima.fechaRelativa}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs" style={{ color: '#94A3B8' }}>—</p>
          )}
        </div>
        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
            Próxima acción
          </p>
          <div
            className="mt-0.5 inline-block px-2 py-0.5 rounded-md text-xs font-semibold border"
            style={{
              background:  colorUrgencia.bg,
              color:       colorUrgencia.text,
              borderColor: colorUrgencia.border,
            }}
            title={`Regla: ${proxima.ruleId}`}
          >
            {proxima.accion}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   Sub-componentes internos
══════════════════════════════════════════════════════════════ */

function ResumenFila({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
        {label}
      </p>
      <p
        className="mt-0.5 truncate"
        style={{ color: muted ? '#94A3B8' : '#1F2933', fontStyle: muted ? 'italic' : 'normal' }}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function Chip({
  text,
  bg,
  color,
  border,
}: {
  text: string;
  bg: string;
  color: string;
  border: string;
}) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border"
      style={{ background: bg, color, borderColor: border }}
    >
      {text}
    </span>
  );
}
