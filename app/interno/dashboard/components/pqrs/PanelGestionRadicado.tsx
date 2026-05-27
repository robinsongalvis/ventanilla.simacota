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

