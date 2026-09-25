# Análisis de insumo — Consecutivo de licencias de Planeación (2022–2026)

**Fecha:** 2026-08-06 · **Estado:** Insumo de arquitectura para el módulo de licencias / motor de expedientes (NO es un ADR; las decisiones definitivas se registrarán en el ADR de Fase 2 cuando se levante el bloqueo jurídico)
**Revisión:** arquitecto-principal, 6-ago-2026 — APROBADO CON CAMBIOS; los 9 cambios requeridos y 4 opcionales están aplicados en esta versión
**Fuente:** `CONSECUTIVO LICENCIAS Simacota Santander.xlsx` (archivo operativo del ingeniero de Planeación, compartido por el propietario el 6-ago-2026)
**Método:** extracción programática (openpyxl) sobre las 4 hojas; todo hecho citado es verificable contra el archivo
**Relación:** ADR-0026 (motor genérico, D1–D9 y principios A3), `docs/blueprints/CN-modulo-planeacion-licencias.md`, `docs/planes/PLAN_FASES_MOTOR_EXPEDIENTES.md`, gate de régimen de subsanación (6-ago-2026)

**Regla de este documento:** se separan estrictamente **Hechos** (observados en el archivo), **Inferencias** (interpretación con nivel de confianza y vía de confirmación) y **Recomendaciones** (propuestas de decisión). Ninguna regla de negocio se da por cierta sin evidencia: lo no respaldado queda como pregunta a Planeación o a Jurídica. Solo se documenta lo que impacta diseño o migración.

---

## 1. Hechos observados (H)

| # | Hecho | Evidencia |
|---|-------|-----------|
| H1 | El archivo tiene 4 hojas: `2026`, `2025`, `CONSECUTIVO` (2022–2024) y `Consecutivo licencias 2022` (liquidación de impuestos). Columnas de las hojas anuales: fecha solicitud, fecha resolución, No. radicado, propietario/solicitante, tipo de licencia, No. de licencia, dirección, barrio/vereda, área, matrícula, estado del proceso, correcciones. | Estructura de hojas y encabezados |
| H2 | 202 registros con radicado (201 radicados únicos): 2022:49 · 2023:44 · 2024:39 · 2025:51 filas (50 únicos) · 2026:19 (al 6-ago). | Conteo por hoja |
| H3 | El 100 % de los radicados cumple el patrón `68745-0-AA-CCCC` (año 2 dígitos + consecutivo 4 dígitos). Las series anuales son **continuas: arrancan en 0001 y no tienen huecos** en ningún año. | Validación regex + verificación de huecos |
| H4 | El radicado `68745-0-25-0037` está **duplicado**: asignado a dos solicitantes distintos (17-sep-2025 y 30-sep-2025, modalidades LA y LR). Es la única colisión del archivo. | Hoja `2025`, dos filas con el mismo radicado |
| H5 | **Fecha de resolución: vacía en 202/202 registros.** No. de licencia: lleno en 1/202 (`002-2025`, formato distinto al del radicado). | Conteo de llenado |
| H6 | Estado del proceso: **solo existe en las hojas 2025/2026** (la hoja 2022–2024, ~132 registros, no tiene la columna). 4 literales que son 2 valores semánticos — `REVISADO/revisado` (32) y `TERMINADO/terminada` (38). Ningún estado intermedio. | Valores únicos de la columna |
| H7 | Columna CORRECCIONES: 3 marcas (`X`/`x`), todas en 2025. | Valores únicos de la columna |
| H8 | Tipos de licencia registrados — simples: LSR:83, LC:60, LSU:15, PH:11, LR:10, LA:8, LU:2, LCR VISR:1, LRC:1. **Combinados** (11 registros): `LC y PH` ×2, `LA, PH` ×2, `LC, A` ×3, `LR y LC,A` ×2 (variantes de espaciado), `LC, PH y LSU` ×1, `LR, PH` ×1. | Conteo de la columna tipo |
| H9 | La hoja de impuestos 2022 lleva **otra numeración, por modalidad** (`LSR 2,022-001`, `LSR 2,022-002`, `LSU 2,022-001`, `PH 2,022-001`) y campos que las hojas anuales no tienen: cédula catastral, escritura pública, C.C./NIT, estrato, uso del suelo, **fecha de expedición y fecha de vencimiento** (las 4 filas muestran vencimiento ≈ 6 meses tras expedición). | Hoja `Consecutivo licencias 2022` |
| H10 | Calidad de datos: fecha de solicitud como texto inválido `27/01/20206` (hoja 2026, fila 3); fechas de solicitud ausentes en algunos registros (p. ej. `68745-0-26-0003`); casing y espaciado inconsistentes en modalidades y estados. | Celdas citadas |

## 2. Inferencias (I) — interpretación, NO hechos

| # | Inferencia | Base | Confianza | Confirmación |
|---|-----------|------|-----------|--------------|
| I1 | El patrón del radicado es el formato estándar nacional de radicación de licencias urbanísticas: `68745` = código DANE de Simacota, `0` = municipio sin curaduría (Planeación ejerce la función), serie anual de 4 dígitos. | H3 + convención nacional conocida | Alta | Jurídica/Planeación citan la referencia normativa exacta del formato antes del ADR de Fase 2 |
| I2 | Los códigos corresponden a tipos/modalidades del régimen D.1077 y afines: LC=construcción, LSR/LSU=subdivisión rural/urbana, LU=urbanización, LR=reconocimiento de edificación, PH=aprobación de planos de propiedad horizontal (Ley 675/2001), LA=¿ampliación?, `LC, A`=¿construcción en modalidad ampliación?, LCR VISR=¿reconocimiento VIS rural?, LRC=¿variante de LR/LCR? | H8 | Media (alta en LC/LSR/LSU/LU/LR; baja en LA, LCR VISR, LRC) | P1 |
| I3 | La marca `X` en CORRECCIONES señala que hubo proceso de observaciones/corrección (el equivalente práctico del acta de observaciones del D.1077). | H7 | Media | P7 |
| I4 | La vigencia ≈6 meses de la hoja de impuestos es consistente con la vigencia de licencias de subdivisión del D.1077. | H9 | Media | P8 |
| I5 | El acto final (la licencia/resolución) se numera en serie(s) **aparte** del radicado, aparentemente por modalidad y año (`002-2025`, `LSR 2,022-001`). | H5 + H9 | Media | P3, P5 |
| I6 | Este Excel es el registro operativo vivo y probablemente la única fuente digital del consecutivo; el expediente completo existe solo en físico. | H2 (serie 2026 activa) | Media | P9 |
| I7 | `REVISADO` ≈ en trámite (revisión hecha, sin acto final); `TERMINADO` ≈ concluido. No hay evidencia de qué pasa entre ambos. | H6 | Baja-media | P4 |

## 3. Requisitos funcionales del motor derivados (RF)

Cada RF trazado a su evidencia y a la **fase del plan** (`PLAN_FASES_MOTOR_EXPEDIENTES.md`) donde se implementa: las series son Fase 1–2, el intake Fase 2, panel Fase 3, resolución Fase 4 y **la migración es Fase 5** (tras motor estable) — este documento no propone re-alcanzar fases. Los RF no crean reglas jurídicas; donde el fondo es normativo, dependen de la ratificación de Jurídica (⚖️).

| # | Requisito | Traza | Fase |
|---|-----------|-------|------|
| RF-1 | El motor debe soportar la **serie de consecutivo legal de expedientes**, independiente del consecutivo de ventanilla (`1-110-AAAAMM-…`), con reinicio anual y continuidad institucional: al go-live la serie del año en curso **continúa desde el último número real** (hoy `26-0019`), nunca reinicia. Se implementa **sobre el mecanismo D9 existente** (ver §6), no como mecanismo paralelo. | H2, H3, I1; mismo principio de continuidad ya decidido para el formato legado de ventanilla | 1–2 |
| RF-2 | La **emisión del consecutivo debe ser transaccional y a prueba de colisiones** (el duplicado H4 es la falla real a eliminar), con el guard anti-avance por reconstruidos. **Estado real del guard:** `verificarAvanceCounter` existe y está testeado, pero **aún no está cableado** a `confirmarConsecutivosLegales` (deuda #7, ADR-0026 §A2); cablearlo y verificarlo es precondición del ADR-0026 antes de abrir la serie de expedientes. | H4 | 1–2 |
| RF-3 | Una solicitud puede pedir **varias licencias/modalidades a la vez** (11/202 casos combinados). El modelo no puede asumir 1 solicitud = 1 modalidad. | H8 | 2 |
| RF-4 | ⚖️ Registro del proceso de **observaciones/correcciones** con su efecto sobre el término (acta que suspende, según blueprint CN §A.4) — ya modelado en `RegimenSubsanacion`/`Observacion` del motor Fase 0; **bloqueado por el gate de régimen hasta ratificación de Jurídica**. | H7, I3, gate 6-ago-2026 | 2–3 |
| RF-5 | Registro obligatorio del **acto final** (número de licencia/resolución + fecha) como parte del cierre del expediente: hoy es el dato más ausente del proceso real (H5) y sin él no hay vigencias ni trazabilidad del acto. | H5, H9 | 4 |
| RF-6 | **Vista "libro consecutivo" exportable** (por año, con las columnas que el ingeniero usa hoy): la plataforma debe reemplazar el Excel sin quitarle a Planeación su herramienta de trabajo — condición de adopción. | H1, I6 | 3+ |
| RF-7 | **Migración de los 202 registros históricos (201 radicados únicos) como expedientes RECONSTRUIDOS** (D6): con marca de origen, sin falsear historia no evidenciada y **sin avanzar los contadores de series reales**. | H2, H4, H5, H6 | 5 |
| RF-8 | Captura estructurada de datos del **predio** (dirección, barrio/vereda, matrícula inmobiliaria, área; opcionales: cédula catastral, escritura, estrato, uso del suelo) — hoy dispersos y de calidad irregular. Se modela como dato declarado por la Definición de Trámite, no en el núcleo (ver §6). | H1, H9, H10 | 2 |
| RF-9 | Registro de **vigencia del acto** (expedición + vencimiento) parametrizada por tipo de licencia. ⚖️ Los plazos concretos de vigencia requieren ratificación normativa. | H9, I4 | 4 |

## 4. Reglas de negocio requeridas (RN) — con su estado de respaldo

| # | Regla | Estado |
|---|-------|--------|
| RN-1 | Formato del número de expediente de licencias `{dane}-{curaduria}-{AA}-{CCCC}` (Simacota: `68745-0-…`), serie anual continua desde 0001 (o desde el número vigente en el año de arranque). El prefijo se deriva del tenant, no se escribe literal. | Respaldada por evidencia (H3); referencia normativa del formato pendiente (I1) |
| RN-2 | Unicidad estricta del consecutivo **solo para expedientes de origen REAL**; los RECONSTRUIDOS conservan su número histórico como atributo aun si colisiona (caso H4), con marca de colisión. | Decisión técnica propuesta (ver R1); no requiere ratificación jurídica |
| RN-3 | Catálogo de **subtipos de trámite como dato** (mecanismo genérico del motor, instanciado para las modalidades de licencia), con tabla de equivalencias para migrar los códigos históricos (incl. anomalías `LCR VISR`, `LRC` y combinados). | Requiere validación de Planeación (P1, P2) |
| RN-4 | Máquina de estados del ciclo D.1077 (la del blueprint CN §5) con **mapeo conservador** desde el binario histórico REVISADO/TERMINADO. Nota: "cerrado" no existe en el `EstadoExpediente` de Fase 0 — `ARCHIVADO` es lo más cercano; el mapeo definitivo depende de la máquina de estados de Fase 1/3. | Estados del blueprint pendientes de reconciliación (blueprint §A) + P4 |
| RN-5 | ⚖️ Correcciones = acta de observaciones D.1077: suspende el término, procede una sola vez, 30 días hábiles + 15 de prórroga. | **BLOQUEADA hasta ratificación ESCRITA de Jurídica.** ⚠️ **Alerta de contradicción (6-ago-2026):** el insumo VERBAL de Jurídica reporta que ante subsanación el término "se **reinicia a cero**" y sin tope de reinicios — incompatible con el modelo de **suspensión** (30+15) del D.1077 que el blueprint y estos placeholders asumen. NO se ratifica RN-5 con insumo verbal: se exige el concepto escrito que resuelva suspensión vs. reinicio; mientras tanto el gate de régimen permanece. (Del mismo insumo verbal, sin contradicción: 45 días **hábiles** — coincide con el catálogo — y competencia del Secretario/Subsecretario de Planeación sin Alcalde. Respuesta sobre silencio positivo pendiente de transcripción.) |
| RN-6 | ⚖️ El término legal (45 días hábiles) ancla en la **radicación en legal y debida forma**, no en la recepción material. | Decisión de fondo #1 del blueprint CN §A — pendiente de reconciliación con propietario/Planeación |
| RN-7 | Numeración del **acto final** en serie separada del número de expediente (si I5 se confirma: por modalidad y año). | NO asumir aún — depende de P3/P5 |

## 5. Preguntas pendientes para Planeación (P) — antes de implementar Fase 2

Bloqueantes para el diseño de datos: P1, P2, P3, P4. Bloqueantes para la migración (Fase 5): P5, P6, P7, P9. Contextuales: P8, P10.

1. **P1 — Códigos:** significado exacto y lista completa de tipos usados (en especial `LA`, `LU`, `LCR VISR`, `LRC`); ¿corresponden a los tipos/modalidades del D.1077 tal como los maneja el municipio?
2. **P2 — Combinados:** una solicitud combinada (`LC y PH`) ¿es un expediente con una resolución, o varios expedientes/resoluciones? ¿Cómo se numera y liquida?
3. **P3 — Series paralelas:** ¿el acto final se numera aparte del radicado (p. ej. `002-2025`, `LSR 2,022-001`)? ¿Qué serie(s) hay que continuar en la plataforma?
4. **P4 — Estados reales:** ¿qué hitos existen entre la solicitud y "terminado" (¿acta de observaciones, viabilidad, visita, desistimiento, negación?)? ¿Qué significa exactamente `REVISADO`? ¿Y qué estado tienen los ~132 registros 2022–2024 que no llevan columna de estado?
5. **P5 — Actos finales:** las fechas de resolución y números de licencia no están en el Excel (H5): ¿dónde se registran hoy (libro de resoluciones físico)? ¿Existe fuente para reconstruirlos?
6. **P6 — Duplicado `25-0037`:** ¿a cuál de los dos solicitantes corresponde el expediente físico con ese número, y cómo quedó numerado el otro?
7. **P7 — Correcciones:** la marca `X` ¿corresponde a un acta de observaciones formal notificada (con suspensión de término) o a una devolución informal?
8. **P8 — Vigencias:** ¿confirma las vigencias por tipo (los 4 casos de 2022 sugieren 6 meses en subdivisión)?
9. **P9 — Fuente única:** ¿el Excel es el único registro digital? ¿Los expedientes 2022–2026 están completos en físico? ¿La liquidación de impuestos (hoja 2022) se maneja aparte y debe integrarse?
10. **P10 — Canal de entrada:** ¿cuántas solicitudes entran por ventanilla vs. directo en Planeación? (dimensiona el handoff D2 radicado⇄expediente).

## 6. Modelo de datos propuesto (conceptual — sin depender del Excel)

Extiende los contratos de Fase 0 del motor (`lib/motor-expedientes/tipos.ts`) respetando los principios A3 del ADR-0026 (**nada específico de un trámite entra al núcleo genérico**). El diseño físico Firestore es de Fase 1 con revisión del especialista de datos y Seguridad (D3/D7/D8) — aquí solo entidades y relaciones que la evidencia exige.

**Serie de expedientes — sobre el mecanismo D9 existente (RF-1/RF-2).** NO se propone un mecanismo de series nuevo: la serie de expedientes entra como **extensión del enum cerrado `SerieConsecutivo`** (`lib/server/consecutivo-legal.ts`, extensión no-breaking ya prevista por D9), con contador en el patrón vigente `counters/{serie}-{año}` (el reinicio anual es estructural, no un campo) y **formateador en código** que deriva el prefijo del tenant (`{dane}-{curaduria}` — para Simacota `68745-0`). El formato legal NO es dato libremente editable: mismo razonamiento con que D1 descartó el workflow configurable (un administrador no debe poder configurar algo ilegal); cualquier cambio de formato pasa por código versionado. Lo que sí es documento complementario de **metadatos de la serie**: `origenSemilla` (número y fuente con que arrancó — "continúa Excel de Planeación, último real 26-0019 al corte") y la referencia normativa del formato (I1). Si el ADR de Fase 2 concluyera que se necesitan series data-driven, eso **enmienda D9 y exige ADR explícito** — este documento no lo propone. La serie del acto final (RN-7) queda abierta sin comprometerse hasta P3.

**Catálogo de subtipos de trámite** (mecanismo genérico del motor, dato — RF-3/RN-3). La Definición de Trámite (D4) declara sus subtipos: `codigo` (`LC`, `LSR`, …), `nombre`, `fundamento`, `vigenciaActo?` (⚖️ pendiente), `activo`. Se instancia para licencias sin bautizar el mecanismo como exclusivo de ellas. Para la migración: tabla `EquivalenciaMigracion` (`textoHistorico → codigo[]`) que cubre casing, espacios, combinados y anomalías; lo no mapeable va a cuarentena, no se adivina.

**Expediente** (extensiones ADITIVAS a la entidad Fase 0, cumpliendo A3.2/A3.3):
- `numeroExpediente: {numero, serieId, año, colision?: boolean}` — **nombre canónico** (ver §10); el id del documento es sintético y el número legal es atributo. Unicidad estricta solo para origen REAL (RN-2).
- `subtipos: string[]` (≥1, códigos del catálogo de su Definición) — soporta combinados (RF-3) sin decidir P2: si P2 dice "expedientes separados", el array tendrá 1 elemento. Sin estado por subtipo: ninguna evidencia lo respalda (H6 muestra un estado por solicitud).
- `actoFinal?: {numero?, fecha?, vigenciaHasta?, cierreDesconocido?: boolean}` (RF-5/RF-9; `cierreDesconocido` es la marca honesta para los históricos H5).
- `origen: REAL | RECONSTRUIDO` + `provenance?: {fuente, fechaImportacion, filaOrigen}` (RF-7, D6 — hoy `OrigenActuacion` existe solo en `Actuacion`; llevarlo al expediente es extensión aditiva a decidir en Fase 1).
- Los datos del **predio** (RF-8) NO entran al núcleo: se modelan con el patrón ya existente de datos declarados por la Definición (`contexto`/`clavesContexto`) o como extensión por trámite; si Fase 1 quisiera promoverlos al núcleo, sería excepción arquitectónica vía ADR (A3.4).

**Actuacion / Observacion** — ya existen en Fase 0; la migración crea como máximo: 1 actuación de radicación (fecha de solicitud), 1 observación reconstruida si CORRECCIONES=X, y 1 actuación de cierre solo si el estado histórico fue TERMINADO (sin fecha: `cierreDesconocido`). **Nota de contrato:** `Observacion.resuelta` es `boolean` en Fase 0 — el desenlace desconocido de una observación histórica NO es representable hoy; se propone crearla con `resuelta: false` + marca aditiva de desenlace desconocido en la provenance de migración, declarándolo como extensión de contrato a decidir en Fase 1 (no se asume un tri-estado que no existe).

**Lo que este modelo deliberadamente NO incluye** (sin evidencia o bloqueado): plazos/suspensiones de correcciones (⚖️ RN-5), serie del acto final (P3), liquidación de impuestos (P9), estados intermedios más allá del blueprint (P4), estados por subtipo (P2).

## 7. Riesgos de migración y mitigación (R) — Fase 5

| # | Riesgo | Evidencia | Impacto | Mitigación |
|---|--------|-----------|---------|------------|
| R1 | Radicado duplicado `25-0037` (dos solicitantes) | H4 | Una restricción de unicidad ingenua haría fallar la importación o pisaría un expediente | Id sintético + número legal como atributo; **se importan las dos filas** con `colision: true`; resolución humana vía P6; **no renumerar** (la serie legal histórica es intocable) |
| R2 | Fechas inválidas o ausentes (`27/01/20206`, solicitudes sin fecha) | H10 | Términos/orden cronológico corruptos | Parser estricto con **cuarentena**: fila inválida no se importa silenciosamente; reporte de excepciones para corrección manual con el ingeniero |
| R3 | Cierres desconocidos: 0/202 fechas de resolución, 1/202 números de licencia | H5 | Tentación de "completar" datos → falsear historia (violaría D6) | `cierreDesconocido: true`; nunca calcular vencimientos ni vigencias retroactivas; completar solo si P5 aporta fuente real |
| R4 | Estados binarios sin historia intermedia (2025–2026) | H6 | Reconstruir un ciclo de vida que no consta | Mapeo conservador (REVISADO→estado en trámite, TERMINADO→cerrado, con la salvedad RN-4 sobre `ARCHIVADO`) definido con P4; las actuaciones reconstruidas se limitan a lo evidenciado (§6) |
| R5 | Series paralelas radicado vs. acto final | H9, I5 | Continuar la serie equivocada al emitir la primera licencia real | No emitir actos finales numerados hasta resolver P3; la serie del acto final se añade después como extensión D9 si procede |
| R6 | Modalidades no normalizadas (variantes, combinados, `LCR VISR`) | H8, H10 | Clasificación errónea de expedientes históricos | Tabla de equivalencias validada por Planeación (RN-3); no mapeable → cuarentena |
| R7 | El Excel sigue vivo durante la transición | I6 | Doble registro / huecos entre corte y go-live | Fecha de corte acordada + congelamiento del Excel + **conteo de reconciliación** (202 filas del Excel = expedientes importados + cuarentena, cuadre exacto; 201 números únicos + 1 colisión) |
| R8 | Datos personales (nombres, cédulas/NIT, direcciones) en la migración | H1, H9 | Ley 1581: tratamiento sin finalidad/minimización | Importar solo campos necesarios para el expediente; la hoja de impuestos NO entra en la migración (su destino se decide con P9); acceso por rol ya existente en la plataforma |
| R9 | **Cohorte 2022–2024 sin columna de estado** (~132 registros) | H6 | Si se importan "abiertos" por defecto, inundan bandeja y semáforo con falsos vencidos — y en licencias un "vencido" sugiere **silencio administrativo positivo**: ruido de riesgo jurídico máximo | Regla de mapeo propia para la cohorte (decidir con P4/P5, probablemente "cerrado histórico salvo evidencia en contra") + **exclusión explícita de TODOS los RECONSTRUIDOS del semáforo de términos y de las alertas de silencio positivo** |
| R10 | **Siembra del contador al corte sin doctrina**: escribir el último número real en el counter no es emisión REAL ni importación RECONSTRUIDA (que el guard debe rechazar) | RF-1, H2 | Sembrado informal → contador fantasma o serie que reinicia en 0001 | Operación **one-off, autorizada y trazada** (protocolo autorización→ejecución del proyecto), definida frente a `verificarAvanceCounter` — que hoy **no está cableado** (deuda #7 ADR-0026 §A2) — y frente al detector de contadores fantasma, que aún no cubre la serie de expedientes (deuda #12) |

## 8. Recomendaciones (REC) — priorizadas

1. **REC-1 (antes de codear):** sesión corta con el ingeniero de Planeación para P1–P7 y P9 — mismo patrón ya validado con la funcionaria de ventanilla. Sin P1–P4 no se congela el modelo de datos.
2. **REC-2:** adoptar id sintético + `numeroExpediente` como atributo con unicidad condicionada a origen REAL (resuelve R1 sin renumerar historia).
3. **REC-3:** semilla de series al go-live = último número real del Excel al corte, con `origenSemilla` documentado y la **doctrina de siembra de R10** (one-off autorizada, guard cableado antes — precondición ADR-0026).
4. **REC-4:** subtipos y equivalencias como dato versionado (RN-3), nunca enum de trámite — coherente con D4/D9 ("crear un documento, sin desplegar"); el mecanismo de series NO se duplica (extensión del enum D9 existente, §6).
5. **REC-5:** migración con cuarentena y **conteo de reconciliación 202 importados / 201 únicos / 1 colisión** como criterio de aceptación automatizable (criterio de éxito v2: evidencia, no confianza).
6. **REC-6:** incluir el libro consecutivo exportable (RF-6) en el alcance mínimo del panel — es la condición práctica de adopción y de retiro del Excel.
7. **REC-7:** registrar las decisiones que resuelvan P1–P10 y RN-5/RN-6/RN-7 en el ADR de Fase 2; este documento queda como su anexo de evidencia.

## 9. Trazabilidad y precondiciones

- **Gate de régimen de subsanación (6-ago-2026):** H7/I3 confirman que el proceso de correcciones de licencias existe en la práctica — el bloqueo del requerimiento Ley 1755 sobre licencias ataca un riesgo real. RN-5 sigue bloqueada por la misma precondición jurídica.
- **ADR-0026:** D4 (checklist como dato) ← RN-3; D5 (régimen parametrizado) ← RN-5; D6 (reconstruidos, nunca falsear) ← RF-7/R3/R4; D9 (series por extensión del enum + `verificarAvanceCounter`) ← RF-1/RF-2/R10; A3.2/A3.3 (núcleo genérico) ← §6.
- **Blueprint CN-modulo-planeacion-licencias:** §2 (`numeroExpediente`) ← §10; §A.1 (hito de radicación) ← RN-6; §A.4 (base legal de subsanación) ← RN-5; §5 (máquina de estados) ← RN-4/P4.
- **Precondiciones del ADR-0026 que gobiernan la implementación** (no solo el diseño): (1) ratificación de Jurídica de los valores D.1077 — bloquea RF-4/RN-5/RN-6/RF-9; (2) checklist completo del trámite; (3) validación con Planeación — cubierta por REC-1/P1–P10; (4) **guard de counters (`verificarAvanceCounter`) cableado y verificado antes de abrir la serie de expedientes** — bloquea RF-1/RF-2/R10. Las series, subtipos y el diseño de migración son **diseñables en paralelo** al bloqueo jurídico; su implementación respeta las 4 precondiciones.

## 10. Glosario de numeraciones (reconciliación de nombres)

| Término canónico | Qué numera | Formato | Fuente del nombre |
|---|---|---|---|
| `radicado` | Correspondencia de ventanilla (entrada/salida) | `1-110-AAAAMM-8díg` (serie AGN anual) | Plataforma en producción |
| `numeroExpediente` | El expediente del trámite (la "radicación de entrada" de licencias) | `{dane}-{curaduria}-{AA}-{CCCC}` (Simacota: `68745-0-…`) | Blueprint CN §2 — **se adopta como canónico**; el nombre `radicadoLegal` usado en borradores de este análisis queda **descartado** por colisionar semánticamente con `radicado` |
| *(sin nombre aún)* | El acto final (licencia/resolución) | `002-2025` / `LSR 2,022-001` (H9, I5) | Pendiente P3 — no se bautiza hasta confirmar que la serie existe y cuál es |
