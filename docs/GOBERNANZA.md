# Gobernanza técnica de la plataforma

- **Fecha de esta versión:** 2026-07-13
- **Estado:** vigente — congelamiento de consolidación activo (ver §7)
- **Naturaleza del documento:** referencia única del modelo de gobernanza técnica.
  No narra historia; describe el estado actual y enlaza, para cada afirmación, al
  artefacto del repositorio que la respalda. Si un enlace se rompe o el código
  cambia, este documento queda desactualizado y debe corregirse.

---

## 1. Propósito y principios permanentes

Este documento consolida el conocimiento de gobernanza generado durante la
Ola 1 y la Ola 2 (Fase 3) e institucionaliza las capacidades construidas —
controles automatizados, compuerta de despliegue, ciclo de hallazgos— como
parte permanente del modelo de gobernanza de la plataforma, no como artefactos
de una fase que termina.

### a) Principio de ritmo vs. calidad (institucionalizado 2026-07-13)

> "El ritmo de evolución nunca será más importante que la calidad de la
> arquitectura. Cada nueva fase deberá demostrar, con evidencia objetiva, que
> mejora la mantenibilidad, la auditabilidad, la escalabilidad y la gobernanza
> respecto de la fase anterior."

Este principio es un decreto directo del propietario incorporado en esta
consolidación. Está formalizado como decisión de arquitectura en
[ADR-0014](adr/0014-principio-ritmo-vs-calidad.md) (estado: **aceptado por
el propietario el 2026-07-13**), que registra el texto literal,
su rango (equivalente a los 13 principios de ADR-0001) y el criterio de
verificación: al cierre de cada fase, evidencia objetiva de mejora en las
cuatro dimensiones —mantenibilidad, auditabilidad, escalabilidad y
gobernanza— respecto de la fase anterior, apoyada en los mecanismos ya
existentes (compuerta ADR-0013, presupuesto ADR-0011, registro de riesgos,
retrospectivas).

### b) Ciclo obligatorio de todo hallazgo

Definido como "principio permanente" en
[`docs/REGISTRO_RIESGOS.md` §Regla de operación](REGISTRO_RIESGOS.md#regla-de-operación):

> Riesgo → Decisión de arquitectura (ADR) → Implementación → Pruebas →
> Revisión cruzada → Evidencia → Cierre trazable. **Ninguna corrección se
> acepta sin un control automatizado capaz de detectar su regresión.**

Ejemplar de referencia citado en el propio registro: H1
([ADR-0003](adr/0003-control-de-prorroga-ley-1755.md)). El registro exige
además que un hallazgo **ALTA** no se cierre por olvido ni por vencimiento de
sprint, solo por resolución técnica verificada o por aceptación formal del
riesgo con fecha y motivo.

### c) Criterio de éxito (5 métricas)

Institucionalizado el 2026-07-11 en
[`docs/PLANIFICACION_EJECUTIVA_FASE3.md` §Métricas](PLANIFICACION_EJECUTIVA_FASE3.md):

> Menos trabajo manual · más evidencia automatizada · menor riesgo por
> despliegue · mayor capacidad de escalar sin perder confiabilidad · mayor
> trazabilidad de decisiones.

Con referencia de arquitectura explícita en el mismo documento: **"la
plataforma debe seguir siendo mantenible, auditable y escalable dentro de
5–10 años, adoptable por cualquier municipio colombiano."**

### d) Escalabilidad como requisito de arquitectura permanente

No es un frente de trabajo puntual: es la referencia contra la que se evalúa
cada decisión desde
[`docs/PLANIFICACION_EJECUTIVA_FASE3.md`](PLANIFICACION_EJECUTIVA_FASE3.md) en
adelante, y el motivo declarado de la Ola 2 completa
([ADR-0009](adr/0009-levantamiento-gobernado-ola2.md)). El caso de estudio
resuelto es R11 (§5): la arquitectura de consulta que leía la colección
completa se corrigió y quedó protegida por un control de regresión probado
por mutación ([ADR-0010](adr/0010-escalabilidad-consulta-radicados.md),
[ADR-0011](adr/0011-auditor-rendimiento-presupuestos.md)).

### e) Invariantes no negociables

Definidos en [`AGENTS.md` §Regla Suprema §Alcance](../AGENTS.md): la Regla
Suprema gobierna reglas de *proceso*, no autoriza a saltarse:

- **Aislamiento por `tenantId`** — verificado por comportamiento (no solo
  sintaxis) en [ADR-0007](adr/0007-rules-unit-testing-aislamiento-tenant.md) y
  cerrado en escritura de trazabilidad por
  [ADR-0008](adr/0008-aislamiento-trazabilidad-cross-tenant.md).
- **IA sugiere / funcionario decide** — Principio 9 de `AGENTS.md`; formulado
  también en [`docs/ai-governance.md`](ai-governance.md): *"Los agentes de IA
  recomiendan; los funcionarios humanos deciden."*
- **Protección de datos personales** — Ley 1581/2012 art. 4 f/g/h; control
  vigente vía enmascaramiento transversal de identidad reservada
  ([ADR-0006](adr/0006-enmascaramiento-identidad-reservada.md)).
- **Normativa vigente** — controles ejecutables que verifican cumplimiento de
  leyes específicas (1755/2015, 1581/2012) en la propia suite de pruebas
  (§2, categoría normativo).

---

## 2. Mapa de controles automatizados

Todos los controles corren en
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml), repartidos en dos
jobs de control (`validate`, `laboratorio-emulador`) que alimentan el job de
informe (`informe-despliegue`, §3).

| Control | Riesgo/garantía que cubre | Dónde corre | Evidencia (ADR + prueba de mutación) |
|---|---|---|---|
| **Lint (ESLint)** | Consistencia de código, errores estáticos | `ci.yml` job `validate` · paso `Lint Check` | — (gate estándar, sin ADR propio) |
| **TypeScript (`tsc --noEmit`)** | Corrección de tipos, `strict: true` | `ci.yml` job `validate` · paso `TypeScript Compile Check` | — (gate estándar, sin ADR propio) |
| **Suite unitaria/integración (vitest)** | Corrección funcional general | `ci.yml` job `validate` · paso `Test Suite` (`npm test`) | — |
| **Controles normativos ejecutables** (dentro de la suite): `prorroga-validacion` (H1/R6), `coincidencia-filtro-rapido` (R9), identidad reservada (H2) | Ley 1755/2015 art. 14 (prórroga); Ley 1581/2012 art. 4 f/g (identidad reservada) | Mismos archivos de test, ejecutados en el paso `Test Suite` | [ADR-0003](adr/0003-control-de-prorroga-ley-1755.md) (H1, `__tests__/prorroga-validacion.test.ts`, probado por mutación: E2E 09 invertido); [ADR-0012](adr/0012-controles-normativos-ejecutables.md) (R6/R9, `__tests__/prorroga-validacion.test.ts`, `__tests__/coincidencia-filtro-rapido.test.ts`); [ADR-0006](adr/0006-enmascaramiento-identidad-reservada.md) (H2, helper `lib/seguridad/identidad-protegida.ts`, `e2e/07-identidad-reservada.spec.ts` extendido) |
| **Presupuesto de rendimiento (R11)** | Regresión de escala: consultas O(N) sin `limit()`/cursor sobre `ventanilla_radicados` | `ci.yml` job `validate` · paso `Presupuesto de Rendimiento` (`npm run presupuesto:rendimiento`) → [`scripts/laboratorio/presupuesto-rendimiento.mjs`](../scripts/laboratorio/presupuesto-rendimiento.mjs) | [ADR-0011](adr/0011-auditor-rendimiento-presupuestos.md); análisis estático determinista, "probado por mutación" según el propio ADR (una consulta ilimitada nueva o una cota que pierde su `limit()` rompe el job) |
| **`npm audit` (`--audit-level=high`)** | Vulnerabilidades de dependencias de severidad alta o crítica | `ci.yml` job `validate` · paso `Security Scan` | — (gate estándar, sin ADR propio) |
| **Production build (`next build`)** | El proyecto compila y empaqueta correctamente | `ci.yml` job `validate` · paso `Production Build Check` | — |
| **Sonda de emulador (canario)** | El emulador Firestore arranca, las reglas cargan y responden | `ci.yml` job `laboratorio-emulador` · paso `Emulador + reglas + sonda canario` (`scripts/laboratorio/probar-emulador.mjs`) | [ADR-0002](adr/0002-laboratorio-institucional-de-calidad.md) |
| **Matriz de aislamiento por tenant (`rules-unit-testing`)** | Invariante de aislamiento `tenantId` por comportamiento (no solo sintaxis) de `firestore.rules` | `ci.yml` job `laboratorio-emulador` · paso `Matriz de aislamiento por tenant` (`npm run test:rules` → `e2e/rules/matriz-aislamiento-tenant.test.mjs`) | [ADR-0007](adr/0007-rules-unit-testing-aislamiento-tenant.md) (cobertura núcleo); [ADR-0008](adr/0008-aislamiento-trazabilidad-cross-tenant.md) (R8, caso volteado de `'permitido'` a `'denegado'` como control de regresión — mutación explícita) |
| **Compuerta de despliegue (informe agregado)** | Ningún cambio llega a producción sin evidencia objetiva agregada de las cinco categorías | `ci.yml` job `informe-despliegue` → [`scripts/laboratorio/informe-despliegue.mjs`](../scripts/laboratorio/informe-despliegue.mjs) | [ADR-0013](adr/0013-compuerta-despliegue-gobernanza.md); probado por mutación según el propio ADR: forzar un control a rojo debe producir informe rojo |

**Nota de cobertura declarada como deuda** (no oculta): el registro de riesgos
documenta dos huecos del propio mapa de controles —
[R14](REGISTRO_RIESGOS.md) (el campo `evidencia` del informe es afirmación,
no verificación de que el test declarado exista y no esté `.skip`) y
[R15](REGISTRO_RIESGOS.md) (`storage.rules` y una categoría de IA/SIMI no
están cubiertas por la compuerta todavía). Ambos ABIERTOS en backlog, ver §5.

---

## 3. Compuerta de despliegue (ADR-0013)

Fuente de diseño: [ADR-0013](adr/0013-compuerta-despliegue-gobernanza.md).
Implementación: [`scripts/laboratorio/informe-despliegue.mjs`](../scripts/laboratorio/informe-despliegue.mjs),
invocada como job final `informe-despliegue` en
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml), que agrega los
`outcome` de los jobs `validate` y `laboratorio-emulador`.

### 3.1 Categorías agregadas

Definidas en el código (`scripts/laboratorio/informe-despliegue.mjs`, bloque
`CATEGORIAS`) siguiendo ADR-0013 §Decisión.2:

| Categoría | Fuentes que agrega |
|---|---|
| **Funcional** | lint · tsc · suite unitaria/integración · build · E2E de stage (input registrado, ver 3.3) |
| **Normativo** | controles normativos ejecutables (viven dentro de la suite unitaria: `normograma-nucleo`, `pqrsd-validacion`, `pqrsd-verbal`, `prorroga-validacion`, `consulta-publica-*`, `serie-documental`, `numero-radicado`) |
| **Seguridad** | matriz de aislamiento por tenant (`rules-unit-testing`) · `npm audit` |
| **Rendimiento** | presupuesto de rendimiento (R11, ADR-0011) |
| **Observabilidad** | suite de observabilidad (`observabilidad-lectura`, `sanitizar-observabilidad`, `eventos-negocio`) · configuración de Sentry presente (verificación estructural de archivos `sentry.*.config.ts`) |

### 3.2 Semáforo y significado del veredicto

Cada categoría toma el **peor** estado de sus fuentes (🔴 rojo > 🟡 amber >
🟢 verde); una fuente sin señal utilizable **no se pinta verde** — cuenta
como amber. El veredicto global es el peor de las categorías:

- 🟢 **VERDE — desplegable.** Todos los controles en verde y E2E fresco
  contra el SHA candidato. El disparo del despliegue sigue siendo humano
  (regla operativa vigente, no automatizada por este informe).
- 🟡 **AMBER — desplegable solo con aceptación explícita del propietario
  registrada.** Típicamente porque el E2E de stage no corrió contra el SHA
  candidato. La compuerta **no bloquea el merge** en este estado (`exit 0`).
- 🔴 **ROJO — bloqueado.** Al menos un control está en rojo. `exit 1`; con
  branch protection aplicada (§3.4), bloquea el merge.

### 3.3 El E2E de stage como input registrado

El E2E de stage **no corre en CI** (requiere stage + credenciales). El
informe lo trata como un input registrado por el coordinador en
[`docs/auditorias/e2e-ultimo.json`](auditorias/e2e-ultimo.json)
(`{ sha, fecha, resultado }`):

- `resultado: 'rojo'` → 🔴.
- `resultado: 'verde'` y `sha` coincide con el SHA candidato de la corrida →
  🟢.
- `resultado: 'verde'` pero `sha` no coincide (o está ausente) → 🟡, "sin
  corrida reciente". El informe **nunca inventa un verde** si no hay dato
  contra el SHA candidato.

Estado actual del archivo (verificado al redactar este documento):
`resultado: "pendiente"`, `sha: "PENDIENTE"` — no hay todavía una corrida E2E
de stage registrada contra un SHA real. Detalle del formato en
[`docs/auditorias/README-e2e-input.md`](auditorias/README-e2e-input.md).

### 3.4 Branch protection — pieza PENDIENTE

ADR-0013 define la compuerta como **dos piezas**: (1) el informe agregado
(implementado y descrito arriba) y (2) la **precondición dura de `main`**
mediante branch protection de GitHub, que exige que los checks de CI pasen
antes de mergear. La segunda pieza es una **acción de administración de
GitHub** (requiere permisos de administrador del repositorio) que el ADR
documenta como pendiente si excede los permisos disponibles al momento de
escribirlo.

Checks requeridos a exigir en la configuración de branch protection de
`main`, según los jobs definidos en `ci.yml`:

- `validate` — nombre visible del check: **"Build & Security Gates"**
- `laboratorio-emulador` — nombre visible: **"Laboratorio - Emulador Firestore (Fase 1)"**
- `informe-despliegue` — nombre visible: **"Compuerta de despliegue — Informe de gobernanza (ADR-0013, 2D)"**

Precisión de configuración: GitHub identifica los checks requeridos por el
**nombre visible** del job (campo `name:` en `ci.yml`), no por su id — al
configurar branch protection deben usarse los nombres visibles exactos de
arriba. Nota de conciliación con ADR-0013: su §Decisión.1 nombra solo
`validate` + `laboratorio-emulador` porque al redactarse el informe aún no
existía como job propio ("un paso de CI"); su §Control de regresión exige que
un informe ROJO bloquee el merge con branch protection, lo que requiere
incluir `informe-despliegue` entre los checks requeridos — es el **único**
job en rojo cuando el rojo proviene del input E2E registrado
(`resultado: 'rojo'` o registro ilegible), caso en el que `validate` y
`laboratorio-emulador` siguen verdes.

Sin esta pieza aplicada, un cambio con CI en rojo podría técnicamente
mergearse a `main` — el informe seguiría reportando ROJO, pero no bloquearía
el merge por sí mismo. Es una de las dos precondiciones que el propietario
fijó para levantar el congelamiento vigente (§7).

---

## 4. Inventario de ADRs

| # | Título | Estado | Qué gobierna |
|---|---|---|---|
| [0001](adr/0001-sistema-operativo-de-ingenieria.md) | Adopción del sistema operativo de ingeniería (visión, Regla Suprema y 13 principios) | aceptado | Marco de gobernanza de proceso: triaje de proporcionalidad, Regla Suprema, 13 principios vinculantes (`AGENTS.md`) |
| [0002](adr/0002-laboratorio-institucional-de-calidad.md) | Laboratorio Institucional de Calidad y congelamiento de arquitectura | aceptado | Arquitectura de entornos DEV/STAGE/PROD, primer congelamiento de arquitectura |
| [0003](adr/0003-control-de-prorroga-ley-1755.md) | Control ejecutable de prórroga (unicidad y tope legal, Ley 1755 art. 14) | aceptado | Cierre de H1 — excepción controlada al congelamiento; modelo de referencia del ciclo de hallazgos |
| [0004](adr/0004-levantamiento-gobernado-ola1.md) | Levantamiento gobernado del congelamiento para la Ola 1 (Fase 3) | aceptado | Alcance autorizado de la Ola 1: P-C, P-A/H2, P-B |
| [0005](adr/0005-observabilidad-flujos-criticos.md) | Observabilidad de flujos críticos (P-C, Ola 1) | aceptado | Instrumentación de radicación, asignación, prórroga, respuesta con evento estructurado sin PII |
| [0006](adr/0006-enmascaramiento-identidad-reservada.md) | Enmascaramiento transversal de identidad reservada (H2, variante A) | aceptado | Cierre de H2 — enmascarar por defecto en todas las superficies internas y exportación |
| [0007](adr/0007-rules-unit-testing-aislamiento-tenant.md) | Pruebas unitarias de reglas Firestore (aislamiento por tenant) | aceptado | Matriz tenant × rol × colección contra el emulador en CI |
| [0008](adr/0008-aislamiento-trazabilidad-cross-tenant.md) | Cierre del aislamiento por tenant en la escritura de trazabilidad (R8) | aceptado | Endurecimiento de `canWriteTrazabilidad` en `firestore.rules` |
| [0009](adr/0009-levantamiento-gobernado-ola2.md) | Levantamiento gobernado del congelamiento para la Ola 2 (Fase 3) | aceptado | Alcance autorizado de la Ola 2: 2A–2E, disciplina de cierre por evidencia |
| [0010](adr/0010-escalabilidad-consulta-radicados.md) | Escalabilidad de la consulta de radicados: paginación por cursor + ventana del stream (2A, R11) | aceptado | Cierre de R11 — acotamiento de lecturas de `ventanilla_radicados` |
| [0011](adr/0011-auditor-rendimiento-presupuestos.md) | Auditor de rendimiento y presupuestos en CI sobre la señal de observabilidad (2B) | aceptado | Presupuesto de rendimiento como control de regresión de escala |
| [0012](adr/0012-controles-normativos-ejecutables.md) | Controles normativos ejecutables: R6 y R9 (2C) | aceptado | Conversión de R6 (temporalidad de prórroga) y R9 (anti-inferencia en filtros) a controles ejecutables |
| [0013](adr/0013-compuerta-despliegue-gobernanza.md) | Compuerta de despliegue como mecanismo de gobernanza técnica (2D) | aceptado | Informe agregado con semáforo + branch protection como precondición dura de `main` |
| [0014](adr/0014-principio-ritmo-vs-calidad.md) | Principio permanente: el ritmo de evolución nunca prevalece sobre la calidad de la arquitectura | aceptado (2026-07-13) | Criterio de cierre de fase: evidencia objetiva de mejora en mantenibilidad, auditabilidad, escalabilidad y gobernanza (§1.a) |
| [0015](adr/0015-estandar-de-evidencia.md) | Estándar de evidencia: ninguna afirmación técnica es un hecho sin evidencia reproducible | aceptado (2026-07-13) | Cinco mandatos rectores (evidencia→medición→reproducción→automatización→re-medición); separación hecho/estimación obligatoria |
| [0016](adr/0016-consecutivo-legal-atomico.md) | Corrección de H3: asignación atómica del consecutivo legal (Bloque 2) | implementación completada — pendiente de validación | Helper de 2 fases + staging→tx→finalize (Admin) + Opción A client-side (interna); invariante no-huérfano; deuda diferida a Bloque 3 |
| [0017](adr/0017-backlog-maestro-y-cobertura.md) | Backlog Maestro de Hallazgos/Requerimientos + Matriz de Cobertura Funcional | aceptado (2026-07-13) | Proceso permanente de gestión de requerimientos: único inventario oficial de trabajo futuro (`docs/BACKLOG_MAESTRO.md`, `docs/MATRIZ_COBERTURA_FUNCIONAL.md`); no autoriza implementación |
| [0018](adr/0018-arquitectura-funcional-y-comparativa.md) | Arquitectura funcional: marco comparativo, naturaleza del requerimiento y compuerta de dos preguntas | aceptado (2026-07-13) | Objetivo: plataforma superior, no réplica. Lente ellos-mejor/nosotros-mejor/simplificar/innovar; naturaleza (Norma/Buena práctica/Operativa/UX/Innovación); dos preguntas antes de proponer desarrollo |
| [0019](adr/0019-transformacion-institucional-automatizar.md) | Transformación institucional: lente "Automatizar", regla de justificación y Plan Maestro de Evolución | aceptado (2026-07-13) | 5.º lente (Automatizar: manual/eliminar/IA-apoyo/aprobación-humana/precarga/tareas-que-desaparecen); regla: no feature por imitación (justificar por J1–J5); backlog → Plan Maestro de Evolución de la Plataforma |
| [0020](adr/0020-plataforma-largo-plazo-valor-neto.md) | Plataforma de largo plazo: rejilla de sostenibilidad, principio de valor neto y decisiones revisables por evidencia | aceptado (2026-07-14) | 6.º lente F (12 dimensiones: escalabilidad/simplicidad/capacitación/carga/SIMI/ciudadano/norma/seguridad/mantenibilidad/reutilización/integraciones/crecimiento modular); Principio de Valor Neto (P3: valor > complejidad, si no se descarta); lente de consolidación; ADRs revisables por evidencia (supersede) |
| [0021](adr/0021-definicion-de-exito-mapa-de-capacidades.md) | Definición de éxito por iniciativa, mapa de capacidades y las Cuatro Preguntas de autorización | aceptado (2026-07-14) | Cada iniciativa lleva definición de éxito medible (objetivo/KPIs/verificación de reducción/beneficios/riesgos/mantenimiento/impacto arquitectura/evolución); relaciones (habilita/depende/consolida/junto/puede esperar) → roadmap arquitectónico por dominios; Cuatro Preguntas ejecutivas (problema real · mejor solución · valor>complejidad · visión largo plazo) — sin superarlas con evidencia, no se propone. Cierra el marco de gobernanza funcional-arquitectónica |
| [0022](adr/0022-arquitectura-funcional-objetivo.md) | Cambio de fase: de análisis a construcción por capacidades sobre una Arquitectura Funcional Objetivo | aceptado (2026-07-14) | Plan Maestro → hoja de ruta por capacidades; se adopta la TFA ([ARQUITECTURA_FUNCIONAL_OBJETIVO.md](ARQUITECTURA_FUNCIONAL_OBJETIVO.md)): 10 dominios, inventario con evidencia, reutiliza/reemplaza/simplifica/innova, roadmap con valor completo por fase; no crear módulos paralelos; ficha completa + Cuatro Preguntas antes de codificar; nada autorizado (Bloque 2 congelado) |

`docs/adr/0000-plantilla.md` es la plantilla de formato, no un ADR sustantivo
— no se incluye en el inventario.

---

## 5. Estado del registro de riesgos

Fuente de verdad viva:
[`docs/REGISTRO_RIESGOS.md`](REGISTRO_RIESGOS.md). Este documento **no**
duplica el detalle — solo resume el estado al momento de redactar esta
versión (2026-07-13); ante cualquier discrepancia futura, el registro manda.

**Resueltos, con control de regresión verificado:**

- **H1** — prórroga sin unicidad ni tope (Ley 1755 art. 14) — [ADR-0003](adr/0003-control-de-prorroga-ley-1755.md).
- **H2** — identidad reservada visible en vistas internas y export — [ADR-0006](adr/0006-enmascaramiento-identidad-reservada.md).
- **R6** — prórroga sobre término ya vencido — [ADR-0012](adr/0012-controles-normativos-ejecutables.md).
- **R8** — aislamiento por tenant incompleto en escritura de trazabilidad — [ADR-0008](adr/0008-aislamiento-trazabilidad-cross-tenant.md).
- **R9** — canal de inferencia en filtros de cliente — [ADR-0012](adr/0012-controles-normativos-ejecutables.md).
- **R11** — consulta de radicados sin cota (mayor límite de escalabilidad) — [ADR-0010](adr/0010-escalabilidad-consulta-radicados.md), [ADR-0011](adr/0011-auditor-rendimiento-presupuestos.md).

**Abiertos (backlog, sin urgencia bloqueante declarada):**

- **R3** — hueco de consecutivo AGN si la subida de adjunto no completa.
- **R4** — modal "Resumen del día" intercepta clics por backdrop.
- **R5** — confirmación "✓ Asignado" puede no mostrarse (carrera de estado).
- **R7** — robustez ante `termino.diasRespuesta` ausente (riesgo teórico, legado).
- **R12** — `ocultarIdentidad` duplica el criterio de `identidadProtegida` en vez de importarlo (deuda DRY sobre un predicado normativamente sensible).
- **R13** — `app/api/cron/alertas-vencimiento/route.ts` lee `ventanilla_radicados` sin cota (fuera de la deuda declarada original de ADR-0010).
- **R14** — la compuerta de despliegue (2D) no verifica que los tests normativos declarados existan y no estén `.skip` — punto ciego del gate.
- **R15** — la compuerta de despliegue no cubre `storage.rules` ni una categoría de IA/SIMI.

**En decisión:**

- **R10** — la variante A de enmascaramiento (H2) oculta la identidad incluso al funcionario responsable que podría necesitarla para tramitar. Conforme hoy, sin urgencia; requiere decisión de producto (dueño: `product-owner`) para definir la variante B (quién revela, bajo qué condición, con qué traza).

---

## 6. Entornos y laboratorio

Arquitectura de entornos definida en
[`docs/laboratorio/ARQUITECTURA_LABORATORIO_CALIDAD.md`](laboratorio/ARQUITECTURA_LABORATORIO_CALIDAD.md)
§2, aprobada por [ADR-0002](adr/0002-laboratorio-institucional-de-calidad.md):

| Entorno | Backend | Frontend | Datos | Propósito |
|---|---|---|---|---|
| **DEV** | Firebase Emulator Suite (Auth + Firestore + Storage) | `next dev` local | Alcaldía Sintética (seed determinista) | Desarrollo diario y tests de integración |
| **STAGE** | Proyecto real `ventanilla-simacota-stage` | Vercel Preview (rama `develop`) | Alcaldía Sintética (re-seedeable) | UAT, auditoría E2E completa, validación pre-despliegue |
| **PROD** | `ventanilla-unica-f31b1` | Vercel Production | Datos institucionales reales | Solo operación real |

**Guarda anti-producción:** los scripts del laboratorio verifican
explícitamente el `project_id` contra la constante
`PROYECTO_PROD = 'ventanilla-unica-f31b1'` y **abortan** si apunta a
producción — verificado en seis scripts:
[`scripts/laboratorio/limpiar-stage.mjs`](../scripts/laboratorio/limpiar-stage.mjs),
[`scripts/laboratorio/dev-stage.mjs`](../scripts/laboratorio/dev-stage.mjs),
`alcaldia-sintetica.ts`, `medir-escala-lectura.mjs`,
`medir-linea-base-lectura.mjs` y `seed-funcionarios-stage.mjs`.
Precisión (corrección de revisión cruzada 2026-07-13): `scripts/uat-1.ts` y
`scripts/laboratorio/instalar-service-account.mjs` **no tienen esta guarda** —
el primero opera deliberadamente contra producción (UAT-1) y el segundo usa el
proyecto de producción como *destino por defecto* de instalación; referencian
la constante, pero no como protección.

**`LAB_PASSWORD`:** credencial de los usuarios sintéticos de stage. Se genera
y persiste en `.env.stage` (no versionado) por
[`scripts/laboratorio/seed-funcionarios-stage.mjs`](../scripts/laboratorio/seed-funcionarios-stage.mjs),
se lee en tests E2E vía [`e2e/env.ts`](../e2e/env.ts) y nunca se imprime en
logs (verificado también como práctica declarada en
`docs/laboratorio/FASE2_BITACORA.md`). No aparece hardcodeada en el código
fuente de la aplicación.

---

## 7. Estado actual (2026-07-13)

**Congelamiento de consolidación vigente.** Durante esta pausa solo se
autorizan documentación, planificación y análisis; está prohibido tocar
código, tests, CI o configuración (salvo excepción controlada explícita del
propietario, siguiendo el mismo patrón que H1 en
[ADR-0003](adr/0003-control-de-prorroga-ley-1755.md)).

Precondiciones fijadas por el propietario para levantar el congelamiento:

1. **Branch protection aplicada en `main`** (§3.4) — acción de
   administración pendiente, con los checks requeridos `validate`,
   `laboratorio-emulador` e `informe-despliegue`.
2. **Validación operativa de la ventana de 180 días** (la ventana temporal
   del stream acotado introducida en la resolución de R11,
   [ADR-0010](adr/0010-escalabilidad-consulta-radicados.md)) **con la
   funcionaria** — confirmar en uso real que la ventana no oculta trabajo
   pendiente ni introduce fricción operativa.

Cumplidas ambas, corresponde presentar el plan de la Ola 3 (2E) para
aprobación del propietario, y solo entonces se levanta el congelamiento para
el alcance autorizado en ese plan.

---

## Dudas abiertas para el propietario / arquitecto

- **Resuelta (revisión cruzada 2026-07-13):** la duda sobre si el principio
  §1(a) merecía ADR propio fue decidida por el arquitecto-principal en
  sentido afirmativo (Principio 6) —
  [ADR-0014](adr/0014-principio-ritmo-vs-calidad.md), **aceptado por el
  propietario el 2026-07-13**.
- La verificación puntual de `docs/auditorias/e2e-ultimo.json` (§3.3) muestra
  `resultado: "pendiente"` al momento de escribir este documento — es un
  hecho verificado del archivo, no una interpretación; se deja constancia
  para que no se lea como un veredicto AMBER "normal" sino como ausencia
  total de registro E2E todavía.
