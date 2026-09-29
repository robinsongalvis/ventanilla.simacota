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
import { CabeceraTablaSticky } from '@/app/components/design-system/SuperficieTabla';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { Plus, X } from 'lucide-react';

const ESTADOS_AVANCE: EstadoPlanMejora[] = ['PENDIENTE', 'EN_EJECUCION', 'CUMPLIDO', 'VENCIDO'];

interface ResponsablePlan {
  uid:    string;
  nombre: string;
  cargo:  string | null;
  email:  string;
  rol:    string;
}

function colorEstado(e: EstadoPlanMejora): string {
  if (e === 'CUMPLIDO')     return 'var(--tema-texto-007049)';
  if (e === 'EN_EJECUCION') return 'var(--tema-texto-9a3412)';
  if (e === 'VENCIDO')      return 'var(--tema-texto-991b1b)';
  return                          'var(--tema-texto-64748b)';
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
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Planes de mejora</p>
          <p className="text-sm" style={{ color: 'var(--tema-texto-64748b)' }}>
            Acciones correctivas solicitadas a las dependencias. Seguimiento hasta el cierre.
          </p>
        </div>
        <BotonAccion variante={crear ? 'secundaria' : 'primaria'} Icono={crear ? X : Plus} onClick={() => setCrear((v) => !v)}>
          {crear ? 'Cancelar' : 'Solicitar plan de mejora'}
        </BotonAccion>
      </div>

      {exito && <Aviso tipo="info" mensaje={exito} />}

      {crear && (
        <form onSubmit={guardar} className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4 space-y-3" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
          <p className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>
            Indique qué debe corregirse, quién debe hacerlo y hasta cuándo. La dependencia recibirá el plan para registrar avances.
          </p>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-64748b)' }}>
            Hallazgo relacionado
            <select required className="select-internal mt-1 text-xs" value={fHallazgo} onChange={(e) => setFHallazgo(e.target.value)}>
              <option value="">Seleccione un hallazgo abierto…</option>
              {hallazgos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.id?.slice(0, 6)} · {NOMBRES_TENANT[h.tenantId] ?? h.tenantId} · {h.descripcion.slice(0, 40)}
                </option>
              ))}
            </select>
            <span className="mt-1 text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>El plan se vincula automáticamente al hallazgo.</span>
          </label>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-64748b)' }}>
            Acción de mejora
            <textarea required rows={3} className="input-internal mt-1 text-xs" value={fAccion} onChange={(e) => setFAccion(e.target.value)}
              placeholder="¿Qué debe corregirse para evitar que vuelva a ocurrir?" />
            <span className="mt-1 text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>Mínimo 10 caracteres.</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-64748b)' }}>
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
              <span className="mt-1 text-[10px]" style={{ color: errorResponsables ? 'var(--tema-texto-991b1b)' : 'var(--tema-texto-64748b)' }}>
                {errorResponsables ?? (fHallazgo ? 'Personas activas de la dependencia responsable.' : 'Primero seleccione el hallazgo relacionado.')}
              </span>
            </label>
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-64748b)' }}>
              Fecha compromiso
              <input required type="date" className="input-internal mt-1 text-xs" value={fCompromiso} onChange={(e) => setFCompromiso(e.target.value)} />
              <span className="mt-1 text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>Hasta cuándo debe cumplirse la acción.</span>
            </label>
            <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-64748b)' }}>
              Evidencia esperada
              <input required className="input-internal mt-1 text-xs" value={fEvidencia} onChange={(e) => setFEvidencia(e.target.value)} placeholder="Qué soporte debe entregar la dependencia" />
              <span className="mt-1 text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>Por ejemplo: copia del oficio, registro, captura del sistema…</span>
            </label>
          </div>
          <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-64748b)' }}>
            Observaciones
            <textarea rows={2} className="input-internal mt-1 text-xs" value={fObservaciones} onChange={(e) => setFObservaciones(e.target.value)} placeholder="Aclaraciones o contexto adicional (opcional)" />
          </label>
          {errorForm && <Aviso tipo="error" mensaje={errorForm} />}
          <div className="flex justify-end">
            <BotonAccion type="submit" variante="primaria" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Solicitar plan de mejora'}
            </BotonAccion>
          </div>
        </form>
      )}

      {cargando ? <Cargando label="Cargando planes de mejora…" /> : error ? <Aviso tipo="error" mensaje={error} /> : (
        planes.length === 0 ? (
          <EstadoVacio
            titulo="No hay planes de mejora activos."
            mensaje="Los planes se crean a partir de hallazgos o recomendaciones de Control Interno."
            accion={hallazgos.length > 0 ? (
              <BotonAccion variante="primaria" Icono={Plus} onClick={() => setCrear(true)}>Solicitar primer plan</BotonAccion>
            ) : null}
          />
        ) : (
          <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <CabeceraTablaSticky columnas={['Estado', 'Dependencia', 'Acción', 'Responsable', 'Compromiso', 'Avances', 'Acciones']} />
                <tbody>
                  {planes.map((p) => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--tema-borde-f4f9f6)' }}>
                      <td className="px-2 py-2 font-bold" style={{ color: colorEstado(p.estado) }}>{LABEL_ESTADO_PLAN[p.estado]}</td>
                      <td className="px-2 py-2" style={{ color: 'var(--tema-texto-64748b)' }}>{NOMBRES_TENANT[p.tenantId] ?? p.tenantId}</td>
                      <td className="px-2 py-2" style={{ color: 'var(--tema-texto-172033)', maxWidth: 320 }}>{p.accionCorrectiva}</td>
                      <td className="px-2 py-2" style={{ color: 'var(--tema-texto-64748b)' }}>{p.responsableNombre}</td>
                      <td className="px-2 py-2" style={{ color: 'var(--tema-texto-64748b)' }}>{p.fechaCompromiso}</td>
                      <td className="px-2 py-2 tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{p.avances?.length ?? 0}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {p.estado !== 'CUMPLIDO' && p.estado !== 'VENCIDO' && (
                          <>
                            <button type="button" className="px-2 py-1 rounded-md text-[10px] font-bold mr-1"
                              style={{ background: 'var(--tema-fondo-f4f9f6)', color: 'var(--tema-texto-007049)', border: '1px solid var(--tema-borde-dce4ea)' }}
                              onClick={() => aprobarOCerrar(p, 'CUMPLIDO')}>Aprobar</button>
                            <button type="button" className="px-2 py-1 rounded-md text-[10px] font-bold"
                              style={{ background: 'var(--tema-fondo-fef2f2)', color: 'var(--tema-texto-991b1b)', border: '1px solid var(--tema-borde-fecaca)' }}
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
