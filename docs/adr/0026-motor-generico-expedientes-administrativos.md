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
