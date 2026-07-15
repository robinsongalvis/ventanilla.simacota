# ADR-0009 — Levantamiento gobernado del congelamiento para la Ola 2 (Fase 3)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (propietario) — validó `docs/PLAN_OLA2.md` y autorizó el inicio
- **Roles consultados:** arquitecto-principal (plan de implementación), coordinador

## Contexto

La Ola 1 cerró con evidencia (P-B/H2/R8/P-C, prueba de mutación, KPIs). El propietario
aprobó la dirección estratégica de la Ola 2 (escalabilidad demostrable) y validó su plan de
implementación (`docs/PLAN_OLA2.md`), con el mayor riesgo técnico confirmado en código: la
arquitectura de consulta no escala (R11 — lee la colección completa sin cursor ni `limit`
server-side; el stream del dashboard es tiempo real sobre toda la colección).

## Decisión

Se levanta el congelamiento **únicamente para el alcance aprobado de la Ola 2**
(`docs/PLAN_OLA2.md §2`): 2A escalabilidad de la consulta, 2B auditor de rendimiento +
presupuestos, 2C normativo ejecutable (R6/R9/R10), 2D orquestador + compuerta de despliegue,
2E onboarding config-como-dato (prueba de concepto). Todo lo demás sigue congelado; la
apertura del tipo `TenantId` se difiere a la Ola 3 (YAGNI).

**Disciplina de ejecución (condiciones del propietario):**
- Cada sub-ola cierra con **evidencia objetiva** antes de iniciar la siguiente.
- Ningún ADR se cierra sin pruebas automatizadas, revisión cruzada y control de regresión.
- Los KPIs se miden contra la **línea base** (`§7`); solo mejoras demostrables, no declarativas.
- Toda optimización preserva aislamiento multi-tenant, trazabilidad y cumplimiento ya alcanzados.
- Informe ejecutivo al cierre de cada sub-ola + reevaluación de riesgos antes de avanzar.

## Consecuencias

- Cada frente entra por su ADR de diseño (0010–0014) y cierra con evidencia y control de
  regresión; el propietario valida cada cierre.
- Coordinación obligatoria con `task_7f9e8ba3` (paginación de `busqueda-avanzada`, sesión del
  propietario) para no duplicar: 2A cubre el **stream del dashboard** (no solapado); para
  `busqueda-avanzada` se verifica su estado antes de tocarlo.
- Al cerrar la Ola 2 se evalúa la Ola 3 por el mismo procedimiento.
