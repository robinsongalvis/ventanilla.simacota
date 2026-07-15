/* ══════════════════════════════════════════════════════════════
   POST /api/radicados/busqueda-avanzada

   Búsqueda Histórica Avanzada de radicados (Sprint 2).

   - Valida sesión interna (cookie).
   - Aplica reglas de visibilidad por rol:
       ADMIN / CONTROL_INTERNO / RECEPCIONISTA → todo.
       FUNCIONARIO / JEFE_DEPENDENCIA → solo su dependencia.
   - Carga radicados por LOTES ACOTADOS con cursor (ADR-0010 §2.1, R11) en
     vez de la colección completa. Delega el filtrado fino de cada lote a
     `lib/busqueda/filtros-radicado.ts` (`filtrarLote`).
   - Sanitiza identidad (anónimos/reservados) y elimina UID/archivoPath.
   - Ordena por control.fechaRadicado desc (orden natural del cursor de
     Firestore); prioriza coincidencia exacta de radicado si aplica.
   - Instrumentado (ADR-0011, 2B): emite `registrarEventoNegocio` con
     latencia + nº de documentos leídos de la consulta.

   ── ADR-0010 §2.1 — diseño del acotamiento (decisión registrada aquí) ──
   La búsqueda admite filtros que Firestore no puede resolver server-side
   sin infraestructura de texto completo (subcadena en nombre/documento/
   correo/asunto/responsable, `q` libre multi-campo). Por eso el acotamiento
   NO es "leer exactamente pageSize documentos siempre" (eso solo es posible
   cuando los filtros activos son 100% empujables a Firestore); es un
   ESCANEO POR LOTES CON CURSOR, acotado por un TECHO DURO
   (`MAX_DOCS_ESCANEADOS`), que reemplaza la lectura incondicional de TODA
   la colección:
     - Se empujan a Firestore los filtros nativos y ya indexados sin requerir
       índices nuevos: tenant (existente) y `dependencia` (mismo campo/índice,
       solo para roles que ven todo el municipio).
     - El resto de los filtros (texto libre, subcadena, categoría derivada,
       fechas, etc.) se aplican en memoria POR LOTE, reutilizando
       `filtrarLote` — el mismo predicado exacto que antes, sin duplicar
       lógica ni aflojar el cierre de R9 (exclusión de reservados/anónimos
       por identidad).
     - El escaneo se detiene al reunir suficientes coincidencias para la
       página pedida, al agotar la colección, o al tocar el techo
       `MAX_DOCS_ESCANEADOS` (500 — mismo presupuesto INTERACTIVO que el
       resto de superficies acotadas del control de regresión).
   Consecuencia declarada (Principio 13): para páginas profundas con
   filtros muy selectivos de texto libre, el nº de documentos leídos puede
   superar `pageSize` (hasta el techo de 500) — pero SIEMPRE queda acotado
   por ese techo, independiente de N (el tamaño total de la colección), que
   es exactamente el problema que R11 pedía cerrar. `total`/`totalPaginas`
   dejan de ser un conteo exacto de TODO el histórico cuando hay filtros no
   empujables activos (antes exigía leer la colección completa para darlo);
   pasan a reflejar lo encontrado dentro del escaneo acotado, con
   `limiteAlcanzado` para distinguir "no hay más" de "dejamos de buscar".
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  filtrarLote,
  priorizarCoincidenciaExacta,
  sanitizarRadicado,
  type AlcanceRol,
  type FiltrosBusqueda,
} from '@/lib/busqueda/filtros-radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { logError } from '@/lib/logger';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';

export const runtime = 'nodejs';

interface BusquedaPayload {
  filtros?: Partial<FiltrosBusqueda>;
  page?: number;
  pageSize?: 25 | 50 | 100;
}

const PAGE_SIZES: ReadonlySet<25 | 50 | 100> = new Set([25, 50, 100]);

/**
 * Techo duro de documentos leídos de Firestore POR PETICIÓN, independiente
 * de N (ADR-0010 §2.1). Igual al presupuesto INTERACTIVO ya establecido en
 * `scripts/laboratorio/presupuesto-rendimiento.mjs` y al mismo tope usado
 * por el stream operativo (`useVentanillaRadicados`, `LIMITE_DOCUMENTOS_STREAM`).
 */
const MAX_DOCS_ESCANEADOS = 500;

type RadicadoConMetadatosPrueba = VentanillaRadicado & {
  isTest?: boolean;
  excludeFromMetrics?: boolean;
};

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

  const alcance: AlcanceRol = {
    rol: usuario.rol,
    tenantId: usuario.tenantId,
  };

  // Marca el inicio de la operación de LECTURA medida (ADR-0011/0010, 2A/2B):
  // desde aquí hasta tener `coincidencias` es exactamente el costo que este
  // incremento acota (antes: O(N) sobre toda la colección, sin límite).
  const inicioLectura = Date.now();
  let docsLeidos = 0;
  try {
    const db = getFirebaseAdminDb();

    // Filtros empujables a Firestore sin requerir índices nuevos (reutilizan
    // el mismo campo/índice compuesto ya usado por el stream operativo y por
    // el pre-filtro de tenant de este mismo endpoint):
    //   - tenant: obligatorio para FUNCIONARIO/JEFE_DEPENDENCIA (aislamiento).
    //   - dependencia: solo para roles que ven todo el municipio, cuando el
    //     filtro está activo — mismo campo, reduce el volumen a escanear.
    let queryBase: FirebaseFirestore.Query = db
      .collection('ventanilla_radicados')
      .orderBy('control.fechaRadicado', 'desc');

    if (usuario.rol === 'FUNCIONARIO' || usuario.rol === 'JEFE_DEPENDENCIA') {
      queryBase = queryBase.where('clasificacion.oficinaDestino', '==', usuario.tenantId);
    } else if (filtros.dependencia) {
      queryBase = queryBase.where('clasificacion.oficinaDestino', '==', filtros.dependencia);
    }

    // El resto de los filtros (texto libre, subcadena, fechas, categoría
    // derivada, etc.) no son empujables sin infraestructura de texto
    // completo — se aplican en memoria POR LOTE vía `filtrarLote`, que
    // reutiliza exactamente el mismo predicado que antes (preserva R9 y el
    // resto de la semántica de filtros sin duplicar lógica).
    const objetivo = page * pageSize; // nº de coincidencias necesarias para completar la página pedida
    const coincidencias: VentanillaRadicado[] = [];
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let agotado = false; // la colección (dentro del alcance empujado) se acabó

    while (coincidencias.length < objetivo && docsLeidos < MAX_DOCS_ESCANEADOS && !agotado) {
      let lote: FirebaseFirestore.Query = queryBase.limit(pageSize);
      if (cursor) lote = lote.startAfter(cursor);

      const snap = await lote.get();
      docsLeidos += snap.size;
      if (snap.docs.length > 0) cursor = snap.docs[snap.docs.length - 1];
      if (snap.size < pageSize) agotado = true; // Firestore devolvió menos de lo pedido: no hay más

      // Sprint Preoperación B: excluir datos de prueba de la búsqueda normal.
      const candidatos = snap.docs
        .map((d) => d.data() as RadicadoConMetadatosPrueba)
        .filter((r) => !r.isTest && !r.excludeFromMetrics);

      coincidencias.push(...filtrarLote(candidatos, filtros, alcance));
    }

    const limiteAlcanzado = !agotado && coincidencias.length < objetivo && docsLeidos >= MAX_DOCS_ESCANEADOS;

    // Ya vienen en orden fechaRadicado desc (orden natural del cursor); esto
    // solo reordena si hay una coincidencia exacta de radicado que priorizar.
    const ordenados = priorizarCoincidenciaExacta(coincidencias, filtros);

    // total/totalPaginas: cuando hay filtros no empujables activos, ya NO es
    // un conteo exacto de todo el histórico (antes exigía leer la colección
    // completa para darlo) — refleja lo encontrado dentro del escaneo
    // acotado. Si el escaneo se detuvo sin confirmar el fin de la colección
    // ni tocar el techo, se declara al menos una página más para no bloquear
    // "Siguiente" (se resuelve al pedirla).
    let totalPaginas: number;
    if (agotado) {
      totalPaginas = Math.max(1, Math.ceil(ordenados.length / pageSize));
    } else if (limiteAlcanzado) {
      totalPaginas = Math.max(1, page);
    } else {
      totalPaginas = Math.max(Math.ceil(ordenados.length / pageSize), page + 1);
    }
    const paginaFinal = Math.max(1, Math.min(page, totalPaginas));
    const inicioPagina = (paginaFinal - 1) * pageSize;
    const items = ordenados.slice(inicioPagina, inicioPagina + pageSize).map(sanitizarRadicado);

    // Señal de lectura (ADR-0011): nº TOTAL de documentos que Firestore
    // devolvió a lo largo de todos los lotes del escaneo (antes de filtrar
    // isTest/filtros) + latencia total. Sin PII: mismo primitivo que las
    // 4 escrituras. Con el acotamiento, este número queda ≤ MAX_DOCS_ESCANEADOS
    // (500) SIEMPRE, independiente de N — antes crecía linealmente con N.
    registrarEventoNegocio({
      operacion:  'busqueda_radicados',
      resultado:  'ok',
      latenciaMs: Date.now() - inicioLectura,
      docsLeidos,
      radicadoId: null,
      actorRol:   usuario.rol,
      tenant:     usuario.tenantId,
    });

    return NextResponse.json({
      items,
      total: ordenados.length,
      page: paginaFinal,
      pageSize,
      totalPaginas,
      filtrosAplicados: filtros,
      // Campos aditivos (ADR-0010 §2.1) — el frontend actual los ignora sin
      // romperse; quedan disponibles para que dev-frontend, si lo decide,
      // muestre una señal de "resultados acotados, refina la búsqueda".
      limiteAlcanzado,
      docsEscaneados: docsLeidos,
    });
  } catch (err) {
    registrarEventoNegocio({
      operacion:  'busqueda_radicados',
      resultado:  'error',
      latenciaMs: Date.now() - inicioLectura,
      radicadoId: null,
      actorRol:   usuario.rol,
      tenant:     usuario.tenantId,
      error:      err,
    });
    logError({ radicadoId: '-', modulo: 'busqueda-avanzada', error: err });
    return NextResponse.json(
      { error: 'No fue posible ejecutar la búsqueda histórica.' },
      { status: 500 },
    );
  }
}
