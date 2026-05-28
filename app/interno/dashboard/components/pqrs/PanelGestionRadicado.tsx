'use client';

import { useState } from 'react';
import { DIRECTORIO_TENANTS, NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

type TabId = 'info' | 'trazabilidad' | 'asignar' | 'devolver';

interface Props {
  radicado: VentanillaRadicado;
  onAsignar?: (tenantId: TenantId, funcionarioUid: string) => void;
  onDevolver?: (motivo: string) => void;
  onProrroga?: (motivo: string, dias: number) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'info', label: 'Informacion general' },
  { id: 'trazabilidad', label: 'Trazabilidad' },
  { id: 'asignar', label: 'Asignar / trasladar' },
  { id: 'devolver', label: 'Devolver / prorroga' },
];

export function PanelGestionRadicado({ radicado, onAsignar, onDevolver, onProrroga }: Props) {
  const [tab, setTab] = useState<TabId>('info');
  const [tenant, setTenant] = useState<TenantId>(radicado.clasificacion.oficinaDestino);
  const [funcionarioUid, setFuncionarioUid] = useState('');
  const [motivo, setMotivo] = useState('');
  const [diasProrroga, setDiasProrroga] = useState(5);

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/50">
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 p-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              tab === item.id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'info' && (
          <div className="grid gap-3 md:grid-cols-3">
            <Info label="Radicado" value={radicado.radicadoId} />
            <Info label="Solicitante" value={radicado.solicitante.nombreCompleto} />
            <Info label="Estado" value={radicado.estadoActual} />
            <Info label="Asunto" value={radicado.detalle.asunto} className="md:col-span-3" />
            <Info label="Dependencia" value={NOMBRES_TENANT[radicado.clasificacion.oficinaDestino]} />
            <Info label="Vencimiento" value={new Date(radicado.termino.fechaVencimiento).toLocaleDateString('es-CO')} />
            <Info label="Folios" value={String(radicado.detalle.numeroFolios)} />

            {radicado.analisisIa && (
              <div className="md:col-span-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] p-4 mt-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Análisis Asistido IA</span>
                  </div>
                  <span className="text-[10px] text-indigo-300 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    Confianza: {(radicado.analisisIa.confianzaClasificacion * 100).toFixed(0)}%
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Resumen Ejecutivo IA</span>
                    <p className="text-xs text-slate-300 italic bg-slate-950/30 p-3 rounded-lg border border-white/5 leading-relaxed">
                      &quot;{radicado.analisisIa.resumenEjecutivo}&quot;
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {radicado.analisisIa.etiquetasSemanticas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {radicado.analisisIa.etiquetasSemanticas.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-500/20"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {radicado.clasificacion.oficinaDestino !== radicado.analisisIa.dependenciaSugerida && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onAsignar && radicado.analisisIa) {
                            onAsignar(radicado.analisisIa.dependenciaSugerida, '');
                          }
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.75a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-2.223l.322.322a7 7 0 0011.66-3.818.75.75 0 00-1.17-.786zm1.52-5.839a.75.75 0 00-1.17.786 5.5 5.5 0 01-9.2 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.75a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-2.223l.322.322a7 7 0 0011.66-3.818z" clipRule="evenodd" />
                        </svg>
                        Re-enrutar a {NOMBRES_TENANT[radicado.analisisIa.dependenciaSugerida] || radicado.analisisIa.dependenciaSugerida}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'trazabilidad' && (
          <ol className="space-y-3">
            {radicado.trazabilidad.map((evento, index) => (
              <li key={`${evento.fecha}-${index}`} className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">{evento.accion}</p>
                  <p className="text-xs text-slate-500">{new Date(evento.fecha).toLocaleString('es-CO')} - {evento.actorNombre}</p>
                  <p className="mt-1 text-sm text-slate-400">{evento.nota}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {tab === 'asignar' && (
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Oficina destino</span>
              <select
                value={tenant}
                onChange={(e) => setTenant(e.target.value as TenantId)}
                className="w-full rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
              >
                {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((tenantId) => (
                  <option key={tenantId} value={tenantId}>{NOMBRES_TENANT[tenantId]}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Funcionario responsable</span>
              <input
                value={funcionarioUid}
                onChange={(e) => setFuncionarioUid(e.target.value)}
                placeholder="UID o selector de funcionario"
                className="w-full rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
              />
            </label>
            <button
              type="button"
              onClick={() => onAsignar?.(tenant, funcionarioUid)}
              className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500"
            >
              Asignar
            </button>
          </div>
        )}

        {tab === 'devolver' && (
          <div className="space-y-3">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Motivo</span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
              />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Dias prorroga</span>
                <input
                  value={diasProrroga}
                  onChange={(e) => setDiasProrroga(Number(e.target.value.replace(/\D/g, '') || 0))}
                  className="w-32 rounded-lg border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                />
              </label>
              <button type="button" onClick={() => onDevolver?.(motivo)} className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm font-bold text-rose-300 hover:bg-rose-500/10">
                Devolver
              </button>
              <button type="button" onClick={() => onProrroga?.(motivo, diasProrroga)} className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-bold text-amber-300 hover:bg-amber-500/10">
                Aplicar prorroga
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">{value}</p>
    </div>
  );
}

