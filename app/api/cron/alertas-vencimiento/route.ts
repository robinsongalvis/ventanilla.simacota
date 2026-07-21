import { NextResponse }          from 'next/server';
import { getFirebaseAdminDb }    from '@/lib/firebase-admin';
import { enviarEmail }           from '@/lib/email/mailer';
import { diasRestantesHabiles, fechaLimiteAlertaVencimiento } from '@/lib/tiempos-radicado';
import { DIRECTORIO_TENANTS }    from '@/src/types/reglas-negocio';
import { logError }              from '@/lib/logger';
import { autorizarCron }         from '@/lib/seguridad/autorizar-cron';
import {
  buildAlertaVencimientoHtml,
  buildAlertaVencimientoSubject,
}                                 from '@/lib/email/templates/alerta-vencimiento';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId }         from '@/src/types/radicado';

export const runtime = 'nodejs';
// Techo del plan (Vercel Hobby/Pro: 300s en funciones cron) — evita que un
// barrido a escala se trunque en silencio antes de enviar todas las alertas
// de plazo legal (Roadmap P1.4; Ley 1755).
export const maxDuration = 300;

/* ══════════════════════════════════════════════════════════════
   GET /api/cron/alertas-vencimiento
   Ejecutado diariamente por Vercel Cron (o manualmente con CRON_SECRET).

   Busca radicados activos con ≤ 2 días hábiles al vencimiento y envía
   email de alerta al funcionario responsable y/o a la dependencia.

   Seguridad: requiere header Authorization: Bearer <CRON_SECRET>
   (Vercel lo inyecta automáticamente para cron jobs configurados).
══════════════════════════════════════════════════════════════ */

const ESTADOS_ACTIVOS = new Set([
  'PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'DEVUELTO', 'PRORROGA',
]);

const UMBRAL_DIAS = 2; // Alerta cuando quedan ≤ 2 días hábiles

// Techo duro adicional (clase BATCH, ADR-0011 2B: hasta 1000 docs, N-independiente)
// como defensa en profundidad SOBRE la cota por estado+fecha: aunque el rango de
// fecha ya excluye la inmensa mayoría de la colección, un techo numérico explícito
// impide una lectura sin límite si el volumen de vencimientos simultáneos escalara.
const TECHO_LECTURA_CRON = 1000;

export async function GET(request: Request): Promise<NextResponse> {
  // Verificar autorización
  const auth = autorizarCron({
    authorization: request.headers.get('authorization'),
    secret:        process.env.CRON_SECRET,
  });

  if (!auth.ok) {
    console.warn('[cron/alertas-vencimiento] acceso denegado', { motivo: auth.motivo });
    return NextResponse.json({ error: auth.mensaje }, { status: auth.status });
  }

  const db        = getFirebaseAdminDb();
  const ahora     = new Date().toISOString();
  const enlaceUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://ventanilla-simacota.vercel.app'}/interno/dashboard`;
  let enviados = 0;
  let errores  = 0;
  let omitidos = 0;

  try {
    // Consulta ACOTADA (Roadmap P1.4): antes se leía la colección completa y
    // se filtraba en memoria — a escala eso se trunca en silencio sin
    // `maxDuration` suficiente y sin cota de lectura. Ahora se acota por
    // estado activo (== los mismos ESTADOS_ACTIVOS que antes filtraban en
    // memoria) y por una cota superior de fecha calculada con
    // `fechaLimiteAlertaVencimiento`: cualquier `fechaVencimiento` mayor a
    // esa cota tiene, por construcción, más de UMBRAL_DIAS días hábiles
    // restantes y jamás calificaría para la alerta, así que excluirla de la
    // lectura no cambia el resultado. El filtro EXACTO (`diasRestantesHabiles`,
    // incluida la exclusión de vencidos) se preserva intacto sobre el
    // resultado ya acotado — los cron no tienen contexto de tenant.
    const limiteVencimiento = fechaLimiteAlertaVencimiento(new Date(), UMBRAL_DIAS).toISOString();
    const snap = await db.collection('ventanilla_radicados')
      .where('estadoActual', 'in', [...ESTADOS_ACTIVOS])
      .where('termino.fechaVencimiento', '<=', limiteVencimiento)
      .orderBy('termino.fechaVencimiento')
      .limit(TECHO_LECTURA_CRON)
      .get();
    const radicados = snap.docs
      .map((d) => d.data() as VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean })
      .filter((r) => ESTADOS_ACTIVOS.has(r.estadoActual) && !r.isTest && !r.excludeFromMetrics);

    for (const r of radicados) {
      const diasRestantes = diasRestantesHabiles(r.termino.fechaVencimiento);

      // Solo alertar si está dentro del umbral y no ya vencido (vencidos se manejan aparte)
      if (diasRestantes > UMBRAL_DIAS || diasRestantes < 0) {
        continue;
      }

      // Determinar destinatario: funcionario responsable o email de la dependencia
      const emailDestino =
        r.clasificacion.funcionarioResponsableEmail ||
        DIRECTORIO_TENANTS[r.clasificacion.oficinaDestino as TenantId]?.emailOficial;

      if (!emailDestino) {
        omitidos++;
        continue;
      }

      const dependenciaNombre =
        DIRECTORIO_TENANTS[r.clasificacion.oficinaDestino as TenantId]?.nombreOficial ||
        r.clasificacion.oficinaDestino;

      // Construir y enviar email de alerta
      try {
        const asuntoEmail = buildAlertaVencimientoSubject(r.radicadoId, diasRestantes);

        const htmlEmail = buildAlertaVencimientoHtml({
          radicadoId:        r.radicadoId,
          funcionarioNombre: r.clasificacion.funcionarioResponsableNombre ?? '',
          asunto:            r.detalle.asunto,
          ciudadanoNombre:   r.solicitante.nombreCompleto,
          dependenciaNombre,
          diasRestantes,
          fechaVencimiento:  r.termino.fechaVencimiento,
          tipoSolicitud:     r.termino.tipoSolicitudNombre,
          enlaceUrl,
        });

        await enviarEmail({
          to:      emailDestino,
          subject: asuntoEmail,
          html:    htmlEmail,
        });

        enviados++;
      } catch (err) {
        errores++;
        logError({
          radicadoId: r.radicadoId,
          modulo:     'cron/alertas-vencimiento',
          error:      err,
        });
      }
    }

    return NextResponse.json({
      ok:        true,
      timestamp: ahora,
      total:     radicados.length,
      alertados: enviados,
      errores,
      omitidos,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/alertas-vencimiento] Error fatal:', msg);
    return NextResponse.json({ error: 'No fue posible ejecutar el cron.' }, { status: 500 });
  }
}
