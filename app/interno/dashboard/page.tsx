'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { signInWithEmailAndPassword }    from 'firebase/auth';
import { getFirebaseAuth }              from '@/lib/firebase';
import { useAuth }                       from '@/lib/hooks/useAuth';
import { useRadicados }                  from '@/lib/hooks/useRadicados';
import { ModalRadicado }                 from './components/ModalRadicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type {
  EstadoRadicado,
  Prioridad,
  Radicado,
  TenantId,
} from '@/src/types/radicado';

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */

// NOMBRES_TENANT imported from @/src/types/reglas-negocio — single source of truth

const TODOS_LOS_TENANTS = Object.keys(NOMBRES_TENANT) as TenantId[];

const COLORES_ESTADO: Record<EstadoRadicado, { bg: string; text: string; border: string; dot: string }> = {
  PENDIENTE:   { bg: 'bg-indigo-500/20', text: 'text-indigo-300',  border: 'border-indigo-500/30',  dot: 'bg-indigo-400'  },
  EN_REVISION: { bg: 'bg-amber-500/20',  text: 'text-amber-300',   border: 'border-amber-500/30',   dot: 'bg-amber-400'   },
  EN_PROCESO:  { bg: 'bg-blue-500/20',   text: 'text-blue-300',    border: 'border-blue-500/30',    dot: 'bg-blue-400'    },
  RESUELTO:    { bg: 'bg-emerald-500/20',text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  DEVUELTO:    { bg: 'bg-rose-500/20',   text: 'text-rose-300',    border: 'border-rose-500/30',    dot: 'bg-rose-400'    },
  RECHAZADO:   { bg: 'bg-slate-500/20',  text: 'text-slate-300',   border: 'border-slate-500/30',   dot: 'bg-slate-400'   },
};

const LABELS_ESTADO: Record<EstadoRadicado, string> = {
  PENDIENTE:   'Pendiente',
  EN_REVISION: 'En revisión',
  EN_PROCESO:  'En proceso',
  RESUELTO:    'Resuelto',
  DEVUELTO:    'Devuelto',
  RECHAZADO:   'Rechazado',
};

const LABELS_PRIORIDAD: Record<Prioridad, string> = {
  ROJO:     'Alta',
  NARANJA:  'Media',
  AMARILLO: 'Baja',
};

type EstadoFiltro    = EstadoRadicado | 'TODOS';
type PrioridadFiltro = Prioridad      | 'TODAS';

interface FiltrosUI {
  estado:       EstadoFiltro;
  prioridad:    PrioridadFiltro;
  tenantFiltro: TenantId | 'TODOS';
  busqueda:     string;
}

const FILTROS_INICIAL: FiltrosUI = {
  estado:       'TODOS',
  prioridad:    'TODAS',
  tenantFiltro: 'TODOS',
  busqueda:     '',
};

interface EstadisticasRadicados {
  total:      number;
  pendientes: number;
  enRevision: number;
  enProceso:  number;
  resueltos:  number;
  devueltos:  number;
}

/* ══════════════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════════ */

function tiempoRelativo(fechaISO: string): string {
  const diff = Date.now() - new Date(fechaISO).getTime();
  const min  = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const dias = Math.floor(diff / 86_400_000);

  if (min  <  1)  return 'Ahora mismo';
  if (min  < 60)  return `Hace ${min} min`;
  if (hrs  < 24)  return `Hace ${hrs} h`;
  if (dias < 30)  return `Hace ${dias} días`;
  return new Date(fechaISO).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Skeleton Card ── */
function SkeletonCard() {
  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-slate-700" />
          <div className="h-3 w-28 rounded bg-slate-700" />
        </div>
        <div className="h-3 w-36 rounded bg-slate-700" />
      </div>
      <div className="h-4 w-48 rounded bg-slate-700 mb-2" />
      <div className="h-3 w-full rounded bg-slate-800 mb-1" />
      <div className="h-3 w-3/4 rounded bg-slate-800 mb-4" />
      <div className="flex gap-2">
        <div className="h-6 w-12 rounded-full bg-slate-700" />
        <div className="h-6 w-16 rounded-full bg-slate-700" />
        <div className="h-6 w-20 rounded-full bg-slate-700" />
      </div>
    </div>
  );
}

/* ── Tarjeta Radicado ── */
function TarjetaRadicado({
  radicado,
  esAdmin,
  onOpen,
}: {
  radicado: Radicado;
  esAdmin:  boolean;
  onOpen:   (r: Radicado) => void;
}) {
  const estado    = COLORES_ESTADO[radicado.estadoActual] ?? COLORES_ESTADO.PENDIENTE;
  const esRojo    = radicado.prioridad === 'ROJO';
  const esNaranja = radicado.prioridad === 'NARANJA';

  const dotColor = esRojo
    ? 'bg-red-500 shadow-lg shadow-red-500/50'
    : esNaranja
      ? 'bg-orange-500 shadow-lg shadow-orange-500/50'
      : 'bg-yellow-500 shadow-lg shadow-yellow-500/50';

  const ia = radicado.clasificacionIA;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(radicado)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(radicado)}
      className="
        bg-slate-900/40 backdrop-blur-[25px] border border-white/10 rounded-2xl p-6
        hover:border-white/20 hover:bg-slate-900/55 hover:-translate-y-0.5
        transition-all duration-300 cursor-pointer outline-none
        focus-visible:ring-2 focus-visible:ring-indigo-500/50
      "
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Priority dot */}
          <span
            className={`shrink-0 w-3 h-3 rounded-full ${dotColor} ${esRojo ? 'animate-pulse' : ''}`}
            title={`Prioridad ${LABELS_PRIORIDAD[radicado.prioridad]}`}
          />
          {/* Citizen name */}
          <span className="text-base font-medium text-slate-50 truncate">
            {radicado.ciudadano.nombre}
          </span>
        </div>
        {/* Radicado ID */}
        <span className="shrink-0 text-xs font-mono text-slate-500 tabular-nums">
          {radicado.radicadoId}
        </span>
      </div>

      {/* Case summary */}
      {ia && (
        <p className="text-sm text-slate-400 line-clamp-2 mb-4 leading-relaxed">
          {ia.resumenCaso}
        </p>
      )}
      {!ia && (
        <p className="text-sm text-slate-600 italic mb-4">
          Clasificación IA pendiente…
        </p>
      )}

      {/* Info badges row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Origin */}
        <span className={`
          px-2 py-0.5 rounded-full text-xs font-medium
          ${radicado.origen === 'WEB'
            ? 'bg-blue-500/20 text-blue-300'
            : 'bg-teal-500/20 text-teal-300'}
        `}>
          {radicado.origen === 'WEB' ? 'WEB' : 'FÍSICO'}
        </span>

        {/* Zone */}
        {ia && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300">
            {ia.zonaGeografica === 'CASCO_URBANO'
              ? '📍 Urbano'
              : ia.zonaGeografica === 'ZONA_YARIGUIES'
                ? '🌿 Yariguíes'
                : '🏔 Rural'}
          </span>
        )}

        {/* Relative time */}
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400">
          {tiempoRelativo(radicado.fechaCreacion)}
        </span>
      </div>

      {/* Footer: state badge + destination (admin only) */}
      <div className="flex items-center justify-between gap-3">
        <span className={`
          px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border
          ${estado.bg} ${estado.text} ${estado.border}
        `}>
          {LABELS_ESTADO[radicado.estadoActual]}
        </span>

        {esAdmin && ia && (
          <span className="text-xs text-slate-500 truncate">
            → {NOMBRES_TENANT[ia.oficinaDestino]}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Barra de Stats ── */
interface StatItem {
  label:  string;
  count:  number;
  estado: EstadoFiltro;
  borderColor: string;
}

function BarraStats({
  stats,
  filtroActivo,
  onFiltroClick,
}: {
  stats:        EstadisticasRadicados;
  filtroActivo: EstadoFiltro;
  onFiltroClick:(e: EstadoFiltro) => void;
}) {
  const items: StatItem[] = [
    { label: 'Total',       count: stats.total,      estado: 'TODOS',       borderColor: 'border-slate-500' },
    { label: 'Pendientes',  count: stats.pendientes, estado: 'PENDIENTE',   borderColor: 'border-indigo-500' },
    { label: 'En revisión', count: stats.enRevision, estado: 'EN_REVISION', borderColor: 'border-amber-500' },
    { label: 'En proceso',  count: stats.enProceso,  estado: 'EN_PROCESO',  borderColor: 'border-blue-500' },
    { label: 'Resueltos',   count: stats.resueltos,  estado: 'RESUELTO',    borderColor: 'border-emerald-500' },
    { label: 'Devueltos',   count: stats.devueltos,  estado: 'DEVUELTO',    borderColor: 'border-rose-500' },
  ];

  return (
    <div className="px-4 py-3 border-b border-white/10 bg-slate-900/20">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {items.map((item) => {
          const activo = filtroActivo === item.estado;
          return (
            <button
              key={item.estado}
              onClick={() => onFiltroClick(item.estado)}
              className={`
                shrink-0 flex flex-col items-start
                bg-slate-900/40 backdrop-blur-[15px] border rounded-xl px-4 py-3
                transition-all duration-200 cursor-pointer
                border-l-4 ${item.borderColor}
                ${activo
                  ? 'border-t border-r border-b border-white/20 bg-slate-800/60'
                  : 'border-t border-r border-b border-white/10 hover:border-white/20 hover:bg-slate-900/60'}
              `}
            >
              <span className="text-2xl font-black tracking-tighter leading-none text-slate-50" style={{ fontFamily: 'var(--font-manrope)' }}>
                {item.count}
              </span>
              <span className="text-xs uppercase tracking-widest text-slate-400 mt-0.5">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Radio button styled ── */
function RadioOption({
  name, value, current, label, dotClass, onChange,
}: {
  name: string; value: string; current: string; label: string; dotClass?: string;
  onChange: (v: string) => void;
}) {
  const checked = current === value;
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="radio" name={name} value={value} checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span className={`
        w-4 h-4 rounded-full border flex items-center justify-center transition-all
        ${checked
          ? 'border-indigo-500 bg-indigo-500/20'
          : 'border-slate-600 group-hover:border-slate-400'}
      `}>
        {checked && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
      </span>
      <span className="flex items-center gap-1.5 text-sm text-slate-300 group-hover:text-slate-100 transition-colors">
        {dotClass && <span className={`w-2 h-2 rounded-full ${dotClass}`} />}
        {label}
      </span>
    </label>
  );
}

/* ── Sidebar de Filtros ── */
function SidebarFiltros({
  filtros,
  esAdmin,
  onFiltroChange,
  visible,
  onClose,
}: {
  filtros:        FiltrosUI;
  esAdmin:        boolean;
  onFiltroChange: (partial: Partial<FiltrosUI>) => void;
  visible:        boolean;
  onClose:        () => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {visible && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60
        bg-slate-950/95 backdrop-blur-xl border-r border-white/10
        flex flex-col gap-6 p-5 overflow-y-auto
        transition-transform duration-300
        ${visible ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:z-auto lg:shrink-0
      `}>
        {/* Close button (mobile only) */}
        <div className="flex items-center justify-between lg:hidden">
          <span className="text-xs font-label text-slate-400 uppercase tracking-widest">Filtros</span>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-100 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div>
          <p className="text-xs font-label text-slate-500 uppercase tracking-widest mb-2">Buscar</p>
          <input
            type="search"
            value={filtros.busqueda}
            onChange={(e) => onFiltroChange({ busqueda: e.target.value })}
            placeholder="Nombre o ID…"
            className="
              w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2
              text-sm text-slate-100 placeholder-slate-600
              focus:outline-none focus:border-indigo-500/60 focus:bg-white/8
              transition-colors
            "
          />
        </div>

        {/* Estado */}
        <div>
          <p className="text-xs font-label text-slate-500 uppercase tracking-widest mb-3">Estado</p>
          <div className="flex flex-col gap-2.5">
            <RadioOption name="estado" value="TODOS"       current={filtros.estado} label="Todos"        onChange={(v) => onFiltroChange({ estado: v as EstadoFiltro })} />
            <RadioOption name="estado" value="PENDIENTE"   current={filtros.estado} label="Pendiente"    dotClass="bg-indigo-400"  onChange={(v) => onFiltroChange({ estado: v as EstadoFiltro })} />
            <RadioOption name="estado" value="EN_REVISION" current={filtros.estado} label="En revisión"  dotClass="bg-amber-400"   onChange={(v) => onFiltroChange({ estado: v as EstadoFiltro })} />
            <RadioOption name="estado" value="EN_PROCESO"  current={filtros.estado} label="En proceso"   dotClass="bg-blue-400"    onChange={(v) => onFiltroChange({ estado: v as EstadoFiltro })} />
            <RadioOption name="estado" value="RESUELTO"    current={filtros.estado} label="Resuelto"     dotClass="bg-emerald-400" onChange={(v) => onFiltroChange({ estado: v as EstadoFiltro })} />
            <RadioOption name="estado" value="DEVUELTO"    current={filtros.estado} label="Devuelto"     dotClass="bg-rose-400"    onChange={(v) => onFiltroChange({ estado: v as EstadoFiltro })} />
          </div>
        </div>

        {/* Prioridad */}
        <div>
          <p className="text-xs font-label text-slate-500 uppercase tracking-widest mb-3">Prioridad</p>
          <div className="flex flex-col gap-2.5">
            <RadioOption name="prioridad" value="TODAS"    current={filtros.prioridad} label="Todas"   onChange={(v) => onFiltroChange({ prioridad: v as PrioridadFiltro })} />
            <RadioOption name="prioridad" value="ROJO"     current={filtros.prioridad} label="Alta"    dotClass="bg-red-500"    onChange={(v) => onFiltroChange({ prioridad: v as PrioridadFiltro })} />
            <RadioOption name="prioridad" value="NARANJA"  current={filtros.prioridad} label="Media"   dotClass="bg-orange-500" onChange={(v) => onFiltroChange({ prioridad: v as PrioridadFiltro })} />
            <RadioOption name="prioridad" value="AMARILLO" current={filtros.prioridad} label="Baja"    dotClass="bg-yellow-500" onChange={(v) => onFiltroChange({ prioridad: v as PrioridadFiltro })} />
          </div>
        </div>

        {/* Dependencia (admin only) */}
        {esAdmin && (
          <div>
            <p className="text-xs font-label text-slate-500 uppercase tracking-widest mb-2">Dependencia</p>
            <select
              value={filtros.tenantFiltro}
              onChange={(e) => onFiltroChange({ tenantFiltro: e.target.value as TenantId | 'TODOS' })}
              className="
                w-full bg-slate-800/80 border border-white/10 rounded-lg px-3 py-2
                text-sm text-slate-200
                focus:outline-none focus:border-indigo-500/60
                transition-colors cursor-pointer
              "
            >
              <option value="TODOS">Todas las dependencias</option>
              {TODOS_LOS_TENANTS.map((t) => (
                <option key={t} value={t}>{NOMBRES_TENANT[t]}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reset */}
        <button
          onClick={() => onFiltroChange(FILTROS_INICIAL)}
          className="mt-auto text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          Limpiar filtros
        </button>
      </aside>
    </>
  );
}

/* ── Estado vacío ── */
function EstadoVacio({ esPrimero }: { esPrimero: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <svg className="w-16 h-16 text-slate-700 mb-5" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.5}>
        <rect x="8" y="16" width="48" height="36" rx="4" />
        <path d="M20 28h24M20 36h16" strokeLinecap="round" />
        <path d="M8 24h48" strokeLinecap="round" />
      </svg>
      <p className="text-slate-300 font-medium mb-1">
        {esPrimero
          ? 'Tu bandeja está vacía'
          : 'Sin resultados para los filtros aplicados'}
      </p>
      <p className="text-sm text-slate-600 max-w-xs">
        {esPrimero
          ? 'Los nuevos radicados aparecerán aquí en tiempo real.'
          : 'Intenta con otros filtros o limpia la búsqueda.'}
      </p>
    </div>
  );
}

/* ── Banner de error ── */
function ErrorBanner({ mensaje }: { mensaje: string }) {
  const esIndice = mensaje.includes('console.firebase.google.com');
  const link     = mensaje.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
  const texto    = link ? mensaje.replace(link, '').trim() : mensaje;

  return (
    <div className="mx-4 mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
      <p className="font-medium mb-1">{esIndice ? 'Índice de Firestore requerido' : 'Error de conexión'}</p>
      <p className="text-rose-400 text-xs">{texto}</p>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-xs text-indigo-400 underline hover:text-indigo-300"
        >
          Crear índice en Firebase Console →
        </a>
      )}
    </div>
  );
}

/* ── Login form ── */
function FormLogin() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="min-h-screen bg-obsidian-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 mb-4">
            <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-50" style={{ fontFamily: 'var(--font-manrope)' }}>
            Panel de Gestión
          </h1>
          <p className="text-sm text-slate-500 mt-1">Alcaldía de Simacota · Ventanilla Única</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="glass-card p-8 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-label text-slate-400 uppercase tracking-widest">
              Correo institucional
            </label>
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
            <label className="text-xs font-label text-slate-400 uppercase tracking-widest">
              Contraseña
            </label>
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-1"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-smooth" />
                Ingresando…
              </>
            ) : (
              'Ingresar al Panel'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Full-page loading ── */
function CargandoSesion() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin-smooth" />
        <span className="text-sm text-slate-500">Verificando sesión…</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { usuario, cargando: cargandoAuth, error: errorAuth, cerrarSesion } = useAuth();

  const [filtros,               setFiltros]               = useState<FiltrosUI>(FILTROS_INICIAL);
  const [sidebarAbierto,        setSidebarAbierto]        = useState(false);
  const [radicadoSeleccionado,  setRadicadoSeleccionado]  = useState<Radicado | null>(null);

  const { radicados: todosLosRadicados, cargando: cargandoRadicados, error: errorFirestore } =
    useRadicados(usuario, filtros.tenantFiltro);

  /* ── Sync open modal with live onSnapshot data ── */
  useEffect(() => {
    if (!radicadoSeleccionado) return;
    const actualizado = todosLosRadicados.find(
      (r) => r.radicadoId === radicadoSeleccionado.radicadoId
    );
    if (actualizado) setRadicadoSeleccionado(actualizado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosLosRadicados]);

  /* ── Client-side filtering ── */
  const radicadosFiltrados = useMemo(() => {
    let lista = todosLosRadicados;

    if (filtros.estado !== 'TODOS') {
      lista = lista.filter((r) => r.estadoActual === filtros.estado);
    }
    if (filtros.prioridad !== 'TODAS') {
      lista = lista.filter((r) => r.prioridad === filtros.prioridad);
    }
    if (filtros.busqueda.trim()) {
      const q = filtros.busqueda.toLowerCase().trim();
      lista = lista.filter(
        (r) =>
          r.radicadoId.toLowerCase().includes(q) ||
          r.ciudadano.nombre.toLowerCase().includes(q)
      );
    }

    // ROJO + PENDIENTE primero (urgentes al tope)
    return [...lista].sort((a, b) => {
      const urgA = a.prioridad === 'ROJO' && a.estadoActual === 'PENDIENTE' ? 0 : 1;
      const urgB = b.prioridad === 'ROJO' && b.estadoActual === 'PENDIENTE' ? 0 : 1;
      if (urgA !== urgB) return urgA - urgB;
      return new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime();
    });
  }, [todosLosRadicados, filtros.estado, filtros.prioridad, filtros.busqueda]);

  /* ── Stats from full dataset ── */
  const stats = useMemo<EstadisticasRadicados>(() => ({
    total:      todosLosRadicados.length,
    pendientes: todosLosRadicados.filter((r) => r.estadoActual === 'PENDIENTE').length,
    enRevision: todosLosRadicados.filter((r) => r.estadoActual === 'EN_REVISION').length,
    enProceso:  todosLosRadicados.filter((r) => r.estadoActual === 'EN_PROCESO').length,
    resueltos:  todosLosRadicados.filter((r) => r.estadoActual === 'RESUELTO').length,
    devueltos:  todosLosRadicados.filter((r) => r.estadoActual === 'DEVUELTO').length,
  }), [todosLosRadicados]);

  /* ── Auth states ── */
  if (cargandoAuth) return <CargandoSesion />;
  if (!usuario)     return <FormLogin />;

  const esAdmin = usuario.rol === 'ADMIN';
  const tituloDepedencia = esAdmin
    ? (filtros.tenantFiltro !== 'TODOS' ? NOMBRES_TENANT[filtros.tenantFiltro] : 'Vista General')
    : NOMBRES_TENANT[usuario.tenantId];

  const nombreRol = usuario.rol === 'ADMIN' ? 'ADMIN' : usuario.rol === 'RECEPCIONISTA' ? 'RECEPCIONISTA' : 'FUNCIONARIO';
  const badgeRol  = esAdmin
    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0B]">

      {/* Sidebar */}
      <SidebarFiltros
        filtros={filtros}
        esAdmin={esAdmin}
        onFiltroChange={(partial) => setFiltros((prev) => ({ ...prev, ...partial }))}
        visible={sidebarAbierto}
        onClose={() => setSidebarAbierto(false)}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Header ── */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 py-3 bg-slate-900/60 backdrop-blur-[20px] border-b border-white/10">
          {/* Left: hamburger (mobile) + brand */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
              onClick={() => setSidebarAbierto(true)}
              aria-label="Abrir filtros"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 leading-none mb-0.5">Alcaldía de Simacota</p>
              <h1 className="text-sm font-semibold text-slate-100 truncate" style={{ fontFamily: 'var(--font-manrope)' }}>
                {tituloDepedencia}
              </h1>
            </div>
          </div>

          {/* Center: panel label (hidden on small) */}
          <span className="hidden md:block text-xs font-label text-slate-600 uppercase tracking-widest">
            Panel de Gestión
          </span>

          {/* Right: user info */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex flex-col items-end leading-none gap-1">
              <span className="text-sm text-slate-200">{usuario.nombre}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeRol}`}>
                {nombreRol}
              </span>
            </div>
            <button
              onClick={cerrarSesion}
              title="Cerrar sesión"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </header>

        {/* Auth error banner */}
        {errorAuth && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
            {errorAuth}
          </div>
        )}

        {/* ── Stats bar ── */}
        <BarraStats
          stats={stats}
          filtroActivo={filtros.estado}
          onFiltroClick={(e) => setFiltros((prev) => ({ ...prev, estado: e }))}
        />

        {/* ── Feed ── */}
        <main className="flex-1 overflow-y-auto px-4 py-4">

          {/* Error from Firestore */}
          {errorFirestore && <ErrorBanner mensaje={errorFirestore} />}

          {/* Loading skeletons */}
          {cargandoRadicados && !errorFirestore && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Radicados */}
          {!cargandoRadicados && !errorFirestore && (
            radicadosFiltrados.length === 0
              ? <EstadoVacio esPrimero={todosLosRadicados.length === 0} />
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {radicadosFiltrados.map((r) => (
                    <TarjetaRadicado
                      key={r.radicadoId}
                      radicado={r}
                      esAdmin={esAdmin}
                      onOpen={setRadicadoSeleccionado}
                    />
                  ))}
                </div>
              )
          )}

          {/* Bottom padding for scroll breathing room */}
          <div className="h-8" />
        </main>
      </div>

      {/* ── Modal de detalle ── */}
      {radicadoSeleccionado && usuario && (
        <ModalRadicado
          radicado={radicadoSeleccionado}
          usuario={usuario}
          onCerrar={() => setRadicadoSeleccionado(null)}
        />
      )}
    </div>
  );
}
