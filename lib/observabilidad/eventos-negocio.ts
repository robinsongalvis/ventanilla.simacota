/* ══════════════════════════════════════════════════════════════
   OBSERVABILIDAD DE FLUJOS CRÍTICOS — Ventanilla Única Simacota
   ADR-0005 (docs/adr/0005-observabilidad-flujos-criticos.md)
   ADR-0011 (docs/adr/0011-auditor-rendimiento-presupuestos.md) — 2B

   Evento de negocio estructurado, emitido UNA VEZ por invocación de
   cada flujo crítico (radicación, asignación, prórroga, respuesta),
   al completarse — en éxito o en fallo — junto con su latencia total.
   Es el primitivo de *medición* (habilita el KPI #3 y el auditor de
   rendimiento de la Ola 2). Complementa, no reemplaza, a
   `lib/logger.ts` (`logError`, ruta de error) ni a
   `lib/ai/telemetry.ts` (métricas de IA, `ai_logs`).

   ADR-0011 (2B) amplía el vocabulario a la LECTURA: la búsqueda de
   radicados (`app/api/radicados/busqueda-avanzada/route.ts`) emite el
   mismo evento con `docsLeidos` — nº de documentos que Firestore
   devolvió en la consulta —, la señal que habilita medir el patrón
   O(N) de hoy y demostrar con dato la mejora de 2A (paginación).

   Sin infraestructura nueva: emite a stdout como JSON estructurado
   (`console.log`) + el mismo patrón best-effort de Sentry que `logError`
   (revisión cruzada seguridad, 2026-07-11). Sin persistencia en
   Firestore (deuda declarada en ADR-0005 — YAGNI, evita riesgo R3).

   PII: el campo `mensaje` (solo presente en fallos) pasa por
   `sanitizarTextoObservabilidad` — el mismo saneo que usa `logError`.
   El evento JAMÁS incluye nombre, documento, correo ni teléfono del
   solicitante.
══════════════════════════════════════════════════════════════ */

import { sanitizarTextoObservabilidad } from '@/lib/seguridad/sanitizar-observabilidad';

/** Los 4 flujos críticos de ESCRITURA cubiertos en la Ola 1 (ADR-0005 §Alcance). */
export type OperacionCritica = 'radicacion' | 'asignacion' | 'prorroga' | 'respuesta';

/**
 * Operaciones de LECTURA cubiertas por ADR-0011 (2B). Cobertura inicial:
 * la Búsqueda Histórica Avanzada (`busqueda-avanzada/route.ts`), el punto
 * de lectura server-side y medible. El stream operativo del dashboard
 * (`useVentanillaRadicados.ts`, `onSnapshot` en cliente) queda fuera de
 * este primitivo server-side — se instrumenta en 2A si aplica (decisión
 * documentada en el ADR-0011, no forzada aquí).
 */
export type OperacionLectura = 'busqueda_radicados';

/**
 * Operaciones de SISTEMA (cron/background), sin actor humano ni radicado
 * individual asociado. Cobertura inicial (A1): la auditoría semanal AGN
 * 060/2001 de continuidad y unicidad de las series de radicación
 * (`app/api/cron/auditoria-consecutivos/route.ts`).
 */
export type OperacionSistema =
  | 'auditoria_consecutivos'
  /**
   * Vigía predictivo de plazos de SIMI. Añadido el 27-ago-2026, al agendarlo:
   * hasta entonces terminaba en silencio, y los logs de Vercel guardan el
   * estado y la duración pero NO el cuerpo de la respuesta. Una corrida que
   * analizó 500 radicados y una que no encontró ninguno se veían idénticas.
   */
  | 'alertas_vencimiento_simi';

/** Vocabulario completo de operaciones observables (escritura + lectura + sistema). */
export type Operacion = OperacionCritica | OperacionLectura | OperacionSistema;

export type ResultadoOperacion = 'ok' | 'error';

export interface EventoNegocio {
  operacion:   Operacion;
  resultado:   ResultadoOperacion;
  latenciaMs:  number;
  /** Identificador de correlación: radicadoId + timestamp del evento. */
  correlacion: string;
  /** Rol del actor que ejecutó la operación ('PORTAL_CIUDADANO' en el flujo público). */
  actorRol:    string;
  /** Tenant (dependencia) en cuyo contexto ocurre la operación. */
  tenant:      string;
  radicadoId:  string | null;
  timestamp:   string;
  /** Solo presente cuando `resultado === 'error'`; ya saneado de PII. */
  mensaje?:    string;
  /**
   * Solo presente en operaciones de LECTURA (ADR-0011): nº de documentos
   * que Firestore devolvió en la consulta. Es el número que expone el
   * patrón O(N) hoy y que 2A debe reducir a ~pageSize.
   */
  docsLeidos?: number;
  /**
   * Solo en los vigías de plazos: cuántas alertas se CREARON y cuántas se
   * omitieron por existir ya. Sin estos dos números, «corrió bien» y «corrió
   * bien y no hizo nada» son el mismo registro — y el segundo puede significar
   * que el vigía dejó de ver lo que debía.
   */
  alertasCreadas?:  number;
  alertasOmitidas?: number;
}

/**
 * Emite el evento de observabilidad de negocio de un flujo crítico al
 * completarse —éxito o fallo— con su latencia total.
 *
 * Se registra en stdout como JSON one-liner (parseable por cualquier
 * agregador de logs) y, si Sentry está inicializado, como breadcrumb
 * de la categoría `negocio` (no-op silencioso si no hay DSN).
 *
 * Nunca lanza excepciones — seguro para llamar tanto en la ruta de
 * éxito como dentro de un `catch`. No escribe en Firestore ni bloquea
 * la respuesta al cliente.
 */
export function registrarEventoNegocio(params: {
  operacion:  Operacion;
  resultado:  ResultadoOperacion;
  latenciaMs: number;
  radicadoId: string | null;
  actorRol:   string;
  tenant:     string;
  /** Solo se usa (y se sanea) cuando `resultado === 'error'`. */
  error?:     unknown;
  /** Solo para operaciones de LECTURA (ADR-0011): nº de documentos leídos. */
  docsLeidos?: number;
  /** Solo para los vigías de plazos: cuántas alertas se crearon y cuántas se omitieron. */
  alertasCreadas?:  number;
  alertasOmitidas?: number;
}): EventoNegocio {
  const timestamp = new Date().toISOString();
  const radicadoId = params.radicadoId;

  const evento: EventoNegocio = {
    operacion:   params.operacion,
    resultado:   params.resultado,
    latenciaMs:  params.latenciaMs,
    correlacion: `${radicadoId ?? 'sin-radicado'}_${timestamp}`,
    actorRol:    params.actorRol,
    tenant:      params.tenant,
    radicadoId,
    timestamp,
    ...(params.resultado === 'error'
      ? {
          mensaje: sanitizarTextoObservabilidad(
            params.error instanceof Error ? params.error.message : String(params.error ?? ''),
          ),
        }
      : {}),
    ...(typeof params.docsLeidos === 'number' ? { docsLeidos: params.docsLeidos } : {}),
    ...(typeof params.alertasCreadas === 'number' ? { alertasCreadas: params.alertasCreadas } : {}),
    ...(typeof params.alertasOmitidas === 'number' ? { alertasOmitidas: params.alertasOmitidas } : {}),
  };

  // 1. Log estructurado (siempre)
  console.log('[ventanilla:evento-negocio]', JSON.stringify(evento));

  // 2. Sentry breadcrumb (solo si está disponible e inicializado — no-op silencioso si no)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nextjs') as typeof import('@sentry/nextjs');
    if (typeof Sentry.addBreadcrumb === 'function') {
      Sentry.addBreadcrumb({
        category: 'negocio',
        message:  `${evento.operacion}:${evento.resultado}`,
        level:    evento.resultado === 'ok' ? 'info' : 'error',
        data: {
          latenciaMs:  evento.latenciaMs,
          correlacion: evento.correlacion,
          tenant:      evento.tenant,
          actorRol:    evento.actorRol,
          ...(typeof evento.docsLeidos === 'number' ? { docsLeidos: evento.docsLeidos } : {}),
        },
      });
    }
  } catch {
    // Sentry no disponible — no afecta el flujo principal
  }

  return evento;
}
