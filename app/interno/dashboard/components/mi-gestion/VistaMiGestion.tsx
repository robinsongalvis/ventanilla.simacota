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
import { planDeSemana } from '@/lib/mi-gestion/plan-semana';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { StatusBadge } from '@/app/components/design-system/StatusBadge';
import { EmptyState } from '@/app/components/design-system/EmptyState';
import type { IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { CheckCircle2, Clock3, FileText, Timer, UsersRound } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Sprint Mi gestión — dashboard personal del funcionario.

   Réplica fiel del boceto aprobado ("limpio y puro"): header con chip
   de semáforo, barra de cumplimiento con zonas de color y marcador,
   cinco indicadores (desde la Ola 3, los del Tablero — ADR-0046),
   "Atiende primero" clicable y la
   tendencia semanal en barras. Autocontrol: cada quien ve SOLO lo
   suyo — al entrar, en dos segundos sabe cómo va su gestión.
══════════════════════════════════════════════════════════════ */

const CHIP_SEMAFORO: Record<SemaforoGestion, { label: string; bg: string; texto: string; borde: string }> = {
  VERDE: { label: 'Al día',    bg: 'var(--tema-fondo-eaf3de)', texto: 'var(--tema-texto-27500a)', borde: 'var(--tema-borde-97c459)' },
  AMBAR: { label: 'En riesgo', bg: 'var(--tema-fondo-faeeda)', texto: 'var(--tema-texto-633806)', borde: '#EF9F27' },
  ROJO:  { label: 'Atrasado',  bg: 'var(--tema-fondo-fcebeb)', texto: 'var(--tema-texto-791f1f)', borde: '#F09595' },
};

const COLOR_BARRA: Record<SemaforoGestion, string> = {
  VERDE: '#639922',
  AMBAR: '#EF9F27',
  ROJO:  '#E24B4A',
};

/* Sprint Cola personal — chip de término y riel por nivel de urgencia. */
const CHIP_PENDIENTE: Record<NivelPendiente, { bg: string; texto: string; riel: string }> = {
  ROJO:        { bg: 'var(--tema-fondo-fcebeb)', texto: 'var(--tema-texto-791f1f)', riel: 'var(--tema-texto-d81e1e)' },
  AMBAR:       { bg: 'var(--tema-fondo-faeeda)', texto: 'var(--tema-texto-633806)', riel: 'var(--tema-texto-d97706)' },
  VERDE:       { bg: 'var(--tema-fondo-eaf3de)', texto: 'var(--tema-texto-27500a)', riel: 'var(--tema-texto-97c459)' },
  SIN_TERMINO: { bg: 'var(--tema-fondo-eef2f5)', texto: 'var(--tema-texto-3a4551)', riel: 'var(--tema-texto-cbd5d1)' },
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
  // Sprint Semana + badge — cómo se distribuye la semana.
  const semana = useMemo(
    () => planDeSemana(radicados, usuario.uid, ahora ?? new Date()),
    [radicados, usuario.uid, ahora],
  );
  const chip = CHIP_SEMAFORO[g.semaforo];
  const colorBarra = COLOR_BARRA[g.semaforo];
  const pct = g.pctCumplimiento;
  const maxTendencia = Math.max(1, ...g.tendencia.map((s) => s.resueltos));

  /* Ola 3 (ADR-0046) — los mismos cinco indicadores, con el Indicador del
     Tablero y sus tonos: Asignados en azul y Pendientes en gris, como allá.
     Son de solo lectura: no filtran nada, así que no son botones. */
  const kpis: IndicadorEstaticoProps[] = [
    { etiqueta: 'Asignados',   valor: g.asignados,   tono: 'azul',  Icono: UsersRound },
    { etiqueta: 'Respondidos', valor: g.respondidos, tono: 'verde', Icono: CheckCircle2 },
    { etiqueta: 'Pendientes',  valor: g.pendientes,  tono: 'gris',  Icono: FileText },
    {
      etiqueta: 'Tiempo promedio (días)',
      valor: g.tiempoPromedioDias !== null ? g.tiempoPromedioDias.toLocaleString('es-CO') : '—',
      tono: 'gris',
      Icono: Timer,
    },
    { etiqueta: 'Por vencer', valor: g.porVencer + g.vencidos, descripcion: 'Incluye los ya vencidos', tono: 'ambar', Icono: Clock3 },
  ];

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      {/* ── Header con chip de semáforo ── */}
      <SectionHeader
        titulo={`${usuario.nombre} · ${NOMBRES_TENANT[usuario.tenantId] ?? usuario.tenantId}`}
        subtitulo="Mi gestión · desempeño personal"
        indicador={<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#3B9E5F' }} />}
        acciones={
          <StatusBadge
            tono={g.semaforo === 'VERDE' ? 'success' : g.semaforo === 'AMBAR' ? 'warning' : 'danger'}
            conPunto
            tamano="md"
          >
            {chip.label}
          </StatusBadge>
        }
      />

      {/* ── Barra de cumplimiento con zonas y marcador ── */}
      <div className="px-4 md:px-6 pt-4 pb-1 bg-[var(--tema-fondo-ffffff)]" style={{ borderBottom: '1px solid var(--tema-borde-e4ebf0)' }}>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-bold" style={{ color: 'var(--tema-texto-172033)' }}>Cumplimiento de términos</span>
          <span className="font-black tabular-nums" style={{ fontSize: 26, color: pct !== null ? colorBarra : 'var(--tema-texto-64748b)' }}>
            {pct !== null ? `${pct}%` : '—'}
          </span>
        </div>
        <div className="relative h-3.5 rounded-full overflow-hidden flex" aria-label="Barra de cumplimiento">
          <div style={{ width: '60%', background: '#E24B4A', opacity: 0.25 }} />
          <div style={{ width: '25%', background: '#EF9F27', opacity: 0.3 }} />
          <div style={{ width: '15%', background: 'color-mix(in srgb, #639922 33.3%, transparent)' }} />
          {pct !== null && (
            <>
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: colorBarra }} />
              {/* Marcador con el color de texto del tema: visible en claro y oscuro. */}
              <div className="absolute rounded-sm" style={{ top: -2, bottom: -2, left: `calc(${pct}% - ${(pct / 100) * 3}px)`, width: 3, background: 'var(--tema-texto-172033)' }} />
            </>
          )}
        </div>
        <div className="flex justify-between mt-1.5 text-[10.5px]" style={{ color: 'var(--tema-texto-64748b)' }}>
          <span>0–60 · atrasado</span><span>60–85 · en riesgo</span><span>85–100 · al día</span>
        </div>
        <p className="mt-2 mb-2.5 text-[11.5px]" style={{ color: 'var(--tema-texto-5f6f64)' }}>
          {pct !== null
            ? MENSAJE_SEMAFORO[g.semaforo]
            : 'El porcentaje aparece cuando resuelvas tus primeros radicados con dato de cumplimiento.'}
        </p>
      </div>

      {/* ── Cinco indicadores (lenguaje del Tablero) ── */}
      <FilaTarjetas etiqueta="Mis indicadores" className="px-4 py-3 md:px-6">
        {kpis.map((k) => (
          <TarjetaIndicador key={k.etiqueta} {...k} />
        ))}
      </FilaTarjetas>

      {/* ── Atiende primero + tendencia semanal ── */}
      <div className="grid gap-3 px-4 md:px-6 pb-4 grid-cols-1 md:grid-cols-2">
        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] px-3.5 py-3" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
          <SectionHeader titulo="Atiende primero" variante="compact" />
          {g.atencionPrioritaria.length === 0 ? (
            <EmptyState titulo="Sin urgencias" descripcion="Nada vence en los próximos 2 días." />
          ) : (
            g.atencionPrioritaria.map((a, i) => (
              <button
                key={a.radicadoId}
                type="button"
                onClick={() => onAbrirRadicado(a.radicadoId)}
                aria-label={`Abrir radicado ${a.radicadoId}`}
                className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-[var(--tema-fondo-f4f8f4)] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                style={i > 0 ? { borderTop: '1px solid var(--tema-borde-eef2ee)' } : undefined}
              >
                <span className="w-[3px] self-stretch rounded-sm shrink-0" style={{ background: a.nivel === 'ROJO' ? 'var(--tema-texto-d81e1e)' : 'var(--tema-texto-d97706)' }} />
                <span className="font-mono text-[11.5px] font-bold truncate" style={{ color: 'var(--tema-texto-172033)' }}>
                  {a.radicadoId}
                </span>
                <span
                  className="ml-auto text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={a.nivel === 'ROJO'
                    ? { background: 'var(--tema-fondo-fcebeb)', color: 'var(--tema-texto-791f1f)' }
                    : { background: 'var(--tema-fondo-faeeda)', color: 'var(--tema-texto-633806)' }}
                >
                  {a.etiqueta}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] px-3.5 py-3" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
          <SectionHeader titulo="Respondidos por semana" variante="compact" />
          <div className="flex items-end gap-2" style={{ height: 64 }}>
            {g.tendencia.map((s) => (
              <div
                key={s.etiqueta}
                className="flex-1 rounded-t"
                title={`${s.etiqueta}: ${s.resueltos}`}
                style={{
                  background: s.etiqueta === 'Esta' ? '#639922' : 'var(--tema-fondo-97c459)',
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
                  ? { color: 'var(--tema-texto-172033)', fontWeight: 600 }
                  : { color: 'var(--tema-texto-64748b)' }}
              >
                {s.etiqueta}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tu semana: cómo se distribuyen los vencimientos ── */}
      <div className="px-4 md:px-6 pb-3">
        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] px-3.5 py-3" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
          <SectionHeader
            titulo="Tu semana"
            variante="compact"
            acciones={
              <>
                {semana.vencidos > 0 && (
                  <StatusBadge tono="danger" tamano="sm">
                    {semana.vencidos} ya vencido{semana.vencidos !== 1 ? 's' : ''}
                  </StatusBadge>
                )}
                {semana.despues > 0 && (
                  <span className="text-[10.5px]" style={{ color: 'var(--tema-texto-64748b)' }}>
                    +{semana.despues} después de esta semana
                  </span>
                )}
              </>
            }
          />
          {semana.totalSemana === 0 && semana.vencidos === 0 ? (
            <EmptyState titulo="Semana despejada" descripcion="Nada te vence esta semana." />
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {semana.dias.map((d) => (
                <div
                  key={d.ymd}
                  className="rounded-lg px-1 py-1.5 text-center"
                  style={d.esHoy
                    ? { background: 'var(--tema-fondo-f4f8f4)', border: '1.5px solid var(--tema-borde-007049)' }
                    : { border: '1px solid var(--tema-borde-eef2ee)' }}
                >
                  <p
                    className="font-black tabular-nums leading-none"
                    style={{ fontSize: 18, color: d.vencen > 0 ? 'var(--tema-texto-172033)' : 'var(--tema-texto-475569)' }}
                  >
                    {d.vencen}
                  </p>
                  <p
                    className="text-[9.5px] mt-1"
                    style={d.esHoy
                      ? { color: 'var(--tema-texto-007049)', fontWeight: 700 }
                      : { color: 'var(--tema-texto-64748b)' }}
                  >
                    {d.etiqueta}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mis pendientes: la cola completa de trabajo ── */}
      <div className="px-4 md:px-6 pb-5">
        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] px-3.5 py-3" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
          <SectionHeader
            titulo="Mis pendientes"
            variante="compact"
            contador={`${pendientes.length} radicado${pendientes.length !== 1 ? 's' : ''}`}
          />
          {pendientes.length === 0 ? (
            <EmptyState titulo="Bandeja limpia" descripcion="No tienes radicados pendientes." />
          ) : (
            pendientes.map((p, i) => {
              const chip = CHIP_PENDIENTE[p.nivel];
              return (
                <button
                  key={p.radicadoId}
                  type="button"
                  onClick={() => onAbrirRadicado(p.radicadoId)}
                  aria-label={`Abrir radicado ${p.radicadoId}`}
                  className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-[var(--tema-fondo-f4f8f4)] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                  style={i > 0 ? { borderTop: '1px solid var(--tema-borde-eef2ee)' } : undefined}
                >
                  <span className="w-[3px] self-stretch rounded-sm shrink-0" style={{ background: chip.riel }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11.5px] font-bold" style={{ color: 'var(--tema-texto-172033)' }}>
                        {p.radicadoId}
                      </span>
                      <span
                        className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--tema-fondo-f4f8f4)', color: 'var(--tema-texto-5f6f64)', border: '1px solid var(--tema-borde-e4ebf0)' }}
                      >
                        {LABEL_ESTADO_PENDIENTE[p.estado] ?? p.estado}
                      </span>
                    </div>
                    <p className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--tema-texto-3a4551)' }}>
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
