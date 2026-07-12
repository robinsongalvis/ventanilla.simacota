/* ══════════════════════════════════════════════════════════════
   lib/busqueda/filtros-radicado.ts

   Lógica pura de filtrado, ordenamiento y paginación de radicados
   históricos para la Búsqueda Histórica Avanzada (Sprint 2).

   Diseñada para ser testeable sin Firestore: recibe el dataset ya
   filtrado por rol y aplica los predicados de cada filtro. El
   endpoint server-side `/api/radicados/busqueda-avanzada` orquesta
   la carga desde Firestore + permisos por rol + sanitización antes
   de delegar aquí.
══════════════════════════════════════════════════════════════ */

import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { getTipoSolicitudById } from '@/lib/catalogos/tipos-solicitud';

/* ──────────────────────────────────────────────
   Modelo de filtros
────────────────────────────────────────────── */

export interface FiltrosBusqueda {
  /** Texto rápido — busca en radicado, nombre, documento, correo, asunto, dependencia, responsable, tipo. */
  q?: string;
  radicadoId?: string;
  nombre?: string;
  documento?: string;
  correo?: string;
  asunto?: string;
  tipoSolicitudId?: string;
  categoria?: 'PQRSD' | 'TRAMITE' | 'INTERNO' | 'ESPECIAL';
  dependencia?: TenantId;
  responsable?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  mes?: number; // 1..12
  anio?: number;
  canalRespuesta?: string;
  anonimo?: boolean;
  reservado?: boolean;
  cumplioTermino?: boolean | null;
  conNotificacionFallida?: boolean;
  conRespuestaOficial?: boolean;
  /** Sprint Ventanilla Operativa 1 — filtros operativos de radicación. */
  origenIngreso?: string;
  tipoEntrada?: string;
  tipoPersona?: string;
}

export interface Paginacion {
  page: number;       // 1-based
  pageSize: 25 | 50 | 100;
}

export interface ResultadoBusqueda<T = VentanillaRadicado> {
  items: T[];
  total: number;
  page: number;
  pageSize: 25 | 50 | 100;
  totalPaginas: number;
}

/* ──────────────────────────────────────────────
   Helpers internos
────────────────────────────────────────────── */

function norm(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function fechaAMs(value: unknown): number {
  if (typeof value !== 'string' && !(value instanceof Date)) return 0;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function ocultarIdentidad(r: VentanillaRadicado): boolean {
  return r.esAnonimo === true
    || r.tipoPresentacion === 'ANONIMA'
    || r.tipoPresentacion === 'RESERVADA'
    || r.identidadReservada === true;
}

/**
 * Sprint 1.5 — True si el solicitante marcó al menos una casilla de
 * "no aporta" (documento, correo, teléfono o dirección). Radicados
 * históricos sin `datosNoAportados` retornan false.
 */
export function tieneDatosNoAportados(
  d?: { documento?: boolean; correo?: boolean; telefono?: boolean; direccion?: boolean } | null,
): boolean {
  if (!d) return false;
  return Boolean(d.documento || d.correo || d.telefono || d.direccion);
}

/**
 * Sprint 1.5 — filtro puro para el toggle "Datos incompletos" de la
 * bandeja. Devuelve solo los radicados donde el solicitante dejó al
 * menos una casilla de datos no aportados en true. Los radicados
 * históricos sin `datosNoAportados` quedan excluidos.
 */
export function filtrarSoloDatosIncompletos(
  lista: VentanillaRadicado[],
): VentanillaRadicado[] {
  return lista.filter((r) => tieneDatosNoAportados(r.solicitante.datosNoAportados));
}

/* ──────────────────────────────────────────────
   Filtro de visibilidad por rol

   Reglas Sprint 2:
   - ADMIN, CONTROL_INTERNO, RECEPCIONISTA: todo.
   - FUNCIONARIO, JEFE_DEPENDENCIA: solo su dependencia.
────────────────────────────────────────────── */

export type RolBusqueda =
  | 'ADMIN'
  | 'CONTROL_INTERNO'
  | 'RECEPCIONISTA'
  | 'FUNCIONARIO'
  | 'JEFE_DEPENDENCIA';

export interface AlcanceRol {
  rol: RolBusqueda;
  tenantId: TenantId;
}

export function aplicarAlcanceRol(
  radicados: VentanillaRadicado[],
  alcance: AlcanceRol,
): VentanillaRadicado[] {
  switch (alcance.rol) {
    case 'ADMIN':
    case 'CONTROL_INTERNO':
    case 'RECEPCIONISTA':
      return radicados;
    case 'FUNCIONARIO':
    case 'JEFE_DEPENDENCIA':
      return radicados.filter(
        (r) => r.clasificacion?.oficinaDestino === alcance.tenantId,
      );
  }
}

/* ──────────────────────────────────────────────
   Aplicar filtros uno por uno
────────────────────────────────────────────── */

function matchTextoLibre(r: VentanillaRadicado, qNorm: string): boolean {
  if (!qNorm) return true;
  const oculto = ocultarIdentidad(r);
  const tipo = getTipoSolicitudById(r.termino?.tipoSolicitudId);
  const campos = [
    r.radicadoId,
    r.detalle?.asunto,
    tipo?.nombre ?? r.termino?.tipoSolicitudNombre,
    r.clasificacion?.oficinaDestino,
    r.clasificacion?.funcionarioResponsableNombre,
    !oculto && r.solicitante?.nombreCompleto,
    !oculto && r.solicitante?.numeroDocumento,
    !oculto && r.solicitante?.email,
  ];
  for (const c of campos) {
    if (!c) continue;
    if (norm(c).includes(qNorm)) return true;
  }
  return false;
}

function pasaFiltros(r: VentanillaRadicado, filtros: FiltrosBusqueda): boolean {
  if (filtros.radicadoId) {
    if (norm(r.radicadoId) !== norm(filtros.radicadoId)
      && !norm(r.radicadoId).includes(norm(filtros.radicadoId))) {
      return false;
    }
  }
  if (filtros.nombre) {
    if (ocultarIdentidad(r)) return false;
    if (!norm(r.solicitante?.nombreCompleto).includes(norm(filtros.nombre))) return false;
  }
  if (filtros.documento) {
    if (ocultarIdentidad(r)) return false;
    if (!norm(r.solicitante?.numeroDocumento).includes(norm(filtros.documento))) return false;
  }
  if (filtros.correo) {
    if (ocultarIdentidad(r)) return false;
    if (!norm(r.solicitante?.email).includes(norm(filtros.correo))) return false;
  }
  if (filtros.asunto) {
    if (!norm(r.detalle?.asunto).includes(norm(filtros.asunto))) return false;
  }
  if (filtros.tipoSolicitudId) {
    if (r.termino?.tipoSolicitudId !== filtros.tipoSolicitudId) return false;
  }
  if (filtros.categoria) {
    const tipo = getTipoSolicitudById(r.termino?.tipoSolicitudId);
    if (tipo?.categoria !== filtros.categoria) return false;
  }
  if (filtros.dependencia) {
    if (r.clasificacion?.oficinaDestino !== filtros.dependencia) return false;
  }
  if (filtros.responsable) {
    if (!norm(r.clasificacion?.funcionarioResponsableNombre).includes(norm(filtros.responsable))) return false;
  }
  if (filtros.estado) {
    if (norm(r.estadoActual) !== norm(filtros.estado)) return false;
  }
  if (filtros.fechaDesde) {
    const fd = fechaAMs(filtros.fechaDesde);
    const fr = fechaAMs(r.control?.fechaRadicado);
    if (fr < fd) return false;
  }
  if (filtros.fechaHasta) {
    const fh = fechaAMs(filtros.fechaHasta);
    const fr = fechaAMs(r.control?.fechaRadicado);
    // Incluir todo el día final: si "fechaHasta" llegó como YYYY-MM-DD, fechaAMs(fh) cae a 00:00.
    const finDia = filtros.fechaHasta.length === 10 ? fh + 24 * 60 * 60 * 1000 - 1 : fh;
    if (fr > finDia) return false;
  }
  if (filtros.mes || filtros.anio) {
    const fr = r.control?.fechaRadicado ? new Date(r.control.fechaRadicado) : null;
    if (!fr || Number.isNaN(fr.getTime())) return false;
    if (filtros.anio && fr.getFullYear() !== filtros.anio) return false;
    if (filtros.mes && fr.getMonth() + 1 !== filtros.mes) return false;
  }
  if (filtros.canalRespuesta) {
    if ((r.canalRespuesta ?? '') !== filtros.canalRespuesta) return false;
  }
  // Sprint Ventanilla Operativa 1
  if (filtros.origenIngreso) {
    if ((r.control?.origenIngreso ?? '') !== filtros.origenIngreso) return false;
  }
  if (filtros.tipoEntrada) {
    if ((r.control?.tipoEntrada ?? '') !== filtros.tipoEntrada) return false;
  }
  if (filtros.tipoPersona) {
    if ((r.solicitante?.tipoPersona ?? '') !== filtros.tipoPersona) return false;
  }
  if (typeof filtros.anonimo === 'boolean') {
    const es = r.esAnonimo === true || r.tipoPresentacion === 'ANONIMA';
    if (es !== filtros.anonimo) return false;
  }
  if (typeof filtros.reservado === 'boolean') {
    const es = r.identidadReservada === true || r.tipoPresentacion === 'RESERVADA';
    if (es !== filtros.reservado) return false;
  }
  if (filtros.cumplioTermino === true || filtros.cumplioTermino === false) {
    if (r.cumplioTermino !== filtros.cumplioTermino) return false;
  }
  if (filtros.conNotificacionFallida === true) {
    if (r.alertaNotificacionFallida !== true) return false;
  }
  if (filtros.conRespuestaOficial === true) {
    if (!r.respuestaOficial?.fecha) return false;
  }
  if (filtros.q) {
    if (!matchTextoLibre(r, norm(filtros.q))) return false;
  }
  return true;
}

/* ──────────────────────────────────────────────
   Orquestador

   1. Aplica alcance por rol.
   2. Aplica todos los filtros.
   3. Prioriza coincidencia exacta de radicadoId (si q es un id completo).
   4. Ordena por fechaRadicado DESC.
   5. Pagina (page 1-based, pageSize 25/50/100).
────────────────────────────────────────────── */

export const REGEX_RADICADO_COMPLETO = /^\d+-[A-Z_]+-\d{4}-\d{4,}$/i;

/**
 * Aplica alcance por rol + todos los predicados de `pasaFiltros` a un lote
 * de radicados, SIN ordenar ni paginar.
 *
 * ADR-0010 §2.1 (R11): esta función es el punto de reutilización entre el
 * filtrado en memoria "clásico" (`filtrarRadicados`/`buscarRadicados`, sobre
 * un array ya completo) y el escaneo acotado por cursor de
 * `app/api/radicados/busqueda-avanzada/route.ts`, que la invoca UNA VEZ POR
 * LOTE leído de Firestore (no sobre toda la colección) — así se preserva
 * exactamente la misma semántica de filtros (incluida la exclusión server-side
 * de reservados/anónimos por identidad, R9) sin duplicar el predicado.
 */
export function filtrarLote(
  radicados: VentanillaRadicado[],
  filtros: FiltrosBusqueda,
  alcance: AlcanceRol,
): VentanillaRadicado[] {
  const enAlcance = aplicarAlcanceRol(radicados, alcance);
  return enAlcance.filter((r) => pasaFiltros(r, filtros));
}

/**
 * Reordena un conjunto ya filtrado: coincidencia EXACTA de radicado primero
 * (cuando el usuario escribió un número de radicado completo), luego por
 * `fechaRadicado` desc. Si no hay coincidencia exacta que priorizar, aplica
 * solo el orden por fecha desc.
 *
 * Nota: cuando el llamador ya entrega los ítems en orden `fechaRadicado desc`
 * (p. ej. porque vinieron de un `orderBy` de Firestore, como en el escaneo
 * acotado del endpoint) y no hay coincidencia exacta que priorizar, el
 * resegundo `sort` es un no-op funcional — se mantiene igual para no bifurcar
 * el comportamiento entre llamadores y evitar una superficie de bugs sutil.
 */
export function priorizarCoincidenciaExacta(
  filtrados: VentanillaRadicado[],
  filtros: FiltrosBusqueda,
): VentanillaRadicado[] {
  const qExacto = (filtros.q ?? filtros.radicadoId ?? '').trim();
  if (qExacto && REGEX_RADICADO_COMPLETO.test(qExacto)) {
    return [...filtrados].sort((a, b) => {
      const aExacto = a.radicadoId === qExacto ? 0 : 1;
      const bExacto = b.radicadoId === qExacto ? 0 : 1;
      if (aExacto !== bExacto) return aExacto - bExacto;
      return fechaAMs(b.control?.fechaRadicado) - fechaAMs(a.control?.fechaRadicado);
    });
  }
  return [...filtrados].sort(
    (a, b) => fechaAMs(b.control?.fechaRadicado) - fechaAMs(a.control?.fechaRadicado),
  );
}

/**
 * Aplica alcance por rol + filtros + ordenamiento por fecha desc,
 * SIN paginar. Útil para exportación a Excel filtrado.
 */
export function filtrarRadicados(
  todos: VentanillaRadicado[],
  filtros: FiltrosBusqueda,
  alcance: AlcanceRol,
): VentanillaRadicado[] {
  const filtrados = filtrarLote(todos, filtros, alcance);
  return priorizarCoincidenciaExacta(filtrados, filtros);
}

/**
 * Filtra + ordena + pagina un array YA CARGADO EN MEMORIA. Usada por los
 * tests directos (sin Firestore) y disponible para datasets pequeños ya
 * resueltos. El endpoint `busqueda-avanzada/route.ts` NO usa esta función
 * para servir la búsqueda paginada (ADR-0010 §2.1: eso requiere escanear
 * Firestore por lotes acotados, no cargar todo el dataset primero) — usa
 * `filtrarLote` + `priorizarCoincidenciaExacta` directamente sobre cada lote.
 */
export function buscarRadicados(
  todos: VentanillaRadicado[],
  filtros: FiltrosBusqueda,
  paginacion: Paginacion,
  alcance: AlcanceRol,
): ResultadoBusqueda<VentanillaRadicado> {
  const filtrados = filtrarLote(todos, filtros, alcance);
  const ordenados = priorizarCoincidenciaExacta(filtrados, filtros);

  const pageSize = paginacion.pageSize;
  const total = ordenados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(paginacion.page, totalPaginas));
  const inicio = (page - 1) * pageSize;
  const items = ordenados.slice(inicio, inicio + pageSize);

  return { items, total, page, pageSize, totalPaginas };
}

/* ──────────────────────────────────────────────
   Sanitización por privacidad

   - Reemplaza datos del solicitante por placeholders en anónimos/reservados.
   - Elimina UID del responsable y archivoPath del oficio (rutas internas
     de Storage). El nombre del archivo sí puede mostrarse.
────────────────────────────────────────────── */

export function sanitizarRadicado(r: VentanillaRadicado): VentanillaRadicado {
  const oculto = ocultarIdentidad(r);
  const solicitante = oculto
    ? {
        ...r.solicitante,
        nombreCompleto: 'Anónimo / Reservado',
        numeroDocumento: 'No disponible',
        email: null,
        telefono: null,
        direccion: null,
      }
    : r.solicitante;

  const clasificacion = {
    ...r.clasificacion,
    funcionarioResponsableUid: undefined,
  };

  const respuestaOficial = r.respuestaOficial
    ? { ...r.respuestaOficial, archivoPath: null }
    : r.respuestaOficial;

  return {
    ...r,
    solicitante,
    clasificacion,
    respuestaOficial,
  };
}

/* ──────────────────────────────────────────────
   Presets de rango de fechas
────────────────────────────────────────────── */

export type PresetFecha =
  | 'HOY'
  | 'SEMANA'
  | 'MES'
  | 'MES_ANTERIOR'
  | 'ANIO'
  | 'PERSONALIZADO';

export function rangoFechaPreset(
  preset: PresetFecha,
  hoy: Date = new Date(),
): { desde?: string; hasta?: string } {
  const yyyy = hoy.getFullYear();
  const mm = hoy.getMonth();
  const dd = hoy.getDate();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (preset) {
    case 'HOY':
      return { desde: iso(new Date(yyyy, mm, dd)), hasta: iso(new Date(yyyy, mm, dd)) };
    case 'SEMANA': {
      const diaSemana = hoy.getDay() || 7; // domingo = 7
      const lunes = new Date(yyyy, mm, dd - (diaSemana - 1));
      return { desde: iso(lunes), hasta: iso(new Date(yyyy, mm, dd)) };
    }
    case 'MES':
      return { desde: iso(new Date(yyyy, mm, 1)), hasta: iso(new Date(yyyy, mm, dd)) };
    case 'MES_ANTERIOR': {
      const inicio = new Date(yyyy, mm - 1, 1);
      const fin = new Date(yyyy, mm, 0);
      return { desde: iso(inicio), hasta: iso(fin) };
    }
    case 'ANIO':
      return { desde: iso(new Date(yyyy, 0, 1)), hasta: iso(new Date(yyyy, mm, dd)) };
    case 'PERSONALIZADO':
      return {};
  }
}
