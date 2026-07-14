# Backlog Maestro de Hallazgos y Requerimientos

**Único inventario oficial de trabajo futuro** (ADR-0017). Vivo: se actualiza en
cada análisis, sin duplicados, conservando la trazabilidad de origen. **Ningún
ítem pasa a desarrollo sin autorización explícita del propietario** (estado
"Aprobado para desarrollo").

Convenciones: **Tipo** = Corrección | Mejora | Nueva funcionalidad | Deuda
técnica | Riesgo. **Prioridad** = Crítica | Alta | Media | Baja. **Estado** =
Identificado | Pendiente de validar | Validado | Aprobado para desarrollo |
Diferido | Descartado | Implementado. **Complejidad** = S/M/L (juicio preliminar,
sin métrica — Principio 13). **Bloque objetivo** = 3/4/5… o "por definir".

## Índice

| ID | Título | Tipo | Prioridad | Estado | Bloque |
|---|---|---|---|---|---|
| BM-B01 | Formato del número de radicado (AAAAMM vs año) | Corrección | Alta | Pendiente de validar | por definir |
| BM-B02 | Serie/subserie documental (TRD) en el radicado | Nueva funcionalidad | Alta | Identificado | por definir |
| BM-B03 | Digitalización de correspondencia física (imagen fiel) | Nueva funcionalidad | Media-Alta | Identificado | por definir |
| BM-B04 | Rótulo imprimible del radicado para el documento físico | Mejora | Media | Identificado | por definir |
| BM-B05 | Regla de ventana de 24 h para reasignación por no competencia | Nueva funcionalidad | Media-Alta | Identificado | por definir |
| BM-B06 | Cierre del ciclo de la planilla (firma escaneada como prueba) | Mejora | Media | Pendiente de validar | por definir |
| BM-B07 | Alinear columnas de la planilla al formato oficial F-GSC-238-37-001 | Mejora | Media | Pendiente de validar | por definir |
| BM-B08 | Radicación diferida por contingencia del sistema | Nueva funcionalidad | Media | Identificado | por definir |
| BM-B09 | Formatos imprimibles de contingencia (Solicitud PQRSD, Registro de Incidentes) | Mejora | Media-Baja | Identificado | por definir |
| BM-B10 | Marca de atención prioritaria | Nueva funcionalidad | Media-Baja | Identificado | por definir |
| BM-B11 | Reclasificación del tipo de solicitud por la dependencia | Mejora | Baja | Pendiente de validar | por definir |
| BM-B12 | Ajuste de términos por Decreto 396/2020 | Corrección | Media | Pendiente de validar | por definir |
| BM-B13 | Casilleros físicos / digiturno | Fuera de alcance | Baja | Descartado | — |
| BM-D01 | Migración cliente→servidor de la ruta interna | Deuda técnica | Alta | Diferido | 3 |
| BM-D02 | Refactor del constructor del radicado (triplicado) | Deuda técnica | Alta | Diferido | 3 |
| BM-D03 | N1 — cierre de escritura de `counters` a cliente | Riesgo | Alta | Diferido | 3 |
| BM-D04 | N4 — cierre de `create` forjable desde cliente | Riesgo | Alta | Diferido | 3 |
| BM-D05 | N3 — magic bytes en la ruta interna | Riesgo | Media | Diferido | 3 |
| BM-D06 | N8 — cierre completo de huérfanos de Storage | Deuda técnica | Media | Diferido | 3 |
| BM-D07 | Wrapper de orquestación (evaluar con evidencia) | Mejora | Baja | Diferido | 3 |
| BM-D08 | N5 — 17 tests `readFileSync` frágiles | Deuda técnica | Baja | Diferido | 3 |
| BM-D09 | Acta de subsanación AGN (si la barrida arroja huecos) | Corrección | Media | Pendiente de validar | 2 (cierre) |
| BM-D10 | Branch protection (los 3 checks) | Riesgo | Alta | Pendiente de validar | — (acción propietario) |

---

## Detalle de ítems — Benchmarking GSC (fuente: procedimientos + planilla)

### BM-B01 — Formato del número de radicado (AAAAMM vs año)
- **Descripción funcional:** la planilla real de Simacota numera `1-110-202607-00001217` (= `1-110-{AAAAMM}-{consecutivo}`); nuestro sistema usa `1-110-{año}-{8díg}`. Además una fila muestra otro formato (`111020260700001220`), posible inconsistencia del software actual. Definir el número canónico institucional.
- **Fuente:** planilla de entrega de Simacota. **Evidencia:** filas 1–10 (formato `1-110-202607-…`; fila 4 divergente).
- **Módulo:** radicación / numeración (`lib/radicado-institucional.ts`, `counters/*`).
- **Tipo:** Corrección · **Prioridad:** Alta · **Estado:** Pendiente de validar · **Bloque:** por definir.
- **Impacto funcional:** continuidad con el registro histórico y con lo que la funcionaria ya usa. **Impacto técnico:** cambia el esquema del contador (anual vs mensual) — intersecta con el fix de H3 (atómico, independiente del formato). **Dependencias:** consecutivo H3 (Bloque 2). **Complejidad:** M.
- **Observaciones:** validar con la funcionaria ANTES de tocar más el consecutivo. NO es un bug de H3.

### BM-B02 — Serie/subserie documental (TRD) en el radicado
- **Descripción funcional:** clasificar cada radicado en su serie/subserie documental según la TRD de la dependencia, con retención y disposición (SGDEA/AGN).
- **Fuente:** TRD por dependencia (100–150) + P-GSC-170-001. **Evidencia:** 15 TRD provistas (pendientes de lectura: PDF imagen).
- **Módulo:** clasificación del radicado / catálogo de series.
- **Tipo:** Nueva funcionalidad · **Prioridad:** Alta · **Estado:** Identificado · **Bloque:** por definir.
- **Impacto funcional:** habilita SGDEA/AGN (primera pregunta del AGN). **Impacto técnico:** modelo de series + índices. **Dependencias:** lectura de las TRD. **Complejidad:** L.
- **Observaciones:** bloqueada por leer las TRD (OCR/poppler). Al desbloquearse, se desglosa por serie/subserie/retención por dependencia.

### BM-B03 — Digitalización de correspondencia física (imagen fiel)
- **Descripción:** en la ventanilla física, escanear el documento en papel y cargarlo como imagen fiel al original.
- **Fuente:** P-GSC-170-001. **Evidencia:** actividad 7. **Módulo:** recepción/registro exprés + adjuntos.
- **Tipo:** Nueva funcionalidad · **Prioridad:** Media-Alta · **Estado:** Identificado · **Bloque:** por definir.
- **Impacto funcional:** completa el flujo físico. **Impacto técnico:** captura/carga + garantía de fidelidad. **Dependencias:** ninguna dura. **Complejidad:** M.

### BM-B04 — Rótulo imprimible del radicado para el documento físico
- **Descripción:** generar un rótulo/etiqueta con el número de radicado para imprimir sobre el documento (original y copia).
- **Fuente:** P-GSC-170-001. **Evidencia:** actividad 6. **Módulo:** radicación / impresión.
- **Tipo:** Mejora · **Prioridad:** Media · **Estado:** Identificado · **Bloque:** por definir.
- **Impacto funcional:** cierre del físico. **Impacto técnico:** bajo (ya hay sello/constancia PDF). **Dependencias:** ninguna. **Complejidad:** S.

### BM-B05 — Regla de ventana de 24 h para reasignación por no competencia
- **Descripción:** tras la asignación, 24 h para validar competencia y reasignar; pasadas 24 h no se puede redireccionar y el responsable asume la gestión (no vuelve a ventanilla).
- **Fuente:** P-GSC-170-001. **Evidencia:** obs. 2 y 7. **Módulo:** asignación/traslado.
- **Tipo:** Nueva funcionalidad · **Prioridad:** Media-Alta · **Estado:** Identificado · **Bloque:** por definir.
- **Impacto funcional:** cumplimiento Ley 1755 (asignación 24 h). **Impacto técnico:** reloj + bloqueo + traza. **Dependencias:** traslado existente. **Complejidad:** M.

### BM-B06 — Cierre del ciclo de la planilla (firma escaneada como prueba)
- **Descripción:** generar → imprimir → firmar → escanear la planilla firmada y subirla como prueba de entrega.
- **Fuente:** P-GSC-170-001. **Evidencia:** actividad 10. **Módulo:** planilla de reparto.
- **Tipo:** Mejora · **Prioridad:** Media · **Estado:** Pendiente de validar · **Bloque:** por definir.
- **Impacto funcional:** cadena de custodia. **Impacto técnico:** carga de la planilla escaneada. **Dependencias:** planilla existente. **Complejidad:** S-M.
- **Observaciones:** verificar si el sprint de planilla ya cierra el ciclo con el escáner.

### BM-B07 — Alinear columnas de la planilla al formato oficial
- **Descripción:** ajustar la planilla al formato F-GSC-8200-238-37-001: Área Asignada, Nro. Fol., Anexos, **Devuelta SI/NO / Reasignada a**, Fecha/Hora de Recibido, **Nombre y Firma** de quien recibe, y "quien entrega".
- **Fuente:** planilla real. **Evidencia:** cabecera y columnas. **Módulo:** planilla de reparto.
- **Tipo:** Mejora · **Prioridad:** Media · **Estado:** Pendiente de validar · **Bloque:** por definir.
- **Impacto funcional:** control de custodia y devolución en el punto de entrega. **Impacto técnico:** columnas del PDF de planilla. **Dependencias:** BM-B06. **Complejidad:** S.

### BM-B08 — Radicación diferida por contingencia del sistema
- **Descripción:** ante caída del sistema, registrar en formato físico y emitir el radicado al restablecerse, avisando al ciudadano por llamada/correo.
- **Fuente:** P-GSC-170-007. **Evidencia:** actividades 2–3. **Módulo:** contingencia / radicación.
- **Tipo:** Nueva funcionalidad · **Prioridad:** Media · **Estado:** Identificado · **Bloque:** por definir.
- **Impacto funcional:** continuidad del servicio. **Impacto técnico:** cola de radicación diferida + notificación. **Dependencias:** notificación existente. **Complejidad:** M.

### BM-B09 — Formatos imprimibles de contingencia
- **Descripción:** Solicitud PQRSD física (F-002) y Registro de Incidentes (F-017) imprimibles para la operación sin sistema.
- **Fuente:** P-GSC-170-007. **Evidencia:** documentos de referencia. **Módulo:** contingencia.
- **Tipo:** Mejora · **Prioridad:** Media-Baja · **Estado:** Identificado · **Bloque:** por definir. **Complejidad:** S.

### BM-B10 — Marca de atención prioritaria
- **Descripción:** marcar atención prioritaria (adultos mayores, niñez, embarazadas, discapacidad) y su efecto en la cola/priorización.
- **Fuente:** P-GSC-170-007 / P-GSC-170-014. **Evidencia:** definiciones. **Módulo:** recepción/priorización.
- **Tipo:** Nueva funcionalidad · **Prioridad:** Media-Baja · **Estado:** Identificado · **Bloque:** por definir. **Complejidad:** S-M.

### BM-B11 — Reclasificación del tipo de solicitud por la dependencia
- **Descripción:** permitir que la dependencia reclasifique el tipo de solicitud (caso Hacienda), con traza. Verificar si el traslado ya lo cubre.
- **Fuente:** P-GSC-170-001. **Evidencia:** condiciones generales. **Módulo:** asignación/tipificación.
- **Tipo:** Mejora · **Prioridad:** Baja · **Estado:** Pendiente de validar · **Bloque:** por definir. **Complejidad:** S.

### BM-B12 — Ajuste de términos por Decreto 396/2020
- **Descripción:** confirmar que los plazos incorporan el ajuste del Decreto 396/2020.
- **Fuente:** P-GSC-170-001 (control de cambios v4.0). **Evidencia:** historial. **Módulo:** tiempos legales.
- **Tipo:** Corrección (si faltara) · **Prioridad:** Media · **Estado:** Pendiente de validar · **Bloque:** por definir. **Complejidad:** S.

### BM-B13 — Casilleros físicos / digiturno
- **Descripción:** clasificación en casilleros físicos y sistema de turnos (digiturno).
- **Fuente:** P-GSC-170-001 (act. 8), P-GSC-170-007. **Tipo:** Fuera de alcance · **Estado:** Descartado.
- **Observaciones:** organizativo / sistema de turnos aparte; reevaluable a futuro.

---

## Detalle de ítems — Deuda del Bloque 2 (fuente: `docs/PLAN_BLOQUE3.md`, auditoría)

Ítems BM-D01..BM-D10: ver descripción, riesgos y secuencia en `docs/PLAN_BLOQUE3.md`
(D1–D10) y `docs/auditorias/AUDITORIA_ARQUITECTONICA_2026-07-13.md`. Resumen de
estado en el índice de arriba. Todos **Diferidos a Bloque 3** salvo BM-D09
(subsanación, atada al cierre del Bloque 2) y BM-D10 (branch protection, acción
administrativa del propietario). No se re-describen aquí para evitar duplicación;
la fuente canónica es el PLAN_BLOQUE3.

## Fuentes aún por incorporar (sin duplicar)
- **Manuales M-GSC-002 / M-004** y **15 TRD** — PDF imagen, pendientes de OCR;
  generarán ítems (especialmente el desglose de BM-B02).
- **Riesgos abiertos** de `docs/REGISTRO_RIESGOS.md` (R3–R7, R12–R15) — se migran
  a este backlog a medida que se activen como trabajo futuro, referenciando su
  origen (sin duplicar los ya cubiertos por BM-D0x).
- **Retroalimentación de la Alcaldía** (reuniones) — se incorpora al recibirse.
