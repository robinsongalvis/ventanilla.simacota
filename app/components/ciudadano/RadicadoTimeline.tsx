'use client';

import type { AccionAuditoria } from '@/src/types/radicado';

export type EstadoTimelinePublico =
  | 'radicado_recibido'
  | 'asignado_dependencia'
  | 'en_revision'
  | 'requiere_aclaracion'
  | 'trasladado'
  | 'respondido'
  | 'cerrado';

export interface TimelinePublicoItem {
  estado: EstadoTimelinePublico;
  fecha?: string;
}

const LABELS: Record<EstadoTimelinePublico, { titulo: string; descripcion: string }> = {
  radicado_recibido: {
    titulo: 'Radicado recibido',
    descripcion: 'La Alcaldía recibió la solicitud y generó número de radicado.',
  },
  asignado_dependencia: {
    titulo: 'Asignado a dependencia',
    descripcion: 'El caso fue direccionado a la oficina competente.',
  },
  en_revision: {
    titulo: 'En revisión',
    descripcion: 'La dependencia está revisando la solicitud.',
  },
  requiere_aclaracion: {
    titulo: 'Requiere aclaración',
    descripcion: 'La entidad requiere información adicional del ciudadano.',
  },
  trasladado: {
    titulo: 'Trasladado',
    descripcion: 'El caso fue remitido a otra dependencia competente.',
  },
  respondido: {
    titulo: 'Respondido',
    descripcion: 'La respuesta oficial ya fue registrada.',
  },
  cerrado: {
    titulo: 'Cerrado',
    descripcion: 'El trámite fue cerrado por la entidad.',
  },
};

export function mapAccionToTimeline(accion: AccionAuditoria): EstadoTimelinePublico | null {
  switch (accion) {
    case 'RADICACION':
      return 'radicado_recibido';
    case 'ASIGNACION':
    case 'CLASIFICACION_IA':
      return 'asignado_dependencia';
    case 'CAMBIO_ESTADO':
      return 'en_revision';
    case 'DEVOLUCION':
      return 'requiere_aclaracion';
    case 'RECLASIFICACION':
    case 'TIPO_SOLICITUD_RECLASIFICADO':
      return 'trasladado';
    case 'RESPUESTA_FUNCIONARIO':
      return 'respondido';
    default:
      return null;
  }
}

function formatDate(iso?: string): string {
  if (!iso) return 'Fecha pendiente';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RadicadoTimeline({ items }: { items: TimelinePublicoItem[] }) {
  if (items.length === 0) return null;

  const deduped = items.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.estado === item.estado) === index,
  );

  return (
    <div className="px-6 py-5 border-b border-white/[0.06]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
        Línea de tiempo pública
      </p>
      <ol className="space-y-4">
        {deduped.map((item, index) => {
          const label = LABELS[item.estado];
          return (
            <li key={`${item.estado}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full border border-emerald-400/40 bg-emerald-500/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                {index < deduped.length - 1 && <div className="mt-2 h-full min-h-8 w-px bg-white/10" />}
              </div>
              <div className="pb-1">
                <p className="text-sm font-bold text-slate-200">{label.titulo}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{label.descripcion}</p>
                <p className="mt-1 text-[10px] text-slate-600">{formatDate(item.fecha)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
