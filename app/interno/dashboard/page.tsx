'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc, arrayUnion }    from 'firebase/firestore';
import { signInWithEmailAndPassword }     from 'firebase/auth';
import { getFirebaseAuth, getDb }         from '@/lib/firebase';
import { useAuth }                        from '@/lib/hooks/useAuth';
import { useVentanillaRadicados }         from '@/lib/hooks/useVentanillaRadicados';
import { VentanillaProvider, useVentanilla } from '@/lib/store/ventanillaStore';
import { NOMBRES_TENANT, DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import { diasRestantesHabiles, TIPOS_SOLICITUD } from '@/lib/tiempos-radicado';
import { RadicacionFuncionarioForm }       from '@/app/interno/recepcion/components/RadicacionFuncionarioForm';
import { radicarInstitucionalmente }       from '@/lib/actions/radicarVentanilla';
import { asignarRadicado, asignarMasivo }  from '@/lib/actions/asignarRadicado';
import { ComprobanteRadicado }             from '@/app/interno/dashboard/components/ComprobanteRadicado';
import { PanelCargaDependencias }          from '@/app/interno/dashboard/components/dependencias/PanelCargaDependencias';
import type {
  FiltroMIPG,
  VistaActual,
}                                         from '@/lib/store/ventanillaStore';
import type { TenantId }                  from '@/src/types/radicado';
import type { VentanillaRadicado }        from '@/src/types/ventanilla';
import type { UsuarioAutenticado }        from '@/lib/hooks/useAuth';

/* ══════════════════════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════════════════════ */

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);

const LABELS_ESTADO: Record<string, string> = {
  PENDIENTE:   'Pendiente',
  EN_REVISION: 'En revisión',
  EN_PROCESO:  'En proceso',
  ASIGNADO:    'Asignado',
  RESUELTO:    'Resuelto',
  DEVUELTO:    'Devuelto',
  RECHAZADO:   'Rechazado',
  POR_VENCER:  'Por vencer',
  VENCIDO:     'Vencido',
  PRORROGA:    'Prórroga',
};

const BADGE_ESTADO: Record<string, string> = {
  PENDIENTE:   'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  EN_REVISION: 'bg-amber-500/20  text-amber-300  border-amber-500/30',
  EN_PROCESO:  'bg-blue-500/20   text-blue-300   border-blue-500/30',
  ASIGNADO:    'bg-sky-500/20    text-sky-300    border-sky-500/30',
  RESUELTO:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  DEVUELTO:    'bg-rose-500/20   text-rose-300   border-rose-500/30',
  RECHAZADO:   'bg-slate-500/20  text-slate-300  border-slate-500/30',
  POR_VENCER:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
  VENCIDO:     'bg-red-500/20    text-red-300    border-red-500/30',
  PRORROGA:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */

function calcDiasRestantes(r: VentanillaRadicado): number {
  return diasRestantesHabiles(r.termino.fechaVencimiento);
}

function estaActivo(r: VentanillaRadicado): boolean {
  return !ESTADOS_RESUELTOS.has(r.estadoActual);
}

interface MetricasMIPGData {
  radicadas:         number;
  prioridadMIPG:     number;
  asignadas:         number;
  porVencer:         number;
  vencidas:          number;
  devueltasProrroga: number;
}

function calcularMetricas(radicados: VentanillaRadicado[]): MetricasMIPGData {
  return radicados.reduce<MetricasMIPGData>(
    (acc, r) => {
      const dias   = calcDiasRestantes(r);
      const activo = estaActivo(r);

      if (r.estadoActual === 'PENDIENTE')                                         acc.radicadas         += 1;
      if (r.prioridad === 'ROJO' && activo)                                       acc.prioridadMIPG     += 1;
      if (['ASIGNADO', 'EN_REVISION', 'EN_PROCESO'].includes(r.estadoActual))     acc.asignadas         += 1;
      if (activo && dias >= 0 && dias <= 2)                                       acc.porVencer         += 1;
      if (activo && dias < 0)                                                     acc.vencidas          += 1;
      if (['DEVUELTO', 'PRORROGA'].includes(r.estadoActual))                      acc.devueltasProrroga += 1;

      return acc;
    },
    { radicadas: 0, prioridadMIPG: 0, asignadas: 0, porVencer: 0, vencidas: 0, devueltasProrroga: 0 },
  );
}

function aplicarFiltroMIPG(
  radicados: VentanillaRadicado[],
  filtro: FiltroMIPG,
  busqueda: string,
): VentanillaRadicado[] {
  let lista = radicados;

  if (filtro === 'RADICADAS')           lista = lista.filter((r) => r.estadoActual === 'PENDIENTE');
  else if (filtro === 'PRIORIDAD_MIPG') lista = lista.filter((r) => r.prioridad === 'ROJO' && estaActivo(r));
  else if (filtro === 'ASIGNADAS')      lista = lista.filter((r) => ['ASIGNADO', 'EN_REVISION', 'EN_PROCESO'].includes(r.estadoActual));
  else if (filtro === 'POR_VENCER')     lista = lista.filter((r) => { const d = calcDiasRestantes(r); return estaActivo(r) && d >= 0 && d <= 2; });
  else if (filtro === 'VENCIDAS')       lista = lista.filter((r) => estaActivo(r) && calcDiasRestantes(r) < 0);
  else if (filtro === 'DEVUELTAS_PRORROGA') lista = lista.filter((r) => ['DEVUELTO', 'PRORROGA'].includes(r.estadoActual));

  if (busqueda.trim()) {
    const q = busqueda.toLowerCase().trim();
    lista = lista.filter(
      (r) =>
        r.radicadoId.toLowerCase().includes(q) ||
        r.solicitante.nombreCompleto.toLowerCase().includes(q) ||
        r.solicitante.numeroDocumento.includes(q),
    );
  }

  return [...lista].sort((a, b) => {
    const urgA = a.prioridad === 'ROJO' && estaActivo(a) ? 0 : 1;
    const urgB = b.prioridad === 'ROJO' && estaActivo(b) ? 0 : 1;
    if (urgA !== urgB) return urgA - urgB;
    return new Date(b.control.fechaRadicado).getTime() - new Date(a.control.fechaRadicado).getTime();
  });
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtFechaLarga(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: CargandoSesion
══════════════════════════════════════════════════════════════ */

function CargandoSesion() {
  return (
    <div className="h-screen bg-[#0A0A0B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Verificando sesión…</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: FormLogin
══════════════════════════════════════════════════════════════ */

function FormLogin() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    } catch {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-obsidian-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 mb-4">
            <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <h1 className="font-headline text-2xl text-slate-50">Panel de Gestión</h1>
          <p className="text-sm text-slate-400 mt-1">Alcaldía de Simacota · Ventanilla Única</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-card p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="font-label text-slate-400">Correo institucional</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="funcionario@simacota.gov.co"
              className="input-obsidian"
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label text-slate-400">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="input-obsidian"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-smooth" />Ingresando…</>
              : 'Ingresar al Panel'}
          </button>
        </form>
      </div>
    </main>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: SidebarNav
══════════════════════════════════════════════════════════════ */

const NAV_ITEMS: { vista: VistaActual; label: string; icono: React.ReactNode }[] = [
  {
    vista: 'TABLERO',
    label: 'Tablero',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    vista: 'BANDEJA',
    label: 'Bandeja',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.1 13.177a2.25 2.25 0 00-.1.661z" />
      </svg>
    ),
  },
  {
    vista: 'VENTANILLA',
    label: 'Ventanilla',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    vista: 'DEPENDENCIAS',
    label: 'Dependencias',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    vista: 'REPORTES',
    label: 'Reportes MIPG',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

function SidebarNav({
  vistaActual,
  onVistaChange,
  onNuevoRadicado,
  usuario,
  onCerrarSesion,
  pendientesBandeja,
}: {
  vistaActual: VistaActual;
  onVistaChange: (v: VistaActual) => void;
  onNuevoRadicado: () => void;
  usuario: UsuarioAutenticado;
  onCerrarSesion: () => void;
  pendientesBandeja: number;
}) {
  const nombreRol = usuario.rol === 'ADMIN'
    ? 'Admin'
    : usuario.rol === 'RECEPCIONISTA'
      ? 'Recepción'
      : 'Funcionario';

  return (
    <aside className="h-full flex flex-col bg-[#0A0A0B] border-r border-white/[0.07] shrink-0 w-[210px]">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-600 leading-none">Alcaldía</p>
            <p className="text-xs font-bold text-slate-100 leading-tight">Simacota</p>
          </div>
        </div>
      </div>

      {/* Radicación Rápida */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNuevoRadicado}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-black"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Radicación Rápida
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-2 py-1.5">
          Módulos
        </p>
        {NAV_ITEMS.map(({ vista, label, icono }) => {
          const activo = vistaActual === vista;
          return (
            <button
              key={vista}
              onClick={() => onVistaChange(vista)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/50 ${
                activo
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]'
              }`}
            >
              <span className={activo ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}>
                {icono}
              </span>
              <span className="text-xs font-medium flex-1">{label}</span>
              {vista === 'BANDEJA' && pendientesBandeja > 0 && (
                <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center px-1">
                  {pendientesBandeja > 99 ? '99+' : pendientesBandeja}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.07]">
        <div className="bg-slate-900/60 rounded-xl px-3 py-2.5 flex flex-col gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{usuario.nombre}</p>
            <p className="text-[10px] text-slate-500 truncate">{NOMBRES_TENANT[usuario.tenantId]}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-bold uppercase tracking-wide">
              {nombreRol}
            </span>
            <button
              onClick={onCerrarSesion}
              title="Cerrar sesión"
              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: TarjetasMIPG (fila de métricas clickeables)
══════════════════════════════════════════════════════════════ */

interface TarjetaMIPGItem {
  filtro:  FiltroMIPG;
  label:   string;
  valor:   number;
  borde:   string;
  texto:   string;
  icono?:  React.ReactNode;
}

function TarjetasMIPG({
  metricas,
  filtroActivo,
  onFiltroChange,
  esAdmin,
  tenantFiltro,
  onTenantChange,
}: {
  metricas:       MetricasMIPGData;
  filtroActivo:   FiltroMIPG;
  onFiltroChange: (f: FiltroMIPG) => void;
  esAdmin:        boolean;
  tenantFiltro:   TenantId | 'TODOS';
  onTenantChange: (t: TenantId | 'TODOS') => void;
}) {
  const tarjetas: TarjetaMIPGItem[] = [
    {
      filtro: 'RADICADAS',
      label:  'Radicadas',
      valor:  metricas.radicadas,
      borde:  'border-emerald-500',
      texto:  'text-emerald-300',
    },
    {
      filtro: 'PRIORIDAD_MIPG',
      label:  'Prioridad MIPG',
      valor:  metricas.prioridadMIPG,
      borde:  'border-red-500',
      texto:  'text-red-300',
      icono: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      filtro: 'ASIGNADAS',
      label:  'Asignadas',
      valor:  metricas.asignadas,
      borde:  'border-sky-500',
      texto:  'text-sky-300',
    },
    {
      filtro: 'POR_VENCER',
      label:  'Por Vencer',
      valor:  metricas.porVencer,
      borde:  'border-orange-500',
      texto:  'text-orange-300',
    },
    {
      filtro: 'VENCIDAS',
      label:  'Vencidas',
      valor:  metricas.vencidas,
      borde:  'border-rose-600',
      texto:  'text-rose-300',
    },
    {
      filtro: 'DEVUELTAS_PRORROGA',
      label:  'Devueltas / Prórroga',
      valor:  metricas.devueltasProrroga,
      borde:  'border-amber-600',
      texto:  'text-amber-300',
    },
  ];

  return (
    <div className="px-4 py-3 border-b border-white/[0.07] bg-slate-900/20 shrink-0">
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {/* Tarjeta TODOS */}
        <button
          onClick={() => onFiltroChange('TODOS')}
          className={`shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border border-l-4 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 ${
            filtroActivo === 'TODOS'
              ? 'bg-slate-800/80 border-slate-400 border-t-white/15 border-r-white/15 border-b-white/15'
              : 'bg-slate-900/40 border-slate-600 border-t-white/8 border-r-white/8 border-b-white/8 hover:bg-slate-800/60 hover:border-slate-500 hover:-translate-y-px'
          }`}
        >
          <span className="text-2xl font-black leading-none text-slate-50 tabular-nums">
            {tarjetas.reduce((s, t) => s + t.valor, 0)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">Todos</span>
        </button>

        {tarjetas.map((t) => {
          const activo = filtroActivo === t.filtro;
          return (
            <button
              key={t.filtro}
              onClick={() => onFiltroChange(t.filtro)}
              className={`shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border border-l-4 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 ${t.borde} ${
                activo
                  ? 'bg-slate-800/80 border-t-white/15 border-r-white/15 border-b-white/15'
                  : 'bg-slate-900/40 border-t-white/8 border-r-white/8 border-b-white/8 hover:bg-slate-800/60 hover:-translate-y-px'
              }`}
            >
              <span className={`text-2xl font-black leading-none tabular-nums flex items-center gap-1 ${t.texto}`}>
                {t.icono && <span className="mt-0.5">{t.icono}</span>}
                {t.valor}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${t.texto} opacity-70`}>
                {t.label}
              </span>
            </button>
          );
        })}

        {/* Selector de dependencia (admin) */}
        {esAdmin && (
          <div className="shrink-0 flex items-center ml-auto">
            <select
              value={tenantFiltro}
              onChange={(e) => onTenantChange(e.target.value as TenantId | 'TODOS')}
              className="select-internal text-xs"
            >
              <option value="TODOS">Todas las dependencias</option>
              {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
                <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: TablaRadicados
══════════════════════════════════════════════════════════════ */

function SkeletonFila() {
  return (
    <tr className="animate-pulse border-b border-white/[0.05]">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded bg-slate-800/80" style={{ width: `${40 + (i % 3) * 25}%` }} />
        </td>
      ))}
    </tr>
  );
}

function TablaRadicados({
  radicados,
  cargando,
  error,
  busqueda,
  onBusquedaChange,
  radicadoSeleccionadoId,
  onSeleccionar,
  onNuevoRadicado,
}: {
  radicados:              VentanillaRadicado[];
  cargando:               boolean;
  error:                  string | null;
  busqueda:               string;
  onBusquedaChange:       (v: string) => void;
  radicadoSeleccionadoId: string | null;
  onSeleccionar:          (r: VentanillaRadicado) => void;
  onNuevoRadicado:        () => void;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.07] shrink-0">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            placeholder="Buscar por radicado, nombre o documento…"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all duration-200 hover:border-indigo-500/25 hover:bg-white/[0.06] focus:border-indigo-500/70 focus:bg-indigo-500/[0.04] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.35)] focus-visible:border-indigo-500/70 focus-visible:shadow-[0_0_0_2px_rgba(99,102,241,0.35)]"
          />
        </div>
        <span className="text-xs text-slate-600 shrink-0">{radicados.length} resultado{radicados.length !== 1 ? 's' : ''}</span>
        <button
          onClick={onNuevoRadicado}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo
        </button>
      </div>

      {/* Error Firestore */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 shrink-0">
          <p className="font-semibold mb-1">Error de conexión</p>
          <p className="text-rose-500">{error}</p>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm">
            <tr className="border-b border-white/[0.07]">
              {['Radicado', 'Solicitante', 'Tipo Trámite', 'Dependencia', 'Estado', 'Vencimiento', 'Días'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && !error && (
              Array.from({ length: 6 }).map((_, i) => <SkeletonFila key={i} />)
            )}

            {!cargando && !error && radicados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <p className="text-slate-400 font-medium mb-1">Sin radicados</p>
                  <p className="text-xs text-slate-600">No hay resultados para los filtros aplicados.</p>
                </td>
              </tr>
            )}

            {!cargando && radicados.map((r) => {
              const dias     = calcDiasRestantes(r);
              const activo   = estaActivo(r);
              const esRojo   = r.prioridad === 'ROJO';
              const seleccionado = radicadoSeleccionadoId === r.radicadoId;

              const diasColor = !activo
                ? 'text-slate-600'
                : dias < 0
                  ? 'text-rose-400 font-bold'
                  : dias <= 2
                    ? 'text-orange-400 font-bold'
                    : 'text-slate-400';

              return (
                <tr
                  key={r.radicadoId}
                  onClick={() => onSeleccionar(r)}
                  className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                    seleccionado
                      ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                      : 'hover:bg-white/[0.025]'
                  }`}
                >
                  {/* Radicado */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {esRojo && (
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      )}
                      <span className="font-mono text-xs text-indigo-300">{r.radicadoId}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">{fmtFecha(r.control.fechaRadicado)}</p>
                  </td>

                  {/* Solicitante */}
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-slate-200 font-medium truncate">{r.solicitante.nombreCompleto}</p>
                    <p className="text-[10px] text-slate-600 font-mono">
                      {r.solicitante.tipoDocumento} {r.solicitante.numeroDocumento}
                    </p>
                  </td>

                  {/* Tipo trámite */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs text-slate-400">{r.termino.tipoSolicitudNombre}</p>
                    <p className="text-[10px] text-slate-600">{r.termino.diasRespuesta}d {r.termino.unidad.toLowerCase()}</p>
                  </td>

                  {/* Dependencia */}
                  <td className="px-4 py-3 max-w-[150px]">
                    <p className="text-xs text-slate-400 truncate">{NOMBRES_TENANT[r.clasificacion.oficinaDestino]}</p>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                      BADGE_ESTADO[r.estadoActual] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                    }`}>
                      {LABELS_ESTADO[r.estadoActual] ?? r.estadoActual}
                    </span>
                  </td>

                  {/* Vencimiento */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs text-slate-400">{fmtFecha(r.termino.fechaVencimiento)}</p>
                  </td>

                  {/* Días restantes */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm tabular-nums ${diasColor}`}>
                      {!activo
                        ? '—'
                        : dias < 0
                          ? `${Math.abs(dias)}d venc.`
                          : `${dias}d`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: PanelDerecho (4 tabs)
══════════════════════════════════════════════════════════════ */

type TabPanelId = 'info' | 'traslado' | 'trazabilidad' | 'respuesta';

const TABS_PANEL: { id: TabPanelId; label: string }[] = [
  { id: 'info',         label: 'Información' },
  { id: 'traslado',     label: 'Traslado' },
  { id: 'trazabilidad', label: 'Trazabilidad' },
  { id: 'respuesta',    label: 'Prórroga / Resp.' },
];

function FilaInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</p>
      <p className="text-sm text-slate-200 mt-0.5 break-words">{value}</p>
    </div>
  );
}

function PanelDerecho({
  radicado,
  usuario,
  onCerrar,
}: {
  radicado: VentanillaRadicado;
  usuario:  UsuarioAutenticado;
  onCerrar: () => void;
}) {
  const [tab,              setTab]              = useState<TabPanelId>('info');
  const [tenantDestino,    setTenantDestino]    = useState<TenantId>(radicado.clasificacion.oficinaDestino);
  const [funcionarioUid,   setFuncionarioUid]   = useState(radicado.clasificacion.funcionarioResponsableUid ?? '');
  const [motivo,           setMotivo]           = useState('');
  const [diasProrroga,     setDiasProrroga]     = useState(5);
  const [respuesta,        setRespuesta]        = useState('');
  const [guardando,        setGuardando]        = useState(false);
  const [mensajeOk,        setMensajeOk]        = useState<string | null>(null);
  const [errorLocal,       setErrorLocal]       = useState<string | null>(null);

  const dias = calcDiasRestantes(radicado);

  async function ejecutarAccion(accionFn: () => Promise<void>) {
    setGuardando(true);
    setErrorLocal(null);
    setMensajeOk(null);
    try {
      await accionFn();
      setMensajeOk('Operación guardada correctamente.');
    } catch (err) {
      setErrorLocal(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGuardando(false);
    }
  }

  function trazabilidadEntry(accion: string, nota: string, extra?: Record<string, unknown>) {
    return {
      fecha:       new Date().toISOString(),
      accion,
      actorUid:    usuario.uid,
      actorNombre: usuario.nombre,
      nota,
      ...(extra ?? {}),
    };
  }

  async function asignar() {
    if (!tenantDestino) return;
    await ejecutarAccion(() =>
      updateDoc(doc(getDb(), 'ventanilla_radicados', radicado.radicadoId), {
        'clasificacion.oficinaDestino':         tenantDestino,
        'clasificacion.funcionarioResponsableUid': funcionarioUid || null,
        estadoActual: 'ASIGNADO',
        trazabilidad: arrayUnion(trazabilidadEntry('ASIGNACION',
          `Trasladado a ${NOMBRES_TENANT[tenantDestino]}`,
          { oficinaOrigen: radicado.clasificacion.oficinaDestino, oficinaDestino: tenantDestino },
        )),
      }),
    );
  }

  async function devolver() {
    if (motivo.trim().length < 10) { setErrorLocal('El motivo debe tener al menos 10 caracteres.'); return; }
    await ejecutarAccion(() =>
      updateDoc(doc(getDb(), 'ventanilla_radicados', radicado.radicadoId), {
        estadoActual: 'DEVUELTO',
        trazabilidad: arrayUnion(trazabilidadEntry('DEVOLUCION', motivo.trim())),
      }),
    );
    setMotivo('');
  }

  async function aplicarProrroga() {
    if (motivo.trim().length < 5) { setErrorLocal('Ingresa el motivo de la prórroga.'); return; }
    const fechaActual  = new Date(radicado.termino.fechaVencimiento);
    const nuevaFecha   = new Date(fechaActual);
    nuevaFecha.setDate(nuevaFecha.getDate() + diasProrroga);

    await ejecutarAccion(() =>
      updateDoc(doc(getDb(), 'ventanilla_radicados', radicado.radicadoId), {
        'termino.fechaVencimiento':    nuevaFecha.toISOString(),
        'termino.prorrogasAplicadas':  (radicado.termino.prorrogasAplicadas ?? 0) + 1,
        estadoActual: 'PRORROGA',
        trazabilidad: arrayUnion(trazabilidadEntry('PRORROGA', motivo.trim(), {
          diasProrroga,
          fechaVencimientoAnterior: radicado.termino.fechaVencimiento,
        })),
      }),
    );
    setMotivo('');
  }

  async function responderCaso() {
    if (respuesta.trim().length < 10) { setErrorLocal('La respuesta debe tener al menos 10 caracteres.'); return; }
    await ejecutarAccion(() =>
      updateDoc(doc(getDb(), 'ventanilla_radicados', radicado.radicadoId), {
        estadoActual: 'RESUELTO',
        trazabilidad: arrayUnion(trazabilidadEntry('RESPUESTA_FUNCIONARIO', respuesta.trim())),
      }),
    );
    setRespuesta('');
  }

  const esRojo = radicado.prioridad === 'ROJO';

  return (
    <div className="h-full flex flex-col bg-[#0D1117] border-l border-white/[0.07]">
      {/* Header */}
      <div className={`px-4 py-3 border-b border-white/[0.07] shrink-0 ${esRojo ? 'bg-red-950/20' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {esRojo && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
              <p className="font-mono text-xs text-indigo-300 truncate">{radicado.radicadoId}</p>
            </div>
            <p className="text-sm font-semibold text-slate-100 truncate">{radicado.solicitante.nombreCompleto}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                BADGE_ESTADO[radicado.estadoActual] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
              }`}>
                {LABELS_ESTADO[radicado.estadoActual] ?? radicado.estadoActual}
              </span>
              <span className={`text-[10px] font-bold tabular-nums ${
                dias < 0 ? 'text-rose-400' : dias <= 2 ? 'text-orange-400' : 'text-slate-500'
              }`}>
                {estaActivo(radicado) ? (dias < 0 ? `${Math.abs(dias)}d VENCIDO` : `${dias}d restantes`) : 'Cerrado'}
              </span>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.07] shrink-0 overflow-x-auto">
        {TABS_PANEL.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setMensajeOk(null); setErrorLocal(null); }}
            className={`shrink-0 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/50 ${
              tab === t.id
                ? 'text-indigo-300 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feedback global */}
      {(mensajeOk || errorLocal) && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs shrink-0 ${
          mensajeOk
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
        }`}>
          {mensajeOk ?? errorLocal}
        </div>
      )}

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── TAB 1: Información ── */}
        {tab === 'info' && (
          <>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3">Solicitante</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <FilaInfo label="Tipo persona"    value={radicado.solicitante.tipoPersona} />
                <FilaInfo label="Documento"       value={`${radicado.solicitante.tipoDocumento} ${radicado.solicitante.numeroDocumento}`} />
                <FilaInfo label="Nombre completo" value={radicado.solicitante.nombreCompleto} />
                {radicado.solicitante.email    && <FilaInfo label="Correo"    value={radicado.solicitante.email} />}
                {radicado.solicitante.telefono && <FilaInfo label="Teléfono"  value={radicado.solicitante.telefono} />}
                {radicado.solicitante.direccion && <FilaInfo label="Dirección" value={radicado.solicitante.direccion} />}
                <FilaInfo label="Municipio" value={`${radicado.solicitante.ubicacion.municipio}, ${radicado.solicitante.ubicacion.departamento}`} />
              </div>
            </div>

            <div className="border-t border-white/[0.07] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3">Detalle del caso</p>
              <div className="space-y-3">
                <FilaInfo label="Asunto"      value={radicado.detalle.asunto} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Descripción</p>
                  <p className="text-sm text-slate-300 mt-0.5 leading-relaxed whitespace-pre-wrap">{radicado.detalle.descripcion}</p>
                </div>
                <FilaInfo label="Número de folios" value={String(radicado.detalle.numeroFolios)} />
                {radicado.detalle.anexosDescripcion && (
                  <FilaInfo label="Anexos" value={radicado.detalle.anexosDescripcion} />
                )}
              </div>
            </div>

            <div className="border-t border-white/[0.07] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3">
                Control de radicación
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <FilaInfo label="Fecha"   value={fmtFechaLarga(radicado.control.fechaRadicado)} />
                <FilaInfo label="Canal"   value={radicado.control.medioRecepcion} />
                <FilaInfo label="Vence"   value={fmtFecha(radicado.termino.fechaVencimiento)} />
                <FilaInfo label="Tipo"    value={`${radicado.termino.tipoSolicitudNombre} · ${radicado.termino.diasRespuesta}d`} />
              </div>
            </div>

            {radicado.archivos.length > 0 && (
              <div className="border-t border-white/[0.07] pt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3">
                  Archivos adjuntos ({radicado.archivos.length})
                </p>
                <ul className="space-y-2">
                  {radicado.archivos.map((arch, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.05] last:border-0">
                      <span className="text-xs text-slate-300 truncate min-w-0">{arch.nombre}</span>
                      {arch.url && (
                        <a href={arch.url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                          Ver
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: Traslado / Asignación ── */}
        {tab === 'traslado' && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Dependencia destino</p>
              <select
                value={tenantDestino}
                onChange={(e) => setTenantDestino(e.target.value as TenantId)}
                className="select-internal w-full"
              >
                {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
                  <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">UID funcionario responsable <span className="normal-case font-normal text-slate-600">(opcional)</span></p>
              <input
                value={funcionarioUid}
                onChange={(e) => setFuncionarioUid(e.target.value)}
                placeholder="uid-del-funcionario"
                className="input-internal"
              />
            </div>

            <button
              type="button"
              onClick={asignar}
              disabled={guardando}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-bold transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {guardando && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Confirmar traslado
            </button>

            <div className="border-t border-white/[0.07] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Destino actual</p>
              <p className="text-sm text-slate-300">{NOMBRES_TENANT[radicado.clasificacion.oficinaDestino]}</p>
            </div>
          </div>
        )}

        {/* ── TAB 3: Trazabilidad MIPG ── */}
        {tab === 'trazabilidad' && (
          <div>
            {radicado.trazabilidad.length === 0
              ? <p className="text-sm text-slate-600 italic">Sin eventos de trazabilidad.</p>
              : (
                <ol className="relative flex flex-col gap-0">
                  {[...radicado.trazabilidad]
                    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                    .map((evento, idx, arr) => (
                      <li key={`${evento.fecha}-${idx}`} className="relative flex gap-3 pb-5 last:pb-0">
                        {idx < arr.length - 1 && (
                          <div className="absolute left-[9px] top-5 bottom-0 w-px bg-white/[0.07]" />
                        )}
                        <div className="shrink-0 w-[18px] h-[18px] mt-0.5 rounded-full bg-indigo-500/30 border border-indigo-500/50 flex items-center justify-center z-10">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-0.5">
                            <span className="text-xs font-semibold text-slate-200">{evento.accion}</span>
                            <time className="shrink-0 text-[10px] font-mono text-slate-600">
                              {fmtFechaLarga(evento.fecha)}
                            </time>
                          </div>
                          <p className="text-xs text-slate-500">{evento.actorNombre}</p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{evento.nota}</p>
                          {(evento.oficinaOrigen || evento.oficinaDestino) && (
                            <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                              {evento.oficinaOrigen && NOMBRES_TENANT[evento.oficinaOrigen]}
                              {evento.oficinaOrigen && evento.oficinaDestino && ' → '}
                              {evento.oficinaDestino && NOMBRES_TENANT[evento.oficinaDestino]}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              )}
          </div>
        )}

        {/* ── TAB 4: Prórroga / Respuesta ── */}
        {tab === 'respuesta' && (
          <div className="space-y-5">
            {/* Devolver */}
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Devolver al ciudadano</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Motivo</p>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Indica la razón de la devolución…"
                  className="input-internal resize-none"
                />
              </div>
              <button
                type="button"
                onClick={devolver}
                disabled={guardando}
                className="w-full py-2 rounded-lg border border-rose-500/40 text-rose-300 text-sm font-bold hover:bg-rose-500/10 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                Devolver
              </button>
            </div>

            {/* Prórroga */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Aplicar prórroga legal</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Motivo</p>
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Fundamento legal de la prórroga"
                    className="input-internal"
                  />
                </div>
                <div className="w-24">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Días</p>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={diasProrroga}
                    onChange={(e) => setDiasProrroga(Math.max(1, Number(e.target.value)))}
                    className="input-internal text-center"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={aplicarProrroga}
                disabled={guardando}
                className="w-full py-2 rounded-lg border border-amber-500/40 text-amber-300 text-sm font-bold hover:bg-amber-500/10 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              >
                Aplicar prórroga (+{diasProrroga} días)
              </button>
            </div>

            {/* Respuesta final */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Cargar respuesta / resolver</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Nota de resolución</p>
                <textarea
                  value={respuesta}
                  onChange={(e) => setRespuesta(e.target.value)}
                  rows={4}
                  placeholder="Describe la respuesta dada al ciudadano y adjunta el oficio firmado si aplica…"
                  className="input-internal resize-none"
                />
              </div>
              <button
                type="button"
                onClick={responderCaso}
                disabled={guardando || radicado.estadoActual === 'RESUELTO'}
                className="w-full py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] text-white text-sm font-bold transition-all duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                {radicado.estadoActual === 'RESUELTO' ? 'Ya está resuelto' : 'Marcar como resuelto'}
              </button>
            </div>

            {guardando && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <span className="w-3.5 h-3.5 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
                Guardando en Firestore…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: DrawerNuevoRadicado
══════════════════════════════════════════════════════════════ */

interface DatosComprobante {
  solicitanteNombre: string;
  numeroDocumento:   string;
  tipoDocumento:     string;
  fechaRadicado:     string;
  horaRadicado:      string;
  medioRecepcion:    string;
  tipoTramite:       string;
  diasRespuesta:     number;
  unidad:            'HABILES' | 'CALENDARIO';
  asunto:            string;
  fechaVencimiento:  string;
  numeroFolios:      number;
}

function DrawerNuevoRadicado({
  usuario,
  onCerrar,
}: {
  usuario:  UsuarioAutenticado;
  onCerrar: () => void;
}) {
  const [radicadoGenerado,  setRadicadoGenerado]  = useState<string | null>(null);
  const [datosComprobante,  setDatosComprobante]  = useState<DatosComprobante | null>(null);
  const [progreso,          setProgreso]          = useState('');
  const [progresoPct,       setProgresoPct]       = useState(0);
  const [errorGuardado,     setErrorGuardado]     = useState<string | null>(null);

  async function handleSubmit(
    payload: Parameters<NonNullable<React.ComponentProps<typeof RadicacionFuncionarioForm>['onSubmit']>>[0],
  ) {
    setErrorGuardado(null);
    setProgreso('Iniciando…');
    setProgresoPct(5);

    try {
      const ahora = new Date();
      const { radicadoId } = await radicarInstitucionalmente(
        payload,
        { uid: usuario.uid, nombre: usuario.nombre, tenantId: usuario.tenantId },
        (msg, pct) => { setProgreso(msg); setProgresoPct(pct); },
      );
      const tipoConf = TIPOS_SOLICITUD[payload.tipoSolicitudId];
      setDatosComprobante({
        solicitanteNombre: payload.nombreCompleto,
        numeroDocumento:   payload.numeroDocumento,
        tipoDocumento:     payload.tipoDocumento,
        fechaRadicado:     ahora.toISOString(),
        horaRadicado:      ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        medioRecepcion:    payload.medioRecepcion,
        tipoTramite:       tipoConf.nombre,
        diasRespuesta:     tipoConf.diasRespuesta,
        unidad:            tipoConf.unidad,
        asunto:            payload.asunto,
        fechaVencimiento:  payload.fechaVencimiento,
        numeroFolios:      payload.numeroFolios,
      });
      setRadicadoGenerado(radicadoId);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : 'Error al guardar el radicado.');
      setProgreso('');
      setProgresoPct(0);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onCerrar} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-[#0D1117] border-l border-white/10 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
          <div>
            <h2 className="text-base font-black text-slate-100">Radicación Rápida</h2>
            <p className="text-xs text-slate-500">Nuevo radicado institucional · Ventanilla Única</p>
          </div>
          <button onClick={onCerrar}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* ── Estado de éxito ── */}
          {radicadoGenerado && datosComprobante && (
            <div className="flex flex-col items-center gap-6 py-8">
              {/* Confirmación visual */}
              <div className="text-center">
                <div className="inline-flex w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Radicado registrado</p>
                <p className="text-2xl font-black font-mono text-indigo-300">{radicadoGenerado}</p>
                <p className="text-xs text-slate-500 mt-1">Informe este número al ciudadano para seguimiento.</p>
              </div>

              {/* Comprobante imprimible */}
              <ComprobanteRadicado
                radicadoId={radicadoGenerado}
                solicitanteNombre={datosComprobante.solicitanteNombre}
                numeroDocumento={datosComprobante.numeroDocumento}
                tipoDocumento={datosComprobante.tipoDocumento}
                fechaRadicado={datosComprobante.fechaRadicado}
                horaRadicado={datosComprobante.horaRadicado}
                medioRecepcion={datosComprobante.medioRecepcion}
                tipoTramite={datosComprobante.tipoTramite}
                diasRespuesta={datosComprobante.diasRespuesta}
                unidad={datosComprobante.unidad}
                asunto={datosComprobante.asunto}
                fechaVencimiento={datosComprobante.fechaVencimiento}
                funcionarioNombre={usuario.nombre}
                dependencia={usuario.tenantId}
                numeroFolios={datosComprobante.numeroFolios}
              />

              {/* Acciones */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRadicadoGenerado(null);
                    setDatosComprobante(null);
                    setProgreso('');
                    setProgresoPct(0);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  Radicar otro
                </button>
                <button
                  onClick={onCerrar}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-white/20 active:scale-95 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* ── Barra de progreso ── */}
          {!radicadoGenerado && progreso && (
            <div className="mb-5 p-4 bg-slate-800/40 border border-white/10 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">{progreso}</span>
                <span className="text-xs font-bold text-indigo-400 tabular-nums">{progresoPct}%</span>
              </div>
              <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progresoPct}%` }} />
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {errorGuardado && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {errorGuardado}
            </div>
          )}

          {/* ── Formulario ── */}
          {!radicadoGenerado && (
            <RadicacionFuncionarioForm
              radicadoPreview="Se generará al radicar"
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   VISTA: Reportes MIPG (placeholder)
══════════════════════════════════════════════════════════════ */

function VistaReportes({ metricas, total }: { metricas: MetricasMIPGData; total: number }) {
  const items = [
    { label: 'Total radicados',        valor: total,                    color: 'text-slate-200' },
    { label: 'Tasa resolución (%)',    valor: total > 0 ? Math.round(((total - metricas.radicadas - metricas.asignadas) / total) * 100) : 0, color: 'text-emerald-300' },
    { label: 'Radicadas (pendientes)', valor: metricas.radicadas,        color: 'text-indigo-300' },
    { label: 'Prioridad MIPG activos', valor: metricas.prioridadMIPG,   color: 'text-red-300'   },
    { label: 'En trámite (asignadas)', valor: metricas.asignadas,        color: 'text-sky-300'   },
    { label: 'Por vencer (≤ 2 días)',  valor: metricas.porVencer,        color: 'text-orange-300'},
    { label: 'Vencidas sin respuesta', valor: metricas.vencidas,         color: 'text-rose-300'  },
    { label: 'Devueltas / Prórroga',   valor: metricas.devueltasProrroga,color: 'text-amber-300' },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">MIPG · Rendición de Cuentas</p>
      <h2 className="text-xl font-black text-slate-50 mb-6">Indicadores de Eficiencia</h2>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.label} className="bg-slate-900/40 border border-white/[0.07] rounded-xl p-5">
            <p className={`text-3xl font-black tabular-nums ${item.color}`}>{item.valor}</p>
            <p className="text-xs text-slate-500 mt-2 leading-tight">{item.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-700 mt-6">
        Los datos se calculan en tiempo real sobre la colección <span className="font-mono">ventanilla_radicados</span>.
        Exportación a Excel y PDF disponible próximamente.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: BandejaAsignacion
══════════════════════════════════════════════════════════════ */

function BandejaAsignacion({
  radicados,
  cargando,
  error,
  usuario,
}: {
  radicados: VentanillaRadicado[];
  cargando: boolean;
  error: string | null;
  usuario: UsuarioAutenticado;
}) {
  const { state, dispatch } = useVentanilla();
  const { seleccionMasiva, tenantMasivo } = state;

  const [tenantPorFila,   setTenantPorFila]   = useState<Record<string, TenantId>>({});
  const [asignandoFila,   setAsignandoFila]   = useState<Record<string, boolean>>({});
  const [exitoFila,       setExitoFila]       = useState<Record<string, boolean>>({});
  const [asignandoMasivo, setAsignandoMasivo] = useState(false);
  const [resultadoMasivo, setResultadoMasivo] = useState<string | null>(null);

  const todosIds = radicados.map((r) => r.radicadoId);
  const todosSeleccionados =
    todosIds.length > 0 && todosIds.every((id) => seleccionMasiva.has(id));

  function getTenantFila(id: string): TenantId {
    return tenantPorFila[id] ?? 'DESPACHO_ALCALDE';
  }

  async function asignarUno(r: VentanillaRadicado) {
    const tenant = getTenantFila(r.radicadoId);
    setAsignandoFila((p) => ({ ...p, [r.radicadoId]: true }));
    try {
      await asignarRadicado(r.radicadoId, tenant, { uid: usuario.uid, nombre: usuario.nombre });
      setExitoFila((p) => ({ ...p, [r.radicadoId]: true }));
      setTimeout(() => setExitoFila((p) => ({ ...p, [r.radicadoId]: false })), 3000);
    } finally {
      setAsignandoFila((p) => ({ ...p, [r.radicadoId]: false }));
    }
  }

  async function asignarSeleccionados() {
    if (!tenantMasivo || seleccionMasiva.size === 0) return;
    setAsignandoMasivo(true);
    setResultadoMasivo(null);
    try {
      const { asignados, fallidos } = await asignarMasivo(
        Array.from(seleccionMasiva),
        tenantMasivo as TenantId,
        { uid: usuario.uid, nombre: usuario.nombre },
      );
      dispatch({ type: 'LIMPIAR_SELECCION' });
      setResultadoMasivo(
        `${asignados} asignado${asignados !== 1 ? 's' : ''}` +
          (fallidos > 0 ? ` · ${fallidos} fallido${fallidos !== 1 ? 's' : ''}` : ''),
      );
    } finally {
      setAsignandoMasivo(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.07] shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-200">Bandeja de Asignación</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
            {radicados.length} pendiente{radicados.length !== 1 ? 's' : ''}
          </span>
        </div>
        {seleccionMasiva.size > 0 && (
          <button
            onClick={() => dispatch({ type: 'LIMPIAR_SELECCION' })}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Limpiar selección ({seleccionMasiva.size})
          </button>
        )}
      </div>

      {/* Barra de asignación masiva */}
      {seleccionMasiva.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-500/5 border-b border-indigo-500/20 shrink-0">
          <span className="text-xs font-bold text-indigo-300 shrink-0">
            {seleccionMasiva.size} seleccionado{seleccionMasiva.size !== 1 ? 's' : ''}
          </span>
          <select
            value={tenantMasivo}
            onChange={(e) =>
              dispatch({ type: 'SET_TENANT_MASIVO', tenant: e.target.value as TenantId | '' })
            }
            className="select-internal flex-1 text-xs"
          >
            <option value="">— Selecciona dependencia destino —</option>
            {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
              <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
            ))}
          </select>
          <button
            onClick={asignarSeleccionados}
            disabled={!tenantMasivo || asignandoMasivo}
            className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            {asignandoMasivo && (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Asignar {seleccionMasiva.size}
          </button>
        </div>
      )}

      {/* Feedback masivo */}
      {resultadoMasivo && (
        <div className="mx-4 mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 shrink-0">
          {resultadoMasivo}
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 shrink-0">
          Error de conexión: {error}
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm">
            <tr className="border-b border-white/[0.07]">
              <th className="px-4 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={() =>
                    dispatch({ type: 'SELECCIONAR_TODOS', radicadoIds: todosIds })
                  }
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-0 cursor-pointer"
                />
              </th>
              {['Radicado', 'Solicitante', 'Tipo', 'Días', 'Dependencia destino', 'Acción'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-white/[0.05]">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 rounded bg-slate-800/80" style={{ width: `${40 + (j % 3) * 20}%` }} />
                    </td>
                  ))}
                </tr>
              ))}

            {!cargando && radicados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <p className="text-slate-400 font-medium mb-1">Sin pendientes</p>
                  <p className="text-xs text-slate-600">No hay radicados esperando asignación.</p>
                </td>
              </tr>
            )}

            {!cargando &&
              radicados.map((r) => {
                const dias       = calcDiasRestantes(r);
                const seleccionado = seleccionMasiva.has(r.radicadoId);
                const esRojo     = r.prioridad === 'ROJO';
                const ok         = exitoFila[r.radicadoId];

                return (
                  <tr
                    key={r.radicadoId}
                    className={`border-b border-white/[0.04] transition-colors ${
                      seleccionado ? 'bg-indigo-500/5' : 'hover:bg-white/[0.025]'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() =>
                          dispatch({ type: 'TOGGLE_SELECCION', radicadoId: r.radicadoId })
                        }
                        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Radicado */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {esRojo && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                        )}
                        <span className="font-mono text-xs text-indigo-300">{r.radicadoId}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">{fmtFecha(r.control.fechaRadicado)}</p>
                    </td>

                    {/* Solicitante */}
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-xs font-medium text-slate-200 truncate">{r.solicitante.nombreCompleto}</p>
                      <p className="text-[10px] text-slate-600 font-mono">
                        {r.solicitante.tipoDocumento} {r.solicitante.numeroDocumento}
                      </p>
                    </td>

                    {/* Tipo */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-slate-400">{r.termino.tipoSolicitudNombre}</p>
                      <p className="text-[10px] text-slate-600">{r.termino.diasRespuesta}d</p>
                    </td>

                    {/* Días restantes */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-sm font-bold tabular-nums ${
                        dias < 0 ? 'text-rose-400' : dias <= 2 ? 'text-orange-400' : 'text-slate-400'
                      }`}>
                        {dias < 0 ? `${Math.abs(dias)}d venc.` : `${dias}d`}
                      </span>
                    </td>

                    {/* Select destino */}
                    <td className="px-4 py-3">
                      <select
                        value={getTenantFila(r.radicadoId)}
                        onChange={(e) =>
                          setTenantPorFila((p) => ({
                            ...p,
                            [r.radicadoId]: e.target.value as TenantId,
                          }))
                        }
                        className="select-internal text-[11px] min-w-[150px]"
                      >
                        {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
                          <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
                        ))}
                      </select>
                    </td>

                    {/* Botón */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ok ? (
                        <span className="text-xs text-emerald-400 font-bold">✓ Asignado</span>
                      ) : (
                        <button
                          onClick={() => asignarUno(r)}
                          disabled={!!asignandoFila[r.radicadoId]}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-xs font-bold transition-all duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                        >
                          {asignandoFila[r.radicadoId] ? (
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            'Asignar →'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE INTERNO PRINCIPAL (dentro del Provider)
══════════════════════════════════════════════════════════════ */

function DashboardInterior({ usuario, cerrarSesion }: { usuario: UsuarioAutenticado; cerrarSesion: () => Promise<void> }) {
  const { state, dispatch } = useVentanilla();
  const {
    radicadoSeleccionado,
    panelDerechoAbierto,
    drawerNuevoAbierto,
    filtroMIPG,
    busqueda,
    tenantFiltro,
    vistaActual,
  } = state;

  const esAdmin = usuario.rol === 'ADMIN';

  const { radicados: todosLosRadicados, cargando, error } =
    useVentanillaRadicados(usuario, tenantFiltro);

  /* Sincronizar radicado seleccionado con datos en tiempo real */
  useEffect(() => {
    if (todosLosRadicados.length > 0) {
      dispatch({ type: 'SYNC_RADICADO_SELECCIONADO', radicados: todosLosRadicados });
    }
  }, [todosLosRadicados, dispatch]);

  const metricas = useMemo(() => calcularMetricas(todosLosRadicados), [todosLosRadicados]);

  const radicadosFiltrados = useMemo(
    () => aplicarFiltroMIPG(todosLosRadicados, filtroMIPG, busqueda),
    [todosLosRadicados, filtroMIPG, busqueda],
  );

  const radicadosPendientes = useMemo(
    () => todosLosRadicados.filter((r) => r.estadoActual === 'PENDIENTE'),
    [todosLosRadicados],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0B]">
      {/* ── COLUMNA 1: Sidebar de navegación ── */}
      <SidebarNav
        vistaActual={vistaActual}
        onVistaChange={(v) => dispatch({ type: 'SET_VISTA', vista: v })}
        onNuevoRadicado={() => dispatch({ type: 'TOGGLE_DRAWER_NUEVO' })}
        usuario={usuario}
        onCerrarSesion={cerrarSesion}
        pendientesBandeja={radicadosPendientes.length}
      />

      {/* ── COLUMNA 2: Cuerpo central ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {vistaActual === 'REPORTES' ? (
          <VistaReportes metricas={metricas} total={todosLosRadicados.length} />
        ) : vistaActual === 'BANDEJA' ? (
          <BandejaAsignacion
            radicados={radicadosPendientes}
            cargando={cargando}
            error={error}
            usuario={usuario}
          />
        ) : vistaActual === 'DEPENDENCIAS' ? (
          <PanelCargaDependencias radicados={todosLosRadicados} />
        ) : (
          <>
            {/* Fila de métricas MIPG */}
            <TarjetasMIPG
              metricas={metricas}
              filtroActivo={filtroMIPG}
              onFiltroChange={(f) => dispatch({ type: 'SET_FILTRO_MIPG', filtro: f })}
              esAdmin={esAdmin}
              tenantFiltro={tenantFiltro}
              onTenantChange={(t) => dispatch({ type: 'SET_TENANT_FILTRO', tenant: t })}
            />

            {/* Tabla maestra */}
            <TablaRadicados
              radicados={radicadosFiltrados}
              cargando={cargando}
              error={error}
              busqueda={busqueda}
              onBusquedaChange={(v) => dispatch({ type: 'SET_BUSQUEDA', busqueda: v })}
              radicadoSeleccionadoId={radicadoSeleccionado?.radicadoId ?? null}
              onSeleccionar={(r) => dispatch({ type: 'SELECCIONAR_RADICADO', radicado: r })}
              onNuevoRadicado={() => dispatch({ type: 'TOGGLE_DRAWER_NUEVO' })}
            />
          </>
        )}
      </div>

      {/* ── COLUMNA 3: Panel derecho — oculto en BANDEJA y DEPENDENCIAS ── */}
      {vistaActual !== 'BANDEJA' && vistaActual !== 'DEPENDENCIAS' && (
        <div
          className={`shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            panelDerechoAbierto ? 'w-[420px]' : 'w-0'
          }`}
        >
          {radicadoSeleccionado && (
            <PanelDerecho
              radicado={radicadoSeleccionado}
              usuario={usuario}
              onCerrar={() => dispatch({ type: 'CERRAR_PANEL_DERECHO' })}
            />
          )}
        </div>
      )}

      {/* ── Drawer de radicación rápida ── */}
      {drawerNuevoAbierto && (
        <DrawerNuevoRadicado
          usuario={usuario}
          onCerrar={() => dispatch({ type: 'CERRAR_DRAWER_NUEVO' })}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE EXPORT
══════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { usuario, cargando: cargandoAuth, cerrarSesion } = useAuth();

  if (cargandoAuth) return <CargandoSesion />;
  if (!usuario)     return <FormLogin />;

  return (
    <VentanillaProvider>
      <DashboardInterior usuario={usuario} cerrarSesion={cerrarSesion} />
    </VentanillaProvider>
  );
}
