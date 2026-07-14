# Backlog Maestro de Hallazgos y Requerimientos

**Único inventario oficial de trabajo futuro** (ADR-0017). Vivo: se actualiza en
cada análisis, sin duplicados, con trazabilidad de origen. **Ningún ítem pasa a
desarrollo sin autorización explícita del propietario.**

**Campos:** id · título · descripción · fuente · evidencia · módulo · **tipo**
(Corrección | Mejora | Nueva funcionalidad | Deuda técnica | Riesgo) ·
**prioridad** (Crítica | Alta | Media | Baja) · impacto funcional · impacto
técnico · dependencias · **complejidad/esfuerzo** (XS/S/M/L/XL, juicio sin
métrica — Principio 13) · **valor** (Muy Alto | Alto | Medio | Bajo) ·
**estado** (Identificado | Pendiente de validar | Validado | Aprobado para
desarrollo | Diferido | Descartado | Implementado) · **decisión** (En evaluación
| Aprobado | Pospuesto | Rechazado | Requiere validación normativa) · bloque ·
observaciones.

## Índice priorizable (impacto · costo · beneficio)

| ID | Título | Tipo | Prior. | Valor | Esfuerzo | Estado | Decisión | Bloque |
|---|---|---|---|---|---|---|---|---|
| BM-B20 | **Módulo de Comunicaciones Internas** (solicitud/respuesta/circular/informativo entre dependencias) | Nueva func. | Alta | Muy Alto | XL | Identificado | En evaluación | por definir |
| BM-B02 | Serie/subserie documental (TRD) en el radicado | Nueva func. | Alta | Muy Alto | L | Identificado | En evaluación | por definir |
| BM-B01 | Formato del número de radicado (AAAAMM vs año) | Corrección | Alta | Alto | M | Pend. validar | Requiere validación normativa | por definir |
| BM-B21 | Consecutivos por dependencia + serie propia de circulares | Nueva func. | Alta | Alto | L | Identificado | Requiere validación normativa | por definir |
| BM-B23 | Firmante en comunicaciones internas (circuito de firma) | Mejora | Media-Alta | Alto | M | Identificado | En evaluación | por definir |
| BM-B16 | Catálogo completo de tipos PQRSD (felicitación, denuncia anticorrupción, queja anónima…) | Mejora | Media | Alto | S | Pend. validar | Requiere validación normativa | por definir |
| BM-B18 | Ciclo completo de la planilla (admin: anular, reimprimir, registrar entrega con firma escaneada) | Mejora | Media-Alta | Alto | M | Pend. validar | En evaluación | por definir |
| BM-B17 | Correo interno "Asignación de solicitud" a la dependencia | Mejora | Media | Alto | S | Identificado | En evaluación | por definir |
| BM-B25 | Alerta/bandeja "Prioridad" (entes de control) | Mejora | Media-Alta | Alto | S-M | Identificado | En evaluación | por definir |
| BM-B05 | Regla de 24 h para reasignación por no competencia | Nueva func. | Media-Alta | Alto | M | Identificado | Requiere validación normativa | por definir |
| BM-B10 | Marca de atención prioritaria | Nueva func. | Media | Alto | S-M | Identificado | En evaluación | por definir |
| BM-B03 | Digitalización de correspondencia física (imagen fiel) | Nueva func. | Media-Alta | Alto | M | Identificado | En evaluación | por definir |
| BM-B14 | Radicado pre-generado externo (máquina/reloj) opción Rad.Auto | Nueva func. | Media | Medio | S | Identificado | En evaluación | por definir |
| BM-B15 | Override manual de días hábiles de respuesta | Mejora | Media | Medio | S | Pend. validar | Requiere validación normativa | por definir |
| BM-B24 | Categoría "Sin Término" (felicitaciones, invitaciones) | Mejora | Media | Medio | S | Pend. validar | Requiere validación normativa | por definir |
| BM-B26 | Bandeja de "Devueltas" pendientes de reasignación | Mejora | Media | Medio | S | Identificado | En evaluación | por definir |
| BM-B22 | Envío de copias (CC) a otras dependencias | Mejora | Media | Medio | M | Identificado | En evaluación | por definir |
| BM-B06 | Cierre del ciclo de la planilla (firma escaneada) | Mejora | Media | Alto | S-M | Pend. validar | En evaluación | por definir |
| BM-B07 | Alinear columnas de la planilla al formato oficial | Mejora | Media | Medio | S | Pend. validar | En evaluación | por definir |
| BM-B08 | Radicación diferida por contingencia | Nueva func. | Media | Medio | M | Identificado | En evaluación | por definir |
| BM-B29 | Pestaña "Observaciones/novedades" en el detalle | Mejora | Media | Medio | S | Identificado | En evaluación | por definir |
| BM-B12 | Ajuste de términos por Decreto 396/2020 | Corrección | Media | Medio | S | Pend. validar | Requiere validación normativa | por definir |
| BM-B04 | Rótulo imprimible del radicado para el físico | Mejora | Media | Medio | S | Identificado | En evaluación | por definir |
| BM-B09 | Formatos imprimibles de contingencia | Mejora | Media-Baja | Medio | S | Identificado | En evaluación | por definir |
| BM-B28 | Ayuda in-app (video tutoriales + infografía) | Nueva func. | Baja | Medio | M | Identificado | En evaluación | por definir |
| BM-B19 | Alerta "radicados sin planilla" (contador) | Mejora | Baja | Medio | XS | Identificado | En evaluación | por definir |
| BM-B27 | Registro del medio de radicado (Oficio/Web/Email/Teléfono) | Mejora | Baja | Bajo | XS | Pend. validar | En evaluación | por definir |
| BM-B11 | Reclasificación del tipo por la dependencia | Mejora | Baja | Bajo | S | Pend. validar | En evaluación | por definir |
| BM-B13 | Casilleros físicos / digiturno | Fuera de alcance | Baja | Bajo | — | Descartado | Rechazado | — |
| BM-D01 | Migración cliente→servidor de la ruta interna | Deuda técnica | Alta | Alto | L | Diferido | Pospuesto | 3 |
| BM-D02 | Refactor del constructor del radicado (triplicado) | Deuda técnica | Alta | Alto | M | Diferido | Pospuesto | 3 |
| BM-D03 | N1 — cierre de escritura de `counters` a cliente | Riesgo | Alta | Alto | S | Diferido | Pospuesto | 3 |
| BM-D04 | N4 — cierre de `create` forjable desde cliente | Riesgo | Alta | Alto | M | Diferido | Pospuesto | 3 |
| BM-D05 | N3 — magic bytes en la ruta interna | Riesgo | Media | Medio | S | Diferido | Pospuesto | 3 |
| BM-D06 | N8 — cierre completo de huérfanos de Storage | Deuda técnica | Media | Medio | M | Diferido | Pospuesto | 3 |
| BM-D07 | Wrapper de orquestación (evaluar con evidencia) | Mejora | Baja | Bajo | M | Diferido | En evaluación | 3 |
| BM-D08 | N5 — 17 tests `readFileSync` frágiles | Deuda técnica | Baja | Bajo | M | Diferido | Pospuesto | 3 |
| BM-D09 | Acta de subsanación AGN (si la barrida arroja huecos) | Corrección | Media | Alto | S | Pend. validar | Requiere validación normativa | 2 (cierre) |
| BM-D10 | Branch protection (los 3 checks) | Riesgo | Alta | Alto | XS | Pend. validar | Aprobado | — (acción propietario) |

---

## Detalle — Ejercicio inverso (fuente: manuales M-GSC-002 Ventanilla y M-GSC-004 Comunicaciones int/ext)

### BM-B20 — Módulo de Comunicaciones Internas
- **Descripción:** generar y gestionar **comunicaciones internas** entre dependencias (categorías: Solicitud, Respuesta, **Circular**, Documento Informativo), con destino Interno (dependencias) o Externo (personas), asunto, folios, anexos, descripción, y consecutivo del sistema.
- **Fuente:** M-GSC-004. **Evidencia:** §8.1.4 (pág. 8–12). **Módulo:** nuevo — comunicaciones internas. **Tipo:** Nueva funcionalidad · **Prior.:** Alta · **Valor:** Muy Alto · **Esfuerzo:** XL · **Estado:** Identificado · **Decisión:** En evaluación.
- **Impacto funcional:** habilita todo el flujo documental interno de la Alcaldía (hoy solo cubrimos PQRSD externa + salidas). **Impacto técnico:** módulo, modelo y consecutivos nuevos. **Dependencias:** BM-B21, BM-B23, BM-B22. **Observaciones:** es el mayor vacío detectado; requiere análisis Nivel 3 + ADR antes de cualquier desarrollo.

### BM-B21 — Consecutivos por dependencia + serie propia de circulares
- **Descripción:** las comunicaciones internas usan consecutivo **según la dependencia**, y las **circulares** llevan un consecutivo **distinto** de las demás categorías.
- **Fuente:** M-GSC-004. **Evidencia:** §8.1.4 puntos 3 y 7 (pág. 11). **Módulo:** numeración. **Tipo:** Nueva func. · **Prior.:** Alta · **Valor:** Alto · **Esfuerzo:** L · **Estado:** Identificado · **Decisión:** Requiere validación normativa.
- **Dependencias:** BM-B01 (formato), BM-B20. **Observaciones:** intersecta con nuestro esquema de contador (hoy `radicados`/`salidas`/`planillas` anuales). Diseñar con AGN.

### BM-B22 — Envío de copias (CC) a otras dependencias
- **Descripción:** al generar una comunicación interna, enviar copia a otras dependencias.
- **Fuente:** M-GSC-004. **Evidencia:** §8.1.4 punto 14. **Tipo:** Mejora · **Prior.:** Media · **Valor:** Medio · **Esfuerzo:** M · **Estado:** Identificado · **Decisión:** En evaluación. **Dependencias:** BM-B20.

### BM-B23 — Firmante en comunicaciones internas (circuito de firma)
- **Descripción:** seleccionar el jefe que firma el documento generado. Extiende el circuito de firma que ya existe para respuestas SIMI.
- **Fuente:** M-GSC-004. **Evidencia:** §8.1.4 punto 12. **Tipo:** Mejora · **Prior.:** Media-Alta · **Valor:** Alto · **Esfuerzo:** M · **Estado:** Identificado · **Decisión:** En evaluación. **Dependencias:** BM-B20; circuito de firma existente.

### BM-B14 — Radicado pre-generado externo (Rad.Auto)
- **Descripción:** opción para registrar un radicado **generado externamente** (máquina/reloj/dispositivo) en lugar del automático. Hoy solo autogeneramos.
- **Fuente:** M-GSC-002. **Evidencia:** pág. 4–5 (opción "Radicar", casilla "Rad.Auto"). **Módulo:** radicación. **Tipo:** Nueva func. · **Prior.:** Media · **Valor:** Medio · **Esfuerzo:** S · **Estado:** Identificado · **Decisión:** En evaluación. **Observaciones:** intersecta con H3 (unicidad del consecutivo si se aceptan números externos).

### BM-B15 — Override manual de días hábiles de respuesta
- **Descripción:** permitir fijar un término de días distinto al legal cuando la comunicación lo indica.
- **Fuente:** M-GSC-002 (pág. 5, "Días Hábiles de Respuesta") + M-GSC-004 (punto 6). **Módulo:** tiempos legales. **Tipo:** Mejora · **Prior.:** Media · **Valor:** Medio · **Esfuerzo:** S · **Estado:** Pend. validar · **Decisión:** Requiere validación normativa.

### BM-B16 — Catálogo completo de tipos PQRSD
- **Descripción:** verificar que nuestro catálogo cubre todos los tipos del software: petición general, petición de información, petición de documentos, petición para elevar consulta, queja, reclamo, sugerencia, **denuncia (anticorrupción)**, **queja anónima**, **felicitación**.
- **Fuente:** M-GSC-002 (pág. 5, Paso 5). **Módulo:** catálogo de tipos. **Tipo:** Mejora · **Prior.:** Media · **Valor:** Alto · **Esfuerzo:** S · **Estado:** Pend. validar · **Decisión:** Requiere validación normativa.

### BM-B17 — Correo interno "Asignación de solicitud"
- **Descripción:** al asignar, enviar automáticamente un correo "ASIGNACIÓN DE SOLICITUD" al personal de la dependencia asignada.
- **Fuente:** M-GSC-002 (pág. 9, Paso 16). **Módulo:** notificaciones internas. **Tipo:** Mejora · **Prior.:** Media · **Valor:** Alto · **Esfuerzo:** S · **Estado:** Identificado · **Decisión:** En evaluación.

### BM-B18 — Ciclo completo de la planilla (Admin Planillas)
- **Descripción:** administración de planillas: buscar (rango/número/radicado/estado/dependencia), **reimprimir**, **registrar entrega** (fecha, hora, quien recibe + planilla escaneada con firmas), **descargar planilla firmada**, **anular** (solo "por entregar").
- **Fuente:** M-GSC-002 (pág. 12–16, Pasos 19–22). **Módulo:** planilla de reparto. **Tipo:** Mejora · **Prior.:** Media-Alta · **Valor:** Alto · **Esfuerzo:** M · **Estado:** Pend. validar · **Decisión:** En evaluación. **Dependencias:** BM-B06, BM-B07. **Observaciones:** amplía y consolida BM-B06/B07 con el ciclo administrativo completo.

### BM-B19 — Alerta "radicados sin planilla"
- **Descripción:** contador/alerta de radicados pendientes de generar planilla.
- **Fuente:** M-GSC-002 (pág. 12, punto 2). **Tipo:** Mejora · **Prior.:** Baja · **Valor:** Medio · **Esfuerzo:** XS · **Estado:** Identificado · **Decisión:** En evaluación.

### BM-B24 — Categoría "Sin Término"
- **Descripción:** categoría/alerta para solicitudes sin plazo legal (felicitaciones, invitaciones a eventos, etc.).
- **Fuente:** M-GSC-004 (pág. 5, alerta "Sin término"). **Módulo:** tiempos/bandejas. **Tipo:** Mejora · **Prior.:** Media · **Valor:** Medio · **Esfuerzo:** S · **Estado:** Pend. validar · **Decisión:** Requiere validación normativa.

### BM-B25 — Alerta/bandeja "Prioridad" (entes de control)
- **Descripción:** bandeja/alerta de solicitudes provenientes de entes de control, priorizadas.
- **Fuente:** M-GSC-004 (pág. 5, alerta "Prioridad"). **Módulo:** priorización/bandejas. **Tipo:** Mejora · **Prior.:** Media-Alta · **Valor:** Alto · **Esfuerzo:** S-M · **Estado:** Identificado · **Decisión:** En evaluación.

### BM-B26 — Bandeja de "Devueltas"
- **Descripción:** bandeja de solicitudes devueltas por no competencia u otro motivo, pendientes de reasignación/solución.
- **Fuente:** M-GSC-004 (pág. 5, alerta "Devueltas"). **Tipo:** Mejora · **Prior.:** Media · **Valor:** Medio · **Esfuerzo:** S · **Estado:** Identificado · **Decisión:** En evaluación.

### BM-B27 — Registro del medio de radicado
- **Descripción:** registrar el medio por el que ingresó (Oficio, Web, Email, Teléfono). Verificar si ya lo cubre `medioRecepcion`.
- **Fuente:** M-GSC-004 (punto 10). **Tipo:** Mejora · **Prior.:** Baja · **Valor:** Bajo · **Esfuerzo:** XS · **Estado:** Pend. validar · **Decisión:** En evaluación.

### BM-B28 — Ayuda in-app (video tutoriales + infografía)
- **Descripción:** sección de ayuda con video tutoriales e infografías del flujo.
- **Fuente:** M-GSC-004 (§8.2). **Tipo:** Nueva func. · **Prior.:** Baja · **Valor:** Medio · **Esfuerzo:** M · **Estado:** Identificado · **Decisión:** En evaluación.

### BM-B29 — Pestaña "Observaciones/novedades" en el detalle
- **Descripción:** pestaña para registrar novedades, comentarios, anotaciones u observaciones sobre la solicitud.
- **Fuente:** M-GSC-004 (§8.1.3 pestaña 4). **Tipo:** Mejora · **Prior.:** Media · **Valor:** Medio · **Esfuerzo:** S · **Estado:** Identificado · **Decisión:** En evaluación. **Observaciones:** verificar si la "historia del caso" ya lo cubre parcialmente.

---

## Detalle — Benchmarking procedimientos + planilla (BM-B01..B13)
Ver descripción completa en el histórico de este archivo (commit 2d12771) y en la
Matriz de Cobertura. Campos de valor/esfuerzo/decisión reflejados en el índice.
Resumen de origen: P-GSC-170-001/014/007 y la planilla F-GSC-238-37-001.

## Detalle — Deuda del Bloque 2 (BM-D01..D10)
Fuente canónica: `docs/PLAN_BLOQUE3.md` (D1–D10) y
`docs/auditorias/AUDITORIA_ARQUITECTONICA_2026-07-13.md`. No se re-describen para
evitar duplicación. Todos **Pospuestos a Bloque 3** salvo BM-D09 (cierre del
Bloque 2) y BM-D10 (branch protection, acción del propietario, **Aprobado**).

## Estado del análisis de fuentes
- **Leído en su totalidad** (vía `pymupdf`): P-GSC-170-001/014/007, M-GSC-002,
  M-GSC-004, planilla, y las 10 TRD (100, 101, 110, 111, 112, 120, 130, 140×2,
  150). **Ningún documento quedó sin analizar por limitaciones técnicas.**
- **Pendiente de detalle (no de lectura):** el desglose serie-por-serie de las
  TRD para BM-B02 se hará al scopear ese ítem (estructura confirmada: CÓDIGO /
  SERIE / SUBSERIE / TIPOLOGÍA / retención gestión-central / disposición
  CT-E-M-S, firmada por Secretaría General y Jefe de Archivo).
- **Por incorporar cuando llegue:** retroalimentación de la Alcaldía (reuniones).
