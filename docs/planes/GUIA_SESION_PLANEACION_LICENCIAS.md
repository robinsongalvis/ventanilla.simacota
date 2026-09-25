# Guía de sesión — Ingeniero de Planeación · Licencias urbanísticas

**Objetivo:** responder P1–P10 de `ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md` para congelar el modelo de datos de Fase 2. **Duración estimada: 1 hora.** Llevar el Excel abierto (o impreso) — todas las referencias son a filas concretas de su propio archivo.

**Regla de la sesión:** validar, no proponer. Se registra lo que el ingeniero dice que HACE hoy, no lo que el sistema "debería" hacer. Las respuestas se anotan literales y después se traducen a decisiones.

## Bloque 1 — Códigos y combinados (15 min) · congela el catálogo de subtipos

1. **P1:** recorrer la lista y pedir el significado de cada código: LC, LSR, LSU, PH, LR, **LA**, **LU**, y los dos raros: **`LCR VISR`** (hoja CONSECUTIVO, 1 caso) y **`LRC`** (1 caso). ¿Falta algún código que use y no aparezca en 2022–2026?
2. **P2:** mostrar `68745-0-24-…` con `LC, PH y LSU` y `LC y PH` (hoja CONSECUTIVO) → ¿eso fue UN expediente con UNA resolución, o varios? ¿Cómo se liquidó el impuesto?

## Bloque 2 — Numeraciones (15 min) · congela las series

3. **P3:** mostrar lado a lado el radicado `68745-0-25-0002` y su "No. de licencia" `002-2025` (hoja 2025, fila 3 — el único lleno), y la hoja de impuestos 2022 (`LSR 2,022-001`, `LSU 2,022-001`) → ¿la licencia expedida lleva número propio? ¿Una serie por modalidad y año? ¿Cuál serie debe continuar la plataforma?
4. **P5:** ¿dónde registra hoy la resolución final (número y fecha)? ¿Libro físico de resoluciones? ¿Se puede consultar para completar los históricos?
5. **P6:** mostrar el duplicado `68745-0-25-0037` (dos filas: 17-sep y 30-sep-2025, solicitantes distintos) → ¿cuál expediente físico tiene ese número y cómo quedó numerado el otro?

## Bloque 3 — Ciclo de vida y correcciones (20 min) · congela estados y régimen

6. **P4:** ¿qué pasos reales hay entre "me radican la solicitud" y "terminado"? (revisión, acta de observaciones, visita, viabilidad, negación, desistimiento). ¿Qué significa exactamente `REVISADO` en su hoja? ¿Y los registros 2022–2024 que no tienen columna de estado — están todos cerrados?
7. **P7:** mostrar las 3 filas de 2025 con `X` en CORRECCIONES → ¿eso fue un acta de observaciones formal notificada (con suspensión del término) o una devolución informal? ¿Cómo la comunica al solicitante?
8. **P8:** hoja de impuestos 2022: expedición 18-ene → vencimiento 19-jul (≈6 meses) → ¿las vigencias por tipo de licencia? ¿Quién controla el vencimiento?

## Bloque 4 — Operación y fuentes (10 min) · congela migración y handoff

9. **P9:** ¿el Excel es su único registro digital? ¿Los expedientes 2022–2026 están completos en papel? ¿La hoja de impuestos es de Hacienda o suya?
10. **P10:** de las ~45 solicitudes/año, ¿cuántas entran por la ventanilla y cuántas directo en su oficina? ¿Cómo le llegan hoy las de ventanilla?

## Salidas esperadas de la sesión

- [ ] Tabla de códigos validada (P1) → semilla del catálogo de subtipos (RN-3)
- [ ] Regla de combinados (P2) → cardinalidad expediente↔subtipos
- [ ] Decisión de series (P3/P5) → resuelve RN-7 y R5
- [ ] Asignación del duplicado (P6) → resuelve R1
- [ ] Lista de hitos reales (P4) → entrada de la máquina de estados (RN-4) y mapeo de cohortes (R4/R9)
- [ ] Naturaleza de las correcciones (P7) → insumo para Jurídica (RN-5/gate)
- [ ] Registro de acuerdos → anexo del ADR de Fase 2 (REC-7)

**Después de la sesión:** actualizar `ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md` (inferencias I2–I7 pasan a hechos o se corrigen) y arrancar el ADR de Fase 2 con lo congelable.
