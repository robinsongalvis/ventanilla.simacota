/* ══════════════════════════════════════════════════════════════
   POST /api/radicados/busqueda-avanzada

   Búsqueda Histórica Avanzada de radicados (Sprint 2).

   - Valida sesión interna (cookie).
   - Aplica reglas de visibilidad por rol:
       ADMIN / CONTROL_INTERNO / RECEPCIONISTA → todo.
       FUNCIONARIO / JEFE_DEPENDENCIA → solo su dependencia.
   - Carga radicados con un primer filtro server-side (índices Firestore).
   - Delega filtros finos a `lib/busqueda/filtros-radicado.ts`.
   - Sanitiza identidad (anónimos/reservados) y elimina UID/archivoPath.
   - Pagina y ordena por control.fechaRadicado desc.
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  buscarRadicados,
  sanitizarRadicado,
  type AlcanceRol,
  type FiltrosBusqueda,
  type Paginacion,
} from '@/lib/busqueda/filtros-radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface BusquedaPayload {
  filtros?: Partial<FiltrosBusqueda>;
  page?: number;
  pageSize?: 25 | 50 | 100;
}

const PAGE_SIZES: ReadonlySet<25 | 50 | 100> = new Set([25, 50, 100]);

function normalizarFiltros(input: Partial<FiltrosBusqueda> | undefined): FiltrosBusqueda {
  if (!input) return {};
  const limpio: FiltrosBusqueda = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === '' || v === null || typeof v === 'undefined') continue;
    (limpio as Record<string, unknown>)[k] = v;
  }
  return limpio;
}

export async function POST(request: Request): Promise<NextResponse> {
  let usuario;
  try {
    usuario = await requireActiveInternalUser();
  } catch (err) {
    if (err instanceof InternalAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let payload: BusquedaPayload | null = null;
  try {
    payload = (await request.json()) as BusquedaPayload;
  } catch {
    payload = null;
  }

  const filtros = normalizarFiltros(payload?.filtros);
  const pageSize: 25 | 50 | 100 = PAGE_SIZES.has(payload?.pageSize as 25 | 50 | 100)
    ? (payload!.pageSize as 25 | 50 | 100)
    : 25;
  const page = Math.max(1, Number.isFinite(payload?.page) ? Math.floor(payload!.page as number) : 1);
  const paginacion: Paginacion = { page, pageSize };

  const alcance: AlcanceRol = {
    rol: usuario.rol,
    tenantId: usuario.tenantId,
  };

  try {
    const db = getFirebaseAdminDb();
    // Pre-filtro server-side por tenant para roles restringidos (uso de índice
    // clasificacion.oficinaDestino + control.fechaRadicado desc).
    let query: FirebaseFirestore.Query = db
      .collection('ventanilla_radicados')
      .orderBy('control.fechaRadicado', 'desc');

    if (usuario.rol === 'FUNCIONARIO' || usuario.rol === 'JEFE_DEPENDENCIA') {
      query = query.where('clasificacion.oficinaDestino', '==', usuario.tenantId);
    }

    const snap = await query.get();
    // Sprint Preoperación B: excluir datos de prueba de la búsqueda normal.
    const radicados = snap.docs
      .map((d) => d.data() as VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean })
      .filter((r) => !r.isTest && !r.excludeFromMetrics);

    const resultado = buscarRadicados(radicados, filtros, paginacion, alcance);
    const items = resultado.items.map(sanitizarRadicado);

    return NextResponse.json({
      items,
      total: resultado.total,
      page: resultado.page,
      pageSize: resultado.pageSize,
      totalPaginas: resultado.totalPaginas,
      filtrosAplicados: filtros,
    });
  } catch (err) {
    logError({ radicadoId: '-', modulo: 'busqueda-avanzada', error: err });
    return NextResponse.json(
      { error: 'No fue posible ejecutar la búsqueda histórica.' },
      { status: 500 },
    );
  }
}
