'use client';

import { useState } from 'react';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { MedioEnvioSalida } from '@/src/types/salida';
import { registrarSalida } from '@/lib/actions/registrarSalida';

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

  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [salidaGenerada, setSalidaGenerada] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    setErrorLocal(null);
    try {
      const { salidaId } = await registrarSalida(
        {
          tipoSalida:        esRespuesta ? 'RESPUESTA' : 'OFICIO_INDEPENDIENTE',
          radicadoEntradaId: entrada?.radicadoId ?? null,
          destinatario: {
            nombre:    destinatarioNombre,
            entidad:   entidad || null,
            email:     email || null,
            direccion: direccion || null,
          },
          asunto,
          dependenciaOrigen,
          medioEnvio,
          firmanteNombre,
        },
        { uid: usuario.uid, nombre: usuario.nombre },
      );
      setSalidaGenerada(salidaId);
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
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#16A34A' }}>
              Salida registrada
            </p>
            <p className="text-2xl font-black font-mono" style={{ color: VERDE_INST }}>
              {salidaGenerada}
            </p>
            <p className="text-xs max-w-sm" style={{ color: '#667085' }}>
              Escriba este número en el oficio que se despacha
              {esRespuesta && entrada
                ? ` junto a la referencia del radicado ${entrada.radicadoId}. El despacho ya quedó en la trazabilidad.`
                : '. El despacho quedó registrado en el libro de salidas.'}
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
