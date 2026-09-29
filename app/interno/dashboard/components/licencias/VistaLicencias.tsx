'use client';

/* ══════════════════════════════════════════════════════════════
   VistaLicencias — Licencias urbanísticas (Secretaría de Planeación) en el
   panel interno.

   Armazón único (ADR-0046 §7): es la ÚNICA pantalla de Licencias, con el
   mismo menú, encabezado, barra móvil y selector de tema que el resto del
   panel. Las rutas antiguas `/interno/licencias/*` redirigen aquí.

   Navegación por dirección: en el panel, `page.tsx` pasa la pantalla que
   indica la URL (`expedienteId`, `seccion`) y `onNavegar` escribe en ella
   (`rutas-licencias.ts`). Así funcionan los enlaces directos, recargar y
   los botones atrás/adelante del navegador. Sin `onNavegar` (pruebas,
   usos sueltos) la navegación es estado local, como antes.

   Reutiliza los Client Components del módulo (`BandejaLicenciasClient`,
   `DetalleLicenciaClient`, `LibroConsecutivoClient`) sin duplicar su
   lógica: abrir un expediente o volver es `onAbrirExpediente`/`onVolver`.

   La clase `licencias-impresion` marca la raíz para las reglas de
   impresión de `globals.css`: mientras Licencias está montada, imprimir
   quita el armazón de pantalla y deja fluir el contenido en varias hojas
   (libro consecutivo, proyecto de acto de desistimiento).

   El acceso lo decide `puedeAccederVista(usuario, 'LICENCIAS')` en
   `page.tsx`, que delega en `puedeVerLicencias`.
══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { BookOpen, Inbox } from 'lucide-react';
import { PanelPestana, Pestanas, type Pestana } from '@/app/components/design-system/Pestanas';
import { BandejaLicenciasClient } from '@/app/interno/licencias/components/BandejaLicenciasClient';
import { DetalleLicenciaClient } from '@/app/interno/licencias/[expedienteId]/DetalleLicenciaClient';
import { LibroConsecutivoClient } from '@/app/interno/licencias/components/LibroConsecutivoClient';
import type { DestinoLicencias, SeccionLicencias } from '@/app/interno/licencias/rutas-licencias';

/* Ola 3 (ADR-0046): las pestañas del sistema de diseño (tablist con foco
   itinerante), las mismas de Control Interno y Administración. */
const SUB_TABS: readonly Pestana<SeccionLicencias>[] = [
  { id: 'BANDEJA', etiqueta: 'Bandeja', Icono: Inbox },
  { id: 'LIBRO_CONSECUTIVO', etiqueta: 'Libro consecutivo', Icono: BookOpen },
];

export interface VistaLicenciasProps {
  /** Expediente abierto según la dirección (modo controlado). */
  expedienteId?: string | null;
  /** Pestaña según la dirección (modo controlado). */
  seccion?: SeccionLicencias;
  /** Escribe el destino en la dirección. Sin él, la navegación es local. */
  onNavegar?: (destino: DestinoLicencias) => void;
}

export function VistaLicencias({ expedienteId, seccion, onNavegar }: VistaLicenciasProps = {}) {
  const [seccionLocal, setSeccionLocal] = useState<SeccionLicencias>('BANDEJA');
  const [expedienteLocal, setExpedienteLocal] = useState<string | null>(null);

  const controlada = onNavegar !== undefined;
  const subVista = controlada ? (seccion ?? 'BANDEJA') : seccionLocal;
  const expedienteSeleccionado = controlada ? (expedienteId ?? null) : expedienteLocal;

  function navegar(destino: DestinoLicencias) {
    if (onNavegar) { onNavegar(destino); return; }
    setExpedienteLocal(destino.expedienteId ?? null);
    if (destino.seccion) setSeccionLocal(destino.seccion);
  }

  // El detalle reemplaza toda la vista — las pestañas Bandeja/Libro
  // consecutivo no aplican mientras se mira un expediente puntual. «Volver»
  // lleva a la Bandeja, como dice su etiqueta.
  if (expedienteSeleccionado) {
    return (
      <div className="licencias-impresion min-w-0">
        <DetalleLicenciaClient
          expedienteId={expedienteSeleccionado}
          onVolver={() => navegar({ seccion: 'BANDEJA' })}
        />
      </div>
    );
  }

  return (
    <div className="licencias-impresion flex h-full w-full min-w-0 flex-col gap-3">
      <div className="shrink-0 px-4 pt-3 lg:px-6 print:hidden">
        <Pestanas
          idBase="licencias"
          etiquetaGrupo="Sección de Licencias"
          pestanas={SUB_TABS}
          activa={subVista}
          onCambiar={(id) => navegar({ seccion: id })}
        />
      </div>

      <PanelPestana idBase="licencias" activa={subVista} className="min-w-0">
        {subVista === 'BANDEJA' ? (
          <BandejaLicenciasClient
            onAbrirExpediente={(id) => navegar({ expedienteId: id })}
            onIrALibroConsecutivo={() => navegar({ seccion: 'LIBRO_CONSECUTIVO' })}
          />
        ) : (
          <LibroConsecutivoClient />
        )}
      </PanelPestana>
    </div>
  );
}
