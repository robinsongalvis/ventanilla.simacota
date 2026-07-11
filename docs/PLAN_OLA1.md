# Plan de Implementación — Fase 3, Ola 1

- **Estado:** PROPUESTA DE PLANIFICACIÓN (no es implementación). El congelamiento **sigue vigente**; se levanta de forma gobernada (ADR-0004) solo cuando el propietario valide este plan.
- **Fecha:** 2026-07-11
- **Autor:** arquitecto-principal (diseño técnico). La planificación fina (backlog, dimensionamiento con la funcionaria) la afina `product-owner`.
- **Marco:** `docs/PLAN_FASE3.md` §6 (Ola 1) · criterio de éxito v2 · ciclo permanente de hallazgos (Riesgo→ADR→Implementación→Pruebas→Revisión cruzada→Evidencia→Cierre). **Ninguna corrección se acepta sin control automatizado de regresión.**
- **Alcance del documento:** los 3 frentes de la Ola 1. No se amplía nada más.

## Veredicto de viabilidad

**APROBADO CON CONDICIONES.** Los 3 frentes son ejecutables sobre el estado real del repositorio, con riesgo técnico bajo-medio, y cada uno cierra con control de regresión verificable. Condiciones:

1. **Ola 1 se abre con ADR-0004** (levantamiento gobernado del congelamiento, ya reservado en `PLAN_FASE3.md`). Ningún frente codea antes de que ese ADR esté aprobado.
2. **Cada frente entra por su propio ADR de diseño** (0005/0006/0007) — triaje Nivel 3: P-C define un estándar transversal, H2 toca cumplimiento normativo, P-B introduce dependencia e infraestructura de pruebas nueva.
3. **P-A/H2 requiere una decisión de producto+normativa previa** (enmascarar-por-defecto vs. revelar-con-traza) que hoy no está tomada; el diseño técnico está listo para ambas variantes, pero la implementación no arranca sin esa decisión. La declara `gobierno-digital` + `product-owner`; `arquitecto-principal` valida viabilidad.

Los tres frentes son **paralelizables** (`PLAN_FASE3.md` §6). P-C es fundacional para *medición futura* (Olas 2-3), pero H2 y P-B no dependen de P-C para ejecutarse en la Ola 1; ver §Orden interno.

---

## Estado del código auditado (evidencia, no supuestos)

### Observabilidad (P-C)
- `lib/logger.ts:33` `logError(...)` — **solo ruta de error**, salida JSON one-liner, saneada de PII vía `lib/seguridad/sanitizar-observabilidad.ts`, con envío opcional a Sentry (`lib/logger.ts:51-68`, no-op si no hay DSN).
- Sentry inicializado: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- `lib/ai/telemetry.ts` `registrarLogIA(...)` — **único patrón existente de métrica de éxito+latencia**, pero está acotado a IA (escribe en `ai_logs`, endpoints `classify|chat|scan-doc`).
- `docs/observability.md` documenta **solo** la telemetría de IA (`ai_logs`, `ai_auditoria`, AI Health) — no cubre los flujos institucionales.
- Los endpoints de flujos críticos **ya invocan `logError` en la ruta de fallo**: `app/api/radicacion/route.ts`, `app/api/radicados/[radicadoId]/{asignar,prorroga,resolver,reclasificar,completar-datos,sellar-documento,enviar-constancia}/route.ts`, `lib/acciones/resolver-radicado.ts`.
- **Brecha (lo que NO existe):** no hay métrica de éxito ni latencia de las operaciones de negocio, ni traza/correlación que cruce un flujo (radicación→asignación→prórroga→respuesta), ni contador de eventos de negocio. Sin esto, el KPI #3 de `PLAN_FASE3.md` (% de flujo con observabilidad) no se puede medir hoy.
- Lógica de negocio server-side donde instrumentar: `lib/actions/{asignarRadicado,radicarVentanilla,reclasificarTipoSolicitud}.ts`, `lib/server/radicados-security.ts` (control de prórroga H1), `lib/acciones/resolver-radicado.ts`.

### Identidad reservada (P-A/H2)
- Función `identidadProtegida(r)` **existe una sola vez**, local a `app/interno/dashboard/components/ventanilla/VistaVentanilla.tsx:75-77` (`identidadReservada === true || esAnonimo === true`); se aplica solo en la fila del mostrador (`VistaVentanilla.tsx:249`). **No es utilidad compartida.**
- **Fugas confirmadas en `app/interno/dashboard/page.tsx`** (sin la guarda):
  - Panel de detalle del funcionario, `~2492-2501`: documento, nombre completo, correo, teléfono, dirección en texto plano.
  - Bandeja de Asignación (tabla), `~4290-4292`: nombre + tipo/número de documento.
  - Otras filas de lista: `~1495`, `~1585-1587`, `~2223`, `~2547`.
  - **Exportación CSV/Excel `~3687-3692`: incluye nombre, documento y bandera de reserva en texto plano** (fuga adicional no citada en el concepto — la exportación es un vector de exfiltración).
- Ya enmascaran correctamente (referencia de patrón a reutilizar): consulta pública `lib/seguridad/consulta-publica-radicado.ts:176-206`, sugerencias `lib/recepcion/sugerencias-solicitante.ts:52`, reportes MIPG `lib/reportes-mipg/sanitizar.ts`, panorama `lib/control-interno/panorama.ts`, notificación `page.tsx:3269-3271` (condicional ya presente).
- `e2e/07-identidad-reservada.spec.ts` **hoy afirma la fuga como comportamiento vigente** (documenta que el detalle muestra nombre/documento en plano). Debe **invertirse** para convertirse en control de regresión.
- Base normativa y recomendación: `docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md` §HALLAZGO 2 (Ley 1581/2012 art. 4 f/g/h; agravante denunciante, Ley 1474/2011) — recomendación #3: aplicar la guarda + decidir acceso por rol/necesidad de conocer + dejar traza de quién revela.

### Reglas Firestore y emulador (P-B)
- `@firebase/rules-unit-testing` **NO está** en `package.json` (dependencia nueva a introducir).
- Emulador: el job CI **`laboratorio-emulador`** (`.github/workflows/ci.yml`) ya corre `firebase-tools emulators:exec --only firestore --project demo-ventanilla-lab` con **Java 21 (Temurin)** y ejecuta la sonda `scripts/laboratorio/probar-emulador.mjs`. **En CI el emulador funciona hoy.**
- Local: Docker no disponible (`docker-compose.lab.yml` documentado como NO PROBADO localmente; máquina con Java 8). **La suite de reglas correrá en CI; localmente queda como best-effort vía Docker.**
- `firestore.rules` (254 líneas) — roles: `ADMIN`, `FUNCIONARIO`, `RECEPCIONISTA`, `JEFE_DEPENDENCIA`, `CONTROL_INTERNO`. Aislamiento por tenant vía `userTenant()` contra `clasificacion.oficinaDestino` (ventanilla_radicados y su subcolección `trazabilidad`), `dependenciaOrigen` (ventanilla_salidas) y `tenantId` (control_interno_*). Colecciones con reglas: `users`, `radicados` (legacy, escritura cerrada), `ventanilla_radicados` (+`/trazabilidad`), `ai_logs`, `ai_feedback`, `ai_auditoria`, `ventanilla_salidas`, `ventanilla_planillas`, `counters`, `admin_auditoria`, `simi_auditoria`, `control_interno_{hallazgos,planes_mejora,alertas,eventos}`, catch-all `deny`.
- **Riesgo ALTA latente:** el aislamiento por tenant no tiene prueba automática; una regresión en una regla `get/list` pasaría silenciosa.

---

# FRENTE P-C · Observabilidad de flujos críticos (fundacional)

### 1. Objetivos
- Dotar a la plataforma de un **primitivo de observabilidad de negocio** (métrica + traza estructurada de la ruta de éxito, no solo de error) reutilizable, con correlación por `radicadoId` a lo largo del flujo.
- Instrumentar los **cuatro flujos críticos existentes**: radicación, asignación, prórroga, respuesta.
- Establecer la **plantilla "módulo nace instrumentado"** (métricas + traza + criterio de aceptación) que rige toda la Fase 3 (Principio 1).

### 2. Alcance
- **ENTRA:** extensión del logger/observabilidad para eventos de negocio con estado (inicio/éxito/fallo), latencia y `radicadoId` de correlación, reutilizando `sanitizar-observabilidad`; instrumentación de los 4 flujos en su capa server (`app/api/radicacion`, `app/api/radicados/[radicadoId]/{asignar,prorroga,resolver}`, `lib/actions/*`, `lib/acciones/resolver-radicado.ts`); documento de estándar; actualización de `docs/observability.md` para cubrir flujos institucionales; test unitario del primitivo (que verifique saneo de PII y forma del evento).
- **NO ENTRA:** dashboards de visualización, alertas Sentry configuradas por umbral, presupuestos de rendimiento/Lighthouse (eso es P-B/rendimiento, Ola 2), instrumentación de SIMI/IA (ya cubierta por `registrarLogIA`), instrumentación de flujos no críticos (planillas, salidas, control interno) — se harán al tocarlos con la plantilla.

### 3. ADRs asociados
- **ADR-0005 · Estándar de observabilidad de flujos críticos.** Define el primitivo de evento de negocio, su contrato (campos, saneo de PII, correlación por `radicadoId`), el destino (stderr estructurado + Sentry breadcrumb/transacción), y la plantilla obligatoria "módulo nace instrumentado".

### 4. Dependencias técnicas
- Reutiliza `lib/logger.ts` y `lib/seguridad/sanitizar-observabilidad.ts` (no duplicar saneo — Principio 3).
- Toma como referencia de forma el patrón de `lib/ai/telemetry.ts` (éxito+latencia), sin acoplarse a `ai_logs`.
- **Es fundacional para Olas 2-3** (auditor de rendimiento y medición de IA), no para los otros dos frentes de la Ola 1.
- Sin dependencia de nuevas colecciones Firestore obligatoria: el estándar debe poder emitir a log estructurado/Sentry sin escribir en Firestore (evita el costo de lecturas/escrituras y el riesgo R3). Si se decidiera persistir en una colección, eso es cambio de modelo → nuevo triaje Nivel 3 (fuera del alcance de la Ola 1).

### 5. Riesgos y mitigaciones
- **Fuga de PII en las trazas** (nombre/documento del solicitante). *Mitigación:* todo evento pasa por `sanitizar-observabilidad`; el test del primitivo incluye un caso que inyecta PII y verifica que no aparece. Revisión cruzada de `seguridad` obligatoria.
- **Sobrecarga/latencia por instrumentar en caliente.** *Mitigación:* emisión síncrona a stderr (barata) y Sentry en modo no-op si no hay DSN; nada bloqueante; sin escritura Firestore en el camino crítico.
- **Instrumentación inconsistente entre flujos.** *Mitigación:* la plantilla del ADR fija los puntos obligatorios (inicio, éxito, fallo, latencia) y el criterio de aceptación se verifica por flujo.
- **Doble registro con `logError` existente.** *Mitigación:* el primitivo de negocio y `logError` se coordinan (error de negocio emite ambos con el mismo `radicadoId`); el ADR define la relación.

### 6. Criterios de aceptación (verificables)
- Los 4 flujos emiten evento estructurado de **inicio, éxito y fallo** con `radicadoId`, `modulo`, `latenciaMs` y estado — verificable leyendo la salida en una corrida de los E2E existentes (01, 08, 09).
- Test unitario del primitivo verde: forma del evento correcta y **PII saneada** (caso negativo incluido).
- `docs/observability.md` actualizado: sección de flujos institucionales con el esquema del evento.
- Las 828+ unitarias y 16 E2E existentes siguen **verdes** (sin regresión).

### 7. Estimación de esfuerzo — **M**
Supuestos declarados (Principio 13; sin acceso a la funcionaria, `product-owner` los afina):
- El primitivo reutiliza el saneo y el patrón de Sentry ya existentes → bajo costo de diseño.
- Los 4 endpoints ya tienen puntos de fallo instrumentados; el trabajo es añadir éxito+latencia+correlación en ~5-7 archivos server.
- Sin nueva colección ni migración de datos.

### 8. Evidencia esperada para cierre
- ADR-0005 aprobado y enlazado.
- `lib/` con el primitivo + su test unitario **verde** en CI.
- 4 flujos instrumentados (diff visible en los archivos server citados).
- `docs/observability.md` actualizado.
- Corrida CI completa verde (lint, tsc, unitarias, build) + E2E sin regresión.
- Entrada en retrospectiva `docs/retrospectivas/`.

### Roles (implementación y revisión cruzada)
- **Diseño/ADR:** `arquitecto-principal` (estándar) — revisado por el propietario vía ADR.
- **Implementación:** `dev-backend` (primitivo + instrumentación de endpoints/actions); `devops` si toca wiring de Sentry/CI.
- **Revisión cruzada:** `seguridad` (no fuga de PII — matriz: `dev-backend` → `seguridad`); `arquitecto-principal` (coherencia del estándar).
- **Verificación:** `qa` contra los criterios de aceptación (evidencia).
- **Documentación:** `documentacion` actualiza `observability.md`, revisado por `dev-backend`.

---

# FRENTE P-A/H2 · Control de identidad reservada

### 1. Objetivos
- Cerrar el hallazgo **H2** (`docs/REGISTRO_RIESGOS.md`): hacer efectiva la reserva de identidad en **todas** las vistas internas de gestión, no solo en el mostrador.
- Dejar el control **protegido por prueba de regresión** (invertir `e2e/07`), de modo que reaparecer la fuga rompa CI.

### 2. Alcance
- **ENTRA:**
  - Extraer `identidadProtegida` a **utilidad compartida** (p. ej. `lib/seguridad/identidad-protegida.ts`) y reutilizarla (Principio 3) — hoy está duplicable y local.
  - Aplicar el enmascaramiento en las fugas confirmadas de `app/interno/dashboard/page.tsx`: detalle `~2492-2501`, bandeja de asignación `~4290-4292`, filas `~1495/1585/2223/2547`, **y la exportación CSV/Excel `~3687-3692`**.
  - Invertir `e2e/07-identidad-reservada.spec.ts` para afirmar el enmascaramiento (control de regresión).
  - Test unitario de la utilidad compartida.
- **NO ENTRA (salvo que la decisión de producto lo incluya, ver §3):** el mecanismo de **revelación con traza** (botón "revelar bajo registro" + evento de auditoría de quién ve el dato). Si se opta por enmascarar-por-defecto **sin** revelación, la traza de revelación se difiere. Tampoco entra rediseño del modelo de permisos por rol/tenant más allá de la guarda booleana.
- **Fuera de alcance explícito:** R6 y unidad de prórroga (van a Ola 2/P-A), aunque comparten el pilar P-A.

### 3. ADRs asociados
- **ADR-0006 · Enmascaramiento de identidad reservada en vistas internas.** Registra la **decisión de producto+normativa**: variante (A) enmascarar-por-defecto para todos los roles internos, o (B) enmascarar salvo revelación explícita con traza de auditoría por necesidad de conocer. El concepto de `CONCEPTO_NORMATIVO_FASE2.md` §H2 recomienda que la revelación quede trazada; la elección entre A y B es de `product-owner` con base de `gobierno-digital`. El ADR también fija que la exportación nunca revela.

### 4. Dependencias técnicas
- **Independiente de P-C y P-B.** Sinergia opcional: si se elige la variante (B), el evento "revelación de identidad reservada" debería emitirse con el primitivo de P-C — pero no es bloqueante; puede usar `logError`/auditoría existente si P-C aún no cerró.
- Reutiliza el patrón ya probado en `consulta-publica-radicado.ts` y `reportes-mipg/sanitizar.ts`.
- Toca `types/` solo si se añade un campo; **no se prevé** cambio de tipos (la guarda usa campos existentes `identidadReservada`/`esAnonimo`).

### 5. Riesgos y mitigaciones
- **Falso sentido de seguridad si queda una vista sin cubrir.** *Mitigación:* inventario cerrado de fugas (arriba, citado por línea) + búsqueda exhaustiva de usos de `solicitante.nombreCompleto`/`numeroDocumento` en las vistas internas antes de cerrar; `qa` valida cada punto.
- **Romper el flujo operativo legítimo** (un funcionario que sí necesita el dato para tramitar). *Mitigación:* la decisión A/B del ADR-0006 resuelve esto; si es (B), la revelación con traza preserva la operación.
- **Regresión futura al añadir nuevas vistas.** *Mitigación:* la utilidad compartida + el E2E 07 invertido como control; recomendable lint/revisión que señale acceso directo a `nombreCompleto` en vistas internas (nota para Ola 2, no bloqueante).
- **La exportación** es el vector de mayor impacto (exfiltración masiva). *Mitigación:* tratada explícitamente en el alcance y en el ADR.

### 6. Criterios de aceptación (verificables)
- En un radicado con `identidadReservada`/`esAnonimo`, **ninguna** vista interna (detalle, bandejas, listas, exportación) muestra nombre/documento/correo/teléfono/dirección en claro (o los muestra solo tras revelación trazada si es variante B).
- `e2e/07` **invertido y verde**: afirma "Identidad protegida" donde antes afirmaba la fuga.
- Test unitario de `identidad-protegida` verde.
- Concepto de `gobierno-digital`: **CONFORME** con Ley 1581 art. 4 f/g/h.
- Sin regresión en la suite completa.

### 7. Estimación de esfuerzo — **S–M**
Supuestos declarados:
- Variante (A) enmascarar-por-defecto: **S** (extraer utilidad + aplicar en ~7 puntos + invertir E2E).
- Variante (B) con revelación trazada: **M** (añade UI de revelación + evento de auditoría).
- La decisión A/B la toma `product-owner`+`gobierno-digital`; el diseño técnico soporta ambas.

### 8. Evidencia esperada para cierre
- ADR-0006 aprobado (con la variante elegida) + concepto normativo CONFORME.
- Utilidad compartida + su test unitario verde.
- `e2e/07` invertido verde; suite completa sin regresión.
- Actualización de la fila **H2** en `docs/REGISTRO_RIESGOS.md` a RESUELTO con trazabilidad (patrón H1/ADR-0003).
- Retrospectiva en `docs/retrospectivas/`.

### Roles (implementación y revisión cruzada)
- **Concepto y decisión:** `gobierno-digital` (base normativa) + `product-owner` (variante A/B) → `arquitecto-principal` valida viabilidad técnica.
- **Implementación:** `dev-frontend` (utilidad compartida + aplicación en las vistas + exportación); `qa` invierte `e2e/07` (tests, `__tests__/e2e`).
- **Revisión cruzada:** `qa` (funcional) + `ux-ui` (fidelidad: cómo se muestra "Identidad protegida") sobre el trabajo de `dev-frontend`; `gobierno-digital` (conformidad) + `seguridad` (PII/exportación).
- **Verificación:** `qa` con veredicto y evidencia.

---

# FRENTE P-B/seguridad · `rules-unit-testing`

### 1. Objetivos
- Cerrar el **riesgo ALTA latente**: aislamiento por `tenantId` en `firestore.rules` sin prueba automática.
- Construir una **matriz tenant×rol×colección×operación** ejecutada contra el emulador en CI, que falle si una regla se relaja indebidamente.

### 2. Alcance
- **ENTRA:**
  - Añadir `@firebase/rules-unit-testing` a `devDependencies`.
  - Harness de pruebas de reglas (script + suite) que carga `firestore.rules` en el emulador.
  - Matriz **mínima pero representativa** priorizando el aislamiento por tenant y los `deny` clave:
    - `ventanilla_radicados` (+`/trazabilidad`): `FUNCIONARIO`/`JEFE_DEPENDENCIA` de tenant A **no** leen radicado de tenant B; `RECEPCIONISTA`/`ADMIN`/`CONTROL_INTERNO` sí (cross-tenant esperado); `create` solo `ADMIN`/`RECEPCIONISTA`; `update/delete` siempre denegados (mutación server-side).
    - `ventanilla_salidas`: aislamiento por `dependenciaOrigen`.
    - `control_interno_*`: aislamiento por `tenantId` (Jefe/Funcionario solo su tenant; Control Interno/Admin todo).
    - `users`, `counters`, `ai_*`, `admin_auditoria`, `simi_auditoria`, `ventanilla_planillas`: casos de lectura por rol y `write:false` donde aplica.
    - Catch-all: colección arbitraria → deny para todos.
  - Integración en CI: nuevo job (o paso del job `laboratorio-emulador`) que corra la suite con Java 21 vía `emulators:exec`.
- **NO ENTRA:** pruebas de `storage.rules` (registrar como candidata; el riesgo declarado es de Firestore), presupuestos de rendimiento, orquestador/informe pre-deploy (Ola 2/4), reescritura de reglas (solo se prueban las vigentes; si la prueba revela un hueco real, se abre hallazgo nuevo bajo el ciclo).

### 3. ADRs asociados
- **ADR-0007 · Pruebas unitarias de reglas Firestore (rules-unit-testing).** Registra la introducción de la dependencia, la ubicación del harness, el alcance de la matriz mínima y la política: toda nueva colección/regla nace con su fila en la matriz (extiende la plantilla de P-C al plano de seguridad).

### 4. Dependencias técnicas
- **Independiente de P-C y P-A/H2.** Se apoya en infraestructura ya existente y probada: el job CI `laboratorio-emulador` (ADR-0002), `firebase.json` (puerto 8080), Java 21 en CI.
- Nueva dependencia npm (`@firebase/rules-unit-testing`) — impacto en `npm audit` gate: verificar que no introduzca vulnerabilidad ALTA (es dev-dependency).
- Local: correrá en CI; localmente best-effort vía Docker (no bloqueante — misma restricción documentada en ADR-0002).

### 5. Riesgos y mitigaciones
- **La suite prueba lo que las reglas hacen, no lo que deberían hacer** (podría "verdear" un hueco existente). *Mitigación:* la matriz se diseña desde el **invariante de aislamiento** (lo esperado normativamente), no leyendo la regla; si un caso esperado-denegado pasa hoy, es un hallazgo nuevo → ciclo de hallazgos.
- **Flakiness del emulador en CI.** *Mitigación:* reutilizar el patrón `emulators:exec` ya estable; timeouts holgados; el harness limpia estado entre casos.
- **Costo de mantenimiento de la matriz.** *Mitigación:* matriz mínima y tabular; política de "nueva colección → nueva fila" en el ADR.
- **`npm audit --audit-level=high` podría fallar** por la nueva dependencia. *Mitigación:* `seguridad`/`devops` verifican el árbol antes de fijar versión.

### 6. Criterios de aceptación (verificables)
- Suite de reglas **verde en CI** contra el emulador, cubriendo al menos: aislamiento tenant en `ventanilla_radicados`+`trazabilidad`, `ventanilla_salidas`, `control_interno_*`; `write:false` en colecciones inmutables; catch-all deny.
- **Prueba de mutación (autovalidación del control):** relajar temporalmente una regla de tenant hace fallar al menos un caso — evidencia de que la matriz detecta la regresión (se documenta, no se deja el cambio).
- El job CI está enlazado y es obligatorio para merge.
- `npm audit` gate sigue verde.

### 7. Estimación de esfuerzo — **M**
Supuestos declarados:
- El emulador y el job CI ya existen; el trabajo nuevo es la dependencia + el harness + la matriz.
- Matriz mínima ≈ 5 colecciones núcleo × roles relevantes × operaciones clave (no exhaustiva sobre las 15+ colecciones en la Ola 1).
- `firestore-datos`+`seguridad` conocen el modelo de tenant; bajo riesgo de diseño.

### 8. Evidencia esperada para cierre
- ADR-0007 aprobado.
- `package.json` con la dependencia; harness + suite en el repo.
- Job CI verde + evidencia de la prueba de mutación (que la matriz falla cuando debe).
- Actualización de la fila "Reglas de Firestore sin prueba unitaria" en `docs/REGISTRO_RIESGOS.md` (§2 de PLAN_FASE3) a RESUELTO con trazabilidad.
- Retrospectiva en `docs/retrospectivas/`.

### Roles (implementación y revisión cruzada)
- **Diseño de la matriz/ADR:** `seguridad` + `firestore-datos` (modelo de tenant) → `arquitecto-principal` valida (rediseño no previsto, pero la matriz define el invariante).
- **Implementación:** `qa` (suite de aserciones, en `__tests__/`); `devops` (job CI + dependencia); `firestore-datos` como referente del modelo.
- **Revisión cruzada:** `seguridad` (matriz: `firestore-datos` → `dev-backend` + `seguridad`); `devops` revisado por `seguridad` (secretos/pipeline). `qa` revisado por el rol del área (¿la matriz prueba el invariante correcto? → `seguridad`).
- **Verificación:** `qa` + `seguridad` con veredicto y evidencia (incluida la prueba de mutación).

---

## Dependencias y orden interno de la Ola 1

```
ADR-0004 (levanta congelamiento gobernado) ── habilita ──► los 3 frentes

P-C ─┐ (fundacional para Olas 2-3; NO bloquea a H2 ni P-B en esta ola)
     ├─ paralelizables ─ P-A/H2   (independiente)
     └─                  P-B       (independiente)

Sinergia opcional (no bloqueante): si H2 elige variante (B),
el evento "revelación de identidad" debería emitirse con el primitivo de P-C.
```

- **Orden recomendado si hay que serializar** (un solo implementador a la vez): (1) **P-B/seguridad** primero — cierra el riesgo **ALTA** con infra ya existente y esfuerzo acotado; (2) **P-A/H2** — cierra el mayor riesgo normativo abierto, bajo riesgo técnico; (3) **P-C** — mayor superficie de cambio, pero su valor (medición) se cobra en Olas 2-3, así que puede ir de último sin bloquear a nadie.
- **Si hay capacidad para paralelizar:** los tres avanzan en paralelo; P-C debe cerrar **antes** de abrir la Ola 2 (auditor de rendimiento y medición de IA lo requieren).
- **Puntos de contacto entre frentes (coordinar para no pisarse):** P-C y H2 tocan ambos zonas de `app/interno/dashboard/page.tsx` (P-C en los endpoints/actions server; H2 en el render de las vistas). El solapamiento es bajo (capas distintas), pero el coordinador debe secuenciar los merges para evitar conflictos en ese archivo de 5040 líneas.

## Gobernanza y cumplimiento del modelo

- Cada frente cierra bajo el **ciclo permanente de hallazgos**: Riesgo (ya registrado) → ADR (0005/0006/0007) → Implementación → Pruebas → Revisión cruzada (matriz `.claude/agents/README.md`) → Evidencia → Cierre trazable en `docs/REGISTRO_RIESGOS.md`.
- **Ningún frente se cierra sin control automatizado de regresión:** P-C (test del primitivo + saneo PII), H2 (`e2e/07` invertido + unitario), P-B (suite de reglas + prueba de mutación).
- No se amplía el alcance más allá de los 3 frentes. R6, unidad de prórroga, R3, auditor normativo, presupuestos de rendimiento y orquestador quedan en Olas 2+ (fuera de este plan).

## Deuda técnica declarada (aceptable en la Ola 1)

- **Local sin emulador (P-B):** la suite de reglas corre en CI, no localmente (Java 8 / sin Docker). Aceptable: misma restricción ya asumida en ADR-0002; CI es la compuerta autoritativa.
- **Persistencia de métricas (P-C):** el primitivo emite a log estructurado + Sentry, sin colección Firestore de métricas. Aceptable por YAGNI y por evitar costo de lecturas/riesgo R3; si en Olas 2-3 el auditor de rendimiento necesita histórico consultable, se evalúa por ADR (nuevo triaje Nivel 3).
- **Cobertura parcial de flujos (P-C):** solo los 4 críticos se instrumentan ahora; el resto (planillas, salidas, control interno, SIMI institucional) se instrumenta al tocarlos con la plantilla. Aceptable: la plantilla evita deuda futura.
- **Matriz de reglas no exhaustiva (P-B):** cubre las colecciones núcleo de aislamiento por tenant, no las 15+. Aceptable: prioriza el invariante ALTA; la política "nueva colección → nueva fila" evita que la brecha crezca.
- **Revelación con traza diferible (H2):** si `product-owner` elige la variante (A), no habrá mecanismo de revelación auditada en la Ola 1. Aceptable solo si la operación no lo requiere; queda registrado para reevaluación.
- **`storage.rules` sin prueba (P-B):** fuera de alcance; registrar como candidata post-Ola-1 (el riesgo declarado es de Firestore).
- **Deuda de gobernanza:** levantar el congelamiento reintroduce riesgo de scope creep (`PLAN_FASE3.md` §2). Mitigada por ADR-0004 + triaje + este alcance cerrado.
