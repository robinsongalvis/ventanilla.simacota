# Matriz P1–P10 — Licencias · actualizada con la investigación normativa (7-ago-2026)

**Estado:** 🟢 ACTUALIZADA CON INVESTIGACIÓN — fuente: `INVESTIGACION_NORMATIVA_LICENCIAS.md` (anexo probatorio, con artículos y niveles de certeza). El ingeniero de Planeación **aún no responde**: ninguna celda suya se inventó; lo que la norma resolvió se marca como tal, **nunca como "confirmado por Planeación"**.

**Clasificación:** `CONFIRMADO POR NORMA/DOCUMENTO` (congela modelo) · `DATO OPERATIVO PENDIENTE DEL INGENIERO` (práctica real de Planeación) · `HUECO JURÍDICO ⚖️` (solo el concepto escrito de Jurídica lo convierte en regla ejecutable).

## Resumen del estado por pregunta

| P | Estado tras la investigación | Ingeniero | Jurídica ⚖️ |
|---|---|---|---|
| P1 | **PARCIALMENTE RESUELTA** — mapa código→figura normativo completo | Solo `LA`, `LCR VISR`, `LRC` (significado local) | — |
| P2 | **RESUELTA POR NORMA** — 1 expediente, 1 acto, N subtipos | Liquidación de combinadas (→ P9) | — |
| P3 | **RESUELTA POR NORMA** — formato FUN + identificador transversal; sin series por modalidad | Práctica del nº de resolución (→ P5) | — |
| P4 | **PARCIALMENTE RESUELTA** — etapas jurídicas completas con artículo | Mapeo de estados operativos; cohorte 2022–2024 | Segunda instancia de apelación cuando expide Planeación |
| P5 | **PARCIALMENTE RESUELTA** — estructura del acto y archivo | Libro físico de resoluciones; fuente de cierres históricos | — |
| P6 | **PARCIALMENTE RESUELTA** — reglas de unicidad (Acuerdo AGN 001/2024) | Asignación del 25-0037 | Formalización del acta de anulación (si se hace) |
| P7 | **PARCIALMENTE RESUELTA** — texto literal vigente: "se suspenderá… se reanudará" (30+15, una sola vez) | ¿Sus `X` fueron actas formales o devoluciones? | **⚖️ TODO el efecto aplicable** (contradicción con insumo verbal "reinicio a cero, sin tope") |
| P8 | **RESUELTA POR NORMA** — 36/24/12/48 + prórroga + revalidación; "6 meses" = norma derogada | Solo quién controla vencimientos (menor) | ⚖️ Ratificación de valores como dato ejecutable; históricos según fecha de radicación |
| P9 | **PENDIENTE DEL INGENIERO** (fuentes, físicos, impuestos, liquidación de combinadas) | Íntegra | — |
| P10 | **PENDIENTE DEL INGENIERO** (canal de entrada) | Íntegra | — |

## Detalle por pregunta

### P1 — Códigos de licencia
- **CONFIRMADO POR NORMA:** 5 clases (2.2.6.1.1.2); LSR/LSU = subdivisión rural/urbana (2.2.6.1.1.6); LC con 9 modalidades y combinables en una solicitud (2.2.6.1.1.7); LU = urbanización, suelo urbano; LR = acto de reconocimiento (Ley 1848 art. 6 — NO licencia); PH = "otra actuación" (2.2.6.1.3.1 num. 5 — NO licencia); "LCR VISR" NO existe como figura (ausencia verificada); parcelación y espacio público existen y el registro no las usa.
- **DATO OPERATIVO PENDIENTE DEL INGENIERO:** significado local exacto de `LA`, `LCR VISR`, `LRC`; si maneja parcelación/espacio público con otro nombre. — *Respuesta literal:* `PENDIENTE`
- **HUECO ⚖️:** ninguno.

### P2 — Combinadas
- **CONFIRMADO POR NORMA:** N clases/modalidades por solicitud, un solo acto, vigencia unificada (48/36); reconocimiento+construcción conjunto; la licencia conlleva la aprobación PH. Las filas combinadas del Excel son conformes.
- **INGENIERO:** solo cómo liquidó el impuesto de combinadas (absorbida por P9). — `PENDIENTE`
- **⚖️:** ninguno.

### P3 — Numeración
- **CONFIRMADO POR NORMA:** formato `DANE-0-AA-CCCC` = Guía FUN 0.2 (Res. 0463/2017, vigente por Res. 1026/2021); el MISMO número identifica acto y expediente ("archivo único de predios"); número del acto = "número secuencial" interno con disciplina AGN (consecutivo anual desde 1); series por modalidad SIN base normativa; reporte ELIC mensual de licencias en firme (2.2.6.1.2.3.12).
- **INGENIERO:** su práctica actual del número de resolución (absorbida por P5). — `PENDIENTE`
- **⚖️:** ninguno. (I1 queda cerrada con referencia exacta.)

### P4 — Ciclo de vida
- **CONFIRMADO POR NORMA:** cadena completa de estados JURÍDICOS con artículo (radicación en legal y debida forma → citación/valla con exenciones → acta 0..1 → viabilidad con candado → decisión 45 h. + prórroga ≤ mitad → notificación → firmeza → vigencia; desistimiento ×2; recursos; SAP Ley 388 99-3, sin SAP en reconocimiento; plazos por complejidad derogados).
- **INGENIERO:** qué significa `REVISADO`; mapeo de sus estados a los jurídicos; ¿la cohorte 2022–2024 está toda cerrada? (R4/R9). — `PENDIENTE`
- **⚖️:** segunda instancia de apelación cuando expide Planeación (el art. 2.2.6.1.2.3.9 está diseñado para curadores).

### P5 — Actos finales
- **CONFIRMADO POR NORMA:** 11 elementos mínimos del acto; constancia de notificación al expediente; archivo Ley 594 + TRD municipal; notificación (no publicación, salvo terceros); `fechaFirmeza` como hito que dispara vigencias y ELIC.
- **INGENIERO:** ¿dónde están hoy las resoluciones (libro físico)? ¿sirven para reconstruir números/fechas históricos? (R3). — `PENDIENTE`
- **⚖️:** ninguno.

### P6 — Duplicado 25-0037
- **CONFIRMADO POR NORMA:** unicidad dura, sin repetidos/enmendados/tachados; anulación con acta (Acuerdo AGN **001/2024** art. 4.2.3 — el 060/2001 está DEROGADO: migrar citas del proyecto). Diseño del motor (id sintético + `colision` + no renumerar) conforme. Tratamiento del caso consumado: INFERENCIA declarada (primero en recibir conserva; acta de por medio).
- **INGENIERO:** a cuál expediente físico corresponde el número y cómo quedó el otro. — `PENDIENTE`
- **⚖️:** formalización del acta de anulación/reasignación, si se decide hacerla.

### P7 — Correcciones / subsanación
- **CONFIRMADO POR NORMA (texto, no efecto aplicable):** art. 2.2.6.1.2.2.4 (D.1783/2021 art. 19) literal: acta **por una sola vez**; **30 días hábiles + 15** de ampliación; "**Durante este plazo se suspenderá el término… salvo renuncia expresa, se reanudará el día hábil siguiente al vencimiento del término máximo**"; descuento expedición→comunicación; incumplir = desistida + archivo (solo reposición). La palabra de la norma es **suspensión/reanudación** — nunca "interrumpe"/"de nuevo". Los placeholders 30+15 del motor coinciden con la norma.
- **INGENIERO:** naturaleza de sus `X` (acta formal comunicada vs devolución informal) y cómo la comunica. — `PENDIENTE`
- **HUECO ⚖️ (INTACTO):** el EFECTO aplicable del acta sobre el término. El insumo verbal de Jurídica ("reinicia a cero, sin tope") afirma una interrupción ilimitada que el texto vigente no contiene (suspensión, acta única). **El concepto escrito debe pronunciarse frente al texto literal transcrito.** Hasta entonces: RN-5 bloqueada, gate vigente, `PoliticaTermino` dual sin política activa. Cuando se active la variante suspensión, requerirá 2 refinamientos de dato (reanudación al plazo máximo salvo renuncia; descuento acta→comunicación) — NO implementados.

### P8 — Vigencias
- **CONFIRMADO POR NORMA:** tabla vigente (D.1783 art. 27): 36+12 obra nueva/urbanización/parcelación; 24+12 demás construcción y espacio público; 48/36+12 combinadas; 12 improrrogables subdivisión y saneamientos; desde la FIRMEZA; prórroga ≥30 d.h. antes; revalidación (una vez, ≤2 meses, obra ≥50%, sin acta); transitorios D.691/2020…D.74/2025. **El "6 meses" del Excel era la norma anterior (D.1469/2010 art. 47)** — con régimen de transición por fecha de radicación. "3 años/1 año" verbales = 36/12 meses.
- **INGENIERO:** solo quién controla hoy los vencimientos (menor, no bloquea). — `PENDIENTE`
- **⚖️:** ratificación de los valores como dato EJECUTABLE del sistema (regla del proyecto para todo valor legal); calificación de históricos de 2022 (requiere fecha de radicación por expediente).

### P9 — Fuente única y operación (ÍNTEGRAMENTE del ingeniero)
Excel como único registro digital; completitud de expedientes físicos; hoja de impuestos (¿suya o de Hacienda?); liquidación de combinadas (absorbe P2-operativo). — `PENDIENTE`

### P10 — Canal de entrada (ÍNTEGRAMENTE del ingeniero)
Ventanilla vs directo; cómo le llegan hoy. — `PENDIENTE`

## Formulario depurado para el ingeniero (7 preguntas)

Se eliminan P3 y P8 (resueltas por norma); P2 se absorbe en P9. Quedan: **P1′** (solo LA/LCR VISR/LRC y clases con otro nombre) · **P4′** (REVISADO, mapeo, cohorte 2022–2024) · **P5** (libro de resoluciones) · **P6** (25-0037) · **P7′** (¿acta formal o devolución?) · **P9** (fuentes+impuestos+liquidación) · **P10** (canal). El Excel-formulario enviado al propietario debe regenerarse con estas 7 si se reenvía.
