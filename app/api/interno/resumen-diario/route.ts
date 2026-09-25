import { NextResponse } from 'next/server';
import type { Query } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { requireActiveInternalUser, InternalAuthError, type InternalUserSession } from '@/lib/server/internal-auth';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { nowColombia, TIMEZONE_COLOMBIA } from '@/lib/fecha-colombia';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { PlanMejora, HallazgoControlInterno } from '@/src/types/control-interno';

export const runtime = 'nodejs';

const VERSION_RESUMEN = '1.0';
const ESTADOS_ACTIVOS = ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'DEVUELTO', 'PRORROGA', 'POR_VENCER', 'VENCIDO'];
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma:          'no-cache',
  Expires:         '0',
};

type TipoPrioridadResumen =
  | 'VENCIDO'
  | 'VENCE_HOY'
  | 'PROXIMO_VENCER'
  | 'SIN_ASIGNAR'
  | 'CORREO_FALLIDO'
  | 'DEVUELTO'
  | 'PLAN_VENCIDO'
  | 'PLAN_POR_VENCER'
  | 'HALLAZGO_PENDIENTE';

interface PrioridadResumen {
  tipo: TipoPrioridadResumen;
  radicadoId: string;
  numeroRadicado: string;
  diasVencido?: number;
  diasRestantes?: number;
  ruta: string;
}

interface TotalesResumen {
  vencidos: number;
  vencenHoy: number;
  proximosVencer: number;
  sinAsignar: number;
  correosFallidos: number;
  devoluciones: number;
  hallazgosPendientes: number;
  planesVencidos: number;
  planesPorVencer: number;
}

function jsonSeguro(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function fechaColombia(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: TIMEZONE_COLOMBIA });
}

function fechaLargaColombia(date: Date): string {
  const formatted = new Intl.DateTimeFormat('es-CO', {
    timeZone: TIMEZONE_COLOMBIA,
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function puedeVerRadicado(usuario: InternalUserSession, r: VentanillaRadicado): boolean {
  if (usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA' || usuario.rol === 'CONTROL_INTERNO') return true;
  if (usuario.rol === 'JEFE_DEPENDENCIA') return r.clasificacion.oficinaDestino === usuario.tenantId;
  if (usuario.rol === 'FUNCIONARIO') {
    return r.clasificacion.oficinaDestino === usuario.tenantId
      || r.clasificacion.funcionarioResponsableUid === usuario.uid;
  }
  return false;
}

function esActivo(r: VentanillaRadicado): boolean {
  return r.estadoActual !== 'RESUELTO' && r.estadoActual !== 'RECHAZADO';
}

function pushPrioridad(
  prioridades: PrioridadResumen[],
  prioridad: PrioridadResumen,
) {
  prioridades.push(prioridad);
}

function rutaFiltro(filtro: string): string {
  return `/interno/dashboard?filtro=${encodeURIComponent(filtro)}`;
}

function calcularResumenRadicados(usuario: InternalUserSession, radicados: VentanillaRadicado[], ahora: Date) {
  const totales: TotalesResumen = {
    vencidos: 0,
    vencenHoy: 0,
    proximosVencer: 0,
    sinAsignar: 0,
    correosFallidos: 0,
    devoluciones: 0,
    hallazgosPendientes: 0,
    planesVencidos: 0,
    planesPorVencer: 0,
  };
  const prioridades: PrioridadResumen[] = [];

  for (const r of radicados) {
    if (!esActivo(r) || !puedeVerRadicado(usuario, r)) continue;

    const dias = diasRestantesHabiles(r.termino.fechaVencimiento, ahora);
    const id = r.radicadoId;

    if (dias < 0) {
      totales.vencidos++;
      pushPrioridad(prioridades, {
        tipo: 'VENCIDO',
        radicadoId: id,
        numeroRadicado: id,
        diasVencido: Math.abs(dias),
        ruta: rutaFiltro('VENCIDAS'),
      });
    } else if (dias === 0) {
      totales.vencenHoy++;
      pushPrioridad(prioridades, {
        tipo: 'VENCE_HOY',
        radicadoId: id,
        numeroRadicado: id,
        diasRestantes: 0,
        ruta: rutaFiltro('POR_VENCER'),
      });
    } else if (dias <= 2) {
      totales.proximosVencer++;
      pushPrioridad(prioridades, {
        tipo: 'PROXIMO_VENCER',
        radicadoId: id,
        numeroRadicado: id,
        diasRestantes: dias,
        ruta: rutaFiltro('POR_VENCER'),
      });
    }

    const sinResponsable = !r.clasificacion.funcionarioResponsableUid;
    if (
      sinResponsable
      && (usuario.rol === 'ADMIN' || usuario.rol === 'RECEPCIONISTA' || usuario.rol === 'JEFE_DEPENDENCIA')
    ) {
      totales.sinAsignar++;
      pushPrioridad(prioridades, {
        tipo: 'SIN_ASIGNAR',
        radicadoId: id,
        numeroRadicado: id,
        ruta: rutaFiltro('RADICADAS'),
      });
    }

    if (
      r.alertaNotificacionFallida === true
      && (usuario.rol === 'ADMIN'
        || usuario.rol === 'RECEPCIONISTA'
        || r.clasificacion.funcionarioResponsableUid === usuario.uid
        || r.clasificacion.oficinaDestino === usuario.tenantId)
    ) {
      totales.correosFallidos++;
      pushPrioridad(prioridades, {
        tipo: 'CORREO_FALLIDO',
        radicadoId: id,
        numeroRadicado: id,
        ruta: rutaFiltro('TODOS'),
      });
    }

    if (r.estadoActual === 'DEVUELTO' && usuario.rol !== 'CONTROL_INTERNO') {
      totales.devoluciones++;
      pushPrioridad(prioridades, {
        tipo: 'DEVUELTO',
        radicadoId: id,
        numeroRadicado: id,
        ruta: rutaFiltro('DEVUELTAS_PRORROGA'),
      });
    }
  }

  return { totales, prioridades };
}

function ordenarPrioridades(prioridades: PrioridadResumen[]): PrioridadResumen[] {
  const orden: Record<TipoPrioridadResumen, number> = {
    VENCIDO: 1,
    PLAN_VENCIDO: 1,
    VENCE_HOY: 2,
    PROXIMO_VENCER: 3,
    PLAN_POR_VENCER: 3,
    SIN_ASIGNAR: 4,
    CORREO_FALLIDO: 5,
    DEVUELTO: 6,
    HALLAZGO_PENDIENTE: 7,
  };

  return [...prioridades].sort((a, b) => {
    const severidad = orden[a.tipo] - orden[b.tipo];
    if (severidad !== 0) return severidad;
    return a.radicadoId.localeCompare(b.radicadoId);
  });
}

async function cargarRadicados(usuario: InternalUserSession): Promise<VentanillaRadicado[]> {
  const db = getFirebaseAdminDb();
  let query = db
    .collection('ventanilla_radicados')
    .where('estadoActual', 'in', ESTADOS_ACTIVOS)
    .limit(250) as Query;

  if (usuario.rol === 'FUNCIONARIO' || usuario.rol === 'JEFE_DEPENDENCIA') {
    query = query.where('clasificacion.oficinaDestino', '==', usuario.tenantId);
  }

  const snap = await query.get();
  // Sprint Preoperación B: el resumen diario excluye datos de prueba.
  return snap.docs
    .map((doc) => ({
      ...(doc.data() as VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean }),
      radicadoId: (doc.data() as Partial<VentanillaRadicado>).radicadoId ?? doc.id,
    }))
    .filter((r) => !r.isTest && !r.excludeFromMetrics);
}

async function cargarControlInterno(ahora: Date) {
  const db = getFirebaseAdminDb();
  const [hallazgosSnap, planesSnap] = await Promise.all([
    db.collection('control_interno_hallazgos').where('estado', '!=', 'CERRADO').limit(50).get(),
    db.collection('control_interno_planes_mejora').where('estado', 'in', ['PENDIENTE', 'EN_EJECUCION', 'VENCIDO']).limit(50).get(),
  ]);

  const totales = { hallazgosPendientes: 0, planesVencidos: 0, planesPorVencer: 0 };
  const prioridades: PrioridadResumen[] = [];

  for (const doc of hallazgosSnap.docs) {
    const h = { id: doc.id, ...doc.data() } as HallazgoControlInterno & { id: string };
    if (h.estado === 'CERRADO') continue;
    totales.hallazgosPendientes++;
    pushPrioridad(prioridades, {
      tipo: 'HALLAZGO_PENDIENTE',
      radicadoId: h.id,
      numeroRadicado: h.id,
      ruta: '/interno/dashboard?vista=CONTROL_INTERNO',
    });
  }

  for (const doc of planesSnap.docs) {
    const p = { id: doc.id, ...doc.data() } as PlanMejora & { id: string };
    const fecha = new Date(`${p.fechaCompromiso}T12:00:00-05:00`);
    const dias = Math.ceil((fecha.getTime() - ahora.getTime()) / 86_400_000);

    if (p.estado === 'VENCIDO' || dias < 0) {
      totales.planesVencidos++;
      pushPrioridad(prioridades, {
        tipo: 'PLAN_VENCIDO',
        radicadoId: p.id,
        numeroRadicado: p.id,
        diasVencido: Math.abs(dias),
        ruta: '/interno/dashboard?vista=CONTROL_INTERNO',
      });
    } else if (dias <= 5) {
      totales.planesPorVencer++;
      pushPrioridad(prioridades, {
        tipo: 'PLAN_POR_VENCER',
        radicadoId: p.id,
        numeroRadicado: p.id,
        diasRestantes: Math.max(0, dias),
        ruta: '/interno/dashboard?vista=CONTROL_INTERNO',
      });
    }
  }

  return { totales, prioridades };
}

function sumarTotales(totales: TotalesResumen): number {
  return Object.values(totales).reduce((sum, value) => sum + value, 0);
}

export async function GET(): Promise<NextResponse> {
  let session: InternalUserSession;
  try {
    session = await requireActiveInternalUser();
  } catch (err) {
    if (err instanceof InternalAuthError) {
      return jsonSeguro(
        { error: err.status === 401 ? 'Debe iniciar sesión nuevamente.' : 'No tiene permiso para realizar esta acción.' },
        err.status,
      );
    }
    return jsonSeguro({ error: 'Debe iniciar sesión nuevamente.' }, 401);
  }

  try {
    const db = getFirebaseAdminDb();
    const ahora = nowColombia();
    const fecha = fechaColombia(ahora);
    const vistoId = `${session.uid}_${fecha}`;
    const vistoDoc = await db.collection('notificaciones_resumen_diario').doc(vistoId).get();

    const radicados = await cargarRadicados(session);
    const resumenRadicados = calcularResumenRadicados(session, radicados, ahora);
    const totales = resumenRadicados.totales;
    const prioridades = [...resumenRadicados.prioridades];

    if (session.rol === 'CONTROL_INTERNO') {
      const ci = await cargarControlInterno(ahora);
      totales.hallazgosPendientes = ci.totales.hallazgosPendientes;
      totales.planesVencidos = ci.totales.planesVencidos;
      totales.planesPorVencer = ci.totales.planesPorVencer;
      prioridades.push(...ci.prioridades);
    }

    const cantidadAlertas = sumarTotales(totales);

    return jsonSeguro({
      mostrar: !vistoDoc.exists && cantidadAlertas > 0,
      fecha,
      fechaColombiaLarga: fechaLargaColombia(ahora),
      saludo: 'Buenos días',
      totales,
      prioridades: ordenarPrioridades(prioridades).slice(0, 5),
      versionResumen: VERSION_RESUMEN,
    });
  } catch {
    return jsonSeguro({ error: 'No fue posible cargar el resumen diario.' }, 500);
  }
}
