'use client';

/**
 * SimiGobernanzaPanel — Centro de gobernanza jurídica SIMI
 * Integra: Normograma + Plantillas + Métricas + Aprobaciones
 * Solo visible para ADMIN y roles con acceso.
 */

import { useState } from 'react';
import { NormogramaPanel } from './NormogramaPanel';
import { QualityMetricsPanel } from './QualityMetricsPanel';
import { E2ETestPanel } from './E2ETestPanel';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { PanelPestana, Pestanas } from '@/app/components/design-system/Pestanas';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { BarChart3, BookOpen, FilePlus2, FileText, FlaskConical, type LucideIcon } from 'lucide-react';

type GobTab = 'normograma' | 'plantillas' | 'metricas' | 'pruebas';

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

  /* Ola 3 (ADR-0046): íconos SVG en lugar de emojis; mismos roles por pestaña. */
  const TABS: { id: GobTab; label: string; Icono: LucideIcon; roles: string[] }[] = [
    { id: 'normograma', label: 'Normograma',  Icono: BookOpen,     roles: ['ADMIN'] },
    { id: 'plantillas', label: 'Plantillas',  Icono: FileText,     roles: ['ADMIN'] },
    { id: 'metricas',   label: 'Métricas',    Icono: BarChart3,    roles: ['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA'] },
    { id: 'pruebas',    label: 'Pruebas E2E', Icono: FlaskConical, roles: ['ADMIN'] },
  ];

  const tabsVisibles = TABS.filter((t) => t.roles.includes(usuario.rol));

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      <SectionHeader
        titulo="Centro de Gobernanza"
        subtitulo="SIMI Jurídico · Administración del normograma, plantillas y métricas de calidad jurídica."
      />

      <div className="px-3 sm:px-4 lg:px-6">
        <Pestanas
          idBase="gobernanza-simi"
          etiquetaGrupo="Secciones del Centro de Gobernanza"
          pestanas={tabsVisibles.map((t) => ({ id: t.id, etiqueta: t.label, Icono: t.Icono }))}
          activa={tab}
          onCambiar={setTab}
        />
      </div>

      {/* Contenido */}
      <PanelPestana idBase="gobernanza-simi" activa={tab} className="px-3 pt-3 pb-6 sm:px-4 lg:px-6">
        {tab === 'normograma' && usuario.rol === 'ADMIN' && (
          <NormogramaPanel />
        )}

        {tab === 'plantillas' && usuario.rol === 'ADMIN' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Plantillas oficiales</p>
                <h3 className="text-base font-black" style={{ color: 'var(--tema-texto-172033)' }}>Gestión de plantillas de respuesta</h3>
              </div>
              <BotonAccion variante="primaria" Icono={FilePlus2} onClick={sembrarPlantillas} disabled={seeding}>
                {seeding ? 'Cargando...' : 'Cargar plantillas base'}
              </BotonAccion>
            </div>

            {seedMsg && (
              <div role="status" className="rounded-lg p-3 text-xs" style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)', color: 'var(--tema-texto-006b45)' }}>
                {seedMsg}
              </div>
            )}

            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4 text-center">
              <FileText className="mx-auto mb-2 h-6 w-6" strokeWidth={1.9} style={{ color: 'var(--tema-texto-007049)' }} aria-hidden="true" />
              <p className="font-bold text-sm" style={{ color: 'var(--tema-texto-172033)' }}>10 plantillas base disponibles</p>
              <p className="text-xs mt-1" style={{ color: 'var(--tema-texto-64748b)' }}>
                Incluyen: respuesta de fondo, solicitud de aclaración, traslado por competencia, respuesta negativa,
                información pública, reserva legal, visita técnica, queja, reclamo y trámite en curso.
              </p>
              {/* #8E5C06: el dorado #E5A31A como texto sobre blanco se queda en 2,1:1. */}
              <p className="text-[10px] mt-3 font-semibold" style={{ color: 'var(--tema-texto-8e5c06)' }}>
                Haga clic en Cargar plantillas base para inicializar el normograma de plantillas de su dependencia.
              </p>
            </div>
          </div>
        )}

        {tab === 'metricas' && (
          <QualityMetricsPanel />
        )}

        {tab === 'pruebas' && usuario.rol === 'ADMIN' && (
          <E2ETestPanel />
        )}
      </PanelPestana>
    </div>
  );
}
