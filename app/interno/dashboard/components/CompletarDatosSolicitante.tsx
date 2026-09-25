'use client';

import { useState } from 'react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { tieneDatosNoAportados } from '@/lib/busqueda/filtros-radicado';

/* ══════════════════════════════════════════════════════════════
   Sprint Cierre del mostrador — completar datos del solicitante
   desde el detalle del radicado.

   Reemplaza el bloque de solo lectura "Datos no aportados": ahora,
   cuando el ciudadano vuelve con su teléfono o correo, la funcionaria
   los registra aquí mismo. Solo datos de contacto — el documento de
   identidad no se completa por esta vía. El guardado pasa por el
   endpoint con Admin SDK y el onSnapshot refresca el detalle solo.
══════════════════════════════════════════════════════════════ */

interface ValoresContacto {
  email:         string;
  telefonoMovil: string;
  telefonoFijo:  string;
  direccion:     string;
}

const VALORES_INICIALES: ValoresContacto = {
  email: '', telefonoMovil: '', telefonoFijo: '', direccion: '',
};

export function CompletarDatosSolicitante({ radicado }: { radicado: VentanillaRadicado }) {
  const [valores, setValores] = useState<ValoresContacto>(VALORES_INICIALES);
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle');
  const [mensaje, setMensaje] = useState<string | null>(null);

  const marcas = radicado.solicitante.datosNoAportados;
  if (!tieneDatosNoAportados(marcas)) return null;

  const hayContactoPendiente = Boolean(marcas?.correo || marcas?.telefono || marcas?.direccion);
  const hayAlgoEscrito = Object.values(valores).some((v) => v.trim().length > 0);

  function set(campo: keyof ValoresContacto, valor: string) {
    setValores((prev) => ({ ...prev, [campo]: valor }));
  }

  async function guardar() {
    setEstado('guardando');
    setMensaje(null);
    try {
      const res = await fetch(
        `/api/radicados/${encodeURIComponent(radicado.radicadoId)}/completar-datos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(valores),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEstado('error');
        setMensaje(body.error ?? 'No fue posible guardar los datos.');
        return;
      }
      setEstado('ok');
      setMensaje('Datos guardados. La marca se actualizará en un momento.');
    } catch {
      setEstado('error');
      setMensaje('Error de red al guardar los datos.');
    }
  }

  const inputCls = 'input-internal';
  const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-widest';
  const labelStyle = { color: '#92400E' };

  return (
    <div className="rounded-xl p-4" style={{ background: '#FEF3C7', border: '1px solid #FBBF24' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#92400E' }}>
        Datos pendientes del solicitante
      </p>
      <p className="text-xs mb-3" style={{ color: '#92400E' }}>
        Si el ciudadano aporta el dato, regístralo aquí: la marca se
        resuelve y queda evento en la trazabilidad.
      </p>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        {marcas?.correo && (
          <label>
            <span className={labelCls} style={labelStyle}>Correo electrónico</span>
            <input
              type="email"
              value={valores.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputCls}
              placeholder="ciudadano@correo.com"
            />
          </label>
        )}
        {marcas?.telefono && (
          <>
            <label>
              <span className={labelCls} style={labelStyle}>Teléfono móvil</span>
              <input
                type="text"
                value={valores.telefonoMovil}
                onChange={(e) => set('telefonoMovil', e.target.value)}
                className={inputCls}
              />
            </label>
            <label>
              <span className={labelCls} style={labelStyle}>Teléfono fijo</span>
              <input
                type="text"
                value={valores.telefonoFijo}
                onChange={(e) => set('telefonoFijo', e.target.value)}
                className={inputCls}
              />
            </label>
          </>
        )}
        {marcas?.direccion && (
          <label className="md:col-span-2">
            <span className={labelCls} style={labelStyle}>Dirección</span>
            <input
              type="text"
              value={valores.direccion}
              onChange={(e) => set('direccion', e.target.value)}
              className={inputCls}
            />
          </label>
        )}
      </div>

      {marcas?.documento && (
        <p className="mt-3 text-[11px] italic" style={{ color: '#92400E' }}>
          El documento de identidad no se completa por esta vía.
        </p>
      )}

      {hayContactoPendiente && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => { void guardar(); }}
            disabled={!hayAlgoEscrito || estado === 'guardando'}
            className="text-xs font-bold px-4 py-2 rounded-lg text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#14532D' }}
          >
            {estado === 'guardando' ? 'Guardando…' : 'Guardar datos aportados'}
          </button>
          {mensaje && (
            <p
              role="status"
              className="text-xs font-semibold"
              style={{ color: estado === 'error' ? '#991B1B' : '#14532D' }}
            >
              {mensaje}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
