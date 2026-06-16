import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { generarReporteExcelMipg, type SimiAuditoriaRecord, type SimiFeedbackRecord } from '@/lib/reportes-mipg/excel';
import { radicadosVisiblesParaRol } from '@/lib/reportes-mipg/sanitizar';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';
import {
  filtrarRadicados,
  type AlcanceRol,
  type FiltrosBusqueda,
} from '@/lib/busqueda/filtros-radicado';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   POST /api/reportes/mipg/excel

   Genera y descarga el reporte Excel MIPG con 8 hojas
   institucionales. Respeta permisos por rol:
     - ADMIN/CONTROL_INTERNO/RECEPCIONISTA: todos los radicados.
     - FUNCIONARIO/JEFE_DEPENDENCIA: solo su tenant.

   Carga la trazabilidad de cada radicado visible (subcolección),
   más la auditoría y feedback de SIMI dentro del alcance del rol.

   Devuelve el .xlsx como attachment con Content-Disposition.
══════════════════════════════════════════════════════════════ */

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

  // Sprint 2: el body puede contener `filtros` para exportar resultados de la
  // búsqueda histórica. Se ignora silenciosamente si el cuerpo está vacío.
  let filtros: FiltrosBusqueda = {};
  try {
    const body = await request.json().catch(() => null) as { filtros?: FiltrosBusqueda } | null;
    if (body?.filtros && typeof body.filtros === 'object') {
      filtros = body.filtros;
    }
  } catch {
    filtros = {};
  }
  const hayFiltros = Object.values(filtros).some((v) => v !== '' && v !== null && v !== undefined);

  const db = getFirebaseAdminDb();
  const inicio = Date.now();

  try {
    // 1. Cargar radicados completos
    const radSnap = await db.collection('ventanilla_radicados').get();
    const radicadosTotales = radSnap.docs.map((d) => d.data() as VentanillaRadicado);
    let visibles = radicadosVisiblesParaRol(radicadosTotales, usuario);

    if (hayFiltros) {
      const alcance: AlcanceRol = { rol: usuario.rol, tenantId: usuario.tenantId };
      visibles = filtrarRadicados(visibles, filtros, alcance);
    }

    // 2. Cargar trazabilidad de cada radicado visible — Promise.allSettled
    //    para que un fallo individual NO aborte todo el reporte. La hoja
    //    Trazabilidad simplemente muestra menos filas en ese caso.
    const trazabilidadPorRadicado = new Map<string, TrazabilidadRadicado[]>();
    let radicadosConTrazaFallida = 0;
    const cargas = await Promise.allSettled(
      visibles.map(async (r) => {
        const ts = await db
          .collection(`ventanilla_radicados/${r.radicadoId}/trazabilidad`)
          .orderBy('fecha', 'asc')
          .get();
        return { radicadoId: r.radicadoId, docs: ts.docs.map((d) => d.data() as TrazabilidadRadicado) };
      }),
    );
    for (const c of cargas) {
      if (c.status === 'fulfilled') {
        trazabilidadPorRadicado.set(c.value.radicadoId, c.value.docs);
      } else {
        radicadosConTrazaFallida += 1;
        console.error('[MIPG_EXCEL_ERROR] trazabilidad', {
          mensaje: c.reason instanceof Error ? c.reason.message : String(c.reason),
        });
      }
    }

    // 3. Cargar auditoría y feedback SIMI — best-effort, jamás bloquea
    let simiQuery: FirebaseFirestore.Query = db.collection('simi_auditoria');
    let feedbackQuery: FirebaseFirestore.Query = db.collection('simi_feedback');
    if (usuario.rol === 'FUNCIONARIO' || usuario.rol === 'JEFE_DEPENDENCIA') {
      simiQuery = simiQuery.where('tenantId', '==', usuario.tenantId);
      feedbackQuery = feedbackQuery.where('tenantId', '==', usuario.tenantId);
    }
    const [simiRes, feedRes] = await Promise.allSettled([simiQuery.get(), feedbackQuery.get()]);
    const simiAuditoria: SimiAuditoriaRecord[] = simiRes.status === 'fulfilled'
      ? simiRes.value.docs.map((d) => d.data() as SimiAuditoriaRecord)
      : (console.error('[MIPG_EXCEL_ERROR] simi_auditoria', {
          mensaje: simiRes.reason instanceof Error ? simiRes.reason.message : String(simiRes.reason),
        }), []);
    const simiFeedback: SimiFeedbackRecord[] = feedRes.status === 'fulfilled'
      ? feedRes.value.docs.map((d) => d.data() as SimiFeedbackRecord)
      : (console.error('[MIPG_EXCEL_ERROR] simi_feedback', {
          mensaje: feedRes.reason instanceof Error ? feedRes.reason.message : String(feedRes.reason),
        }), []);

    // 4. Generar el libro
    //    Cuando hay filtros activos, pasamos `visibles` ya filtrados — el
    //    composer aplica visibilidad por rol idempotentemente, pero los filtros
    //    finos (fecha, dependencia, tipo, etc.) solo viven aquí.
    const buffer = await generarReporteExcelMipg({
      usuario: {
        uid:      usuario.uid,
        nombre:   usuario.nombre,
        rol:      usuario.rol,
        tenantId: usuario.tenantId,
      },
      radicados: hayFiltros ? visibles : radicadosTotales,
      trazabilidadPorRadicado,
      simiAuditoria,
      simiFeedback,
      filtrosAplicados: hayFiltros ? (filtros as Record<string, unknown>) : undefined,
    });

    console.log('[MIPG_EXCEL_OK]', {
      rol: usuario.rol,
      tenant: usuario.tenantId,
      visibles: visibles.length,
      trazaFallidas: radicadosConTrazaFallida,
      simi: simiAuditoria.length,
      feedback: simiFeedback.length,
      ms: Date.now() - inicio,
      bytes: buffer.byteLength,
    });

    const filename = `Reporte_MIPG_Simacota_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : '';
    console.error('[MIPG_EXCEL_ERROR] fatal', {
      rol: usuario.rol,
      tenant: usuario.tenantId,
      ms: Date.now() - inicio,
      mensaje: msg,
      stack,
    });
    return NextResponse.json(
      { error: 'No fue posible generar el reporte Excel.', detalle: msg.slice(0, 300) },
      { status: 500 },
    );
  }
}
