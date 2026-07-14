# Backlog Maestro — Plan Maestro de Evolución de la Plataforma

**Único inventario oficial de trabajo futuro** (ADR-0017), elevado a **Plan
Maestro de Evolución** (ADR-0019): cada iniciativa lleva justificación
**funcional, técnica, normativa y estratégica**. Vivo: se actualiza en cada
análisis, sin duplicados, con trazabilidad de origen. **Ningún ítem pasa a
desarrollo sin autorización explícita del propietario.**

**Regla de arquitectura permanente (ADR-0019):** ninguna funcionalidad se propone
solo porque exista en el software de referencia. Toda propuesta se justifica por
≥1 criterio: **J1** obligación legal/normativa · **J2** necesidad operativa ·
**J3** mejora medible para el ciudadano · **J4** reducción de carga administrativa ·
**J5** innovación institucional.

**Campos:** id · título · descripción · fuente · evidencia · módulo · **tipo**
(Corrección | Mejora | Nueva funcionalidad | Deuda técnica | Riesgo) ·
**prioridad** (Crítica | Alta | Media | Baja) · impacto funcional · impacto
técnico · dependencias · **complejidad/esfuerzo** (XS/S/M/L/XL, juicio sin
métrica — Principio 13) · **valor** (Muy Alto | Alto | Medio | Bajo) ·
**estado** (Identificado | Pendiente de validar | Validado | Aprobado para
desarrollo | Diferido | Descartado | Implementado) · **decisión** (En evaluación
| Aprobado | Pospuesto | Rechazado | Requiere validación normativa) · bloque ·
observaciones · **(ADR-0018)** **naturaleza** (Norma | Buena práctica | Operativa
| UX | Innovación) y la **compuerta de dos preguntas** antes de proponer
desarrollo: **(P1)** ¿existe ya algo equivalente en nuestra plataforma? · **(P2)**
¿hay una forma más simple sin copiar el software de referencia?

## Análisis del Arquitecto Funcional (ADR-0018) — hacia una plataforma superior

**No replicamos el software de referencia; lo superamos.** Síntesis comparativa
del corpus analizado (GSC de Bucaramanga = app legada de PQRSD/correspondencia).

**A. Lo que el software actual hace mejor que nosotros (a incorporar/adaptar):**
módulo de **Comunicaciones Internas** completo (BM-B20/B21/B22), **circuito de
firma** con corregir/firmar y catálogo de firmantes (BM-B23/B31), **admin de
planillas** con anular/reimprimir/registrar-entrega (BM-B18), bandejas de
**Prioridad/Sin-Término/Devueltas** (BM-B25/B24/B26), **correo interno de
asignación** (BM-B17), radicado **pre-generado externo** (BM-B14), catálogo de
tipos más amplio (BM-B16), ayuda in-app (BM-B28).

**B. Lo que nosotros hacemos mejor (nuestra ventaja — preservar y explotar):**
**IA SIMI** (copiloto, alertas predictivas de vencimiento, clasificación,
patrones de control interno) — el referente no tiene IA; **radicación dirigida**
(destino desde el nacimiento); **seguridad moderna** (identidad reservada
enmascarada transversal, consulta pública con token hasheado + timing-safe,
aislamiento por tenant probado); **integridad del consecutivo** (H3 atómico con
control de regresión por mutación); **gobernanza técnica** (observabilidad,
presupuesto de rendimiento, compuerta de despliegue, ADRs); **panel operativo**
(semáforos MIPG, KPIs). El referente es una app legada; nosotros, plataforma
moderna multi-tenant.

**C. Oportunidades de simplificar (resolver el problema, no copiar la UI):**
- Un **único flujo de radicación** (el referente tiene dos: "Radicar" y "Generar
  Radicado") → evitar esa dualidad.
- **IA que sugiere la serie TRD y la dependencia** (en vez de selección manual)
  — *IA sugiere, funcionario decide*. Simplifica BM-B02 + asignación.
- **Un solo circuito de firma unificado** (SIMI + comunicaciones internas +
  salidas) en vez de flujos separados → simplifica BM-B23.
- **Bandejas inteligentes por IA** en vez de 6 alertas manuales fijas.
- **Formato de radicado consistente y único** (cierra la inconsistencia BM-B01).

**D. Innovaciones que ninguno de los dos tiene (valor agregado propuesto):**
- **Clasificación TRD asistida por IA + retención/disposición automática** (SGDEA
  inteligente) — Innovación + Norma.
- **Detección de patrones** (reincidencia, devoluciones acumuladas) ya iniciada
  en SIMI → extender a alertas proactivas de riesgo.
- **Consulta pública en lenguaje claro con asistente IA** para el ciudadano.
- **Trazabilidad criptográfica** del expediente (hash de cadena de custodia).
- **Interoperabilidad GOV.CO / Carpeta Ciudadana** (visión referente nacional).
- **Tablero predictivo de cumplimiento** (proyección de vencimientos y carga).

**Naturaleza de los ítems (obligación vs. valor):**
- **Norma (obligatorias):** BM-B02 (AGN/SGDEA), BM-B01 (AGN 060 numeración),
  BM-B05 (Ley 1755 24h), BM-B10 (atención preferencial), BM-B12 (Dcto 396),
  BM-B16 (tipos Ley 1755), BM-B03 (imagen fiel AGN), BM-D09 (subsanación art.5),
  BM-D03/D04/D05 (protección de datos / integridad).
- **Buena práctica:** BM-B18, BM-B23, BM-B31, BM-B06/B07 (custodia), BM-B08/B09.
- **Operativa (Simacota):** BM-B20, BM-B17, BM-B25, BM-B26, BM-B19, BM-B11.
- **UX:** BM-B28, BM-B29, BM-B04.
- **Innovación (nuestra):** las de §D + IA transversal.

**Compuerta de dos preguntas** — se responde en el scoping de cada ítem antes de
proponerlo a desarrollo (P1 equivalente existente / P2 forma más simple). Se
registra en el ítem. Ejemplos ya resueltos: BM-B23 (P1: sí, existe firma SIMI →
unificar, no duplicar); BM-B02 (P2: IA sugiere la serie en vez de captura manual).

## E. Automatizar — Transformación institucional (ADR-0019)

*¿Cómo hacer cada proceso mejor, más simple, más automático y más útil?* Análisis
por proceso: **M**=manual hoy · **→IA**=SIMI/IA como apoyo (sugiere, funcionario
decide) · **✋**=aprobación humana obligatoria (legal/control) · **⟳**=precarga
automática · **✕**=tarea repetitiva que desaparece.

| Proceso | Hoy manual (M) | Automatizable (→IA / ⟳ / ✕) | Aprobación humana (✋) |
|---|---|---|---|
| **Radicación** | captura de datos, tipo, dependencia, folios | →IA clasifica tipo + **serie TRD** + sugiere dependencia; ⟳ solicitante frecuente por cédula; ⟳ término legal (ya); OCR del escaneo extrae asunto/remitente (✕ tecleo) | ✋ el acto de radicar (número legal) |
| **Asignación/reasignación** | búsqueda de dependencia competente | →IA sugiere dependencia; ✕ enrutamiento manual; ⟳ correo interno de asignación (BM-B17) | ✋ la asignación/reasignación (Ley 1755) |
| **Respuesta** | redacción desde cero | →IA (SIMI copiloto) borrador; ✕ página en blanco | ✋ aprobación y **firma** (BM-B23) |
| **Vencimientos** | seguimiento manual | →IA alertas predictivas (ya) + proyección de carga | — |
| **Planilla** | selección, generación, control de entrega | ✕ detección de radicados sin planilla (BM-B19); generación PDF (ya); ⟳ datos de entrega | ✋ firma de recibido (custodia física) |
| **Comunicaciones internas** | consecutivo por dependencia, redacción | →IA borrador; ⟳ consecutivo por dependencia (BM-B21, ✕ búsqueda manual) | ✋ firmante autorizado (BM-B23/B31) |
| **Clasificación TRD** | selección manual de serie | →IA sugiere serie/subserie + retención/disposición | ✋ validación del funcionario/archivo |
| **Contingencia** | registro físico + radicado diferido | ✕ cola de radicación diferida; ⟳ aviso al ciudadano al restablecer (BM-B08) | ✋ verificación al restablecer |
| **Reportes/informes** | consolidación | →IA generación (MIPG ya) + tablero predictivo | — |

**Norte (criterio de éxito v2):** cada iniciativa debe **reducir trabajo manual**
y **aumentar la autonomía** del sistema **sin** sustituir la decisión
administrativa/jurídica (IA sugiere / funcionario decide es invariante).

## Índice priorizable (impacto · costo · beneficio)

| ID | Título | Tipo | Prior. | Valor | Esfuerzo | Estado | Decisión | Bloque |
|---|---|---|---|---|---|---|---|---|
| BM-B20 | **Módulo de Comunicaciones Internas** (solicitud/respuesta/circular/informativo entre dependencias) | Nueva func. | Alta | Muy Alto | XL | Identificado | En evaluación | por definir |
| BM-B02 | Serie/subserie documental (TRD) en el radicado | Nueva func. | Alta | Muy Alto | L | Identificado | En evaluación | por definir |
| BM-B01 | Formato del número de radicado (AAAAMM vs año) | Corrección | Alta | Alto | M | Pend. validar | Requiere validación normativa | por definir |
| BM-B21 | Consecutivos por dependencia + serie propia de circulares | Nueva func. | Alta | Alto | L | Identificado | Requiere validación normativa | por definir |
| BM-B23 | Firmante y circuito de firma de comunicaciones internas (revisar/corregir/firmar; físico/electrónico) | Mejora | Media-Alta | Alto | M | Identificado | En evaluación | por definir |
| BM-B31 | Catálogo de cargos autorizados para firmar comunicaciones (G-GSC-170-003) | Nueva func. | Media | Alto | S | Identificado | Requiere validación normativa | por definir |
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

### BM-B23 — Firmante y circuito de firma de comunicaciones internas
- **Descripción:** seleccionar el jefe firmante y ejecutar el **circuito de firma**: la comunicación va a "Comunicaciones por firmar"; el firmante **revisa** y elige **CORREGIR** (comentario → vuelve al autor a MODIFICAR) o **FIRMAR**. Firma **electrónica** por el sistema, o **física** (imprimir → firmar → escanear el PDF firmado → cargar). Extiende el circuito que ya existe para respuestas SIMI.
- **Fuente:** M-GSC-004 (§8.1.4 punto 12) + **P-GSC-170-003** (flujograma págs 3–4). **Módulo:** comunicaciones internas / firma. **Tipo:** Mejora · **Prior.:** Media-Alta · **Valor:** Alto · **Esfuerzo:** M · **Estado:** Identificado · **Decisión:** En evaluación. **Dependencias:** BM-B20, BM-B31; circuito de firma existente.

### BM-B31 — Catálogo de cargos autorizados para firmar comunicaciones
- **Descripción:** catálogo/parametrización de los cargos autorizados a firmar comunicaciones internas y externas (quién puede firmar qué), base del circuito de firma.
- **Fuente:** P-GSC-170-003 (obs. 3, doc. de referencia G-GSC-8200-170-003). **Evidencia:** págs 1 y 3. **Módulo:** firma / gobernanza. **Tipo:** Nueva func. · **Prior.:** Media · **Valor:** Alto · **Esfuerzo:** S · **Estado:** Identificado · **Decisión:** Requiere validación normativa. **Dependencias:** BM-B23. **Observaciones:** el documento G-GSC-170-003 con los cargos concretos **no fue entregado** — pedirlo para el desarrollo.

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

## Estado del análisis de fuentes (verificación crítica de completitud)
- **Leído en su totalidad** (vía `pymupdf`): **4 procedimientos** P-GSC-170-001,
  **-003** (leído en esta ronda; faltaba), -007, -014; **2 manuales** M-GSC-002,
  M-GSC-004; planilla F-GSC-238-37-001; **8 TRD únicas** (100, 101, 110, 111,
  112, 120, 130, 140, 150 — "100 raíz" y "140 (1)" son **duplicados exactos**
  verificados por hash). **Ningún documento entregado quedó sin analizar.**
- **Pendiente de detalle (no de lectura):** desglose serie-por-serie de las TRD
  para BM-B02 al scopearlo (estructura confirmada: CÓDIGO / SERIE / SUBSERIE /
  TIPOLOGÍA / retención gestión-central / disposición CT-E-M-S, firmada por
  Secretaría General y Jefe de Archivo).
- **Documentos REFERENCIADOS en el corpus pero NO entregados** (obtenerlos para
  completar el panorama y afinar ítems):
  - **G-GSC-8200-170-003** Guía de cargos autorizados para firmar → **BM-B31/B23**.
  - **M-GSC-8200-170-003** Manual Gestión del Servicio.
  - **PO-GSC-8200-170-001** Política de PQRSD.
  - **P-GFP-3100-170-039** Clasificar PQRSD de Hacienda → BM-B11.
  - **NORMOGRAMA F-MC-1000-238,37-020** (normativa aplicable).
  - Formatos: F-GSC-238-37-002 (Solicitud PQRSD), -37-006 (planilla atención),
    -37-007 (control recepción), -37-017 (registro incidentes), -37-018
    (digiturno) → afinan BM-B08/B09/B10.
- **Por incorporar cuando llegue** (intake automático, ADR-0017): retroalimentación
  de la Alcaldía (reuniones), observaciones de funcionarios, y cualquier documento
  nuevo — se agregan a Backlog + Matriz sin duplicar, con trazabilidad de origen.
