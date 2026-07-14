# ADR-0017 — Backlog Maestro de Hallazgos/Requerimientos y Matriz de Cobertura Funcional

- **Fecha:** 2026-07-13
- **Estado:** aceptado (2026-07-13, por el propietario)
- **Responsable:** Robinson David Galvis (propietario)
- **Roles consultados:** arquitecto-principal, product-owner (dueño del backlog).

## Contexto

Comienza el ingreso continuo de conocimiento funcional nuevo (manuales, TRD,
procedimientos de benchmarking, retroalimentación de funcionarios de la
Alcaldía, normativa). Sin un inventario único, ese conocimiento se dispersa y se
duplica. El propietario decide institucionalizar, desde ya, un proceso
permanente de gestión de requerimientos y backlog funcional — **sin autorizar
implementación**: el objetivo es consolidar conocimiento y dejar el trabajo
futuro preparado y trazable.

## Decisión

Se adoptan **dos estructuras oficiales y vivas**, actualizadas en cada análisis:

1. **`docs/BACKLOG_MAESTRO.md`** — el **único** inventario oficial de trabajo
   futuro. Cada ítem lleva, como mínimo: identificador único, título,
   descripción funcional, fuente, evidencia, módulo/proceso afectado, tipo
   (Corrección | Mejora | Nueva funcionalidad | Deuda técnica | Riesgo),
   prioridad (Crítica | Alta | Media | Baja), impacto funcional, impacto
   técnico, dependencias, complejidad estimada, estado (Identificado |
   Pendiente de validar | Validado | Aprobado para desarrollo | Diferido |
   Descartado | Implementado), bloque objetivo (3, 4, 5…) y observaciones.
2. **`docs/MATRIZ_COBERTURA_FUNCIONAL.md`** — compara cada documento/procedimiento
   analizado contra la solución actual, con estado explícito por aspecto
   funcional: Ya implementado | Implementado parcialmente | No implementado |
   No aplica para Simacota | Requiere validación con la Alcaldía.

**Reglas del proceso:**
- Todo documento, manual, TRD, procedimiento, reunión o retroalimentación **se
  incorpora** a ambas estructuras.
- **Sin duplicados**: antes de crear un ítem se busca uno equivalente; si existe,
  se enriquece (fuente/evidencia adicionales) en vez de duplicar.
- **Trazabilidad de origen** obligatoria: cada ítem conserva su fuente y
  evidencia (archivo/página/observación).
- **Ningún ítem pasa a desarrollo sin autorización explícita posterior.** El
  estado "Aprobado para desarrollo" solo lo fija el propietario.
- El Backlog Maestro **consolida** las fuentes de trabajo futuro previas
  (deuda del Bloque 2 `docs/PLAN_BLOQUE3.md`, riesgos abiertos de
  `docs/REGISTRO_RIESGOS.md`, hallazgos de benchmarking) — sin duplicar: los
  ítems referencian su origen.

## Alternativas evaluadas

1. **Seguir con documentos ad-hoc por análisis** (PLAN_BLOQUE3, registro de
   riesgos, diagnósticos sueltos). Descartada: dispersa el inventario y duplica.
2. **Herramienta externa de tickets.** Diferida: hoy el expediente vive en el
   repo (trazable por commit); una integración externa es decisión posterior.
3. **Backlog + matriz en el repo** *(elegida)* — versionado, trazable, revisable.

## Consecuencias

- **Positivas:** un único inventario oficial, trazable y sin duplicados; el
  conocimiento nuevo queda organizado desde el primer momento; separa
  explícitamente *analizar/priorizar* de *implementar* (coherente con la
  disciplina del proyecto).
- **Deuda/costo:** disciplina de mantener ambas estructuras en cada análisis; se
  mitiga con la regla anti-duplicados y la trazabilidad de origen.
- **Relación con el congelamiento:** este ADR **no** autoriza implementación ni
  modifica el Bloque 2 (que permanece "Implementación completada – pendiente de
  validación"); solo institucionaliza el proceso de análisis y priorización.

## Verificación de cumplimiento

Cada análisis nuevo debe dejar actualizados el Backlog Maestro y la Matriz de
Cobertura (o declarar que no aplica). Un análisis que no actualice ambas
estructuras no se considera cerrado.
