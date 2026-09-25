# ADR-0003 — Control ejecutable de prórroga (unicidad y tope legal, Ley 1755 art. 14)

- **Fecha:** 2026-07-10
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (propietario) — autorizó excepción controlada al congelamiento
- **Roles consultados:** gobierno-digital (verdicto normativo, `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md`), qa (evidencia E2E), coordinador/arquitecto (diseño del control)

## Contexto

El auditor funcional (Fase 2) detectó y `gobierno-digital` calificó como **ALTA**
(hallazgo H1, `docs/REGISTRO_RIESGOS.md`) que el endpoint de prórroga
(`app/api/radicados/[radicadoId]/prorroga/route.ts`) no valida:
1. **Unicidad** — permite aplicar N prórrogas al mismo radicado (`prorrogasAplicadas`
   se incrementa sin comparar contra un máximo; `assertNotClosed` no veta `PRORROGA`).
2. **Tope legal** — `diasProrroga` solo se valida contra el rango 1-30, desligado del
   término base del tipo de solicitud.

La Ley 1755/2015 (art. 14, parágrafo) admite **una** ampliación excepcional cuyo nuevo
plazo **no podrá exceder del doble del inicialmente previsto**. Sin estos controles, el
vencimiento del derecho de petición (art. 23 C.P.) puede correrse indefinidamente
mientras el radicado luce "en plazo" — riesgo de tutela y responsabilidad disciplinaria.

El propietario aprobó una **excepción controlada al congelamiento** (ADR-0002),
estrictamente acotada a remediar H1, con criterios de cierre explícitos.

## Decisión

Se implementa un **control ejecutable** que IMPIDE (no advierte) estados inválidos:

- Función pura `validarProrroga({ prorrogasAplicadas, diasProrroga, diasRespuesta })`
  en `lib/server/radicados-security.ts` (junto a `assertNotClosed`), que devuelve el
  primer motivo de rechazo o `null` si es válida. El endpoint la invoca tras
  `getRadicadoOrFail` y antes de cualquier escritura; ante rechazo responde
  `RadicadoActionError` con estado 409 (unicidad) o 400 (tope) — **previene**, no persiste.
- **Regla de unicidad:** se rechaza si `(prorrogasAplicadas ?? 0) >= 1`.
- **Regla de tope:** se rechaza si `diasProrroga > diasRespuesta` (término base del tipo).
  Combinada con la unicidad, garantiza que el término total ≤ 2× el término base — el
  "doble" del parágrafo del art. 14.

## Interpretación del tope (decisión de arquitectura)

- El "doble del término inicial" se enforce en el **input** (`diasProrroga ≤ diasRespuesta`)
  en lugar de recalcular la fecha, porque es más simple, determinista y unit-testeable, y
  no depende del estado intermedio de la fecha de vencimiento.
- **Nota conservadora declarada:** hoy `diasProrroga` se suma como días **calendario** a la
  fecha, mientras `diasRespuesta` cuenta días **hábiles**. Comparar el conteo
  `diasProrroga ≤ diasRespuesta` es por tanto *más estricto* que el límite legal (un
  número dado de días calendario abarca menos tiempo que los mismos días hábiles), así que
  nunca lo excede. Unificar la unidad de la prórroga a días hábiles es una mejora separada
  registrada como candidata post-congelamiento, no parte de este control.

## Alternativas evaluadas

1. **Solo advertir (warning en UI/log).** Descartada: el propietario exige que el control
   *impida* estados inválidos, no que los reporte.
2. **Recalcular el tope sobre la fecha con días hábiles exactos.** Descartada por ahora:
   mayor complejidad y superficie de error; el guard por conteo es suficiente y conservador.
3. **No hacer nada (backlog).** Descartada por el propietario: una brecha ALTA sobre una
   obligación legal con mitigación clara no se traslada al backlog.

## Consecuencias

- **Positivas:** conformidad con Ley 1755 art. 14 demostrable por pruebas; H1 pasa a
  RESUELTO protegido por un control automatizado (nuevo criterio de éxito del proyecto).
- **Negativas / deuda aceptada:** la unidad calendario/hábiles de la prórroga queda como
  candidata; radicados que ya tuvieran `prorrogasAplicadas >= 1` no admiten otra prórroga
  (comportamiento correcto). El escenario E2E 09, que asertaba la ausencia del control,
  se invierte para asertar el rechazo (su propio comentario ya anticipaba este cambio).
- **Alcance cerrado:** el congelamiento sigue vigente para todo cambio fuera de este control.

## Criterios de cierre (del propietario)

1. El control impide estados inválidos, no solo los advierte. ✔ por diseño (rechazo previo a escritura).
2. Conformidad normativa demostrada por pruebas automatizadas (unitarias del validador + E2E 09 invertido).
3. Sin regresión sobre los 15 escenarios E2E aprobados.

Cumplidos los tres, H1 → `RESUELTO` en `docs/REGISTRO_RIESGOS.md`.
