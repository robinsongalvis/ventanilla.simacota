'use client';

import { useMemo, useState } from 'react';
import type { E2ETestMode, E2ETestResponse } from '@/src/types/simi-e2e-test';

const STATUS_COLOR = {
  success: '#16A34A',
  failed: '#DC2626',
  skipped: '#D97706',
  pending: '#64748B',
};

export function E2ETestPanel() {
  const [modo, setModo] = useState<E2ETestMode>('dry_run');
  const [incluirPdf, setIncluirPdf] = useState(true);
  const [incluirConsulta, setIncluirConsulta] = useState(true);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState<E2ETestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tiempo = useMemo(() => {
    if (!resultado) return '';
    return `${(resultado.tiempoMs / 1000).toFixed(1)}s`;
  }, [resultado]);

  async function ejecutar() {
    setEjecutando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch('/api/simi/test/e2e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo,
          emailTest: true,
          whatsappMock: true,
          incluirPdf,
          incluirConsultaCiudadana: incluirConsulta,
        }),
      });
      const data = await res.json() as E2ETestResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'No fue posible ejecutar la prueba.');
      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error ejecutando prueba integral.');
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
          Smoke test institucional
        </p>
        <h3 className="text-base font-black mt-1" style={{ color: '#1F2933' }}>
          Prueba integral end-to-end
        </h3>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: '#667085' }}>
          Ejecuta un flujo controlado con datos simulados. Los registros creados quedan marcados como prueba y excluidos de métricas oficiales.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold" style={{ color: '#475569' }}>
            Modo
            <select value={modo} onChange={(e) => setModo(e.target.value as E2ETestMode)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#D9E2D9' }}>
              <option value="dry_run">dry_run — simulado</option>
              <option value="commit_test">commit_test — crea datos de prueba</option>
            </select>
          </label>
          <div className="flex flex-col gap-2 text-xs font-semibold" style={{ color: '#475569' }}>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={incluirPdf} onChange={(e) => setIncluirPdf(e.target.checked)} />
              Generar/validar PDF
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={incluirConsulta} onChange={(e) => setIncluirConsulta(e.target.checked)} />
              Validar consulta ciudadana
            </label>
          </div>
        </div>

        <button
          onClick={ejecutar}
          disabled={ejecutando}
          className="mt-4 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: '#14532D' }}
        >
          {ejecutando ? 'Ejecutando prueba...' : 'Ejecutar prueba integral'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {resultado && (
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid #D9E2D9' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
                Resultado
              </p>
              <p className="text-sm font-black" style={{ color: '#1F2933' }}>{resultado.estado.toUpperCase()}</p>
              <p className="text-xs font-mono mt-1" style={{ color: '#667085' }}>{resultado.testRunId}</p>
            </div>
            <div className="text-right text-xs" style={{ color: '#667085' }}>
              <p>Tiempo: <strong>{tiempo}</strong></p>
              <p>{resultado.resumen.exitosos}/{resultado.resumen.totalPasos} pasos OK</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {resultado.entidades.consultaUrl && (
              <a href={resultado.entidades.consultaUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-lg border px-3 py-2 font-bold" style={{ borderColor: '#D9E2D9', color: '#14532D' }}>
                Abrir radicado de prueba
              </a>
            )}
            {resultado.entidades.pdfUrl && (
              <a href={resultado.entidades.pdfUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-lg border px-3 py-2 font-bold" style={{ borderColor: '#D9E2D9', color: '#14532D' }}>
                Descargar PDF de prueba
              </a>
            )}
          </div>

          <ol className="mt-5 space-y-2">
            {resultado.pasos.map((paso, index) => (
              <li key={`${paso.nombre}-${index}`} className="rounded-lg p-3 text-xs" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold" style={{ color: '#1F2933' }}>{paso.nombre}</p>
                    {paso.detalle && <p className="mt-1" style={{ color: '#667085' }}>{paso.detalle}</p>}
                    {paso.error && <p className="mt-1" style={{ color: '#DC2626' }}>{paso.error}</p>}
                    {paso.entidadCreadaId && <p className="mt-1 font-mono" style={{ color: '#94A3B8' }}>{paso.entidadCreadaId}</p>}
                  </div>
                  <span className="font-black uppercase" style={{ color: STATUS_COLOR[paso.estado] }}>
                    {paso.estado}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
