---
name: revision-variante-a
description: 2026-07-13 — la calificación CONFORME de la variante A (2C) se emitió sobre capa de presentación; revisada al conocer que el dato reservado viaja completo al cliente
metadata:
  type: project
---

La calificación CONFORME de la variante A (ADR-0006, concepto 2C en
`docs/laboratorio/CONCEPTO_NORMATIVO_OLA2.md`) se emitió sobre un alcance
angosto: pantallas, exportación y canal de inferencia. NO evaluó la frontera
real del dato: el documento Firestore completo (nombre real en claro para
`tipoPresentacion=RESERVADA`, `app/api/radicacion/route.ts:354-374`) llega al
navegador de los 5 roles internos (`firestore.rules:131-140`), y el
enmascaramiento vive solo en cliente (`lib/seguridad/identidad-protegida.ts`).

El 2026-07-13 este rol REVISÓ esa calificación: la variante A tal como está
implementada NO CUMPLE Ley 1581/2012 art. 4 lit. f y g + art. 17 lit. d en la
frontera de transporte, porque la propia entidad definió (ADR-0006) que ningún
rol interno está autorizado a ver la identidad, y el control es eludible
trivialmente. La aceptación de riesgo R10 del propietario (2026-07-13,
REGISTRO_RIESGOS) descansa sobre la premisa incompleta de mi concepto 2C.

**Why:** una auditoría externa técnica estableció el hecho de la frontera del
dato; mi concepto anterior asumió implícitamente que el enmascaramiento era la
frontera.

**How to apply:** en todo concepto futuro sobre datos personales, evaluar la
FRONTERA REAL del dato (qué viaja al cliente / qué persiste), no solo lo que
las pantallas muestran. Declarar siempre el alcance exacto de la evaluación.
Ver [[anclas-normativas-frecuentes]].
