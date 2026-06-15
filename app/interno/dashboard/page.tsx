'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
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
import { VistaAnalytics }                  from '@/app/interno/dashboard/components/analytics/VistaAnalytics';
import { VistaAlertas, contarAlertasActivas } from '@/app/interno/dashboard/components/analytics/VistaAlertas';
import { VistaSupervisionIA }              from '@/app/interno/dashboard/components/analytics/VistaSupervisionIA';
import { VistaAnticipacionOperativa }      from '@/app/interno/dashboard/components/analytics/VistaAnticipacionOperativa';
import type {
  FiltroMIPG,
  VistaActual,
}                                         from '@/lib/store/ventanillaStore';
import type { TenantId }                  from '@/src/types/radicado';
import { SemaforoTermino, calcularSemaforo } from '@/app/interno/dashboard/components/mipg/SemaforoTermino';
import { VistaAdministracion }                from '@/app/interno/dashboard/components/admin/VistaAdministracion';
import { PanelSimi }                         from '@/app/interno/dashboard/components/simi/PanelSimi';
import { PqrsdDeadlineDashboard }            from '@/app/interno/dashboard/components/simi/PqrsdDeadlineDashboard';
import { SimiGobernanzaPanel }              from '@/app/interno/dashboard/components/simi/SimiGobernanzaPanel';
import { JefeAprobacionesPanel }            from '@/app/interno/dashboard/components/simi/JefeAprobacionesPanel';
import { ControlInternoDashboard }          from '@/app/interno/dashboard/components/simi/ControlInternoDashboard';
import { InstitucionalHeader }               from '@/app/components/institucional/InstitucionalHeader';
import { SelloRadicado }                     from '@/app/components/institucional/SelloRadicado';
import { useFuncionariosTenant }              from '@/lib/hooks/useFuncionariosTenant';
import type { FuncionarioTenant }             from '@/lib/hooks/useFuncionariosTenant';
import type { ResponsableFuncionario }        from '@/lib/actions/asignarRadicado';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';
import type { UsuarioAutenticado }        from '@/lib/hooks/useAuth';
import { buildOficioInstitucional } from '@/lib/respuesta-oficial/oficio-institucional';

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
  PENDIENTE:   'bg-yellow-50  text-yellow-800 border-yellow-200',
  EN_REVISION: 'bg-blue-50    text-blue-800   border-blue-200',
  EN_PROCESO:  'bg-sky-50     text-sky-800    border-sky-200',
  ASIGNADO:    'bg-[#F5E8B7]  text-[#14532D]  border-[#D4A017]/40',
  RESUELTO:    'bg-green-50   text-green-800  border-green-200',
  DEVUELTO:    'bg-rose-50    text-rose-800   border-rose-200',
  RECHAZADO:   'bg-gray-100   text-gray-600   border-gray-200',
  POR_VENCER:  'bg-orange-50  text-orange-800 border-orange-200',
  VENCIDO:     'bg-red-50     text-red-800    border-red-200',
  PRORROGA:    'bg-amber-50   text-amber-800  border-amber-200',
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
  radicadas:              number;
  prioridadMIPG:          number;
  asignadas:              number;
  enTermino:              number;   // MIPG-3: activos con días > 2
  porVencer:              number;
  vencidas:               number;
  devueltasProrroga:      number;
  resueltosFueraTermino:  number;   // MIPG-3: cumplioTermino === false
}

function calcularMetricas(radicados: VentanillaRadicado[]): MetricasMIPGData {
  return radicados.reduce<MetricasMIPGData>(
    (acc, r) => {
      const dias   = calcDiasRestantes(r);
      const activo = estaActivo(r);

      if (r.estadoActual === 'PENDIENTE')                                         acc.radicadas              += 1;
      if (r.prioridad === 'ROJO' && activo)                                       acc.prioridadMIPG          += 1;
      if (['ASIGNADO', 'EN_REVISION', 'EN_PROCESO'].includes(r.estadoActual))     acc.asignadas              += 1;
      if (activo && dias > 2)                                                     acc.enTermino              += 1;
      if (activo && dias >= 0 && dias <= 2)                                       acc.porVencer              += 1;
      if (activo && dias < 0)                                                     acc.vencidas               += 1;
      if (['DEVUELTO', 'PRORROGA'].includes(r.estadoActual))                      acc.devueltasProrroga      += 1;
      if (r.cumplioTermino === false)                                             acc.resueltosFueraTermino  += 1;

      return acc;
    },
    { radicadas: 0, prioridadMIPG: 0, asignadas: 0, enTermino: 0, porVencer: 0, vencidas: 0, devueltasProrroga: 0, resueltosFueraTermino: 0 },
  );
}

function aplicarFiltroMIPG(
  radicados: VentanillaRadicado[],
  filtro: FiltroMIPG,
  busqueda: string,
): VentanillaRadicado[] {
  let lista = radicados;

  if (filtro === 'RADICADAS')                    lista = lista.filter((r) => r.estadoActual === 'PENDIENTE');
  else if (filtro === 'PRIORIDAD_MIPG')          lista = lista.filter((r) => r.prioridad === 'ROJO' && estaActivo(r));
  else if (filtro === 'ASIGNADAS')               lista = lista.filter((r) => ['ASIGNADO', 'EN_REVISION', 'EN_PROCESO'].includes(r.estadoActual));
  else if (filtro === 'EN_TERMINO')              lista = lista.filter((r) => estaActivo(r) && calcDiasRestantes(r) > 2);
  else if (filtro === 'POR_VENCER')              lista = lista.filter((r) => { const d = calcDiasRestantes(r); return estaActivo(r) && d >= 0 && d <= 2; });
  else if (filtro === 'VENCIDAS')                lista = lista.filter((r) => estaActivo(r) && calcDiasRestantes(r) < 0);
  else if (filtro === 'DEVUELTAS_PRORROGA')      lista = lista.filter((r) => ['DEVUELTO', 'PRORROGA'].includes(r.estadoActual));
  else if (filtro === 'RESUELTOS_FUERA_TERMINO') lista = lista.filter((r) => r.cumplioTermino === false);

  if (busqueda.trim()) {
    const q = busqueda.toLowerCase().trim();
    lista = lista.filter(
      (r) =>
        r.radicadoId.toLowerCase().includes(q) ||
        r.solicitante.nombreCompleto.toLowerCase().includes(q) ||
        r.solicitante.numeroDocumento.includes(q) ||
        r.detalle.asunto.toLowerCase().includes(q) ||
        NOMBRES_TENANT[r.clasificacion.oficinaDestino].toLowerCase().includes(q) ||
        (r.clasificacion.funcionarioResponsableNombre ?? '').toLowerCase().includes(q),
    );
  }

  return [...lista].sort((a, b) => {
    const urgA = a.prioridad === 'ROJO' && estaActivo(a) ? 0 : 1;
    const urgB = b.prioridad === 'ROJO' && estaActivo(b) ? 0 : 1;
    if (urgA !== urgB) return urgA - urgB;
    return new Date(b.control.fechaRadicado).getTime() - new Date(a.control.fechaRadicado).getTime();
  });
}

interface ResumenBandejaOperativa {
  totalActivos: number;
  sinResponsable: number;
  vencidos: number;
  porVencer: number;
  prioridadAlta: number;
  siguiente: VentanillaRadicado | null;
}

function calcularResumenBandeja(radicados: VentanillaRadicado[]): ResumenBandejaOperativa {
  const activos = radicados.filter(estaActivo);
  const priorizados = [...activos].sort((a, b) => {
    const diasA = calcDiasRestantes(a);
    const diasB = calcDiasRestantes(b);
    const scoreA =
      (diasA < 0 ? -1000 : diasA) +
      (a.prioridad === 'ROJO' ? -100 : 0) +
      (!a.clasificacion.funcionarioResponsableUid ? -20 : 0);
    const scoreB =
      (diasB < 0 ? -1000 : diasB) +
      (b.prioridad === 'ROJO' ? -100 : 0) +
      (!b.clasificacion.funcionarioResponsableUid ? -20 : 0);

    if (scoreA !== scoreB) return scoreA - scoreB;
    return new Date(a.control.fechaRadicado).getTime() - new Date(b.control.fechaRadicado).getTime();
  });

  return {
    totalActivos: activos.length,
    sinResponsable: activos.filter((r) => !r.clasificacion.funcionarioResponsableUid).length,
    vencidos: activos.filter((r) => calcDiasRestantes(r) < 0).length,
    porVencer: activos.filter((r) => {
      const dias = calcDiasRestantes(r);
      return dias >= 0 && dias <= 2;
    }).length,
    prioridadAlta: activos.filter((r) => r.prioridad === 'ROJO').length,
    siguiente: priorizados[0] ?? null,
  };
}

function mensajeSiguienteAccion(radicado: VentanillaRadicado | null): string {
  if (!radicado) return 'No hay casos activos en esta bandeja.';

  const dias = calcDiasRestantes(radicado);
  if (dias < 0) return `Atender de inmediato: vencido hace ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}.`;
  if (dias === 0) return 'Atender hoy: vence durante la jornada actual.';
  if (dias <= 2) return `Atender pronto: vence en ${dias} dia${dias !== 1 ? 's' : ''}.`;
  if (radicado.prioridad === 'ROJO') return 'Revisar primero: prioridad MIPG alta.';
  if (!radicado.clasificacion.funcionarioResponsableUid) return 'Asignar responsable funcional antes de iniciar gestion.';
  return 'Caso activo con termino vigente.';
}

function puedeRadicar(usuario: UsuarioAutenticado): boolean {
  return usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA';
}

function puedeUsarBandejaAsignacion(usuario: UsuarioAutenticado): boolean {
  return usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA';
}

function puedeVerDependencias(usuario: UsuarioAutenticado): boolean {
  return usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO';
}

function puedeVerAnaliticaAvanzada(usuario: UsuarioAutenticado): boolean {
  return usuario.rol === 'ADMIN'
    || usuario.rol === 'CONTROL_INTERNO'
    || usuario.rol === 'JEFE_DEPENDENCIA';
}

function puedeAccederVista(usuario: UsuarioAutenticado, vista: VistaActual): boolean {
  if (vista === 'ADMINISTRACION') return usuario.rol === 'ADMIN';
  if (vista === 'APROBACIONES') return usuario.rol === 'ADMIN' || usuario.rol === 'JEFE_DEPENDENCIA' || usuario.rol === 'CONTROL_INTERNO';
  if (vista === 'CONTROL_INTERNO') return usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO';
  if (vista === 'BANDEJA' || vista === 'VENTANILLA') return puedeUsarBandejaAsignacion(usuario);
  if (vista === 'DEPENDENCIAS') return puedeVerDependencias(usuario);
  if (vista === 'SUPERVISION_IA' || vista === 'ANTICIPACION_OPERATIVA') {
    return usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO';
  }
  if (vista === 'ANALYTICS' || vista === 'REPORTES') return puedeVerAnaliticaAvanzada(usuario);
  return true;
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
  // ── Fase 2: Inteligencia Operativa ─────────────────────────
  {
    vista: 'ANALYTICS' as const,
    label: 'Analítica',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
  {
    vista: 'ALERTAS' as const,
    label: 'Alertas',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
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
  pendientesAlertas,
  pendientesNotificacionFallida,
  className = '',
}: {
  vistaActual: VistaActual;
  onVistaChange: (v: VistaActual) => void;
  onNuevoRadicado: () => void;
  usuario: UsuarioAutenticado;
  onCerrarSesion: () => void;
  pendientesBandeja: number;
  pendientesAlertas: number;
  pendientesNotificacionFallida: number;
  className?: string;
}) {
  const LABEL_ROL: Record<string, string> = {
    ADMIN:             'Admin',
    RECEPCIONISTA:     'Recepción',
    FUNCIONARIO:       'Funcionario',
    JEFE_DEPENDENCIA:  'Jefe de Dependencia',
    CONTROL_INTERNO:   'Control Interno',
  };
  const nombreRol = LABEL_ROL[usuario.rol] ?? 'Funcionario';

  const items = NAV_ITEMS.filter((item) => puedeAccederVista(usuario, item.vista));
  // Control Interno tiene visibilidad total equivalente a Admin.
  if (usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO') {
    items.push({
      vista: 'ANTICIPACION_OPERATIVA' as const,
      label: 'Anticipación Operativa',
      icono: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    });
    items.push({
      vista: 'SUPERVISION_IA' as const,
      label: 'Supervisión IA',
      icono: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" />
        </svg>
      ),
    });
  }

  // Control Interno — ADMIN y CONTROL_INTERNO
  if (['ADMIN', 'CONTROL_INTERNO'].includes(usuario.rol)) {
    items.push({
      vista: 'CONTROL_INTERNO' as const,
      label: 'Control Interno',
      icono: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      ),
    });
  }

  // Cola de aprobaciones — Jefe, Control Interno y Admin
  if (['ADMIN', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO'].includes(usuario.rol)) {
    items.push({
      vista: 'APROBACIONES' as const,
      label: 'Aprobaciones',
      icono: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    });
  }

  // Administración — solo ADMIN real (no CONTROL_INTERNO)
  if (usuario.rol === 'ADMIN') {
    items.push({
      vista: 'ADMINISTRACION' as const,
      label: 'Administración',
      icono: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    });
  }

  return (
    <aside className={`h-full flex flex-col shrink-0 w-[250px] overflow-hidden ${className}`}
           style={{ background: '#14532D' }}>
      {/* Bloque institucional */}
      <div className="px-4 py-4 w-full overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
        <InstitucionalHeader variant="sidebar" subtitle="Ventanilla Única Digital" />
      </div>

      {/* Radicación Rápida */}
      {puedeRadicar(usuario) && (
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={onNuevoRadicado}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ background: '#D4A017', color: '#14532D', transition: 'filter 0.15s ease-out, transform 0.15s ease-out, box-shadow 0.15s ease-out', boxShadow: '0 2px 8px rgba(212,160,23,0.30)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(0.93)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 5px 14px rgba(212,160,23,0.40)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(212,160,23,0.30)'; }}
            onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Radicación Rápida
          </button>
        </div>
      )}

      {/* Alerta operativa: correos institucionales fallidos sin gestionar */}
      {pendientesNotificacionFallida > 0 && (
        <div className="px-3 pt-1 pb-2">
          <div
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold"
            style={{
              background: 'rgba(220,38,38,0.18)',
              color: '#fecaca',
              border: '1px solid rgba(248,113,113,0.35)',
            }}
            title="Radicados cuya notificación oficial por correo falló y aún no se ha gestionado por canal alternativo."
          >
            <svg className="w-3.5 h-3.5 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="flex-1 truncate">Correos fallidos</span>
            <span className="shrink-0 min-w-[20px] h-[18px] rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center px-1">
              {pendientesNotificacionFallida > 99 ? '99+' : pendientesNotificacionFallida}
            </span>
          </div>
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest px-2 py-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Módulos
        </p>
        {items.map(({ vista, label, icono }) => {
          const activo = vistaActual === vista;
          return (
            <button
              key={vista}
              onClick={() => onVistaChange(vista)}
              className="micro-sidebar-item w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
              style={activo ? {
                background: '#D4A017',
                color: '#14532D',
                boxShadow: '0 2px 8px rgba(212,160,23,0.30)',
              } : {
                color: 'rgba(255,255,255,0.75)',
              }}
              onMouseEnter={(e) => { if (!activo) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; } }}
              onMouseLeave={(e) => { if (!activo) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'; } }}
            >
              <span style={activo ? { color: '#14532D' } : { color: 'rgba(255,255,255,0.55)' }}>
                {icono}
              </span>
              <span className="text-xs font-medium flex-1">{label}</span>
              {vista === 'BANDEJA' && pendientesBandeja > 0 && (
                <span className="shrink-0 min-w-[18px] h-[18px] rounded-full text-white text-[9px] font-black flex items-center justify-center px-1"
                      style={{ background: '#166534' }}>
                  {pendientesBandeja > 99 ? '99+' : pendientesBandeja}
                </span>
              )}
              {vista === 'ALERTAS' && pendientesAlertas > 0 && (
                <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center px-1 animate-pulse">
                  {pendientesAlertas > 99 ? '99+' : pendientesAlertas}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="rounded-xl px-3 py-2.5 flex flex-col gap-2" style={{ background: 'rgba(0,0,0,0.20)' }}>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{usuario.nombre}</p>
            <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.50)' }}>{NOMBRES_TENANT[usuario.tenantId]}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border"
                  style={{ background: 'rgba(255,255,255,0.10)', color: '#F5E8B7', borderColor: 'rgba(255,255,255,0.20)' }}>
              {nombreRol}
            </span>
            <button
              onClick={onCerrarSesion}
              title="Cerrar sesión"
              className="p-1 rounded-lg transition-all duration-150 active:scale-90 focus-visible:outline-none"
              style={{ color: 'rgba(255,255,255,0.40)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#fca5a5'; (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.15)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.40)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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

function MobileTopBar({
  usuario,
  vistaActual,
  onAbrirMenu,
}: {
  usuario: UsuarioAutenticado;
  vistaActual: VistaActual;
  onAbrirMenu: () => void;
}) {
  const vista = NAV_ITEMS.find((item) => item.vista === vistaActual)?.label
    ?? (vistaActual === 'SUPERVISION_IA'
      ? 'Supervisión IA'
      : vistaActual === 'ANTICIPACION_OPERATIVA'
        ? 'Anticipación'
        : 'Panel interno');
  const rolCompacto: Record<string, string> = {
    ADMIN: 'Admin',
    RECEPCIONISTA: 'Recepción',
    FUNCIONARIO: 'Func.',
    JEFE_DEPENDENCIA: 'Jefe',
    CONTROL_INTERNO: 'Control',
  };

  return (
    <header className="md:hidden shrink-0 bg-white px-3 py-2.5" style={{ borderBottom: '1px solid #D9E2D9' }}>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onAbrirMenu}
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2"
          style={{ border: '1px solid #D9E2D9', color: '#14532D', background: '#EEF4EE' }}
          aria-label="Abrir menú"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: '#667085' }}>
            Alcaldía de Simacota
          </p>
          <p className="truncate text-sm font-black leading-tight" style={{ color: '#1F2933' }}>
            {vista}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border"
              style={{ background: '#EEF4EE', color: '#14532D', borderColor: '#D9E2D9' }}>
          {rolCompacto[usuario.rol] ?? 'Func.'}
        </span>
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTE: TarjetasMIPG (fila de métricas clickeables)
══════════════════════════════════════════════════════════════ */

interface TarjetaMIPGItem {
  filtro:    FiltroMIPG;
  label:     string;
  valor:     number;
  /** Color hex del riel izquierdo (4px) que distingue el KPI. */
  rielColor: string;
  /** Color de texto del número y label (alto contraste sobre fondo claro). */
  textoColor: string;
  icono?:    React.ReactNode;
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
  // Paleta operativa institucional: fondos claros + números y labels en
  // tonos de alto contraste (-700/-800). Cada KPI se identifica por el
  // riel izquierdo de 4px, no por el fondo (que se reserva para selección).
  const tarjetas: TarjetaMIPGItem[] = [
    {
      filtro:     'RADICADAS',
      label:      'Radicadas',
      valor:      metricas.radicadas,
      rielColor:  '#475569', // gris neutro institucional (totales)
      textoColor: '#1F2933',
    },
    {
      filtro:     'PRIORIDAD_MIPG',
      label:      'Prioridad MIPG',
      valor:      metricas.prioridadMIPG,
      rielColor:  '#B91C1C', // rojo riesgo
      textoColor: '#991B1B',
      icono: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      filtro:     'ASIGNADAS',
      label:      'Asignadas',
      valor:      metricas.asignadas,
      rielColor:  '#1D4ED8', // azul operativo
      textoColor: '#1E40AF',
    },
    {
      filtro:     'EN_TERMINO',
      label:      'En término',
      valor:      metricas.enTermino,
      rielColor:  '#14532D', // verde institucional
      textoColor: '#14532D',
    },
    {
      filtro:     'POR_VENCER',
      label:      'Por Vencer',
      valor:      metricas.porVencer,
      rielColor:  '#D97706', // ámbar
      textoColor: '#B45309',
    },
    {
      filtro:     'VENCIDAS',
      label:      'Vencidas',
      valor:      metricas.vencidas,
      rielColor:  '#DC2626', // rojo vencido
      textoColor: '#B91C1C',
    },
    {
      filtro:     'DEVUELTAS_PRORROGA',
      label:      'Devueltas / Prórroga',
      valor:      metricas.devueltasProrroga,
      rielColor:  '#CA8A04', // amarillo
      textoColor: '#854D0E',
    },
    {
      filtro:     'RESUELTOS_FUERA_TERMINO',
      label:      'Resueltos fuera de término',
      valor:      metricas.resueltosFueraTermino,
      rielColor:  '#DB2777', // rosa fuera de término
      textoColor: '#9D174D',
    },
  ];

  return (
    <div className="px-3 sm:px-4 py-3 shrink-0 bg-white" style={{ borderBottom: '1px solid #D9E2D9' }}>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {/* Tarjeta TODOS */}
        <button
          onClick={() => onFiltroChange('TODOS')}
          className="micro-card shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border-l-4 cursor-pointer focus-visible:outline-none"
          style={{
            background: filtroActivo === 'TODOS' ? '#EEF4EE' : '#F8FAF7',
            border: `1px solid ${filtroActivo === 'TODOS' ? '#14532D' : '#D9E2D9'}`,
            borderLeftColor: '#14532D',
            borderLeftWidth: 4,
          }}
        >
          <span className="text-2xl font-black leading-none tabular-nums" style={{ color: '#14532D' }}>
            {tarjetas.reduce((s, t) => s + t.valor, 0)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#667085' }}>Todos</span>
        </button>

        {tarjetas.map((t) => {
          const activo = filtroActivo === t.filtro;
          return (
            <button
              key={t.filtro}
              onClick={() => onFiltroChange(t.filtro)}
              aria-pressed={activo}
              className="micro-card shrink-0 flex flex-col items-start px-4 py-3 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={{
                background: activo ? '#EEF4EE' : '#F8FAF7',
                border: `1px solid ${activo ? '#14532D' : '#D9E2D9'}`,
                borderLeftColor: t.rielColor,
                borderLeftWidth: 4,
              }}
            >
              <span
                className="text-2xl font-black leading-none tabular-nums flex items-center gap-1"
                style={{ color: t.textoColor }}
              >
                {t.icono && <span className="mt-0.5">{t.icono}</span>}
                {t.valor}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
                style={{ color: t.textoColor }}
              >
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

function PanelOperacionDependencia({
  usuario,
  radicados,
  onSeleccionar,
  onFiltroChange,
}: {
  usuario: UsuarioAutenticado;
  radicados: VentanillaRadicado[];
  onSeleccionar: (r: VentanillaRadicado) => void;
  onFiltroChange: (f: FiltroMIPG) => void;
}) {
  const resumen = useMemo(() => calcularResumenBandeja(radicados), [radicados]);
  const siguiente = resumen.siguiente;
  const nombreAmbito = usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO'
    ? 'Vista institucional'
    : NOMBRES_TENANT[usuario.tenantId];
  const dias = siguiente ? calcDiasRestantes(siguiente) : null;

  return (
    <section className="px-3 sm:px-4 py-3 shrink-0 bg-[#F8FAF7]" style={{ borderBottom: '1px solid #D9E2D9' }}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] gap-3">
        {/* Panel bandeja */}
        <div className="micro-card-read rounded-xl px-4 py-3 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#667085' }}>
                Bandeja operativa
              </p>
              <h2 className="mt-1 text-sm font-black truncate" style={{ color: '#1F2933' }}>
                {nombreAmbito}
              </h2>
            </div>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border"
                  style={{ background: '#EEF4EE', color: '#14532D', borderColor: '#D9E2D9' }}>
              {usuario.rol}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[
              { label: 'Activos',    value: resumen.totalActivos,    color: '#1F2933',  filtro: 'TODOS' as FiltroMIPG },
              { label: 'Sin resp.',  value: resumen.sinResponsable,  color: '#B45309',  filtro: 'ASIGNADAS' as FiltroMIPG },
              { label: 'Prioridad', value: resumen.prioridadAlta,   color: '#DC2626',  filtro: 'PRIORIDAD_MIPG' as FiltroMIPG },
              { label: 'Por vencer', value: resumen.porVencer,      color: '#EA580C',  filtro: 'POR_VENCER' as FiltroMIPG },
              { label: 'Vencidos',  value: resumen.vencidos,        color: '#DC2626',  filtro: 'VENCIDAS' as FiltroMIPG },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onFiltroChange(item.filtro)}
                className="micro-card rounded-lg px-2 py-2 text-left focus-visible:outline-none"
                style={{ border: '1px solid #D9E2D9', background: '#F8FAF7' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F8FAF7'; }}
              >
                <p className="text-lg font-black tabular-nums leading-none" style={{ color: item.color }}>{item.value}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: '#94A3B8' }}>
                  {item.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Panel siguiente acción */}
        <div className="micro-card-read rounded-xl px-4 py-3 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#667085' }}>
                Siguiente atención sugerida
              </p>
              <p className={`mt-1 text-sm font-bold ${
                dias !== null && dias < 0
                  ? 'text-rose-600'
                  : dias !== null && dias <= 2
                    ? 'text-orange-600'
                    : ''
              }`} style={dias === null || dias > 2 ? { color: '#1F2933' } : {}}>
                {mensajeSiguienteAccion(siguiente)}
              </p>
            </div>
            {siguiente && (
              <button
                type="button"
                onClick={() => onSeleccionar(siguiente)}
                className="micro-btn-primary shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-white focus-visible:outline-none"
                style={{ background: '#14532D' }}
              >
                Abrir
              </button>
            )}
          </div>

          {siguiente ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[minmax(150px,0.8fr)_minmax(0,1.2fr)_minmax(130px,0.7fr)] gap-3 text-xs">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Radicado</p>
                <p className="mt-1 truncate font-mono font-bold" style={{ color: '#14532D' }}>{siguiente.radicadoId}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Asunto</p>
                <p className="mt-1 truncate" style={{ color: '#1F2933' }}>{siguiente.detalle.asunto}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Responsable</p>
                <p className="mt-1 truncate" style={{ color: '#1F2933' }}>
                  {siguiente.clasificacion.funcionarioResponsableNombre ?? 'Sin asignar'}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs" style={{ color: '#94A3B8' }}>
              Cuando entren solicitudes activas, aquí aparecerá la prioridad operativa de la oficina.
            </p>
          )}
        </div>
      </div>
    </section>
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
  puedeRadicar,
}: {
  radicados:              VentanillaRadicado[];
  cargando:               boolean;
  error:                  string | null;
  busqueda:               string;
  onBusquedaChange:       (v: string) => void;
  radicadoSeleccionadoId: string | null;
  onSeleccionar:          (r: VentanillaRadicado) => void;
  onNuevoRadicado:        () => void;
  puedeRadicar:           boolean;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 shrink-0 bg-white" style={{ borderBottom: '1px solid #D9E2D9' }}>
        <div className="relative min-w-0 flex-1 max-w-sm sm:min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#94A3B8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            placeholder="Buscar por radicado, nombre o documento…"
            className="micro-input w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
            style={{
              background: '#F8FAF7',
              border: '1px solid #D9E2D9',
              color: '#1F2933',
            }}
          />
        </div>
        <span className="text-xs shrink-0" style={{ color: '#94A3B8' }}>{radicados.length} resultado{radicados.length !== 1 ? 's' : ''}</span>
        {puedeRadicar && (
          <button
            onClick={onNuevoRadicado}
            className="micro-btn-primary shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-bold focus-visible:outline-none"
            style={{ background: '#14532D' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo
          </button>
        )}
      </div>

      {/* Error Firestore */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl text-xs shrink-0" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          <p className="font-semibold mb-1">Error de conexión</p>
          <p className="text-rose-500">{error}</p>
        </div>
      )}

      {/* Tarjetas — móvil (< sm) */}
      <div className="sm:hidden flex-1 overflow-y-auto bg-white" style={{ borderTop: '1px solid #EEF4EE' }}>
        {cargando && !error && (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse space-y-2" style={{ borderBottom: '1px solid #EEF4EE' }}>
              <div className="h-3 rounded w-2/3" style={{ background: '#EEF4EE' }} />
              <div className="h-2.5 rounded w-1/2" style={{ background: '#F8FAF7' }} />
            </div>
          ))
        )}
        {!cargando && !error && radicados.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="font-medium mb-1" style={{ color: '#667085' }}>Sin radicados</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>No hay resultados para los filtros aplicados.</p>
          </div>
        )}
        {!cargando && radicados.map((r) => {
          const esRojo = r.prioridad === 'ROJO';
          const seleccionado = radicadoSeleccionadoId === r.radicadoId;
          const semaforoData = calcularSemaforo(r);
          return (
            <button
              key={r.radicadoId}
              type="button"
              onClick={() => onSeleccionar(r)}
              className="micro-row w-full text-left px-4 py-3"
              aria-current={seleccionado ? 'true' : undefined}
              style={{
                borderBottom: '1px solid #EEF4EE',
                borderLeft: seleccionado ? '4px solid #14532D' : '4px solid transparent',
                background: seleccionado ? '#EEF4EE' : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {esRojo && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mt-0.5" />}
                  <span className="font-mono text-[13px] font-extrabold tracking-tight truncate" style={{ color: '#14532D' }}>{r.radicadoId}</span>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  BADGE_ESTADO[r.estadoActual] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {LABELS_ESTADO[r.estadoActual] ?? r.estadoActual}
                </span>
              </div>
              <p className="text-sm font-medium truncate" style={{ color: '#1F2933' }}>{r.solicitante.nombreCompleto}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="text-[10px]" style={{ color: '#667085' }}>{r.termino.tipoSolicitudNombre}</span>
                <span className="text-[10px] truncate" style={{ color: '#94A3B8' }}>{NOMBRES_TENANT[r.clasificacion.oficinaDestino]}</span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-[10px]" style={{ color: '#94A3B8' }}>Vence {fmtFecha(r.termino.fechaVencimiento)}</span>
                <span className={`text-[11px] font-semibold tabular-nums ${semaforoData.textoClass}`}>{semaforoData.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tabla — sm+ : ancho mínimo en escritorio para preservar legibilidad de columnas */}
      <div className="hidden sm:block flex-1 overflow-y-auto overflow-x-auto bg-white">
        <table className="w-full text-sm md:min-w-[920px]">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9' }}>
              {['Radicado', 'Solicitante', 'Tipo Trámite', 'Dependencia', 'Estado', 'Vencimiento', 'Días'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: '#14532D' }}>
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
                  <p className="font-medium mb-1" style={{ color: '#667085' }}>Sin radicados</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>No hay resultados para los filtros aplicados.</p>
                </td>
              </tr>
            )}

            {!cargando && radicados.map((r) => {
              const esRojo   = r.prioridad === 'ROJO';
              const seleccionado = radicadoSeleccionadoId === r.radicadoId;
              const semaforoData = calcularSemaforo(r);
              const diasColor = semaforoData.textoClass;

              return (
                <tr
                  key={r.radicadoId}
                  onClick={() => onSeleccionar(r)}
                  className={`micro-row cursor-pointer ${seleccionado ? 'is-selected' : ''}`}
                  aria-selected={seleccionado}
                  style={{
                    borderBottom: '1px solid #EEF4EE',
                    background: seleccionado ? '#EEF4EE' : undefined,
                    borderLeft: seleccionado ? '4px solid #14532D' : '4px solid transparent',
                    boxShadow: seleccionado ? 'inset 0 0 0 1px rgba(20,83,45,0.08)' : undefined,
                  }}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {esRojo && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                      <span className="font-mono text-[13px] font-extrabold tracking-tight" style={{ color: '#14532D' }}>{r.radicadoId}</span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{fmtFecha(r.control.fechaRadicado)}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="font-medium truncate" style={{ color: '#1F2933' }}>{r.solicitante.nombreCompleto}</p>
                    <p className="text-[10px] font-mono" style={{ color: '#94A3B8' }}>
                      {r.solicitante.tipoDocumento} {r.solicitante.numeroDocumento}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs" style={{ color: '#667085' }}>{r.termino.tipoSolicitudNombre}</p>
                    <p className="text-[10px]" style={{ color: '#94A3B8' }}>{r.termino.diasRespuesta}d {r.termino.unidad.toLowerCase()}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[150px]">
                    <p className="text-xs truncate" style={{ color: '#667085' }}>{NOMBRES_TENANT[r.clasificacion.oficinaDestino]}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                      BADGE_ESTADO[r.estadoActual] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                      {LABELS_ESTADO[r.estadoActual] ?? r.estadoActual}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs" style={{ color: '#667085' }}>{fmtFecha(r.termino.fechaVencimiento)}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm font-semibold tabular-nums ${diasColor}`}>{semaforoData.label}</span>
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
   SUB-COMPONENTE: PanelDerecho (5 tabs)
══════════════════════════════════════════════════════════════ */

type TabPanelId = 'info' | 'traslado' | 'trazabilidad' | 'respuesta' | 'copiloto';

const TABS_PANEL: { id: TabPanelId; label: string }[] = [
  { id: 'info',         label: 'Información' },
  { id: 'traslado',     label: 'Traslado' },
  { id: 'trazabilidad', label: 'Trazabilidad' },
  { id: 'respuesta',    label: 'Prórroga / Resp.' },
  { id: 'copiloto',     label: 'SIMI ✦' },
];

function FilaInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-sm mt-0.5 break-words" style={{ color: '#1F2933' }}>{value}</p>
    </div>
  );
}

function PanelDerecho({
  radicado,
  usuario,
  onCerrar,
  soloLectura = false,
  modoAmplio = false,
  onToggleModo,
}: {
  radicado:    VentanillaRadicado;
  usuario:     UsuarioAutenticado;
  onCerrar:    () => void;
  /** Roles JEFE_DEPENDENCIA y CONTROL_INTERNO: ven el panel pero no ejecutan acciones. */
  soloLectura?: boolean;
  /** Modo amplio: ancho extendido para lectura/redacción largos (escritorio). */
  modoAmplio?:  boolean;
  /** Toggle del modo amplio/normal — persiste en localStorage. */
  onToggleModo?: () => void;
}) {
  const [tab,              setTab]              = useState<TabPanelId>('info');
  const [tenantDestino,    setTenantDestino]    = useState<TenantId>(radicado.clasificacion.oficinaDestino);
  // MIPG-2: reemplaza el free-text de UID por un selector con snapshot completo
  const [responsableSelec, setResponsableSelec] = useState<FuncionarioTenant | null>(null);
  // Backward compat: si el radicado ya tenía un UID libre, lo inicializamos
  const [funcionarioUid,   setFuncionarioUid]   = useState(radicado.clasificacion.funcionarioResponsableUid ?? '');
  const [motivo,           setMotivo]           = useState('');
  const [diasProrroga,     setDiasProrroga]     = useState(5);
  const [respuesta,        setRespuesta]        = useState('');
  const [guardando,        setGuardando]        = useState(false);
  const [mensajeOk,        setMensajeOk]        = useState<string | null>(null);
  const [errorLocal,       setErrorLocal]       = useState<string | null>(null);
  const [trazabilidad,         setTrazabilidad]         = useState<TrazabilidadRadicado[]>([]);
  const [cargandoTrazabilidad, setCargandoTrazabilidad] = useState(false);
  const [archivoPdf,           setArchivoPdf]           = useState<File | null>(null);
  // Estado local para la gestión manual de notificaciones fallidas
  const [mostrarGestionNotif,  setMostrarGestionNotif]  = useState(false);
  const [motivoGestion,        setMotivoGestion]        = useState('');
  const [gestionandoNotif,     setGestionandoNotif]     = useState(false);
  // Vista previa institucional de la respuesta oficial
  const [vistaPreviaActiva,    setVistaPreviaActiva]    = useState(false);

  /** Genera el oficio formal y lo deja en el textarea para que el funcionario edite. */
  function generarPlantillaOficio() {
    const responsable = radicado.clasificacion.funcionarioResponsableNombre;
    const cargoSnapshot = radicado.clasificacion.funcionarioResponsableCargo;
    const dependenciaNombre = NOMBRES_TENANT[radicado.clasificacion.oficinaDestino] ?? 'Alcaldía Municipal de Simacota';

    const texto = buildOficioInstitucional({
      radicadoId: radicado.radicadoId,
      fecha:      new Date(),
      ciudadano: {
        nombre:    radicado.solicitante?.nombreCompleto,
        correo:    radicado.solicitante?.email ?? undefined,
        direccion: radicado.solicitante?.direccion ?? undefined,
        esAnonimo: radicado.esAnonimo,
        reservado: radicado.tipoPresentacion === 'RESERVADA' || radicado.identidadReservada === true,
      },
      dependencia: dependenciaNombre,
      funcionario: {
        nombre: responsable ?? usuario.nombre,
        cargo:  cargoSnapshot ?? undefined,
        rol:    usuario.rol,
      },
      cuerpoRespuesta: respuesta.trim().length >= 10 ? respuesta : undefined,
    });
    setRespuesta(texto);
    setMensajeOk(null);
    setErrorLocal(null);
  }

  // MIPG-2: carga funcionarios del tenant destino para el selector de responsable
  const { funcionarios: funcionariosTenant, cargando: cargandoFuncionarios } =
    useFuncionariosTenant(tab === 'traslado' ? tenantDestino : '');

  useEffect(() => {
    if (tab !== 'trazabilidad') return;

    setCargandoTrazabilidad(true);
    setTrazabilidad([]);
    getDocs(collection(getDb(), 'ventanilla_radicados', radicado.radicadoId, 'trazabilidad'))
      .then((snap) => {
        const eventos = snap.docs
          .map((d) => d.data() as TrazabilidadRadicado)
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        setTrazabilidad(eventos);
      })
      .catch((err) => {
        setErrorLocal(`Error al cargar trazabilidad: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => setCargandoTrazabilidad(false));
  }, [tab, radicado.radicadoId]);

  async function ejecutarAccion(accionFn: () => Promise<void>): Promise<boolean> {
    setGuardando(true);
    setErrorLocal(null);
    setMensajeOk(null);
    try {
      await accionFn();
      setMensajeOk('Operación guardada correctamente.');
      return true;
    } catch (err) {
      setErrorLocal(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function asignar() {
    if (!tenantDestino) return;

    // Si la sugerencia difiere, enviamos feedback de corrección a la IA
    if (radicado.analisisIa && radicado.analisisIa.dependenciaSugerida !== tenantDestino) {
      fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          radicadoId: radicado.radicadoId,
          usuarioId: usuario.uid,
          actorNombre: usuario.nombre,
          puntuacion: 'CORREGIDO',
          motivoCorreccion: `Trasladado manualmente a ${NOMBRES_TENANT[tenantDestino]}. Sugerido originalmente: ${NOMBRES_TENANT[radicado.analisisIa.dependenciaSugerida]}`,
          clasificacionOriginal: radicado.analisisIa?.dependenciaSugerida || 'VENTANILLA_UNICA',
          clasificacionFinal: tenantDestino,
          etiquetasIA: radicado.analisisIa?.etiquetasSemanticas || [],
          etiquetasFinales: radicado.analisisIa?.etiquetasSemanticas || [],
          resumenIA: radicado.analisisIa?.resumenEjecutivo,
          confianzaIA: radicado.analisisIa?.confianzaClasificacion,
        }),
      }).catch(err => console.error('Error logging override telemetry:', err));
    }

    await ejecutarAccion(async () => {
      const responsable: ResponsableFuncionario | null = responsableSelec
        ? {
            uid:    responsableSelec.uid,
            nombre: responsableSelec.nombre,
            email:  responsableSelec.email,
            rol:    responsableSelec.rol,
            cargo:  responsableSelec.cargo,
          }
        : funcionarioUid
          ? { uid: funcionarioUid, nombre: 'No registrado', email: '', rol: 'FUNCIONARIO' }
          : null;

      const response = await fetch(`/api/radicados/${encodeURIComponent(radicado.radicadoId)}/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantDestino, responsable }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'Error al asignar el radicado.');
    });
  }

  async function enviarFeedbackIA(puntuacion: 'POSITIVO' | 'NEGATIVO' | 'CORREGIDO', motivoCorreccion?: string) {
    if (!radicado.analisisIa) return;
    
    await ejecutarAccion(async () => {
      const response = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          radicadoId: radicado.radicadoId,
          usuarioId: usuario.uid,
          actorNombre: usuario.nombre,
          puntuacion,
          motivoCorreccion: motivoCorreccion || null,
          clasificacionOriginal: radicado.analisisIa?.dependenciaSugerida || 'VENTANILLA_UNICA',
          clasificacionFinal: radicado.clasificacion.oficinaDestino,
          etiquetasIA: radicado.analisisIa?.etiquetasSemanticas || [],
          etiquetasFinales: radicado.analisisIa?.etiquetasSemanticas || [],
          resumenIA: radicado.analisisIa?.resumenEjecutivo,
          confianzaIA: radicado.analisisIa?.confianzaClasificacion,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al registrar la calificación de la IA.');
      }
      
      setMensajeOk('Calificación de la IA registrada exitosamente.');
    });
  }

  async function devolver() {
    if (motivo.trim().length < 10) { setErrorLocal('El motivo debe tener al menos 10 caracteres.'); return; }
    await ejecutarAccion(async () => {
      const response = await fetch(`/api/radicados/${encodeURIComponent(radicado.radicadoId)}/devolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'Error al devolver el radicado.');
    });
    setMotivo('');
  }

  async function aplicarProrroga() {
    if (motivo.trim().length < 5) { setErrorLocal('Ingresa el motivo de la prórroga.'); return; }

    await ejecutarAccion(async () => {
      const response = await fetch(`/api/radicados/${encodeURIComponent(radicado.radicadoId)}/prorroga`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ motivo: motivo.trim(), diasProrroga }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'Error al aplicar la prórroga.');
    });
    setMotivo('');
  }

  async function marcarNotificacionGestionada() {
    if (motivoGestion.trim().length < 5) {
      setErrorLocal('Describe cómo se gestionó la notificación (mínimo 5 caracteres).');
      return;
    }
    setGestionandoNotif(true);
    setErrorLocal(null);
    setMensajeOk(null);
    try {
      const response = await fetch(
        `/api/radicados/${encodeURIComponent(radicado.radicadoId)}/notificacion-gestionada`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ motivo: motivoGestion.trim() }),
        },
      );
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'No se pudo registrar la gestión.');
      setMensajeOk('Notificación marcada como gestionada por canal alternativo.');
      setMotivoGestion('');
      setMostrarGestionNotif(false);
    } catch (err) {
      setErrorLocal(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGestionandoNotif(false);
    }
  }

  async function responderCaso() {
    if (respuesta.trim().length < 10) {
      setErrorLocal('La respuesta debe tener al menos 10 caracteres.');
      return;
    }

    const nota = respuesta.trim();
    setGuardando(true);
    setErrorLocal(null);
    setMensajeOk(null);

    try {
      const payload = new FormData();
      payload.set('nota', nota);
      if (archivoPdf) payload.set('archivo', archivoPdf);

      const response = await fetch(`/api/radicados/${encodeURIComponent(radicado.radicadoId)}/resolver`, {
        method: 'POST',
        credentials: 'include',
        body: payload,
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'Error al resolver el radicado.');

      setMensajeOk('Operación guardada correctamente.');
      setRespuesta('');
      setArchivoPdf(null);
    } catch (error) {
      setErrorLocal(`Error al guardar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGuardando(false);
    }
  }

  const esRojo = radicado.prioridad === 'ROJO';

  return (
    <div className="h-full flex flex-col bg-white" style={{ borderLeft: '1px solid #D9E2D9' }}>
      {/* Header */}
      <div className={`px-4 py-3 shrink-0 bg-white ${esRojo ? 'border-l-4 border-l-red-500' : ''}`}
           style={{ borderBottom: '1px solid #D9E2D9' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {esRojo && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
              <p className="font-mono text-xs font-bold truncate" style={{ color: '#14532D' }}>{radicado.radicadoId}</p>
            </div>
            <p className="text-sm font-semibold truncate" style={{ color: '#1F2933' }}>{radicado.solicitante.nombreCompleto}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                BADGE_ESTADO[radicado.estadoActual] ?? 'bg-gray-100 text-gray-600 border-gray-200'
              }`}>
                {LABELS_ESTADO[radicado.estadoActual] ?? radicado.estadoActual}
              </span>
              <SemaforoTermino radicado={radicado} variante="compact" />
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {onToggleModo && (
              <button
                type="button"
                onClick={onToggleModo}
                className="hidden md:inline-flex p-1.5 rounded-lg active:scale-90 transition-all duration-150"
                style={{ color: modoAmplio ? '#14532D' : '#94A3B8', background: modoAmplio ? '#EEF4EE' : 'transparent' }}
                title={modoAmplio ? 'Volver a panel normal' : 'Expandir panel para redacción larga'}
                aria-label={modoAmplio ? 'Volver a panel normal' : 'Expandir panel'}
                onMouseEnter={(e) => { if (!modoAmplio) { (e.currentTarget as HTMLElement).style.color = '#14532D'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; } }}
                onMouseLeave={(e) => { if (!modoAmplio) { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
              >
                {modoAmplio ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l-3 3m0 0l-3-3m3 3V3m6 6l3-3m0 0l3 3m-3-3v18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
            )}
            <button onClick={onCerrar}
              className="p-1.5 rounded-lg active:scale-90 transition-all duration-150"
              style={{ color: '#94A3B8' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1F2933'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Banner de notificación oficial fallida — visible solo si el radicado tiene el flag */}
      {radicado.alertaNotificacionFallida === true && (
        <div
          className="shrink-0 px-4 py-2.5"
          style={{ background: '#FEF2F2', borderBottom: '1px solid #FCA5A5' }}
        >
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#B91C1C" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#B91C1C' }}>
                Correo fallido
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7F1D1D' }}>
                Una notificación oficial a <span className="font-semibold">{radicado.solicitante.email ?? 'el ciudadano'}</span> no pudo entregarse.
                Contacta al ciudadano por canal alternativo y registra la gestión.
              </p>
              {!soloLectura && !mostrarGestionNotif && (
                <button
                  onClick={() => { setMostrarGestionNotif(true); setErrorLocal(null); setMensajeOk(null); }}
                  className="mt-2 text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition"
                  style={{ background: '#B91C1C', color: '#ffffff' }}
                >
                  Marcar gestionada
                </button>
              )}
              {mostrarGestionNotif && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    value={motivoGestion}
                    onChange={(e) => setMotivoGestion(e.target.value)}
                    placeholder="¿Cómo se notificó al ciudadano? (Ej: llamada telefónica al 312-xxx-xxxx el 2026-06-14)"
                    className="w-full text-xs rounded-lg px-2.5 py-2 border focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: '#FCA5A5', minHeight: 60 }}
                    disabled={gestionandoNotif}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={marcarNotificacionGestionada}
                      disabled={gestionandoNotif || motivoGestion.trim().length < 5}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: '#B91C1C', color: '#ffffff' }}
                    >
                      {gestionandoNotif ? 'Registrando…' : 'Confirmar gestión'}
                    </button>
                    <button
                      onClick={() => { setMostrarGestionNotif(false); setMotivoGestion(''); }}
                      disabled={gestionandoNotif}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition"
                      style={{ background: 'transparent', color: '#7F1D1D', border: '1px solid #FCA5A5' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs — scroll horizontal interno cuando no caben */}
      <div
        className="flex shrink-0 overflow-x-auto overflow-y-hidden bg-white gap-1 px-2 py-1.5"
        style={{ borderBottom: '1px solid #D9E2D9', scrollbarWidth: 'thin' }}
        role="tablist"
      >
        {TABS_PANEL.map((t) => {
          const activo = tab === t.id;
          return (
            <button key={t.id}
              role="tab"
              aria-selected={activo}
              onClick={() => { setTab(t.id); setMensajeOk(null); setErrorLocal(null); }}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 transition-all duration-150"
              style={activo
                ? {
                    color: '#FFFFFF',
                    background: '#14532D',
                    border: '1px solid #14532D',
                    boxShadow: '0 1px 3px rgba(20,83,45,0.30)',
                  }
                : {
                    color: '#475569',
                    background: '#F8FAF7',
                    border: '1px solid #D9E2D9',
                  }}
              onMouseEnter={(e) => { if (!activo) { (e.currentTarget as HTMLElement).style.color = '#14532D'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; (e.currentTarget as HTMLElement).style.borderColor = '#14532D'; } }}
              onMouseLeave={(e) => { if (!activo) { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = '#F8FAF7'; (e.currentTarget as HTMLElement).style.borderColor = '#D9E2D9'; } }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Feedback global */}
      {(mensajeOk || errorLocal) && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs shrink-0"
             style={mensajeOk
               ? { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }
               : { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          {mensajeOk ?? errorLocal}
        </div>
      )}

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ background: '#F8FAF7' }}>

        {/* ── TAB 1: Información ── */}
        {tab === 'info' && (
          <>
            <SelloRadicado
              variant="compact"
              data={{
                radicadoId: radicado.radicadoId,
                fechaRadicado: radicado.control.fechaRadicado,
                horaRadicado: radicado.control.horaRadicado,
                medioRecepcion: radicado.control.medioRecepcion,
                tipoSolicitud: radicado.termino.tipoSolicitudNombre,
                canalRespuesta: radicado.canalRespuesta ?? null,
                dependencia: NOMBRES_TENANT[radicado.clasificacion.oficinaDestino] ?? radicado.clasificacion.oficinaDestino,
                estado: radicado.estadoActual,
                solicitante: radicado.solicitante.nombreCompleto,
                documento: `${radicado.solicitante.tipoDocumento} ${radicado.solicitante.numeroDocumento}`,
                correo: radicado.solicitante.email ?? null,
                esAnonimo: radicado.esAnonimo,
                identidadReservada: radicado.identidadReservada,
              }}
            />

            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>Solicitante</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <FilaInfo label="Tipo persona"    value={radicado.solicitante.tipoPersona} />
                <FilaInfo label="Documento"       value={`${radicado.solicitante.tipoDocumento} ${radicado.solicitante.numeroDocumento}`} />
                <FilaInfo label="Nombre completo" value={radicado.solicitante.nombreCompleto} />
                <FilaInfo label="Presentación" value={radicado.tipoPresentacion ?? (radicado.esAnonimo ? 'ANONIMA' : 'IDENTIFICADA')} />
                <FilaInfo label="Anónima" value={radicado.esAnonimo ? 'Sí' : 'No'} />
                {radicado.identidadReservada && <FilaInfo label="Identidad reservada" value="Sí" />}
                {radicado.solicitante.email    && <FilaInfo label="Correo"    value={radicado.solicitante.email} />}
                {radicado.solicitante.telefono && <FilaInfo label="Teléfono"  value={radicado.solicitante.telefono} />}
                {radicado.solicitante.direccion && <FilaInfo label="Dirección" value={radicado.solicitante.direccion} />}
                <FilaInfo label="Municipio" value={`${radicado.solicitante.ubicacion.municipio}, ${radicado.solicitante.ubicacion.departamento}`} />
              </div>
            </div>

            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>Detalle del caso</p>
              <div className="space-y-3">
                <FilaInfo label="Asunto"      value={radicado.detalle.asunto} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Descripción</p>
                  <p className="text-sm mt-0.5 leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2933' }}>{radicado.detalle.descripcion}</p>
                </div>
                <FilaInfo label="Número de folios" value={String(radicado.detalle.numeroFolios)} />
                {radicado.detalle.anexosDescripcion && (
                  <FilaInfo label="Anexos" value={radicado.detalle.anexosDescripcion} />
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>
                Control de radicación
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <FilaInfo label="Fecha"   value={fmtFechaLarga(radicado.control.fechaRadicado)} />
                <FilaInfo label="Canal"   value={radicado.control.medioRecepcion} />
                <FilaInfo label="Canal respuesta" value={radicado.canalRespuesta ?? 'No registrado'} />
                <FilaInfo label="Vence"   value={fmtFecha(radicado.termino.fechaVencimiento)} />
                <FilaInfo label="Tipo"    value={`${radicado.termino.tipoSolicitudNombre} · ${radicado.termino.diasRespuesta}d`} />
              </div>
            </div>

            {/* ── MIPG-2: Responsable funcional ── */}
            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>
                MIPG · Responsable funcional asignado
              </p>
              {radicado.clasificacion.funcionarioResponsableNombre ? (
                <div className="rounded-lg p-3 space-y-2" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: '#14532D' }}>
                      {radicado.clasificacion.funcionarioResponsableNombre.charAt(0).toUpperCase()}
                    </span>
                    <p className="text-sm font-semibold" style={{ color: '#1F2933' }}>
                      {radicado.clasificacion.funcionarioResponsableNombre}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mt-1">
                    {radicado.clasificacion.funcionarioResponsableCargo && (
                      <FilaInfo label="Cargo" value={radicado.clasificacion.funcionarioResponsableCargo} />
                    )}
                    <FilaInfo label="Dependencia" value={NOMBRES_TENANT[radicado.clasificacion.oficinaDestino]} />
                    {radicado.clasificacion.funcionarioResponsableEmail && (
                      <FilaInfo label="Email" value={radicado.clasificacion.funcionarioResponsableEmail} />
                    )}
                    {radicado.clasificacion.funcionarioResponsableRol && (
                      <FilaInfo label="Rol" value={radicado.clasificacion.funcionarioResponsableRol} />
                    )}
                    {radicado.clasificacion.fechaAsignacionResponsable && (
                      <FilaInfo label="Fecha asignación" value={fmtFechaLarga(radicado.clasificacion.fechaAsignacionResponsable)} />
                    )}
                  </div>
                </div>
              ) : radicado.clasificacion.funcionarioResponsableUid ? (
                <div className="rounded-lg p-3" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
                  <p className="text-xs" style={{ color: '#667085' }}>
                    <span className="font-mono" style={{ color: '#94A3B8' }}>{radicado.clasificacion.funcionarioResponsableUid}</span>
                    <br />
                    <span style={{ color: '#94A3B8' }}>Radicado anterior — nombre no registrado. Ver trazabilidad para detalle.</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs italic" style={{ color: '#94A3B8' }}>Sin responsable asignado</p>
              )}
            </div>

            {radicado.archivos.length > 0 && (
              <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>
                  Archivos adjuntos ({radicado.archivos.length})
                </p>
                <ul className="space-y-2">
                  {radicado.archivos.map((arch, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2 last:border-0"
                        style={{ borderBottom: '1px solid #EEF4EE' }}>
                      <span className="text-xs truncate min-w-0" style={{ color: '#1F2933' }}>{arch.nombre}</span>
                      {arch.path && (
                        <a href={`/api/interno/archivo?path=${encodeURIComponent(arch.path)}`} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-xs underline underline-offset-2 font-semibold" style={{ color: '#14532D' }}>
                          Ver
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {radicado.analisisIa && (
              <div className="border-t border-white/[0.07] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Análisis Asistido IA</span>
                  </div>
                  <span className="text-[10px] text-indigo-300 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    Confianza: {(radicado.analisisIa.confianzaClasificacion * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-white/10">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Resumen Ejecutivo IA</span>
                    <p className="text-xs text-slate-300 italic leading-relaxed">
                      &quot;{radicado.analisisIa.resumenEjecutivo}&quot;
                    </p>
                  </div>

                  {radicado.analisisIa.etiquetasSemanticas && radicado.analisisIa.etiquetasSemanticas.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {radicado.analisisIa.etiquetasSemanticas.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-[9px] font-medium text-indigo-400 border border-indigo-500/20"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Feedback de IA */}
                  <div className="border-t border-white/[0.05] pt-3 flex items-center justify-between gap-3">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">¿La IA acertó?</span>
                    
                    {radicado.feedbackIa ? (
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        radicado.feedbackIa.puntuacion === 'POSITIVO'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                          : radicado.feedbackIa.puntuacion === 'CORREGIDO'
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                      }`}>
                        Calificado: {radicado.feedbackIa.puntuacion}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => enviarFeedbackIA('POSITIVO')}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 hover:text-emerald-400 border border-white/10 text-xs font-medium transition-colors cursor-pointer"
                        >
                          👍 Sí
                        </button>
                        <button
                          onClick={() => enviarFeedbackIA('NEGATIVO')}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 hover:text-rose-400 border border-white/10 text-xs font-medium transition-colors cursor-pointer"
                        >
                          ❌ No
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: Traslado / Asignación ── */}
        {tab === 'traslado' && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Dependencia destino</p>
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

            {/* Selector MIPG-2 — responsable funcional */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
                Responsable funcional <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(opcional)</span>
              </p>
              {cargandoFuncionarios ? (
                <div className="flex items-center gap-2 text-xs py-2" style={{ color: '#94A3B8' }}>
                  <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
                  Cargando funcionarios…
                </div>
              ) : funcionariosTenant.length > 0 ? (
                <select
                  value={responsableSelec?.uid ?? ''}
                  onChange={(e) => {
                    const f = funcionariosTenant.find((x) => x.uid === e.target.value) ?? null;
                    setResponsableSelec(f);
                    if (f) setFuncionarioUid(f.uid);
                  }}
                  className="select-internal w-full"
                >
                  <option value="">— Sin responsable asignado —</option>
                  {funcionariosTenant.map((f) => (
                    <option key={f.uid} value={f.uid}>
                      {f.nombre}{f.cargo ? ` · ${f.cargo}` : ''} ({f.rol})
                    </option>
                  ))}
                </select>
              ) : (
                // Fallback para tenants sin usuarios registrados
                <input
                  value={funcionarioUid}
                  onChange={(e) => { setFuncionarioUid(e.target.value); setResponsableSelec(null); }}
                  placeholder="UID del funcionario (no hay usuarios registrados en esta dependencia)"
                  className="input-internal text-slate-500"
                />
              )}
              {responsableSelec && (
                <p className="text-[10px] mt-1.5" style={{ color: '#94A3B8' }}>
                  📧 {responsableSelec.email}
                </p>
              )}
            </div>

            {/* Responsable actual del radicado */}
            <div className="pt-3" style={{ borderTop: '1px solid #D9E2D9' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#667085' }}>
                Responsable registrado actualmente
              </p>
              {radicado.clasificacion.funcionarioResponsableNombre ? (
                <div className="rounded-lg p-3 space-y-1" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
                  <p className="text-sm font-semibold" style={{ color: '#1F2933' }}>{radicado.clasificacion.funcionarioResponsableNombre}</p>
                  {radicado.clasificacion.funcionarioResponsableCargo && (
                    <p className="text-xs" style={{ color: '#667085' }}>{radicado.clasificacion.funcionarioResponsableCargo}</p>
                  )}
                  {radicado.clasificacion.funcionarioResponsableEmail && (
                    <p className="text-xs" style={{ color: '#667085' }}>📧 {radicado.clasificacion.funcionarioResponsableEmail}</p>
                  )}
                  {radicado.clasificacion.fechaAsignacionResponsable && (
                    <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
                      Asignado: {new Date(radicado.clasificacion.fechaAsignacionResponsable).toLocaleDateString('es-CO')}
                    </p>
                  )}
                </div>
              ) : radicado.clasificacion.funcionarioResponsableUid ? (
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  UID: {radicado.clasificacion.funcionarioResponsableUid}
                  <span className="ml-2" style={{ color: '#94A3B8' }}>(radicado anterior — nombre no registrado)</span>
                </p>
              ) : (
                <p className="text-xs italic" style={{ color: '#94A3B8' }}>Sin responsable asignado</p>
              )}
            </div>

            <button type="button" onClick={asignar} disabled={guardando || soloLectura}
              title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : undefined}
              className="w-full py-2.5 rounded-lg text-white text-sm font-bold transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: '#14532D' }}
              onMouseEnter={(e) => { if (!guardando && !soloLectura) (e.currentTarget as HTMLElement).style.background = '#166534'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}>
              {guardando && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Confirmar traslado
            </button>

            <div className="pt-4" style={{ borderTop: '1px solid #D9E2D9' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>Destino actual</p>
              <p className="text-sm font-medium" style={{ color: '#1F2933' }}>{NOMBRES_TENANT[radicado.clasificacion.oficinaDestino]}</p>
            </div>
          </div>
        )}

        {/* ── TAB 3: Trazabilidad MIPG ── */}
        {tab === 'trazabilidad' && (
          <div>
            {cargandoTrazabilidad ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#94A3B8' }}>
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
                Cargando trazabilidad...
              </div>
            ) : trazabilidad.length === 0 ? (
              <p className="text-sm italic" style={{ color: '#94A3B8' }}>Sin eventos de trazabilidad.</p>
            ) : (
              <ol className="relative flex flex-col gap-0">
                {[...trazabilidad]
                  .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                  .map((evento, idx, arr) => (
                    <li key={`${evento.fecha}-${idx}`} className="relative flex gap-3 pb-5 last:pb-0">
                      {idx < arr.length - 1 && (
                        <div className="absolute left-[9px] top-5 bottom-0 w-px" style={{ background: '#D9E2D9' }} />
                      )}
                      <div className="shrink-0 w-[18px] h-[18px] mt-0.5 rounded-full flex items-center justify-center z-10"
                           style={{ background: '#EEF4EE', border: '2px solid #14532D' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#14532D' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-semibold" style={{ color: '#1F2933' }}>{evento.accion}</span>
                          <time className="shrink-0 text-[10px] font-mono" style={{ color: '#94A3B8' }}>
                            {fmtFechaLarga(evento.fecha)}
                          </time>
                        </div>
                        <p className="text-xs" style={{ color: '#667085' }}>{evento.actorNombre}</p>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#94A3B8' }}>{evento.nota}</p>
                        {(evento.oficinaOrigen || evento.oficinaDestino) && (
                          <p className="text-[10px] font-mono mt-0.5" style={{ color: '#94A3B8' }}>
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
          <div className="space-y-4">
            {/* Devolver */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-red-700">Devolver al ciudadano</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Motivo</p>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                  placeholder="Indica la razón de la devolución…" className="input-internal resize-none" />
              </div>
              <button type="button" onClick={devolver} disabled={guardando || soloLectura}
                title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : undefined}
                className="w-full py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-60 active:scale-[0.98]"
                style={{ border: '1px solid #FECACA', color: '#DC2626', background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FEE2E2'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                Devolver
              </button>
            </div>

            {/* Prórroga */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Aplicar prórroga legal</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Motivo</p>
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Fundamento legal de la prórroga" className="input-internal" />
                </div>
                <div className="w-24">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Días</p>
                  <input type="number" min={1} max={30} value={diasProrroga}
                    onChange={(e) => setDiasProrroga(Math.max(1, Number(e.target.value)))}
                    className="input-internal text-center" />
                </div>
              </div>
              <button type="button" onClick={aplicarProrroga} disabled={guardando || soloLectura}
                title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : undefined}
                className="w-full py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-60 active:scale-[0.98]"
                style={{ border: '1px solid #FDE68A', color: '#B45309', background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FEF3C7'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                Aplicar prórroga (+{diasProrroga} días)
              </button>
            </div>

            {/* Respuesta final */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-green-700">Cargar respuesta / resolver</p>

              {radicado.respuestaOficial && (
                <div className="rounded-lg p-3 space-y-1 bg-white" style={{ border: '1px solid #D9E2D9' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
                    {radicado.respuestaOficial.archivoPath ? 'Oficio de respuesta archivado' : 'Respuesta registrada (sin oficio adjunto)'}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: '#1F2933' }}>{radicado.respuestaOficial.nota}</p>
                  {radicado.respuestaOficial.archivoPath && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono truncate" style={{ color: '#94A3B8' }}>{radicado.respuestaOficial.archivoNombre}</span>
                      <a href={`/api/interno/archivo?path=${encodeURIComponent(radicado.respuestaOficial.archivoPath)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-xs underline underline-offset-2 ml-3 font-semibold" style={{ color: '#14532D' }}>
                        Descargar oficio
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
                    Respuesta oficial (oficio)
                  </p>
                  {radicado.estadoActual !== 'RESUELTO' && !soloLectura && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={generarPlantillaOficio}
                        disabled={guardando}
                        title="Inserta una plantilla institucional tipo oficio que luego puedes editar."
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition active:scale-95 disabled:opacity-50"
                        style={{ background: '#EEF4EE', color: '#14532D', border: '1px solid #D9E2D9' }}
                      >
                        Generar plantilla
                      </button>
                      <button
                        type="button"
                        onClick={() => setVistaPreviaActiva((v) => !v)}
                        disabled={guardando || respuesta.trim().length === 0}
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition active:scale-95 disabled:opacity-40"
                        style={vistaPreviaActiva
                          ? { background: '#14532D', color: '#ffffff', border: '1px solid #14532D' }
                          : { background: 'transparent', color: '#14532D', border: '1px solid #D9E2D9' }}
                      >
                        {vistaPreviaActiva ? 'Ocultar previa' : 'Vista previa'}
                      </button>
                    </div>
                  )}
                </div>
                <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)}
                  rows={modoAmplio ? (vistaPreviaActiva ? 14 : 10) : (vistaPreviaActiva ? 8 : 4)}
                  placeholder="Describe la respuesta dada al ciudadano o usa “Generar plantilla” para un oficio institucional…"
                  className={`input-internal ${modoAmplio ? 'resize-y' : 'resize-none'}`}
                  disabled={radicado.estadoActual === 'RESUELTO'}
                  style={{
                    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    minHeight: modoAmplio ? 220 : undefined,
                  }}
                />
                <p className="mt-1 text-[10px]" style={{ color: '#94A3B8' }}>
                  Este texto se enviará por correo al ciudadano y quedará visible en la consulta pública con formato institucional.
                </p>
              </div>

              {vistaPreviaActiva && respuesta.trim().length > 0 && (
                <div
                  className="rounded-xl p-5"
                  style={{ background: '#FFFFFF', border: '1px solid #14532D' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2"
                     style={{ color: '#14532D', borderBottom: '1px dashed #D9E2D9' }}>
                    Vista previa institucional · cómo lo verá el ciudadano
                  </p>
                  <pre
                    className="text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{
                      fontFamily: '"DM Sans", "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      color: '#1F2933',
                    }}
                  >{respuesta}</pre>
                </div>
              )}

              {radicado.estadoActual !== 'RESUELTO' && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
                    PDF firmado <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(opcional)</span>
                  </p>
                  {archivoPdf ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                         style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <span className="text-xs text-green-700 truncate min-w-0">{archivoPdf.name}</span>
                      <button type="button" onClick={() => setArchivoPdf(null)}
                        className="shrink-0 text-[10px] transition-colors" style={{ color: '#94A3B8' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}>
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed cursor-pointer transition-colors"
                           style={{ borderColor: '#D9E2D9' }}>
                      <svg className="w-4 h-4 shrink-0" style={{ color: '#94A3B8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                      </svg>
                      <span className="text-xs" style={{ color: '#667085' }}>Adjuntar oficio firmado (PDF, máx. 10 MB)</span>
                      <input type="file" accept="application/pdf" className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 10 * 1024 * 1024) { setErrorLocal('El archivo supera los 10 MB.'); }
                          else { setArchivoPdf(f); }
                          e.target.value = '';
                        }} />
                    </label>
                  )}
                </div>
              )}

              <button type="button" onClick={responderCaso}
                disabled={guardando || radicado.estadoActual === 'RESUELTO' || soloLectura}
                title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : undefined}
                className="w-full py-2 rounded-lg text-white text-sm font-bold transition-all disabled:opacity-60 active:scale-[0.98]"
                style={{ background: '#14532D' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#166534'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}>
                {soloLectura ? 'Vista de solo lectura' : radicado.estadoActual === 'RESUELTO' ? 'Ya está resuelto' : 'Marcar como resuelto'}
              </button>
            </div>

            {guardando && (
              <div className="flex items-center justify-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
                Guardando en Firestore…
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: Copiloto IA ── */}
        {tab === 'copiloto' && (
          <PanelSimi
            radicado={radicado}
            usuario={usuario}
            onAdoptarRespuesta={(texto) => { setRespuesta(texto); setTab('respuesta'); }}
          />
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
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white flex flex-col shadow-2xl"
           style={{ borderLeft: '1px solid #D9E2D9' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-white"
             style={{ borderBottom: '1px solid #D9E2D9' }}>
          <div>
            <h2 className="text-base font-black" style={{ color: '#1F2933' }}>Radicación Rápida</h2>
            <p className="text-xs" style={{ color: '#667085' }}>Nuevo radicado institucional · Ventanilla Única</p>
          </div>
          <button onClick={onCerrar}
            className="p-2 rounded-xl active:scale-90 transition-all duration-150 focus-visible:outline-none"
            style={{ color: '#94A3B8' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1F2933'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-5" style={{ background: '#F8FAF7' }}>

          {/* ── Estado de éxito ── */}
          {radicadoGenerado && datosComprobante && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="text-center">
                <div className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-3"
                     style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#16A34A' }}>Radicado registrado</p>
                <p className="text-2xl font-black font-mono" style={{ color: '#14532D' }}>{radicadoGenerado}</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Informe este número al ciudadano para seguimiento.</p>
              </div>

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

              <div className="flex gap-3">
                <button
                  onClick={() => { setRadicadoGenerado(null); setDatosComprobante(null); setProgreso(''); setProgresoPct(0); }}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-150 active:scale-95"
                  style={{ background: '#14532D' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#166534'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}
                >Radicar otro</button>
                <button onClick={onCerrar}
                  className="px-5 py-2.5 rounded-xl text-sm transition-all duration-150 active:scale-95"
                  style={{ border: '1px solid #D9E2D9', color: '#667085' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                >Cerrar</button>
              </div>
            </div>
          )}

          {/* ── Barra de progreso ── */}
          {!radicadoGenerado && progreso && (
            <div className="mb-5 p-4 rounded-xl bg-white" style={{ border: '1px solid #D9E2D9' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: '#667085' }}>{progreso}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: '#14532D' }}>{progresoPct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF4EE' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progresoPct}%`, background: '#14532D' }} />
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {errorGuardado && (
            <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {errorGuardado}
            </div>
          )}

          {!radicadoGenerado && (
            <RadicacionFuncionarioForm radicadoPreview="Se generará al radicar" onSubmit={handleSubmit} />
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   VISTA: Reportes MIPG (placeholder)
══════════════════════════════════════════════════════════════ */

/* ── Helper: exportación CSV MIPG ──────────────────────────────
   14 columnas que cubren los 8 requisitos MIPG de trazabilidad.
   BOM UTF-8 (﻿) para que Excel colombiano abra tildes y ñ sin problemas.
─────────────────────────────────────────────────────────────── */
function exportarCSVMIPG(radicados: VentanillaRadicado[]): void {
  const headers = [
    'N° Radicado',                    // Req 1 (identificación)
    'Fecha Radicación',               // Req 1
    'Hora Radicación',                // Req 1
    'Medio Recepción',                // Req 1
    'Solicitante',                    // contexto ciudadano
    'Documento',                      // identificación
    'Tipo Solicitud',                 // clasificación MIPG
    'Forma Presentación PQRSD',
    'Solicitud Anónima',
    'Identidad Reservada',
    'Canal Respuesta',
    'Dependencia Asignada',           // Req 2
    // Req 3 — Responsable funcional (MIPG-2)
    'Responsable UID',
    'Responsable Nombre',
    'Responsable Email',
    'Responsable Rol',
    'Responsable Cargo',
    'Fecha Asignación Responsable',
    'Estado Actual',                  // ciclo de vida
    'Respuesta',                      // Req 4 (primeros 300 chars)
    'Fecha Respuesta',                // Req 5
    'Oficio Adjunto',                 // Req 6
    'Fecha Vencimiento',              // Req 8 (término legal)
    'Días Restantes',                 // MIPG-3: calculado en tiempo de exportación
    'Estado Término',                 // MIPG-3: EN_TERMINO | POR_VENCER | VENCIDO | RESUELTO
    'Días Vencido',                   // MIPG-3: solo cuando < 0
    'Prórrogas Aplicadas',            // Req 8
    'Cumplió Término MIPG',          // Req 8 — dato auditoriable
    'Trazabilidad',                   // Req 7 — confirmación de subcollección
  ];

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = radicados.map((r) => { const sem = calcularSemaforo(r); return [
    r.radicadoId,
    r.control.fechaRadicado,
    r.control.horaRadicado,
    r.control.medioRecepcion,
    r.solicitante.nombreCompleto,
    r.solicitante.numeroDocumento,
    r.termino.tipoSolicitudNombre,
    r.tipoPresentacion ?? (r.esAnonimo ? 'ANONIMA' : 'IDENTIFICADA'),
    r.esAnonimo ? 'Sí' : 'No',
    r.identidadReservada ? 'Sí' : 'No',
    r.canalRespuesta ?? 'No registrado',
    NOMBRES_TENANT[r.clasificacion.oficinaDestino] ?? r.clasificacion.oficinaDestino,
    // Req 3 — MIPG-2: responsable funcional con backward compat
    r.clasificacion.funcionarioResponsableUid    ?? '—',
    r.clasificacion.funcionarioResponsableNombre ?? 'No registrado (ver trazabilidad)',
    r.clasificacion.funcionarioResponsableEmail  ?? '—',
    r.clasificacion.funcionarioResponsableRol    ?? '—',
    r.clasificacion.funcionarioResponsableCargo  ?? '—',
    r.clasificacion.fechaAsignacionResponsable   ?? '—',
    r.estadoActual,
    (r.respuestaOficial?.nota ?? '—').substring(0, 300),
    r.respuestaOficial?.fecha ?? '—',
    r.respuestaOficial?.archivoNombre ? `Sí — ${r.respuestaOficial.archivoNombre}` : 'No',
    r.termino.fechaVencimiento,
    String(sem.diasRestantes),
    sem.estado,
    sem.diasRestantes < 0 ? String(Math.abs(sem.diasRestantes)) : '0',
    String(r.termino.prorrogasAplicadas ?? 0),
    r.cumplioTermino === true  ? 'Sí — dentro del término' :
    r.cumplioTermino === false ? 'No — fuera del término'  : 'Pendiente',
    'Ver subcollección trazabilidad en Firebase',
  ].map(esc).join(','); });

  const csv = [headers.map(esc).join(','), ...rows].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `MIPG_Radicados_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function VistaReportes({
  metricas,
  total,
  radicados,
}: {
  metricas:  MetricasMIPGData;
  total:     number;
  radicados: VentanillaRadicado[];
}) {
  // KPI de cumplimiento de términos — calculado sobre datos reales de Firestore
  const resueltosConDato = radicados.filter(
    (r) => r.cumplioTermino !== undefined && r.cumplioTermino !== null,
  );
  const aTiempo = radicados.filter((r) => r.cumplioTermino === true).length;
  const pctCumplimiento = resueltosConDato.length > 0
    ? Math.round((aTiempo / resueltosConDato.length) * 100)
    : null;  // null = sin datos suficientes (antes de MIPG-1)

  const items = [
    { label: 'Total radicados',           valor: total,                    color: 'text-slate-200',  desc: '' },
    { label: 'Tasa resolución (%)',        valor: total > 0 ? Math.round(((total - metricas.radicadas - metricas.asignadas) / total) * 100) : 0, color: 'text-emerald-300', desc: 'Resueltos / Total' },
    { label: 'Cumplimiento términos (%)',  valor: pctCumplimiento !== null ? pctCumplimiento : '—', color: pctCumplimiento !== null ? (pctCumplimiento >= 80 ? 'text-emerald-300' : pctCumplimiento >= 60 ? 'text-amber-300' : 'text-rose-400') : 'text-slate-600', desc: 'MIPG Req. 8 — Respondidos a tiempo' },
    { label: 'Respondidos a tiempo',       valor: aTiempo,                  color: 'text-teal-300',   desc: 'Con dato de cumplimiento' },
    { label: 'Radicadas (pendientes)',     valor: metricas.radicadas,        color: 'text-indigo-300', desc: '' },
    { label: 'Prioridad MIPG activos',    valor: metricas.prioridadMIPG,   color: 'text-red-300',    desc: 'Prioridad ROJO activa' },
    { label: 'En trámite (asignadas)',     valor: metricas.asignadas,        color: 'text-sky-300',    desc: '' },
    { label: 'Por vencer (≤ 2 días)',      valor: metricas.porVencer,        color: 'text-orange-300', desc: '' },
    { label: 'Vencidas sin respuesta',     valor: metricas.vencidas,         color: 'text-rose-300',   desc: '' },
    { label: 'Devueltas / Prórroga',       valor: metricas.devueltasProrroga,color: 'text-amber-300',  desc: '' },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8" style={{ background: '#F8FAF7' }}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>MIPG · Rendición de Cuentas</p>
          <h2 className="text-xl font-black" style={{ color: '#1F2933' }}>Indicadores de Eficiencia</h2>
        </div>
        <button
          type="button"
          onClick={() => exportarCSVMIPG(radicados)}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
          style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#D9E2D9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
          title="Exportar reporte MIPG en formato CSV (compatible con Excel)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV MIPG
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl p-5 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
            <p className={`text-3xl font-black tabular-nums ${item.color}`}>{item.valor}</p>
            <p className="text-xs mt-2 leading-tight font-medium" style={{ color: '#667085' }}>{item.label}</p>
            {item.desc && <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#94A3B8' }}>{item.desc}</p>}
          </div>
        ))}
      </div>

      {pctCumplimiento === null && (
        <div className="rounded-lg px-4 py-3 mb-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
            <span className="font-bold">MIPG Req. 8 — Sin datos de cumplimiento aún.</span>{' '}
            El campo <span className="font-mono">cumplioTermino</span> se registra automáticamente
            la próxima vez que se resuelva un radicado. Los radicados históricos no tienen este dato.
          </p>
        </div>
      )}

      <p className="text-xs" style={{ color: '#94A3B8' }}>
        Datos en tiempo real · colección <span className="font-mono">ventanilla_radicados</span> ·
        {' '}{total} documento{total !== 1 ? 's' : ''} visibles para tu rol.
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
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0 bg-white"
           style={{ borderBottom: '1px solid #D9E2D9' }}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold" style={{ color: '#1F2933' }}>Bandeja de Asignación</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{ background: '#EEF4EE', color: '#14532D', borderColor: '#D9E2D9' }}>
            {radicados.length} pendiente{radicados.length !== 1 ? 's' : ''}
          </span>
        </div>
        {seleccionMasiva.size > 0 && (
          <button onClick={() => dispatch({ type: 'LIMPIAR_SELECCION' })}
            className="text-xs transition-colors" style={{ color: '#94A3B8' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#667085'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}>
            Limpiar selección ({seleccionMasiva.size})
          </button>
        )}
      </div>

      {/* Barra de asignación masiva */}
      {seleccionMasiva.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 shrink-0"
             style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9' }}>
          <span className="text-xs font-bold shrink-0" style={{ color: '#14532D' }}>
            {seleccionMasiva.size} seleccionado{seleccionMasiva.size !== 1 ? 's' : ''}
          </span>
          <select value={tenantMasivo}
            onChange={(e) => dispatch({ type: 'SET_TENANT_MASIVO', tenant: e.target.value as TenantId | '' })}
            className="select-internal flex-1 text-xs">
            <option value="">— Selecciona dependencia destino —</option>
            {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
              <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
            ))}
          </select>
          <button onClick={asignarSeleccionados} disabled={!tenantMasivo || asignandoMasivo}
            className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-all duration-150 disabled:opacity-50 active:scale-95"
            style={{ background: '#14532D' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#166534'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}>
            {asignandoMasivo && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Asignar {seleccionMasiva.size}
          </button>
        </div>
      )}

      {resultadoMasivo && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg text-xs shrink-0"
             style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
          {resultadoMasivo}
        </div>
      )}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl text-xs shrink-0"
             style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          Error de conexión: {error}
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ background: '#EEF4EE' }}>
            <tr style={{ borderBottom: '1px solid #D9E2D9' }}>
              <th className="px-4 py-2.5 w-10">
                <input type="checkbox" checked={todosSeleccionados}
                  onChange={() => dispatch({ type: 'SELECCIONAR_TODOS', radicadoIds: todosIds })}
                  className="w-3.5 h-3.5 rounded cursor-pointer"
                  style={{ accentColor: '#14532D' }} />
              </th>
              {['Radicado', 'Solicitante', 'Tipo', 'Días', 'Dependencia destino', 'Acción'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: '#14532D' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse" style={{ borderBottom: '1px solid #EEF4EE' }}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-3 rounded" style={{ width: `${40 + (j % 3) * 20}%`, background: '#EEF4EE' }} />
                  </td>
                ))}
              </tr>
            ))}

            {!cargando && radicados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <p className="font-medium mb-1" style={{ color: '#667085' }}>Sin pendientes</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>No hay radicados esperando asignación.</p>
                </td>
              </tr>
            )}

            {!cargando && radicados.map((r) => {
              const dias       = calcDiasRestantes(r);
              const seleccionado = seleccionMasiva.has(r.radicadoId);
              const esRojo     = r.prioridad === 'ROJO';
              const ok         = exitoFila[r.radicadoId];

              return (
                <tr key={r.radicadoId} className="micro-row"
                    style={{ borderBottom: '1px solid #EEF4EE', background: seleccionado ? '#EEF4EE' : undefined }}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={seleccionado}
                      onChange={() => dispatch({ type: 'TOGGLE_SELECCION', radicadoId: r.radicadoId })}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                      style={{ accentColor: '#14532D' }} />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {esRojo && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                      <span className="font-mono text-xs font-bold" style={{ color: '#14532D' }}>{r.radicadoId}</span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{fmtFecha(r.control.fechaRadicado)}</p>
                  </td>

                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="text-xs font-medium truncate" style={{ color: '#1F2933' }}>{r.solicitante.nombreCompleto}</p>
                    <p className="text-[10px] font-mono" style={{ color: '#94A3B8' }}>
                      {r.solicitante.tipoDocumento} {r.solicitante.numeroDocumento}
                    </p>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs" style={{ color: '#667085' }}>{r.termino.tipoSolicitudNombre}</p>
                    <p className="text-[10px]" style={{ color: '#94A3B8' }}>{r.termino.diasRespuesta}d</p>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm font-bold tabular-nums ${
                      dias < 0 ? 'text-red-600' : dias <= 2 ? 'text-orange-600' : ''
                    }`} style={dias > 2 ? { color: '#667085' } : {}}>
                      {dias < 0 ? `${Math.abs(dias)}d venc.` : `${dias}d`}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <select value={getTenantFila(r.radicadoId)}
                      onChange={(e) => setTenantPorFila((p) => ({ ...p, [r.radicadoId]: e.target.value as TenantId }))}
                      className="select-internal text-[11px] min-w-[150px]">
                      {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
                        <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    {ok ? (
                      <span className="text-xs font-bold text-green-700">✓ Asignado</span>
                    ) : (
                      <button onClick={() => asignarUno(r)} disabled={!!asignandoFila[r.radicadoId]}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: '#14532D' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#166534'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}>
                        {asignandoFila[r.radicadoId]
                          ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : 'Asignar →'}
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

type PanelDerechoModo = 'normal' | 'amplio';
const PANEL_MODO_KEY = 'panelDerechoModo';

function DashboardInterior({ usuario, cerrarSesion }: { usuario: UsuarioAutenticado; cerrarSesion: () => Promise<void> }) {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  // Preferencia persistente del usuario para el ancho del panel derecho en escritorio.
  // Móvil siempre ignora este valor (siempre full-screen como drawer).
  const [panelDerechoModo, setPanelDerechoModo] = useState<PanelDerechoModo>('normal');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(PANEL_MODO_KEY);
      if (v === 'amplio' || v === 'normal') setPanelDerechoModo(v);
    } catch { /* sin acceso a localStorage: usa default */ }
  }, []);
  function togglePanelDerechoModo() {
    setPanelDerechoModo((prev) => {
      const next: PanelDerechoModo = prev === 'normal' ? 'amplio' : 'normal';
      try { window.localStorage.setItem(PANEL_MODO_KEY, next); } catch { /* noop */ }
      return next;
    });
  }
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

  const esAdmin = usuario.rol === 'ADMIN' || usuario.rol === 'CONTROL_INTERNO';
  const tienePermisoRadicar = puedeRadicar(usuario);
  const tienePermisoBandeja = puedeUsarBandejaAsignacion(usuario);
  /** Roles de solo lectura: pueden ver pero no ejecutar acciones sobre radicados. */
  const esVistaReadOnly = usuario.rol === 'JEFE_DEPENDENCIA' || usuario.rol === 'CONTROL_INTERNO';

  const { radicados: todosLosRadicados, cargando, error } =
    useVentanillaRadicados(usuario, tenantFiltro);

  /* Sincronizar radicado seleccionado con datos en tiempo real */
  useEffect(() => {
    if (todosLosRadicados.length > 0) {
      dispatch({ type: 'SYNC_RADICADO_SELECCIONADO', radicados: todosLosRadicados });
    }
  }, [todosLosRadicados, dispatch]);

  useEffect(() => {
    if (!puedeAccederVista(usuario, vistaActual)) {
      dispatch({ type: 'SET_VISTA', vista: 'TABLERO' });
    }
  }, [dispatch, usuario, vistaActual]);

  const metricas = useMemo(() => calcularMetricas(todosLosRadicados), [todosLosRadicados]);

  const radicadosFiltrados = useMemo(
    () => aplicarFiltroMIPG(todosLosRadicados, filtroMIPG, busqueda),
    [todosLosRadicados, filtroMIPG, busqueda],
  );

  const radicadosPendientes = useMemo(
    () => todosLosRadicados.filter((r) => r.estadoActual === 'PENDIENTE'),
    [todosLosRadicados],
  );

  // Fase 2 — badge de alertas por rol
  const pendientesAlertas = useMemo(
    () => contarAlertasActivas(todosLosRadicados, esAdmin, usuario.tenantId),
    [todosLosRadicados, esAdmin, usuario.tenantId],
  );

  // Sprint SMTP — alerta por correos institucionales fallidos sin gestionar.
  // El flag se persiste en raíz del documento (alertaNotificacionFallida)
  // para evitar leer la subcolección de trazabilidad en cada render.
  const pendientesNotificacionFallida = useMemo(() => {
    return todosLosRadicados.reduce((acc, r) => {
      if (r.alertaNotificacionFallida !== true) return acc;
      // Solo contar los del tenant del usuario (o todos si es admin/control interno)
      if (esAdmin) return acc + 1;
      if (r.clasificacion.oficinaDestino === usuario.tenantId) return acc + 1;
      return acc;
    }, 0);
  }, [todosLosRadicados, esAdmin, usuario.tenantId]);

  function cambiarVista(vista: VistaActual) {
    dispatch({ type: 'SET_VISTA', vista });
    setMenuMovilAbierto(false);
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: '#F8FAF7' }}>
      {/* ── COLUMNA 1: Sidebar de navegación ── */}
      <SidebarNav
        className="hidden md:flex"
        vistaActual={vistaActual}
        onVistaChange={cambiarVista}
        onNuevoRadicado={() => {
          if (tienePermisoRadicar) dispatch({ type: 'TOGGLE_DRAWER_NUEVO' });
        }}
        usuario={usuario}
        onCerrarSesion={cerrarSesion}
        pendientesBandeja={radicadosPendientes.length}
        pendientesAlertas={pendientesAlertas}
        pendientesNotificacionFallida={pendientesNotificacionFallida}
      />

      {/* ── COLUMNA 2: Cuerpo central ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MobileTopBar
          usuario={usuario}
          vistaActual={vistaActual}
          onAbrirMenu={() => setMenuMovilAbierto(true)}
        />

        {vistaActual === 'ANALYTICS' ? (
          <VistaAnalytics
            radicados={todosLosRadicados}
            esAdmin={esAdmin}
            tenantIdUsuario={usuario.tenantId}
          />
        ) : vistaActual === 'ALERTAS' ? (
          <VistaAlertas
            radicados={todosLosRadicados}
            esAdmin={esAdmin}
            tenantIdUsuario={usuario.tenantId}
            onVerRadicado={(r) => dispatch({ type: 'SELECCIONAR_RADICADO', radicado: r })}
          />
        ) : vistaActual === 'REPORTES' ? (
          <VistaReportes metricas={metricas} total={todosLosRadicados.length} radicados={todosLosRadicados} />
        ) : vistaActual === 'BANDEJA' && tienePermisoBandeja ? (
          <BandejaAsignacion
            radicados={radicadosPendientes}
            cargando={cargando}
            error={error}
            usuario={usuario}
          />
        ) : vistaActual === 'DEPENDENCIAS' ? (
          <PanelCargaDependencias radicados={todosLosRadicados} />
        ) : vistaActual === 'SUPERVISION_IA' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0E0E10]/40">
            <VistaSupervisionIA />
          </div>
        ) : vistaActual === 'ANTICIPACION_OPERATIVA' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0E0E10]/40">
            <VistaAnticipacionOperativa radicados={todosLosRadicados} />
          </div>
        ) : vistaActual === 'CONTROL_INTERNO' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ background: '#F8FAF7' }}>
            <ControlInternoDashboard />
          </div>
        ) : vistaActual === 'APROBACIONES' ? (
          <JefeAprobacionesPanel usuarioRol={usuario.rol} />
        ) : vistaActual === 'ADMINISTRACION' ? (
          <div className="flex-1 flex overflow-hidden min-h-0">
            <div className="flex-1 overflow-hidden min-h-0"><VistaAdministracion /></div>
            {esAdmin && (
              <div className="hidden xl:flex flex-col w-[420px] shrink-0 border-l" style={{ borderColor: '#D9E2D9' }}>
                <SimiGobernanzaPanel usuario={usuario} />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Dashboard PQRSD compacto — vencimientos y riesgo */}
            {esAdmin && (
              <div className="px-4 py-3 bg-white shrink-0" style={{ borderBottom: '1px solid #D9E2D9' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#14532D' }}>
                  Semáforo PQRSD
                </p>
                <PqrsdDeadlineDashboard
                  radicados={todosLosRadicados}
                  filtroTenant={tenantFiltro}
                  compact={true}
                />
              </div>
            )}

            {/* Fila de métricas MIPG */}
            <TarjetasMIPG
              metricas={metricas}
              filtroActivo={filtroMIPG}
              onFiltroChange={(f) => dispatch({ type: 'SET_FILTRO_MIPG', filtro: f })}
              esAdmin={esAdmin}
              tenantFiltro={tenantFiltro}
              onTenantChange={(t) => dispatch({ type: 'SET_TENANT_FILTRO', tenant: t })}
            />

            <PanelOperacionDependencia
              usuario={usuario}
              radicados={todosLosRadicados}
              onFiltroChange={(f) => dispatch({ type: 'SET_FILTRO_MIPG', filtro: f })}
              onSeleccionar={(r) => dispatch({ type: 'SELECCIONAR_RADICADO', radicado: r })}
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
              onNuevoRadicado={() => {
                if (tienePermisoRadicar) dispatch({ type: 'TOGGLE_DRAWER_NUEVO' });
              }}
              puedeRadicar={tienePermisoRadicar}
            />
          </>
        )}
      </div>

      {/* ── COLUMNA 3: Panel derecho — oculto en vistas de pantalla completa ── */}
      {vistaActual !== 'BANDEJA' && vistaActual !== 'DEPENDENCIAS'
       && vistaActual !== 'ANALYTICS' && vistaActual !== 'ALERTAS'
       && vistaActual !== 'SUPERVISION_IA' && vistaActual !== 'ANTICIPACION_OPERATIVA'
       && vistaActual !== 'APROBACIONES'
       && vistaActual !== 'CONTROL_INTERNO' && (
        <div
          className={`fixed inset-y-0 right-0 z-40 max-w-full transition-transform duration-300 ease-in-out md:relative md:z-auto md:shrink-0 md:overflow-hidden md:transition-all ${
            panelDerechoAbierto
              ? panelDerechoModo === 'amplio'
                ? 'w-full translate-x-0 md:w-[640px] xl:w-[720px]'
                : 'w-full translate-x-0 md:w-[420px]'
              : 'w-full translate-x-full md:w-0 md:translate-x-0'
          }`}
        >
          {radicadoSeleccionado && (
            <PanelDerecho
              radicado={radicadoSeleccionado}
              usuario={usuario}
              onCerrar={() => dispatch({ type: 'CERRAR_PANEL_DERECHO' })}
              soloLectura={esVistaReadOnly}
              modoAmplio={panelDerechoModo === 'amplio'}
              onToggleModo={togglePanelDerechoModo}
            />
          )}
        </div>
      )}

      {/* ── Drawer de radicación rápida ── */}
      {drawerNuevoAbierto && tienePermisoRadicar && (
        <DrawerNuevoRadicado
          usuario={usuario}
          onCerrar={() => dispatch({ type: 'CERRAR_DRAWER_NUEVO' })}
        />
      )}

      {menuMovilAbierto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Cerrar menú"
            onClick={() => setMenuMovilAbierto(false)}
          />
          <SidebarNav
            className="relative z-10 w-[min(82vw,320px)] shadow-2xl"
            vistaActual={vistaActual}
            onVistaChange={cambiarVista}
            onNuevoRadicado={() => {
              if (tienePermisoRadicar) {
                dispatch({ type: 'TOGGLE_DRAWER_NUEVO' });
                setMenuMovilAbierto(false);
              }
            }}
            usuario={usuario}
            onCerrarSesion={cerrarSesion}
            pendientesBandeja={radicadosPendientes.length}
            pendientesAlertas={pendientesAlertas}
            pendientesNotificacionFallida={pendientesNotificacionFallida}
          />
        </div>
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
