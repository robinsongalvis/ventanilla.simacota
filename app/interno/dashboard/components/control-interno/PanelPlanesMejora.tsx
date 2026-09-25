'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  EstadoPlanMejora,
  HallazgoControlInterno,
  PlanMejora,
} from '@/src/types/control-interno';
import { LABEL_ESTADO_PLAN } from '@/src/types/control-interno';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { Aviso, Cargando, EstadoVacio } from './PanoramaGeneralPanel';

const ESTADOS_AVANCE: EstadoPlanMejora[] = ['PENDIENTE', 'EN_EJECUCION', 'CUMPLIDO', 'VENCIDO'];

interface ResponsablePlan {
  uid:    string;
  nombre: string;
  cargo:  string | null;
  email:  string;
  rol:    string;
}

function colorEstado(e: EstadoPlanMejora): string {
  if (e === 'CUMPLIDO')     return '#14532D';
  if (e === 'EN_EJECUCION') return '#9A3412';
  if (e === 'VENCIDO')      return '#991B1B';
  return                          '#667085';
}

export function PanelPlanesMejora() {
  const [planes, setPlanes] = useState<PlanMejora[]>([]);
  const [hallazgos, setHallazgos] = useState<HallazgoControlInterno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crear, setCrear] = useState(false);

  const [fHallazgo,    setFHallazgo]    = useState('');
  const [fAccion,      setFAccion]      = useState('');
  const [fRespUid,     setFRespUid]     = useState('');
  const [fRespNombre,  setFRespNombre]  = useState('');
  const [fCompromiso,  setFCompromiso]  = useState('');
  const [fEvidencia,   setFEvidencia]   = useState('');
  const [fObservaciones, setFObservaciones] = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito]         = useState<string | null>(null);
  const [responsables, setResponsables] = useState<ResponsablePlan[]>([]);
  const [cargandoResponsables, setCargandoResponsables] = useState(false);
  const [errorResponsables, setErrorResponsables] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const [p, h] = await Promise.all([
        fetch('/api/interno/control/planes-mejora', { credentials: 'include' }).then((r) => r.json()) as Promise<{ ok?: boolean; error?: string; planes?: PlanMejora[] }>,
        fetch('/api/interno/control/hallazgos?estado=ABIERTO', { credentials: 'include' }).then((r) => r.json()) as Promise<{ ok?: boolean; error?: string; hallazgos?: HallazgoControlInterno[] }>,
      ]);
      if (!p.ok) throw new Error(p.error ?? 'Error al cargar planes.');
      setPlanes(p.planes ?? []);
      setHallazgos(h.hallazgos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    const hallazgo = hallazgos.find((item) => item.id === fHallazgo);
    setFRespUid('');
    setFRespNombre('');
    setResponsables([]);
    setErrorResponsables(null);
    if (!hallazgo) return;

    let cancelado = false;
    setCargandoResponsables(true);
    fetch(`/api/interno/control/responsables?tenantId=${encodeURIComponent(hallazgo.tenantId)}`, {
      credentials: 'include',
    })
      .then(async (response) => {
        const data = await response.json() as { ok?: boolean; error?: string; responsables?: ResponsablePlan[] };
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'No fue posible cargar los responsables.');
        if (!cancelado) setResponsables(data.responsables ?? []);
      })
      .catch((err) => {
        if (!cancelado) setErrorResponsables(err instanceof Error ? err.message : 'No fue posible cargar los responsables.');
      })
      .finally(() => {
        if (!cancelado) setCargandoResponsables(false);
      });

    return () => { cancelado = true; };
  }, [fHallazgo, hallazgos]);

  const limpiar = () => {
    setFHallazgo(''); setFAccion(''); setFRespUid(''); setFRespNombre('');
    setFCompromiso(''); setFEvidencia(''); setFObservaciones(''); setErrorForm(null);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null); setEnviando(true);
    try {
      const r = await fetch('/api/interno/control/planes-mejora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hallazgoId:         fHallazgo,
          accionCorrectiva:   fAccion,
          responsableUid:     fRespUid,
          responsableNombre:  fRespNombre,
          fechaCompromiso:    fCompromiso,
          evidenciaRequerida: fEvidencia,
          observaciones:      fObservaciones || null,
        }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'Error al crear plan.');
      await cargar();
      setCrear(false);
      limpiar();
      setExito('Plan de mejora solicitado. La dependencia podrá registrar avances y evidencia.');
      window.setTimeout(() => setExito(null), 6000);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No fue posible solicitar el plan.');
    } finally {
      setEnviando(false);
    }
  };

  const aprobarOCerrar = async (plan: PlanMejora, resultado: 'CUMPLIDO' | 'INCUMPLIDO') => {
    if (!plan.id) return;
    const justificacion = window.prompt(`Justificación de cierre (${resultado.toLowerCase()}):`)?.trim();
    if (!justificacion || justificacion.length < 10) return;
    const r = await fetch(`/api/interno/control/planes-mejora/${encodeURIComponent(plan.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cierre: { resultado, justificacion } }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null) as { error?: string } | null;
      window.alert(j?.error ?? 'Error al cerrar plan.');
      return;
    }
    await cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Planes de mejora</p>
          <p className="text-sm" style={{ color: '#667085' }}>
            Acciones correctivas solicitadas a las dependencias. Seguimiento hasta el cierre.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCrear((v) => !v)}
          className="px-3 py-2 rounded-lg text-xs font-bold text-white"
          style={{ background: crear ? '#94A3B8' : '#14532D' }}
        >
          {crear ? 'Cancelar' : 'Solicitar plan de mejora'}
        </button>
      </div>

      {exito && <Aviso tipo="info" mensaje={exito} />}

      {crear && (
        <form onSubmit={guardar} className="rounded-xl bg-white p-4 space-y-3" style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-xs" style={{ color: '#667085' }}>
            Indique qué debe corregirse, quién debe hacerlo y hasta cuándo. La dependencia recibirá el plan para registrar avances.
          </p>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Hallazgo relacionado
            <select required className="select-internal mt-1 text-xs" value={fHallazgo} onChange={(e) => setFHallazgo(e.target.value)}>
              <option value="">Seleccione un hallazgo abierto…</option>
              {hallazgos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.id?.slice(0, 6)} · {NOMBRES_TENANT[h.tenantId] ?? h.tenantId} · {h.descripcion.slice(0, 40)}
                </option>
              ))}
            </select>
            <span className="mt-1 text-[10px]" style={{ color: '#94A3B8' }}>El plan se vincula automáticamente al hallazgo.</span>
          </label>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Acción de mejora
            <textarea required rows={3} className="input-internal mt-1 text-xs" value={fAccion} onChange={(e) => setFAccion(e.target.value)}
              placeholder="¿Qué debe corregirse para evitar que vuelva a ocurrir?" />
            <span className="mt-1 text-[10px]" style={{ color: '#94A3B8' }}>Mínimo 10 caracteres.</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Responsable de cumplirla
              <select
                required
                className="select-internal mt-1 text-xs"
                value={fRespUid}
                disabled={!fHallazgo || cargandoResponsables}
                onChange={(e) => {
                  const responsable = responsables.find((item) => item.uid === e.target.value);
                  setFRespUid(responsable?.uid ?? '');
                  setFRespNombre(responsable?.nombre ?? '');
                }}
              >
                <option value="">
                  {cargandoResponsables ? 'Cargando responsables…' : 'Seleccione una persona…'}
                </option>
                {responsables.map((responsable) => (
                  <option key={responsable.uid} value={responsable.uid}>
                    {responsable.nombre}{responsable.cargo ? ` · ${responsable.cargo}` : ''}
                  </option>
                ))}
              </select>
              <span className="mt-1 text-[10px]" style={{ color: errorResponsables ? '#991B1B' : '#94A3B8' }}>
                {errorResponsables ?? (fHallazgo ? 'Personas activas de la dependencia responsable.' : 'Primero seleccione el hallazgo relacionado.')}
              </span>
            </label>
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Fecha compromiso
              <input required type="date" className="input-internal mt-1 text-xs" value={fCompromiso} onChange={(e) => setFCompromiso(e.target.value)} />
              <span className="mt-1 text-[10px]" style={{ color: '#94A3B8' }}>Hasta cuándo debe cumplirse la acción.</span>
            </label>
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Evidencia esperada
              <input required className="input-internal mt-1 text-xs" value={fEvidencia} onChange={(e) => setFEvidencia(e.target.value)} placeholder="Qué soporte debe entregar la dependencia" />
              <span className="mt-1 text-[10px]" style={{ color: '#94A3B8' }}>Por ejemplo: copia del oficio, registro, captura del sistema…</span>
            </label>
          </div>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Observaciones
            <textarea rows={2} className="input-internal mt-1 text-xs" value={fObservaciones} onChange={(e) => setFObservaciones(e.target.value)} placeholder="Aclaraciones o contexto adicional (opcional)" />
          </label>
          {errorForm && <Aviso tipo="error" mensaje={errorForm} />}
          <div className="flex justify-end">
            <button type="submit" disabled={enviando} className="px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-60" style={{ background: '#14532D' }}>
              {enviando ? 'Guardando…' : 'Solicitar plan de mejora'}
            </button>
          </div>
        </form>
      )}

      {cargando ? <Cargando label="Cargando planes de mejora…" /> : error ? <Aviso tipo="error" mensaje={error} /> : (
        planes.length === 0 ? (
          <EstadoVacio
            titulo="No hay planes de mejora activos."
            mensaje="Los planes se crean a partir de hallazgos o recomendaciones de Control Interno."
            accion={hallazgos.length > 0 ? (
              <button
                type="button"
                onClick={() => setCrear(true)}
                className="px-3 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: '#14532D' }}
              >
                Solicitar primer plan
              </button>
            ) : null}
          />
        ) : (
          <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #D9E2D9' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: '#F8FAF7' }}>
                  <tr>
                    {['Estado', 'Dependencia', 'Acción', 'Responsable', 'Compromiso', 'Avances', 'Acciones'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planes.map((p) => (
                    <tr key={p.id} style={{ borderTop: '1px solid #EEF4EE' }}>
                      <td className="px-3 py-2 font-bold" style={{ color: colorEstado(p.estado) }}>{LABEL_ESTADO_PLAN[p.estado]}</td>
                      <td className="px-3 py-2" style={{ color: '#667085' }}>{NOMBRES_TENANT[p.tenantId] ?? p.tenantId}</td>
                      <td className="px-3 py-2" style={{ color: '#1F2933', maxWidth: 320 }}>{p.accionCorrectiva}</td>
                      <td className="px-3 py-2" style={{ color: '#667085' }}>{p.responsableNombre}</td>
                      <td className="px-3 py-2" style={{ color: '#667085' }}>{p.fechaCompromiso}</td>
                      <td className="px-3 py-2 tabular-nums" style={{ color: '#94A3B8' }}>{p.avances?.length ?? 0}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.estado !== 'CUMPLIDO' && p.estado !== 'VENCIDO' && (
                          <>
                            <button type="button" className="px-2 py-1 rounded-md text-[10px] font-bold mr-1"
                              style={{ background: '#EEF4EE', color: '#14532D', border: '1px solid #D9E2D9' }}
                              onClick={() => aprobarOCerrar(p, 'CUMPLIDO')}>Aprobar</button>
                            <button type="button" className="px-2 py-1 rounded-md text-[10px] font-bold"
                              style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}
                              onClick={() => aprobarOCerrar(p, 'INCUMPLIDO')}>Marcar incumplido</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
      {/* ESTADOS_AVANCE se conserva para mostrar referencia. */}
      <p className="sr-only">{ESTADOS_AVANCE.join(',')}</p>
    </div>
  );
}
