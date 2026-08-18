'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { signInWithEmailAndPassword }     from 'firebase/auth';
import { getFirebaseAuth, getDb }         from '@/lib/firebase';
import { useAuth }                        from '@/lib/hooks/useAuth';
import { useVentanillaRadicados }         from '@/lib/hooks/useVentanillaRadicados';
import { VentanillaProvider, useVentanilla } from '@/lib/store/ventanillaStore';
import { NOMBRES_TENANT, DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import { diasRestantesHabiles, resolverTipoSolicitud } from '@/lib/tiempos-radicado';
import { RadicacionFuncionarioForm }       from '@/app/interno/recepcion/components/RadicacionFuncionarioForm';
import { radicarSegunFlag }                from '@/lib/recepcion/radicar-segun-flag';
import { asignarRadicado, asignarMasivo }  from '@/lib/actions/asignarRadicado';
import { ComprobanteRadicado }             from '@/app/interno/dashboard/components/ComprobanteRadicado';
import { SelloRecibido }                   from '@/app/interno/dashboard/components/SelloRecibido';
import { CompletarDatosSolicitante }       from '@/app/interno/dashboard/components/CompletarDatosSolicitante';
import { datosConstanciaDesdeRadicado }    from '@/lib/mostrador/constancia-desde-radicado';
import {
  ETIQUETA_PRESET,
  filtrarPorPreset,
  indicadoresDeReporte,
  resumenPorDependencia,
  type PresetReporte,
} from '@/lib/reportes/filtrar-por-preset';
import { INSTITUCION } from '@/lib/institucion';
import {
  documentoSolicitanteVisible,
  identidadProtegida,
  nombreSolicitanteVisible,
  numeroDocumentoVisible,
} from '@/lib/seguridad/identidad-protegida';
import { puedeVerReportes } from '@/lib/permisos/acceso-reportes';
import { coincideIdentidadFiltroRapido } from '@/lib/busqueda/coincidencia-filtro-rapido';
import { agruparDestinosPorDependencia, areasParaDependencia, getNombreArea } from '@/lib/catalogos/areas';
import { RegistroExpresModal } from '@/app/interno/dashboard/components/RegistroExpresModal';
import { RegistrarSalidaModal, type EntradaAmarre } from '@/app/interno/dashboard/components/salidas/RegistrarSalidaModal';
import { PanelReparto }                    from '@/app/interno/dashboard/components/reparto/PanelReparto';
import { VistaSalidas }                    from '@/app/interno/dashboard/components/salidas/VistaSalidas';
import { VistaMiGestion }                  from '@/app/interno/dashboard/components/mi-gestion/VistaMiGestion';
import { useSalidas }                      from '@/lib/hooks/useSalidas';
import { filtrarSalidasPorPreset, resumenSalidas } from '@/lib/salidas/reporte-salidas';
import { construirHistoria, type FiltroHistoria, type TonoEvento } from '@/lib/trazabilidad/humanizar-evento';
import { resumirCambio } from '@/lib/traslado/resumir-cambio';
import type { SalidaOficial }              from '@/src/types/salida';
import { BusquedaAvanzadaPanel }           from '@/app/interno/dashboard/components/BusquedaAvanzadaPanel';
import { VistaVentanilla }                 from '@/app/interno/dashboard/components/ventanilla/VistaVentanilla';
import { useIndicadoresModo }              from '@/lib/hooks/useIndicadoresModo';
import {
  formatFechaColombia,
  formatFechaCortaColombia,
  formatFechaHoraColombia,
  formatHoraColombia,
} from '@/lib/fecha-colombia';
import { PanelCargaDependencias }          from '@/app/interno/dashboard/components/dependencias/PanelCargaDependencias';
import { VistaAnalytics }                  from '@/app/interno/dashboard/components/analytics/VistaAnalytics';
import { VistaAlertas, contarAlertasActivas } from '@/app/interno/dashboard/components/analytics/VistaAlertas';
import { VistaSupervisionIA }              from '@/app/interno/dashboard/components/analytics/VistaSupervisionIA';
import { VistaAnticipacionOperativa }      from '@/app/interno/dashboard/components/analytics/VistaAnticipacionOperativa';
import { VistaLicencias }                  from '@/app/interno/dashboard/components/licencias/VistaLicencias';
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
import { CentroControlInterno }              from '@/app/interno/dashboard/components/control-interno/CentroControlInterno';
import { InstitucionalHeader }               from '@/app/components/institucional/InstitucionalHeader';
import { SelloRadicado }                     from '@/app/components/institucional/SelloRadicado';
import { ResumenEjecutivoRadicado }          from '@/app/interno/dashboard/components/ResumenEjecutivoRadicado';
import { BarraKpisOperativos }               from '@/app/interno/dashboard/components/BarraKpisOperativos';
import { calcularKpisOperativos }            from '@/lib/kpis-operativos/calcular-kpis-operativos';
import {
  filtrarPorKpiOperativo,
  type FiltroKpiOperativo,
} from '@/lib/kpis-operativos/filtrar-por-kpi-operativo';
import { puedeVerTodosLosTenants } from '@/lib/permisos/alcance-tenants';
import { BarraFiltrosActivos } from '@/app/interno/dashboard/components/BarraFiltrosActivos';
import type { EstadoFiltros, DimensionFiltro } from '@/lib/filtros-activos/resumir-filtros-activos';
import { TarjetaMIPGGrande } from '@/app/interno/dashboard/components/TarjetaMIPGGrande';
import {
  radicadoMasCriticoPorFiltro,
  type FiltroGrande,
} from '@/lib/kpis-mipg/radicado-mas-critico';
import { tokensEstadoKpi } from '@/lib/kpis-mipg/tokens-estado-kpi';
import { useFuncionariosTenant }              from '@/lib/hooks/useFuncionariosTenant';
import type { FuncionarioTenant }             from '@/lib/hooks/useFuncionariosTenant';
import type { ResponsableFuncionario }        from '@/lib/actions/asignarRadicado';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';
import type { UsuarioAutenticado }        from '@/lib/hooks/useAuth';
import { buildOficioInstitucional } from '@/lib/respuesta-oficial/oficio-institucional';
import { ResumenDiarioModal, type ResumenDiarioData } from '@/app/interno/dashboard/components/ResumenDiarioModal';
import {
  filtrarSoloDatosIncompletos,
  tieneDatosNoAportados,
} from '@/lib/busqueda/filtros-radicado';
import {
  LABEL_ORIGEN_INGRESO,
  LABEL_TIPO_ENTRADA,
  LABEL_TIPO_PERSONA,
  SIN_CLASIFICAR,
} from '@/lib/labels/labels-operativos';


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

/* Sprint Ventanilla Operativa 1 — Labels operativos */


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
  else if (filtro === 'CORREOS_FALLIDOS')        lista = lista.filter((r) => r.alertaNotificacionFallida === true);
  else if (filtro === 'DEVUELTAS_PRORROGA')      lista = lista.filter((r) => ['DEVUELTO', 'PRORROGA'].includes(r.estadoActual));
  else if (filtro === 'RESUELTOS_FUERA_TERMINO') lista = lista.filter((r) => r.cumplioTermino === false);

  if (busqueda.trim()) {
    const q = busqueda.toLowerCase().trim();
    // Nombre/documento pasan por la guarda anti-inferencia (ADR-0012, R9):
    // un radicado con identidad reservada no debe coincidir por esos
    // campos, solo por radicadoId. Asunto, oficina y funcionario no son
    // identidad del solicitante y siguen coincidiendo directamente.
    lista = lista.filter(
      (r) =>
        coincideIdentidadFiltroRapido(r, q) ||
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
  // Panel Op Nivel 2 — misma política que el alcance de datos: si el rol
  // ve todos los tenants (ADMIN, CONTROL_INTERNO, RECEPCIONISTA), puede
  // ver el panorama por dependencias. La Ventanilla responde consultas
  // de todo el municipio y necesita esta vista.
  return puedeVerTodosLosTenants(usuario.rol);
}

function puedeVerAnaliticaAvanzada(usuario: UsuarioAutenticado): boolean {
  return usuario.rol === 'ADMIN'
    || usuario.rol === 'CONTROL_INTERNO'
    || usuario.rol === 'JEFE_DEPENDENCIA';
}

/**
 * Licencias urbanísticas (Secretaría de Planeación) — micro-bloque "acceso
 * solo Planeación" (encargo del propietario, ago-2026). Mismos roles que
 * `GuardModuloPlaneacion` (`app/interno/licencias/components/
 * GuardModuloPlaneacion.tsx`), que sigue siendo la autoridad real para la
 * ruta standalone `/interno/licencias` (deep-links, sigue viva). Bloque B
 * ("la ventanita") integró Licencias como pestaña REAL de `VistaActual`
 * (`'LICENCIAS'`, `lib/store/ventanillaStore.tsx`): este helper decide si
 * la entrada de navegación aparece en el Tablero Y gatea el acceso a esa
 * vista (`puedeAccederVista` de abajo), mismo patrón que ya usan
 * Analítica/Alertas — la puerta que dejaba abierta el JSDoc anterior de
 * `LicenciasSidebar` ya está cruzada.
 */
function puedeVerLicencias(usuario: UsuarioAutenticado): boolean {
  return usuario.rol === 'ADMIN'
    || (usuario.rol === 'FUNCIONARIO' && usuario.tenantId === 'SEC_PLANEACION');
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
  if (vista === 'LICENCIAS') return puedeVerLicencias(usuario);
  if (vista === 'ANALYTICS') return puedeVerAnaliticaAvanzada(usuario);
  // Sprint 3C — Reportes se abre también a RECEPCIONISTA: ella responde
  // "¿qué llegó este mes?" con los mismos datos que ya ve en el Tablero.
  if (vista === 'REPORTES') return puedeVerReportes(usuario.rol);
  // Sprint Radicación de salida — el libro completo lo ven quienes por
  // reglas leen todas las salidas (registro: solo Admin/Recepción).
  if (vista === 'SALIDAS') {
    return usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA'
      || usuario.rol === 'CONTROL_INTERNO';
  }
  return true;
}

function fmtFecha(iso: string): string {
  return formatFechaCortaColombia(iso);
}

function fmtFechaLarga(iso: string): string {
  return formatFechaHoraColombia(iso);
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
    vista: 'SALIDAS',
    label: 'Salidas',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
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
    // Sprint Mi gestión — desempeño personal; visible para todos los roles.
    vista: 'MI_GESTION',
    label: 'Mi gestión',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
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
  onRegistroExpres,
  usuario,
  onCerrarSesion,
  pendientesBandeja,
  pendientesAlertas,
  miCarga,
  pendientesNotificacionFallida,
  onVerCorreosFallidos,
  onAbrirResumen,
  className = '',
}: {
  vistaActual: VistaActual;
  onVistaChange: (v: VistaActual) => void;
  onNuevoRadicado: () => void;
  /** Sprint Registro exprés — presente solo para roles operativos. */
  onRegistroExpres?: () => void;
  usuario: UsuarioAutenticado;
  onCerrarSesion: () => void;
  pendientesBandeja: number;
  pendientesAlertas: number;
  /** Sprint Semana + badge — activos del usuario y su peor nivel de término. */
  miCarga?: { activos: number; nivel: 'ROJO' | 'AMBAR' | 'NEUTRO' };
  pendientesNotificacionFallida: number;
  onVerCorreosFallidos: () => void;
  onAbrirResumen: () => void;
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

  // Licencias urbanísticas — Bloque B ("la ventanita"): pestaña REAL del
  // panel interno (ya no un link de página completa a `/interno/licencias`,
  // ver JSDoc de `puedeVerLicencias`). Mismo patrón de push condicional que
  // Anticipación Operativa / Supervisión IA arriba — no vive en `NAV_ITEMS`
  // porque su visibilidad no es un simple filtro por `puedeAccederVista`
  // sobre la lista fija, sino un helper de dominio propio (Planeación).
  if (puedeVerLicencias(usuario)) {
    items.push({
      vista: 'LICENCIAS' as const,
      label: 'Licencias',
      icono: (
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
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

      {/* Sprint Registro exprés — correspondencia respondida desde el
          correo institucional de la dependencia. */}
      {onRegistroExpres && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onRegistroExpres}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#D6E4D9', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Registro exprés
          </button>
        </div>
      )}

      {/* Alerta operativa: correos institucionales fallidos sin gestionar */}
      {pendientesNotificacionFallida > 0 && (
        <div className="px-3 pt-1 pb-2">
          <button
            type="button"
            onClick={onVerCorreosFallidos}
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
          </button>
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
              {/* Sprint Semana + badge — la carga personal, con el color
                  del peor término: rojo vencidos, ámbar por vencer. */}
              {vista === 'MI_GESTION' && miCarga && miCarga.activos > 0 && (
                <span
                  className={`shrink-0 min-w-[18px] h-[18px] rounded-full text-white text-[9px] font-black flex items-center justify-center px-1${miCarga.nivel === 'ROJO' ? ' animate-pulse' : ''}`}
                  style={{
                    background: miCarga.nivel === 'ROJO' ? '#DC2626'
                      : miCarga.nivel === 'AMBAR' ? '#D97706' : '#166534',
                  }}
                >
                  {miCarga.activos > 99 ? '99+' : miCarga.activos}
                </span>
              )}
              {/* Licencias urbanísticas — Bloque B: badge "Planeación" que
                  antes vivía en el link de página completa (mismo texto,
                  ahora dentro del ítem de navegación normal). Contraste
                  distinto activo/inactivo: sobre dorado (#D4A017) el texto
                  claro perdía legibilidad. */}
              {vista === 'LICENCIAS' && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wide shrink-0"
                  style={{ color: activo ? 'rgba(20,83,45,0.65)' : 'rgba(255,255,255,0.40)' }}
                >
                  Planeación
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Resumen del Día */}
      <div className="px-3 pt-1 pb-2">
        <button
          onClick={onAbrirResumen}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-200 hover:bg-white/[0.07] active:scale-95 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          <svg className="w-4 h-4 shrink-0 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Resumen del día
        </button>
      </div>

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
  onAbrirResumen,
}: {
  usuario: UsuarioAutenticado;
  vistaActual: VistaActual;
  onAbrirMenu: () => void;
  onAbrirResumen: () => void;
}) {
  const vista = NAV_ITEMS.find((item) => item.vista === vistaActual)?.label
    ?? (vistaActual === 'SUPERVISION_IA'
      ? 'Supervisión IA'
      : vistaActual === 'ANTICIPACION_OPERATIVA'
        ? 'Anticipación'
        : vistaActual === 'LICENCIAS'
          ? 'Licencias'
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
        <button
          type="button"
          onClick={onAbrirResumen}
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          title="Ver resumen del día"
          aria-label="Ver resumen del día"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
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

/** Panel Op Nivel 3B — los 4 KPIs accionables van como tarjetas grandes. */
const FILTROS_GRANDES: FiltroGrande[] = ['VENCIDAS', 'POR_VENCER', 'RADICADAS', 'ASIGNADAS'];
const CRITICO_LABEL: Record<FiltroGrande, string> = {
  VENCIDAS:   'Más crítico',
  POR_VENCER: 'Más crítico',
  RADICADAS:  'Más antiguo sin asignar',
  ASIGNADAS:  'Más próximo a vencer',
};

/** Paleta operativa institucional: fondos claros + números y labels en
 *  tonos de alto contraste (-700/-800). Cada KPI se identifica por el
 *  riel izquierdo de 4px, no por el fondo (que se reserva para
 *  selección). Función pura — reutilizada por TarjetasMIPG (fila
 *  grande + modo compacto) y por la banda "Estado operativo" fusionada
 *  (sprint tablero-jerarquia), que necesita los mismos 4 chips MIPG
 *  compactos fuera del árbol de TarjetasMIPG. */
function construirTarjetasMIPG(metricas: MetricasMIPGData): TarjetaMIPGItem[] {
  return [
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
}

/** Texto oscuro AA-safe para el estado atenuado (valor === 0): tras el
 *  opacity 0.55 del contenedor sigue cumpliendo ≥ 4.5:1 sobre fondo
 *  claro (mismo criterio que TarjetaMIPGGrande). Solo el cromado
 *  (riel/borde) pierde color; el texto nunca depende de la opacidad
 *  para su legibilidad. */
const TEXTO_ATENUADO = '#0F172A';
const RIEL_ATENUADO  = '#CBD5D1';

/** Chip MIPG compacto — reutilizado por TarjetasMIPG (fila compacta y
 *  modo "minimizar paneles") y por la banda "Estado operativo"
 *  fusionada. Jerarquía por severidad: valor 0 se atenúa pero sigue
 *  visible y clicable. */
function ChipMipgCompacto({
  item,
  activo,
  compacto,
  onClick,
}: {
  item: TarjetaMIPGItem;
  activo: boolean;
  compacto: boolean;
  onClick: () => void;
}) {
  const atenuada = item.valor === 0;
  const cls = compacto
    ? { card: 'px-2.5 py-1', num: 'text-base', label: 'text-[9px] mt-0' }
    : { card: 'px-4 py-3',   num: 'text-2xl',  label: 'text-[10px] mt-0.5' };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={`Filtrar bandeja por ${item.label} (${item.valor})`}
      className={`micro-card shrink-0 flex flex-col items-start ${cls.card} rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30`}
      style={{
        background: activo ? '#EEF4EE' : '#F8FAF7',
        border: `1px solid ${activo ? '#14532D' : '#D9E2D9'}`,
        borderLeftColor: atenuada ? RIEL_ATENUADO : item.rielColor,
        borderLeftWidth: 4,
        opacity: atenuada ? 0.55 : 1,
      }}
    >
      <span
        className={`${cls.num} font-black leading-none tabular-nums flex items-center gap-1`}
        style={{ color: atenuada ? TEXTO_ATENUADO : item.textoColor }}
      >
        {item.icono && <span className="mt-0.5">{item.icono}</span>}
        {item.valor}
      </span>
      <span
        className={`${cls.label} font-bold uppercase tracking-widest`}
        style={{ color: atenuada ? TEXTO_ATENUADO : item.textoColor }}
      >
        {item.label}
      </span>
    </button>
  );
}

function TarjetasMIPG({
  metricas,
  filtroActivo,
  onFiltroChange,
  veTodosTenants,
  tenantFiltro,
  onTenantChange,
  modoCompacto = false,
  onToggleCompacto,
  soloDatosIncompletos = false,
  onToggleDatosIncompletos,
  radicados,
  onAbrirRadicado,
}: {
  metricas:       MetricasMIPGData;
  filtroActivo:   FiltroMIPG;
  onFiltroChange: (f: FiltroMIPG) => void;
  /** Panel Op Nivel 1 — gatea el selector de dependencia. ADMIN,
   *  CONTROL_INTERNO y RECEPCIONISTA lo ven; los demás no. */
  veTodosTenants: boolean;
  tenantFiltro:   TenantId | 'TODOS';
  onTenantChange: (t: TenantId | 'TODOS') => void;
  modoCompacto?:  boolean;
  onToggleCompacto?: () => void;
  soloDatosIncompletos?: boolean;
  onToggleDatosIncompletos?: () => void;
  /** Panel Op Nivel 3B — lista completa para calcular el radicado
   *  crítico de cada tarjeta grande. */
  radicados:      VentanillaRadicado[];
  onAbrirRadicado: (id: string) => void;
}) {
  const tarjetas: TarjetaMIPGItem[] = construirTarjetasMIPG(metricas);

  // Sprint UI Bandeja Operativa — variante compacta:
  // - py reducido (py-1.5 vs py-3).
  // - Tarjetas px-3 py-1.5 con número text-base en lugar de 2xl.
  // - Mantiene riel izquierdo y selección por color.
  const cls = modoCompacto
    ? { wrap: 'px-3 sm:px-4 py-1.5', card: 'px-2.5 py-1', num: 'text-base', label: 'text-[9px] mt-0' }
    : { wrap: 'px-3 sm:px-4 py-2',    card: 'px-4 py-3',    num: 'text-2xl', label: 'text-[10px] mt-0.5' };

  // Panel Op Nivel 3B — mapa por filtro para ubicar las 4 grandes.
  // Sprint tablero-jerarquia — los 4 KPIs restantes (Prioridad MIPG,
  // En término, Devueltas/Prórroga, Fuera de término) ya NO se
  // renderizan aquí: se fusionaron en la banda "Estado operativo"
  // (ver <BarraKpisOperativos chipsExtra=…> en el render principal)
  // para cumplir la regla de banda única de estado.
  const porFiltro = new Map(tarjetas.map((t) => [t.filtro, t]));

  const controlesTop = (
    <>
      {onToggleCompacto && (
        <button
          type="button"
          onClick={onToggleCompacto}
          className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
          style={{
            background: modoCompacto ? '#14532D' : 'white',
            color: modoCompacto ? 'white' : '#14532D',
            borderColor: '#14532D',
          }}
          title={modoCompacto ? 'Mostrar Bandeja Operativa y Siguiente Atención' : 'Minimizar paneles operativos y ampliar la lista de radicados'}
          aria-pressed={modoCompacto}
        >
          {modoCompacto ? 'Mostrar paneles' : 'Minimizar paneles'}
        </button>
      )}
      {onToggleDatosIncompletos && (
        <button
          type="button"
          onClick={onToggleDatosIncompletos}
          className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30"
          style={{
            background: soloDatosIncompletos ? '#FBBF24' : 'white',
            color:      soloDatosIncompletos ? '#78350F' : '#B45309',
            borderColor: '#FBBF24',
          }}
          title="Mostrar solo radicados con datos no aportados por el solicitante"
          aria-pressed={soloDatosIncompletos}
        >
          {soloDatosIncompletos ? '✓ Datos incompletos' : 'Datos incompletos'}
        </button>
      )}
      {veTodosTenants && (
        <div className="shrink-0 flex items-center ml-auto">
          <select
            value={tenantFiltro}
            onChange={(e) => onTenantChange(e.target.value as TenantId | 'TODOS')}
            className="select-internal text-xs"
            aria-label="Filtrar por dependencia"
          >
            <option value="TODOS">Todas las dependencias</option>
            {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
              <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );

  const tarjetaPequena = (t: TarjetaMIPGItem) => (
    <ChipMipgCompacto
      key={t.filtro}
      item={t}
      activo={filtroActivo === t.filtro}
      compacto={modoCompacto}
      onClick={() => onFiltroChange(t.filtro)}
    />
  );

  // Modo compacto: una sola fila con todas las tarjetas pequeñas
  // (comportamiento previo intacto para dar altura a la lista; la
  // card vertical "Todos" se retiró — su total vive ahora en el chip
  // "N activos" junto al título del Tablero, siempre visible).
  if (modoCompacto) {
    return (
      <div className={`${cls.wrap} shrink-0 bg-white`} style={{ borderBottom: '1px solid #D9E2D9' }}>
        <div className="flex gap-2 overflow-x-auto pb-0.5 items-center">
          {controlesTop}
          {tarjetas.map(tarjetaPequena)}
        </div>
      </div>
    );
  }

  // Modo expandido (default): 4 tarjetas grandes con radicado crítico.
  // Jerarquía por severidad (sprint tablero-jerarquia): Vencidas > 0 es
  // la única tarjeta dominante; cualquier tarjeta en 0 se atenúa. Los
  // 4 KPIs restantes se fusionaron en la banda "Estado operativo".
  return (
    <div className={`${cls.wrap} shrink-0 bg-white`} style={{ borderBottom: '1px solid #D9E2D9' }}>
      <div className="flex gap-2 items-center mb-1.5">
        {controlesTop}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 items-stretch">
        {FILTROS_GRANDES.map((filtro) => {
          const t = porFiltro.get(filtro);
          if (!t) return null;
          return (
            <TarjetaMIPGGrande
              key={filtro}
              label={t.label}
              valor={t.valor}
              icono={t.icono ?? null}
              tokens={tokensEstadoKpi(filtro)}
              criticoLabel={CRITICO_LABEL[filtro]}
              activo={filtroActivo === filtro}
              critico={radicadoMasCriticoPorFiltro(radicados, filtro)}
              onFiltrar={() => onFiltroChange(filtro)}
              onAbrirRadicado={onAbrirRadicado}
              dominante={filtro === 'VENCIDAS' && t.valor > 0}
              atenuada={t.valor === 0}
            />
          );
        })}
      </div>
    </div>
  );
}

function PanelOperacionDependencia({
  usuario,
  radicados,
  onSeleccionar,
  onFiltroChange,
  bandejaMinimizada,
  siguienteMinimizada,
  onToggleBandeja,
  onToggleSiguiente,
}: {
  usuario: UsuarioAutenticado;
  radicados: VentanillaRadicado[];
  onSeleccionar: (r: VentanillaRadicado) => void;
  onFiltroChange: (f: FiltroMIPG) => void;
  bandejaMinimizada: boolean;
  siguienteMinimizada: boolean;
  onToggleBandeja: () => void;
  onToggleSiguiente: () => void;
}) {
  const resumen = useMemo(() => calcularResumenBandeja(radicados), [radicados]);
  const siguiente = resumen.siguiente;
  // Panel Op Nivel 1 — si el rol ve todos los tenants, los números del
  // widget son municipales y la etiqueta debe decirlo (antes decía
  // "Ventanilla Única" para la recepcionista, lo cual mentiría ahora).
  const nombreAmbito = puedeVerTodosLosTenants(usuario.rol)
    ? usuario.rol === 'RECEPCIONISTA' ? 'Vista municipal' : 'Vista institucional'
    : NOMBRES_TENANT[usuario.tenantId];
  const dias = siguiente ? calcDiasRestantes(siguiente) : null;

  const ambosMinimizados = bandejaMinimizada && siguienteMinimizada;
  return (
    <section
      className={`shrink-0 bg-[#F8FAF7] px-3 sm:px-4 ${ambosMinimizados ? 'py-1.5' : 'py-2'}`}
      style={{ borderBottom: '1px solid #D9E2D9' }}
    >
      {/* Sprint tablero-jerarquia — la Bandeja operativa se compacta
          (1fr) para que el hero de Siguiente atención (2fr) domine el
          panorama visual, tal como pide la referencia Figma. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 sm:gap-3">
        {/* Panel bandeja */}
        {bandejaMinimizada ? (
          <div
            className="min-h-12 rounded-xl bg-white px-3 py-2 flex items-center justify-between gap-3 overflow-hidden"
            style={{ border: '1px solid #D9E2D9' }}
          >
            <p className="min-w-0 truncate text-xs font-semibold" style={{ color: '#1F2933' }}>
              <span className="font-black" style={{ color: '#14532D' }}>{nombreAmbito}</span>
              <span style={{ color: '#667085' }}> · {resumen.totalActivos} activos · </span>
              <span style={{ color: resumen.vencidos > 0 ? '#B91C1C' : '#667085' }}>{resumen.vencidos} vencidos</span>
            </p>
            <button
              type="button"
              onClick={onToggleBandeja}
              className="shrink-0 min-h-9 rounded-lg border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={{ borderColor: '#D9E2D9', color: '#14532D', background: '#F8FAF7' }}
              aria-expanded="false"
            >
              Mostrar
            </button>
          </div>
        ) : (
        <div className="micro-card-read rounded-xl px-3 py-2.5 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#667085' }}>
                Bandeja operativa
              </p>
              <h2 className="mt-0.5 text-sm font-black truncate" style={{ color: '#1F2933' }}>
                {nombreAmbito}
              </h2>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border"
                    style={{ background: '#EEF4EE', color: '#14532D', borderColor: '#D9E2D9' }}>
                {usuario.rol}
              </span>
              <button
                type="button"
                onClick={onToggleBandeja}
                className="min-h-9 rounded-lg px-2.5 text-[11px] font-bold"
                style={{ color: '#14532D', background: '#F8FAF7', border: '1px solid #D9E2D9' }}
                aria-expanded="true"
              >
                Minimizar
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
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
                className="micro-card rounded-lg px-2 py-1.5 text-left focus-visible:outline-none"
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
        )}

        {/* Panel siguiente acción */}
        {siguienteMinimizada ? (
          <div
            className="min-h-12 rounded-xl bg-white px-3 py-2 flex items-center justify-between gap-3 overflow-hidden"
            style={{ border: '1px solid #D9E2D9' }}
          >
            <p className="min-w-0 truncate text-xs font-semibold" style={{ color: '#1F2933' }}>
              <span className="font-black" style={{ color: '#14532D' }}>Siguiente atención</span>
              <span style={{ color: dias !== null && dias < 0 ? '#B91C1C' : '#667085' }}>
                {' · '}{mensajeSiguienteAccion(siguiente)}
              </span>
              {siguiente && <span className="font-mono" style={{ color: '#667085' }}> · {siguiente.radicadoId}</span>}
            </p>
            <button
              type="button"
              onClick={onToggleSiguiente}
              className="shrink-0 min-h-9 rounded-lg border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={{ borderColor: '#D9E2D9', color: '#14532D', background: '#F8FAF7' }}
              aria-expanded="false"
            >
              Mostrar
            </button>
          </div>
        ) : (
        <div
          className="micro-card-read rounded-[14px] px-4 py-3 bg-white"
          style={{ border: '1px solid #E3EAE3', borderLeft: '5px solid #14532D', boxShadow: '0 1px 3px rgba(20,50,30,0.06)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-2.5">
              <span
                className="shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center"
                style={{ background: '#EEF4EE', color: '#14532D' }}
                aria-hidden="true"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2c1 3-1 4-1 6a3 3 0 006 0c0-1 2 2 2 5a7 7 0 11-14 0c0-4 4-6 4-9 1 1 2 2 3 -2z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5F8A6E' }}>
                  Siguiente atención sugerida
                </p>
                {/* Principio 9 (IA copiloto): SIMI sugiere el orden de
                    atención, la funcionaria decide si atenderlo o no —
                    el botón "Atender" nunca actúa solo. */}
                <p className="text-[9.5px] italic" style={{ color: '#94A3B8' }}>
                  SIMI propone, usted decide
                </p>
                <p className={`mt-1 text-sm font-bold ${
                  dias !== null && dias < 0
                    ? 'text-rose-600'
                    : dias !== null && dias <= 2
                      ? 'text-orange-600'
                      : ''
                }`} style={dias === null || dias > 2 ? { color: '#12261A' } : {}}>
                  {mensajeSiguienteAccion(siguiente)}
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleSiguiente}
                className="min-h-9 rounded-lg px-2.5 text-[11px] font-bold"
                style={{ color: '#14532D', background: '#F8FAF7', border: '1px solid #D9E2D9' }}
                aria-expanded="true"
              >
                Minimizar
              </button>
            {siguiente && (
              <button
                type="button"
                onClick={() => onSeleccionar(siguiente)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 active:scale-95 transition-transform"
                style={{ background: '#D4A017', color: '#3D2C00' }}
              >
                Atender
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            )}
            </div>
          </div>

          {siguiente ? (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-[minmax(150px,0.7fr)_minmax(0,1.6fr)_minmax(120px,0.6fr)] gap-3 text-xs">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Radicado</p>
                {/* Requisito legal — el número de radicado nunca se
                    trunca: es el identificador oficial del trámite
                    (AGN 060/2001). Puede envolver a dos líneas, no se
                    recorta con ellipsis. */}
                <p className="mt-1 font-mono font-bold break-words" style={{ color: '#14532D' }}>{siguiente.radicadoId}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Asunto</p>
                <p
                  className="mt-1 line-clamp-2"
                  style={{ color: '#1F2933' }}
                  title={siguiente.detalle.asunto}
                >
                  {siguiente.detalle.asunto}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Responsable</p>
                <p className="mt-1 truncate" style={{ color: '#1F2933' }}>
                  {siguiente.clasificacion.funcionarioResponsableNombre ?? 'Sin asignar'}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs" style={{ color: '#94A3B8' }}>
              Cuando entren solicitudes activas, aquí aparecerá la prioridad operativa de la oficina.
            </p>
          )}
        </div>
        )}
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
  onAbrirBusquedaAvanzada,
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
  onAbrirBusquedaAvanzada?: () => void;
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
        {onAbrirBusquedaAvanzada && (
          <button
            onClick={onAbrirBusquedaAvanzada}
            type="button"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold focus-visible:outline-none border"
            style={{ background: 'white', color: '#14532D', borderColor: '#14532D' }}
            title="Búsqueda histórica avanzada (Sprint 2)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filtros avanzados
          </button>
        )}
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
                {/* Requisito legal — el radicado nunca se trunca; solo
                    el badge de estado es shrink-0 para dejarle espacio. */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {esRojo && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mt-0.5" />}
                  <span className="font-mono text-[13px] font-extrabold tracking-tight break-words" style={{ color: '#14532D' }}>{r.radicadoId}</span>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  BADGE_ESTADO[r.estadoActual] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {LABELS_ESTADO[r.estadoActual] ?? r.estadoActual}
                </span>
              </div>
              <p className="text-sm font-medium truncate" style={{ color: '#1F2933' }}>{nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}</p>
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
      {/* Sprint UI Bandeja:
          - `min-h-0` para que el flex-1 no quede infinito.
          - El thead sticky con `background-clip: padding-box` y background
            aplicado al `th` (no al `tr`) para evitar bordes desplazados.
          - Sombra sutil bajo el thead para indicar scroll. */}
      <div className="hidden sm:block flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white">
        <table className="w-full text-sm md:min-w-[920px]">
          <thead className="sticky top-0 z-20">
            <tr style={{ borderBottom: '1px solid #D9E2D9' }}>
              {['Radicado', 'Solicitante', 'Tipo Trámite', 'Dependencia', 'Estado', 'Vencimiento', 'Días'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                  style={{
                    color: '#14532D',
                    background: '#EEF4EE',
                    borderBottom: '1px solid #D9E2D9',
                    boxShadow: '0 1px 0 rgba(20,83,45,0.08)',
                  }}
                >
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
              // Rediseño 3B.2 — riel de color por estado del término,
              // siempre visible. La selección lo intensifica a verde.
              const rielEstado = semaforoData.estado === 'VENCIDO'
                ? '#DC2626'
                : semaforoData.estado === 'POR_VENCER'
                  ? '#D97706'
                  : semaforoData.estado === 'RESUELTO'
                    ? '#CBD5D1'
                    : '#14532D';

              return (
                <tr
                  key={r.radicadoId}
                  onClick={() => onSeleccionar(r)}
                  className={`micro-row cursor-pointer ${seleccionado ? 'is-selected' : ''}`}
                  aria-selected={seleccionado}
                  style={{
                    borderBottom: '1px solid #EEF4EE',
                    background: seleccionado ? '#EEF4EE' : undefined,
                    borderLeft: seleccionado ? '4px solid #14532D' : `3px solid ${rielEstado}`,
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
                    <p className="font-medium truncate" style={{ color: '#1F2933' }}>{nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}</p>
                    <p className="text-[10px] font-mono" style={{ color: '#94A3B8' }}>
                      {documentoSolicitanteVisible(r, r.solicitante.tipoDocumento, r.solicitante.numeroDocumento)}
                    </p>
                    {/* Sprint Ventanilla Operativa 1 — chip de tipo de entrada / origen */}
                    <div className="mt-1 flex gap-1 flex-wrap">
                      <span
                        className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-semibold uppercase tracking-wide"
                        style={{ background: '#EEF4EE', color: '#14532D', border: '1px solid #D9E2D9' }}
                        title={`Origen: ${LABEL_ORIGEN_INGRESO[r.control.origenIngreso ?? SIN_CLASIFICAR]}`}
                      >
                        {LABEL_TIPO_ENTRADA[r.control.tipoEntrada ?? SIN_CLASIFICAR]}
                      </span>
                      {tieneDatosNoAportados(r.solicitante.datosNoAportados) && (
                        <span
                          className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-semibold uppercase tracking-wide"
                          style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FBBF24' }}
                          title="El solicitante no aportó todos sus datos"
                        >
                          Datos incompletos
                        </span>
                      )}
                    </div>
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

type TabPanelId = 'info' | 'responder' | 'trazabilidad' | 'traslado' | 'prorroga' | 'copiloto';

/* Sprint Panel claro — Responder deja de compartir pestaña con la
   prórroga: es LA acción del día a día y merece su propio lugar,
   resaltado. La trazabilidad pasa a llamarse "Historia" (mismo id
   interno para no tocar efectos ni carga). */
const TABS_PANEL: { id: TabPanelId; label: string }[] = [
  { id: 'info',         label: 'Información' },
  { id: 'responder',    label: 'Responder' },
  { id: 'trazabilidad', label: 'Historia' },
  { id: 'traslado',     label: 'Traslado' },
  { id: 'prorroga',     label: 'Prórroga' },
  { id: 'copiloto',     label: 'SIMI ✦' },
];

/* Sprint Panel claro — paleta e íconos de la Historia por tono. */
const TONO_HISTORIA: Record<TonoEvento, { bg: string; fg: string }> = {
  VERDE:  { bg: '#EAF3DE', fg: '#3B6D11' },
  AZUL:   { bg: '#E6F1FB', fg: '#185FA5' },
  AMBAR:  { bg: '#FAEEDA', fg: '#854F0B' },
  ROJO:   { bg: '#FCEBEB', fg: '#A32D2D' },
  GRIS:   { bg: '#EEF2F5', fg: '#5F6F64' },
  DORADO: { bg: '#F7EFD8', fg: '#8A6A12' },
};

const ICONO_HISTORIA: Record<TonoEvento, string> = {
  // Paths de Heroicons outline, elegidos por significado del tono:
  // verde nace/avanza, azul se mueve, ámbar advierte, rojo falla,
  // gris es sistema, dorado despacha.
  VERDE:  'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  AZUL:   'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3',
  AMBAR:  'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  ROJO:   'M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  GRIS:   'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  DORADO: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
};

function FilaInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-sm mt-0.5 break-words" style={{ color: '#1F2933' }}>{value}</p>
    </div>
  );
}

/**
 * Sprint Ventanilla Operativa 3 — fila de archivo con soporte para
 * sellar PDF. El estado del sello se mantiene local por fila (idle,
 * sellando, sellado, error). Cuando la respuesta llega, se refresca el
 * estado sin recargar el radicado (el `onSnapshot` global también lo
 * detectará al actualizar Firestore).
 */
function FilaArchivoConSello({
  archivo,
  radicadoId,
  soloLectura,
}: {
  archivo:     import('@/src/types/ventanilla').ArchivoRadicado;
  radicadoId:  string;
  soloLectura: boolean;
}) {
  const [estado, setEstado] = useState<'idle' | 'sellando' | 'sellado' | 'error'>(
    archivo.sellado ? 'sellado' : 'idle',
  );
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [selloLocal, setSelloLocal] = useState<
    import('@/src/types/ventanilla').SelloDocumento | null
  >(archivo.sellado ?? null);

  const esPdf = archivo.tipo === 'application/pdf';

  async function handleSellar() {
    setEstado('sellando');
    setMensajeError(null);
    try {
      const res = await fetch(
        `/api/radicados/${encodeURIComponent(radicadoId)}/sellar-documento`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archivoPath: archivo.path }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        setEstado('error');
        setMensajeError(body.error ?? 'No fue posible sellar el documento.');
        return;
      }
      const body = await res.json() as {
        ok: true;
        sello: import('@/src/types/ventanilla').SelloDocumento;
      };
      setSelloLocal(body.sello);
      setEstado('sellado');
    } catch {
      setEstado('error');
      setMensajeError('Error de red al sellar el documento.');
    }
  }

  return (
    <li className="py-2 last:border-0" style={{ borderBottom: '1px solid #EEF4EE' }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs truncate min-w-0" style={{ color: '#1F2933' }}>
          {archivo.nombre}
        </span>
        <div className="shrink-0 flex items-center gap-3">
          {archivo.path && (
            <a
              href={`/api/interno/archivo?path=${encodeURIComponent(archivo.path)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline underline-offset-2 font-semibold"
              style={{ color: '#14532D' }}
            >
              Ver
            </a>
          )}
          {selloLocal?.path && (
            <a
              href={`/api/interno/archivo?path=${encodeURIComponent(selloLocal.path)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline underline-offset-2 font-semibold"
              style={{ color: '#166534' }}
              title="Ver copia sellada"
            >
              Copia sellada
            </a>
          )}
          {esPdf && !soloLectura && (
            <button
              type="button"
              onClick={handleSellar}
              disabled={estado === 'sellando' || estado === 'sellado'}
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border transition-all disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: estado === 'sellado' ? '#166534' : '#14532D',
                color:       estado === 'sellado' ? '#166534' : '#14532D',
                background:  estado === 'sellado' ? '#F0FDF4' : 'white',
              }}
              title={
                estado === 'sellado'
                  ? 'El documento ya tiene copia sellada'
                  : 'Generar copia sellada del PDF'
              }
            >
              {estado === 'sellando' && 'Sellando…'}
              {estado === 'sellado'  && '✓ Sellado'}
              {(estado === 'idle' || estado === 'error') && 'Sellar'}
            </button>
          )}
        </div>
      </div>
      {estado === 'error' && mensajeError && (
        <p
          role="alert"
          className="mt-1.5 text-[11px]"
          style={{ color: '#B91C1C' }}
        >
          {mensajeError}
        </p>
      )}
    </li>
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
  // Sprint Panel claro — Responder se abre con espacio: el panel entra
  // a modo amplio solo y vuelve al ancho normal al salir (a menos que
  // la persona lo haya ajustado a mano mientras tanto).
  const amplioAutomatico = useRef(false);
  const cambiarTab = (id: TabPanelId) => {
    if (onToggleModo) {
      if (id === 'responder' && !modoAmplio) {
        amplioAutomatico.current = true;
        onToggleModo();
      } else if (id !== 'responder' && tab === 'responder' && amplioAutomatico.current) {
        amplioAutomatico.current = false;
        if (modoAmplio) onToggleModo();
      }
    }
    setTab(id);
    setMensajeOk(null);
    setErrorLocal(null);
  };
  // Sprint Radicación de salida — registrar despacho amarrado a esta entrada.
  const [salidaDetalleAbierta, setSalidaDetalleAbierta] = useState(false);
  // Fase B — tras resolver, ofrecer registrar la salida 2-SAL de una vez.
  const [ofrecerDespacho, setOfrecerDespacho] = useState(false);
  const puedeDespachar = !soloLectura
    && (usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA');
  // Sprint Cierre del mostrador — constancia reimprimible desde el detalle.
  const [mostrarConstancia, setMostrarConstancia] = useState(false);
  const [estadoConstancia,  setEstadoConstancia]  = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle');
  const [mensajeConstancia, setMensajeConstancia] = useState<string | null>(null);
  const [tenantDestino,    setTenantDestino]    = useState<TenantId>(radicado.clasificacion.oficinaDestino);
  // Fase 2 · Áreas — nivel 2: área que trabajará el caso (opcional).
  const [areaSeleccionada, setAreaSeleccionada] = useState<string>(
    typeof radicado.clasificacion.areaResponsable === 'string'
      ? radicado.clasificacion.areaResponsable
      : '',
  );
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
  // Sprint Panel claro — la Historia humanizada y su filtro.
  const [filtroHistoria, setFiltroHistoria] = useState<FiltroHistoria>('TODO');
  const historia = useMemo(
    () => construirHistoria(trazabilidad, new Date(), filtroHistoria),
    [trazabilidad, filtroHistoria],
  );
  const [cargandoTrazabilidad, setCargandoTrazabilidad] = useState(false);
  // Panel Op Fase 1 — último evento de trazabilidad para el resumen ejecutivo.
  // Se carga con limit(1) al abrir el radicado y cuando cambia la marca
  // `ultimaActualizacion` (para reflejar nuevas actuaciones sin recargar todo).
  const [ultimoEvento, setUltimoEvento] = useState<TrazabilidadRadicado | null>(null);
  const [archivoPdf,           setArchivoPdf]           = useState<File | null>(null);
  // Estado local para la gestión manual de notificaciones fallidas
  const [mostrarGestionNotif,  setMostrarGestionNotif]  = useState(false);
  const [motivoGestion,        setMotivoGestion]        = useState('');
  const [gestionandoNotif,     setGestionandoNotif]     = useState(false);
  // Vista previa institucional de la respuesta oficial
  const [vistaPreviaActiva,    setVistaPreviaActiva]    = useState(false);

  /** Sprint Cierre del mostrador — reenviar la constancia por correo
   *  desde el detalle (mismo endpoint de la pantalla de éxito). */
  async function handleEnviarConstanciaDetalle(): Promise<void> {
    setEstadoConstancia('enviando');
    setMensajeConstancia(null);
    try {
      const res = await fetch(
        `/api/radicados/${encodeURIComponent(radicado.radicadoId)}/enviar-constancia`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        setEstadoConstancia('error');
        setMensajeConstancia(body.error ?? 'No fue posible enviar la constancia.');
        return;
      }
      setEstadoConstancia('enviado');
    } catch {
      setEstadoConstancia('error');
      setMensajeConstancia('Error de red al enviar la constancia.');
    }
  }

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

  // Panel Op Fase 1 — último evento para el resumen ejecutivo.
  // 1 lectura Firestore por apertura de radicado (barato). Se refresca
  // cuando el radicado se actualiza (onSnapshot global cambia
  // `ultimaActualizacion`).
  useEffect(() => {
    setUltimoEvento(null);
    const q = query(
      collection(getDb(), 'ventanilla_radicados', radicado.radicadoId, 'trazabilidad'),
      orderBy('fecha', 'desc'),
      limit(1),
    );
    getDocs(q)
      .then((snap) => {
        const doc0 = snap.docs[0];
        setUltimoEvento(doc0 ? (doc0.data() as TrazabilidadRadicado) : null);
      })
      .catch(() => {
        // Silencioso: si falla la lectura del último evento, el resumen
        // muestra "—" y el resto de la vista sigue funcionando.
        setUltimoEvento(null);
      });
  }, [radicado.radicadoId, radicado.ultimaActualizacion]);

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
        body: JSON.stringify({ tenantDestino, responsable, areaId: areaSeleccionada || null }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'Error al asignar el radicado.');
    });
  }

  /* Sprint Traslado claro — el gesto natural del funcionario: "eso ya
     es mío". Un clic y queda como responsable del caso de su propia
     dependencia (mismo endpoint y permiso que ya tiene por reglas). */
  async function tomarCaso() {
    await ejecutarAccion(async () => {
      const response = await fetch(`/api/radicados/${encodeURIComponent(radicado.radicadoId)}/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantDestino: radicado.clasificacion.oficinaDestino,
          responsable: {
            uid:    usuario.uid,
            nombre: usuario.nombre,
            email:  usuario.email,
            rol:    usuario.rol,
          },
          areaId: (typeof radicado.clasificacion.areaResponsable === 'string'
            && radicado.clasificacion.areaResponsable) || null,
        }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'No fue posible tomar el caso.');
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
      // Fase B — el ciclo cierra aquí mismo: resolver y despachar.
      if (puedeDespachar) setOfrecerDespacho(true);
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
            <p className="text-sm font-semibold truncate" style={{ color: '#1F2933' }}>{nombreSolicitanteVisible(radicado, radicado.solicitante.nombreCompleto)}</p>
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
              onClick={() => cambiarTab(t.id)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 transition-all duration-150"
              style={activo
                ? {
                    color: '#FFFFFF',
                    background: '#14532D',
                    border: '1px solid #14532D',
                    boxShadow: '0 1px 3px rgba(20,83,45,0.30)',
                  }
                : t.id === 'responder'
                ? {
                    // Panel claro — la acción principal salta a la vista.
                    color: '#14532D',
                    background: '#EAF3DE',
                    border: '1px solid #97C459',
                  }
                : {
                    color: '#475569',
                    background: '#F8FAF7',
                    border: '1px solid #D9E2D9',
                  }}
              onMouseEnter={(e) => { if (!activo) { (e.currentTarget as HTMLElement).style.color = '#14532D'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; (e.currentTarget as HTMLElement).style.borderColor = '#14532D'; } }}
              onMouseLeave={(e) => {
                if (activo) return;
                const el = e.currentTarget as HTMLElement;
                if (t.id === 'responder') {
                  el.style.color = '#14532D'; el.style.background = '#EAF3DE'; el.style.borderColor = '#97C459';
                } else {
                  el.style.color = '#475569'; el.style.background = '#F8FAF7'; el.style.borderColor = '#D9E2D9';
                }
              }}>
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
          {/* Fase B — despacho al resolver: la respuesta que sale recibe
              su 2-SAL sin cambiar de pantalla. Solo roles que por reglas
              pueden crear salidas. */}
          {mensajeOk && ofrecerDespacho && (
            <button
              type="button"
              onClick={() => { setSalidaDetalleAbierta(true); setOfrecerDespacho(false); }}
              className="block mt-1.5 text-xs font-bold underline underline-offset-2"
              style={{ color: '#14532D' }}
            >
              Registrar la salida 2-SAL de esta respuesta ahora
            </button>
          )}
        </div>
      )}

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ background: '#F8FAF7' }}>

        {/* ── TAB 1: Información ── */}
        {tab === 'info' && (
          <>
            {/* Panel Op Fase 1 — resumen ejecutivo al inicio del tab info. */}
            <ResumenEjecutivoRadicado
              radicado={radicado}
              ultimoEvento={ultimoEvento}
            />

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

            {/* Sprint Cierre del mostrador — constancia reimprimible: el
                ciudadano que vuelve otro día por su constancia ya tiene
                botón. Misma pieza de la pantalla de éxito, armada desde
                el documento. */}
            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
                  Constancia de radicación
                </p>
                <button
                  type="button"
                  onClick={() => setMostrarConstancia((v) => !v)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                  style={{ border: '1px solid #14532D', color: '#14532D', background: 'white' }}
                >
                  {mostrarConstancia ? 'Ocultar constancia' : 'Ver constancia'}
                </button>
              </div>
              {mostrarConstancia && (
                <div className="mt-3 flex justify-center">
                  <ComprobanteRadicado
                    {...datosConstanciaDesdeRadicado(radicado)}
                    onEnviarCorreo={handleEnviarConstanciaDetalle}
                    enviandoCorreo={estadoConstancia === 'enviando'}
                    estadoEnvio={estadoConstancia}
                    mensajeEnvioError={mensajeConstancia}
                  />
                </div>
              )}
            </div>

            {/* Sprint Radicación de salida — despachar respuesta con
                número 2-SAL amarrado a esta entrada. */}
            {!soloLectura && (usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA') && (
              <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8A6A12' }}>
                      Correspondencia de salida
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#667085' }}>
                      El oficio que se despacha recibe su número 2-SAL y queda en la trazabilidad.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSalidaDetalleAbierta(true)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                    style={{ border: '1px solid #14532D', color: '#14532D', background: 'white' }}
                  >
                    Registrar salida
                  </button>
                </div>
              </div>
            )}
            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>Solicitante</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <FilaInfo label="Tipo persona"    value={radicado.solicitante.tipoPersona} />
                <FilaInfo label="Documento"       value={documentoSolicitanteVisible(radicado, radicado.solicitante.tipoDocumento, radicado.solicitante.numeroDocumento)} />
                <FilaInfo label="Nombre completo" value={nombreSolicitanteVisible(radicado, radicado.solicitante.nombreCompleto)} />
                <FilaInfo label="Presentación" value={radicado.tipoPresentacion ?? (radicado.esAnonimo ? 'ANONIMA' : 'IDENTIFICADA')} />
                <FilaInfo label="Anónima" value={radicado.esAnonimo ? 'Sí' : 'No'} />
                {radicado.identidadReservada && <FilaInfo label="Identidad reservada" value="Sí" />}
                {/* H2 (ADR-0006): identidad reservada — el correo, teléfono y
                    dirección tampoco se muestran en claro (permitirían
                    reidentificar al solicitante aunque el nombre esté
                    enmascarado). */}
                {!identidadProtegida(radicado) && radicado.solicitante.email    && <FilaInfo label="Correo"    value={radicado.solicitante.email} />}
                {!identidadProtegida(radicado) && radicado.solicitante.telefono && <FilaInfo label="Teléfono"  value={radicado.solicitante.telefono} />}
                {!identidadProtegida(radicado) && radicado.solicitante.direccion && <FilaInfo label="Dirección" value={radicado.solicitante.direccion} />}
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

            {/* Sprint Ventanilla Operativa 1: Origen y datos de ingreso */}
            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>
                Origen y datos de ingreso
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <FilaInfo
                  label="Origen"
                  value={LABEL_ORIGEN_INGRESO[radicado.control.origenIngreso ?? SIN_CLASIFICAR]}
                />
                <FilaInfo
                  label="Tipo entrada"
                  value={LABEL_TIPO_ENTRADA[radicado.control.tipoEntrada ?? SIN_CLASIFICAR]}
                />
                <FilaInfo label="Remitente" value={LABEL_TIPO_PERSONA[radicado.solicitante.tipoPersona] ?? radicado.solicitante.tipoPersona} />
                <FilaInfo label="Folios" value={String(radicado.detalle.numeroFolios)} />
                <FilaInfo label="Anexos" value={String(radicado.detalle.numeroAnexos ?? 0)} />
                {radicado.detalle.observacionesAnexos && (
                  <FilaInfo label="Obs. anexos" value={radicado.detalle.observacionesAnexos} />
                )}
                <FilaInfo label="Medio respuesta" value={radicado.canalRespuesta ?? '—'} />
              </div>
            </div>

            {/* Sprint Cierre del mostrador: el bloque de datos no aportados
                ya no es solo lectura — permite completarlos cuando el
                ciudadano vuelve con ellos. */}
            <CompletarDatosSolicitante radicado={radicado} />

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
                    {/* Fase 2 · Áreas — nivel 2 del modelo, si está fijado.
                        typeof string: datos malformados no tumban el render. */}
                    {typeof radicado.clasificacion.areaResponsable === 'string'
                      && radicado.clasificacion.areaResponsable && (
                      <FilaInfo label="Área responsable" value={getNombreArea(radicado.clasificacion.areaResponsable)} />
                    )}
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
                    <FilaArchivoConSello
                      key={arch.path ?? i}
                      archivo={arch}
                      radicadoId={radicado.radicadoId}
                      soloLectura={soloLectura}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* Tema CLARO. Este bloque nació el 28-may-2026, cuando todo el
                flujo interno era oscuro, y la unificación visual del 1-jun se
                lo saltó: quedó pintando `bg-slate-950/40` y `text-slate-300`
                sobre el panel claro, lo que daba un gris #96989D con el
                resumen a 1,94:1 y las etiquetas a 1,03:1 — ilegible. Y es
                justo el bloque que la funcionaria necesita leer para decidir
                (Principio 9: la IA propone, el funcionario decide).
                Colores: tokens de ADR-0030 para los estados, e índigo (el
                acento de IA en toda la app) en su versión clara. */}
            {radicado.analisisIa && (
              <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">Análisis Asistido IA</span>
                  </div>
                  <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    Confianza: {(radicado.analisisIa.confianzaClasificacion * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="space-y-3 bg-white p-4 rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--text-secondary)' }}>Resumen Ejecutivo IA</span>
                    <p className="text-xs italic leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      &quot;{radicado.analisisIa.resumenEjecutivo}&quot;
                    </p>
                  </div>

                  {radicado.analisisIa.etiquetasSemanticas && radicado.analisisIa.etiquetasSemanticas.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {radicado.analisisIa.etiquetasSemanticas.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[9px] font-medium text-indigo-700 border border-indigo-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Feedback de IA */}
                  <div className="pt-3 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>¿La IA acertó?</span>

                    {radicado.feedbackIa ? (
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          radicado.feedbackIa.puntuacion === 'POSITIVO'
                            ? 'bg-emerald-50 border-emerald-200'
                            : radicado.feedbackIa.puntuacion === 'CORREGIDO'
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-rose-50 border-rose-200'
                        }`}
                        style={{
                          color:
                            radicado.feedbackIa.puntuacion === 'POSITIVO'
                              ? 'var(--color-success-text)'
                              : radicado.feedbackIa.puntuacion === 'CORREGIDO'
                                ? 'var(--color-warning-text)'
                                : 'var(--color-danger-text)',
                        }}
                      >
                        Calificado: {radicado.feedbackIa.puntuacion}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => enviarFeedbackIA('POSITIVO')}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-emerald-50 text-xs font-medium transition-colors cursor-pointer"
                          style={{ border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
                        >
                          👍 Sí
                        </button>
                        <button
                          onClick={() => enviarFeedbackIA('NEGATIVO')}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-rose-50 text-xs font-medium transition-colors cursor-pointer"
                          style={{ border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
                        >
                          ❌ No
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Documento de respuesta / Oficio anexado — visible en el
                expediente cuando el radicado ya fue respondido con oficio. */}
            {radicado.respuestaOficial?.archivoPath && (
              <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>
                  Documento de respuesta / Oficio anexado
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <FilaInfo label="Archivo"     value={radicado.respuestaOficial.archivoNombre ?? '—'} />
                  <FilaInfo label="Tipo"        value="Respuesta oficial" />
                  <FilaInfo label="Fecha"       value={radicado.respuestaOficial.fecha} />
                  <FilaInfo label="Responsable" value={radicado.respuestaOficial.actorNombre} />
                  <FilaInfo
                    label="Dependencia"
                    value={NOMBRES_TENANT[radicado.clasificacion.oficinaDestino] ?? radicado.clasificacion.oficinaDestino}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <a
                    href={`/api/interno/archivo?path=${encodeURIComponent(radicado.respuestaOficial.archivoPath)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold underline underline-offset-2"
                    style={{ color: '#14532D' }}
                  >
                    Descargar documento
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: Traslado / Asignación ── */}
        {/* Sprint Traslado claro — primero el estado, después el cambio;
            el botón dice lo que va a hacer y las consecuencias se
            anuncian antes del clic. */}
        {tab === 'traslado' && (() => {
          const respActualUid = radicado.clasificacion.funcionarioResponsableUid ?? null;
          const areaActualId = typeof radicado.clasificacion.areaResponsable === 'string'
            ? radicado.clasificacion.areaResponsable : '';
          const resumen = resumirCambio({
            dependenciaActual: radicado.clasificacion.oficinaDestino,
            dependenciaNueva:  tenantDestino,
            responsableActual: radicado.clasificacion.funcionarioResponsableNombre ?? null,
            responsableNuevo:  responsableSelec?.nombre
              ?? (funcionarioUid && funcionarioUid !== respActualUid && !responsableSelec ? `UID ${funcionarioUid}` : null),
            responsableCambia: responsableSelec
              ? responsableSelec.uid !== respActualUid
              : Boolean(funcionarioUid && funcionarioUid !== respActualUid),
            areaNueva:  areaSeleccionada ? getNombreArea(areaSeleccionada) : null,
            areaCambia: areaSeleccionada !== areaActualId,
          });
          const puedeTomarCaso = usuario.rol === 'FUNCIONARIO'
            && usuario.tenantId === radicado.clasificacion.oficinaDestino
            && !respActualUid
            && !soloLectura;
          const cajaEstilo = resumen.tono === 'AMBAR'
            ? { caja: { background: '#FAEEDA', border: '1px solid #FAC775' }, titulo: '#854F0B', texto: '#633806' }
            : { caja: { background: '#EAF3DE', border: '1px solid #C0DD97' }, titulo: '#27500A', texto: '#3B6D11' };
          return (
          <div className="space-y-4">
            {/* ── El caso hoy: dónde está y quién lo tiene ── */}
            <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: '#FFFFFF', border: '1px solid #D9E2D9' }}>
              <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#EAF3DE' }} aria-hidden="true">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="#3B6D11" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5F8A6E' }}>El caso está hoy en</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: '#12261A' }}>
                  {NOMBRES_TENANT[radicado.clasificacion.oficinaDestino]}
                  {radicado.clasificacion.funcionarioResponsableNombre
                    ? ` · responsable: ${radicado.clasificacion.funcionarioResponsableNombre}`
                    : ' · sin persona asignada'}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: '#7A8B7F' }}>
                  {areaActualId ? `Área: ${getNombreArea(areaActualId)}` : ''}
                  {areaActualId && radicado.clasificacion.fechaAsignacionResponsable ? ' · ' : ''}
                  {radicado.clasificacion.fechaAsignacionResponsable
                    ? `Asignado el ${formatFechaColombia(radicado.clasificacion.fechaAsignacionResponsable)}`
                    : ''}
                </p>
              </div>
            </div>

            {/* ── Tomar este caso: el gesto del funcionario ── */}
            {puedeTomarCaso && (
              <div className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: '#EAF3DE', border: '1px solid #C0DD97' }}>
                <p className="text-xs" style={{ color: '#3B6D11' }}>
                  Este caso es de tu dependencia y no tiene persona asignada.
                </p>
                <button type="button" onClick={tomarCaso} disabled={guardando}
                  className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-60"
                  style={{ border: '1px solid #14532D', color: '#14532D', background: 'white' }}>
                  Tomar este caso
                </button>
              </div>
            )}

            {/* ── Mover o asignar ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>Dependencia</p>
              <select
                value={tenantDestino}
                onChange={(e) => {
                  setTenantDestino(e.target.value as TenantId);
                  // El área depende del destino: al cambiarlo se limpia.
                  setAreaSeleccionada('');
                }}
                className="select-internal w-full"
              >
                {/* Agrupado por dependencia (idea de Laura). */}
                {agruparDestinosPorDependencia(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((g) => g.oficinas.length > 0 ? (
                  <optgroup key={g.dependencia} label={NOMBRES_TENANT[g.dependencia]}>
                    <option value={g.dependencia}>{NOMBRES_TENANT[g.dependencia]}</option>
                    {g.oficinas.map((o) => (
                      <option key={o.tenant} value={o.tenant}>{o.nombre}</option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={g.dependencia} value={g.dependencia}>{NOMBRES_TENANT[g.dependencia]}</option>
                ))}
              </select>
            </div>

            {/* Selector MIPG-2 — persona responsable */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
                Persona responsable <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(opcional)</span>
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
                  <option value="">
                    {tenantDestino !== radicado.clasificacion.oficinaDestino
                      ? `La asignará ${NOMBRES_TENANT[tenantDestino]} al recibirlo`
                      : '— Sin persona asignada —'}
                  </option>
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

            {/* Fase 2 · Áreas — nivel 2 del modelo: propias del destino
                + transversales (Almacén y Archivo, Sistemas). */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#667085' }}>
                Área <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(opcional)</span>
              </p>
              <select
                value={areaSeleccionada}
                onChange={(e) => setAreaSeleccionada(e.target.value)}
                aria-label="Área responsable"
                className="select-internal w-full"
              >
                <option value="">— Sin área específica —</option>
                {areasParaDependencia(tenantDestino).map((a) => (
                  <option key={a.areaId} value={a.areaId}>
                    {a.nombre}{a.transversal ? ' (transversal)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Qué va a pasar: cero sorpresas ── */}
            {resumen.tituloCaja && (
              <div className="rounded-xl px-3.5 py-3" style={cajaEstilo.caja}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: cajaEstilo.titulo }}>
                  {resumen.tituloCaja}
                </p>
                <div className="space-y-1">
                  {resumen.consecuencias.map((c, i) => (
                    <p key={i} className="text-[12px] leading-relaxed" style={{ color: cajaEstilo.texto }}>· {c}</p>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={asignar}
              disabled={guardando || soloLectura || !resumen.puedeConfirmar}
              title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : undefined}
              className="w-full py-2.5 rounded-lg text-white text-sm font-bold transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: resumen.puedeConfirmar ? '#14532D' : '#94A3B8' }}
              onMouseEnter={(e) => { if (!guardando && !soloLectura && resumen.puedeConfirmar) (e.currentTarget as HTMLElement).style.background = '#166534'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = resumen.puedeConfirmar ? '#14532D' : '#94A3B8'; }}>
              {guardando && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {resumen.botonLabel}
            </button>
          </div>
          );
        })()}

        {/* ── TAB 3: Trazabilidad MIPG ── */}
        {/* Sprint Panel claro — la Historia del caso, contada en humano.
            Los códigos siguen intactos en Firestore; aquí solo se
            traducen, se pliegan los correos y se agrupan los días. */}
        {tab === 'trazabilidad' && (
          <div>
            {cargandoTrazabilidad ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#94A3B8' }}>
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
                Cargando la historia…
              </div>
            ) : trazabilidad.length === 0 ? (
              <p className="text-sm italic" style={{ color: '#94A3B8' }}>Este radicado aún no tiene historia registrada.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-1.5 flex-wrap">
                  {([['TODO', 'Todo'], ['ACTUACIONES', 'Solo actuaciones'], ['CORREOS', 'Correos']] as [FiltroHistoria, string][]).map(([id, etiqueta]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFiltroHistoria(id)}
                      aria-pressed={filtroHistoria === id}
                      className="text-[11px] font-semibold px-3 py-1 rounded-full transition-colors"
                      style={filtroHistoria === id
                        ? { background: '#14532D', color: '#FFFFFF', border: '1px solid #14532D' }
                        : { background: '#FFFFFF', color: '#475569', border: '1px solid #D9E2D9' }}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>

                {historia.length === 0 && (
                  <p className="text-xs italic" style={{ color: '#94A3B8' }}>Nada que mostrar con este filtro.</p>
                )}

                {historia.map((dia) => (
                  <div key={dia.ymd}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#7A8B7F' }}>
                      {dia.etiqueta}
                    </p>
                    <div className="space-y-2">
                      {dia.eventos.map((e) => {
                        const tono = TONO_HISTORIA[e.tono];
                        return (
                          <div key={e.id} className="flex gap-2.5 rounded-xl bg-white px-3 py-2.5" style={{ border: '1px solid #E3EAE3' }}>
                            <span
                              className="shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center"
                              style={{ background: tono.bg }}
                              aria-hidden="true"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={tono.fg} strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_HISTORIA[e.tono]} />
                              </svg>
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-[12.5px] font-semibold leading-snug" style={{ color: '#12261A' }}>{e.titulo}</p>
                                <time className="shrink-0 text-[10px]" style={{ color: '#94A3B8' }}>{e.hora}</time>
                              </div>
                              {e.actor && (
                                <p className="text-[11px] mt-0.5" style={{ color: '#667085' }}>Por {e.actor}</p>
                              )}
                              {e.detalle && (
                                <p className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: '#5F6F64' }}>{e.detalle}</p>
                              )}
                              {e.correos.map((c, i) => (
                                <p key={i} className="text-[10.5px] mt-1 flex items-center gap-1" style={{ color: '#94A3B8' }}>
                                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_HISTORIA.GRIS} />
                                  </svg>
                                  {c.texto}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: Prórroga / Respuesta ── */}
        {/* ── TAB: Prórroga y devolución ── */}
        {tab === 'prorroga' && (
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

            {guardando && (
              <div className="flex items-center justify-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
                Guardando en Firestore…
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Responder — la acción del día a día, guiada en 3 pasos ── */}
        {tab === 'responder' && (
          <div className="space-y-4">
            {/* Los 3 pasos, siempre visibles: orientan sin estorbar. */}
            {radicado.estadoActual !== 'RESUELTO' && (
              <div className="flex items-center gap-3 flex-wrap px-1">
                {([['1', 'Escribe'], ['2', 'Adjunta (opcional)'], ['3', 'Marca resuelto']] as const).map(([n, texto], i) => (
                  <div key={n} className="flex items-center gap-1.5">
                    <span
                      className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0"
                      style={i === 0
                        ? { background: '#14532D', color: '#FFFFFF' }
                        : { background: '#FFFFFF', border: '1.5px solid #97C459', color: '#3B6D11' }}
                    >
                      {n}
                    </span>
                    <span className="text-xs" style={{ color: i === 0 ? '#12261A' : '#5F6F64', fontWeight: i === 0 ? 600 : 400 }}>
                      {texto}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl p-4 space-y-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
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
                    1 · La respuesta que recibirá el ciudadano
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
                    2 · Oficio firmado <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(PDF, opcional)</span>
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

              {/* Panel claro — nadie tiene que adivinar qué hace el botón. */}
              {radicado.estadoActual !== 'RESUELTO' && !soloLectura && (
                <div className="rounded-lg px-3 py-2.5" style={{ background: '#EAF3DE', border: '1px solid #C0DD97' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#27500A' }}>
                    3 · Al marcar como resuelto
                  </p>
                  <div className="space-y-1 text-[11.5px]" style={{ color: '#3B6D11' }}>
                    <p>✓ El ciudadano recibe la respuesta por correo automáticamente (si dejó uno)</p>
                    <p>✓ Queda registrado si respondiste dentro del término</p>
                    <p>✓ Se podrá registrar la salida 2-SAL del oficio despachado</p>
                  </div>
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
            onAdoptarRespuesta={(texto) => { setRespuesta(texto); cambiarTab('responder'); }}
          />
        )}
      </div>

      {/* Sprint Radicación de salida — a nivel del panel (no de un tab)
          para poder abrirlo también desde el despacho al resolver. */}
      {salidaDetalleAbierta && (
        <RegistrarSalidaModal
          usuario={usuario}
          entrada={{
            radicadoId: radicado.radicadoId,
            // Identidad reservada/anónima: no se prellena el nombre.
            solicitanteNombre: (radicado.esAnonimo || radicado.identidadReservada)
              ? undefined
              : radicado.solicitante.nombreCompleto,
            dependencia: radicado.clasificacion.oficinaDestino,
          }}
          onCerrar={() => setSalidaDetalleAbierta(false)}
        />
      )}
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
  /** Sprint Recepción fluida — anexos físicos y medios entregados. */
  numeroAnexos:      number;
  mediosAnexos:      string | null;
  /** Sprint Ventanilla Operativa 2 — datos de contacto y canal de
   *  respuesta requeridos por el comprobante nuevo. `correoSolicitante`
   *  y `telefonoSolicitante` respetan las casillas `noAporta…` — si el
   *  solicitante no aportó el dato, se pasa null. */
  correoSolicitante:    string | null;
  telefonoSolicitante:  string | null;
  canalRespuesta:       string | null;
}

function DrawerNuevoRadicado({
  usuario,
  onCerrar,
  radicados,
}: {
  usuario:  UsuarioAutenticado;
  onCerrar: () => void;
  /** Sprint Solicitante frecuente — pool en memoria para autocompletar. */
  radicados: VentanillaRadicado[];
}) {
  const [radicadoGenerado,  setRadicadoGenerado]  = useState<string | null>(null);
  const [datosComprobante,  setDatosComprobante]  = useState<DatosComprobante | null>(null);
  const [progreso,          setProgreso]          = useState('');
  const [progresoPct,       setProgresoPct]       = useState(0);
  const [errorGuardado,     setErrorGuardado]     = useState<string | null>(null);
  // Sprint Ventanilla Operativa 2 — estado del envío de constancia por correo.
  const [estadoEnvioConstancia,  setEstadoEnvioConstancia]  = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle');
  const [mensajeEnvioConstancia, setMensajeEnvioConstancia] = useState<string | null>(null);
  // Sprint Recepción fluida — constancia completa o sello sobre la copia física.
  const [vistaExito, setVistaExito] = useState<'constancia' | 'sello'>('constancia');
  const FORM_ID = 'rad-rapida-form';

  async function handleEnviarConstancia(): Promise<void> {
    if (!radicadoGenerado) return;
    setEstadoEnvioConstancia('enviando');
    setMensajeEnvioConstancia(null);
    try {
      const res = await fetch(
        `/api/radicados/${encodeURIComponent(radicadoGenerado)}/enviar-constancia`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        setEstadoEnvioConstancia('error');
        setMensajeEnvioConstancia(body.error ?? 'No fue posible enviar la constancia.');
        return;
      }
      setEstadoEnvioConstancia('enviado');
    } catch {
      setEstadoEnvioConstancia('error');
      setMensajeEnvioConstancia('Error de red al enviar la constancia.');
    }
  }

  // Sprint UI Radicación Rápida:
  //  - Bloquear scroll del body mientras el modal está abierto.
  //  - Cerrar con ESC.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onCerrar]);

  async function handleSubmit(
    payload: Parameters<NonNullable<React.ComponentProps<typeof RadicacionFuncionarioForm>['onSubmit']>>[0],
  ) {
    setErrorGuardado(null);
    setProgreso('Iniciando…');
    setProgresoPct(5);

    try {
      const ahora = new Date();
      // Pieza angular (P2.1) — Fase 3: bifurcación por
      // USA_RADICACION_INTERNA_SERVER (docs/CRONOGRAMA_PIEZA_ANGULAR.md
      // §FASE 3). Con el switch en false (hoy) es exactamente la misma
      // llamada de siempre — ver lib/recepcion/radicar-segun-flag.ts.
      const { radicadoId } = await radicarSegunFlag(
        payload,
        { uid: usuario.uid, nombre: usuario.nombre, tenantId: usuario.tenantId },
        (msg, pct) => { setProgreso(msg); setProgresoPct(pct); },
      );
      const tipoConf = resolverTipoSolicitud(payload.tipoSolicitudId);
      // Sprint Ventanilla Operativa 2 — respetar las casillas "no aportó":
      //  si el solicitante marcó noAportaCorreo, no mostramos correo aunque el
      //  campo esté con valor; lo mismo para teléfono. Coherencia con Sprint 1.
      const emailComprobante = payload.noAportaCorreo ? null : (payload.email?.trim() || null);
      const telefonoComprobante = payload.noAportaTelefono
        ? null
        : (payload.telefonoMovil?.trim() || payload.telefono?.trim() || null);
      setDatosComprobante({
        solicitanteNombre: payload.nombreCompleto,
        numeroDocumento:   payload.numeroDocumento,
        tipoDocumento:     payload.tipoDocumento,
        fechaRadicado:     ahora.toISOString(),
        horaRadicado:      formatHoraColombia(ahora),
        medioRecepcion:    payload.medioRecepcion,
        tipoTramite:       tipoConf.nombre,
        diasRespuesta:     tipoConf.diasRespuesta,
        unidad:            tipoConf.unidad,
        asunto:            payload.asunto,
        fechaVencimiento:  payload.fechaVencimiento,
        numeroFolios:      payload.numeroFolios,
        numeroAnexos:      payload.numeroAnexos,
        mediosAnexos:      payload.anexosDescripcion?.trim() || null,
        correoSolicitante:   emailComprobante,
        telefonoSolicitante: telefonoComprobante,
        canalRespuesta:      payload.canalRespuesta ?? null,
      });
      setRadicadoGenerado(radicadoId);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : 'Error al guardar el radicado.');
      setProgreso('');
      setProgresoPct(0);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3 sm:px-4 sm:py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rad-rapida-title"
      aria-describedby="rad-rapida-subtitle"
    >
      {/* Overlay sólido — sin backdrop-blur: el blur re-rasterizaba todo el
          dashboard vivo detrás en cada frame y causaba scroll lento dentro
          del formulario en equipos modestos. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/55 animate-modal-overlay"
      />

      {/* Panel centrado */}
      <div
        className="relative w-full bg-white flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-modal-panel"
        style={{
          border: '1px solid #D9E2D9',
          maxWidth: 'min(1120px, calc(100vw - 24px))',
          maxHeight: 'calc(100dvh - 24px)',
        }}
      >

        {/* Header fijo */}
        <header
          className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 shrink-0 bg-white"
          style={{ borderBottom: '1px solid #D9E2D9' }}
        >
          <div className="min-w-0">
            <h2 id="rad-rapida-title" className="text-base sm:text-lg font-black truncate" style={{ color: '#1F2933' }}>
              Radicación Rápida
            </h2>
            <p id="rad-rapida-subtitle" className="text-xs mt-0.5 truncate" style={{ color: '#667085' }}>
              Nuevo radicado institucional · Ventanilla Única
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal de radicación rápida"
            className="shrink-0 p-2 rounded-xl active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
            style={{ color: '#94A3B8' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1F2933'; (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = ''; }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Cuerpo con scroll interno */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5" style={{ background: '#F8FAF7' }}>

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

              {/* Sprint Recepción fluida — elegir entre la constancia
                  completa y el sello sobre la copia física del ciudadano. */}
              <div className="flex gap-1 p-1 rounded-full" style={{ background: '#EEF4EE' }} role="tablist" aria-label="Formato de impresión">
                {([
                  ['constancia', 'Constancia completa'],
                  ['sello',      'Sello de recibido'],
                ] as const).map(([id, etiqueta]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={vistaExito === id}
                    onClick={() => setVistaExito(id)}
                    className="px-4 py-1.5 rounded-full text-xs font-bold transition-colors"
                    style={vistaExito === id
                      ? { background: '#14532D', color: '#FFFFFF' }
                      : { color: '#14532D' }}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>

              {vistaExito === 'sello' && (
                <SelloRecibido
                  radicadoId={radicadoGenerado}
                  fechaRadicado={datosComprobante.fechaRadicado}
                  horaRadicado={datosComprobante.horaRadicado}
                  numeroFolios={datosComprobante.numeroFolios}
                  numeroAnexos={datosComprobante.numeroAnexos}
                  mediosAnexos={datosComprobante.mediosAnexos}
                />
              )}

              {vistaExito === 'constancia' && (
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
                numeroAnexos={datosComprobante.numeroAnexos}
                mediosAnexos={datosComprobante.mediosAnexos}
                correoSolicitante={datosComprobante.correoSolicitante}
                telefonoSolicitante={datosComprobante.telefonoSolicitante}
                canalRespuesta={datosComprobante.canalRespuesta}
                onEnviarCorreo={handleEnviarConstancia}
                enviandoCorreo={estadoEnvioConstancia === 'enviando'}
                estadoEnvio={estadoEnvioConstancia}
                mensajeEnvioError={mensajeEnvioConstancia}
                onNuevoRegistro={() => {
                  setRadicadoGenerado(null);
                  setDatosComprobante(null);
                  setProgreso('');
                  setProgresoPct(0);
                  setEstadoEnvioConstancia('idle');
                  setMensajeEnvioConstancia(null);
                  setVistaExito('constancia');
                }}
              />
              )}

              <button onClick={onCerrar}
                className="px-5 py-2.5 rounded-xl text-sm transition-all duration-150 active:scale-95"
                style={{ border: '1px solid #D9E2D9', color: '#667085' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
              >Cerrar modal</button>
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
            <RadicacionFuncionarioForm
              radicadoPreview="Se generará al radicar"
              onSubmit={handleSubmit}
              formId={FORM_ID}
              hideSubmitButton
              radicados={radicados}
            />
          )}
        </div>

        {/* Footer fijo de acciones */}
        {!radicadoGenerado && (
          <footer
            className="shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-6 py-3 bg-white"
            style={{ borderTop: '1px solid #D9E2D9' }}
          >
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={{ background: 'white', color: '#475569', border: '1px solid #D9E2D9' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'white'; }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={FORM_ID}
              disabled={!!progreso && progresoPct > 0 && progresoPct < 100}
              className="rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={{ background: '#14532D' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#166534'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}
            >
              {progreso && progresoPct > 0 && progresoPct < 100 ? 'Radicando…' : 'Registrar radicado'}
            </button>
          </footer>
        )}
      </div>
    </div>
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
    nombreSolicitanteVisible(r, r.solicitante.nombreCompleto),
    numeroDocumentoVisible(r, r.solicitante.numeroDocumento),
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

async function descargarExcelMipg(filtros?: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const hayFiltros = filtros && Object.values(filtros).some((v) => v !== '' && v !== null && v !== undefined);
    const res = await fetch('/api/reportes/mipg/excel', {
      method: 'POST',
      credentials: 'include',
      ...(hayFiltros
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filtros }) }
        : {}),
    });
    if (!res.ok) {
      // Lee como texto y trata de parsear JSON si aplica. Si el server
      // devolvió HTML (p. ej. 500 sin handler) lo muestra recortado.
      const raw = await res.text().catch(() => '');
      let parsed: { error?: string; detalle?: string } | null = null;
      try { parsed = JSON.parse(raw) as { error?: string; detalle?: string }; } catch { /* no-json */ }
      const msg = parsed?.detalle
        ? `${parsed.error ?? 'Error'} (${parsed.detalle})`
        : parsed?.error ?? raw.slice(0, 200) ?? `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    // Verifica Content-Type antes de descargar para no entregar un HTML
    // como si fuera xlsx.
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('spreadsheetml')) {
      return { ok: false, error: `Respuesta inesperada del servidor (content-type: ${ct || 'desconocido'}). Revise logs del backend.` };
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      return { ok: false, error: 'El servidor devolvió un archivo vacío. Revise logs del backend.' };
    }
    const cd = res.headers.get('content-disposition') ?? '';
    const m  = cd.match(/filename="([^"]+)"/);
    const filename = m?.[1] ?? `Reporte_MIPG_Simacota_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/* Sprint 3C — impresión del reporte: solo el bloque #reporte-mipg-print
   es visible al imprimir (mismo patrón de constancia y sello). */
const PRINT_STYLES_REPORTE = `
@media print {
  body * { visibility: hidden !important; }
  #reporte-mipg-print,
  #reporte-mipg-print * { visibility: visible !important; }
  #reporte-mipg-print {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    background: white !important;
    padding: 0 !important;
    z-index: 99999 !important;
  }
  @page {
    size: letter portrait;
    margin: 14mm 12mm;
  }
}
`;

const MEDIO_SALIDA_LABEL: Record<string, string> = {
  CORREO:     'Correo electrónico',
  FISICO:     'Correo físico',
  MENSAJERO:  'Mensajero',
  PRESENCIAL: 'Entrega presencial',
};

function VistaReportes({
  total,
  radicados,
  salidas,
}: {
  total:     number;
  radicados: VentanillaRadicado[];
  /** Fase B — libro de salidas; null = el rol no lee el libro completo. */
  salidas:   SalidaOficial[] | null;
}) {
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [errorExcel, setErrorExcel] = useState<string | null>(null);
  // Sprint 3C — preset de período y dependencia del reporte.
  const [preset, setPreset] = useState<PresetReporte>('ESTE_MES');
  const [depFiltro, setDepFiltro] = useState<TenantId | 'TODAS'>('TODAS');
  async function onExportarExcel() {
    setDescargandoExcel(true);
    setErrorExcel(null);
    const res = await descargarExcelMipg();
    if (!res.ok) setErrorExcel(res.error ?? 'No se pudo generar el reporte Excel.');
    setDescargandoExcel(false);
  }

  /* Sprint 3C — el reporte se calcula sobre el subconjunto del período
     elegido, con los mismos cortes calendario de los KPIs operativos. */
  const subconjunto = useMemo(
    () => filtrarPorPreset(radicados, preset, depFiltro),
    [radicados, preset, depFiltro],
  );
  const ind = useMemo(() => indicadoresDeReporte(subconjunto), [subconjunto]);
  const filasDependencia = useMemo(() => resumenPorDependencia(subconjunto), [subconjunto]);
  const pctCumplimiento = ind.pctCumplimiento;
  /* Fase B — la serie 2-SAL del mismo período y dependencia. */
  const resumenSal = useMemo(
    () => (salidas ? resumenSalidas(filtrarSalidasPorPreset(salidas, preset, depFiltro)) : null),
    [salidas, preset, depFiltro],
  );

  /* Sprint 3C — imprimir o "Guardar como PDF" del navegador. Se
     desactiva la hoja de estilos del comprobante durante la impresión
     para que no compita por la @page, y el tag propio se retira al
     cerrar el diálogo (mismo manejo del sello de recibido). */
  function handleImprimirReporte() {
    const stylesComprobante =
      document.getElementById('comprobante-print-styles') as HTMLStyleElement | null;
    if (stylesComprobante) stylesComprobante.disabled = true;

    const tag = document.createElement('style');
    tag.id = 'reporte-mipg-print-styles';
    tag.textContent = PRINT_STYLES_REPORTE;
    document.head.appendChild(tag);

    window.print();

    tag.remove();
    if (stylesComprobante) stylesComprobante.disabled = false;
  }

  const items = [
    { label: 'Total radicados',           valor: ind.total,     color: '#12261A', desc: ETIQUETA_PRESET[preset] },
    { label: 'Tasa resolución (%)',        valor: ind.total > 0 ? Math.round((ind.resueltos / ind.total) * 100) : 0, color: '#14532D', desc: 'Resueltos / Total' },
    { label: 'Cumplimiento términos (%)',  valor: pctCumplimiento !== null ? pctCumplimiento : '—', color: pctCumplimiento !== null ? (pctCumplimiento >= 80 ? '#14532D' : pctCumplimiento >= 60 ? '#B45309' : '#DC2626') : '#94A3B8', desc: 'MIPG Req. 8 — Respondidos a tiempo' },
    { label: 'Respondidos a tiempo',       valor: ind.aTiempo,   color: '#0F766E', desc: 'Con dato de cumplimiento' },
    { label: 'Radicadas (pendientes)',     valor: ind.radicadas, color: '#475569', desc: '' },
    { label: 'Prioridad MIPG activos',    valor: ind.prioridadMipg, color: '#DC2626', desc: 'Prioridad ROJO activa' },
    { label: 'En trámite (asignadas)',     valor: ind.asignadas, color: '#1D4ED8', desc: '' },
    { label: 'Por vencer (≤ 2 días)',      valor: ind.porVencer, color: '#D97706', desc: '' },
    { label: 'Vencidas sin respuesta',     valor: ind.vencidas,  color: '#DC2626', desc: '' },
    { label: 'Devueltas / Prórroga',       valor: ind.devueltasProrroga, color: '#B45309', desc: '' },
  ];

  return (
    <div id="reporte-mipg-print" className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8" style={{ background: '#F8FAF7' }}>
      {/* Encabezado institucional — solo visible al imprimir. */}
      <div className="hidden print:block mb-6" style={{ borderBottom: '2px solid #14532D', paddingBottom: 12 }}>
        <div className="flex items-center gap-3">
          <div className="shrink-0 overflow-hidden" style={{ width: 40, height: 40 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={INSTITUCION.logo}
              alt=""
              className="max-w-none"
              style={{ height: 40, width: 'auto', objectPosition: 'left' }}
            />
          </div>
          <div>
            <p className="text-sm font-black uppercase" style={{ color: '#14532D' }}>{INSTITUCION.nombre}</p>
            <p className="text-xs" style={{ color: '#667085' }}>
              Reporte de indicadores MIPG · {ETIQUETA_PRESET[preset]}
              {depFiltro !== 'TODAS' ? ` · ${NOMBRES_TENANT[depFiltro] ?? depFiltro}` : ' · Todas las dependencias'}
            </p>
            <p className="text-[10px]" style={{ color: '#94A3B8' }}>
              Generado: {formatFechaHoraColombia(new Date())} · {subconjunto.length} radicado{subconjunto.length !== 1 ? 's' : ''} en el período
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6 print:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#667085' }}>MIPG · Rendición de Cuentas</p>
          <h2 className="text-xl font-black" style={{ color: '#1F2933' }}>Indicadores de Eficiencia</h2>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleImprimirReporte}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ background: '#FFFFFF', color: '#14532D', border: '1px solid #14532D' }}
            title="Imprimir el reporte del período o guardarlo como PDF desde el navegador"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / PDF
          </button>
          <button
            type="button"
            onClick={onExportarExcel}
            disabled={descargandoExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
            style={{ background: '#14532D', color: '#FFFFFF', border: '1px solid #14532D' }}
            onMouseEnter={(e) => { if (!descargandoExcel) (e.currentTarget as HTMLElement).style.background = '#0F5F35'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#14532D'; }}
            title="Exportar Reporte MIPG en formato Excel institucional (8 hojas)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {descargandoExcel ? 'Generando…' : 'Exportar Excel MIPG'}
          </button>
          <button
            type="button"
            onClick={() => exportarCSVMIPG(subconjunto)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#475569' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#D9E2D9'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}
            title="Exportar CSV técnico (respaldo plano para integraciones)"
          >
            CSV técnico
          </button>
        </div>
      </div>
      {errorExcel && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs"
             style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B' }}>
          <strong>Excel MIPG:</strong> {errorExcel}
        </div>
      )}

      {/* Sprint 3C — presets de período + dependencia. */}
      <div className="flex items-center gap-2 flex-wrap mb-5 print:hidden">
        {(Object.entries(ETIQUETA_PRESET) as [PresetReporte, string][]).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            aria-pressed={preset === id}
            onClick={() => setPreset(id)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
            style={preset === id
              ? { background: '#14532D', color: '#FFFFFF', border: '1px solid #14532D' }
              : { background: '#FFFFFF', color: '#475569', border: '1px solid #D9E2D9' }}
          >
            {etiqueta}
          </button>
        ))}
        <select
          value={depFiltro}
          onChange={(e) => setDepFiltro(e.target.value as TenantId | 'TODAS')}
          aria-label="Filtrar reporte por dependencia"
          className="select-internal text-xs ml-auto"
          style={{ maxWidth: 260 }}
        >
          <option value="TODAS">Todas las dependencias</option>
          {(Object.entries(NOMBRES_TENANT) as [TenantId, string][]).map(([id, nombre]) => (
            <option key={id} value={id}>{nombre}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl p-5 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
            <p className="text-3xl font-black tabular-nums" style={{ color: item.color }}>{item.valor}</p>
            <p className="text-xs mt-2 leading-tight font-medium" style={{ color: '#667085' }}>{item.label}</p>
            {item.desc && <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#94A3B8' }}>{item.desc}</p>}
          </div>
        ))}
      </div>

      {/* Sprint 3C — corte por dependencia del período. */}
      {filasDependencia.length > 0 && (
        <div className="rounded-xl bg-white p-4 mb-6" style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>
            Por dependencia · {ETIQUETA_PRESET[preset]}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left" style={{ color: '#667085' }}>
                  <th className="py-1.5 pr-3 font-semibold">Dependencia</th>
                  <th className="py-1.5 px-3 font-semibold text-right">Total</th>
                  <th className="py-1.5 px-3 font-semibold text-right">Pendientes</th>
                  <th className="py-1.5 px-3 font-semibold text-right">En trámite</th>
                  <th className="py-1.5 px-3 font-semibold text-right">Resueltos</th>
                  <th className="py-1.5 pl-3 font-semibold text-right">Vencidas</th>
                </tr>
              </thead>
              <tbody>
                {filasDependencia.map((f) => (
                  <tr key={f.oficina} style={{ borderTop: '1px solid #EEF2EE', color: '#1F2933' }}>
                    <td className="py-2 pr-3 font-medium">{NOMBRES_TENANT[f.oficina] ?? f.oficina}</td>
                    <td className="py-2 px-3 text-right font-bold tabular-nums">{f.total}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{f.pendientes}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{f.enTramite}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{f.resueltos}</td>
                    <td className="py-2 pl-3 text-right tabular-nums font-bold"
                        style={{ color: f.vencidas > 0 ? '#DC2626' : '#94A3B8' }}>
                      {f.vencidas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fase B — lo que la administración despachó en el mismo período. */}
      {resumenSal && (
        <div className="rounded-xl bg-white p-4 mb-6" style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8A6A12' }}>
            Correspondencia de salida · {ETIQUETA_PRESET[preset]}
          </p>
          {resumenSal.total === 0 ? (
            <p className="text-xs" style={{ color: '#7A8B7F' }}>
              Sin salidas 2-SAL registradas en el período
              {depFiltro !== 'TODAS' ? ' para esta dependencia' : ''}.
            </p>
          ) : (
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-3xl font-black tabular-nums" style={{ color: '#12261A' }}>{resumenSal.total}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: '#667085' }}>Salidas despachadas</p>
              </div>
              <div>
                <p className="text-3xl font-black tabular-nums" style={{ color: '#185FA5' }}>{resumenSal.respuestas}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: '#667085' }}>Respuestas a radicados</p>
              </div>
              <div>
                <p className="text-3xl font-black tabular-nums" style={{ color: '#3A4551' }}>{resumenSal.oficios}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: '#667085' }}>Oficios independientes</p>
              </div>
              {resumenSal.porMedio.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                  {resumenSal.porMedio.map((m) => (
                    <span
                      key={m.medio}
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#475569' }}
                    >
                      {MEDIO_SALIDA_LABEL[m.medio] ?? m.medio}: {m.cantidad}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pctCumplimiento === null && (
        <div className="rounded-lg px-4 py-3 mb-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
            <span className="font-bold">MIPG Req. 8 — Sin datos de cumplimiento aún.</span>{' '}
            El campo <span className="font-mono">cumplioTermino</span> se registra automáticamente
            la próxima vez que se resuelva un radicado. Los radicados históricos no tienen este dato.
          </p>
        </div>
      )}

      <p className="text-xs print:hidden" style={{ color: '#94A3B8' }}>
        Datos en tiempo real · colección <span className="font-mono">ventanilla_radicados</span> ·
        {' '}{subconjunto.length} de {total} documento{total !== 1 ? 's' : ''} en el período ·
        el CSV exporta lo filtrado; el Excel MIPG, el histórico completo.
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
                    <p className="text-xs font-medium truncate" style={{ color: '#1F2933' }}>{nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}</p>
                    <p className="text-[10px] font-mono" style={{ color: '#94A3B8' }}>
                      {documentoSolicitanteVisible(r, r.solicitante.tipoDocumento, r.solicitante.numeroDocumento)}
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [resumenData, setResumenData] = useState<ResumenDiarioData | null>(null);
  const [resumenModalAbierto, setResumenModalAbierto] = useState(false);
  const [errorAbrirRadicado, setErrorAbrirRadicado] = useState<string | null>(null);
  const radicadoCerradoDesdeUrlRef = useRef<string | null>(null);

  const tieneAlertasResumen = (data: ResumenDiarioData | null) =>
    Boolean(data && Object.values(data.totales).some((valor) => typeof valor === 'number' && valor > 0));

  // Carga inicial del resumen del día
  useEffect(() => {
    fetch('/api/interno/resumen-diario', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('No fue posible cargar el resumen.');
        return res.json();
      })
      .then((data) => {
        setResumenData(data);
        if (data.mostrar) {
          setResumenModalAbierto(true);
        }
      })
      .catch((err) => console.error('Error al cargar resumen diario:', err));
  }, []);

  const marcarResumenVisto = async () => {
    if (!resumenData) return;
    try {
      const response = await fetch('/api/interno/resumen-diario/visto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fecha: resumenData.fecha,
          cantidadAlertas: Object.values(resumenData.totales).reduce((a, b) => a + b, 0),
        }),
      });
      if (response.ok) {
        setResumenData(prev => prev ? { ...prev, mostrar: false } : null);
      }
    } catch (err) {
      console.error('Error al marcar resumen como visto:', err);
    }
  };

  const reabrirResumen = () => {
    if (tieneAlertasResumen(resumenData)) {
      setResumenModalAbierto(true);
    } else {
      fetch('/api/interno/resumen-diario', { credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error('No fue posible cargar el resumen.');
          return res.json();
        })
        .then((data) => {
          setResumenData(data);
          if (tieneAlertasResumen(data)) {
            setResumenModalAbierto(true);
          }
        })
        .catch((err) => console.error('Error al recargar resumen diario:', err));
    }
  };

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
  // Panel Op Nivel 1 — flag separado de esAdmin: gatea SOLO el selector
  // de dependencia. RECEPCIONISTA ve todos los tenants pero no hereda
  // los paneles administrativos (gobernanza SIMI, semáforo PQRSD).
  const veTodosTenants = puedeVerTodosLosTenants(usuario.rol);
  const tienePermisoRadicar = puedeRadicar(usuario);
  const tienePermisoBandeja = puedeUsarBandejaAsignacion(usuario);
  const [busquedaAvanzadaAbierta, setBusquedaAvanzadaAbierta] = useState(false);
  // Sprint Radicación de salida — modal (null = cerrado; entrada = amarre).
  const [salidaModal, setSalidaModal] = useState<{ entrada: EntradaAmarre | null } | null>(null);
  // Sprint Planilla de reparto — panel de entrega de documentos físicos.
  const [repartoAbierto, setRepartoAbierto] = useState(false);
  // Fase B — el libro completo lo leen los mismos roles de la vista
  // Salidas; el hook sin recorte por tenant solo se activa para ellos.
  const puedeVerLibroSalidas = usuario.rol === 'ADMIN'
    || usuario.rol === 'RECEPCIONISTA' || usuario.rol === 'CONTROL_INTERNO';
  const salidasLibro = useSalidas(
    vistaActual === 'SALIDAS'
    || (vistaActual === 'REPORTES' && puedeVerLibroSalidas),
  );
  // Sprint Registro exprés — modal para roles operativos.
  const [registroExpresAbierto, setRegistroExpresAbierto] = useState(false);
  const puedeRegistroExpres = usuario.rol !== 'CONTROL_INTERNO';
  const puedeRegistrarSalida = usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA';
  const {
    modo: indicadoresModo,
    toggle: toggleIndicadoresModo,
    bandejaMinimizada,
    siguienteMinimizada,
    toggleBandeja,
    toggleSiguiente,
  } = useIndicadoresModo();
  const indicadoresCompactos = indicadoresModo === 'compacto';
  /** Roles de solo lectura: pueden ver pero no ejecutar acciones sobre radicados. */
  const esVistaReadOnly = usuario.rol === 'JEFE_DEPENDENCIA' || usuario.rol === 'CONTROL_INTERNO';

  const { radicados: todosLosRadicados, cargando, error } =
    useVentanillaRadicados(usuario, tenantFiltro);

  const abrirRadicadoPorId = useCallback((radicadoId: string | null | undefined, actualizarUrl = true): boolean => {
    const id = radicadoId?.trim();
    if (!id) {
      setErrorAbrirRadicado('No fue posible abrir el radicado.');
      console.warn('[dashboard] No fue posible abrir radicado: ID ausente.');
      return false;
    }

    const radicado = todosLosRadicados.find((r) => r.radicadoId === id);
    if (!radicado) {
      setErrorAbrirRadicado('No fue posible abrir el radicado.');
      console.warn('[dashboard] No fue posible abrir radicado dentro del alcance del usuario.', { radicadoId: id });
      return false;
    }

    setErrorAbrirRadicado(null);
    radicadoCerradoDesdeUrlRef.current = null;
    if (actualizarUrl) {
      router.push(`/interno/dashboard?radicadoId=${encodeURIComponent(id)}`, { scroll: false });
    }
    dispatch({ type: 'SET_VISTA', vista: 'TABLERO' });
    dispatch({ type: 'SELECCIONAR_RADICADO', radicado });
    setMenuMovilAbierto(false);
    return true;
  }, [dispatch, router, todosLosRadicados]);

  const cerrarPanelDerecho = useCallback(() => {
    const radicadoId = radicadoSeleccionado?.radicadoId ?? searchParams.get('radicadoId');
    radicadoCerradoDesdeUrlRef.current = radicadoId;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('radicadoId');
    const query = params.toString();

    router.replace(query ? `/interno/dashboard?${query}` : '/interno/dashboard', { scroll: false });
    dispatch({ type: 'CERRAR_PANEL_DERECHO' });
  }, [dispatch, radicadoSeleccionado?.radicadoId, router, searchParams]);

  /* Sincronizar radicado seleccionado con datos en tiempo real */
  useEffect(() => {
    if (todosLosRadicados.length > 0) {
      dispatch({ type: 'SYNC_RADICADO_SELECCIONADO', radicados: todosLosRadicados });
    }
  }, [todosLosRadicados, dispatch]);

  useEffect(() => {
    if (cargando) return;
    const radicadoId = searchParams.get('radicadoId');
    if (!radicadoId) return;
    if (radicadoCerradoDesdeUrlRef.current === radicadoId) return;
    if (radicadoSeleccionado?.radicadoId === radicadoId && panelDerechoAbierto) return;
    abrirRadicadoPorId(radicadoId, false);
  }, [
    abrirRadicadoPorId,
    cargando,
    panelDerechoAbierto,
    radicadoSeleccionado?.radicadoId,
    searchParams,
  ]);

  useEffect(() => {
    if (!puedeAccederVista(usuario, vistaActual)) {
      dispatch({ type: 'SET_VISTA', vista: 'TABLERO' });
    }
  }, [dispatch, usuario, vistaActual]);

  const metricas = useMemo(() => calcularMetricas(todosLosRadicados), [todosLosRadicados]);

  // Sprint tablero-jerarquia — la card vertical "Todos" desapareció de
  // TarjetasMIPG; su total (suma de los 8 KPIs MIPG, mismo cálculo de
  // siempre) pasa a un chip junto al título del Tablero. También
  // reutilizamos los 4 KPIs "compactos" (Prioridad/En término/
  // Devueltas-Prórroga/Fuera de término) para fusionarlos con la banda
  // "Estado operativo" — ver <BarraKpisOperativos chipsExtra=…> abajo.
  const tarjetasMipg = useMemo(() => construirTarjetasMIPG(metricas), [metricas]);
  const totalKpisMipg = useMemo(
    () => tarjetasMipg.reduce((s, t) => s + t.valor, 0),
    [tarjetasMipg],
  );
  const tarjetasMipgCompactas = useMemo(
    () => tarjetasMipg.filter((t) => !(FILTROS_GRANDES as string[]).includes(t.filtro)),
    [tarjetasMipg],
  );

  // Sprint 1.5 — toggle secundario "Datos incompletos" en la bandeja.
  // Estado local del componente (no va al store global porque es un
  // filtro efímero que no debe persistir entre sesiones).
  const [soloDatosIncompletos, setSoloDatosIncompletos] = useState(false);

  // Panel Op Fase 2 — KPIs operativos y filtro operativo secundario.
  // Ambos son efímeros: no persisten entre sesiones. Solo un filtro
  // operativo activo a la vez, combinable con el filtro MIPG.
  const kpisOperativos = useMemo(() => calcularKpisOperativos(todosLosRadicados), [todosLosRadicados]);
  const [filtroOperativo, setFiltroOperativo] = useState<FiltroKpiOperativo>('NINGUNO');

  // Sprint Cola personal — "Solo los míos": filtro de identidad efímero,
  // combinable con las demás dimensiones.
  const [soloMios, setSoloMios] = useState(false);
  // Sprint Semana + badge — un solo memo alimenta el chip del Tablero y
  // el numerito del sidebar: activos míos + el peor nivel de término.
  const miCarga = useMemo(() => {
    const ahora = new Date();
    let activos = 0;
    let vencidos = 0;
    let porVencer = 0;
    for (const r of todosLosRadicados) {
      if (r.clasificacion?.funcionarioResponsableUid !== usuario.uid) continue;
      if (r.estadoActual === 'RESUELTO' || r.estadoActual === 'RECHAZADO') continue;
      activos += 1;
      if (r.termino?.fechaVencimiento) {
        const d = diasRestantesHabiles(r.termino.fechaVencimiento, ahora);
        if (d < 0) vencidos += 1;
        else if (d <= 2) porVencer += 1;
      }
    }
    const nivel: 'ROJO' | 'AMBAR' | 'NEUTRO' =
      vencidos > 0 ? 'ROJO' : porVencer > 0 ? 'AMBAR' : 'NEUTRO';
    return { activos, nivel };
  }, [todosLosRadicados, usuario.uid]);
  const misActivos = miCarga.activos;

  const radicadosFiltrados = useMemo(() => {
    const conMipg = aplicarFiltroMIPG(todosLosRadicados, filtroMIPG, busqueda);
    const conOp   = filtrarPorKpiOperativo(conMipg, filtroOperativo);
    const conMios = soloMios
      ? conOp.filter((r) => r.clasificacion?.funcionarioResponsableUid === usuario.uid)
      : conOp;
    return soloDatosIncompletos ? filtrarSoloDatosIncompletos(conMios) : conMios;
  }, [todosLosRadicados, filtroMIPG, busqueda, filtroOperativo, soloMios, usuario.uid, soloDatosIncompletos]);

  // Panel Op Nivel 3A — estado combinado de las 5 dimensiones de filtro
  // para la barra de filtros activos. Reúne store + estado local.
  const estadoFiltros: EstadoFiltros = {
    filtroMIPG,
    filtroOperativo,
    tenantFiltro,
    soloDatosIncompletos,
    soloMios,
    busqueda,
  };

  function quitarDimensionFiltro(dimension: DimensionFiltro) {
    switch (dimension) {
      case 'MIPG':              dispatch({ type: 'SET_FILTRO_MIPG', filtro: 'TODOS' }); break;
      case 'OPERATIVO':         setFiltroOperativo('NINGUNO'); break;
      case 'TENANT':            dispatch({ type: 'SET_TENANT_FILTRO', tenant: 'TODOS' }); break;
      case 'DATOS_INCOMPLETOS': setSoloDatosIncompletos(false); break;
      case 'SOLO_MIOS':         setSoloMios(false); break;
      case 'BUSQUEDA':          dispatch({ type: 'SET_BUSQUEDA', busqueda: '' }); break;
    }
  }

  function limpiarTodosLosFiltros() {
    dispatch({ type: 'SET_FILTRO_MIPG', filtro: 'TODOS' });
    dispatch({ type: 'SET_TENANT_FILTRO', tenant: 'TODOS' });
    dispatch({ type: 'SET_BUSQUEDA', busqueda: '' });
    setFiltroOperativo('NINGUNO');
    setSoloDatosIncompletos(false);
    setSoloMios(false);
  }

  const radicadosPendientes = useMemo(
    () => todosLosRadicados.filter((r) => r.estadoActual === 'PENDIENTE'),
    [todosLosRadicados],
  );

  // Fase 2 — badge de alertas por rol.
  // Panel Op Nivel 1: usa veTodosTenants (no esAdmin) para que el badge
  // sea coherente con el alcance de la bandeja — si la recepcionista ve
  // el municipio entero, sus alertas también deben ser municipales.
  const pendientesAlertas = useMemo(
    () => contarAlertasActivas(todosLosRadicados, veTodosTenants, usuario.tenantId),
    [todosLosRadicados, veTodosTenants, usuario.tenantId],
  );

  // Sprint SMTP — alerta por correos institucionales fallidos sin gestionar.
  // El flag se persiste en raíz del documento (alertaNotificacionFallida)
  // para evitar leer la subcolección de trazabilidad en cada render.
  const pendientesNotificacionFallida = useMemo(() => {
    return todosLosRadicados.reduce((acc, r) => {
      if (r.alertaNotificacionFallida !== true) return acc;
      // Roles con visión municipal cuentan todos; los demás, solo su tenant.
      if (veTodosTenants) return acc + 1;
      if (r.clasificacion.oficinaDestino === usuario.tenantId) return acc + 1;
      return acc;
    }, 0);
  }, [todosLosRadicados, veTodosTenants, usuario.tenantId]);

  function cambiarVista(vista: VistaActual) {
    dispatch({ type: 'SET_VISTA', vista });
    setMenuMovilAbierto(false);
  }

  function verCorreosFallidos() {
    dispatch({ type: 'SET_VISTA', vista: 'TABLERO' });
    dispatch({ type: 'SET_FILTRO_MIPG', filtro: 'CORREOS_FALLIDOS' });
    dispatch({ type: 'SET_BUSQUEDA', busqueda: '' });
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
        onRegistroExpres={puedeRegistroExpres ? () => setRegistroExpresAbierto(true) : undefined}
        usuario={usuario}
        onCerrarSesion={cerrarSesion}
        pendientesBandeja={radicadosPendientes.length}
        pendientesAlertas={pendientesAlertas}
        miCarga={miCarga}
        pendientesNotificacionFallida={pendientesNotificacionFallida}
        onVerCorreosFallidos={verCorreosFallidos}
        onAbrirResumen={reabrirResumen}
      />

      {/* ── COLUMNA 2: Cuerpo central ──
            Sprint UI Bandeja: añadimos `min-h-0` para que los hijos con
            `flex-1` puedan ceder altura al scroll interno sin crecer
            indefinidamente y romper el layout. */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        <MobileTopBar
          usuario={usuario}
          vistaActual={vistaActual}
          onAbrirMenu={() => setMenuMovilAbierto(true)}
          onAbrirResumen={reabrirResumen}
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
            onVerRadicado={(r) => abrirRadicadoPorId(r.radicadoId)}
          />
        ) : vistaActual === 'REPORTES' ? (
          <VistaReportes
            total={todosLosRadicados.length}
            radicados={todosLosRadicados}
            salidas={puedeVerLibroSalidas ? salidasLibro.salidas : null}
          />
        ) : vistaActual === 'SALIDAS' ? (
          /* Sprint Radicación de salida — libro de correspondencia despachada. */
          <VistaSalidas
            salidas={salidasLibro.salidas}
            cargando={salidasLibro.cargando}
            error={salidasLibro.error}
            onAbrirEntrada={(id) => abrirRadicadoPorId(id)}
            onNuevaSalida={() => {
              if (puedeRegistrarSalida) setSalidaModal({ entrada: null });
            }}
          />
        ) : vistaActual === 'BANDEJA' && tienePermisoBandeja ? (
          <BandejaAsignacion
            radicados={radicadosPendientes}
            cargando={cargando}
            error={error}
            usuario={usuario}
          />
        ) : vistaActual === 'DEPENDENCIAS' ? (
          <PanelCargaDependencias radicados={todosLosRadicados} />
        ) : vistaActual === 'MI_GESTION' ? (
          /* Sprint Mi gestión — desempeño personal: cada quien ve SOLO
             lo suyo (privacidad v1); clic en lo urgente abre el detalle. */
          <VistaMiGestion
            radicados={todosLosRadicados}
            usuario={usuario}
            onAbrirRadicado={(id) => abrirRadicadoPorId(id)}
          />
        ) : vistaActual === 'SUPERVISION_IA' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0E0E10]/40">
            <VistaSupervisionIA />
          </div>
        ) : vistaActual === 'ANTICIPACION_OPERATIVA' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0E0E10]/40">
            <VistaAnticipacionOperativa radicados={todosLosRadicados} />
          </div>
        ) : vistaActual === 'LICENCIAS' ? (
          /* Bloque B ("la ventanita") — Licencias como pestaña REAL del
             panel interno, ya no página aparte. Módulo de pantalla
             completa: gestiona su propia navegación interna (bandeja/libro
             consecutivo/detalle) con estado local, no con `VistaActual`. */
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
            <VistaLicencias />
          </div>
        ) : vistaActual === 'CONTROL_INTERNO' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" style={{ background: '#F8FAF7' }}>
            <CentroControlInterno />
            <details className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
                Dashboard MIPG histórico (Sprint 5)
              </summary>
              <div className="mt-3">
                <ControlInternoDashboard />
              </div>
            </details>
          </div>
        ) : vistaActual === 'APROBACIONES' ? (
          <JefeAprobacionesPanel usuarioRol={usuario.rol} />
        ) : vistaActual === 'ADMINISTRACION' ? (
          <div className="flex-1 flex overflow-hidden min-h-0">
            <div className="min-w-0 flex-1 overflow-hidden min-h-0"><VistaAdministracion /></div>
            {esAdmin && (
              <div className="hidden xl:flex flex-col w-[420px] shrink-0 border-l" style={{ borderColor: '#D9E2D9' }}>
                <SimiGobernanzaPanel usuario={usuario} />
              </div>
            )}
          </div>
        ) : vistaActual === 'VENTANILLA' ? (
          /* Ventanilla · módulo de mostrador — vista propia, ya NO hereda
             el Tablero. Búsqueda con estado propio y radicación como
             acción primaria. */
          <VistaVentanilla
            radicados={todosLosRadicados}
            puedeRadicar={tienePermisoRadicar}
            onNuevaRadicacion={() => dispatch({ type: 'TOGGLE_DRAWER_NUEVO' })}
            onAbrirBusquedaAvanzada={() => setBusquedaAvanzadaAbierta(true)}
            onAbrirRadicado={(id) => abrirRadicadoPorId(id)}
            onRegistrarSalida={puedeRegistrarSalida
              ? () => setSalidaModal({ entrada: null })
              : undefined}
            onAbrirReparto={puedeRegistrarSalida
              ? () => setRepartoAbierto(true)
              : undefined}
          />
        ) : (
          <>
            {/* Rediseño 3B.2 — encabezado de sala de operaciones (solo
                desktop; el móvil ya tiene su propio header). */}
            {vistaActual === 'TABLERO' && (
              <div className="hidden md:flex items-center justify-between gap-3 px-4 pt-2 pb-1 bg-white shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#5F8A6E' }}>
                        Sala de operaciones
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3B9E5F' }} />
                      <span className="text-[10px]" style={{ color: '#7A8B7F' }}>tiempo real</span>
                    </div>
                    <p className="text-lg font-black leading-tight mt-0.5" style={{ color: '#12261A' }}>
                      Tablero · {veTodosTenants
                        ? (tenantFiltro === 'TODOS' ? 'Vista municipal' : (NOMBRES_TENANT[tenantFiltro] ?? 'Vista municipal'))
                        : NOMBRES_TENANT[usuario.tenantId]}
                    </p>
                  </div>
                  {/* Sprint tablero-jerarquia — reemplaza la card vertical
                      "Todos" que antes competía visualmente con las 4
                      tarjetas de severidad; mismo total, mismo filtro de
                      reinicio, ahora como chip discreto junto al título. */}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_FILTRO_MIPG', filtro: 'TODOS' })}
                    aria-pressed={filtroMIPG === 'TODOS'}
                    aria-label={`Ver todos los radicados activos del panorama MIPG (${totalKpisMipg})`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                    style={filtroMIPG === 'TODOS'
                      ? { background: '#EEF4EE', color: '#14532D', border: '1px solid #14532D' }
                      : { background: '#F8FAF7', color: '#14532D', border: '1px solid #D9E2D9' }}
                  >
                    <span className="tabular-nums">{totalKpisMipg}</span> activos
                  </button>
                </div>
              </div>
            )}

            {/* Dashboard PQRSD compacto — vencimientos y riesgo.
                En modo "compacto" se oculta para dar más altura al listado. */}
            {esAdmin && (
              <div className="px-4 py-2 bg-white shrink-0" style={{ borderBottom: '1px solid #D9E2D9' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#14532D' }}>
                  Semáforo PQRSD
                </p>
                <PqrsdDeadlineDashboard
                  radicados={todosLosRadicados}
                  filtroTenant={tenantFiltro}
                  compact={true}
                />
              </div>
            )}

            {/* Fila de métricas MIPG — 4 tarjetas grandes con jerarquía
                por severidad. Los 4 KPIs restantes se fusionaron en la
                banda "Estado operativo" de abajo (chipsExtra). */}
            <TarjetasMIPG
              metricas={metricas}
              filtroActivo={filtroMIPG}
              onFiltroChange={(f) => dispatch({ type: 'SET_FILTRO_MIPG', filtro: f })}
              veTodosTenants={veTodosTenants}
              tenantFiltro={tenantFiltro}
              onTenantChange={(t) => dispatch({ type: 'SET_TENANT_FILTRO', tenant: t })}
              modoCompacto={indicadoresCompactos}
              onToggleCompacto={toggleIndicadoresModo}
              soloDatosIncompletos={soloDatosIncompletos}
              onToggleDatosIncompletos={() => setSoloDatosIncompletos((v) => !v)}
              radicados={todosLosRadicados}
              onAbrirRadicado={(id) => abrirRadicadoPorId(id)}
            />

            {/* Panel Op Fase 2 — banda única "Estado operativo": KPIs
                MIPG compactos + KPIs operativos del día en una sola
                franja (sprint tablero-jerarquia). En modo compacto los
                MIPG ya están en la fila de TarjetasMIPG — no se duplican. */}
            <BarraKpisOperativos
              kpis={kpisOperativos}
              filtroActivo={filtroOperativo}
              onChange={setFiltroOperativo}
              chipsExtra={!indicadoresCompactos && tarjetasMipgCompactas.length > 0 ? (
                <>
                  {tarjetasMipgCompactas.map((t) => (
                    <ChipMipgCompacto
                      key={t.filtro}
                      item={t}
                      activo={filtroMIPG === t.filtro}
                      compacto
                      onClick={() => dispatch({ type: 'SET_FILTRO_MIPG', filtro: t.filtro })}
                    />
                  ))}
                  <span className="w-px self-stretch shrink-0" style={{ background: '#D9E2D9' }} aria-hidden="true" />
                </>
              ) : undefined}
              misAsignados={misActivos}
              soloMios={soloMios}
              onToggleSoloMios={() => setSoloMios((v) => !v)}
            />

            {/* Panel Op Nivel 3A — barra de filtros activos (solo si hay). */}
            <BarraFiltrosActivos
              estado={estadoFiltros}
              onQuitarDimension={quitarDimensionFiltro}
              onLimpiarTodo={limpiarTodosLosFiltros}
            />

            <PanelOperacionDependencia
              usuario={usuario}
              radicados={todosLosRadicados}
              onFiltroChange={(f) => dispatch({ type: 'SET_FILTRO_MIPG', filtro: f })}
              onSeleccionar={(r) => dispatch({ type: 'SELECCIONAR_RADICADO', radicado: r })}
              bandejaMinimizada={bandejaMinimizada}
              siguienteMinimizada={siguienteMinimizada}
              onToggleBandeja={toggleBandeja}
              onToggleSiguiente={toggleSiguiente}
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
              onAbrirBusquedaAvanzada={() => setBusquedaAvanzadaAbierta(true)}
            />
          </>
        )}
      </div>

      {errorAbrirRadicado && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg"
          style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}
        >
          {errorAbrirRadicado}
        </div>
      )}

      {/* ── COLUMNA 3: Panel derecho — oculto en vistas de pantalla completa ── */}
      {vistaActual !== 'BANDEJA' && vistaActual !== 'DEPENDENCIAS'
       && vistaActual !== 'ANALYTICS' && vistaActual !== 'ALERTAS'
       && vistaActual !== 'SUPERVISION_IA' && vistaActual !== 'ANTICIPACION_OPERATIVA'
       && vistaActual !== 'APROBACIONES'
       && vistaActual !== 'CONTROL_INTERNO' && vistaActual !== 'LICENCIAS' && (
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
              onCerrar={cerrarPanelDerecho}
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
          radicados={todosLosRadicados}
        />
      )}

      {/* Sprint Registro exprés — correspondencia respondida directo. */}
      {registroExpresAbierto && puedeRegistroExpres && (
        <RegistroExpresModal
          usuario={usuario}
          onCerrar={() => setRegistroExpresAbierto(false)}
        />
      )}

      {/* Sprint Radicación de salida — registro de despacho. */}
      {salidaModal && puedeRegistrarSalida && (
        <RegistrarSalidaModal
          usuario={usuario}
          entrada={salidaModal.entrada}
          onCerrar={() => setSalidaModal(null)}
        />
      )}

      {/* Sprint Planilla de reparto — entrega de documentos físicos. */}
      {repartoAbierto && puedeRegistrarSalida && (
        <PanelReparto onCerrar={() => setRepartoAbierto(false)} />
      )}

      {/* ── Sprint 2: Búsqueda Histórica Avanzada ── */}
      <BusquedaAvanzadaPanel
        abierto={busquedaAvanzadaAbierta}
        onCerrar={() => setBusquedaAvanzadaAbierta(false)}
        onSeleccionar={(r) => {
          dispatch({ type: 'SELECCIONAR_RADICADO', radicado: r });
          setBusquedaAvanzadaAbierta(false);
        }}
        onExportarExcel={async (filtros) => {
          await descargarExcelMipg(filtros as Record<string, unknown>);
        }}
      />

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
            onRegistroExpres={puedeRegistroExpres ? () => { setRegistroExpresAbierto(true); setMenuMovilAbierto(false); } : undefined}
            usuario={usuario}
            onCerrarSesion={cerrarSesion}
            pendientesBandeja={radicadosPendientes.length}
            pendientesAlertas={pendientesAlertas}
            miCarga={miCarga}
            pendientesNotificacionFallida={pendientesNotificacionFallida}
            onVerCorreosFallidos={verCorreosFallidos}
            onAbrirResumen={reabrirResumen}
          />
        </div>
      )}

      {resumenModalAbierto && resumenData && (
        <ResumenDiarioModal
          data={resumenData}
          userName={usuario.nombre}
          userRol={usuario.rol}
          onCerrar={() => setResumenModalAbierto(false)}
          onFiltroMIPG={(f) => dispatch({ type: 'SET_FILTRO_MIPG', filtro: f })}
          onVistaChange={(v) => dispatch({ type: 'SET_VISTA', vista: v })}
          onCerrarDefinitivo={marcarResumenVisto}
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
