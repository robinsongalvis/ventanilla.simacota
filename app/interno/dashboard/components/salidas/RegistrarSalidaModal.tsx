'use client';

import { useState } from 'react';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { MedioEnvioSalida, SalidaOficial } from '@/src/types/salida';
import { SelloDespacho } from './SelloDespacho';

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — modal de registro de despacho.

   Dos modos, fijados por quien lo abre (sin selector de tipo):
    - desde el detalle de un radicado → RESPUESTA, con el amarre
      prellenado y visible;
    - desde el mostrador → OFICIO_INDEPENDIENTE (correspondencia
      propia de la administración: Gobernación, contratistas…).

   Al registrar, muestra el número 2-SAL grande — ese número va en el
   oficio impreso junto a la referencia del radicado de entrada.
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#14532D';

const MEDIOS: [MedioEnvioSalida, string][] = [
  ['CORREO',     'Correo electrónico'],
  ['FISICO',     'Correo físico'],
  ['MENSAJERO',  'Mensajero'],
  ['PRESENCIAL', 'Entrega presencial'],
];

export interface EntradaAmarre {
  radicadoId:         string;
  solicitanteNombre?: string;
  dependencia:        TenantId;
}

export interface RegistrarSalidaModalProps {
  usuario: { uid: string; nombre: string; tenantId: TenantId };
  /** Presente = salida tipo RESPUESTA amarrada a este radicado. */
  entrada?: EntradaAmarre | null;
  onCerrar: () => void;
}

export function RegistrarSalidaModal({ usuario, entrada, onCerrar }: RegistrarSalidaModalProps) {
  const esRespuesta = Boolean(entrada);

  const [destinatarioNombre, setDestinatarioNombre] = useState(entrada?.solicitanteNombre ?? '');
  const [entidad, setEntidad] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [asunto, setAsunto] = useState(
    entrada ? `Respuesta al radicado ${entrada.radicadoId}` : '',
  );
  const [dependenciaOrigen, setDependenciaOrigen] = useState<TenantId>(
    entrada?.dependencia ?? usuario.tenantId,
  );
  const [medioEnvio, setMedioEnvio] = useState<MedioEnvioSalida>('CORREO');
  const [firmanteNombre, setFirmanteNombre] = useState(usuario.nombre);
  // Fase B — oficio firmado opcional; sube por el endpoint (Admin SDK).
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [salidaGenerada, setSalidaGenerada] = useState<SalidaOficial | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    setErrorLocal(null);
    try {
      const payload = new FormData();
      payload.set('tipoSalida', esRespuesta ? 'RESPUESTA' : 'OFICIO_INDEPENDIENTE');
      if (entrada?.radicadoId) payload.set('radicadoEntradaId', entrada.radicadoId);
      payload.set('destinatarioNombre', destinatarioNombre);
      payload.set('destinatarioEntidad', entidad);
      payload.set('destinatarioEmail', email);
      payload.set('destinatarioDireccion', direccion);
      payload.set('asunto', asunto);
      payload.set('dependenciaOrigen', dependenciaOrigen);
      payload.set('medioEnvio', medioEnvio);
      payload.set('firmanteNombre', firmanteNombre);
      if (archivoPdf) payload.set('archivo', archivoPdf);

      const response = await fetch('/api/salidas/registrar', {
        method: 'POST',
        credentials: 'include',
        body: payload,
      });
      const data = await response.json().catch(() => null) as
        { error?: string; salida?: SalidaOficial } | null;
      if (!response.ok || !data?.salida) {
        throw new Error(data?.error ?? 'No fue posible registrar la salida.');
      }
      setSalidaGenerada(data.salida);
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : 'No fue posible registrar la salida.');
    } finally {
      setGuardando(false);
    }
  }

  const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-widest';
  const labelStyle = { color: '#667085' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3"
      role="dialog"
      aria-modal="true"
      aria-label={esRespuesta ? 'Registrar salida de respuesta' : 'Registrar oficio de salida'}
    >
      {/* Velo sólido — sin blur (lección de rendimiento del drawer). */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/55"
      />

      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ border: '1px solid #D9E2D9', maxHeight: 'calc(100dvh - 24px)' }}
      >
        <header className="px-5 py-4" style={{ borderBottom: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#8A6A12' }}>
            Correspondencia de salida
          </p>
          <h2 className="text-lg font-black leading-tight" style={{ color: '#12261A' }}>
            {esRespuesta ? 'Registrar salida de respuesta' : 'Registrar oficio de salida'}
          </h2>
          {esRespuesta && entrada && (
            <p className="text-xs mt-1" style={{ color: '#5F6F64' }}>
              Amarrada al radicado <span className="font-mono font-bold">{entrada.radicadoId}</span>
            </p>
          )}
        </header>

        {salidaGenerada ? (
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-4 px-6 py-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#16A34A' }}>
              Salida registrada
            </p>
            <p className="text-2xl font-black font-mono" style={{ color: VERDE_INST }}>
              {salidaGenerada.salidaId}
            </p>
            <p className="text-xs max-w-sm" style={{ color: '#667085' }}>
              Escriba este número en el oficio que se despacha
              {esRespuesta && entrada
                ? ` junto a la referencia del radicado ${entrada.radicadoId}. El despacho ya quedó en la trazabilidad.`
                : '. El despacho quedó registrado en el libro de salidas.'}
            </p>

            {/* Fase B — la copia del archivo se sella aquí mismo. */}
            <SelloDespacho salida={salidaGenerada} />

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
              <label className="md:col-span-2">
                <span className={labelCls} style={labelStyle}>Destinatario</span>
                <input
                  type="text"
                  value={destinatarioNombre}
                  onChange={(e) => setDestinatarioNombre(e.target.value)}
                  required
                  className="input-internal"
                />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Entidad (si aplica)</span>
                <input type="text" value={entidad} onChange={(e) => setEntidad(e.target.value)} className="input-internal" />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Correo del destinatario</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-internal" />
              </label>
              <label className="md:col-span-2">
                <span className={labelCls} style={labelStyle}>Dirección física</span>
                <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="input-internal" />
              </label>
              <label className="md:col-span-2">
                <span className={labelCls} style={labelStyle}>Asunto</span>
                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  required
                  className="input-internal"
                />
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Dependencia que despacha</span>
                <select
                  value={dependenciaOrigen}
                  onChange={(e) => setDependenciaOrigen(e.target.value as TenantId)}
                  className="select-internal w-full"
                >
                  {(Object.entries(NOMBRES_TENANT) as [TenantId, string][]).map(([id, nombre]) => (
                    <option key={id} value={id}>{nombre}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelCls} style={labelStyle}>Medio de envío</span>
                <select
                  value={medioEnvio}
                  onChange={(e) => setMedioEnvio(e.target.value as MedioEnvioSalida)}
                  className="select-internal w-full"
                >
                  {MEDIOS.map(([id, nombre]) => (
                    <option key={id} value={id}>{nombre}</option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className={labelCls} style={labelStyle}>Firmante del oficio</span>
                <input
                  type="text"
                  value={firmanteNombre}
                  onChange={(e) => setFirmanteNombre(e.target.value)}
                  required
                  className="input-internal"
                />
              </label>

              {/* Fase B — el oficio que se despacha, para el archivo digital. */}
              <div className="md:col-span-2">
                <span className={labelCls} style={labelStyle}>
                  Oficio firmado <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(PDF, opcional)</span>
                </span>
                {archivoPdf ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                       style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <span className="text-xs text-green-700 truncate min-w-0">{archivoPdf.name}</span>
                    <button
                      type="button"
                      onClick={() => setArchivoPdf(null)}
                      className="shrink-0 text-[10px]"
                      style={{ color: '#94A3B8' }}
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed cursor-pointer"
                         style={{ borderColor: '#D9E2D9' }}>
                    <svg className="w-4 h-4 shrink-0" style={{ color: '#94A3B8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    <span className="text-xs" style={{ color: '#667085' }}>Adjuntar el oficio despachado (PDF, máx. 10 MB)</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 10 * 1024 * 1024) setErrorLocal('El archivo supera los 10 MB.');
                        else { setErrorLocal(null); setArchivoPdf(f); }
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {errorLocal && (
              <p role="alert" className="rounded-lg px-3 py-2 text-xs"
                 style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                {errorLocal}
              </p>
            )}

            <footer className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ border: '1px solid #D9E2D9', color: '#475569' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: VERDE_INST }}
              >
                {guardando ? 'Registrando…' : 'Registrar salida'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
