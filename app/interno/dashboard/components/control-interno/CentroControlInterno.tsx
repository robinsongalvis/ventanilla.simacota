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
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { PanelPestana, Pestanas } from '@/app/components/design-system/Pestanas';

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
  { id: 'PANORAMA',    label: 'Resumen',           sub: 'Qué revisar hoy' },
  { id: 'ALERTAS',     label: 'Alertas',           sub: 'Situaciones por revisar' },
  { id: 'HALLAZGOS',   label: 'Hallazgos',         sub: 'Registro y seguimiento' },
  { id: 'PLANES',      label: 'Planes de mejora',  sub: 'Acciones correctivas' },
  { id: 'DEPENDENCIAS', label: 'Dependencias',     sub: 'Cumplimiento por área' },
  { id: 'REPORTES',    label: 'Reportes',          sub: 'Informes para soporte' },
];

/* Ola 3 (ADR-0046): pestañas compartidas del sistema de diseño. */
const PESTANAS = TABS.map((t) => ({ id: t.id, etiqueta: t.label, detalle: t.sub }));

export function CentroControlInterno() {
  const [tab, setTab] = useState<PestanaCi>('PANORAMA');

  return (
    <div className="space-y-3">
      {/* Encabezado institucional */}
      <SectionHeader
        titulo="Centro de Control Interno"
        subtitulo="Seguimiento a riesgos, hallazgos, planes de mejora y cumplimiento de las dependencias."
        nota="Este módulo le permite revisar, registrar hallazgos y solicitar planes de mejora. No reemplaza al funcionario que responde el radicado."
        indicador={<span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Oficina de Control Interno</span>}
      />

      {/* Pestañas */}
      <div className="px-3 sm:px-4 lg:px-6">
        <Pestanas idBase="control-interno" etiquetaGrupo="Secciones de Control Interno" pestanas={PESTANAS} activa={tab} onCambiar={setTab} />
      </div>

      <PanelPestana idBase="control-interno" activa={tab} className="px-3 sm:px-4 lg:px-6">
        {tab === 'PANORAMA'     && <PanoramaGeneralPanel />}
        {tab === 'ALERTAS'      && <PanelAlertasControl />}
        {tab === 'HALLAZGOS'    && <PanelHallazgos />}
        {tab === 'PLANES'       && <PanelPlanesMejora />}
        {tab === 'DEPENDENCIAS' && <PanelDependenciasControl />}
        {tab === 'REPORTES'     && <PanelReportesControl />}
      </PanelPestana>
    </div>
  );
}
