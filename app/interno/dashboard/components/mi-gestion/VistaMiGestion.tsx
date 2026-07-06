'use client';

import { useMemo } from 'react';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  calcularMiGestion,
  type SemaforoGestion,
} from '@/lib/mi-gestion/calcular-mi-gestion';
import { misPendientes, type NivelPendiente } from '@/lib/mi-gestion/mis-pendientes';

/* ══════════════════════════════════════════════════════════════
   Sprint Mi gestión — dashboard personal del funcionario.

   Réplica fiel del boceto aprobado ("limpio y puro"): header con chip
   de semáforo, barra de cumplimiento con zonas de color y marcador,
   cinco tarjetas con riel superior, "Atiende primero" clicable y la
   tendencia semanal en barras. Autocontrol: cada quien ve SOLO lo
   suyo — al entrar, en dos segundos sabe cómo va su gestión.
══════════════════════════════════════════════════════════════ */

const CHIP_SEMAFORO: Record<SemaforoGestion, { label: string; bg: string; texto: string; borde: string }> = {
  VERDE: { label: 'Al día',    bg: '#EAF3DE', texto: '#27500A', borde: '#97C459' },
  AMBAR: { label: 'En riesgo', bg: '#FAEEDA', texto: '#633806', borde: '#EF9F27' },
  ROJO:  { label: 'Atrasado',  bg: '#FCEBEB', texto: '#791F1F', borde: '#F09595' },
};

const COLOR_BARRA: Record<SemaforoGestion, string> = {
  VERDE: '#639922',
  AMBAR: '#EF9F27',
  ROJO:  '#E24B4A',
};

/* Sprint Cola personal — chip de término y riel por nivel de urgencia. */
const CHIP_PENDIENTE: Record<NivelPendiente, { bg: string; texto: string; riel: string }> = {
  ROJO:        { bg: '#FCEBEB', texto: '#791F1F', riel: '#DC2626' },
  AMBAR:       { bg: '#FAEEDA', texto: '#633806', riel: '#D97706' },
  VERDE:       { bg: '#EAF3DE', texto: '#27500A', riel: '#97C459' },
  SIN_TERMINO: { bg: '#EEF2F5', texto: '#3A4551', riel: '#CBD5D1' },
};

const LABEL_ESTADO_PENDIENTE: Record<string, string> = {
  PENDIENTE:   'Pendiente',
  ASIGNADO:    'Asignado',
  EN_REVISION: 'En revisión',
  EN_PROCESO:  'En proceso',
  DEVUELTO:    'Devuelto',
  PRORROGA:    'Prórroga',
};

const MENSAJE_SEMAFORO: Record<SemaforoGestion, string> = {
  VERDE: 'Verde mientras respondas a tiempo · pasa a ámbar si algo se acerca al vencimiento · rojo con vencidos activos.',
  AMBAR: 'Atento: tienes vencimientos cerca — resuélvelos y la barra vuelve a verde.',
  ROJO:  'Prioriza los vencidos de "Atiende primero" — tu semáforo vuelve a verde al ponerte al día.',
};

export interface VistaMiGestionProps {
  radicados: VentanillaRadicado[];
  usuario:   { uid: string; nombre: string; tenantId: TenantId };
  onAbrirRadicado: (radicadoId: string) => void;
  /** Referencia temporal inyectable para tests deterministas. */
  ahora?: Date;
}

export function VistaMiGestion({ radicados, usuario, onAbrirRadicado, ahora }: VistaMiGestionProps) {
  const g = useMemo(
    () => calcularMiGestion(radicados, usuario.uid, ahora ?? new Date()),
    [radicados, usuario.uid, ahora],
  );
  // Sprint Cola personal — la lista completa de trabajo, no solo lo urgente.
  const pendientes = useMemo(
    () => misPendientes(radicados, usuario.uid, ahora ?? new Date()),
    [radicados, usuario.uid, ahora],
  );
  const chip = CHIP_SEMAFORO[g.semaforo];
  const colorBarra = COLOR_BARRA[g.semaforo];
  const pct = g.pctCumplimiento;
  const maxTendencia = Math.max(1, ...g.tendencia.map((s) => s.resueltos));

  const kpis: { valor: string; label: string; riel: string; color: string }[] = [
    { valor: String(g.asignados),   label: 'Asignados',   riel: '#14532D', color: '#12261A' },
    { valor: String(g.respondidos), label: 'Respondidos', riel: '#639922', color: '#3B6D11' },
    { valor: String(g.pendientes),  label: 'Pendientes',  riel: '#475569', color: '#3A4551' },
    {
      valor: g.tiempoPromedioDias !== null ? g.tiempoPromedioDias.toLocaleString('es-CO') : '—',
      label: 'Tiempo promedio (días)', riel: '#1D4ED8', color: '#185FA5',
    },
    { valor: String(g.porVencer + g.vencidos), label: 'Por vencer', riel: '#D97706', color: '#854F0B' },
  ];

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: '#F8FAF7' }}>
      {/* ── Header con chip de semáforo ── */}
      <div
        className="flex items-center justify-between gap-3 px-4 md:px-6 pt-4 pb-3 bg-white"
        style={{ borderBottom: '1px solid #E3EAE3' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#5F8A6E' }}>
              Mi gestión · desempeño personal
            </span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#3B9E5F' }} />
            <span className="text-[10px]" style={{ color: '#7A8B7F' }}>tiempo real</span>
          </div>
          <p className="text-lg font-black leading-tight mt-0.5 truncate" style={{ color: '#12261A' }}>
            {usuario.nombre} · {NOMBRES_TENANT[usuario.tenantId] ?? usuario.tenantId}
          </p>
        </div>
        <span
          className="text-[11px] font-semibold px-3 py-1 rounded-full shrink-0"
          style={{ background: chip.bg, color: chip.texto, border: `1px solid ${chip.borde}` }}
        >
          {chip.label}
        </span>
      </div>

      {/* ── Barra de cumplimiento con zonas y marcador ── */}
      <div className="px-4 md:px-6 pt-4 pb-1 bg-white" style={{ borderBottom: '1px solid #E3EAE3' }}>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-bold" style={{ color: '#12261A' }}>Cumplimiento de términos</span>
          <span className="font-black tabular-nums" style={{ fontSize: 26, color: pct !== null ? colorBarra : '#94A3B8' }}>
            {pct !== null ? `${pct}%` : '—'}
          </span>
        </div>
        <div className="relative h-3.5 rounded-full overflow-hidden flex" aria-label="Barra de cumplimiento">
          <div style={{ width: '60%', background: '#E24B4A', opacity: 0.25 }} />
          <div style={{ width: '25%', background: '#EF9F27', opacity: 0.3 }} />
          <div style={{ width: '15%', background: '#63992255' }} />
          {pct !== null && (
            <>
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: colorBarra }} />
              <div className="absolute rounded-sm" style={{ top: -2, bottom: -2, left: `${pct}%`, width: 3, background: '#173404' }} />
            </>
          )}
        </div>
        <div className="flex justify-between mt-1.5 text-[10.5px]" style={{ color: '#94A3B8' }}>
          <span>0–60 · atrasado</span><span>60–85 · en riesgo</span><span>85–100 · al día</span>
        </div>
        <p className="mt-2 mb-2.5 text-[11.5px]" style={{ color: '#5F6F64' }}>
          {pct !== null
            ? MENSAJE_SEMAFORO[g.semaforo]
            : 'El porcentaje aparece cuando resuelvas tus primeros radicados con dato de cumplimiento.'}
        </p>
      </div>

      {/* ── Cinco tarjetas con riel superior ── */}
      <div className="grid gap-2.5 px-4 md:px-6 py-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))' }}>
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-[10px] bg-white px-3 py-2.5"
            style={{ border: '1px solid #E3EAE3', borderTop: `3px solid ${k.riel}` }}
          >
            <p className="font-black tabular-nums leading-none" style={{ fontSize: 24, color: k.color }}>{k.valor}</p>
            <p className="text-[11px] mt-1" style={{ color: '#667085' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Atiende primero + tendencia semanal ── */}
      <div className="grid gap-3 px-4 md:px-6 pb-4 grid-cols-1 md:grid-cols-2">
        <div className="rounded-xl bg-white px-3.5 py-3" style={{ border: '1px solid #E3EAE3' }}>
          <p className="text-[10.5px] font-bold uppercase tracking-widest mb-2" style={{ color: '#854F0B' }}>
            Atiende primero
          </p>
          {g.atencionPrioritaria.length === 0 ? (
            <p className="text-xs py-2" style={{ color: '#7A8B7F' }}>
              Sin urgencias: nada vence en los próximos 2 días.
            </p>
          ) : (
            g.atencionPrioritaria.map((a, i) => (
              <button
                key={a.radicadoId}
                type="button"
                onClick={() => onAbrirRadicado(a.radicadoId)}
                aria-label={`Abrir radicado ${a.radicadoId}`}
                className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-[#F4F8F4] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                style={i > 0 ? { borderTop: '1px solid #EEF2EE' } : undefined}
              >
                <span className="w-[3px] self-stretch rounded-sm shrink-0" style={{ background: a.nivel === 'ROJO' ? '#DC2626' : '#D97706' }} />
                <span className="font-mono text-[11.5px] font-bold truncate" style={{ color: '#12261A' }}>
                  {a.radicadoId}
                </span>
                <span
                  className="ml-auto text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={a.nivel === 'ROJO'
                    ? { background: '#FCEBEB', color: '#791F1F' }
                    : { background: '#FAEEDA', color: '#633806' }}
                >
                  {a.etiqueta}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="rounded-xl bg-white px-3.5 py-3" style={{ border: '1px solid #E3EAE3' }}>
          <p className="text-[10.5px] font-bold uppercase tracking-widest mb-2" style={{ color: '#5F8A6E' }}>
            Respondidos por semana
          </p>
          <div className="flex items-end gap-2" style={{ height: 64 }}>
            {g.tendencia.map((s) => (
              <div
                key={s.etiqueta}
                className="flex-1 rounded-t"
                title={`${s.etiqueta}: ${s.resueltos}`}
                style={{
                  background: s.etiqueta === 'Esta' ? '#639922' : '#97C459',
                  height: `${s.resueltos === 0 ? 4 : Math.max(12, Math.round((s.resueltos / maxTendencia) * 90))}%`,
                  opacity: s.resueltos === 0 ? 0.35 : 1,
                }}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            {g.tendencia.map((s) => (
              <span
                key={s.etiqueta}
                className="flex-1 text-center text-[10px]"
                style={s.etiqueta === 'Esta'
                  ? { color: '#12261A', fontWeight: 600 }
                  : { color: '#94A3B8' }}
              >
                {s.etiqueta}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mis pendientes: la cola completa de trabajo ── */}
      <div className="px-4 md:px-6 pb-5">
        <div className="rounded-xl bg-white px-3.5 py-3" style={{ border: '1px solid #E3EAE3' }}>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: '#5F8A6E' }}>
              Mis pendientes
            </p>
            <span className="text-[11px] tabular-nums" style={{ color: '#7A8B7F' }}>
              {pendientes.length} radicado{pendientes.length !== 1 ? 's' : ''}
            </span>
          </div>
          {pendientes.length === 0 ? (
            <p className="text-xs py-2" style={{ color: '#7A8B7F' }}>
              No tienes radicados pendientes — bandeja limpia.
            </p>
          ) : (
            pendientes.map((p, i) => {
              const chip = CHIP_PENDIENTE[p.nivel];
              return (
                <button
                  key={p.radicadoId}
                  type="button"
                  onClick={() => onAbrirRadicado(p.radicadoId)}
                  aria-label={`Abrir radicado ${p.radicadoId}`}
                  className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-[#F4F8F4] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                  style={i > 0 ? { borderTop: '1px solid #EEF2EE' } : undefined}
                >
                  <span className="w-[3px] self-stretch rounded-sm shrink-0" style={{ background: chip.riel }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11.5px] font-bold" style={{ color: '#12261A' }}>
                        {p.radicadoId}
                      </span>
                      <span
                        className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                        style={{ background: '#F4F8F4', color: '#5F6F64', border: '1px solid #E3EAE3' }}
                      >
                        {LABEL_ESTADO_PENDIENTE[p.estado] ?? p.estado}
                      </span>
                    </div>
                    <p className="text-[11.5px] mt-0.5 truncate" style={{ color: '#3A4551' }}>
                      {p.asunto || 'Sin asunto'}
                    </p>
                  </div>
                  <span
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: chip.bg, color: chip.texto }}
                  >
                    {p.etiqueta}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
