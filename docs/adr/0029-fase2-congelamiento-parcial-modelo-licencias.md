# ADR-0029 — Fase 2: congelamiento PARCIAL del modelo de licencias sobre soporte normativo

- **Estado:** PROPUESTO — pendiente de revisión del propietario; los huecos ⚖️ aquí nombrados quedan además sujetos al concepto escrito de Jurídica. Ordenado por el propietario (7-ago-2026): avanzar todo lo documental y jurídicamente soportado sin esperar al ingeniero, manteniendo explícito lo que requiere validación humana.
- **Alcance:** decisiones de MODELO congelables HOY. No activa ninguna política jurídica pendiente, no cambia código de producción, no cierra nada como "confirmado por Planeación".
- **Nivel 2** (decisiones dentro del módulo, sobre cimientos ya aprobados en ADR-0026 y el arranque de Fase 2 mergeado en #162).
- **Base probatoria:** `docs/planes/INVESTIGACION_NORMATIVA_LICENCIAS.md` (investigación 7-ago-2026, 3 frentes, fuentes oficiales con niveles de certeza) + `docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md` (evidencia local) + `docs/planes/MATRIZ_SESION_PLANEACION_P1-P10.md` (clasificación tripartita por pregunta).

## Contexto

El arranque programable de Fase 2 (#162) dejó implementados los cimientos (serie de expedientes D9, término como proyección con política dual, extensiones aditivas, UI). El congelamiento del modelo esperaba la sesión P1–P10 con el ingeniero de Planeación, que no ha respondido. La investigación normativa resolvió por norma varias preguntas que se creían operativas; el propietario ordenó congelar lo soportado y dejar huecos explícitos.

## Decisiones congeladas (DF = decisión de Fase 2)

### DF-1 — `numeroExpediente`: formato normativo nacional, en código
Formato `{dane}-{curaduria}-{AA}-{CCCC}` conforme a la **Guía del Formulario Único Nacional, numeral 0.2** (anexo Res. 0463/2017 MinVivienda, vigente vía Res. 1026/2021; exigible por Res. 0462/2017 art. 1 num. 2). Serie anual desde 0001, emitida por la serie D9 `expedientes` con guard activo. El formateador vive en código (ya implementado, `lib/motor-expedientes/numero-expediente.ts`); la referencia normativa se incorpora a su JSDoc. Cierra la inferencia I1 del análisis.

### DF-2 — Identificador transversal único; SIN series por modalidad
El `numeroExpediente` identifica el trámite, luego el acto administrativo que lo resuelve y luego el expediente en el "archivo único de predios" (Guía FUN 0.2). **No existirán series por modalidad** (la práctica local de 2022 carece de base normativa). El número interno de la resolución (`actoFinal.numero`, disciplina AGN 001/2024 art. 4.2.9: consecutivo anual desde 1) se **captura como dato del acto**; si en el futuro el sistema lo EMITE, será extensión D9 con ADR propio. Esto resuelve la rama principal de RN-7 y disuelve R5.

### DF-3 — Cardinalidad: 1 expediente, N subtipos, 1 acto final
`Expediente.subtipos: string[]` (≥1) y un único `actoFinal` por expediente, conforme al régimen de solicitudes y actos combinados (D.1077 arts. 2.2.6.1.1.7 par. 1; 2.2.6.1.2.4.1; 2.2.6.4.2.5 par. 2; 2.2.6.1.3.1 pars. 1–2). Las filas combinadas del registro histórico son conformes, no anomalías.

### DF-4 — Catálogo de subtipos sembrado desde la norma
El catálogo (dato de la Definición de Trámite, D4) se siembra con las figuras normativas: 5 clases de licencia (incl. **parcelación** e **intervención/ocupación del espacio público**, hoy sin uso local), 3 modalidades de subdivisión, 9 de construcción, el **acto de reconocimiento** (Ley 1848 — no licencia) y la **aprobación de planos PH** (otra actuación — no licencia), cada figura con su fundamento. Los códigos locales `LA`, `LCR VISR`, `LRC` NO se incorporan al catálogo normativo: quedan en `EquivalenciaMigracion` PROVISIONAL a la espera del ingeniero (P1′).

### DF-5 — Esqueleto de estados JURÍDICOS del ciclo
La máquina de estados en código (D1) adopta los hitos normativos verificados: radicación en legal y debida forma (ancla del término) → citación/valla con sus exenciones y mínimo de 5 días hábiles antes de decidir → acta de observaciones (0..1) → acto de viabilidad (con candado y ventana de pagos) → decisión (45 días hábiles; prórroga administrativa única ≤ mitad) → notificación (electrónica solo aceptada) → firmeza → vigencia; salidas por desistimiento (2 hipótesis) y recursos. Los **estados operativos** del panel y su mapeo (incl. `REVISADO` y la cohorte 2022–2024) NO se congelan: esperan al ingeniero (P4′, R4/R9).

### DF-6 — `actoFinal` ampliado por exigencia normativa
`actoFinal = {numero?, fecha?, fechaFirmeza?, constanciaNotificacion?, vigenciaHasta?, cierreDesconocido?}`. **`fechaFirmeza` es dato obligatorio de cierre para expedientes REALES**: desde ella corren las vigencias (art. 2.2.6.1.2.4.1) y nace el reporte mensual ELIC/DANE (art. 2.2.6.1.2.3.12) — el registro histórico (0/202 fechas) documenta la brecha que el módulo corrige. `cierreDesconocido` se mantiene para RECONSTRUIDOS (D6).

### DF-7 — Vocabulario de eventos del término ampliado; política SIGUE dual y SIN default
`EventoTermino` gana capacidad para representar: comunicación del acta (descuento expedición→comunicación), renuncia expresa al plazo restante, acto de viabilidad (suspensión por pagos), prórroga administrativa del término. **Ninguna política de subsanación se activa** (⚖️ hueco 1); la dualidad `REINICIO_A_CERO | SUSPENSION_REANUDACION` permanece exactamente como está en `lib/motor-expedientes/termino.ts`.

### DF-8 — Vigencias como estructura de dato; valores sembrables, NO ejecutables
`vigenciaActo` se estructura por clase/modalidad con: plazo, prórroga (única, oportunidad ≥30 días hábiles antes), revalidación (una vez, ≤2 meses, umbrales de obra) y regla de transición por **fecha de radicación** (D.1783/2021 art. 36; el "6 meses" histórico de subdivisión corresponde a la norma derogada D.1469/2010 art. 47). Los VALORES vigentes (36/24/12/48 + 12) se registran como semilla documentada **no ejecutable** hasta ratificación ⚖️ (hueco 3).

### DF-9 — Duplicados: diseño confirmado por norma vigente
Se ratifica el diseño ya implementado (id sintético; `numeroExpediente` como atributo; unicidad transaccional solo origen REAL; `colision: true` para históricos; jamás renumerar) con base en el **Acuerdo AGN 001/2024 art. 4.2.3** (sin repetidos/enmendados/tachados; anulación con acta). La asignación del caso `25-0037` sigue siendo evidencia humana (P6).

### DF-10 — Migración documental de citas AGN
Toda cita del proyecto al Acuerdo AGN 060/2001 (derogado por Acuerdo 001/2024, art. 10.1) migra a los artículos vigentes (4.2.3 radicación, 4.2.9 actos). Tarea de documentación transversal; las reglas materiales no cambian.

## Huecos ⚖️ nombrados (NO decididos aquí; bloquean su materia, no el resto)

1. **Efecto de la subsanación sobre el término** — el texto vigente dice literalmente "se suspenderá… se reanudará" (art. 2.2.6.1.2.2.4, D.1783/2021 art. 19); el insumo verbal de Jurídica afirma "reinicio a cero, sin tope". El **concepto escrito** debe pronunciarse frente al texto transcrito en la investigación. Hasta entonces: RN-5 bloqueada, gate de régimen vigente, política dual sin default.
2. **Silencio administrativo positivo aplicado + modelo "mismo radicado"** — base normativa verificada (Ley 388 art. 99-3; CPACA 85; sin SAP en reconocimiento); su tratamiento operativo espera la transcripción pendiente y el concepto.
3. **Valores de vigencia como dato ejecutable** — regla del proyecto: ningún valor legal se ejecuta sin ratificación.
4. **Segunda instancia de apelación** cuando expide Planeación (art. 2.2.6.1.2.3.9 está diseñado para curadores).

## Pendientes del ingeniero (formulario depurado a 7 preguntas)

P1′ (códigos locales `LA`/`LCR VISR`/`LRC`), P4′ (estados operativos y cohorte 2022–2024), P5 (libro de resoluciones/fuente de cierres), P6 (asignación 25-0037), P7′ (naturaleza de las `X`), P9 (fuentes/impuestos/liquidación de combinadas), P10 (canal de entrada). P3 y P8 se retiran del formulario (resueltas por norma); P2 queda absorbida en P9.

## Consecuencias

- La Fase 2 deja de estar bloqueada por preguntas que la norma responde; lo pendiente humano queda acotado y nombrado.
- Ninguna decisión de este ADR contradice ADR-0026 (D1–D9, A3): todo es dato, extensión aditiva o esqueleto ya previsto.
- La implementación de DF-4/DF-5/DF-6/DF-7/DF-8 es trabajo posterior a la aprobación de este ADR, con revisión cruzada estándar; DF-1/DF-2/DF-3/DF-9 ya están implementadas y aquí solo se les fija la base normativa.
- Precondiciones del ADR-0026 no cubiertas aquí (checklist oficial completo, validación con Planeación) siguen vigentes para lo que les corresponde.

## Referencias

`docs/planes/INVESTIGACION_NORMATIVA_LICENCIAS.md` (anexo probatorio con fuentes y niveles) · `docs/planes/MATRIZ_SESION_PLANEACION_P1-P10.md` · `docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md` · `docs/planes/respuestas-juridica-licencia-construccion.md` (insumo verbal, estatus probatorio) · `docs/planes/DICTAMEN_TZ_DIA_CIVIL.md` · ADR-0026 · PR #162.
