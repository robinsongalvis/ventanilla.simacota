'use client';

import { useState, useEffect, useCallback } from 'react';

interface SimiNotifBadgeProps {
  /** Callback al hacer clic en el ícono */
  onOpen: () => void;
}

export function SimiNotifBadge({ onOpen }: SimiNotifBadgeProps) {
  const [sinLeer, setSinLeer] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/simi/notificaciones?noLeidas=true');
      const d = await res.json() as { sinLeer?: number };
      setSinLeer(d.sinLeer ?? 0);
    } catch { /* silenciar */ }
  }, []);

  useEffect(() => {
    void cargar();
    const interval = setInterval(cargar, 60_000); // re-check cada minuto
    return () => clearInterval(interval);
  }, [cargar]);

  return (
    <button
      onClick={onOpen}
      className="relative p-1.5 rounded-lg transition-colors"
      style={{ color: '#94A3B8' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#14532D'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}
      title={`${sinLeer} notificación(es) sin leer`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {sinLeer > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white animate-pulse"
              style={{ background: '#DC2626' }}>
          {sinLeer > 9 ? '9+' : sinLeer}
        </span>
      )}
    </button>
  );
}

/* ── Panel de notificaciones ── */
interface NotificacionItem {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
  radicadoId?: string;
}

interface NotifPanelProps {
  onClose: () => void;
  onVerRadicado?: (id: string) => void;
}

export function SimiNotifPanel({ onClose, onVerRadicado }: NotifPanelProps) {
  const [notifs,   setNotifs]   = useState<NotificacionItem[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/simi/notificaciones')
      .then((r) => r.json())
      .then((d: { notificaciones?: NotificacionItem[] }) => setNotifs(d.notificaciones ?? []))
      .finally(() => setCargando(false));
  }, []);

  async function marcarTodasLeidas() {
    const ids = notifs.filter((n) => !n.leida).map((n) => n.id);
    if (!ids.length) return;
    await fetch('/api/simi/notificaciones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
  }

  return (
    <div className="absolute right-0 top-10 w-80 rounded-2xl bg-white shadow-xl z-50"
         style={{ border: '1px solid #D9E2D9', boxShadow: '0 8px 24px rgba(20,83,45,0.12)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #D9E2D9' }}>
        <p className="text-xs font-bold" style={{ color: '#14532D' }}>⚖️ Notificaciones SIMI</p>
        <div className="flex gap-2">
          <button onClick={marcarTodasLeidas} className="text-[10px]" style={{ color: '#94A3B8' }}>Marcar leídas</button>
          <button onClick={onClose} className="text-[10px] font-bold" style={{ color: '#667085' }}>✕</button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: '#EEF4EE' }}>
        {cargando ? (
          <div className="p-4 text-center text-xs" style={{ color: '#94A3B8' }}>Cargando...</div>
        ) : notifs.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: '#667085' }}>Sin notificaciones pendientes</p>
          </div>
        ) : notifs.map((n) => (
          <div key={n.id}
               className="px-4 py-3 cursor-pointer transition-colors"
               style={{ background: n.leida ? 'transparent' : '#EEF4EE' }}
               onClick={() => { if (n.radicadoId && onVerRadicado) onVerRadicado(n.radicadoId); }}>
            <p className="text-xs font-bold" style={{ color: '#1F2933' }}>{n.titulo}</p>
            <p className="text-[10px] leading-snug mt-0.5" style={{ color: '#667085' }}>{n.mensaje}</p>
            <p className="text-[9px] mt-1" style={{ color: '#94A3B8' }}>
              {new Date(n.createdAt).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
