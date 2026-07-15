# ADR-0014 — Principio permanente: el ritmo de evolución nunca prevalece sobre la calidad de la arquitectura

- **Fecha:** 2026-07-13
- **Estado:** aceptado (2026-07-13, por el propietario: "Aprobado como principio permanente de gobernanza")
- **Responsable:** Robinson David Galvis (propietario — el principio es decreto suyo del 2026-07-13; la aceptación formal de este ADR es suya)
- **Roles consultados:** arquitecto-principal (redacción, durante la revisión cruzada de la consolidación post-Ola 2), documentacion (`docs/GOBERNANZA.md` §1.a), product-owner (`docs/BACKLOG_TECNICO.md`)

## Contexto

Al cerrar la Ola 2 (Fase 3), el propietario decretó una pausa de consolidación
con congelamiento total de código y, el 2026-07-13, institucionalizó un
principio permanente que quedó citado en `docs/GOBERNANZA.md` §1.a pero sin
decisión registrada propia. El Principio 6 del sistema operativo de ingeniería
(ADR-0001) exige que toda decisión importante genere un ADR; un principio
permanente que condiciona el cierre de **todas** las fases futuras es una
decisión del mismo rango que las registradas en ADR-0001. Dejarlo solo en
`GOBERNANZA.md` lo haría depender de un documento que se autodefine como
referencia corregible, sin la autoridad trazable necesaria para invocarlo en
una tensión de diseño concreta.

## Decisión

Se adopta como principio permanente del proyecto, con el mismo rango
vinculante que los 13 principios de ADR-0001, el decreto textual del
propietario:

> "El ritmo de evolución nunca será más importante que la calidad de la
> arquitectura. Cada nueva fase deberá demostrar, con evidencia objetiva, que
> mejora la mantenibilidad, la auditabilidad, la escalabilidad y la gobernanza
> respecto de la fase anterior."

**Cómo se verifica (criterio operativo de cierre de fase):** ninguna fase se
declara cerrada sin presentar al propietario evidencia objetiva en las cuatro
dimensiones, comparada contra la fase anterior, apoyada en los mecanismos ya
existentes (no se crea infraestructura nueva para este principio):

1. **Mantenibilidad** — la deuda registrada no crece sin plan de pago
   (`docs/REGISTRO_RIESGOS.md`); cada cierre de la fase dejó control de
   regresión automatizado (ciclo obligatorio de hallazgos); retrospectiva de
   la fase en `docs/retrospectivas/` (Principio 11).
2. **Auditabilidad** — cada decisión estructural de la fase tiene ADR
   (Principio 6); el informe de la compuerta de despliegue (ADR-0013) existe
   como artefacto por corrida; el registro de riesgos traza cada cierre.
3. **Escalabilidad** — presupuesto de rendimiento (ADR-0011) en verde;
   cuando la fase tocó rutas de datos, medición contra línea base con el
   método existente (patrón R11: `medir-linea-base-lectura.mjs` /
   `medir-escala-lectura.mjs`).
4. **Gobernanza** — la compuerta de despliegue siguió operando durante toda
   la fase; ningún hallazgo se cerró sin control automatizado capaz de
   detectar su regresión.

Rige el Principio 13 (medición antes que opinión): donde no exista métrica
disponible para una dimensión, el supuesto se declara explícitamente en el
informe de cierre en lugar de presentarse como hecho.

**Rango y modificación:** por tratarse de un decreto permanente del
propietario, su modificación o excepción exige ADR aceptado por él — la
constancia de una línea de la Regla Suprema no basta para este principio.

## Alternativas evaluadas

1. **Dejarlo solo en `GOBERNANZA.md` §1.a.** Descartada: ese documento es
   referencia descriptiva y corregible, no registro de decisión; invocarlo
   para resolver una tensión de diseño exigiría una autoridad trazable que
   una sección de documento no da. El propio documento recomendaba
   formalizarlo por ADR.
2. **Modificar ADR-0001 (añadir un principio 14).** Descartada: ADR-0001 está
   aceptado y cerrado; el patrón del repositorio es no reescribir ADRs
   aceptados sino emitir nuevos que los extienden (mismo criterio que
   ADR-0008 respecto de ADR-0007).
3. **ADR propio que extiende ADR-0001** *(elegida)* — registra el decreto con
   fecha, texto literal y criterio de verificación operativo.

## Consecuencias

- **Positivas:** el decreto pasa de cita a decisión trazable e invocable; el
  cierre de fase gana un criterio objetivo y repetible (cuatro dimensiones con
  evidencia); refuerza el criterio de éxito v2 (confiabilidad, cumplimiento y
  mantenibilidad demostrados con evidencia automatizada).
- **Negativas / deuda aceptada:** costo adicional al cierre de cada fase
  (recolección y presentación de la evidencia). Riesgo de que la evidencia se
  vuelva ritual burocrático — mitigado por el Principio 13 (si medir cuesta
  más que una decisión reversible, se declara el supuesto y se mide después)
  y por la retrospectiva de cada fase (*"¿alguna regla estorbó sin
  aportar?"*).
- **Impacto en otros artefactos:** `docs/GOBERNANZA.md` §1.a enlaza este ADR;
  el plan de la Ola 3 (2E) deberá definir, desde su diseño, qué evidencia
  demostrará la mejora en las cuatro dimensiones al cierre (observabilidad,
  tests y aceptación desde el diseño, no al final).

## Verificación de cumplimiento (obligatoria)

El informe de cierre de cada fase incluye una sección **"Evidencia de mejora
por dimensión"** con las cuatro dimensiones y sus artefactos enlazados
(o el supuesto declarado donde no haya métrica). Un cierre de fase sin esa
sección no es conforme y no se presenta al propietario como cierre.
