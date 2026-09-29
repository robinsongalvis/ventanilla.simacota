'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Check,
  ClipboardPenLine,
  CircleX,
  Clock3,
  Eye,
  FileText,
  History,
  Info,
  MessageSquareText,
  MoreVertical,
  Paperclip,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  UserRoundX,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
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
import { ComprobanteRadicado }             from '@/app/interno/dashboard/components/ComprobanteRadicado';
import { SelloRecibido }                   from '@/app/interno/dashboard/components/SelloRecibido';
import { CompletarDatosSolicitante }       from '@/app/interno/dashboard/components/CompletarDatosSolicitante';
import { datosConstanciaDesdeRadicado }    from '@/lib/mostrador/constancia-desde-radicado';
import {
  documentoSolicitanteVisible,
  identidadProtegida,
  nombreSolicitanteVisible,
} from '@/lib/seguridad/identidad-protegida';
import { coincideTextoRadicado, normalizarTextoBusqueda } from '@/lib/busqueda/coincidencia-texto-radicado';
import { agruparDestinosPorDependencia, areasParaDependencia, getNombreArea } from '@/lib/catalogos/areas';
import { RegistroExpresModal } from '@/app/interno/dashboard/components/RegistroExpresModal';
import { RegistrarSalidaModal, type EntradaAmarre } from '@/app/interno/dashboard/components/salidas/RegistrarSalidaModal';
import { PanelReparto }                    from '@/app/interno/dashboard/components/reparto/PanelReparto';
import { VistaSalidas }                    from '@/app/interno/dashboard/components/salidas/VistaSalidas';
import { VistaMiGestion }                  from '@/app/interno/dashboard/components/mi-gestion/VistaMiGestion';
import { useSalidas }                      from '@/lib/hooks/useSalidas';
import { construirHistoria, type FiltroHistoria, type TonoEvento } from '@/lib/trazabilidad/humanizar-evento';
import { resumirCambio } from '@/lib/traslado/resumir-cambio';
import { BusquedaAvanzadaPanel }           from '@/app/interno/dashboard/components/BusquedaAvanzadaPanel';
import { VistaVentanilla, type DestinoTableroVentanilla }                 from '@/app/interno/dashboard/components/ventanilla/VistaVentanilla';
import { useIndicadoresModo }              from '@/lib/hooks/useIndicadoresModo';
import { useTemaInterno, type TemaInterno } from '@/lib/hooks/useTemaInterno';
import { BotonTema } from '@/app/components/design-system/BotonTema';
import type { IndicadorInteractivoProps } from '@/app/components/design-system/Indicador';
import { ChipFiltro } from '@/app/components/design-system/ChipFiltro';
import { PanelIndicadoresColapsable } from '@/app/components/design-system/PanelIndicadoresColapsable';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { BarraTrabajo } from '@/app/components/design-system/BarraTrabajo';
import { CabeceraTablaSticky, SuperficieTabla } from '@/app/components/design-system/SuperficieTabla';
import { PanelPestana, Pestanas } from '@/app/components/design-system/Pestanas';
import {
  formatFechaColombia,
  formatFechaCortaColombia,
  formatFechaHoraColombia,
  formatHoraColombia,
} from '@/lib/fecha-colombia';
import { PanelCargaDependencias }          from '@/app/interno/dashboard/components/dependencias/PanelCargaDependencias';
import { BandejaAsignacion } from '@/app/interno/dashboard/components/bandeja/BandejaAsignacion';
import { VistaReportes } from '@/app/interno/dashboard/components/reportes/VistaReportes';
import { descargarExcelMipg } from '@/app/interno/dashboard/components/reportes/exportaciones-mipg';
import { VistaAnalytics }                  from '@/app/interno/dashboard/components/analytics/VistaAnalytics';
import { VistaAlertas, contarAlertasActivas } from '@/app/interno/dashboard/components/analytics/VistaAlertas';
import { VistaSupervisionIA }              from '@/app/interno/dashboard/components/analytics/VistaSupervisionIA';
import { VistaAnticipacionOperativa }      from '@/app/interno/dashboard/components/analytics/VistaAnticipacionOperativa';
import { VistaLicencias }                  from '@/app/interno/dashboard/components/licencias/VistaLicencias';
import { leerDestinoLicencias, urlLicencias, PARAMETROS_LICENCIAS } from '@/app/interno/licencias/rutas-licencias';
import type {
  FiltroMIPG,
  VistaActual,
}                                         from '@/lib/store/ventanillaStore';
import type { TenantId }                  from '@/src/types/radicado';
import { calcularSemaforo } from '@/app/interno/dashboard/components/mipg/SemaforoTermino';
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
/* ADR-0034 — ventanilla ve el ESTADO del trámite de licencia. Vivía colgado de
   `PanelGestionRadicado`, el panel de detalle ANTERIOR, que el Sprint Panel
   claro dejó sin un solo llamador: la proyección se construyó, se probó y se
   aseguró, y nadie llegó nunca a verla. Cuelga del panel que sí se pinta. */
import { EstadoTramiteLicencia }             from '@/app/interno/dashboard/components/pqrs/EstadoTramiteLicencia';
import { calcularKpisOperativos }            from '@/lib/kpis-operativos/calcular-kpis-operativos';
import {
  filtrarPorKpiOperativo,
  type FiltroKpiOperativo,
} from '@/lib/kpis-operativos/filtrar-por-kpi-operativo';
import {
  construirContextoInterno,
  puedeAccederVista,
  puedeRadicar,
} from '@/lib/permisos/contexto-interno';
import { BarraFiltrosActivos } from '@/app/interno/dashboard/components/BarraFiltrosActivos';
import type { EstadoFiltros, DimensionFiltro } from '@/lib/filtros-activos/resumir-filtros-activos';
import { etiquetaFiltroMIPG } from '@/lib/filtros-activos/resumir-filtros-activos';
import { PriorityBanner } from '@/app/components/design-system/PriorityBanner';
import { useFuncionariosTenant }              from '@/lib/hooks/useFuncionariosTenant';
import type { FuncionarioTenant }             from '@/lib/hooks/useFuncionariosTenant';
import type { ResponsableFuncionario }        from '@/lib/actions/asignarRadicado';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';
import type { UsuarioAutenticado }        from '@/lib/hooks/useAuth';
import { buildOficioInstitucional, ciudadanoOficioDesdeRadicado } from '@/lib/respuesta-oficial/oficio-institucional';
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


/* Las variantes `oscuro:` solo aplican dentro de `[data-tema="oscuro"]`
   (ADR-0043); en claro las clases base no cambian. */
const BADGE_ESTADO: Record<string, string> = {
  PENDIENTE:   'bg-yellow-50  text-yellow-800 border-yellow-200 oscuro:bg-yellow-500/15 oscuro:text-yellow-300 oscuro:border-yellow-500/30',
  EN_REVISION: 'bg-blue-50    text-blue-800   border-blue-200   oscuro:bg-blue-500/15   oscuro:text-blue-300   oscuro:border-blue-500/30',
  EN_PROCESO:  'bg-sky-50     text-sky-800    border-sky-200    oscuro:bg-sky-500/15    oscuro:text-sky-300    oscuro:border-sky-500/30',
  ASIGNADO:    'bg-[var(--tema-fondo-fbefd2)]  text-[var(--tema-texto-007049)]  border-[#E5A31A]/40 oscuro:bg-[#E5A31A]/15 oscuro:text-[#FBEFD2]',
  RESUELTO:    'bg-green-50   text-green-800  border-green-200  oscuro:bg-green-500/15  oscuro:text-green-300  oscuro:border-green-500/30',
  DEVUELTO:    'bg-rose-50    text-rose-800   border-rose-200   oscuro:bg-rose-500/15   oscuro:text-rose-300   oscuro:border-rose-500/30',
  RECHAZADO:   'bg-gray-100   text-gray-600   border-gray-200   oscuro:bg-gray-500/15   oscuro:text-gray-300   oscuro:border-gray-500/30',
  POR_VENCER:  'bg-orange-50  text-orange-800 border-orange-200 oscuro:bg-orange-500/15 oscuro:text-orange-300 oscuro:border-orange-500/30',
  VENCIDO:     'bg-red-50     text-red-800    border-red-200    oscuro:bg-red-500/15    oscuro:text-red-300    oscuro:border-red-500/30',
  PRORROGA:    'bg-amber-50   text-amber-800  border-amber-200  oscuro:bg-amber-500/15  oscuro:text-amber-300  oscuro:border-amber-500/30',
};
const BADGE_ESTADO_NEUTRO = 'bg-gray-100 text-gray-600 border-gray-200 oscuro:bg-gray-500/15 oscuro:text-gray-300 oscuro:border-gray-500/30';

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
  else if (filtro === 'POR_VENCER_HOY')          lista = lista.filter((r) => estaActivo(r) && calcDiasRestantes(r) === 0);
  else if (filtro === 'VENCIDAS')                lista = lista.filter((r) => estaActivo(r) && calcDiasRestantes(r) < 0);
  else if (filtro === 'CORREOS_FALLIDOS')        lista = lista.filter((r) => r.alertaNotificacionFallida === true);
  else if (filtro === 'DEVUELTAS_PRORROGA')      lista = lista.filter((r) => ['DEVUELTO', 'PRORROGA'].includes(r.estadoActual));
  else if (filtro === 'RESUELTOS_FUERA_TERMINO') lista = lista.filter((r) => r.cumplioTermino === false);

  if (busqueda.trim()) {
    /* EL PREDICADO ÚNICO del sistema (ADR-0041 §3.7, 1-sep-2026). Antes esta
       página traía su propia lista de campos en línea, en paralelo a la del
       mostrador: dos criterios donde debía haber uno, cada uno con su copia de
       la guarda anti-inferencia (ADR-0012, R9). Al ir a añadir el número del
       expediente —que el propietario pidió poder buscar— quedó claro que el
       sitio debía ser UNO.

       Qué gana el Tablero: el número del expediente vinculado, el correo del
       solicitante (detrás de la guarda de identidad, como los demás datos
       personales) y el nombre del tipo de trámite. Qué conserva: exactamente
       la misma protección — un radicado con identidad reservada sigue sin
       coincidir por nombre ni documento. */
    const q = normalizarTextoBusqueda(busqueda);
    lista = lista.filter((r) =>
      coincideTextoRadicado(r, q, { nombreDependencia: NOMBRES_TENANT[r.clasificacion.oficinaDestino] }));
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
    <div className="h-screen bg-[var(--tema-fondo-0a0a0b)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-500 oscuro:text-slate-400">Verificando sesión…</span>
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

/* Vistas que el menú agrega según el rol, en el orden de siempre. La
   visibilidad la decide `puedeAccederVista` (lib/permisos/contexto-interno,
   ADR-0046) — la misma regla que protege la vista —, no condiciones
   repetidas aquí. */
const NAV_ITEMS_POR_ROL: typeof NAV_ITEMS = [
  {
    vista: 'ANTICIPACION_OPERATIVA' as const,
    label: 'Anticipación Operativa',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    vista: 'SUPERVISION_IA' as const,
    label: 'Supervisión IA',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" />
      </svg>
    ),
  },
  {
    vista: 'CONTROL_INTERNO' as const,
    label: 'Control Interno',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    vista: 'APROBACIONES' as const,
    label: 'Aprobaciones',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    vista: 'ADMINISTRACION' as const,
    label: 'Administración',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    vista: 'LICENCIAS' as const,
    label: 'Licencias',
    icono: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
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
  menuFijado = false,
  onToggleMenuFijado,
  mostrarControlMenu = false,
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
  /** Preferencia visual disponible solo durante la gestión de un radicado. */
  menuFijado?: boolean;
  onToggleMenuFijado?: () => void;
  mostrarControlMenu?: boolean;
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

  const items = [...NAV_ITEMS, ...NAV_ITEMS_POR_ROL].filter((item) => puedeAccederVista(usuario, item.vista));

  return (
    <aside className={`h-full flex flex-col shrink-0 w-[224px] overflow-hidden ${className}`}
           style={{ background: '#03402A' }}>
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
            style={{ background: '#E5A31A', color: '#03402A', transition: 'filter 0.15s ease-out, transform 0.15s ease-out, box-shadow 0.15s ease-out', boxShadow: '0 2px 8px rgba(229, 163, 26,0.30)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(0.93)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 5px 14px rgba(229, 163, 26,0.40)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(229, 163, 26,0.30)'; }}
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
        <p className="text-[10px] font-bold uppercase tracking-widest px-2 py-1.5" style={{ color: 'rgba(255,255,255,0.60)' }}>
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
                background: '#E5A31A',
                color: '#03402A',
                boxShadow: '0 2px 8px rgba(229, 163, 26,0.30)',
              } : {
                color: 'rgba(255,255,255,0.75)',
              }}
              onMouseEnter={(e) => { if (!activo) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; } }}
              onMouseLeave={(e) => { if (!activo) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'; } }}
            >
              <span style={activo ? { color: '#03402A' } : { color: 'rgba(255,255,255,0.55)' }}>
                {icono}
              </span>
              <span className="text-xs font-medium flex-1">{label}</span>
              {vista === 'BANDEJA' && pendientesBandeja > 0 && (
                <span className="shrink-0 min-w-[18px] h-[18px] rounded-full text-white text-[9px] font-black flex items-center justify-center px-1"
                      style={{ background: '#006B45' }}>
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
                    background: miCarga.nivel === 'ROJO' ? '#D81E1E'
                      : miCarga.nivel === 'AMBAR' ? '#D97706' : '#006B45',
                  }}
                >
                  {miCarga.activos > 99 ? '99+' : miCarga.activos}
                </span>
              )}
              {/* Licencias urbanísticas — Bloque B: badge "Planeación" que
                  antes vivía en el link de página completa (mismo texto,
                  ahora dentro del ítem de navegación normal). Contraste
                  distinto activo/inactivo: sobre dorado (#E5A31A) el texto
                  claro perdía legibilidad. */}
              {vista === 'LICENCIAS' && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wide shrink-0"
                  /* AA: #03402A sobre el dorado activo (5,4:1); blanco al 60 % sobre el menú (5,3:1). */
                  style={{ color: activo ? '#03402A' : 'rgba(255,255,255,0.60)' }}
                >
                  Planeación
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {mostrarControlMenu && onToggleMenuFijado && (
        <div className="px-3 pb-2 pt-1">
          <button
            type="button"
            onClick={onToggleMenuFijado}
            aria-pressed={menuFijado}
            className="w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            style={{
              background: menuFijado ? 'rgba(229, 163, 26,0.16)' : 'rgba(255,255,255,0.06)',
              borderColor: menuFijado ? 'rgba(229, 163, 26,0.48)' : 'rgba(255,255,255,0.14)',
              color: menuFijado ? '#FBEFD2' : 'rgba(255,255,255,0.82)',
            }}
            title={menuFijado ? 'Desfijar menú lateral' : 'Fijar menú lateral'}
          >
            {menuFijado ? <PinOff className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Pin className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span className="flex-1 text-left">{menuFijado ? 'Desfijar menú' : 'Fijar menú'}</span>
          </button>
        </div>
      )}

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
                  style={{ background: 'rgba(255,255,255,0.10)', color: '#FBEFD2', borderColor: 'rgba(255,255,255,0.20)' }}>
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

/** Nombre legible de la vista actual; lo comparten la barra móvil y el encabezado de escritorio. */
function etiquetaDeVista(vistaActual: VistaActual): string {
  if (vistaActual === 'TABLERO') return 'Bandeja de trámites';
  return [...NAV_ITEMS, ...NAV_ITEMS_POR_ROL].find((item) => item.vista === vistaActual)?.label
    ?? 'Panel interno';
}

const CLASE_BOTON_ENCABEZADO = 'tablero-interactivo flex h-9 w-9 items-center justify-center rounded-xl border transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30';
const ESTILO_BOTON_ENCABEZADO = { background: 'var(--tema-fondo-ffffff)', borderColor: 'var(--tema-borde-dce4ea)', color: 'var(--text-secondary)' } as const;

/**
 * Encabezado de escritorio COMÚN a todas las pantallas del panel interno
 * (ADR-0045): mismo antetítulo, tipografía y acciones para todos los roles.
 * La lupa y la campana abren funciones que ya existían (búsqueda avanzada y
 * Resumen del día).
 */
function EncabezadoPantalla({
  antetitulo,
  titulo,
  complemento,
  fecha,
  onBuscar,
  onResumen,
  botonTema,
}: {
  antetitulo: string;
  titulo: string;
  /** Elemento junto al título (p. ej. el chip de activos del Tablero). */
  complemento?: React.ReactNode;
  fecha: string;
  onBuscar: () => void;
  onResumen: () => void;
  botonTema?: React.ReactNode;
}) {
  return (
    <header data-armazon="pantalla" className="hidden xl:flex min-w-0 items-center justify-between gap-3 px-4 pb-1 pt-3 lg:px-6 shrink-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--tema-texto-007049)' }}>
              {antetitulo}
            </span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3B9E5F' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>tiempo real</span>
          </div>
          <h1 className="mt-0.5 break-words text-lg font-black leading-tight lg:text-xl" style={{ color: 'var(--tema-texto-172033)' }}>
            {titulo}
          </h1>
        </div>
        {complemento}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="mr-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{fecha}</span>
        <button type="button" onClick={onBuscar} className={CLASE_BOTON_ENCABEZADO} style={ESTILO_BOTON_ENCABEZADO}
                aria-label="Búsqueda avanzada de radicados" title="Búsqueda avanzada de radicados">
          <Search size={17} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <button type="button" onClick={onResumen} className={CLASE_BOTON_ENCABEZADO} style={ESTILO_BOTON_ENCABEZADO}
                aria-label="Ver resumen del día" title="Ver resumen del día">
          <Bell size={17} strokeWidth={1.9} aria-hidden="true" />
        </button>
        {botonTema}
      </div>
    </header>
  );
}

function MobileTopBar({
  usuario,
  vistaActual,
  onAbrirMenu,
  onAbrirResumen,
  tema,
  onAlternarTema,
}: {
  usuario: UsuarioAutenticado;
  vistaActual: VistaActual;
  onAbrirMenu: () => void;
  onAbrirResumen: () => void;
  tema: TemaInterno;
  onAlternarTema: () => void;
}) {
  const etiquetaVista = etiquetaDeVista(vistaActual);
  const rolCompacto: Record<string, string> = {
    ADMIN: 'Admin',
    RECEPCIONISTA: 'Recepción',
    FUNCIONARIO: 'Func.',
    JEFE_DEPENDENCIA: 'Jefe',
    CONTROL_INTERNO: 'Control',
  };

  return (
    <header data-armazon="pantalla" className="xl:hidden w-full min-w-0 shrink-0 bg-[var(--tema-fondo-ffffff)] px-3 py-2.5" style={{ borderBottom: '1px solid var(--tema-borde-dce4ea)' }}>
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onAbrirMenu}
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2"
          style={{ border: '1px solid var(--tema-borde-dce4ea)', color: 'var(--tema-texto-007049)', background: 'var(--tema-fondo-f4f9f6)' }}
          aria-label="Abrir menú"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: 'var(--text-secondary)' }}>
            Alcaldía de Simacota
          </p>
          {/* h1 de la pantalla por debajo de 1280 px: el encabezado de escritorio
              (con su h1) está oculto ahí, así que siempre hay uno solo. */}
          <h1 className="truncate text-sm font-black leading-tight" style={{ color: 'var(--tema-texto-172033)' }}>
            {etiquetaVista}
          </h1>
        </div>
        <span className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider min-[360px]:inline"
              style={{ background: 'var(--tema-fondo-f4f9f6)', color: 'var(--tema-texto-007049)', borderColor: 'var(--tema-borde-dce4ea)' }}>
          {rolCompacto[usuario.rol] ?? 'Func.'}
        </span>
        <BotonTema tema={tema} onAlternar={onAlternarTema} />
        <button
          type="button"
          onClick={onAbrirResumen}
          /* Mismo botón que el encabezado de escritorio (el verde claro de antes
             quedaba en 1,1:1 en modo claro). */
          className={`shrink-0 ${CLASE_BOTON_ENCABEZADO}`}
          style={ESTILO_BOTON_ENCABEZADO}
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
      textoColor: '#172033',
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
      rielColor:  '#007049', // verde institucional
      textoColor: '#007049',
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
      rielColor:  '#D81E1E', // rojo vencido
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

const AYUDA_RESUMEN = 'Cada indicador es un filtro: la tabla inferior muestra únicamente los radicados del filtro activo.';

/** Tarjetas del Resumen y del Seguimiento: mismos valores, filtros y handlers de siempre. */
function construirIndicadoresTablero({
  metricas,
  filtroActivo,
  onFiltroChange,
  kpisOperativos,
  filtroOperativo,
  onFiltroOperativoChange,
  porVencerHoy,
}: {
  metricas:       MetricasMIPGData;
  filtroActivo:   FiltroMIPG;
  onFiltroChange: (f: FiltroMIPG) => void;
  kpisOperativos: ReturnType<typeof calcularKpisOperativos>;
  filtroOperativo: FiltroKpiOperativo;
  onFiltroOperativoChange: (f: FiltroKpiOperativo) => void;
  porVencerHoy: number;
}): { resumen: IndicadorInteractivoProps[]; seguimiento: IndicadorInteractivoProps[] } {
  const tarjetas: TarjetaMIPGItem[] = construirTarjetasMIPG(metricas);
  const porFiltro = new Map(tarjetas.map((t) => [t.filtro, t]));
  const principal = (filtro: FiltroMIPG) => porFiltro.get(filtro)!;
  const enTermino = principal('EN_TERMINO');

  const resumen: IndicadorInteractivoProps[] = ([
    ['VENCIDAS', 'Vencidos', 'Requieren atención', 'rojo', AlertTriangle],
    ['POR_VENCER', 'Por vencer', 'Próximos a vencer', 'ambar', Clock3],
    ['RADICADAS', 'Radicados', 'Pendientes de gestión', 'gris', FileText],
    ['ASIGNADAS', 'Asignados', 'En gestión', 'azul', UsersRound],
  ] as const).map(([filtro, etiqueta, descripcion, tono, Icono]) => ({
    etiqueta,
    valor: principal(filtro).valor,
    descripcion,
    tono,
    Icono,
    activo: filtroActivo === filtro,
    onClick: () => onFiltroChange(filtro),
  }));

  const seguimiento: IndicadorInteractivoProps[] = [
    { etiqueta: 'En término', valor: enTermino.valor, descripcion: 'Dentro del plazo', tono: 'verde', Icono: CheckCircle2, activo: filtroActivo === 'EN_TERMINO', onClick: () => onFiltroChange('EN_TERMINO') },
    { etiqueta: 'Sin asignar', valor: kpisOperativos.sinAsignar, descripcion: 'Pendientes de asignación', tono: 'ambar', Icono: UserRoundX, activo: filtroOperativo === 'SIN_ASIGNAR', onClick: () => onFiltroOperativoChange(filtroOperativo === 'SIN_ASIGNAR' ? 'NINGUNO' : 'SIN_ASIGNAR') },
    { etiqueta: 'Por vencer hoy', valor: porVencerHoy, descripcion: 'Vencen durante el día', tono: 'gris', Icono: Clock3, activo: filtroActivo === 'POR_VENCER_HOY', onClick: () => onFiltroChange(filtroActivo === 'POR_VENCER_HOY' ? 'TODOS' : 'POR_VENCER_HOY') },
    { etiqueta: 'Con errores', valor: kpisOperativos.correoFallido, descripcion: 'Notificaciones fallidas', tono: 'rojo', Icono: CircleX, activo: filtroActivo === 'CORREOS_FALLIDOS', onClick: () => onFiltroChange(filtroActivo === 'CORREOS_FALLIDOS' ? 'TODOS' : 'CORREOS_FALLIDOS') },
  ];

  return { resumen, seguimiento };
}

type IndicadoresTableroProps = Parameters<typeof construirIndicadoresTablero>[0];

/**
 * Filtros rápidos de la bandeja, en chips. SOLO filtros que ya existen, con
 * el mismo contador y handler que sus tarjetas: al pulsar un chip, el número
 * de filas coincide con el del chip (ADR-0044).
 */
function FiltrosRapidos({
  indicadores,
  filtroActivo,
  onFiltroChange,
  misAsignados,
  soloMios,
  onToggleSoloMios,
  soloDatosIncompletos = false,
  onToggleDatosIncompletos,
}: {
  indicadores: IndicadoresTableroProps;
  filtroActivo: FiltroMIPG;
  onFiltroChange: (f: FiltroMIPG) => void;
  misAsignados: number;
  soloMios: boolean;
  onToggleSoloMios: () => void;
  soloDatosIncompletos?: boolean;
  onToggleDatosIncompletos?: () => void;
}) {
  const { resumen, seguimiento } = construirIndicadoresTablero(indicadores);
  const [vencidos, porVencer, radicados, asignados] = resumen;
  const sinAsignar = seguimiento[1];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3 pt-2 sm:px-4 lg:px-6" role="group" aria-label="Filtros rápidos de la bandeja">
      <ChipFiltro etiqueta="Todos" activo={filtroActivo === 'TODOS'} onClick={() => onFiltroChange('TODOS')} />
      {[vencidos, porVencer, sinAsignar, radicados, asignados].map((ind) => (
        <ChipFiltro key={ind.etiqueta} etiqueta={ind.etiqueta} valor={ind.valor} tono={ind.tono} activo={ind.activo} onClick={ind.onClick} titulo={ind.descripcion} />
      ))}
      <span className="mx-1 hidden h-5 w-px sm:inline-block" style={{ background: 'var(--tema-borde-dce4ea)' }} aria-hidden="true" />
      {onToggleDatosIncompletos && (
        <ChipFiltro
          etiqueta={soloDatosIncompletos ? '✓ Datos incompletos' : 'Datos incompletos'}
          activo={soloDatosIncompletos}
          onClick={onToggleDatosIncompletos}
          titulo="Mostrar solo radicados con datos no aportados por el solicitante"
        />
      )}
      <ChipFiltro etiqueta="Solo los míos" valor={misAsignados} activo={soloMios} onClick={onToggleSoloMios} />
    </div>
  );
}

/**
 * Resumen visual de la bandeja (referencia visual oficial del propietario,
 * 23-sep-2026): las MISMAS cifras que los chips (misma fuente,
 * `construirIndicadoresTablero`), en tarjetas compactas de solo lectura.
 * Las tarjetas muestran el estado; los chips filtran.
 */
function ResumenTablero({ indicadores }: { indicadores: IndicadoresTableroProps }) {
  const { resumen, seguimiento } = construirIndicadoresTablero(indicadores);
  const [vencidos, porVencer, radicados, asignados] = resumen;
  const sinAsignar = seguimiento[1];
  return (
    <div className="px-3 pt-2 shrink-0 sm:px-4 lg:px-6">
      <FilaTarjetas etiqueta="Resumen de la bandeja">
        {[vencidos, porVencer, sinAsignar, radicados, asignados].map(({ etiqueta, valor, descripcion, tono, Icono }) => (
          <TarjetaIndicador key={etiqueta} etiqueta={etiqueta} valor={valor} descripcion={descripcion} tono={tono} Icono={Icono} />
        ))}
      </FilaTarjetas>
    </div>
  );
}

/** Selector de dependencia (ADMIN, CONTROL_INTERNO y RECEPCIONISTA). */
function SelectorDependencia({
  tenantFiltro,
  onTenantChange,
}: {
  tenantFiltro: TenantId | 'TODOS';
  onTenantChange: (t: TenantId | 'TODOS') => void;
}) {
  return (
    <select
      value={tenantFiltro}
      onChange={(e) => onTenantChange(e.target.value as TenantId | 'TODOS')}
      className="select-internal !w-auto shrink-0 text-xs"
      aria-label="Filtrar por dependencia"
    >
      <option value="TODOS">Todas las dependencias</option>
      {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((id) => (
        <option key={id} value={id}>{NOMBRES_TENANT[id]}</option>
      ))}
    </select>
  );
}

/**
 * Métricas de contexto bajo la tabla: Resumen de trámites y Seguimiento de
 * gestión, colapsables. Funcionalmente completos: al abrirse muestran las
 * mismas tarjetas, valores y filtros de siempre.
 */
function TarjetasMIPG({
  indicadores,
  filtroActivo,
  modoCompacto = false,
  onToggleCompacto,
  enPanelDetalle = false,
}: {
  indicadores: IndicadoresTableroProps;
  filtroActivo: FiltroMIPG;
  modoCompacto?: boolean;
  onToggleCompacto?: () => void;
  /** Al abrir el detalle, conserva las métricas legibles en una cuadrícula 2×2. */
  enPanelDetalle?: boolean;
}) {
  const { resumen, seguimiento } = construirIndicadoresTablero(indicadores);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [seguimientoAbierto, setSeguimientoAbierto] = useState(false);
  const clasesGridMetricas = enPanelDetalle
    ? 'grid-cols-2'
    : 'grid-cols-1 min-[440px]:grid-cols-2 xl:grid-cols-4';

  return (
    <section className="mx-3 mb-3 shrink-0 rounded-xl bg-[var(--tema-fondo-ffffff)] px-3 py-1.5 sm:mx-4 lg:mx-6" aria-label="Resumen operativo de trámites">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          {modoCompacto ? (
            <p className="px-1 py-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Resumen de trámites y Seguimiento de gestión minimizados.
            </p>
          ) : (
            <>
              <PanelIndicadoresColapsable
                id="resumen-tramites-indicadores"
                titulo="Resumen de trámites"
                subtitulo="Indicadores por categoría"
                ayuda={AYUDA_RESUMEN}
                accesorio={(
                  /* La vista actual es el filtro MIPG que gobierna la tabla. */
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--tema-fondo-f4f9f6)', color: 'var(--tema-texto-007049)' }}
                  >
                    Vista actual: <span className="font-black">{etiquetaFiltroMIPG(filtroActivo)}</span>
                  </span>
                )}
                indicadores={resumen}
                abierto={resumenAbierto}
                onAlternar={() => setResumenAbierto((v) => !v)}
                clasesGrid={clasesGridMetricas}
              />
              <PanelIndicadoresColapsable
                id="seguimiento-gestion-indicadores"
                titulo="Seguimiento de gestión"
                subtitulo="Detalle de la vista actual"
                indicadores={seguimiento}
                abierto={seguimientoAbierto}
                onAlternar={() => setSeguimientoAbierto((v) => !v)}
                clasesGrid={clasesGridMetricas}
              />
            </>
          )}
        </div>
        {onToggleCompacto && (
          <button
            type="button"
            onClick={onToggleCompacto}
            className="tablero-interactivo mt-0.5 shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-[var(--tema-fondo-f7f9fb)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
            style={{ color: 'var(--tema-texto-007049)' }}
            title={modoCompacto ? 'Mostrar Resumen de trámites y Seguimiento de gestión' : 'Minimizar paneles operativos y ampliar la lista de radicados'}
            aria-pressed={modoCompacto}
          >
            {modoCompacto ? 'Mostrar paneles' : 'Minimizar paneles'}
          </button>
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
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-2 py-2">
          <div className="h-3 rounded bg-slate-800/80" style={{ width: `${40 + (i % 3) * 25}%` }} />
        </td>
      ))}
    </tr>
  );
}

function EstadoVisualRadicado(radicado: VentanillaRadicado) {
  const semaforo = calcularSemaforo(radicado);
  if (semaforo.estado === 'VENCIDO') {
    return { etiqueta: 'Vencido', clase: BADGE_ESTADO.VENCIDO, semaforo };
  }
  return {
    etiqueta: LABELS_ESTADO[radicado.estadoActual] ?? radicado.estadoActual,
    clase: BADGE_ESTADO[radicado.estadoActual] ?? BADGE_ESTADO_NEUTRO,
    semaforo,
  };
}

function AccionesRadicado({
  radicado,
  onSeleccionar,
}: {
  radicado: VentanillaRadicado;
  onSeleccionar: (radicado: VentanillaRadicado) => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => onSeleccionar(radicado)}
        className="tablero-interactivo group inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-[var(--tema-fondo-f4f9f6)] hover:shadow-sm active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
        style={{ color: 'var(--tema-texto-007049)', borderColor: 'var(--tema-borde-b7d8c0)', background: 'var(--tema-fondo-ffffff)' }}
      >
        <Eye className="tablero-icono-movil transition-transform duration-150 group-hover:translate-x-px" size={15} strokeWidth={1.9} aria-hidden="true" />
        Ver
      </button>
      <details className="relative">
        <summary
          aria-label={`Más acciones para ${radicado.radicadoId}`}
          className="tablero-interactivo flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border text-sm font-black transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-[var(--tema-fondo-f7f9fb)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--tema-borde-dce4ea)', background: 'var(--tema-fondo-ffffff)' }}
        >
          <MoreVertical size={17} strokeWidth={1.9} aria-hidden="true" />
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-40 rounded-lg border p-1 shadow-lg" style={{ background: 'var(--tema-fondo-ffffff)', borderColor: 'var(--tema-borde-dce4ea)' }}>
          <button
            type="button"
            onClick={() => onSeleccionar(radicado)}
            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold transition-colors duration-150 hover:bg-[var(--tema-fondo-f4f9f6)]"
            style={{ color: 'var(--tema-texto-007049)' }}
          >
            Abrir detalle
          </button>
        </div>
      </details>
    </div>
  );
}

/**
 * Señal de que este radicado YA dio origen a un expediente de licencias
 * (handoff radicado⇄expediente, Bloque A·A4 / ADR-0026).
 *
 * POR QUÉ EXISTE: el mismo caso vive legítimamente en las DOS bandejas —la
 * ventanilla vigila el término de respuesta al ciudadano y Licencias el ciclo
 * jurídico (D.1077/2015)—, pero el tablero no mostraba ese vínculo por ningún
 * lado. La funcionaria veía un radicado «sin clasificar» sin forma de saber
 * que ya estaba siendo gestionado como expediente, ni por dónde llegar a él:
 * el dato existía en `vinculoExpediente` y no se usaba en toda la pantalla.
 *
 * Es SOLO presentación: no reevalúa nada, no decide nada y no altera el
 * handoff. Ausente el vínculo, no pinta nada (un radicado sin expediente es
 * el caso normal, no una anomalía que haya que señalar).
 */
function ChipExpedienteVinculado({ vinculo }: { vinculo: VentanillaRadicado['vinculoExpediente'] }) {
  if (!vinculo) return null;
  return (
    <Link
      href={urlLicencias({ expedienteId: vinculo.expedienteId })}
      /* La fila/tarjeta entera selecciona el radicado al hacer clic; este
         enlace navega a OTRA pantalla, así que detiene la propagación para
         que no ocurran las dos cosas a la vez. */
      onClick={(e) => e.stopPropagation()}
      className="mt-1 inline-flex max-w-full items-center gap-1 rounded px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2"
      style={{ background: 'var(--tema-fondo-f4f9f6)', color: 'var(--tema-texto-007049)', border: '1px solid var(--tema-borde-007049)' }}
      title={`Expediente de licencias vinculado: ${vinculo.numeroExpediente} — abrir`}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 10.5 12 4l8 6.5M6 9.5V19h12V9.5" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      <span className="break-all">{vinculo.numeroExpediente}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}

/** Columnas de la bandeja de radicados; ninguna se elimina (ADR-0044). */
const COLUMNAS_TABLA_RADICADOS = ['Radicado', 'Solicitante', 'Tipo de trámite', 'Dependencia', 'Estado', 'Vencimiento', 'Tiempo', 'Acciones'] as const;

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
  forzarTarjetas,
  desplazamientoExterno = false,
  selectorDependencia,
  entreBarraYTabla,
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
  /** Mantiene legibles los datos cuando el panel de detalle reduce el área central. */
  forzarTarjetas:         boolean;
  /** Con el detalle abierto, el scroll pertenece a toda la columna de bandeja. */
  desplazamientoExterno?: boolean;
  /** Selector de dependencia, dentro de la barra de trabajo. */
  selectorDependencia?: React.ReactNode;
  /** Filtros rápidos y alertas: entre la barra de trabajo y la tabla. */
  entreBarraYTabla?: React.ReactNode;
}) {
  return (
    /* Sin detalle abierto, la bandeja ocupa todo el alto restante y desplaza
       sus filas internamente (cabecera sticky). El mínimo evita que, en
       pantallas bajas, los indicadores superiores la dejen sin altura. */
    <div className={`${desplazamientoExterno ? 'shrink-0' : 'flex-1 min-h-[18rem] overflow-hidden'} flex flex-col`}>
      {/* Barra de trabajo: búsqueda, filtros, dependencia y nuevo radicado. */}
      <BarraTrabajo
        busqueda={busqueda}
        onBusquedaChange={onBusquedaChange}
        placeholder="Buscar por radicado, expediente, nombre, documento, asunto o dependencia…"
        contador={`${radicados.length} resultado${radicados.length !== 1 ? 's' : ''}`}
      >
        {onAbrirBusquedaAvanzada && (
          <button
            onClick={onAbrirBusquedaAvanzada}
            type="button"
            className="group shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-[var(--tema-fondo-f4f9f6)] hover:shadow-sm focus-visible:outline-none"
            style={{ background: 'var(--tema-fondo-ffffff)', color: 'var(--tema-texto-007049)', borderColor: 'var(--tema-borde-007049)' }}
            title="Búsqueda histórica y filtros avanzados"
          >
            <SlidersHorizontal className="tablero-icono-movil transition-transform duration-150 group-hover:rotate-[-8deg]" size={15} strokeWidth={1.9} aria-hidden="true" />
            Filtros
          </button>
        )}
        {selectorDependencia}
        {puedeRadicar && (
          <button
            onClick={onNuevoRadicado}
            className="micro-btn-primary shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-bold focus-visible:outline-none"
            style={{ background: 'var(--tema-fondo-007049)' }}
          >
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            Nuevo radicado
          </button>
        )}
      </BarraTrabajo>

      {entreBarraYTabla}

      {/* La tabla es el panel protagonista: ocupa el alto restante. */}
      <SuperficieTabla integrada={desplazamientoExterno}>

      {/* Error Firestore */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl text-xs shrink-0" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)' }}>
          <p className="font-semibold mb-1">Error de conexión</p>
          <p className="text-rose-500 oscuro:text-rose-300">{error}</p>
        </div>
      )}

      {/* Tarjetas — tablet y móvil. Evitan comprimir ocho columnas en anchos no disponibles. */}
      <div className={`${forzarTarjetas ? '' : 'xl:hidden'} ${desplazamientoExterno ? '' : 'flex-1 min-h-0 overflow-y-auto'} bg-[var(--tema-fondo-f7f9fb)] p-3 sm:p-4`} style={{ borderTop: '1px solid var(--tema-borde-f4f9f6)' }}>
        {cargando && !error && (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-2 rounded-xl bg-[var(--tema-fondo-ffffff)] px-4 py-3 animate-pulse space-y-2" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
              <div className="h-3 rounded w-2/3" style={{ background: 'var(--tema-fondo-f4f9f6)' }} />
              <div className="h-2.5 rounded w-1/2" style={{ background: 'var(--tema-fondo-f7f9fb)' }} />
            </div>
          ))
        )}
        {!cargando && !error && radicados.length === 0 && (
          <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] px-4 py-16 text-center" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
            <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sin radicados</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No hay resultados para los filtros aplicados.</p>
          </div>
        )}
        {!cargando && radicados.map((r) => {
          const seleccionado = radicadoSeleccionadoId === r.radicadoId;
          const estadoVisual = EstadoVisualRadicado(r);
          return (
            <article
              key={r.radicadoId}
              className="micro-row tablero-interactivo mb-2 min-w-0 rounded-xl bg-[var(--tema-fondo-ffffff)] p-3 text-left transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:shadow-sm"
              aria-current={seleccionado ? 'true' : undefined}
              style={{
                border: '1px solid var(--tema-borde-dce4ea)',
                borderLeft: seleccionado ? '4px solid var(--tema-borde-007049)' : '4px solid transparent',
                background: seleccionado ? 'var(--tema-fondo-f4f9f6)' : undefined,
              }}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all font-mono text-[13px] font-extrabold tracking-tight" style={{ color: 'var(--tema-texto-007049)' }}>{r.radicadoId}</p>
                  <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{fmtFecha(r.control.fechaRadicado)}</p>
                  <ChipExpedienteVinculado vinculo={r.vinculoExpediente} />
                </div>
                <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${estadoVisual.clase}`}>
                  {estadoVisual.etiqueta}
                </span>
              </div>
              <div className="mt-2 min-w-0">
                <p className="break-words text-sm font-bold" style={{ color: 'var(--tema-texto-172033)' }}>{nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}</p>
                <p className="mt-0.5 break-words text-xs" style={{ color: 'var(--text-secondary)' }}>{r.termino.tipoSolicitudNombre}</p>
                <p className="mt-0.5 break-words text-[11px]" style={{ color: 'var(--text-secondary)' }}>{NOMBRES_TENANT[r.clasificacion.oficinaDestino]}</p>
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t pt-2" style={{ borderColor: 'var(--tema-borde-f4f9f6)' }}>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Vencimiento</p>
                    <p className="break-words text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtFecha(r.termino.fechaVencimiento)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Tiempo</p>
                    <p className={`break-words text-xs font-bold ${estadoVisual.semaforo.textoClass}`}>{estadoVisual.semaforo.label}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <AccionesRadicado radicado={r} onSeleccionar={onSeleccionar} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Tabla — solo en escritorio amplio. Su ancho siempre es el del contenedor,
          no una medida mínima que pueda desbordar el cuerpo central. */}
      <div className={`${forzarTarjetas ? 'hidden' : 'hidden xl:block'} ${desplazamientoExterno ? '' : 'flex-1 min-h-0 overflow-y-auto'} bg-[var(--tema-fondo-ffffff)]`}>
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[17%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
          </colgroup>
          <CabeceraTablaSticky columnas={COLUMNAS_TABLA_RADICADOS} />
          <tbody>
            {cargando && !error && (
              Array.from({ length: 6 }).map((_, i) => <SkeletonFila key={i} />)
            )}

            {!cargando && !error && radicados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sin radicados</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No hay resultados para los filtros aplicados.</p>
                </td>
              </tr>
            )}

            {!cargando && radicados.map((r) => {
              const seleccionado = radicadoSeleccionadoId === r.radicadoId;
              const estadoVisual = EstadoVisualRadicado(r);
              const semaforoData = estadoVisual.semaforo;
              const diasColor = semaforoData.textoClass;
              // Rediseño 3B.2 — riel de color por estado del término,
              // siempre visible. La selección lo intensifica a verde.
              const rielEstado = semaforoData.estado === 'VENCIDO'
                ? '#D81E1E'
                : semaforoData.estado === 'POR_VENCER'
                  ? '#D97706'
                  : semaforoData.estado === 'RESUELTO'
                    ? 'var(--tema-borde-cbd5d1)'
                    : 'var(--tema-borde-007049)';

              return (
                <tr
                  key={r.radicadoId}
                  onClick={() => onSeleccionar(r)}
                  className={`micro-row cursor-pointer transition-colors duration-200 hover:bg-[var(--tema-fondo-f7f9fb)] ${seleccionado ? 'is-selected' : ''}`}
                  aria-selected={seleccionado}
                  style={{
                    borderBottom: '1px solid var(--tema-borde-f4f9f6)',
                    background: seleccionado ? 'var(--tema-fondo-f4f9f6)' : undefined,
                    borderLeft: seleccionado ? '4px solid var(--tema-borde-007049)' : `3px solid ${rielEstado}`,
                    boxShadow: seleccionado ? 'inset 0 0 0 1px rgba(0, 112, 73,0.08)' : undefined,
                  }}
                >
                  <td className="min-w-0 break-words px-2 py-2 align-top">
                    <div className="min-w-0">
                      <span className="break-all font-mono text-[12px] font-extrabold tracking-tight" style={{ color: 'var(--tema-texto-007049)' }}>{r.radicadoId}</span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{fmtFecha(r.control.fechaRadicado)}</p>
                    <ChipExpedienteVinculado vinculo={r.vinculoExpediente} />
                  </td>
                  <td className="min-w-0 break-words px-2 py-2 align-top">
                    <p className="break-words font-medium" style={{ color: 'var(--tema-texto-172033)' }}>{nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}</p>
                    <p className="break-all text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {documentoSolicitanteVisible(r, r.solicitante.tipoDocumento, r.solicitante.numeroDocumento)}
                    </p>
                    {/* Sprint Ventanilla Operativa 1 — chip de tipo de entrada / origen */}
                    <div className="mt-1 flex gap-1 flex-wrap">
                      <span
                        className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-semibold uppercase tracking-wide"
                        style={{ background: 'var(--tema-fondo-f4f9f6)', color: 'var(--tema-texto-007049)', border: '1px solid var(--tema-borde-dce4ea)' }}
                        title={`Origen: ${LABEL_ORIGEN_INGRESO[r.control.origenIngreso ?? SIN_CLASIFICAR]}`}
                      >
                        {LABEL_TIPO_ENTRADA[r.control.tipoEntrada ?? SIN_CLASIFICAR]}
                      </span>
                      {tieneDatosNoAportados(r.solicitante.datosNoAportados) && (
                        <span
                          className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-semibold uppercase tracking-wide"
                          style={{ background: 'var(--tema-fondo-fef3c7)', color: 'var(--tema-texto-92400e)', border: '1px solid var(--tema-borde-fbbf24)' }}
                          title="El solicitante no aportó todos sus datos"
                        >
                          Datos incompletos
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="min-w-0 break-words px-2 py-2 align-top">
                    <p className="break-words text-xs" style={{ color: 'var(--text-secondary)' }}>{r.termino.tipoSolicitudNombre}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{r.termino.diasRespuesta}d {r.termino.unidad.toLowerCase()}</p>
                  </td>
                  <td className="min-w-0 break-words px-2 py-2 align-top">
                    <p className="break-words text-xs" style={{ color: 'var(--text-secondary)' }}>{NOMBRES_TENANT[r.clasificacion.oficinaDestino]}</p>
                  </td>
                  <td className="min-w-0 break-words px-2 py-2 align-top">
                    <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${estadoVisual.clase}`}>
                      {estadoVisual.etiqueta}
                    </span>
                  </td>
                  <td className="min-w-0 break-words px-2 py-2 align-top">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtFecha(r.termino.fechaVencimiento)}</p>
                  </td>
                  <td className="min-w-0 break-words px-2 py-2 align-top">
                    <span className={`whitespace-nowrap text-sm font-semibold tabular-nums ${diasColor}`}>{semaforoData.label}</span>
                  </td>
                  <td className="min-w-0 px-2 py-2 align-top">
                    <AccionesRadicado radicado={r} onSeleccionar={onSeleccionar} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </SuperficieTabla>
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
const TABS_PANEL: { id: TabPanelId; label: string; Icono: LucideIcon }[] = [
  { id: 'info',         label: 'Información', Icono: FileText },
  { id: 'responder',    label: 'Responder',   Icono: MessageSquareText },
  { id: 'trazabilidad', label: 'Historia',    Icono: History },
  { id: 'traslado',     label: 'Traslado',    Icono: ArrowRight },
  { id: 'prorroga',     label: 'Prórroga',    Icono: CalendarClock },
  { id: 'copiloto',     label: 'SIMI',        Icono: Sparkles },
];

/* Sprint Panel claro — paleta e íconos de la Historia por tono. */
const TONO_HISTORIA: Record<TonoEvento, { bg: string; fg: string }> = {
  VERDE:  { bg: 'var(--tema-fondo-eaf3de)', fg: 'var(--tema-texto-3b6d11)' },
  AZUL:   { bg: 'var(--tema-fondo-e6f1fb)', fg: 'var(--tema-texto-185fa5)' },
  AMBAR:  { bg: 'var(--tema-fondo-faeeda)', fg: 'var(--tema-texto-854f0b)' },
  ROJO:   { bg: 'var(--tema-fondo-fcebeb)', fg: 'var(--tema-texto-a32d2d)' },
  GRIS:   { bg: 'var(--tema-fondo-eef2f5)', fg: 'var(--tema-texto-5f6f64)' },
  DORADO: { bg: 'var(--tema-fondo-f7efd8)', fg: 'var(--tema-texto-8a6a12)' },
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
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--tema-texto-172033)' }}>{value}</p>
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
    <li className="py-2 last:border-0" style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs truncate min-w-0" style={{ color: 'var(--tema-texto-172033)' }}>
          {archivo.nombre}
        </span>
        <div className="shrink-0 flex items-center gap-3">
          {archivo.path && (
            <a
              href={`/api/interno/archivo?path=${encodeURIComponent(archivo.path)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline underline-offset-2 font-semibold"
              style={{ color: 'var(--tema-texto-007049)' }}
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
              style={{ color: 'var(--tema-texto-006b45)' }}
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
                borderColor: estado === 'sellado' ? '#006B45' : 'var(--tema-borde-007049)',
                color:       estado === 'sellado' ? 'var(--tema-texto-006b45)' : 'var(--tema-texto-007049)',
                background:  estado === 'sellado' ? 'var(--tema-fondo-f0fdf4)' : 'var(--tema-fondo-ffffff)',
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
          style={{ color: 'var(--tema-texto-b91c1c)' }}
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
  // Responder es la acción principal de la bandeja; Información sigue accesible
  // como pestaña secundaria sin cambiar su contenido ni permisos.
  const [tab,              setTab]              = useState<TabPanelId>('responder');
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
  const contenidoPanelRef = useRef<HTMLDivElement>(null);

  const claveBorradorRespuesta = `ventanilla:respuesta-borrador:${radicado.radicadoId}`;

  /* El borrador es deliberadamente local a esta sesión: no altera el estado
     administrativo ni crea un nuevo contrato Firestore. La respuesta oficial
     solo se registra por el flujo existente de resolver. */
  useEffect(() => {
    try {
      const borradorGuardado = window.sessionStorage.getItem(claveBorradorRespuesta);
      setRespuesta(borradorGuardado ?? '');
    } catch {
      // El panel continúa funcionando si el navegador bloquea sessionStorage.
      setRespuesta('');
    }
    setArchivoPdf(null);
    setVistaPreviaActiva(false);
  }, [claveBorradorRespuesta]);

  // Cada caso y pestaña inicia desde su encabezado: evita que la respuesta
  // aparezca a media pantalla por el scroll retenido del contenido anterior.
  useEffect(() => {
    contenidoPanelRef.current?.scrollTo({ top: 0 });
  }, [radicado.radicadoId, tab]);

  function guardarBorradorRespuesta() {
    if (!respuesta.trim()) {
      setErrorLocal('Escribe una respuesta antes de guardar el borrador.');
      return;
    }
    try {
      window.sessionStorage.setItem(claveBorradorRespuesta, respuesta);
      setMensajeOk('Borrador guardado en este navegador. El oficio se adjunta al enviar la respuesta.');
      setErrorLocal(null);
    } catch {
      setErrorLocal('No fue posible guardar el borrador en este navegador.');
    }
  }

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
      /* Mapeo por la función CANÓNICA (issue #301): el inline anterior
         reconocía dos marcadores de cuatro y ANONIMA se le escapaba. */
      ciudadano: ciudadanoOficioDesdeRadicado(radicado),
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
      try { window.sessionStorage.removeItem(claveBorradorRespuesta); } catch { /* noop */ }
      // Fase B — el ciclo cierra aquí mismo: resolver y despachar.
      if (puedeDespachar) setOfrecerDespacho(true);
    } catch (error) {
      setErrorLocal(`Error al guardar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGuardando(false);
    }
  }

  const esRojo = radicado.prioridad === 'ROJO';
  const semaforo = calcularSemaforo(radicado);
  const terminoVencido = semaforo.estado === 'VENCIDO';

  return (
    <div className="h-full min-w-0 flex flex-col bg-[var(--tema-fondo-f7f9fb)]" style={{ borderLeft: '1px solid var(--tema-borde-dce4ea)' }}>
      {/* Encabezado del caso: identidad, estado y término en un solo vistazo. */}
      <div className={`shrink-0 bg-[var(--tema-fondo-ffffff)] px-4 py-3.5 sm:px-5 ${esRojo ? 'border-l-4 border-l-red-500' : ''}`}
           style={{ borderBottom: '1px solid var(--tema-borde-dce4ea)', boxShadow: '0 1px 2px rgba(15, 42, 28, 0.03)' }}>
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="tablero-interactivo mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-[var(--tema-fondo-ffffff)] text-[var(--tema-texto-007049)] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:bg-[var(--tema-fondo-f4f9f6)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
            style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
            aria-label="Regresar a la bandeja de trámites"
            title="Regresar a la bandeja"
          >
            <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>Radicado</p>
            <p className="mt-0.5 truncate font-mono text-sm font-black sm:text-base" style={{ color: 'var(--tema-texto-007049)' }}>{radicado.radicadoId}</p>
            <p className="truncate text-base font-black leading-tight sm:text-lg" style={{ color: 'var(--tema-texto-172033)' }}>{nombreSolicitanteVisible(radicado, radicado.solicitante.nombreCompleto)}</p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                BADGE_ESTADO[radicado.estadoActual] ?? BADGE_ESTADO_NEUTRO
              }`}>
                {LABELS_ESTADO[radicado.estadoActual] ?? radicado.estadoActual}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold" style={{ color: terminoVencido ? 'var(--tema-texto-d81e1e)' : semaforo.textoClass.includes('green') ? 'var(--tema-texto-006b45)' : 'var(--tema-texto-b45309)' }}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: terminoVencido ? '#FB7185' : semaforo.textoClass.includes('green') ? '#22C55E' : '#F59E0B' }} />
                <span className="truncate">{semaforo.label}</span>
              </span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {onToggleModo && (
              <button
                type="button"
                onClick={onToggleModo}
                className="tablero-interactivo hidden h-9 w-9 items-center justify-center rounded-xl border transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:shadow-sm md:inline-flex"
                style={{ color: modoAmplio ? 'var(--tema-texto-007049)' : 'var(--text-secondary)', background: modoAmplio ? 'var(--tema-fondo-f4f9f6)' : 'var(--tema-fondo-ffffff)', borderColor: 'var(--tema-borde-dce4ea)' }}
                title={modoAmplio ? 'Volver a panel normal' : 'Expandir panel para redacción larga'}
                aria-label={modoAmplio ? 'Volver a panel normal' : 'Expandir panel'}
                onMouseEnter={(e) => { if (!modoAmplio) { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-007049)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; } }}
                onMouseLeave={(e) => { if (!modoAmplio) { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
              >
                {modoAmplio
                  ? <PanelRightClose size={17} strokeWidth={1.9} aria-hidden="true" />
                  : <PanelRightOpen size={17} strokeWidth={1.9} aria-hidden="true" />}
              </button>
            )}
            <button onClick={onCerrar}
              className="tablero-interactivo inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-[var(--tema-fondo-ffffff)] text-[var(--text-secondary)] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:bg-[var(--tema-fondo-f4f9f6)] hover:text-[var(--tema-texto-172033)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
              aria-label="Cerrar detalle del trámite">
              <X size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Banner de notificación oficial fallida — visible solo si el radicado tiene el flag */}
      {radicado.alertaNotificacionFallida === true && (
        <div
          className="shrink-0 px-4 py-2.5"
          style={{ background: 'var(--tema-fondo-fef2f2)', borderBottom: '1px solid var(--tema-borde-fca5a5)' }}
        >
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#B91C1C" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--tema-texto-b91c1c)' }}>
                Correo fallido
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--tema-texto-7f1d1d)' }}>
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
                    style={{ borderColor: 'var(--tema-borde-fca5a5)', minHeight: 60 }}
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
                      style={{ background: 'transparent', color: 'var(--tema-texto-7f1d1d)', border: '1px solid var(--tema-borde-fca5a5)' }}
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

      {/* Tabs — se envuelven en pantallas estrechas para conservar cada acción visible. */}
      <div
        className="flex min-w-0 shrink-0 flex-wrap gap-1 bg-[var(--tema-fondo-ffffff)] px-2 py-1.5"
        style={{ borderBottom: '1px solid var(--tema-borde-dce4ea)' }}
        role="tablist"
      >
        {TABS_PANEL.map((t) => {
          const activo = tab === t.id;
          const Icono = t.Icono;
          const esAccionSecundaria = t.id === 'traslado' || t.id === 'prorroga' || t.id === 'copiloto';
          return (
            <button key={t.id}
              role="tab"
              aria-selected={activo}
              onClick={() => cambiarTab(t.id)}
              className={`tablero-interactivo inline-flex min-w-0 items-center gap-1.5 rounded-xl px-3 py-2 uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 transition-[transform,box-shadow,background-color,border-color] duration-150 hover:-translate-y-px hover:shadow-sm ${esAccionSecundaria ? 'text-[10px] font-semibold' : 'text-[11px] font-bold'}`}
              style={activo
                ? {
                    color: '#FFFFFF',
                    background: 'var(--tema-fondo-007049)',
                    border: '1px solid var(--tema-borde-007049)',
                    boxShadow: '0 1px 3px rgba(0, 112, 73,0.30)',
                  }
                : t.id === 'responder'
                ? {
                    // Panel claro — la acción principal salta a la vista.
                    color: 'var(--tema-texto-007049)',
                    background: 'var(--tema-fondo-eaf3de)',
                    border: '1px solid var(--tema-borde-97c459)',
                  }
                : esAccionSecundaria
                ? {
                    color: 'var(--text-secondary)',
                    background: 'var(--tema-fondo-ffffff)',
                    border: '1px solid var(--tema-borde-e2e8e3)',
                  }
                : {
                    color: 'var(--tema-texto-475569)',
                    background: 'var(--tema-fondo-f7f9fb)',
                    border: '1px solid var(--tema-borde-dce4ea)',
                  }}
              onMouseEnter={(e) => { if (!activo) { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-007049)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--tema-borde-007049)'; } }}
              onMouseLeave={(e) => {
                if (activo) return;
                const el = e.currentTarget as HTMLElement;
                if (t.id === 'responder') {
                  el.style.color = 'var(--tema-texto-007049)'; el.style.background = 'var(--tema-fondo-eaf3de)'; el.style.borderColor = 'var(--tema-borde-97c459)';
                } else if (esAccionSecundaria) {
                  el.style.color = 'var(--text-secondary)'; el.style.background = 'var(--tema-fondo-ffffff)'; el.style.borderColor = 'var(--tema-borde-e2e8e3)';
                } else {
                  el.style.color = 'var(--tema-texto-475569)'; el.style.background = 'var(--tema-fondo-f7f9fb)'; el.style.borderColor = 'var(--tema-borde-dce4ea)';
                }
              }}>
              <Icono size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback global */}
      {(mensajeOk || errorLocal) && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs shrink-0"
             style={mensajeOk
               ? { background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)', color: 'var(--tema-texto-006b45)' }
               : { background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)' }}>
          {mensajeOk ?? errorLocal}
          {/* Fase B — despacho al resolver: la respuesta que sale recibe
              su 2-SAL sin cambiar de pantalla. Solo roles que por reglas
              pueden crear salidas. */}
          {mensajeOk && ofrecerDespacho && (
            <button
              type="button"
              onClick={() => { setSalidaDetalleAbierta(true); setOfrecerDespacho(false); }}
              className="block mt-1.5 text-xs font-bold underline underline-offset-2"
              style={{ color: 'var(--tema-texto-007049)' }}
            >
              Registrar la salida 2-SAL de esta respuesta ahora
            </button>
          )}
        </div>
      )}

      {/* Contenido con scroll */}
      <div ref={contenidoPanelRef} className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4 sm:pb-24" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>

        {/* ── TAB 1: Información ── */}
        {tab === 'info' && (
          <>
            {/* Panel Op Fase 1 — resumen ejecutivo al inicio del tab info. */}
            <ResumenEjecutivoRadicado
              radicado={radicado}
              ultimoEvento={ultimoEvento}
            />

            {/* El bloque se pinta SOLO si el radicado está vinculado a un
                expediente de licencia; para todo lo demás no existe. Va aquí
                arriba a propósito: es lo que la funcionaria necesita cuando el
                ciudadano ya está parado frente a ella preguntando. */}
            <EstadoTramiteLicencia radicadoId={radicado.radicadoId} />

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
            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>
                  Constancia de radicación
                </p>
                <button
                  type="button"
                  onClick={() => setMostrarConstancia((v) => !v)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                  style={{ border: '1px solid var(--tema-borde-007049)', color: 'var(--tema-texto-007049)', background: 'var(--tema-fondo-ffffff)' }}
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
              <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-8a6a12)' }}>
                      Correspondencia de salida
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      El oficio que se despacha recibe su número 2-SAL y queda en la trazabilidad.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSalidaDetalleAbierta(true)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                    style={{ border: '1px solid var(--tema-borde-007049)', color: 'var(--tema-texto-007049)', background: 'var(--tema-fondo-ffffff)' }}
                  >
                    Registrar salida
                  </button>
                </div>
              </div>
            )}
            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>Solicitante</p>
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

            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>Detalle del caso</p>
              <div className="space-y-3">
                <FilaInfo label="Asunto"      value={radicado.detalle.asunto} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Descripción</p>
                  <p className="text-sm mt-0.5 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--tema-texto-172033)' }}>{radicado.detalle.descripcion}</p>
                </div>
                <FilaInfo label="Número de folios" value={String(radicado.detalle.numeroFolios)} />
                {radicado.detalle.anexosDescripcion && (
                  <FilaInfo label="Anexos" value={radicado.detalle.anexosDescripcion} />
                )}
              </div>
            </div>

            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>
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
            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>
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
            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>
                MIPG · Responsable funcional asignado
              </p>
              {radicado.clasificacion.funcionarioResponsableNombre ? (
                <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--tema-fondo-f4f9f6)', border: '1px solid var(--tema-borde-dce4ea)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: 'var(--tema-fondo-007049)' }}>
                      {radicado.clasificacion.funcionarioResponsableNombre.charAt(0).toUpperCase()}
                    </span>
                    <p className="text-sm font-semibold" style={{ color: 'var(--tema-texto-172033)' }}>
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
                <div className="rounded-lg p-3" style={{ background: 'var(--tema-fondo-f7f9fb)', border: '1px solid var(--tema-borde-dce4ea)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{radicado.clasificacion.funcionarioResponsableUid}</span>
                    <br />
                    <span style={{ color: 'var(--text-secondary)' }}>Radicado anterior — nombre no registrado. Ver trazabilidad para detalle.</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>Sin responsable asignado</p>
              )}
            </div>

            {radicado.archivos.length > 0 && (
              <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>
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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 oscuro:text-indigo-300">Análisis Asistido IA</span>
                  </div>
                  <span className="text-[10px] text-indigo-700 oscuro:text-indigo-300 font-semibold bg-indigo-50 oscuro:bg-indigo-500/15 px-2 py-0.5 rounded-md border border-indigo-200 oscuro:border-indigo-500/30">
                    Confianza: {(radicado.analisisIa.confianzaClasificacion * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="space-y-3 bg-[var(--tema-fondo-ffffff)] p-4 rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
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
                          className="inline-flex items-center rounded-md bg-indigo-50 oscuro:bg-indigo-500/15 px-2 py-0.5 text-[9px] font-medium text-indigo-700 oscuro:text-indigo-300 border border-indigo-200 oscuro:border-indigo-500/30"
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
                            ? 'bg-emerald-50 oscuro:bg-emerald-500/15 border-emerald-200 oscuro:border-emerald-500/30'
                            : radicado.feedbackIa.puntuacion === 'CORREGIDO'
                              ? 'bg-amber-50 oscuro:bg-amber-500/15 border-amber-200 oscuro:border-amber-500/30'
                              : 'bg-rose-50 oscuro:bg-rose-500/15 border-rose-200 oscuro:border-rose-500/30'
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
                          className="px-2.5 py-1 rounded-md bg-[var(--tema-fondo-ffffff)] hover:bg-emerald-50 oscuro:hover:bg-emerald-500/15 text-xs font-medium transition-colors cursor-pointer"
                          style={{ border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
                        >
                          👍 Sí
                        </button>
                        <button
                          onClick={() => enviarFeedbackIA('NEGATIVO')}
                          className="px-2.5 py-1 rounded-md bg-[var(--tema-fondo-ffffff)] hover:bg-rose-50 oscuro:hover:bg-rose-500/15 text-xs font-medium transition-colors cursor-pointer"
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
              <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>
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
                    style={{ color: 'var(--tema-texto-007049)' }}
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
            ? { caja: { background: 'var(--tema-fondo-faeeda)', border: '1px solid var(--tema-borde-fac775)' }, titulo: 'var(--tema-texto-854f0b)', texto: 'var(--tema-texto-633806)' }
            : { caja: { background: 'var(--tema-fondo-eaf3de)', border: '1px solid var(--tema-borde-c0dd97)' }, titulo: 'var(--tema-texto-27500a)', texto: 'var(--tema-texto-3b6d11)' };
          return (
          <div className="space-y-4">
            {/* ── El caso hoy: dónde está y quién lo tiene ── */}
            <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: 'var(--tema-fondo-ffffff)', border: '1px solid var(--tema-borde-dce4ea)' }}>
              <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--tema-fondo-eaf3de)' }} aria-hidden="true">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="#3B6D11" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>El caso está hoy en</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--tema-texto-172033)' }}>
                  {NOMBRES_TENANT[radicado.clasificacion.oficinaDestino]}
                  {radicado.clasificacion.funcionarioResponsableNombre
                    ? ` · responsable: ${radicado.clasificacion.funcionarioResponsableNombre}`
                    : ' · sin persona asignada'}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
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
              <div className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--tema-fondo-eaf3de)', border: '1px solid var(--tema-borde-c0dd97)' }}>
                <p className="text-xs" style={{ color: 'var(--tema-texto-3b6d11)' }}>
                  Este caso es de tu dependencia y no tiene persona asignada.
                </p>
                <button type="button" onClick={tomarCaso} disabled={guardando}
                  className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-60"
                  style={{ border: '1px solid var(--tema-borde-007049)', color: 'var(--tema-texto-007049)', background: 'var(--tema-fondo-ffffff)' }}>
                  Tomar este caso
                </button>
              </div>
            )}

            {/* ── Mover o asignar ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>Dependencia</p>
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
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Persona responsable <span className="normal-case font-normal" style={{ color: 'var(--text-secondary)' }}>(opcional)</span>
              </p>
              {cargandoFuncionarios ? (
                <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} />
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
                  className="input-internal text-slate-500 oscuro:text-slate-400"
                />
              )}
              {responsableSelec && (
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                  📧 {responsableSelec.email}
                </p>
              )}
            </div>

            {/* Fase 2 · Áreas — nivel 2 del modelo: propias del destino
                + transversales (Almacén y Archivo, Sistemas). */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Área <span className="normal-case font-normal" style={{ color: 'var(--text-secondary)' }}>(opcional)</span>
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
              style={{ background: resumen.puedeConfirmar ? 'var(--tema-fondo-007049)' : 'var(--tema-fondo-94a3b8)' }}
              onMouseEnter={(e) => { if (!guardando && !soloLectura && resumen.puedeConfirmar) (e.currentTarget as HTMLElement).style.background = '#006B45'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = resumen.puedeConfirmar ? 'var(--tema-fondo-007049)' : 'var(--tema-fondo-94a3b8)'; }}>
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
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} />
                Cargando la historia…
              </div>
            ) : trazabilidad.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>Este radicado aún no tiene historia registrada.</p>
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
                        ? { background: 'var(--tema-fondo-007049)', color: '#FFFFFF', border: '1px solid var(--tema-borde-007049)' }
                        : { background: 'var(--tema-fondo-ffffff)', color: 'var(--tema-texto-475569)', border: '1px solid var(--tema-borde-dce4ea)' }}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>

                {historia.length === 0 && (
                  <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>Nada que mostrar con este filtro.</p>
                )}

                {historia.map((dia) => (
                  <div key={dia.ymd}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {dia.etiqueta}
                    </p>
                    <div className="space-y-2">
                      {dia.eventos.map((e) => {
                        const tono = TONO_HISTORIA[e.tono];
                        return (
                          <div key={e.id} className="flex gap-2.5 rounded-xl bg-[var(--tema-fondo-ffffff)] px-3 py-2.5" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
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
                                <p className="text-[12.5px] font-semibold leading-snug" style={{ color: 'var(--tema-texto-172033)' }}>{e.titulo}</p>
                                <time className="shrink-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{e.hora}</time>
                              </div>
                              {e.actor && (
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Por {e.actor}</p>
                              )}
                              {e.detalle && (
                                <p className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--tema-texto-5f6f64)' }}>{e.detalle}</p>
                              )}
                              {e.correos.map((c, i) => (
                                <p key={i} className="text-[10.5px] mt-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
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
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-red-700 oscuro:text-red-300">Devolver al ciudadano</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>Motivo</p>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                  placeholder="Indica la razón de la devolución…" className="input-internal resize-none" />
              </div>
              <button type="button" onClick={devolver} disabled={guardando || soloLectura}
                title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : undefined}
                className="w-full py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-60 active:scale-[0.98]"
                style={{ border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)', background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-fee2e2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                Devolver
              </button>
            </div>

            {/* Prórroga */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--tema-fondo-fffbeb)', border: '1px solid var(--tema-borde-fde68a)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700 oscuro:text-amber-300">Aplicar prórroga legal</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>Motivo</p>
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Fundamento legal de la prórroga" className="input-internal" />
                </div>
                <div className="w-24">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>Días</p>
                  <input type="number" min={1} max={30} value={diasProrroga}
                    onChange={(e) => setDiasProrroga(Math.max(1, Number(e.target.value)))}
                    className="input-internal text-center" />
                </div>
              </div>
              <button type="button" onClick={aplicarProrroga} disabled={guardando || soloLectura}
                title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : undefined}
                className="w-full py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-60 active:scale-[0.98]"
                style={{ border: '1px solid var(--tema-borde-fde68a)', color: 'var(--tema-texto-b45309)', background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-fef3c7)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                Aplicar prórroga (+{diasProrroga} días)
              </button>
            </div>

            {guardando && (
              <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} />
                Guardando en Firestore…
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Responder — la acción del día a día, guiada en 3 pasos ── */}
        {tab === 'responder' && (
          <div className="space-y-4 pb-2">
            {/* Los tres pasos conservan el flujo actual y hacen visible el siguiente movimiento. */}
            {radicado.estadoActual !== 'RESUELTO' && (
              <ol className="flex min-w-0 items-center gap-2 px-1" aria-label="Proceso para responder el trámite">
                {([['1', 'Escribe'], ['2', 'Adjunta (opcional)'], ['3', 'Marca resuelto']] as const).map(([n, texto], i) => (
                  <li key={n} className="contents">
                    <div className="flex min-w-0 shrink items-center gap-1.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={i === 0
                          ? { background: 'var(--tema-fondo-007049)', color: '#FFFFFF' }
                          : { background: 'var(--tema-fondo-ffffff)', border: '1.5px solid var(--tema-borde-97c459)', color: 'var(--tema-texto-3b6d11)' }}
                      >
                        {n}
                      </span>
                      <span className="min-w-0 text-[11px] leading-tight sm:text-xs" style={{ color: i === 0 ? 'var(--tema-texto-172033)' : 'var(--tema-texto-5f6f64)', fontWeight: i === 0 ? 700 : 500 }}>
                        {texto}
                      </span>
                    </div>
                    {i < 2 && <span className="h-px min-w-2 flex-1 bg-[var(--tema-fondo-c9d8cd)]" aria-hidden="true" />}
                  </li>
                ))}
              </ol>
            )}

            <section className="rounded-2xl bg-[var(--tema-fondo-ffffff)] p-4 shadow-sm sm:p-5" style={{ border: '1px solid var(--tema-borde-a7f3d0)', boxShadow: '0 8px 24px rgba(0, 112, 73,0.05)' }}>
              {radicado.respuestaOficial && (
                <div className="rounded-lg p-3 space-y-1 bg-[var(--tema-fondo-ffffff)]" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                    {radicado.respuestaOficial.archivoPath ? 'Oficio de respuesta archivado' : 'Respuesta registrada (sin oficio adjunto)'}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--tema-texto-172033)' }}>{radicado.respuestaOficial.nota}</p>
                  {radicado.respuestaOficial.archivoPath && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{radicado.respuestaOficial.archivoNombre}</span>
                      <a href={`/api/interno/archivo?path=${encodeURIComponent(radicado.respuestaOficial.archivoPath)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-xs underline underline-offset-2 ml-3 font-semibold" style={{ color: 'var(--tema-texto-007049)' }}>
                        Descargar oficio
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: 'var(--tema-texto-475569)' }}>
                    1 · La respuesta que recibirá el ciudadano
                  </p>
                  {radicado.estadoActual !== 'RESUELTO' && !soloLectura && (
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={generarPlantillaOficio}
                        disabled={guardando}
                        title="Inserta una plantilla institucional tipo oficio que luego puedes editar."
                        className="tablero-interactivo inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:shadow-sm active:translate-y-0 disabled:opacity-50"
                        style={{ background: 'var(--tema-fondo-f7f9fb)', color: 'var(--tema-texto-007049)', borderColor: 'var(--tema-borde-dce4ea)' }}
                      >
                        <ClipboardPenLine size={14} strokeWidth={1.9} aria-hidden="true" />
                        Generar plantilla
                      </button>
                      <button
                        type="button"
                        onClick={() => setVistaPreviaActiva((v) => !v)}
                        disabled={guardando || respuesta.trim().length === 0}
                        className="tablero-interactivo inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:shadow-sm active:translate-y-0 disabled:opacity-40"
                        style={vistaPreviaActiva
                          ? { background: 'var(--tema-fondo-007049)', color: '#ffffff', border: '1px solid var(--tema-borde-007049)' }
                          : { background: 'transparent', color: 'var(--tema-texto-007049)', border: '1px solid var(--tema-borde-dce4ea)' }}
                      >
                        <Eye size={14} strokeWidth={1.9} aria-hidden="true" />
                        {vistaPreviaActiva ? 'Ocultar previa' : 'Vista previa'}
                      </button>
                    </div>
                  )}
                </div>
                <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)}
                  rows={modoAmplio ? (vistaPreviaActiva ? 9 : 6) : (vistaPreviaActiva ? 6 : 4)}
                  maxLength={5000}
                  placeholder="Describe la respuesta dada al ciudadano o usa “Generar plantilla” para un oficio institucional…"
                  className={`input-internal mt-1 ${modoAmplio ? 'resize-y' : 'resize-none'}`}
                  disabled={radicado.estadoActual === 'RESUELTO'}
                  style={{
                    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    minHeight: modoAmplio ? 180 : 150,
                    borderColor: 'var(--tema-borde-b7c9be)',
                  }}
                />
                <div className="mt-2 flex min-w-0 items-start justify-between gap-3 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  <p className="min-w-0 leading-relaxed">Este texto se enviará por correo al ciudadano y quedará visible en la consulta pública con formato institucional.</p>
                  <span className="shrink-0 tabular-nums" aria-label={`${respuesta.length} de 5000 caracteres`}>{respuesta.length} / 5000</span>
                </div>
              </div>

              {vistaPreviaActiva && respuesta.trim().length > 0 && (
                <div
                  className="rounded-xl p-5"
                  style={{ background: 'var(--tema-fondo-ffffff)', border: '1px solid var(--tema-borde-007049)' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2"
                     style={{ color: 'var(--tema-texto-007049)', borderBottom: '1px dashed var(--tema-borde-dce4ea)' }}>
                    Vista previa institucional · cómo lo verá el ciudadano
                  </p>
                  <pre
                    className="text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{
                      fontFamily: '"DM Sans", "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      color: 'var(--tema-texto-172033)',
                    }}
                  >{respuesta}</pre>
                </div>
              )}

              {radicado.estadoActual !== 'RESUELTO' && (
                <div className="mt-4 rounded-2xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-e2e8e3)' }}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: 'var(--tema-texto-475569)' }}>
                    2 · Oficio firmado <span className="normal-case font-normal" style={{ color: 'var(--text-secondary)' }}>(PDF, opcional)</span>
                  </p>
                  {archivoPdf ? (
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-3"
                         style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)' }}>
                      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-green-700 oscuro:text-green-300"><Paperclip size={16} strokeWidth={1.9} className="shrink-0" aria-hidden="true" /><span className="truncate">{archivoPdf.name}</span></span>
                      <button type="button" onClick={() => setArchivoPdf(null)}
                        className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold transition-colors" style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-d81e1e)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <label className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 transition-[background-color,border-color,box-shadow] duration-150 hover:bg-[var(--tema-fondo-f7f9fb)] hover:shadow-sm"
                           style={{ borderColor: 'var(--tema-borde-b7c9be)' }}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--tema-fondo-f4f9f6)] text-[var(--tema-texto-007049)] transition-transform duration-150 group-hover:-translate-y-px"><UploadCloud size={18} strokeWidth={1.9} aria-hidden="true" /></span>
                      <span className="min-w-0"><span className="block text-xs font-semibold" style={{ color: 'var(--tema-texto-334155)' }}>Adjuntar oficio firmado (PDF, máx. 10 MB)</span><span className="mt-0.5 block text-[10px]" style={{ color: 'var(--text-secondary)' }}>Haz clic para seleccionar el archivo</span></span>
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
                <div className="mt-4 rounded-2xl px-4 py-3.5" style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)' }}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tema-fondo-007049)] text-white"><Check size={20} strokeWidth={2.2} aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: 'var(--tema-texto-006b45)' }}>
                    3 · Al marcar como resuelto
                      </p>
                      <div className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--tema-texto-2f6b3a)' }}>
                        <p>El ciudadano recibe la respuesta por correo automáticamente (si dejó uno).</p>
                        <p>Queda registrado si respondiste dentro del término.</p>
                        <p>Podrás registrar la salida 2-SAL del oficio despachado.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {guardando && (
              <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} />
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

      {/* Barra de cierre fija: las acciones siguen disponibles mientras se revisa
          el oficio largo. Resolver conserva exactamente el flujo existente. */}
      {tab === 'responder' && (
        <footer className="shrink-0 border-t bg-[var(--tema-fondo-ffffff)] px-4 py-3 sm:px-5" style={{ borderColor: 'var(--tema-borde-dce4ea)', boxShadow: '0 -4px 16px rgba(15,42,28,0.05)' }}>
          <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={guardarBorradorRespuesta}
              disabled={guardando || radicado.estadoActual === 'RESUELTO' || soloLectura || respuesta.trim().length === 0}
              title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : 'Guarda este texto temporalmente en el navegador'}
              className="tablero-interactivo inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border bg-[var(--tema-fondo-ffffff)] px-4 text-xs font-bold text-[var(--tema-texto-334155)] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:bg-[var(--tema-fondo-f7f9fb)] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--tema-borde-dce4ea)' }}
            >
              <Save size={16} strokeWidth={1.9} aria-hidden="true" />
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={responderCaso}
              disabled={guardando || radicado.estadoActual === 'RESUELTO' || soloLectura}
              title={soloLectura ? 'Tu rol no permite realizar acciones sobre radicados.' : undefined}
              className="tablero-interactivo inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: '#116530' }}
            >
              <Send size={16} strokeWidth={1.9} aria-hidden="true" />
              {soloLectura ? 'Vista de solo lectura' : radicado.estadoActual === 'RESUELTO' ? 'Ya está resuelto' : 'Enviar respuesta y resolver'}
            </button>
          </div>
        </footer>
      )}

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
      // Camino ÚNICO por el servidor desde el cutover PT-1 (24-ago-2026):
      // POST /api/radicacion/interna. El kill-switch se retiró en el PR-C
      // — ver la cabecera de lib/recepcion/radicar-segun-flag.ts.
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
        className="relative w-full bg-[var(--tema-fondo-ffffff)] flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-modal-panel"
        style={{
          border: '1px solid var(--tema-borde-dce4ea)',
          maxWidth: 'min(1120px, calc(100% - 24px))',
          maxHeight: 'calc(100dvh - 24px)',
        }}
      >

        {/* Header fijo */}
        <header
          className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 shrink-0 bg-[var(--tema-fondo-ffffff)]"
          style={{ borderBottom: '1px solid var(--tema-borde-dce4ea)' }}
        >
          <div className="min-w-0">
            <h2 id="rad-rapida-title" className="text-base sm:text-lg font-black truncate" style={{ color: 'var(--tema-texto-172033)' }}>
              Radicación Rápida
            </h2>
            <p id="rad-rapida-subtitle" className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
              Nuevo radicado institucional · Ventanilla Única
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal de radicación rápida"
            className="shrink-0 p-2 rounded-xl active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tema-texto-172033)'; (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = ''; }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Cuerpo con scroll interno */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>

          {/* ── Estado de éxito ── */}
          {radicadoGenerado && datosComprobante && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="text-center">
                <div className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-3"
                     style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)' }}>
                  <svg className="w-7 h-7 text-green-600 oscuro:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--tema-texto-008f5a)' }}>Radicado registrado</p>
                <p className="text-2xl font-black font-mono" style={{ color: 'var(--tema-texto-007049)' }}>{radicadoGenerado}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Informe este número al ciudadano para seguimiento.</p>
              </div>

              {/* Sprint Recepción fluida — elegir entre la constancia
                  completa y el sello sobre la copia física del ciudadano. */}
              <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--tema-fondo-f4f9f6)' }} role="tablist" aria-label="Formato de impresión">
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
                      ? { background: 'var(--tema-fondo-007049)', color: '#FFFFFF' }
                      : { color: 'var(--tema-texto-007049)' }}
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
                style={{ border: '1px solid var(--tema-borde-dce4ea)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
              >Cerrar modal</button>
            </div>
          )}

          {/* ── Barra de progreso ── */}
          {!radicadoGenerado && progreso && (
            <div className="mb-5 p-4 rounded-xl bg-[var(--tema-fondo-ffffff)]" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{progreso}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--tema-texto-007049)' }}>{progresoPct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tema-fondo-f4f9f6)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progresoPct}%`, background: 'var(--tema-fondo-007049)' }} />
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {errorGuardado && (
            <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)' }}>
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
            className="shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-6 py-3 bg-[var(--tema-fondo-ffffff)]"
            style={{ borderTop: '1px solid var(--tema-borde-dce4ea)' }}
          >
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={{ background: 'var(--tema-fondo-ffffff)', color: 'var(--tema-texto-475569)', border: '1px solid var(--tema-borde-dce4ea)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-f4f9f6)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-ffffff)'; }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={FORM_ID}
              disabled={!!progreso && progresoPct > 0 && progresoPct < 100}
              className="rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={{ background: 'var(--tema-fondo-007049)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#006B45'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tema-fondo-007049)'; }}
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
   COMPONENTE INTERNO PRINCIPAL (dentro del Provider)
══════════════════════════════════════════════════════════════ */

type PanelDerechoModo = 'normal' | 'amplio';
/** Ola 3 — secciones de Administración en pantallas de menos de 1280 px. */
type SeccionAdministracion = 'USUARIOS' | 'GOBERNANZA';
const SECCIONES_ADMINISTRACION = [
  { id: 'USUARIOS' as const, etiqueta: 'Usuarios internos' },
  { id: 'GOBERNANZA' as const, etiqueta: 'Gobernanza SIMI' },
];

const PANEL_MODO_KEY = 'panelDerechoModo';
const SIDEBAR_FIJADO_KEY = 'sidebarFijado';

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
  const [sidebarFijado, setSidebarFijado] = useState(false);
  const [sidebarTemporalAbierto, setSidebarTemporalAbierto] = useState(false);
  const cierreSidebarRef = useRef<number | null>(null);
  const contenidoSidebarRef = useRef<HTMLDivElement>(null);
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

  /* EL AVISO DE «no se pudo abrir el radicado» SE DESCARTA SOLO.
     Visto en producción el 29-sep-2026: el mensaje se quedaba pegado y viajaba
     con la funcionaria de «Salidas» a «Ventanilla», tapando la cabecera de una
     pantalla con la que no tenía nada que ver. Solo se limpiaba cuando una
     apertura POSTERIOR salía bien — es decir, casi nunca.

     Dos salidas, porque el banner es `fixed` y oculta contenido mientras siga:
     1. al cambiar de vista — el error pertenecía a la pantalla anterior;
     2. a los 10 s — tiempo de sobra para leerlo; después solo estorba. */
  useEffect(() => {
    setErrorAbrirRadicado(null);
  }, [vistaActual]);

  useEffect(() => {
    if (!errorAbrirRadicado) return;
    const temporizador = setTimeout(() => setErrorAbrirRadicado(null), 10_000);
    return () => clearTimeout(temporizador);
  }, [errorAbrirRadicado]);

  const detalleRadicadoActivo = vistaActual === 'TABLERO'
    && panelDerechoAbierto
    && Boolean(radicadoSeleccionado);
  const sidebarVisible = !detalleRadicadoActivo || sidebarFijado || sidebarTemporalAbierto;

  useEffect(() => {
    try {
      setSidebarFijado(window.localStorage.getItem(SIDEBAR_FIJADO_KEY) === 'true');
    } catch {
      // La navegación sigue disponible aunque el navegador bloquee almacenamiento local.
    }
  }, []);

  useEffect(() => () => {
    if (cierreSidebarRef.current !== null) {
      window.clearTimeout(cierreSidebarRef.current);
    }
  }, []);

  useEffect(() => {
    if (detalleRadicadoActivo && !sidebarFijado) {
      setSidebarTemporalAbierto(false);
    }
  }, [detalleRadicadoActivo, sidebarFijado]);

  function cancelarCierreSidebar() {
    if (cierreSidebarRef.current !== null) {
      window.clearTimeout(cierreSidebarRef.current);
      cierreSidebarRef.current = null;
    }
  }

  function abrirSidebarTemporal() {
    cancelarCierreSidebar();
    if (detalleRadicadoActivo && !sidebarFijado) {
      setSidebarTemporalAbierto(true);
    }
  }

  function cerrarSidebarTemporalConRetardo() {
    if (!detalleRadicadoActivo || sidebarFijado) return;
    cancelarCierreSidebar();
    cierreSidebarRef.current = window.setTimeout(() => {
      const focoPermaneceEnSidebar = contenidoSidebarRef.current?.contains(document.activeElement);
      if (!focoPermaneceEnSidebar) {
        setSidebarTemporalAbierto(false);
      }
      cierreSidebarRef.current = null;
    }, 300);
  }

  function cerrarSidebarCuandoPierdeElFoco() {
    window.setTimeout(() => {
      const focoPermaneceEnSidebar = contenidoSidebarRef.current?.contains(document.activeElement);
      if (!focoPermaneceEnSidebar) {
        cerrarSidebarTemporalConRetardo();
      }
    }, 0);
  }

  function alternarSidebarTemporal() {
    if (!detalleRadicadoActivo) return;
    cancelarCierreSidebar();
    setSidebarTemporalAbierto((abierto) => !abierto);
  }

  function alternarSidebarFijado() {
    setSidebarFijado((fijado) => {
      const siguiente = !fijado;
      try {
        window.localStorage.setItem(SIDEBAR_FIJADO_KEY, String(siguiente));
      } catch {
        // La preferencia es opcional; el control permanece funcional durante la sesión.
      }
      if (siguiente) {
        cancelarCierreSidebar();
        setSidebarTemporalAbierto(true);
      }
      return siguiente;
    });
  }

  function cerrarSidebarConPestana() {
    cancelarCierreSidebar();
    if (sidebarFijado) {
      setSidebarFijado(false);
      try {
        window.localStorage.setItem(SIDEBAR_FIJADO_KEY, 'false');
      } catch {
        // Sin persistencia, solo cambia el estado actual.
      }
    }
    setSidebarTemporalAbierto(false);
  }

  /* Contexto único de interfaz (ADR-0046): qué ve y qué puede hacer este
     usuario según rol + dependencia. Misma lógica de siempre, en un lugar. */
  const contexto = useMemo(() => construirContextoInterno(usuario), [usuario]);
  const [seccionAdministracion, setSeccionAdministracion] = useState<SeccionAdministracion>('USUARIOS');
  const esAdmin = contexto.permisos.verIndicadoresGlobales;
  // Panel Op Nivel 1 — flag separado de esAdmin: gatea SOLO el selector
  // de dependencia. RECEPCIONISTA ve todos los tenants pero no hereda
  // los paneles administrativos (gobernanza SIMI, semáforo PQRSD).
  const veTodosTenants = contexto.permisos.filtrarPorDependencia;
  const tienePermisoRadicar = contexto.permisos.radicar;
  const tienePermisoBandeja = contexto.permisos.usarBandejaAsignacion;
  const [busquedaAvanzadaAbierta, setBusquedaAvanzadaAbierta] = useState(false);
  // Sprint Radicación de salida — modal (null = cerrado; entrada = amarre).
  const [salidaModal, setSalidaModal] = useState<{ entrada: EntradaAmarre | null } | null>(null);
  // Sprint Planilla de reparto — panel de entrega de documentos físicos.
  const [repartoAbierto, setRepartoAbierto] = useState(false);
  // Fase B — el libro completo lo leen los mismos roles de la vista
  // Salidas; el hook sin recorte por tenant solo se activa para ellos.
  const puedeVerLibroSalidas = contexto.permisos.verLibroSalidas;
  const salidasLibro = useSalidas(
    vistaActual === 'SALIDAS'
    || (vistaActual === 'REPORTES' && puedeVerLibroSalidas),
  );
  // Sprint Registro exprés — modal para roles operativos.
  const [registroExpresAbierto, setRegistroExpresAbierto] = useState(false);
  const puedeRegistroExpres = contexto.permisos.registroExpres;
  const puedeRegistrarSalida = contexto.permisos.registrarSalida;
  const {
    modo: indicadoresModo,
    toggle: toggleIndicadoresModo,
  } = useIndicadoresModo();
  const { tema, alternarTema } = useTemaInterno();
  const fechaDeHoy = useMemo(() => {
    const texto = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, []);
  const indicadoresCompactos = indicadoresModo === 'compacto';
  /** Roles de solo lectura: pueden ver pero no ejecutar acciones sobre radicados. */
  const esVistaReadOnly = contexto.permisos.soloLectura;

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
      // Esta rama cubre DOS casos que no se pueden distinguir sin filtrar
      // información: el radicado está fuera de la ventana viva del tablero
      // (VENTANA_DIAS_STREAM = 180 días) o está fuera del alcance del
      // usuario (otra dependencia). Decir «está fuera de la ventana»
      // insinuaría que existe a quien no puede verlo — por eso el mensaje
      // enuncia AMBAS causas sin confirmar cuál, y ofrece la salida útil.
      // (Antes decía solo «No fue posible abrir el radicado», seguro pero
      // sin salida: quien abre un expediente de licencia años después desde
      // el enlace a su radicado de origen quedaba sin saber qué hacer.)
      setErrorAbrirRadicado(
        'No fue posible abrir el radicado. Puede estar fuera de los últimos 180 días ' +
        'o fuera de su dependencia — búsquelo en «Búsqueda avanzada».',
      );
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

  /* ── Licencias por dirección (ADR-0046 §7, armazón único) ──
     `?vista=licencias[&expediente=…|&seccion=libro]` abre Licencias y su
     pantalla: enlace directo, recarga y atrás/adelante funcionan. */
  const destinoLicencias = leerDestinoLicencias(searchParams);
  const licenciasEnUrl = destinoLicencias.activa;
  const puedeVerLicencias = contexto.permisos.verLicencias;
  const vistaActualRef = useRef(vistaActual);
  useEffect(() => { vistaActualRef.current = vistaActual; }, [vistaActual]);

  /** La dirección actual sin los parámetros de Licencias. */
  const direccionSinLicencias = useCallback(() => {
    const parametros = new URLSearchParams(searchParams.toString());
    for (const p of PARAMETROS_LICENCIAS) parametros.delete(p);
    const query = parametros.toString();
    return query ? `/interno/dashboard?${query}` : '/interno/dashboard';
  }, [searchParams]);

  // Dirección → vista. Sin permiso, la dirección no abre Licencias ni un
  // instante (no se montan ni piden sus datos): se limpia. Si la dirección
  // deja Licencias (botón atrás) y la vista sigue ahí, se vuelve al Tablero.
  useEffect(() => {
    if (licenciasEnUrl) {
      if (puedeVerLicencias) dispatch({ type: 'SET_VISTA', vista: 'LICENCIAS' });
      else router.replace(direccionSinLicencias(), { scroll: false });
    } else if (vistaActualRef.current === 'LICENCIAS') {
      dispatch({ type: 'SET_VISTA', vista: 'TABLERO' });
    }
  }, [dispatch, licenciasEnUrl, puedeVerLicencias, router, direccionSinLicencias]);

  // Vista → dirección, solo cuando la vista CAMBIA (entrar desde el menú o
  // salir hacia otra vista); `replace` para no llenar el historial.
  const vistaAnteriorRef = useRef(vistaActual);
  useEffect(() => {
    const anterior = vistaAnteriorRef.current;
    vistaAnteriorRef.current = vistaActual;
    if (anterior === vistaActual) return;
    if (vistaActual === 'LICENCIAS' && !licenciasEnUrl) {
      router.replace(urlLicencias(), { scroll: false });
    } else if (anterior === 'LICENCIAS' && licenciasEnUrl) {
      router.replace(direccionSinLicencias(), { scroll: false });
    }
  }, [vistaActual, licenciasEnUrl, router, direccionSinLicencias]);

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
  // Sprint 1.5 — toggle secundario "Datos incompletos" en la bandeja.
  // Estado local del componente (no va al store global porque es un
  // filtro efímero que no debe persistir entre sesiones).
  const [soloDatosIncompletos, setSoloDatosIncompletos] = useState(false);

  // Panel Op Fase 2 — KPIs operativos y filtro operativo secundario.
  // Ambos son efímeros: no persisten entre sesiones. Solo un filtro
  // operativo activo a la vez, combinable con el filtro MIPG.
  const kpisOperativos = useMemo(() => calcularKpisOperativos(todosLosRadicados), [todosLosRadicados]);
  const porVencerHoy = useMemo(
    () => todosLosRadicados.filter((radicado) => estaActivo(radicado) && calcDiasRestantes(radicado) === 0).length,
    [todosLosRadicados],
  );
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

  /* Hub de Ventanilla (decisión del propietario, 23-sep-2026). Cada cifra
     sale del MISMO filtro que el Tablero aplica al llegar, sobre los mismos
     datos (ya acotados por dependencia), así que la tarjeta y las filas
     coinciden. «Por asignar» es la Bandeja de asignación. */
  const resumenOperacionVentanilla = useMemo(() => {
    const activosTablero = aplicarFiltroMIPG(todosLosRadicados, 'TODOS', '');
    return {
      porAsignar: radicadosPendientes.length,
      datosIncompletos: filtrarSoloDatosIncompletos(activosTablero).length,
      conErrores: aplicarFiltroMIPG(todosLosRadicados, 'CORREOS_FALLIDOS', '').length,
      porVencer: aplicarFiltroMIPG(todosLosRadicados, 'POR_VENCER', '').length,
    };
  }, [todosLosRadicados, radicadosPendientes]);

  /** Lleva al Tablero con SOLO el filtro existente de ese estado. */
  function verEnTableroDesdeVentanilla(destino: DestinoTableroVentanilla) {
    dispatch({ type: 'SET_BUSQUEDA', busqueda: '' });
    setFiltroOperativo('NINGUNO');
    setSoloMios(false);
    setSoloDatosIncompletos(destino === 'DATOS_INCOMPLETOS');
    dispatch({ type: 'SET_FILTRO_MIPG', filtro: destino === 'DATOS_INCOMPLETOS' ? 'TODOS' : destino });
    dispatch({ type: 'SET_VISTA', vista: 'TABLERO' });
  }

  function verCorreosFallidos() {
    dispatch({ type: 'SET_VISTA', vista: 'TABLERO' });
    dispatch({ type: 'SET_FILTRO_MIPG', filtro: 'CORREOS_FALLIDOS' });
    dispatch({ type: 'SET_BUSQUEDA', busqueda: '' });
    setMenuMovilAbierto(false);
  }

  /* Mismos valores, filtros y handlers que alimentan chips y paneles. */
  const indicadoresTablero: IndicadoresTableroProps = {
    metricas,
    filtroActivo: filtroMIPG,
    onFiltroChange: (f) => dispatch({ type: 'SET_FILTRO_MIPG', filtro: f }),
    kpisOperativos,
    filtroOperativo,
    onFiltroOperativoChange: setFiltroOperativo,
    porVencerHoy,
  };

  /* Entre la barra de trabajo y la tabla: filtros rápidos, filtros activos
     y la alerta de prioridad (solo si existe). */
  const bandaFiltrosYAlerta = (
    <>
      <FiltrosRapidos
        indicadores={indicadoresTablero}
        filtroActivo={filtroMIPG}
        onFiltroChange={(f) => dispatch({ type: 'SET_FILTRO_MIPG', filtro: f })}
        misAsignados={misActivos}
        soloMios={soloMios}
        onToggleSoloMios={() => setSoloMios((v) => !v)}
        soloDatosIncompletos={soloDatosIncompletos}
        onToggleDatosIncompletos={() => setSoloDatosIncompletos((v) => !v)}
      />
      {/* Panel Op Nivel 3A — barra de filtros activos (solo si hay). */}
      <BarraFiltrosActivos
        estado={estadoFiltros}
        onQuitarDimension={quitarDimensionFiltro}
        onLimpiarTodo={limpiarTodosLosFiltros}
      />

      {/* Resumen en tarjetas. «Minimizar paneles» y el detalle abierto lo
          ocultan: la prioridad es el espacio de la tabla. */}
      {!indicadoresCompactos && !panelDerechoAbierto && (
        <ResumenTablero indicadores={indicadoresTablero} />
      )}

      {/* Banner de prioridad — reemplaza la bandeja operativa +
          siguiente atención sugerida. Versión compacta que muestra
          solo lo crítico: el caso más urgente que necesita acción. */}
      {(() => {
        const resumen = calcularResumenBandeja(todosLosRadicados);
        const siguiente = resumen.siguiente;
        const dias = siguiente ? calcDiasRestantes(siguiente) : null;
        const requiereAtencion = Boolean(
          siguiente && (dias !== null && dias <= 2
            || siguiente.prioridad === 'ROJO'
            || !siguiente.clasificacion.funcionarioResponsableUid),
        );
        if (!requiereAtencion) return null;
        const nivelBanner = dias !== null && dias < 0
          ? 'critico'
          : dias !== null && dias <= 2
            ? 'alerta'
            : 'normal';
        const descripcionBanner = dias !== null && dias < 0
          ? `Trámite vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
          : dias !== null && dias === 0
            ? 'Trámite vence hoy'
            : dias !== null && dias <= 2
              ? `Trámite vence en ${dias} día${dias !== 1 ? 's' : ''}`
              : siguiente
                ? 'Trámite requiere atención'
                : '';
        return (
          <div className="px-3 pt-2 shrink-0 sm:px-4 lg:px-6">
            <PriorityBanner
              nivel={nivelBanner}
              mensaje="Atención requerida"
              descripcion={descripcionBanner}
              accion={siguiente ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SELECCIONAR_RADICADO', radicado: siguiente })}
                  className="tablero-interactivo group shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-95"
                  style={{ background: '#E5A31A', color: '#3D2C00' }}
                >
                  Atender
                  <ArrowRight className="tablero-icono-movil transition-transform duration-150 group-hover:translate-x-0.5" size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              ) : undefined}
            />
          </div>
        );
      })()}
    </>
  );

  return (
    <div className="relative flex h-[100dvh] overflow-hidden overflow-x-visible" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      {/* ── COLUMNA 1: Sidebar de navegación ── */}
      <div
        id="navegacion-principal"
        data-armazon="pantalla"
        className={`relative z-50 hidden h-full shrink-0 transition-[width] duration-200 ease-out xl:block ${
          detalleRadicadoActivo ? (sidebarVisible ? 'w-[224px]' : 'w-0') : 'w-[224px]'
        }`}
      >
        <div
          ref={contenidoSidebarRef}
          className={`absolute inset-y-0 left-0 w-[224px] transition-transform duration-200 ease-out ${
            sidebarVisible ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!sidebarVisible || undefined}
          inert={!sidebarVisible}
          onMouseEnter={abrirSidebarTemporal}
          onMouseLeave={cerrarSidebarTemporalConRetardo}
          onFocusCapture={abrirSidebarTemporal}
          onBlurCapture={cerrarSidebarCuandoPierdeElFoco}
        >
          <SidebarNav
            className="flex"
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
            menuFijado={sidebarFijado}
            onToggleMenuFijado={alternarSidebarFijado}
            mostrarControlMenu={detalleRadicadoActivo}
          />
        </div>

        {detalleRadicadoActivo && (
          <button
            type="button"
            onMouseEnter={abrirSidebarTemporal}
            onFocus={abrirSidebarTemporal}
            onClick={sidebarVisible ? cerrarSidebarConPestana : alternarSidebarTemporal}
            aria-controls="navegacion-principal"
            aria-expanded={sidebarVisible}
            aria-label={sidebarVisible ? 'Ocultar menú de navegación' : 'Abrir menú de navegación'}
            title={sidebarVisible ? 'Ocultar menú' : 'Abrir menú'}
            className={`absolute top-1/2 z-[60] hidden h-16 w-7 -translate-y-1/2 items-center justify-center border shadow-md transition-all duration-200 ease-out hover:w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 xl:inline-flex ${
              sidebarVisible
                ? 'left-full rounded-r-xl border-l-0 bg-[var(--tema-fondo-ffffff)] text-[var(--tema-texto-007049)]'
                : 'left-0 rounded-r-xl border-[var(--tema-borde-b9d1bf)] bg-[var(--tema-fondo-f4f9f6)] text-[var(--tema-texto-007049)]'
            }`}
          >
            <PanelLeftOpen className={`h-4 w-4 transition-transform duration-200 ${sidebarVisible ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── COLUMNA 2: Cuerpo central ──
            Sprint UI Bandeja: añadimos `min-h-0` para que los hijos con
            `flex-1` puedan ceder altura al scroll interno sin crecer
            indefinidamente y romper el layout. */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-x-visible bg-[var(--tema-fondo-f7f9fb)] ${panelDerechoAbierto ? 'overflow-y-scroll' : vistaActual === 'TABLERO' ? 'overflow-y-auto' : 'overflow-hidden'}`}
        style={panelDerechoAbierto ? { scrollbarGutter: 'stable' } : undefined}
      >
        <MobileTopBar
          usuario={usuario}
          vistaActual={vistaActual}
          onAbrirMenu={() => setMenuMovilAbierto(true)}
          onAbrirResumen={reabrirResumen}
          tema={tema}
          onAlternarTema={alternarTema}
        />

        {/* Encabezado común de escritorio. En el Tablero la dependencia es
            siempre la del alcance ya autorizado por el store. */}
        <EncabezadoPantalla
          antetitulo={vistaActual === 'TABLERO' ? 'Sala de operaciones' : 'Ventanilla Única Digital'}
          titulo={vistaActual === 'TABLERO'
            ? `Bandeja de trámites · ${veTodosTenants
              ? (tenantFiltro === 'TODOS' ? 'Vista municipal' : (NOMBRES_TENANT[tenantFiltro] ?? 'Vista municipal'))
              : NOMBRES_TENANT[usuario.tenantId]}`
            : etiquetaDeVista(vistaActual)}
          complemento={vistaActual === 'TABLERO' ? (
            /* Sprint tablero-jerarquia — mismo total y mismo filtro de
               reinicio de siempre, como chip discreto junto al título. */
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_FILTRO_MIPG', filtro: 'TODOS' })}
              aria-pressed={filtroMIPG === 'TODOS'}
              aria-label={`Ver todos los radicados activos del panorama MIPG (${totalKpisMipg})`}
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
              style={filtroMIPG === 'TODOS'
                ? { background: 'var(--tema-fondo-f4f9f6)', color: 'var(--tema-texto-007049)', border: '1px solid var(--tema-borde-007049)' }
                : { background: 'var(--tema-fondo-f7f9fb)', color: 'var(--tema-texto-007049)', border: '1px solid var(--tema-borde-dce4ea)' }}
            >
              <span className="tabular-nums">{totalKpisMipg}</span> activos
            </button>
          ) : undefined}
          fecha={fechaDeHoy}
          onBuscar={() => setBusquedaAvanzadaAbierta(true)}
          onResumen={reabrirResumen}
          botonTema={<BotonTema tema={tema} onAlternar={alternarTema} />}
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
            /* Mismo alcance y mismo stream que el contador del menú. */
            alcanceMunicipal={veTodosTenants}
            tenantIdUsuario={usuario.tenantId}
            dependenciaFiltrada={veTodosTenants && tenantFiltro !== 'TODOS' ? tenantFiltro : undefined}
            onVerRadicado={(r) => abrirRadicadoPorId(r.radicadoId)}
          />
        ) : vistaActual === 'REPORTES' ? (
          <VistaReportes
            total={todosLosRadicados.length}
            radicados={todosLosRadicados}
            salidas={puedeVerLibroSalidas ? salidasLibro.salidas : null}
            /* Ola 3: con alcance de dependencia no hay selector que no aplique. */
            dependenciaFija={contexto.permisos.filtrarPorDependencia ? undefined : usuario.tenantId}
          />
        ) : vistaActual === 'SALIDAS' ? (
          /* Sprint Radicación de salida — libro de correspondencia despachada. */
          <VistaSalidas
            salidas={salidasLibro.salidas}
            cargando={salidasLibro.cargando}
            error={salidasLibro.error}
            onAbrirEntrada={(id) => abrirRadicadoPorId(id)}
            /* Ola 3 (ADR-0046): sin permiso no hay botón (antes se veía y no hacía nada). */
            onNuevaSalida={puedeRegistrarSalida ? () => setSalidaModal({ entrada: null }) : undefined}
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
          /* Ola 3: fondo del Tablero (antes un velo oscuro del tema antiguo). */
          <div className="flex-1 overflow-y-auto pb-6" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
            <VistaSupervisionIA />
          </div>
        ) : vistaActual === 'ANTICIPACION_OPERATIVA' ? (
          <div className="flex-1 overflow-y-auto pb-6" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
            <VistaAnticipacionOperativa radicados={todosLosRadicados} />
          </div>
        ) : vistaActual === 'LICENCIAS' && puedeVerLicencias ? (
          /* Licencias en el armazón único (ADR-0046 §7): la pantalla
             (bandeja, libro consecutivo o detalle) sale de la dirección, y
             navegar escribe en ella — enlaces directos, recarga y
             atrás/adelante funcionan. */
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
            <VistaLicencias
              expedienteId={destinoLicencias.expedienteId}
              seccion={destinoLicencias.seccion}
              onNavegar={(destino) => router.push(urlLicencias(destino), { scroll: false })}
            />
          </div>
        ) : vistaActual === 'CONTROL_INTERNO' ? (
          /* Ola 3: gutters y superficies del Tablero (el encabezado de sección trae su margen). */
          <div className="flex-1 overflow-y-auto pb-6 space-y-3" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
            <CentroControlInterno />
            <details className="mx-3 rounded-xl bg-[var(--tema-fondo-ffffff)] p-3 sm:mx-4 lg:mx-6">
              <summary className="cursor-pointer text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>
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
          /* Ola 3 (ADR-0046): desde 1280 px, usuarios y gobernanza SIMI lado a
             lado (como antes). Por debajo la gobernanza quedaba inalcanzable
             (`hidden xl:flex`); ahora se elige con pestañas. */
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {esAdmin && (
              <div className="xl:hidden shrink-0 px-3 pt-2 sm:px-4 lg:px-6">
                <Pestanas
                  idBase="administracion"
                  etiquetaGrupo="Secciones de Administración"
                  pestanas={SECCIONES_ADMINISTRACION}
                  activa={seccionAdministracion}
                  onCambiar={setSeccionAdministracion}
                />
              </div>
            )}
            <PanelPestana idBase="administracion" activa={seccionAdministracion} className="flex-1 flex overflow-hidden min-h-0">
              <div className={`min-w-0 flex-1 overflow-hidden min-h-0 ${seccionAdministracion === 'GOBERNANZA' ? 'hidden xl:block' : ''}`}><VistaAdministracion /></div>
              {esAdmin && (
                <div className={`${seccionAdministracion === 'GOBERNANZA' ? 'flex' : 'hidden'} xl:flex flex-col w-full xl:w-[420px] shrink-0 xl:border-l`} style={{ borderColor: 'var(--tema-borde-dce4ea)' }}>
                  <SimiGobernanzaPanel usuario={usuario} />
                </div>
              )}
            </PanelPestana>
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
            /* Hub: estado de la operación y accesos, cada uno con su permiso. */
            resumenOperacion={resumenOperacionVentanilla}
            onAbrirBandeja={tienePermisoBandeja ? () => cambiarVista('BANDEJA') : undefined}
            onVerEnTablero={verEnTableroDesdeVentanilla}
            onAbrirSalidas={puedeVerLibroSalidas ? () => cambiarVista('SALIDAS') : undefined}
          />
        ) : (
          <>
            {/* Dashboard PQRSD compacto — vencimientos y riesgo.
                En modo "compacto" se oculta para dar más altura al listado. */}
            {esAdmin && (
              <section className="mx-3 mt-2 rounded-xl bg-[var(--tema-fondo-ffffff)] px-3 py-2 shrink-0 sm:mx-4 lg:mx-6" aria-label="Semáforo PQRSD: indicadores globales">
                <div className="mb-1.5 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>
                      Semáforo PQRSD
                    </h2>
                    {/* Métricas globales: no dependen de los filtros de la
                        tabla (solo del alcance de dependencia autorizado). */}
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      {tenantFiltro === 'TODOS'
                        ? 'Estado general de todos los radicados del sistema'
                        : `Estado general de todos los radicados de ${NOMBRES_TENANT[tenantFiltro] ?? 'la dependencia'}`}
                    </p>
                  </div>
                  <span className="inline-flex cursor-help" style={{ color: 'var(--text-secondary)' }} title="Indicadores globales: no cambian con los filtros de la tabla.">
                    <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    <span className="sr-only">Indicadores globales: no cambian con los filtros de la tabla.</span>
                  </span>
                </div>
                <PqrsdDeadlineDashboard
                  radicados={todosLosRadicados}
                  filtroTenant={tenantFiltro}
                  compact={true}
                />
              </section>
            )}


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
              forzarTarjetas={panelDerechoAbierto}
              desplazamientoExterno={panelDerechoAbierto}
              selectorDependencia={veTodosTenants ? (
                <SelectorDependencia
                  tenantFiltro={tenantFiltro}
                  onTenantChange={(t) => dispatch({ type: 'SET_TENANT_FILTRO', tenant: t })}
                />
              ) : undefined}
              entreBarraYTabla={bandaFiltrosYAlerta}
            />

            {/* Métricas de contexto bajo la tabla: Resumen de trámites y
                Seguimiento de gestión, colapsables y completos. */}
            <TarjetasMIPG
              indicadores={indicadoresTablero}
              filtroActivo={filtroMIPG}
              modoCompacto={indicadoresCompactos}
              onToggleCompacto={toggleIndicadoresModo}
              enPanelDetalle={panelDerechoAbierto}
            />
          </>
        )}
      </div>

      {errorAbrirRadicado && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg"
          style={{ background: 'var(--tema-fondo-fef2f2)', borderColor: 'var(--tema-borde-fecaca)', color: 'var(--tema-texto-991b1b)' }}
        >
          <span className="min-w-0 flex-1">{errorAbrirRadicado}</span>
          {/* Cerrar a mano: el aviso tapa la cabecera, y esperar los 10 s no
              siempre es razonable cuando ya se leyó. */}
          <button
            type="button"
            onClick={() => setErrorAbrirRadicado(null)}
            aria-label="Cerrar aviso"
            className="-mr-1 -mt-0.5 shrink-0 rounded p-1 leading-none transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2"
            style={{ color: 'var(--tema-texto-991b1b)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* ── COLUMNA 3: Panel derecho — oculto en vistas de pantalla completa ── */}
      {vistaActual !== 'BANDEJA' && vistaActual !== 'DEPENDENCIAS'
       && vistaActual !== 'ANALYTICS' && vistaActual !== 'ALERTAS'
       && vistaActual !== 'SUPERVISION_IA' && vistaActual !== 'ANTICIPACION_OPERATIVA'
       && vistaActual !== 'APROBACIONES'
       && vistaActual !== 'CONTROL_INTERNO' && vistaActual !== 'LICENCIAS' && (
        <div
          className={`fixed inset-y-0 right-0 z-40 max-w-full transition-transform duration-300 ease-in-out xl:relative xl:z-auto xl:shrink-0 xl:overflow-hidden xl:transition-all ${
            panelDerechoAbierto
              ? panelDerechoModo === 'amplio'
                ? 'w-full translate-x-0 xl:w-[720px]'
                : 'w-full translate-x-0 xl:w-[420px]'
              : 'w-full translate-x-full xl:w-0 xl:translate-x-0'
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
        <div className="fixed inset-0 z-50 xl:hidden">
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
