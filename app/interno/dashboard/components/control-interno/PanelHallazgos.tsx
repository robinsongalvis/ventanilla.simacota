'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  EstadoHallazgo,
  HallazgoControlInterno,
  NivelRiesgo,
  TipoHallazgo,
} from '@/src/types/control-interno';
import {
  LABEL_ESTADO_HALLAZGO,
  LABEL_NIVEL_RIESGO,
  LABEL_TIPO_HALLAZGO,
} from '@/src/types/control-interno';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT, DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import { Aviso, Cargando, EstadoVacio } from './PanoramaGeneralPanel';

const NIVELES: NivelRiesgo[] = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'];
const TIPOS: TipoHallazgo[] = [
  'INCUMPLIMIENTO_TERMINO', 'FALTA_TRAZABILIDAD', 'FALTA_RESPONSABLE',
  'RESPUESTA_INCOMPLETA', 'SOPORTE_INSUFICIENTE',
  'NOTIFICACION_FALLIDA_NO_GESTIONADA', 'CLASIFICACION_INCORRECTA',
  'DEPENDENCIA_RIESGO_OPERATIVO', 'REINCIDENCIA', 'OTRO',
];
const ESTADOS: EstadoHallazgo[] = ['ABIERTO', 'EN_GESTION', 'CERRADO'];

export function PanelHallazgos() {
  const [hallazgos, setHallazgos] = useState<HallazgoControlInterno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crear, setCrear] = useState(false);

  // formulario crear
  const [fTenant,    setFTenant]    = useState<TenantId>('VENTANILLA_UNICA');
  const [fRadicado,  setFRadicado]  = useState('');
  const [fTipo,      setFTipo]      = useState<TipoHallazgo>('INCUMPLIMIENTO_TERMINO');
  const [fNivel,     setFNivel]     = useState<NivelRiesgo>('MEDIO');
  const [fDesc,      setFDesc]      = useState('');
  const [fEvidencia, setFEvidencia] = useState('');
  const [fAccion,    setFAccion]    = useState('');
  const [fSeguimiento, setFSeguimiento] = useState('');
  const [enviando,   setEnviando]   = useState(false);
  const [errorForm,  setErrorForm]  = useState<string | null>(null);
  const [exito,      setExito]      = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const r = await fetch('/api/interno/control/hallazgos', { credentials: 'include' });
      const j = await r.json() as { ok?: boolean; error?: string; hallazgos?: HallazgoControlInterno[] };
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'Error al cargar hallazgos.');
      setHallazgos(j.hallazgos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const limpiar = () => {
    setFTenant('VENTANILLA_UNICA'); setFRadicado(''); setFTipo('INCUMPLIMIENTO_TERMINO');
    setFNivel('MEDIO'); setFDesc(''); setFEvidencia(''); setFAccion(''); setFSeguimiento(''); setErrorForm(null);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null); setEnviando(true);
    try {
      const r = await fetch('/api/interno/control/hallazgos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          radicadoId: fRadicado.trim() || null,
          tenantId:   fTenant,
          tipo:       fTipo,
          nivel:      fNivel,
          descripcion: fDesc,
          evidencia:   fEvidencia.trim() || null,
          accionRecomendada: fAccion.trim() || null,
          fechaSeguimiento:  fSeguimiento || null,
        }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'Error al crear hallazgo.');
      await cargar();
      setCrear(false);
      limpiar();
      setExito('Hallazgo creado correctamente. Puede hacer seguimiento o solicitar un plan de mejora.');
      window.setTimeout(() => setExito(null), 6000);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No fue posible crear el hallazgo.');
    } finally {
      setEnviando(false);
    }
  };

  const agregarObservacion = async (h: HallazgoControlInterno) => {
    if (!h.id) return;
    const texto = window.prompt('Observación:')?.trim();
    if (!texto) return;
    const r = await fetch(`/api/interno/control/hallazgos/${encodeURIComponent(h.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ observacion: texto }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null) as { error?: string } | null;
      window.alert(j?.error ?? 'Error al agregar observación.');
      return;
    }
    await cargar();
  };

  const cerrar = async (h: HallazgoControlInterno) => {
    if (!h.id) return;
    const justificacion = window.prompt('Justificación de cierre (mín. 10 caracteres):')?.trim();
    if (!justificacion || justificacion.length < 10) return;
    const r = await fetch(`/api/interno/control/hallazgos/${encodeURIComponent(h.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ estado: 'CERRADO', justificacion }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null) as { error?: string } | null;
      window.alert(j?.error ?? 'Error al cerrar hallazgo.');
      return;
    }
    await cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Hallazgos</p>
          <p className="text-sm" style={{ color: '#667085' }}>
            Registre las situaciones que requieren seguimiento por parte de Control Interno.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCrear((v) => !v)}
          className="px-3 py-2 rounded-lg text-xs font-bold text-white"
          style={{ background: crear ? '#94A3B8' : '#14532D' }}
        >
          {crear ? 'Cancelar' : 'Crear hallazgo'}
        </button>
      </div>

      {exito && <Aviso tipo="info" mensaje={exito} />}

      {crear && (
        <form onSubmit={guardar} className="rounded-xl bg-white p-4 space-y-3" style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-xs" style={{ color: '#667085' }}>
            Complete los datos para dejar constancia. Después podrá agregar observaciones o solicitar un plan de mejora.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Dependencia relacionada
              <select className="select-internal mt-1 text-xs" value={fTenant} onChange={(e) => setFTenant(e.target.value as TenantId)}>
                {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((t) => (
                  <option key={t} value={t}>{NOMBRES_TENANT[t]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Radicado relacionado (opcional)
              <input className="input-internal mt-1 text-xs" value={fRadicado} onChange={(e) => setFRadicado(e.target.value)} placeholder="Ej: 2025-00000123" />
            </label>
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Tipo de hallazgo
              <select className="select-internal mt-1 text-xs" value={fTipo} onChange={(e) => setFTipo(e.target.value as TipoHallazgo)}>
                {TIPOS.map((t) => <option key={t} value={t}>{LABEL_TIPO_HALLAZGO[t]}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Nivel de importancia
              <select className="select-internal mt-1 text-xs" value={fNivel} onChange={(e) => setFNivel(e.target.value as NivelRiesgo)}>
                {NIVELES.map((n) => <option key={n} value={n}>{LABEL_NIVEL_RIESGO[n]}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Descripción del hallazgo
            <textarea
              required rows={3}
              className="input-internal mt-1 text-xs"
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              placeholder="Describa qué situación encontró y por qué requiere seguimiento."
            />
            <span className="mt-1 text-[10px]" style={{ color: '#94A3B8' }}>Mínimo 10 caracteres.</span>
          </label>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Evidencia o soporte
            <input
              className="input-internal mt-1 text-xs"
              value={fEvidencia}
              onChange={(e) => setFEvidencia(e.target.value)}
              placeholder="Oficio, número de radicado, observación, enlace…"
            />
            <span className="mt-1 text-[10px]" style={{ color: '#94A3B8' }}>Opcional. Ayuda a sustentar el hallazgo.</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_13rem] gap-3">
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Acción recomendada
              <input
                className="input-internal mt-1 text-xs"
                value={fAccion}
                onChange={(e) => setFAccion(e.target.value)}
                placeholder="Qué recomienda hacer para corregir o prevenir la situación"
              />
            </label>
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Fecha de seguimiento
              <input
                type="date"
                className="input-internal mt-1 text-xs"
                value={fSeguimiento}
                onChange={(e) => setFSeguimiento(e.target.value)}
              />
            </label>
          </div>
          {errorForm && <Aviso tipo="error" mensaje={errorForm} />}
          <div className="flex justify-end">
            <button type="submit" disabled={enviando} className="px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-60" style={{ background: '#14532D' }}>
              {enviando ? 'Guardando…' : 'Crear hallazgo'}
            </button>
          </div>
        </form>
      )}

      {cargando ? <Cargando label="Cargando hallazgos…" /> : error ? <Aviso tipo="error" mensaje={error} /> : (
        hallazgos.length === 0 ? (
          <EstadoVacio
            titulo="Aún no se han registrado hallazgos."
            mensaje="Puede crear uno cuando identifique una situación que requiera seguimiento."
            accion={(
              <button
                type="button"
                onClick={() => setCrear(true)}
                className="px-3 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: '#14532D' }}
              >
                Crear primer hallazgo
              </button>
            )}
          />
        ) : (
          <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #D9E2D9' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: '#F8FAF7' }}>
                  <tr>
                    {['Estado', 'Tipo', 'Nivel', 'Dependencia', 'Radicado', 'Descripción', 'Plan', 'Acciones'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hallazgos.map((h) => {
                    const estados = ESTADOS;
                    void estados;
                    return (
                      <tr key={h.id} style={{ borderTop: '1px solid #EEF4EE' }}>
                        <td className="px-3 py-2 font-bold" style={{ color: h.estado === 'CERRADO' ? '#14532D' : h.estado === 'EN_GESTION' ? '#9A3412' : '#991B1B' }}>
                          {LABEL_ESTADO_HALLAZGO[h.estado]}
                        </td>
                        <td className="px-3 py-2" style={{ color: '#1F2933' }}>{LABEL_TIPO_HALLAZGO[h.tipo]}</td>
                        <td className="px-3 py-2" style={{ color: '#667085' }}>{LABEL_NIVEL_RIESGO[h.nivel]}</td>
                        <td className="px-3 py-2" style={{ color: '#667085' }}>{NOMBRES_TENANT[h.tenantId] ?? h.tenantId}</td>
                        <td className="px-3 py-2 font-mono" style={{ color: '#14532D' }}>{h.radicadoId ?? '—'}</td>
                        <td className="px-3 py-2" style={{ color: '#667085', maxWidth: 340 }}>{h.descripcion}</td>
                        <td className="px-3 py-2" style={{ color: '#94A3B8' }}>{h.planMejoraId ? '✓' : '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button type="button" className="px-2 py-1 rounded-md text-[10px] font-bold mr-1" style={{ background: '#EEF4EE', color: '#14532D', border: '1px solid #D9E2D9' }} onClick={() => agregarObservacion(h)}>Observar</button>
                          {h.estado !== 'CERRADO' && (
                            <button type="button" className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }} onClick={() => cerrar(h)}>Cerrar</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
