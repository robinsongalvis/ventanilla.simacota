# ADR-0019 — Arquitectura de Transformación Institucional: lente "Automatizar", regla de justificación y Plan Maestro de Evolución

- **Fecha:** 2026-07-13
- **Estado:** aceptado (2026-07-13, por el propietario)
- **Responsable:** Robinson David Galvis (propietario)
- **Roles consultados:** arquitecto-principal (como **Arquitecto de Transformación Institucional**), product-owner, gobierno-digital, ia-simi.

## Contexto

El análisis ya compara y clasifica (ADR-0017/0018), pero el objetivo estratégico
del propietario va más allá: cada proceso debe volverse **mejor, más simple, más
automático y más útil** para funcionarios y ciudadanos. Se institucionaliza el
rol de **Arquitecto de Transformación Institucional** y su lente de
automatización, y se eleva el Backlog Maestro a **Plan Maestro de Evolución de la
Plataforma**. Alinea con el criterio de éxito v2 (menos trabajo humano, más
autonomía del sistema sin comprometer trazabilidad ni gobernanza).

## Decisión

**1. Quinto lente permanente — "E. Automatizar".** En cada análisis, por cada
funcionalidad se identifica:
- qué actividades son hoy **completamente manuales**;
- cuáles pueden **eliminarse** por automatización;
- cuáles puede ejecutar **SIMI/IA como apoyo** (IA sugiere / funcionario decide);
- cuáles **deben mantener aprobación humana** por razón legal o de control;
- qué **datos pueden precargarse** automáticamente;
- qué **tareas repetitivas pueden desaparecer** por completo.

**2. Regla de arquitectura permanente — justificación obligatoria.** *Ninguna
funcionalidad se propone únicamente porque exista en el software de referencia.*
Toda propuesta se justifica por **al menos uno** de:
- **(J1)** Obligación legal o normativa.
- **(J2)** Necesidad operativa de la Alcaldía.
- **(J3)** Mejora medible para el ciudadano.
- **(J4)** Reducción de carga administrativa para los funcionarios.
- **(J5)** Innovación institucional.

Un ítem sin ninguno de estos criterios no entra al plan (o se marca
Rechazado/Fuera de alcance).

**3. Plan Maestro de Evolución de la Plataforma.** El Backlog Maestro deja de ser
una lista de funcionalidades y pasa a ser el plan de evolución: cada iniciativa
lleva justificación **funcional, técnica, normativa y estratégica**, además de la
comparativa (ADR-0018) y la automatización (este ADR).

## Alternativas evaluadas

1. **Automatizar todo lo posible sin control humano.** Descartada: viola "IA
   sugiere, funcionario decide" y las obligaciones de control legal.
2. **Solo detectar brechas (sin lente de automatización).** Descartada: pierde el
   mayor valor (reducir carga administrativa, mejorar servicio).
3. **Lente Automatizar + regla de justificación + Plan Maestro** *(elegida)*.

## Consecuencias

- **Positivas:** cada iniciativa apunta a menos trabajo manual y mejor servicio,
  con justificación explícita; se evita el "feature por imitación"; la IA se
  integra donde aporta valor verificable manteniendo la decisión humana donde la
  ley lo exige.
- **Límite (invariante):** la automatización **nunca** sustituye la decisión
  administrativa/jurídica; la aprobación humana se preserva donde la norma o el
  control lo requieren (IA sugiere / funcionario decide).
- **Relación con el congelamiento:** no autoriza implementación; el Bloque 2
  permanece "implementación completada – pendiente de validación". El marco
  gobierna el análisis y la priorización.

## Verificación de cumplimiento

Cada ítem del Plan Maestro debe registrar: la comparativa (ADR-0018), la
**naturaleza**, la **automatización** (lente E) y **al menos un criterio de
justificación** (J1–J5). Un ítem sin justificación no se propone a desarrollo.
