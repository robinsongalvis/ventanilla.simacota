# ADR-0026 — Motor genérico de expedientes administrativos (SIMI)

- **Estado:** PROPUESTO — decisiones de arquitectura aprobadas por el propietario (23-jul-2026); **implementación suspendida** hasta cumplir precondiciones externas (concepto jurídico, checklist oficial completo, validación con Planeación).
- **Alcance:** decisiones de ARQUITECTURA únicamente (no implementación). Base: blueprint `docs/blueprints/CN-motor-expedientes-administrativos.md` (v2, revisado por panel adversarial de 10 especialistas) y `CN-modulo-planeacion-licencias.md` (v1 + revisión).
- **Nivel 3** (módulo, colección, flujo, integración nuevos).

## Contexto

La Secretaría de Planeación gestiona trámites (primero Licencia de Construcción) cuyo expediente hoy es físico. SIMI ya tiene multi-tenant, radicación server-side, consecutivo legal (H3), trazabilidad append-only, TRD, Storage y roles. Se decide construir un **motor de expedientes** reutilizando esa base, no un módulo aislado ni componentes paralelos.

## Decisiones de arquitectura

### D1 — Motor genérico, con alcance honesto: genérico en la RECEPCIÓN, específico en la RESOLUCIÓN
El motor es trámite-agnóstico en la **fase de intake** (recibir → revisar → completar checklist → handoff → radicar). La **fase de resolución** (concepto vs resolución motivada, visita técnica, citación a colindantes, recursos) **NO es configurable por datos**: se implementa por trámite, en código, con revisión de Gobierno Digital. Se **descarta el workflow-engine configurable** (YAGNI, riesgo de que un administrador dibuje un flujo ilegal, invariantes solo demostrables sobre un enum finito). Adoptamos **esqueleto de estados en código + puntos de variación parametrizados por datos**.

### D2 — Separación Planeación (gestión técnica) ↔ Ventanilla Única (radicación)
Planeación administra el expediente y hace toda la revisión documental. Ventanilla **solo radica** (genera consecutivo, arranca términos); **no evalúa técnicamente**. El interior del expediente es **visible solo para Planeación**; Ventanilla recibe una **proyección minimizada** (lo necesario para radicar), no la PII completa. El paso entre ambos es un **handoff server-side desacoplado**, no escritura cruzada de colecciones.

### D3 — Expediente digital único durante todo el ciclo de vida
Un solo documento raíz por trámite (colección `expedientes`, supersede `planeacion_expedientes`), con subcolecciones `documentos`, `actuaciones`, `observaciones`. Escritura **exclusivamente server-side** (Admin SDK); `create/update/delete: if false` en raíz y subcolecciones (cierra por diseño las clases CR-1/CR-2/R8). El expediente y el radicado quedan **enlazados bidireccionalmente**; el expediente nunca se duplica ni se fragmenta.

### D4 — Checklist parametrizable por tipo de trámite (con requisitos condicionales)
Cada trámite es una **Definición de Trámite** (documento en Firestore, editable desde administración, **no código**): checklist de requisitos, términos, régimen de subsanación, flags de rama. El checklist soporta **requisitos condicionales** (obligatorio / opcional / condicional con regla evaluable) — exigido por el checklist real de Licencia (poder solo si hay apoderado; planos estructurales según categoría de complejidad; estudio de suelos si el proyecto no está sujeto al Título E NSR-10; colindantes salvo predio rodeado de espacio público). Agregar un trámite nuevo de intake = **crear un documento, sin desplegar**.

### D5 — Control de términos que inicia ÚNICAMENTE con la radicación — con salvaguarda legal
El término administrativo (45 días hábiles, Decreto 1077) arranca en la **radicación** (paso de Ventanilla), conforme al procedimiento que quiere la Alcaldía. **PERO** la fase previa de Planeación (revisión/subsanación pre-radicación) **debe tener un plazo reglado máximo** (≤ el que fije la oficina jurídica) con salida forzosa; sin ese tope, un ciudadano que presentó su solicitud completa podría alegar que el término ya corría y provocar **silencio positivo** (Ley 388 art. 99). **Esta decisión queda condicionada al concepto jurídico formal** (ver Precondiciones). El reloj de subsanación se **parametriza por régimen** (`{días, unidad, prórroga, ventana}`) — no se reutiliza el de Ley 1755 (que produciría el plazo legal equivocado).

### D6 — Estrategia de migración de expedientes existentes (3 escenarios)
- **Nuevos:** nacen digitales (alta normal).
- **En trámite:** migración asistida (crear expediente + cargar documentos + fijar estado y fecha de radicación original) **sin perder historial**, con auditoría de quién migró qué. Las actuaciones reconstruidas se **marcan como reconstruidas** (no se falsean como eventos reales). Guard contra doble radicación de migrados y contra huecos/duplicados en la serie legal.
- **Históricos:** **no** digitalización masiva; **expediente-referencia** liviano (metadatos + ubicación física), migrado bajo demanda al consultarse o reactivarse.

### D7 — Versionado de documentos (anti-pérdida)
Documento lógico con **N versiones inmutables** (append-only en Firestore y Storage; nunca sobrescribe ni borra). **Hash calculado server-side y validado al recuperar** (no decorativo). Binarios en Storage bajo carga server-side + descarga autorizada por tenant (anti-IDOR).

### D8 — Trazabilidad completa
Subcolección `actuaciones` **append-only** (create server-side; update/delete: if false), con actor (uid+nombre+rol capturado en servidor, no del cliente), timestamp de servidor, etapa y tipo. Distingue **evento real** de **evento reconstruido** (migración). Nota de deuda heredada: la escritura de trazabilidad es **post-commit best-effort** (N8), no atómica con la operación — se documenta, no se afirma atomicidad falsa.

### D9 — Preparado para nuevos trámites y nuevas Secretarías sin tocar el núcleo
El multi-tenant existente permite que el motor sirva a otras dependencias. La **intake** de un trámite nuevo (cualquier secretaría) se habilita por Definición de Trámite (dato). El **desenlace** específico se añade por código con ADR. El consecutivo se extiende con un tipo nuevo en `SerieConsecutivo` (enum cerrado; extensión verificada **no-breaking** — el guard H3 es agnóstico al valor). Salvaguarda: **guard monotónico en `counters`** y prohibición codificada de escribir números legados en series reales, **antes** de introducir la serie `expedientes`.

## Precondiciones para levantar la suspensión e implementar
1. **Concepto jurídico formal** de la oficina jurídica de la Alcaldía sobre: el hito de radicación (D5), el plazo reglado de la revisión previa, el silencio positivo, y el acto administrativo del alcalde que designa la competencia de expedir en Planeación. **BLOQUEANTE.**
2. **Checklist oficial completo** (hoy tenemos "página 1 de 2" de Licencia — `docs/blueprints/requisitos-licencia-construccion-obra-nueva.md`).
3. **Validación con la Secretaría de Planeación** (flujo real, búsqueda, campos del predio).
4. Los pre-requisitos de seguridad de datos de D9 (guard monotónico en counters) implementados y verificados antes de la serie `expedientes`.

## Consecuencias
- El módulo entrega valor real (digitaliza Planeación) reutilizando la base sin componentes paralelos.
- Deja explícito lo que NO es genérico (resolución) para no vender configurabilidad inexistente.
- Los formatos concretos (`numeroExpediente`, nombres de estados de resolución, régimen de subsanación por trámite) son **implementación**, se fijan en el plan por fases y en PRs con revisión cruzada, no en este ADR.

---

## Adenda 2026-08-05 — Cierre del PdC 0 (Fase 0)

La Fase 0 (cimientos de lógica pura: tipos + evaluador de completitud + reloj de subsanación + guard de consecutivos) se construyó, verificó (1231 tests verdes, `tsc` 0, `lint` 0, `build` OK), revisó en cruz (Datos → SÓLIDO; Seguridad → SIN HALLAZGOS ALTOS) y validó en arquitectura contra los 5 principios del propietario: **veredicto APROBADO_CON_CONDICIONES** — núcleo trámite-agnóstico confirmado, sin literal de "Licencia" en código ejecutable, dos simulaciones adversariales (Concepto de uso del suelo; Subdivisión) devolvieron GENERICO_CONFIRMADO. Con este cierre, **la Fase 0 queda CONGELADA**: no se introducen nuevas funcionalidades ni cambios de diseño sobre el núcleo salvo defecto crítico; la Fase 1 construye capacidades sobre un núcleo estable.

### A1 — Limitación conocida de diseño: frontera de expresividad del DSL de requisitos

El DSL de `CondicionRequisito` (`lib/motor-expedientes/tipos.ts`) es **puramente categórico**: `IGUAL` / `DISTINTO` / `EN` sobre claves del contexto, compuestos con `Y` / `O` / `NO`. La invariante D4 ("trámite nuevo = crear un documento, sin desplegar") **queda acotada a checklists categóricos**. En consecuencia, **NO** son expresables hoy sólo con datos, y requerirían modificar el núcleo (ampliar la unión `CondicionRequisito` + `evaluarCondicion` + `clavesReferenciadas`):

- **Umbrales numéricos/ordinales** (`>`, `<`, `≥`, `≤`, `ENTRE`) sobre un hecho crudo — área, nº de pisos, altura, valor de obra, hectáreas/UAF. *Mitigación vigente (YAGNI):* el trámite pre-categoriza el hecho fuera del motor (p. ej. `categoriaComplejidad ∈ {BAJA,MEDIA,ALTA}`) y el DSL evalúa la categoría. Cubre el caso mientras ningún trámite exija reglas sobre el número crudo.
- **Requisitos alternativos / "al menos uno de {A,B}" / documento sustituto**, y condicionar un requisito al **aporte** de otro (`requisitoAplica` sólo ve el contexto, no los aportes; `OPCIONAL` nunca bloquea).
- **Hechos multivaluados** y **término principal en MESES** (`TerminoLegal.unidad` aún no admite MESES; sí lo hace `RegimenSubsanacion`).

**Regla de gobierno:** cualquier ampliación de estos operadores es una **excepción arquitectónica** y se añade **por ADR** (con revisión de Gobierno Digital), nunca de forma implícita. Se medirá empíricamente con el segundo trámite (Fase 3) antes de decidir ampliar.

### A2 — Registro de deudas técnicas de la Fase 0 → fase de resolución

Todas las deudas detectadas quedan asociadas explícitamente a la fase donde se resuelven. Ninguna es breaking ni irreversible; todas son aditivas.

| # | Deuda | Sev. | Fase de resolución |
|---|---|---|---|
| 1 | DSL sin operadores numéricos/ordinales (ver A1) — documentar frontera + corregir comentario `tipos.ts` | ALTA | **Fase 0** (documentar, hecho en esta adenda) · ampliar por ADR en Fase 3 o antes si aparece umbral real |
| 2 | Flags `requiereVisita`/`generaResolucion` sin consumidor — reintroducen resolución-por-bool | MEDIA | **Fase 1** (ADR que los retire o ratifique como marcadores, antes de codear la resolución) |
| 3 | Sin reloj de término PRINCIPAL genérico; única función atada al catálogo PQRSD con fallback silencioso | MEDIA | **Fase 1/2** (consumidor genérico de `terminos {días,unidad}`, sin usar `calcularFechaVencimiento`; `unidad` → MESES) |
| 4 | Sin contrato definición↔contexto ni validador (typo → INDETERMINADO indistinguible; `Y`/`O` vacíos vacuous) | MEDIA | **Fase 1** (catálogo de claves declaradas + validador al publicar la Definición) |
| 5 | No hay requisitos alternativos "N-de-M" ni condición sobre aportes | MEDIA | **Fase 1** al materializar el checklist real (o ADR si aparece) |
| 6 | `Actuacion`/`Observacion` sin `tenantId` (bloquea `collectionGroup` por tenant) | MEDIA | **Fase 1** (denormalizar `tenantId` en el mapper de persistencia) |
| 7 | Guard D9 `verificarAvanceCounter` — **CABLEADO el 6-ago-2026**: `confirmarConsecutivosLegales` lo invoca sobre CADA pendiente, antes de cualquier `tx.set` (fail-closed: counter corrupto u origen `RECONSTRUIDO` abortan el lote completo sin escribir). Residual explícito: persisten escritores directos de `counters/` fuera de `consecutivo-legal.ts` (`lib/actions/radicarVentanilla.ts` y `lib/radicado-institucional.ts`, cliente Firestore — activo hoy vía `USA_RADICACION_INTERNA_SERVER = false`; `scripts/laboratorio/alcaldia-sintetica.ts`, lab), que el guard NO cubre por no pasar por este módulo | MEDIA → BAJA (guard activo en el flujo centralizado; residual de cobertura sin cerrar) | **Fase 1 — PRIMER ítem** (decisión del propietario, 6-ago-2026: el flujo de radicación ACTIVO en prod es el legado cliente — `USA_RADICACION_INTERNA_SERVER = false` — que no pasa por el guard, así que el residual no es documental; mitigación vigente mientras tanto: cron semanal solo-lectura `auditoria-consecutivos`, lunes 13:00 UTC, series radicados/salidas/planillas). Centralizar los escritores directos restantes de `counters/` tras el guard y/o narrowing del wildcard `counters` en reglas). Extender el detector de fantasmas (`COLECCION_POR_SERIE`, `scripts/laboratorio/detectar-consecutivos-fantasma.mjs`) a la serie `expedientes` **cuando la Fase 1 defina el nombre real de la colección** — no se hardcodea ahora un nombre de colección inexistente (decisión deliberada, D3 es de Fase 1) |
| 8 | `Actuacion` sin schema de honestidad probatoria completo (doble fecha, split de actor, `documentoRespaldoRef`) | MEDIA | **Fase 2** (antes de habilitar la migración de expedientes en trámite) |
| 9 | Fechas ISO-string en los tipos — no persistir verbatim | BAJA | **Fase 1** (mapper ISO → `Timestamp`/`serverTimestamp` en la frontera de persistencia) |
| 10 | `OrigenActuacion` y `OrigenConsecutivo` son la misma unión duplicada | BAJA | **Fase 1** (unificar en un tipo compartido) |
| 11 | Ubicación de tipos `lib/motor-expedientes/tipos.ts` vs `src/types/expediente.ts` del blueprint | BAJA | **Fase 1** (reconciliar al introducir endpoints/UI) |
| 12 | `COLECCION_POR_SERIE` del detector de fantasmas no incluye `expedientes` | BAJA | **Fase 1** (cerrar junto con la colección) |
| 13 | `counters/expedientes-{año}` single-writer global | BAJA | **Fase 1** (revisar namespacing/sharded al fijar el formato `numeroExpediente`) |
| 14 | `evaluarCompletitud` construye el `Map` de aportes con `new Map(aportes.map(...))`: ante `requisitoId` duplicado, el último gana en silencio → el veredicto depende del orden de entrada (H2 del ultrareview) | BAJA | **Fase 1** (persistir aportes keyed por `requisitoId` — duplicado estructuralmente imposible — o guard fail-closed en `evaluarCompletitud`) |
| 15 | `atLocalNoon` (`tiempos-radicado.ts`) extrae el día calendario con getters de TZ del entorno en vez de anclar a `America/Bogota` → desplazamiento de ±1 día en el límite de subsanación (RS-1 del ultrareview). **Pre-existente** (afecta también a BM-B33), NO introducido por el motor | MEDIA (**→ ALTA** al cablear el reloj) | **PRECONDICIÓN de Fase 1**: anclar `atLocalNoon` a `America/Bogota` (patrón `Intl` de `lib/fecha-colombia.ts`) **antes** de conectar el reloj a cualquier endpoint/cron; ahí toca plazos legales (archivo indebido / silencio administrativo). Gobierno Digital valida el efecto legal del ±1 día |
| 16 | Brechas de resistencia a mutación en la suite (día exacto en la ruta string-ISO del reloj, `festivosExtra` sin ejercitar, `clavesFaltantes` con condición compuesta multi-clave). El operador `NO` en dirección `CUMPLE→NO_CUMPLE` (COB-1) **ya se cerró en #146** | BAJA | **Fase 1** (endurecimiento de tests por QA, junto con el fix de RS-1 que aporta el test que detecta el ±1 día) |

> Deudas #14–#16 provienen de la **ultra-revisión adversarial** de #146 (veredicto `MERGE_CON_DEUDA_REGISTRADA`, sin defectos nuevos que bloqueen). #1 (`Y`/`O` vacíos) fue reproducida ejecutablemente y confirmada como la deuda #4 ya registrada (validador de Definición). RS-1 (#15) es el único ítem que exige acción **antes** de la Fase 1.

### A3 — Principios de revisión obligatoria durante la Fase 1

Criterios vinculantes de revisión cruzada para **todo** PR de la Fase 1:

1. El motor debe seguir siendo **completamente reutilizable**.
2. **Ninguna Secretaría** debe requerir modificaciones del núcleo para incorporar un nuevo trámite.
3. Todo **comportamiento específico** queda **fuera del motor**: se resuelve por parametrización (dato) o por módulos especializados (resolución por trámite, en código con ADR).
4. Toda **excepción arquitectónica** se documenta **mediante ADR antes de implementarse**.

Si durante la Fase 1 una decisión rompe estos principios, se **detiene el desarrollo**, se revisa la arquitectura y se corrige el rumbo antes de continuar.
