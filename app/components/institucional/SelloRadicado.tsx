'use client';

import Image from 'next/image';
import {
  formatFechaInstitucional,
  formatHoraInstitucional,
  INSTITUCION,
  labelCanalRespuesta,
  labelMedioRecepcion,
} from '@/lib/institucion';

export interface SelloRadicadoData {
  radicadoId: string;
  fechaRadicado?: string | Date | null;
  horaRadicado?: string | Date | null;
  medioRecepcion?: string | null;
  tipoSolicitud?: string | null;
  canalRespuesta?: string | null;
  dependencia?: string | null;
  estado?: string | null;
  solicitante?: string | null;
  documento?: string | null;
  correo?: string | null;
  esAnonimo?: boolean | null;
  identidadReservada?: boolean | null;
  /** Código entregado una sola vez; nunca se recupera del servidor. */
  consultaToken?: string | null;
}

interface Props {
  data: SelloRadicadoData;
  variant?: 'card' | 'compact' | 'print';
  className?: string;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[112px_1fr] gap-2 border-b border-slate-300/60 py-1.5 last:border-b-0">
      <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="text-xs font-semibold text-slate-900 break-words">{value}</dd>
    </div>
  );
}

export function SelloRadicado({ data, variant = 'card', className = '' }: Props) {
  const anonimo = data.esAnonimo || data.identidadReservada;
  const solicitante = anonimo
    ? data.esAnonimo ? 'Anónimo' : 'Identidad reservada'
    : data.solicitante;

  return (
    <section
      className={[
        'sello-radicado overflow-hidden border border-slate-300 bg-white text-slate-950 shadow-sm',
        variant === 'compact' ? 'rounded-xl' : 'rounded-2xl',
        variant === 'print' ? 'print:shadow-none print:rounded-none' : '',
        className,
      ].join(' ')}
      aria-label="Sello oficial de radicado"
    >
      <div className="flex items-center gap-3 border-b border-slate-300 bg-slate-950 px-4 py-3 text-white">
        <div className="relative h-10 w-36 shrink-0">
          <Image src={INSTITUCION.logo} alt={INSTITUCION.nombre} fill sizes="144px" className="object-contain object-left" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200">Radicado oficial</p>
          <p className="font-mono text-sm font-black tracking-wide text-white">{data.radicadoId}</p>
        </div>
      </div>

      <dl className="p-4">
        <Row label="Fecha" value={formatFechaInstitucional(data.fechaRadicado)} />
        <Row label="Hora" value={formatHoraInstitucional(data.horaRadicado ?? data.fechaRadicado)} />
        <Row label="Medio" value={labelMedioRecepcion(data.medioRecepcion)} />
        <Row label="Tipo" value={data.tipoSolicitud ?? 'No registrado'} />
        <Row label="Respuesta" value={labelCanalRespuesta(data.canalRespuesta)} />
        <Row label="Dependencia" value={data.dependencia ?? 'Ventanilla Única'} />
        <Row label="Estado" value={data.estado ?? 'Radicado'} />
        <Row label="Solicitante" value={solicitante} />
        {!anonimo && <Row label="Documento" value={data.documento} />}
        {!anonimo && <Row label="Correo" value={data.correo} />}
        <Row label="Código consulta" value={data.consultaToken} />
      </dl>

      <div className="border-t border-slate-300 px-4 py-2">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Consulte el estado en {INSTITUCION.consultaUrl}. Conserve también el correo registrado o el código de consulta mostrado en esta constancia. {INSTITUCION.municipio}, {INSTITUCION.departamento} - {INSTITUCION.pais}.
        </p>
      </div>
    </section>
  );
}
