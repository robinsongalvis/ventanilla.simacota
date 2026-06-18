'use client';

/**
 * Centro de Control Interno — pantalla principal con pestañas.
 *
 * Vigila, audita, alerta y solicita planes de mejora.
 * Nunca modifica respuestas oficiales ni cambia el estado de un radicado.
 */

import { useState } from 'react';
import { PanoramaGeneralPanel } from './PanoramaGeneralPanel';
import { PanelAlertasControl } from './PanelAlertasControl';
import { PanelHallazgos } from './PanelHallazgos';
import { PanelPlanesMejora } from './PanelPlanesMejora';
import { PanelDependenciasControl } from './PanelDependenciasControl';
import { PanelReportesControl } from './PanelReportesControl';

type PestanaCi =
  | 'PANORAMA'
  | 'ALERTAS'
  | 'HALLAZGOS'
  | 'PLANES'
  | 'DEPENDENCIAS'
  | 'REPORTES';

interface ItemTab {
  id:    PestanaCi;
  label: string;
  sub:   string;
}

const TABS: ItemTab[] = [
  { id: 'PANORAMA',    label: 'Panorama general', sub: 'KPIs profesionales' },
  { id: 'ALERTAS',     label: 'Riesgos y alertas', sub: 'Motor de riesgos' },
  { id: 'HALLAZGOS',   label: 'Hallazgos',         sub: 'Registro y seguimiento' },
  { id: 'PLANES',      label: 'Planes de mejora',  sub: 'Acciones correctivas' },
  { id: 'DEPENDENCIAS', label: 'Dependencias',     sub: 'Desempeño comparado' },
  { id: 'REPORTES',    label: 'Reportes',          sub: 'Exportación institucional' },
];

export function CentroControlInterno() {
  const [tab, setTab] = useState<PestanaCi>('PANORAMA');

  return (
    <div className="space-y-4">
      {/* Encabezado institucional */}
      <header className="rounded-2xl bg-white p-5 sm:p-6" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
          Oficina de Control Interno
        </p>
        <h1 className="mt-1 text-xl sm:text-2xl font-black" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>
          Centro de Control Interno
        </h1>
        <p className="mt-1 text-xs sm:text-sm" style={{ color: '#667085' }}>
          Seguimiento, auditoría, riesgos y mejora continua de la gestión PQRSD.
        </p>
        <p className="mt-2 text-[10px] font-medium" style={{ color: '#94A3B8' }}>
          Control Interno observa, audita y solicita planes de mejora. No modifica respuestas oficiales ni cierra radicados.
        </p>
      </header>

      {/* Pestañas */}
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const activa = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="text-left rounded-xl px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
              style={{
                background: activa ? '#14532D' : '#FFFFFF',
                color:      activa ? '#FFFFFF' : '#14532D',
                border:    `1px solid ${activa ? '#14532D' : '#D9E2D9'}`,
              }}
            >
              <span className="block text-xs font-bold">{t.label}</span>
              <span className="block text-[10px] mt-0.5" style={{ opacity: activa ? 0.8 : 0.7 }}>
                {t.sub}
              </span>
            </button>
          );
        })}
      </nav>

      <section>
        {tab === 'PANORAMA'     && <PanoramaGeneralPanel />}
        {tab === 'ALERTAS'      && <PanelAlertasControl />}
        {tab === 'HALLAZGOS'    && <PanelHallazgos />}
        {tab === 'PLANES'       && <PanelPlanesMejora />}
        {tab === 'DEPENDENCIAS' && <PanelDependenciasControl />}
        {tab === 'REPORTES'     && <PanelReportesControl />}
      </section>
    </div>
  );
}
