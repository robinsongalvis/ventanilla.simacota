'use client';

import { useState } from 'react';

export function PanelReportesControl() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const url = (() => {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    const qs = p.toString();
    return qs ? `/api/interno/control/reportes?${qs}` : '/api/interno/control/reportes';
  })();

  return (
    <div className="space-y-4">
      <header className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Exportar Reporte Control Interno</p>
        <p className="text-sm mt-1" style={{ color: '#667085' }}>
          Excel institucional con 7 hojas: Resumen Ejecutivo, Alertas, Riesgos, Hallazgos, Planes de Mejora,
          Cumplimiento por Dependencia y Diccionario de Datos.
        </p>
      </header>

      <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Desde
            <input type="date" className="input-internal mt-1 text-xs" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Hasta
            <input type="date" className="input-internal mt-1 text-xs" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <a
            href={url}
            className="px-3 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: '#14532D' }}
          >
            Descargar Excel Control Interno
          </a>
        </div>
        <p className="text-[10px] mt-3" style={{ color: '#94A3B8' }}>
          La exportación queda registrada en la trazabilidad de Control Interno.
        </p>
      </div>
    </div>
  );
}
