'use client';

import { useState } from 'react';

export function PanelReportesControl() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [generando, setGenerando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const construirUrl = () => {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    const qs = p.toString();
    return qs ? `/api/interno/control/reportes?${qs}` : '/api/interno/control/reportes';
  };

  const descargar = async () => {
    setGenerando(true); setError(null); setExito(null);
    try {
      const r = await fetch(construirUrl(), { credentials: 'include' });
      if (!r.ok) {
        const txt = await r.text();
        if (r.status === 401 || r.status === 403) {
          throw new Error('Su rol no permite descargar este informe. Solicítelo a Control Interno o al Administrador.');
        }
        throw new Error(txt || 'No se pudo generar el informe.');
      }
      const blob = await r.blob();
      if (blob.size === 0) {
        throw new Error('No hay información suficiente para generar el informe.');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe-control-interno-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExito('Informe generado correctamente. Este archivo puede usarse como soporte de seguimiento interno.');
      window.setTimeout(() => setExito(null), 7000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el informe.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Informe de Control Interno</p>
        <p className="text-sm mt-1" style={{ color: '#1F2933' }}>
          Documento institucional con resumen, alertas, hallazgos, planes de mejora, dependencias y radicados revisados.
        </p>
        <p className="text-xs mt-1" style={{ color: '#667085' }}>
          Sirve como soporte de seguimiento interno. La descarga queda registrada en la trazabilidad del módulo.
        </p>
      </header>

      <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Período del informe</p>
        <div className="flex flex-wrap items-end gap-3 mt-2">
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Desde
            <input type="date" className="input-internal mt-1 text-xs" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Hasta
            <input type="date" className="input-internal mt-1 text-xs" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <button
            type="button"
            onClick={descargar}
            disabled={generando}
            className="px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-60"
            style={{ background: '#14532D' }}
          >
            {generando ? 'Generando informe…' : 'Exportar informe de Control Interno'}
          </button>
        </div>
        <p className="text-[10px] mt-3" style={{ color: '#94A3B8' }}>
          Si no indica fechas, el informe incluye toda la información disponible.
        </p>
      </div>

      {exito && (
        <div className="rounded-xl p-4 text-sm" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#14532D' }}>
          {exito}
        </div>
      )}
      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {error}
        </div>
      )}

      <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Qué contiene el informe</p>
        <ul className="mt-2 text-xs space-y-1 list-disc pl-4" style={{ color: '#1F2933' }}>
          <li><strong>Resumen</strong> — indicadores principales con semáforo.</li>
          <li><strong>Alertas</strong> — situaciones detectadas que requieren atención.</li>
          <li><strong>Hallazgos</strong> — registros creados por Control Interno.</li>
          <li><strong>Planes de mejora</strong> — acciones correctivas en seguimiento.</li>
          <li><strong>Dependencias</strong> — cumplimiento comparado.</li>
          <li><strong>Radicados revisados</strong> — solicitudes con señales de riesgo.</li>
          <li><strong>Diccionario</strong> — explicación corta de cada campo.</li>
        </ul>
      </div>
    </div>
  );
}
