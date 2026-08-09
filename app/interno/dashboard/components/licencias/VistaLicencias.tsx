'use client';

/* ══════════════════════════════════════════════════════════════
   VistaLicencias — Bloque B ("la ventanita").

   Licencias urbanísticas (Secretaría de Planeación) como pestaña REAL del
   panel interno (`VistaActual === 'LICENCIAS'`, `lib/store/
   ventanillaStore.tsx`), NO como página aparte. Reemplaza el antiguo link
   de página completa a `/interno/licencias` — ver JSDoc de
   `puedeVerLicencias` en `app/interno/dashboard/page.tsx`.

   Reutiliza literalmente los Client Components del módulo standalone
   (`BandejaLicenciasClient`, `DetalleLicenciaClient`) en vez de duplicar su
   lógica (fetch, KPIs, checklist…) — ambos ganaron props ADITIVAS y
   opcionales (`onAbrirExpediente`, `onVolver`) para que, cuando se montan
   aquí, la navegación bandeja↔detalle sea un cambio de ESTADO LOCAL de
   este componente en vez de una navegación de ruta. Sin esas props (ruta
   standalone `/interno/licencias`) su comportamiento no cambia: siguen
   usando `<Link>`.

   La sub-navegación local (Bandeja / Libro consecutivo) reemplaza aquí a
   `LicenciasSidebar` (que sigue viva para la ruta standalone, deep-links).

   Bloque C: "Libro consecutivo" monta `LibroConsecutivoClient` — el MISMO
   Client Component que la ruta standalone (`app/interno/licencias/
   libro-consecutivo/page.tsx`), patrón dual idéntico al de la Bandeja/
   Detalle arriba. El botón "Exportar libro consecutivo ↓" del pie de la
   Bandeja usa `onIrALibroConsecutivo` para cambiar de sub-pestaña LOCAL
   en vez de navegar de ruta (mismo principio que `onAbrirExpediente`).

   NO usa `GuardModuloPlaneacion` (ese guard asume `h-screen`, pensado para
   la ruta standalone con su propio chrome de página completa — lo
   rompería dentro de la columna del panel). El gating de acceso a esta
   vista ya lo da `puedeAccederVista(usuario, 'LICENCIAS')` en
   `page.tsx`, que delega en el mismo `puedeVerLicencias`.
══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { BandejaLicenciasClient } from '@/app/interno/licencias/components/BandejaLicenciasClient';
import { DetalleLicenciaClient } from '@/app/interno/licencias/[expedienteId]/DetalleLicenciaClient';
import { LibroConsecutivoClient } from '@/app/interno/licencias/components/LibroConsecutivoClient';

type SubVistaLicencias = 'BANDEJA' | 'LIBRO_CONSECUTIVO';

const SUB_TABS: readonly { id: SubVistaLicencias; label: string }[] = [
  { id: 'BANDEJA', label: 'Bandeja' },
  { id: 'LIBRO_CONSECUTIVO', label: 'Libro consecutivo' },
];

export function VistaLicencias() {
  const [subVista, setSubVista] = useState<SubVistaLicencias>('BANDEJA');
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null);

  // El detalle reemplaza toda la vista (mismo comportamiento que la ruta
  // standalone `/interno/licencias/{id}`) — las sub-pestañas Bandeja/Libro
  // consecutivo no aplican mientras se mira un expediente puntual.
  if (expedienteSeleccionado) {
    return (
      <DetalleLicenciaClient
        expedienteId={expedienteSeleccionado}
        onVolver={() => setExpedienteSeleccionado(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="shrink-0 px-4 md:px-6 pt-4 print:hidden">
        <div
          className="flex gap-1 p-1 rounded-full w-fit"
          style={{ background: '#EEF4EE' }}
          role="tablist"
          aria-label="Sección de Licencias"
        >
          {SUB_TABS.map(({ id, label }) => {
            const activo = subVista === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setSubVista(id)}
                className="px-4 py-1.5 rounded-full text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={activo ? { background: '#14532D', color: '#FFFFFF' } : { color: '#14532D' }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {subVista === 'BANDEJA' ? (
        <BandejaLicenciasClient
          onAbrirExpediente={setExpedienteSeleccionado}
          onIrALibroConsecutivo={() => setSubVista('LIBRO_CONSECUTIVO')}
        />
      ) : (
        <LibroConsecutivoClient />
      )}
    </div>
  );
}
