# ADR-0004 — Levantamiento gobernado del congelamiento para la Ola 1 (Fase 3)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (propietario) — validó `docs/PLAN_OLA1.md` y autorizó el inicio
- **Roles consultados:** arquitecto-principal (plan de implementación), coordinador

## Contexto

El congelamiento de arquitectura (ADR-0002) siguió vigente durante toda la Fase 2 y su
cierre (incluida la remediación H1, ADR-0003, como excepción controlada). Con la Fase 2
validada funcional y de gobernanza, el propietario aprobó la dirección estratégica de la
Fase 3 (`docs/PLAN_FASE3.md`) y validó el plan de implementación de la Ola 1
(`docs/PLAN_OLA1.md`), fijando además la variante A (enmascarar por defecto) para H2.

## Decisión

Se levanta el congelamiento **únicamente para el alcance aprobado de la Ola 1**:

- **P-C** — Observabilidad de flujos críticos (ADR-0005).
- **P-A/H2** — Enmascaramiento transversal de identidad reservada, variante A (ADR-0006).
- **P-B** — Pruebas unitarias de reglas Firestore / aislamiento por tenant (ADR-0007).

Todo lo que quede fuera de estos tres frentes **sigue congelado**. Ningún trabajo adicional
se incorpora sin pasar por el ciclo institucional permanente (Riesgo → ADR → Implementación
→ Pruebas → Revisión cruzada → Evidencia → Cierre trazable) y sin dejar un control
automatizado de regresión.

## Consecuencias

- Cada frente entra por su ADR de diseño y cierra con evidencia verificable y control de
  regresión; el propietario valida cada cierre.
- Al cerrar la Ola 1 (los 3 frentes verdes + evidencia), se evalúa abrir la Ola 2 por el
  mismo procedimiento.
- El registro de riesgos (`docs/REGISTRO_RIESGOS.md`) refleja el avance: H2 pasa a
  PLANIFICADO→EN CURSO→RESUELTO con su control.
