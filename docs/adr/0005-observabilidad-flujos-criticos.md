# ADR-0005 — Observabilidad de flujos críticos (P-C, Ola 1)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (validó la Ola 1)
- **Roles consultados:** arquitecto-principal (`docs/PLAN_OLA1.md` §P-C), coordinador

## Contexto

Estado actual (auditado en `PLAN_OLA1.md` §P-C): solo existe observabilidad de **error**
(`lib/logger.ts`) y de **IA** (`lib/ai/telemetry.ts`). No hay métricas de negocio, latencia
ni correlación en los flujos institucionales. El KPI #3 de la Fase 3 (% de flujos con
observabilidad) no es medible hoy, y sin observabilidad no se puede construir el auditor de
rendimiento (Ola 2) ni medir la IA (P-D). Principio 1 del criterio de éxito v2: todo módulo
nace con observabilidad; primero hay que instrumentar los flujos críticos existentes.

## Decisión

Instrumentar los cuatro flujos críticos —**radicación, asignación, prórroga, respuesta**—
con un evento de observabilidad **estructurado** emitido al completarse cada operación
(éxito o fallo), que incluya como mínimo: nombre de la operación, resultado (ok/error),
**latencia** (ms), un **identificador de correlación** (p. ej. `radicadoId` + timestamp), y
el rol/tenant actor. Se construye sobre `lib/logger.ts` y Sentry existentes mediante un
helper compartido (p. ej. `lib/observabilidad/*`), **sin infraestructura nueva pesada**.

- **PII:** el evento pasa por la sanitización ya existente (`lib/seguridad/sanitizar-*`);
  jamás emite nombre/documento/correo del ciudadano.
- **Alcance (Ola 1):** los 4 flujos citados. NO incluye dashboards, APM, ni persistencia de
  métricas en Firestore (deuda declarada; evita el riesgo R3/costos — YAGNI).

## Alternativas evaluadas

1. **APM/persistencia de métricas completa.** Descartada para la Ola 1: sobre-ingeniería;
   el valor inmediato es la señal estructurada, no un backend de métricas.
2. **No instrumentar (seguir solo con logs de error).** Descartada: el KPI #3 y el auditor
   de rendimiento de la Ola 2 dependen de esta señal.

## Consecuencias

- **Positivas:** los 4 flujos emiten señal medible (latencia + resultado); habilita el KPI #3,
  el auditor de rendimiento (Ola 2) y la medición de IA (P-D). Fundación de "observabilidad
  desde el diseño".
- **Deuda declarada:** sin dashboards ni persistencia (se consumen los eventos vía la
  plataforma de logs/Sentry existente); cobertura inicial de 4 flujos (política: módulo nuevo
  nace instrumentado).

## Control de regresión y criterio de aceptación (obligatorio)

- Cada uno de los 4 flujos emite un evento de observabilidad estructurado en éxito y en fallo.
- Test automatizado que verifica que el evento se emite con los campos requeridos (operación,
  resultado, latencia, correlación) y **sin PII**; falla si un flujo deja de emitirlo.
