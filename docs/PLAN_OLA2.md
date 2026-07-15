# Plan de implementación — Ola 2 (Fase 3)

- **Fecha:** 2026-07-11
- **Autor:** arquitecto-principal (análisis y reparto; no ejecuta código)
- **Estado:** PROPUESTO — requiere validación del propietario para levantar el
  congelamiento (mismo circuito que la Ola 1, ADR-0004).
- **Base estratégica:** `docs/PLANIFICACION_EJECUTIVA_FASE3.md` (validado por el
  propietario). La Ola 2 se ordena alrededor de la **escalabilidad demostrable**.
- **Referencia permanente:** la plataforma debe seguir siendo mantenible,
  auditable y escalable a 5–10 años, adoptable por cualquier municipio colombiano.

---

## Veredicto de viabilidad

**APROBADO CON CONDICIONES.**

El enfoque del documento ejecutivo es correcto y el mayor riesgo (R11) está
confirmado en código: **hoy no existe ninguna paginación por cursor ni límite
server-side sobre `ventanilla_radicados`**. Tanto el stream del dashboard como
la búsqueda avanzada leen la colección completa y paginan en memoria. Es un
patrón, no un punto, y es el techo de la evolución multi-municipio.

Condiciones para aprobar la ejecución:

1. **Coordinación obligatoria con `task_7f9e8ba3`** (sesión separada del
   propietario, "paginar en Firestore la búsqueda avanzada"). Esa tarea ataca
   el endpoint `busqueda-avanzada`; el frente 2A de este plan **absorbe** su
   resultado y extiende el patrón al peor caso real (el stream en tiempo real
   del dashboard), **sin duplicar** su trabajo. Ver §Dependencias.
2. **Alcance recortado del frente multi-municipio (2E):** en la Ola 2 entra
   solo el **contrato de configuración institucional como dato + un cargador
   sobre un catálogo autocontenido**, como prueba de concepto. La apertura del
   tipo `TenantId` (unión cerrada en `src/types/radicado.ts:19`) y la
   externalización completa de TRD/áreas/términos se **difieren** a una Ola
   posterior (deuda declarada, §8 y §Deuda). Razón: tocar `TenantId` impacta
   todo el sistema y es sobre-ingeniería para municipios que nadie ha pedido aún
   (YAGNI + "no cerrar puertas", AGENTS.md §Visión).
3. Cada frente cierra bajo el **ciclo permanente de hallazgos** (Riesgo → ADR →
   Implementación → Pruebas → Revisión cruzada → Evidencia → Cierre) con un
   **control de regresión automatizado** (Principio del REGISTRO_RIESGOS).
4. El auditor de rendimiento (2B) se construye **sobre** la señal de
   observabilidad de P-C (`lib/observabilidad/eventos-negocio.ts`, ADR-0005),
   extendiéndola a la operación de lectura; **no** crea una segunda señal.

---

## 1. Objetivo arquitectónico

Convertir la plataforma de **"verificada una vez" a "que demuestra su
confiabilidad y su escala en cada cambio"**, levantando el techo de rendimiento
que hoy acopla el costo de cada vista al volumen total de la plataforma.

En concreto, al cerrar la Ola 2:

- La consulta de radicados escala por **página y por tenant**, no por histórico:
  el peor caso deja de ser "toda la base". (Ataca R11.)
- CI mide y **hace fallar** los cambios que superen un presupuesto de
  rendimiento, apoyándose en la señal de observabilidad ya existente.
- Los hallazgos normativos abiertos (R9/R10, R6) se convierten en **controles
  ejecutables** en CI, no en notas de un documento.
- Ningún despliegue ocurre sin un **informe de evidencia verde** consolidado
  (compuerta de despliegue).
- Se prueba el **primer paso** para que un municipio nuevo entre sin tocar
  código: la configuración institucional deja de ser una constante del repo y
  pasa a ser un dato cargable (prueba de concepto acotada).

---

## 2. Alcance y exclusiones

### Entra en la Ola 2

| Frente | Descripción | Ataca |
|---|---|---|
| **2A** | Escalabilidad de la consulta de radicados: cursor server-side (`limit` + `startAfter`) en `busqueda-avanzada` (coordinado con `task_7f9e8ba3`) + acotar la ventana del stream del dashboard (`useVentanillaRadicados`) preservando el tiempo real de la bandeja operativa. | R11 |
| **2B** | Auditor de rendimiento + presupuesto de rendimiento en CI, construido sobre la señal de observabilidad P-C extendida a la operación de **lectura**. | KPI #2/#4 |
| **2C** | Normativo ejecutable: convertir R9/R10 (canal de inferencia / necesidad de conocer) y R6 (prórroga tras vencimiento) en controles automatizados en CI. | R9, R10, R6 |
| **2D** | Orquestador de evidencia + compuerta de despliegue: ningún deploy sin informe verde (build + tests + rules + presupuesto de rendimiento + E2E). | KPI #3 |
| **2E** | Primer paso onboarding multi-municipio: contrato `ConfiguracionInstitucional` como **dato** + cargador aplicado a **un** catálogo autocontenido, como prueba de concepto verificable por el laboratorio. | Adopción |

### Se difiere explícitamente (fuera de la Ola 2)

- **Apertura del tipo `TenantId`** (`src/types/radicado.ts:19-34`) de unión
  cerrada a identificador abierto por municipio. Impacto transversal (catálogos,
  reglas de negocio, índices). Se difiere a Ola 3 con ADR propio.
- **Externalización completa** de TRD (`lib/catalogos/series-documentales.ts`),
  áreas (`lib/catalogos/areas.ts`) y términos (`lib/catalogos/tipos-solicitud.ts`).
  En 2E solo se prueba el patrón sobre uno de ellos.
- **Aprovisionamiento generalizado "crear municipio X"** (parametrizar los
  scripts de Fase 1–2 en un flujo único). Se difiere hasta que 2E valide el
  contrato de datos.
- **APM / persistencia de métricas en Firestore.** El auditor de rendimiento
  consume la señal estructurada existente (stdout/Sentry), como decidió ADR-0005.
  No se crea backend de métricas (YAGNI, evita R3).
- **Migración de otros puntos "leer todo"** de menor criticalidad
  (`app/api/reportes/mipg/excel/route.ts:61`, `app/api/ai/copilot/route.ts:85`,
  `lib/simi-juridico/calculateControlInternoMetrics.ts:29`). Se documentan como
  deuda mapeada al mismo patrón de 2A; se corrigen cuando su volumen lo exija.
- **Riesgos de backlog no priorizados por el propietario** (R3, R4, R5, R7). No
  entran salvo decisión explícita del Product Owner.

---

## 3. ADR requeridos

Último ADR usado: **0008**. Siguiente libre: **0009**.

| ADR | Título propuesto | Frente | Rol que redacta / revisa |
|---|---|---|---|
| **ADR-0009** | Levantamiento gobernado del congelamiento para la Ola 2 (Fase 3) | Gobernanza | arquitecto-principal → propietario (equivalente a ADR-0004) |
| **ADR-0010** | Escalabilidad de la consulta de radicados: paginación por cursor server-side + ventana del stream (R11) | 2A | arquitecto-principal + firestore-datos → dev-backend + seguridad |
| **ADR-0011** | Auditor de rendimiento y presupuestos de rendimiento en CI sobre la señal de observabilidad (P-C) | 2B | arquitecto-principal + devops → seguridad |
| **ADR-0012** | Controles normativos ejecutables (R9/R10, R6) en CI | 2C | gobierno-digital + arquitecto-principal → seguridad |
| **ADR-0013** | Orquestador de evidencia y compuerta de despliegue | 2D | devops + arquitecto-principal → seguridad |
| **ADR-0014** | Contrato de configuración institucional como dato — primer paso de onboarding multi-municipio | 2E | arquitecto-principal + firestore-datos → dev-backend + seguridad |

ADR-0009 es la puerta: se redacta y valida **antes** de tocar código, y habilita
solo el alcance de §2. Los ADR 0010–0014 pueden redactarse en paralelo a la
apertura de cada incremento, pero cada uno precede a su implementación.

---

## 4. Riesgos técnicos y normativos (con mitigación)

### Técnicos

- **T1 — Romper el tiempo real de la bandeja operativa al paginar el stream.**
  `useVentanillaRadicados.ts:74` usa `onSnapshot` (tiempo real) sobre toda la
  colección. Acotar la ventana no puede hacer que un radicado nuevo desaparezca
  de la bandeja del día.
  *Mitigación:* separar dos consultas — (a) ventana operativa acotada por rango
  temporal reciente + `limit`, que **mantiene** el listener en tiempo real; (b)
  histórico/analítica bajo demanda y paginado (sin listener permanente). ADR-0010
  fija el contrato. Control: E2E de la bandeja (radicar → aparece) sin regresión.

- **T2 — `useAnalytics` calcula sobre el array completo en cliente**
  (`useAnalytics.ts:7-8,190-192`). Si la analítica deja de recibir "todo", sus
  métricas globales cambian de semántica.
  *Mitigación:* ADR-0010 decide explícitamente el modelo de la analítica
  histórica (consulta agregada / bajo demanda con su propia ventana), separándola
  de la bandeja operativa. La analítica no debe seguir dependiendo de un stream
  ilimitado. Control de regresión: pruebas unitarias del hook con dataset fijo.

- **T3 — Índices Firestore faltantes.** Cursor + `where(oficinaDestino)` +
  `orderBy(fechaRadicado)` + rango temporal exige índices compuestos.
  `useVentanillaRadicados.ts:28-30` ya documenta un índice; los nuevos rangos
  requieren más. *Mitigación:* firestore-datos define y despliega índices;
  `firebase deploy --only firestore:indexes --dry-run` como verificación (el
  emulador local no corre por Java 8 — `project_entorno_firebase_local`).

- **T4 — Divergencia entre la paginación del endpoint y la del stream.** Si 2A
  corrige `busqueda-avanzada` (task_7f9e8ba3) con un patrón y el stream con otro,
  aparece deuda de dos modelos de consulta.
  *Mitigación:* ADR-0010 define **un** contrato de paginación compartido
  (`lib/busqueda/*`) reutilizado por ambos (Principio 3, reutilización).
  La paginación en memoria actual (`filtros-radicado.ts:330-337`) se conserva
  solo para el filtrado fino dentro de la página ya acotada.

- **T5 — El auditor de rendimiento (2B) no puede medir la lectura porque la
  señal P-C solo cubre escrituras.** `eventos-negocio.ts:27` define
  `OperacionCritica = radicacion | asignacion | prorroga | respuesta`; **ninguna
  operación de lectura** está instrumentada — justo donde vive R11.
  *Mitigación:* 2B extiende el vocabulario de la señal existente con una
  operación de consulta (latencia + nº de documentos leídos), **reutilizando**
  `registrarEventoNegocio` sin crear otra señal. ADR-0011 fija el contrato.

- **T6 — El presupuesto de rendimiento en CI sin datos representativos da falsos
  verdes.** El emulador local no corre (Java 8). *Mitigación:* el presupuesto se
  evalúa sobre métrica determinista (nº de documentos leídos por consulta, que es
  independiente del hardware) además de latencia; CI es la compuerta
  (`project_entorno_tests_local`). Se mide contra un dataset sintético de tamaño
  conocido en el laboratorio (job `laboratorio-emulador` de `ci.yml`).

### Normativos

- **N1 — R9 (canal de inferencia, Ley 1581/2012).** Al convertir el hallazgo en
  control, el control no debe, él mismo, filtrar por identidad reservada.
  *Mitigación:* concepto de gobierno-digital en ADR-0012 antes de codear; el
  control se apoya en el helper `lib/seguridad/identidad-protegida.ts` ya
  transversal (H2/ADR-0006).

- **N2 — R10 (necesidad de conocer).** La variante B implica una decisión de
  producto (¿quién puede ver la identidad reservada legítimamente?). No es
  puramente técnica. *Mitigación:* 2C entrega el **control ejecutable** del
  estado actual (variante A, conservadora y conforme); la variante B queda como
  decisión de Product Owner + gobierno-digital, fuera del alcance de código de la
  Ola 2 (se documenta, no se implementa sin decisión).

- **N3 — Configuración institucional como dato (2E) y trazabilidad AGN.** El
  radicado guarda una **foto** de la serie al nacer
  (`series-documentales.ts` §encabezado). Externalizar el catálogo no debe romper
  esa inmutabilidad. *Mitigación:* ADR-0014 preserva el patrón "foto al nacer";
  el cargador solo alimenta el catálogo vigente, nunca reescribe históricos.

---

## 5. Estrategia de implementación incremental

Sub-olas internas. **Cada incremento es entregable por sí solo**, cierra con
evidencia verde + control de regresión, y el propietario valida su cierre antes
de abrir el siguiente (mismo ritmo que la Ola 1).

### 2A — Escalabilidad de la consulta (corazón de la Ola 2) — ataca R11
1. **ADR-0010** (contrato de paginación compartido; separación bandeja
   tiempo-real vs. histórico paginado). — *arquitecto-principal + firestore-datos*
2. Índices Firestore para cursor + rango temporal. — *firestore-datos*
   (revisa: dev-backend + seguridad) · archivos: `firestore.indexes.json`
3. Cursor server-side (`limit`/`startAfter`) en el endpoint. — *dev-backend*,
   **coordinado con `task_7f9e8ba3`** · `app/api/radicados/busqueda-avanzada/route.ts`,
   `lib/busqueda/filtros-radicado.ts` (revisa: seguridad)
4. Ventana acotada del stream operativo + histórico bajo demanda. —
   *dev-backend + dev-frontend* · `lib/hooks/useVentanillaRadicados.ts`,
   `app/interno/dashboard/components/analytics/useAnalytics.ts`,
   `app/interno/dashboard/page.tsx` (revisa: qa + ux-ui)
5. Pruebas: unitarias del contrato de paginación + E2E bandeja/búsqueda sin
   regresión. — *qa* · `__tests__/`, `e2e/`

### 2B — Auditor de rendimiento + presupuesto en CI — KPI #2/#4
1. **ADR-0011**. — *arquitecto-principal + devops*
2. Extender la señal de observabilidad a la operación de **lectura** (latencia +
   nº documentos leídos), reutilizando `registrarEventoNegocio`. — *dev-backend*
   · `lib/observabilidad/eventos-negocio.ts`, endpoint/hook de consulta
   (revisa: seguridad — PII/saneo)
3. Job de presupuesto de rendimiento en CI (falla si se excede el límite de
   documentos leídos / latencia sobre dataset sintético conocido). — *devops*
   · `.github/workflows/ci.yml`, `scripts/laboratorio/*` (revisa: seguridad)
4. Pruebas: el job debe fallar deliberadamente al inyectar una consulta
   ilimitada (prueba de mutación, como P-B). — *qa*

### 2C — Normativo ejecutable (R9/R10, R6) — cierra hallazgos abiertos
1. **ADR-0012** con concepto de gobierno-digital. — *gobierno-digital + arquitecto*
2. Control ejecutable de R6 (impedir prórroga tras vencimiento). — *dev-backend*
   · `lib/server/radicados-security.ts` (revisa: seguridad + gobierno-digital)
3. Control ejecutable de R9/R10 (variante A, conservadora). — *dev-backend*
   · apoyado en `lib/seguridad/identidad-protegida.ts` (revisa: seguridad)
4. Pruebas: unitarias + rules-unit-testing en el job `laboratorio-emulador`. — *qa*

### 2D — Orquestador + compuerta de despliegue — KPI #3
1. **ADR-0013**. — *devops + arquitecto*
2. Job orquestador que consolida evidencia (build+test+rules+presupuesto+E2E) en
   un informe verde único; gate previo a deploy. — *devops*
   · `.github/workflows/ci.yml` (revisa: seguridad)
3. Pruebas: el gate bloquea un PR con cualquier señal roja. — *qa*

### 2E — Primer paso onboarding multi-municipio (prueba de concepto) — adopción
1. **ADR-0014** (contrato `ConfiguracionInstitucional` como dato; preserva
   "foto al nacer"; NO abre `TenantId`). — *arquitecto + firestore-datos*
2. Modelo de datos + cargador para **un** catálogo autocontenido (candidato:
   términos/tipos de solicitud, por ser el más aislado). — *firestore-datos +
   dev-backend* · `src/types/*`, `lib/catalogos/*`, script de carga
   (revisa: dev-backend + seguridad)
3. Verificación por el laboratorio: cargar config sintética y validar que el
   sistema la consume sin tocar código. — *qa + devops*

---

## 6. Estrategia de pruebas y validación

Recordatorio de entorno: **el emulador local no corre (Java 8) → CI es la
compuerta** (`project_entorno_firebase_local`, `project_entorno_tests_local`).
Toda validación de reglas/emulador ocurre en el job `laboratorio-emulador` de
`ci.yml`. vitest local es flaky bajo carga (re-correr fallidos aislados).

| Frente | Cómo se prueba | Control de regresión (obligatorio) |
|---|---|---|
| **2A** | Unitarias del contrato de paginación (`lib/busqueda/*`) con dataset fijo; E2E bandeja (radicar→aparece en tiempo real) y búsqueda (paginar sin traer todo). | Test que **falla** si una consulta pierde el `limit`/cursor (prueba de mutación, patrón P-B). |
| **2B** | Presupuesto medido sobre nº de documentos leídos (determinista) + latencia sobre dataset sintético de tamaño conocido. | Job CI que falla si un cambio supera el presupuesto o si se reintroduce una lectura ilimitada. |
| **2C** | Unitarias del control de R6; rules-unit-testing / unitarias del control R9/R10 apoyado en el helper de identidad. | Caso volteado a "denegado/rechazado" que falla si el hallazgo reaparece (patrón H1/R8). |
| **2D** | PR de prueba con una señal roja intencional. | El gate debe bloquearlo; verde solo con evidencia completa. |
| **2E** | Carga de config sintética en el laboratorio + verificación de consumo. | Test que falla si el sistema vuelve a leer el catálogo desde constante en vez de dato. |

Regla transversal: **ninguna corrección se acepta sin un control automatizado
capaz de detectar su regresión** (REGISTRO_RIESGOS §Regla de operación).
Medición antes y después (Principio 13): 2B establece la **línea base** de la
consulta **antes** de que 2A la corrija, para demostrar la mejora con número.

---

## 7. KPIs con línea base y meta

Se mide contra los 5 indicadores estratégicos (institucionalizados 2026-07-11).
Donde no existe métrica capturada hoy, se **declara el supuesto** (Principio 13)
y 2B la instrumenta antes de 2A.

| Indicador | Línea base (hoy, con evidencia/supuesto) | Meta Ola 2 | Frente |
|---|---|---|---|
| **Mayor escala sin perder confiabilidad** | La consulta lee **toda** la colección: O(N) documentos por carga, sin `limit` ni cursor (`useVentanillaRadicados.ts:72`, `busqueda-avanzada/route.ts:86-94`). Confirmado: con ~209–216 radicados en stage el dashboard ya desestabiliza el E2E 01 (R11). | Lecturas por consulta **≤ pageSize** (25/50/100) + ventana temporal, **independiente de N**. Bandeja operativa acotada a ventana reciente. | 2A |
| **Más evidencia automatizada** | 2 jobs en CI (`validate`, `laboratorio-emulador`); **0** presupuestos de rendimiento; la consulta de lectura **no** está instrumentada (`eventos-negocio.ts:27` cubre solo 4 escrituras). | +1 job de presupuesto de rendimiento en CI + señal de lectura instrumentada; R6/R9/R10 con control ejecutable. | 2B, 2C |
| **Menor riesgo por despliegue** | No existe compuerta de despliegue; el deploy no exige informe verde consolidado (`ci.yml` no tiene gate pre-deploy). | 0 despliegues sin informe verde consolidado (build+test+rules+presupuesto+E2E). | 2D |
| **Menos trabajo manual** | Onboarding de municipio requiere editar código (catálogos y `TenantId` hardcodeados: `series-documentales.ts`, `areas.ts`, `radicado.ts:19`). | 1 catálogo institucional cargable como **dato** sin tocar código (prueba de concepto). | 2E |
| **Mayor trazabilidad de decisiones** | R6/R9/R10 abiertos en el registro sin control; residuales de H1/H2. | Cada uno cerrado con ADR + control de regresión enlazado en `docs/REGISTRO_RIESGOS.md`. | 2C |

**Supuesto declarado (Principio 13):** no hay hoy una latencia p95 medida de la
consulta; se conoce el efecto (desestabiliza E2E 01 a ~209–216 docs) pero no el
número. 2B captura la latencia p95 y el nº de documentos leídos **antes** de
aplicar 2A, y los vuelve a medir después — la mejora se demuestra con dato, no
con opinión.

---

## 8. Criterios objetivos de cierre (verificables)

La Ola 2 se cierra cuando **todos** los siguientes son verdes y verificables:

1. **2A:** ninguna consulta de radicados (endpoint ni stream) lee la colección
   completa; toda lectura acota por `limit`/cursor + tenant + ventana. Verificado
   por el control de regresión que falla si se pierde el límite. E2E de bandeja
   (tiempo real) y búsqueda (paginada) verdes sin regresión.
2. **2B:** CI incluye un presupuesto de rendimiento que **falla** ante una
   consulta ilimitada (probado por mutación); la señal de observabilidad emite
   latencia + nº documentos de la operación de lectura, sin PII. Línea base y
   medición posterior registradas.
3. **2C:** R6 y R9/R10 tienen control ejecutable en CI; cada fila del registro de
   riesgos enlaza su control; concepto de gobierno-digital CONFORME registrado.
4. **2D:** existe la compuerta de despliegue; un PR con señal roja queda
   bloqueado (demostrado); ningún deploy procede sin informe verde.
5. **2E:** un catálogo institucional se carga como dato y el sistema lo consume
   sin cambio de código; verificado en el laboratorio; "foto al nacer" preservada.
6. **Gobernanza:** ADR-0009 a ADR-0014 redactados, aceptados y enlazados;
   `docs/REGISTRO_RIESGOS.md` refleja R11→RESUELTO (y R6/R9/R10 según 2C);
   retrospectiva técnica en `docs/retrospectivas/`.
7. **Sin regresión global:** suite unitaria + E2E + rules verdes en CI (patrón de
   cierre de la Ola 1).

---

## Dependencias y orden de ejecución

```
ADR-0009 (levantamiento gobernado)  ──►  habilita todo lo demás
        │
        ├─► 2A (R11)  ── coordinar con task_7f9e8ba3 ──┐
        │      · endpoint busqueda-avanzada = territorio de task_7f9e8ba3
        │      · 2A absorbe su cursor y AÑADE la ventana del stream (peor caso)
        │                                               │
        ├─► 2B (auditor+presupuesto)  ◄── mide base ANTES de 2A, mejora DESPUÉS
        │      · depende de 2A para demostrar la mejora, pero la señal de
        │        lectura (T5) se instrumenta en paralelo a 2A
        │
        ├─► 2C (normativo ejecutable)  ── independiente (paralelizable)
        │
        ├─► 2D (compuerta)  ◄── consume las señales de 2B y 2C
        │
        └─► 2E (config como dato)  ── independiente; último por menor urgencia
```

**Orden recomendado:** 2A y 2C en paralelo (independientes) → 2B (necesita la
señal de lectura de 2A y establece base/mejora) → 2D (consume 2B+2C) → 2E.

**Coordinación crítica con `task_7f9e8ba3`:** antes de abrir el paso 3 de 2A, el
coordinador confirma el estado de esa tarea. Si ya entregó el cursor en
`busqueda-avanzada`, 2A **no lo reescribe**: parte de su contrato y solo añade la
ventana del stream + índices + el contrato compartido de `lib/busqueda/*`. Si aún
no entregó, ADR-0010 fija el contrato que ambas deben respetar para no divergir
(riesgo T4).

---

## Deuda técnica declarada (aceptable y por qué)

1. **`TenantId` sigue siendo unión cerrada** (`src/types/radicado.ts:19-34`).
   *Aceptable:* abrirlo impacta todo el sistema y no hay municipio real que lo
   pida (YAGNI). 2E prueba el patrón de datos sin forzar la apertura. Se difiere
   a Ola 3 con ADR propio.
2. **Catálogos TRD/áreas siguen en código** salvo el probado en 2E
   (`series-documentales.ts`, `areas.ts`). *Aceptable:* 2E valida el contrato
   sobre uno; extender es mecánico una vez probado. No cierra puertas.
3. **Otros puntos "leer todo" de menor criticalidad** no migran en la Ola 2
   (`reportes/mipg/excel/route.ts:61`, `ai/copilot/route.ts:85`,
   `calculateControlInternoMetrics.ts:29`). *Aceptable:* su volumen es acotado
   por naturaleza (reporte bajo demanda, contexto de IA limitado); heredan el
   patrón de 2A cuando su volumen lo exija. Se registran como deuda mapeada.
4. **Sin persistencia de métricas / APM** (heredado de ADR-0005). *Aceptable:*
   el presupuesto y el auditor se sostienen sobre la señal estructurada + CI;
   YAGNI, evita R3.
5. **Variante B de R10 (necesidad de conocer)** no se implementa: requiere
   decisión de Product Owner + gobierno-digital. 2C entrega la variante A
   conforme; la B queda documentada, no codeada.

---

## Nota de contexto insuficiente

Este plan asume que `task_7f9e8ba3` sigue en curso y que su alcance es el
endpoint `busqueda-avanzada` (según `docs/REGISTRO_RIESGOS.md` R11). El
coordinador debe confirmar su estado real antes de ejecutar el paso 3 de 2A. Si
esa tarea amplió su alcance al stream del dashboard, 2A se reduce a índices +
analítica + controles de regresión, y este plan debe ajustarse.
