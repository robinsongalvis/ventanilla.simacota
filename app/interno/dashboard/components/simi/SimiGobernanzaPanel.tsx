'use client';

/**
 * SimiGobernanzaPanel — Centro de gobernanza jurídica SIMI
 * Integra: Normograma + Plantillas + Métricas + Aprobaciones
 * Solo visible para ADMIN y roles con acceso.
 */

import { useState } from 'react';
import { NormogramaPanel } from './NormogramaPanel';
import { QualityMetricsPanel } from './QualityMetricsPanel';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';

type GobTab = 'normograma' | 'plantillas' | 'metricas';

interface SimiGobernanzaPanelProps {
  usuario: UsuarioAutenticado;
}

export function SimiGobernanzaPanel({ usuario }: SimiGobernanzaPanelProps) {
  const [tab, setTab] = useState<GobTab>('normograma');
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  async function sembrarPlantillas() {
    setSeeding(true); setSeedMsg(null);
    try {
      const res = await fetch('/api/simi/plantillas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'seed_base_templates' }),
      });
      const d = await res.json() as { mensaje?: string; cargadas?: number };
      setSeedMsg(d.mensaje ?? `${d.cargadas} plantillas cargadas.`);
    } catch {
      setSeedMsg('Error al cargar plantillas base.');
    } finally {
      setSeeding(false);
    }
  }

  const TABS: { id: GobTab; label: string; icono: string; roles: string[] }[] = [
    { id: 'normograma', label: 'Normograma',  icono: '📚', roles: ['ADMIN'] },
    { id: 'plantillas', label: 'Plantillas',  icono: '📝', roles: ['ADMIN'] },
    { id: 'metricas',   label: 'Métricas',    icono: '📊', roles: ['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA'] },
  ];

  const tabsVisibles = TABS.filter((t) => t.roles.includes(usuario.rol));

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#F8FAF7' }}>
      {/* Header */}
      <div className="px-5 py-4 bg-white" style={{ borderBottom: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>SIMI Jurídico</p>
        <h2 className="text-lg font-black" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>
          Centro de Gobernanza
        </h2>
        <p className="text-xs" style={{ color: '#667085' }}>
          Administración del normograma, plantillas y métricas de calidad jurídica.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white" style={{ borderBottom: '1px solid #D9E2D9' }}>
        {tabsVisibles.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap"
            style={tab === t.id
              ? { color: '#14532D', borderBottom: '2px solid #14532D' }
              : { color: '#94A3B8' }}>
            {t.icono} {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="p-5">
        {tab === 'normograma' && usuario.rol === 'ADMIN' && (
          <NormogramaPanel />
        )}

        {tab === 'plantillas' && usuario.rol === 'ADMIN' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Plantillas oficiales</p>
                <h3 className="text-base font-black" style={{ color: '#1F2933' }}>Gestión de plantillas de respuesta</h3>
              </div>
              <button
                onClick={sembrarPlantillas}
                disabled={seeding}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ background: '#D4A017', color: '#14532D' }}>
                {seeding ? 'Cargando...' : '📝 Cargar plantillas base'}
              </button>
            </div>

            {seedMsg && (
              <div className="rounded-lg p-3 text-xs" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
                {seedMsg}
              </div>
            )}

            <div className="rounded-xl bg-white p-5 text-center" style={{ border: '1px solid #D9E2D9' }}>
              <p className="text-2xl mb-2">📝</p>
              <p className="font-bold text-sm" style={{ color: '#1F2933' }}>10 plantillas base disponibles</p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                Incluyen: respuesta de fondo, solicitud de aclaración, traslado por competencia, respuesta negativa,
                información pública, reserva legal, visita técnica, queja, reclamo y trámite en curso.
              </p>
              <p className="text-[10px] mt-3 font-semibold" style={{ color: '#D4A017' }}>
                Haga clic en "Cargar plantillas base" para inicializar el normograma de plantillas de su dependencia.
              </p>
            </div>
          </div>
        )}

        {tab === 'metricas' && (
          <QualityMetricsPanel />
        )}
      </div>
    </div>
  );
}
