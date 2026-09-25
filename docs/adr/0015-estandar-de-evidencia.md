# ADR-0015 — Estándar de evidencia: ninguna afirmación técnica es un hecho sin evidencia reproducible

- **Fecha:** 2026-07-13
- **Estado:** aceptado (2026-07-13, por el propietario: "este estándar ya constituye una decisión arquitectónica permanente y no debería depender de la memoria del asistente")
- **Responsable:** Robinson David Galvis (propietario)
- **Roles consultados:** arquitecto-principal (redacción, al cierre de la etapa de auditoría y consolidación de la línea base), y el resultado del Architecture Review Board de segundo nivel (seguridad, firestore-datos, dev-backend, gobierno-digital, devops, qa, product-owner) que motivó el estándar.

## Contexto

La etapa de auditoría y consolidación (línea base oficial,
`docs/auditorias/AUDITORIA_ARQUITECTONICA_2026-07-13.md`) demostró, con su
propia revisión adversarial de segundo nivel, un patrón de riesgo recurrente:
**afirmaciones presentadas como hechos que, al examinarlas, eran hipótesis o
estimaciones.** Ejemplos concretos surgidos durante la propia auditoría:

- "H3+N1 cierra cuatro hallazgos como subproductos" resultó ser **0% demostrado
  / 100% hipótesis de acoplamiento** — Storage no es transaccional con Firestore,
  así que N8/N3 no se cierran.
- El aseguramiento de la línea base era **~10% por ejecución y ~90% por lectura
  estática**; "confianza ALTA" significaba "seguro de que el código dice esto",
  no "confirmado que corre en verde".
- Comparaciones de madurez con organizaciones externas y porcentajes de "calidad
  enterprise" son **referencias de criterio, no métricas verificadas**.

El Principio 13 (ADR-0001, "medición antes que opinión") ya exigía apoyar las
decisiones en evidencia. Este ADR lo **eleva a estándar rector operativo y
universal**: no basta con preferir la evidencia; ninguna afirmación técnica se
declara hecho sin evidencia reproducible que la respalde. Se registra como ADR
—y no en la memoria del asistente— para que gobierne el proyecto con la misma
trazabilidad que el resto de las decisiones arquitectónicas.

## Decisión

**Ninguna afirmación técnica podrá presentarse como hecho si no existe evidencia
reproducible que la respalde.** Aplica por igual a riesgos, mejoras,
rendimiento, seguridad, cumplimiento normativo y arquitectura.

Los cinco mandatos, en orden, para cualquier fase futura:

1. **Evidencia antes que conclusión.** No se afirma; se muestra el artefacto
   (archivo:línea, traza, resultado de prueba). Lo no verificado se declara
   explícitamente como supuesto o hipótesis, nunca como hecho.
2. **Medición antes que estimación.** Donde exista métrica, se mide. Las
   analogías y los porcentajes de madurez son referencias de criterio, no datos.
3. **Reproducción antes que corrección.** Un defecto se reproduce en rojo con una
   prueba que falle a propósito **antes** de corregirlo (el fix no es el primer
   entregable: la reproducción lo es).
4. **Automatización antes que cierre del hallazgo.** Ningún hallazgo se cierra
   sin un control automatizado capaz de detectar su regresión, demostrado por
   mutación (romper el control debe ponerlo en rojo). Extiende el ciclo
   obligatorio de hallazgos (ADR-0001 P2/P13; H1 como ejemplar).
5. **Re-medición antes de declarar éxito.** Tras el cambio se re-mide con la
   misma metodología de la línea base (antes → cambio → después). Donde no haya
   métrica disponible, se declara el supuesto en lugar de presentarlo como hecho.

**Criterio de aceptación de cualquier afirmación de mejora:** que pueda sostener
la pregunta de auditoría real —"¿esto lo sostendría el AGN, la SIC o un revisor
externo con la evidencia sobre la mesa?"— no una etiqueta ("enterprise",
"referente"). El objetivo es cerrar de forma verificable las brechas
identificadas, no obtener un rótulo.

**Separación hecho/estimación (obligatoria en todo informe):** los hallazgos con
evidencia (p. ej. H1/H3/H4/H5, N1–N8, con archivo:línea) son la base objetiva de
decisión; las analogías, benchmarks y porcentajes de madurez se rotulan
explícitamente como juicio y no se citan como métricas.

## Alternativas evaluadas

1. **Dejarlo como principio en la memoria del asistente.** Descartada por el
   propietario: una decisión arquitectónica permanente no debe depender de la
   memoria del asistente ni carecer de trazabilidad en el repositorio.
2. **Modificar ADR-0001 (añadir/ampliar el Principio 13).** Descartada: ADR-0001
   está aceptado y cerrado; el patrón del repositorio es emitir ADRs nuevos que
   extienden a los aceptados (mismo criterio que ADR-0008 sobre ADR-0007 y
   ADR-0014 sobre ADR-0001), no reescribirlos.
3. **ADR propio que operacionaliza el Principio 13** *(elegida)* — registra los
   cinco mandatos con fecha, texto literal y criterio de verificación.

## Consecuencias

- **Positivas:** el criterio de evaluación de todo cambio futuro queda trazable e
  invocable; reduce el riesgo de "hipótesis vestida de hecho" que la auditoría
  expuso; refuerza el criterio de éxito v2 (confiabilidad demostrada, no
  afirmada) y ADR-0014 (evidencia objetiva de mejora al cierre de fase).
- **Costo / deuda aceptada:** exige más trabajo por hallazgo (reproducción en
  rojo + control por mutación + re-medición), y puede frenar cierres rápidos.
  Mitigado por el Principio 13 (si medir cuesta más que una decisión reversible,
  se decide, se declara el supuesto y se mide después) y por la retrospectiva de
  fase ("¿alguna regla estorbó sin aportar?").
- **Alcance:** gobierna las afirmaciones de *correctitud e ingeniería*. No
  sustituye las invariantes de producto/seguridad/ley (aislamiento por tenant,
  IA sugiere/funcionario decide, protección de datos, normativa), que no son
  proceso sino correctitud.
- **Relación con el congelamiento:** este ADR no cambia la hoja de ruta ni
  levanta el congelamiento vigente; institucionaliza el criterio bajo el cual se
  evaluará cualquier cambio cuando el congelamiento se levante.

## Verificación de cumplimiento (obligatoria)

Todo informe de cierre de hallazgo o de fase debe poder responder, por cada
afirmación de mejora: (a) ¿cuál es el artefacto de evidencia?, (b) ¿se reprodujo
en rojo antes de corregir?, (c) ¿qué control automatizado detecta la regresión y
cómo se probó por mutación?, (d) ¿cuál fue la medición antes y después? Una
afirmación de éxito sin estas cuatro respuestas —o sin el supuesto declarado
donde no haya métrica— no es conforme y no se presenta como cerrada.
