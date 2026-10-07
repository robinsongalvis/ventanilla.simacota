'use client';

import { useState } from 'react';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { getTiposSolicitudInternos } from '@/lib/catalogos/tipos-solicitud';
import { CONTINGENCIA_STORAGE_ACTIVA } from '@/lib/recepcion/contingencia-storage';

/* ══════════════════════════════════════════════════════════════
   Sprint Registro exprés — el minuto de trazabilidad DESPUÉS de
   responder.

   Para el funcionario al que le llega correspondencia directo al
   correo institucional (el banco a Hacienda) y responde de inmediato:
   declara qué llegó, cuándo, qué respondió y cuándo — el sistema
   genera la entrada resuelta, la salida amarrada y la trazabilidad.
   Su forma de trabajar no cambia; la memoria institucional sí.
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#007049';

/** ISO local "yyyy-MM-ddTHH:mm" para <input type=datetime-local>. */
function aDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface RegistroExpresModalProps {
  usuario: { uid: string; nombre: string; rol: string; tenantId: TenantId };
  onCerrar: () => void;
}

export function RegistroExpresModal({ usuario, onCerrar }: RegistroExpresModalProps) {
  if (CONTINGENCIA_STORAGE_ACTIVA) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true" aria-labelledby="registro-expres-contingencia">
        <section className="max-w-lg space-y-4 rounded-xl border border-amber-300 bg-white p-6">
          <h2 id="registro-expres-contingencia" className="text-lg font-bold text-slate-900">Registro exprés suspendido durante la contingencia</h2>
          <p className="text-sm text-slate-700">Solo la radicación interna autenticada puede emitir consecutivos de entrada. Remita la solicitud y los soportes a recepción; no se ha reservado ningún número.</p>
          <button type="button" onClick={onCerrar} className="rounded-lg bg-green-900 px-4 py-2 font-semibold text-white">Cerrar</button>
        </section>
      </div>
    );
  }
  return <FormularioRegistroExpres usuario={usuario} onCerrar={onCerrar} />;
}

function FormularioRegistroExpres({ usuario, onCerrar }: RegistroExpresModalProps) {
  const eligeDependencia = usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA';

  const [remitenteNombre, setRemitenteNombre] = useState('');
  const [remitenteEntidad, setRemitenteEntidad] = useState('');
  const [remitenteEmail, setRemitenteEmail] = useState('');
  const [tipoSolicitudId, setTipoSolicitudId] = useState('PETICION_GENERAL');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaLlegada, setFechaLlegada] = useState(aDatetimeLocal(new Date()));
  const [respuestaResumen, setRespuestaResumen] = useState('');
  const [fechaRespuesta, setFechaRespuesta] = useState(aDatetimeLocal(new Date()));
  const [dependencia, setDependencia] = useState<TenantId>(usuario.tenantId);

  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ radicadoId: string; salidaId: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    setErrorLocal(null);
    try {
      const res = await fetch('/api/dependencias/registro-expres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          remitenteNombre,
          remitenteEntidad: remitenteEntidad || null,
          remitenteEmail:   remitenteEmail || null,
          tipoSolicitudId,
          asunto,
          descripcion,
          fechaLlegada:   new Date(fechaLlegada).toISOString(),
          respuestaResumen,
          fechaRespuesta: new Date(fechaRespuesta).toISOString(),
          ...(eligeDependencia ? { dependencia } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorLocal(body.error ?? 'No fue posible completar el registro.');
        return;
      }
      setResultado({ radicadoId: body.radicadoId, salidaId: body.salidaId });
    } catch {
      setErrorLocal('Error de red al registrar.');
    } finally {
      setGuardando(false);
    }
  }

  const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-widest';
  const labelStyle = { color: 'var(--tema-texto-64748b)' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3"
      role="dialog"
      aria-modal="true"
      aria-label="Registro exprés de correspondencia respondida"
    >
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/55" />

      <div
        className="relative w-full max-w-2xl bg-[var(--tema-fondo-ffffff)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ border: '1px solid var(--tema-borde-dce4ea)', maxHeight: 'calc(100dvh - 24px)' }}
      >
        <header className="px-5 py-4" style={{ borderBottom: '1px solid var(--tema-borde-dce4ea)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--tema-texto-8a6a12)' }}>
            Correspondencia respondida desde el correo institucional
          </p>
          <h2 className="text-lg font-black leading-tight" style={{ color: 'var(--tema-texto-172033)' }}>
            Registro exprés
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--tema-texto-5f6f64)' }}>
            Ya respondiste — esto solo deja la historia escrita: genera la
            entrada, la salida amarrada y la trazabilidad en un paso.
          </p>
        </header>

        {resultado ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-008f5a)' }}>
              Registro completo
            </p>
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--tema-texto-94a3b8)' }}>Entrada</p>
              <p className="text-xl font-black font-mono" style={{ color: 'var(--tema-texto-172033)' }}>{resultado.radicadoId}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--tema-texto-94a3b8)' }}>Salida amarrada</p>
              <p className="text-xl font-black font-mono" style={{ color: VERDE_INST }}>{resultado.salidaId}</p>
            </div>
            <p className="text-xs max-w-sm" style={{ color: 'var(--tema-texto-64748b)' }}>
              Quedó resuelto en tu dependencia, con la respuesta y las fechas
              reales en la trazabilidad y la salida en el libro.
            </p>
            <button
              type="button"
              onClick={onCerrar}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: VERDE_INST }}
            >
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              <label>
                <span className={labelCls} style={labelStyle}>Quién escribió</span>
                <input type="text" value={remitenteNombre} onChange={(e) => setRemitenteNombre(e.target.value)} required className="input-internal" placeholder="Banco Agrario" />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Entidad (si aplica)</span>
                <input type="text" value={remitenteEntidad} onChange={(e) => setRemitenteEntidad(e.target.value)} className="input-internal" />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Correo del remitente</span>
                <input type="email" value={remitenteEmail} onChange={(e) => setRemitenteEmail(e.target.value)} className="input-internal" />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Tipo de solicitud</span>
                <select value={tipoSolicitudId} onChange={(e) => setTipoSolicitudId(e.target.value)} className="select-internal w-full">
                  {getTiposSolicitudInternos().map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </label>
              {eligeDependencia && (
                <label className="md:col-span-2">
                  <span className={labelCls} style={labelStyle}>Dependencia que recibió y respondió</span>
                  <select
                    value={dependencia}
                    onChange={(e) => setDependencia(e.target.value as TenantId)}
                    className="select-internal w-full"
                  >
                    {(Object.entries(NOMBRES_TENANT) as [TenantId, string][]).map(([id, nombre]) => (
                      <option key={id} value={id}>{nombre}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="md:col-span-2">
                <span className={labelCls} style={labelStyle}>Asunto</span>
                <input type="text" value={asunto} onChange={(e) => setAsunto(e.target.value)} required className="input-internal" placeholder="Certificación de cuentas del convenio 052" />
              </label>
              <label className="md:col-span-2">
                <span className={labelCls} style={labelStyle}>Qué pedía</span>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required rows={2} className="input-internal" />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Cuándo llegó</span>
                <input type="datetime-local" value={fechaLlegada} onChange={(e) => setFechaLlegada(e.target.value)} required className="input-internal" />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Cuándo se respondió</span>
                <input type="datetime-local" value={fechaRespuesta} onChange={(e) => setFechaRespuesta(e.target.value)} required className="input-internal" />
              </label>
              <label className="md:col-span-2">
                <span className={labelCls} style={labelStyle}>Qué se respondió</span>
                <textarea value={respuestaResumen} onChange={(e) => setRespuestaResumen(e.target.value)} required rows={2} className="input-internal" placeholder="Se envió la certificación firmada." />
              </label>
            </div>

            {!eligeDependencia && (
              <p className="text-[11px]" style={{ color: 'var(--tema-texto-7a8b7f)' }}>
                Se registrará en tu dependencia: {NOMBRES_TENANT[usuario.tenantId] ?? usuario.tenantId}.
              </p>
            )}

            {errorLocal && (
              <p role="alert" className="rounded-lg px-3 py-2 text-xs"
                 style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-991b1b)' }}>
                {errorLocal}
              </p>
            )}

            <footer className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onCerrar}
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ border: '1px solid var(--tema-borde-dce4ea)', color: 'var(--tema-texto-475569)' }}>
                Cancelar
              </button>
              <button type="submit" disabled={guardando}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: VERDE_INST }}>
                {guardando ? 'Registrando…' : 'Registrar'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
