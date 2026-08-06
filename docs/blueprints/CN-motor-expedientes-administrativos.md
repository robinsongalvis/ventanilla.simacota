# Blueprint v2 — Motor genérico de expedientes administrativos

> Estado: **PROPUESTA de arquitectura (Nivel 3)**. Consolida el mapa de reutilización
> verificado en código, los 5 diseños (motor, normativo, datos, migración, UX) y sus 3
> verificaciones adversariales. **Nada aquí está decidido**: requiere ADR aprobado por el
> propietario + concepto de la oficina jurídica + validación con la Secretaría de Planeación.
> Repo leído en solo lectura; este documento es especificación, no implementación.
>
> Convención de marcas:
> - `[VERIFICADO]` — anclado a `archivo:línea` real del repo.
> - `[TUMBADO→RESUELTO]` — una verificación adversarial rompió la afirmación original; se
>   describe el hallazgo y cómo se corrige en v2.
> - `[VALIDACIÓN EXTERNA]` — no lo puedo cerrar yo: exige jurídica, Planeación o el propietario.

---

## 1. Resumen ejecutivo + veredicto

**Veredicto: APROBADO CON CONDICIONES, con alcance recortado.** Esta arquitectura **PUEDE**
ser el motor de expedientes de toda la Alcaldía **en su mitad de recepción** (intake →
revisión documental → completitud → handoff → radicación → consecutivo). En su mitad de
**resolución** (tramitación → visita → citación a colindantes → desenlace motivado →
notificación → cierre) **hoy NO es genérico**: es "licencias con nombres genéricos". La
diferencia no es cosmética, es load-bearing.

**Prueba de las 2 instanciaciones** (la que decide si es motor real): `[TUMBADO→RESUELTO]`
- *Concepto de uso del suelo* (simple, sin visita, sin resolución): checklist y término se
  resuelven con **datos** ✓. Pero produce un **CONCEPTO**, no una resolución; el enum de
  estados del motor muere en `RADICADO` y el flag `generaResolucion:bool` no tiene estado,
  transición ni consumidor. → toca **código** en el desenlace.
- *Subdivisión de predios* (visita + colindantes): el checklist es dato ✓, pero la **citación
  a vecinos** es una rama topológica (`revisión→citación→espera→oposiciones→desenlace`) con
  su propio reloj y una forma de datos para *oposiciones* que el modelo no tiene dónde alojar.
  No es un parámetro, es topología distinta. → toca **código**.

**Conclusión honesta:** la afirmación original "esqueleto canónico fijo hasta cierre,
parametrizado solo por datos" **es falsa para la fase de resolución**. Se corrige acotando el
alcance v2: el motor genérico cubre **hasta la radicación**; la fase de resolución se modela
explícitamente (enum cerrado con revisión legal) y se construye trámite a trámite, empezando
por Licencia de Construcción. Agregar un trámite nuevo con desenlace distinto **tocará código**,
y eso es correcto: un estado administrativo nuevo siempre merece revisión jurídica y no debe
esconderse tras configuración de datos invisible a Gobierno Digital.

Lo que sí es genérico de verdad y sobrevivió toda la verificación: intake, checklist
parametrizable, gate de completitud, consecutivo, handoff atómico, aislamiento por tenant.

---

## 2. Motor genérico: separación código / datos

### 2.1 Decisión de máquina de estados: FIJA parametrizada, NO configurable

Se descarta el workflow engine configurable (un admin dibujando estados) por cuatro razones:
YAGNI (nadie lo pidió), legalidad (un admin podría dibujar un flujo que viole CPACA/D.1077),
invariantes demostrables solo contra un enum finito, y porque desecharía el código legal ya
calibrado (`tiempos-radicado.ts`, `subsanacion.ts`). Se adopta **esqueleto en código +
puntos de variación parametrizados por datos**.

**Condición que impone la verificación** `[TUMBADO→RESUELTO]`: el ADR **debe cerrar el enum
de estados de verdad**, no solo hasta `RADICADO`. Existía una contradicción entre el documento
del arquitecto (prosa: `…→visita→desenlace→notificación→cierre`) y el modelo de datos (enum:
`RECIBIDO→EN_REVISION→SUBSANACION→COMPLETO→RADICADO`). No eran el mismo motor. v2 resuelve:

- **Fase INTAKE (genérica, en código, cerrada):**
  `RECIBIDO → EN_REVISION → (SUBSANACION_PLANEACION ↔ EN_REVISION) → COMPLETO → RADICADO`
  con `SUSPENDIDO` **reservado exclusivamente** para suspensión de término. `[TUMBADO→RESUELTO]`
  El diseño original reusaba `SUSPENDIDO` para tres significados (visita pendiente / subsanación
  / ventana de citación) — un estado con tres semánticas legales. v2: `SUSPENDIDO` es solo
  suspensión de término; visita y citación son estados/subestados propios de la fase de
  resolución, no de la intake.
- **Fase RESOLUCIÓN (NO genérica, por trámite, enum cerrado por ADR con revisión legal):**
  estados como `EN_ESTUDIO`, `VISITA_TECNICA`, `CITACION_COLINDANTES`, `PROYECCION_ACTO`,
  `RESUELTO_CONCEDE/NIEGA`, `NOTIFICADO`, `EN_FIRMEZA`, `ARCHIVADO`. Estos **no existen hoy**
  en `EstadoRadicado` (`src/types/radicado.ts:3-13`, ciclo PQRSD) ni en el enum del expediente.
  v2 los declara como trabajo de código explícito, fuera del alcance de la Fase 0.

Regla de evolución: un estado inédito se **añade al enum vía ADR con revisión de Gobierno
Digital**, nunca por datos.

### 2.2 Reloj legal: reutilización REAL vs reutilización MÍTICA `[VERIFICADO]` `[TUMBADO→RESUELTO]`

- **Reloj de inicio de término — reutilizable de verdad ✓.** `calcularFechaVencimiento(inicio,
  dias, festivosExtra, unidad)` con `UnidadTermino='HABILES'|'CALENDARIO'`, `festivosColombia`
  (incl. Pascua), en `lib/tiempos-radicado.ts`. Está parametrizado por catálogo. Los 45 días
  hábiles del D.1077 **se reutilizan**, no se construyen.
- **Reloj de subsanación — NO reutilizable "tal cual" (HIGH).** `plazoSubsanacion`
  (`tiempos-radicado.ts:308`) = `sumarMesCalendario(x,1)` → **1 mes calendario fijo**;
  `dentroVentanaRequerimiento` (`:349`) **hardcodea 10 días hábiles**. Eso es régimen **Ley
  1755**, no D.1077. El modelo de licencias exige `{dias:30, tipo:HABILES, prorrogaDias:15}`.
  **No hay código que consuma 30/15.** Reutilizar `subsanacion.ts` tal cual produce el **plazo
  legal equivocado**. → v2 exige **parametrizar el reloj de subsanación por régimen**
  (`{dias, unidad, prorrogaDias, ventanaRequerimiento}`). Esto es **cambio de código**, y
  contradice explícitamente la afirmación original "reutilizar tal cual". Se registra como tal.
- **Dos subsanaciones distintas, no una (HIGH).** `subsanacion.ts` recibe un
  `VentanillaRadicado` **post-radicación** y suspende un término ya corriendo. Pero en el motor
  la subsanación de Planeación ocurre **antes del handoff, antes de que exista radicado y antes
  de que arranque el término**. Son dos máquinas: (a) *completitud pre-radicación* (Planeación,
  sin reloj legal de licencia corriendo) y (b) *acta de observaciones* post-radicación (D.1077
  art. 2.2.6.1.2.2.4, suspende los 45 días). v2 las **separa explícitamente**; tratarlas como
  una produce cómputos ilegales.

### 2.3 Límite código / dato (el contrato del motor)

**CÓDIGO (trámite-agnóstico, se despliega):** esqueleto de estados de intake; evaluador de
completitud puro; gate de handoff (tx cross-collection con guard de campo); cómputo de términos
(`tiempos-radicado.ts`); reloj de subsanación **parametrizado por régimen** (nuevo); consecutivo;
trazabilidad append-only; Storage staging+magic-bytes; intérprete de la Definición.

**DATO (Definición de Trámite en Firestore, administrable, NO se despliega):** checklist,
términos por trámite, régimen de subsanación, flags de rama opcional. Agregar "uso del suelo"
= crear un documento — **solo para lo que es intake**. El desenlace (concepto vs resolución)
**no** se agrega por dato.

---

## 3. Modelo de datos

### 3.1 Decisión troncal: UNA colección genérica `expedientes` `[VERIFICADO]`

Colección top-level plana `expedientes` con campo `dependencia` (== `tenantId` dueño) y
`tipoTramite`. Consistente con el naming real (`ventanilla_radicados`, `ventanilla_salidas`:
top-level + campo tenant, no `tenants/{id}/...`). Supersede el nombre `planeacion_expedientes`
del blueprint v1 (acoplaba a una dependencia) — **cambio a registrar en ADR** `[VALIDACIÓN
EXTERNA: propietario]`.

`[TUMBADO→RESUELTO]` — **`predio`/`matriculaInmobiliaria` como campos de primer nivel indexados
son el "tell" de licencias-con-nombres-genéricos.** Correcto para urbanismo; un trámite de otra
secretaría sin predio deja `predio:null` e índices muertos. v2: se aceptan como campos
**opcionales de dominio urbanístico**; un trámite no-urbanístico usará su propia proyección de
búsqueda. No se vende como "cero código para cualquier secretaría".

### 3.2 `tramite_definiciones/{tipoTramite}-v{n}` (DATOS parametrizables)

Versionado **append-only**: editar requisitos crea `-v2` (`vigente:true`) y baja la anterior a
`vigente:false`; nunca se muta una definición viva. Contiene: `tipoTramite`, `version`,
`vigente`, `dependencia`, `serieTRD` (foto inmutable), `termino:{dias,tipo}`,
`subsanacion:{dias,tipo,prorrogaDias}` (D.1077, **consumido por el reloj parametrizado** de §2.2),
`silencioPositivo:bool` (Ley 388 art. 99), y `requisitos[]` (`{requisitoId, nombre, obligatorio,
orden, ayuda}`).

### 3.3 `expedientes/{expedienteId}` (raíz)

Campos clave: `tipoTramite`, `dependencia` (aislamiento), `asignadoA`, `estadoActual`,
`origen` (`NATIVO`|`MIGRADO_EN_TRAMITE`|`REFERENCIA_FISICA` — uniforme desde el alta),
`definicion` **congelada al nacer** (foto inmutable, patrón `radicacion/route.ts:413-416`),
`checklist[]` materializado (`{requisitoId, estado:PENDIENTE|RECIBIDO|OBSERVADO|NO_APLICA,
documentoId, observaciones}`), `predio`/`solicitante` (búsqueda), `listoParaRadicar:bool`
(bandeja Ventanilla), `radicadoVentanillaId:null` (**GUARD de idempotencia del handoff**),
`radicadoNumero:null`, `termino:null` (nace en radicación), y campos de migración
(`numeroRadicadoLegado`, `serieLegado`, `anioLegado`, `radicadoEntradaExistente`).

### 3.4 Subcolecciones

- `documentos/{documentoId}` — documento **lógico** versionado append-only; `versiones[]`
  in-doc con `storagePath`, `hashSha256` server-side, `magicBytesOk`, y **`moveVerificado`**
  (nuevo, ver §3.8). Nunca se sobrescribe una versión.
- `actuaciones/{actuacionId}` — timeline append-only. `[TUMBADO→RESUELTO]`: el modelo v1 decía
  "mismo shape que trazabilidad de radicados, `eventoId` determinístico", **sin** los campos de
  honestidad probatoria; eso haría un evento reconstruido **indistinguible** de uno en vivo =
  falsificación de auditoría. v2 **unifica un solo schema** con `origen`
  (`EN_VIVO`|`RECONSTRUIDO_MIGRACION`), doble fecha `fechaActuacionOriginal`/`fechaServidor`,
  split de actor (`actorUid` real vs `actorHistoricoNombre/Cargo` declarado) y
  `documentoRespaldoRef` **obligatorio** para todo evento reconstruido que altere el término.
  Estos campos son obligatorios y validados server-side.

### 3.5 Consecutivos multi-trámite `[VERIFICADO]`

Dos números distintos, no confundir:

| Número | Nace en | Serie | Formato |
|---|---|---|---|
| `numeroExpediente` (interno de trabajo) | Planeación crea el expediente | **`expedientes` (NUEVA)** → `counters/expedientes-{año}` | interno, p.ej. `EXP-{AAAA}-{#####}` `[VALIDACIÓN EXTERNA]` |
| `radicadoNumero` (LEGAL) | Handoff → Ventanilla radica | **`radicados` (EXISTENTE, sin tocar)** | `1-110-{AAAAMM}-{########}` (formato legado) |

El radicado legal **reusa la serie municipal única** `radicados` (AGN 060: serie municipal
anual continua; crear una serie legal por trámite la violaría). Extensión quirúrgica única
`[VERIFICADO]`: añadir `'expedientes'` a `SerieConsecutivo` (`consecutivo-legal.ts:32`). No rompe
el guard H3: el `WeakMap<Transaction, WeakSet<...>>` (`:57,:106-112`) está keyed por `tx` +
identidad del array, **agnóstico al valor de serie**.

### 3.6 Índices `[VERIFICADO: no existe gate verificar:indices]`

Un índice faltante NO falla en CI; falla en PROD con `FAILED_PRECONDITION`. **Todas** las shapes
de bandeja deben enumerarse en `firestore.indexes.json` **antes** del frontend: (1) dependencia+
estado+creadoEn, (2) dependencia+asignadoA+creadoEn, (3) dependencia+tipoTramite+creadoEn,
(4) listoParaRadicar+fechaEnvioVentanilla, (5) dependencia+estado+subsanacion.fechaLimite,
(6) dependencia+predio.matriculaInmobiliaria, (7) dependencia+solicitante.numeroDoc, **(8)
dependencia+numeroRadicadoLegado** (requerido por el guard anti-doble-migración, §5).

### 3.7 Reglas de aislamiento `[VERIFICADO]` `[TUMBADO→RESUELTO]`

Sin rol nuevo (YAGNI): Planeación = `FUNCIONARIO`@`SEC_PLANEACION`; Ventanilla =
`RECEPCIONISTA`. `create/update/delete: if false` en raíz **y** subcolecciones (toda mutación
server-side, igual que `ventanilla_radicados:148-151`). El **interior** del expediente (documentos,
actuaciones, checklist) solo lo ve la dependencia dueña + Admin + Control Interno; Ventanilla
NO ve el interior.

- `[TUMBADO→RESUELTO]` **PII a Ventanilla (MEDIA).** La regla original daba a `RECEPCIONISTA`
  `get/list` del **doc raíz** completo cuando `estadoActual in [COMPLETO,RADICADO]`, y Ventanilla
  no está scopeada por tenant → recepción vería PII completa (solicitante, predio) de **todas**
  las dependencias, agravado en expedientes migrados (Ley 1581, minimización). v2: la bandeja
  Ventanilla "listos" lee una **proyección minimizada** (numeroExpediente, tipoTramite, estado —
  sin solicitante/predio); consultas por cédula/matrícula solo server-side, con scope de tenant y
  auditoría.
- `[TUMBADO→RESUELTO]` **Wildcard `counters/{document}` (HIGH).** `firestore.rules` da `read,write`
  a ADMIN/RECEPCIONISTA **sin constraint de valor** (permite rebobinar el contador desde cliente),
  y por ser wildcard expondría `counters/expedientes-{año}`. v2 exige, **bloqueante antes de
  introducir la serie nueva**: guard monotónico `request.resource.data.ultimo ==
  resource.data.ultimo + 1` o narrowing del wildcard. `[VALIDACIÓN EXTERNA: Seguridad]`

### 3.8 Handoff Planeación → Ventanilla: transacción atómica REAL `[VERIFICADO]` `[TUMBADO→RESUELTO]`

Los documentos se suben **durante la revisión** (a `expedientes/{id}/...`), no en el handoff; el
radicado **referencia** los documentos, no los duplica. Por tanto el handoff es
**Firestore↔Firestore, genuinamente atómico** (un solo `runTransaction`: `leerConsecutivos →
gateCompletitud → construirRadicado → confirmarConsecutivos → tx.set(radicado) →
tx.update(expediente) → tx.set(actuación fundacional)`). Idempotencia por **GUARD de campo**
(`radicadoVentanillaId == null`) dentro de la tx, NO por id determinístico (el `radicadoId` sale
del consecutivo). El evento fundacional entra **en la tx** (mejora sobre el legado post-commit,
N8). Molde confirmado en `registro-expres/route.ts:114-139`.

Dos correcciones de la verificación:

- `[TUMBADO→RESUELTO]` **Doble radicación de entrada de migrados (ALTA).** La migración §b.4 dice
  que un migrado en trámite (ya con radicado de entrada) hace handoff a la serie `salidas`, pero
  la transacción del modelo consumía `radicados` **incondicionalmente** (solo guardaba
  `radicadoVentanillaId==null` y `estadoActual==COMPLETO`, sin leer `radicadoEntradaExistente`).
  Un migrado pasaría por ahí y generaría un **segundo** radicado de entrada. v2: la tx debe leer
  `origen`/`radicadoEntradaExistente` **dentro de la tx** y bifurcar (consumir `salidas` o enlazar
  el legado) antes de tocar `radicados`. §5 del modelo y §b.4 de migración son **una sola
  transacción**, no dos diseños.
- `[TUMBADO→RESUELTO]` **Huérfano de Storage movido río arriba (MEDIA-ALTA).** El `gateCompletitud`
  validaba el **estado del checklist**, no la existencia real del objeto. Como el move
  `_pendientes→final` es best-effort (N8), un requisito `RECIBIDO` podía apuntar a un objeto que
  falló el move → radicado legal referenciando evidencia inexistente. v2: el gate exige que cada
  requisito `RECIBIDO` tenga `moveVerificado==true` (bandera escrita por el proceso de subida) o
  verificación de existencia, **antes** de permitir `COMPLETO`.

---

## 4. Análisis crítico normativo `[VALIDACIÓN EXTERNA: oficina jurídica — obligatorio]`

### 4.1 Corrección al blueprint v1

"Radicación en legal y debida forma" (D.1077 art. 2.2.6.1.2.3.1) es un **término técnico**, no
el recibo físico: se perfecciona cuando la solicitud está **completa**. Por tanto el término de
45 días hábiles legítimamente **arranca cuando el expediente queda completo**, que coincide
materialmente con el fin de la revisión de Planeación. La intuición de la Alcaldía es correcta.
La brecha v1 ("el clock arranca al inicio") era sobre-simplificación y queda corregida.

### 4.2 Inconsistencias procedimiento-vs-Decreto 1077 (expresas)

1. **Sin constancia de radicación al primer contacto.** El flujo solo radica en el paso 7. La
   norma obliga numeración consecutiva cronológica + constancia de documentos **desde la
   presentación** (CPACA art. 15; AGN 060 art. 5). Negarlo vulnera el derecho a radicar.
2. **La "revisión previa" carece de figura legal y de plazo.** Debe encuadrarse como
   "verificación de requisitos / legal y debida forma", con devolución formal y, ante insistencia,
   advertencia de **30 días hábiles** o desistimiento.
3. **Conflación de dos subsanaciones** (ver §2.2): completitud pre-término (no suspende, el
   término aún no nace) vs acta de observaciones art. 2.2.6.1.2.2.4 (suspende los 45).
4. **Punto de arranque no probatorio.** Si el término nace en Ventanilla, hace falta prueba
   objetiva de la legal y debida forma (certificación de completitud con fecha).

### 4.3 Alternativa recomendada: A — doble radicación (con flanco abierto)

- **Radicado de RECIBO/ENTRADA** con constancia al ciudadano (fecha, documentos, consecutivo
  AGN 060) — **no** inicia los 45 días.
- Revisión = verificación de requisitos; subsanaciones por devolución formal.
- **Radicación en legal y debida forma** (la actual "radicación en Ventanilla") → arranca el
  término, corre el consecutivo legal, emite certificación de completitud.

`[TUMBADO→RESUELTO por verificación jurídica]` **Flanco más grave:** la fase de recibo, tal como
estaba, **carece de plazo reglado y salida forzosa**. Dos frentes: (a) violación del derecho de
petición por revisión indefinida (tutelable aunque el término de licencia no haya nacido);
(b) el ciudadano que presentó **completo** puede anclar el inicio en la presentación → **silencio
positivo Ley 388 art. 99 = licencia CONCEDIDA por ministerio de la ley** (otorgamiento automático,
no simple mora). **Condición mínima para que A sea defendible:** la fase de recibo debe tener
(i) plazo máximo reglado ≤ 30 días hábiles, (ii) salida forzosa (devolución motivada o radicación
en legal y debida forma), (iii) certificación de incompletitud documentada **pieza por pieza** con
fecha. Sin las tres, A colapsa en la Alternativa C (riesgo ALTO). Además, frente a AGN 060 los dos
números **no** pueden ser dos radicados del mismo hecho: deben ser radicado-de-comunicación vs
número-de-expediente, uno referenciando al otro, y la constancia debe decir **cuál número inicia
los 45 días**.

### 4.4 Brechas vivas e independientes (A NO las resuelve)

- **Silencio positivo** (Ley 388 art. 99): el motor debe blindar cuándo nació el término.
- **Resolución motivada** (CPACA arts. 67-69, 74 y ss.): el desenlace es acto administrativo que
  concede/niega, notificado, con reposición y apelación. "VIABLE/NO_VIABLE" es insuficiente.
- **Subsanación 30+15 hábiles** (D.1077, NO Ley 1755) — ver §2.2.
- **Citación a colindantes**: el acto solo puede expedirse tras mínimo 5 días hábiles desde la
  citación/publicación (D.1077 zona 2.2.6.1.2.2.x, **numeral exacto pendiente de precisar — no
  citar inventado**). Es rama topológica (§2.1), no un flag.

**Concepto jurídico formal OBLIGATORio antes de implementar**, sobre: plazo/reglas de la revisión
previa y su salida forzosa; efecto de no-arranque del recibo frente a expediente completo;
nomenclatura de los dos números frente a AGN 060; formatos de constancia. El procedimiento debe
quedar respaldado por **acto administrativo del alcalde** (competencia de Planeación, municipio sin
curador, Ley 388 art. 99), no solo por decisión de producto.

---

## 5. Migración (3 escenarios) con controles de integridad

Regla de partición: el criterio es el **estado legal**, no "digital vs papel". No terminado →
(b); terminado/archivado → (c).

- **(a) Nuevos:** nacen digitales, `origen:'NATIVO'`. Sin módulo de migración.
- **(b) En trámite:** se crea expediente real con `origen:'MIGRADO_EN_TRAMITE'`, `numeroExpediente`
  **nuevo** de la serie `expedientes`, y `numeroRadicadoLegado` copiado como **dato inmutable
  (jamás generado por el helper** — `consecutivo-legal.ts:76` solo incrementa `[VERIFICADO]`).
  Reconstrucción de trazabilidad con el schema de honestidad probatoria (§3.4). Cálculo inmediato
  del término con hábiles + suspensiones reconstruidas; **alerta si llega ya vencido** (riesgo
  silencio positivo). Control: permiso `MIGRAR_EXPEDIENTE` server-side, doble validación (4 ojos),
  registro `migraciones`, constancia firmada.
- **(c) Históricos:** referencia liviana `expedientes_referencia` (metadatos mínimos + ubicación
  física), **sin consumir consecutivo legal**. Reactivar = **expediente nuevo enlazado**, no
  reabrir el terminal (append-only). Enlace bidireccional en **la misma tx** `[TUMBADO→RESUELTO:
  enlace no atómico → runTransaction único]` + **token de idempotencia** por acción
  `[TUMBADO→RESUELTO: sin idempotencia → doble-click creaba dos expedientes]` (el
  `numeroRadicadoLegado` NO sirve de guard aquí porque una referencia puede reactivarse
  legítimamente varias veces).

Controles de integridad que la verificación exigió `[TUMBADO→RESUELTO]`:

- **El detector de fantasmas es CIEGO a la corrupción que importa (HIGH).**
  `detectar-consecutivos-fantasma.mjs` solo detecta huecos (`1..ultimo` faltantes); **no** detecta
  sobrescritura silenciosa (`tx.set` sobre un id existente de año cerrado deja `presentes`
  intacto → pérdida invisible) ni la serie `expedientes` (no está en `COLECCION_POR_SERIE`).
  Mitigaciones bloqueantes antes del go-live: (i) prohibición **codificada** de escribir números
  legados en `ventanilla_radicados`/`ventanilla_salidas` (el legado vive solo como campo del
  expediente; si se requiere verlo en el libro operativo, read-model aparte, jamás un id de serie
  real); (ii) guard monotónico en `counters` (§3.7); (iii) extender el detector a `expedientes`.
- **Guard anti-doble-migración depende de un índice inexistente.** Es una query en tx por
  `numeroRadicadoLegado`; sin el índice (8) desplegado, falla con `FAILED_PRECONDITION`. La
  migración debe **abortar en duro** si esa query lanza (nunca continuar sin guard), y el índice
  debe estar desplegado + verificado en dry-run **antes** de correr.
- Idempotencia anti-doble-migración por **guard de campo en tx** (no id determinístico); `writeBatch`
  chunk de 500; backup previo (precondición G6 del SEV-1); dry-run de reglas.

---

## 6. Los dos paneles + admin del checklist

Design system **REAL (tema claro)**, no la memoria oscura. Canvas `#F8FAF7`, tarjetas blancas
borde `#E3EAE3`, verde institucional `#14532D`.

### 6.1 Panel Planeación (completo — "mesa de revisión")

Bandeja con búsqueda por predio/matrícula/solicitante (reutiliza `BusquedaAvanzadaPanel` +
extender campos), KPI cards con riel, **semáforo de 4 estados**. Detalle por pestañas: Resumen,
**Requisitos** (checklist tri-estado por requisito: recibido/falta/no-aplica, obligatorio/opcional
como **texto** `OBLIG`/`OPCIONAL` no solo color, observación por requisito, versionado por
documento lógico colapsado `[v3 ▾]`), Documentos, Subsanaciones (notificación **humana**, nunca
automática — Principio 9; plazo D.1077 30+15; al enviar → `SUSPENDIDO`), Visitas, Actuaciones
(timeline persistente — `TimelineAuditoria` **re-tematizado a claro**, hoy nace oscuro).

**4º estado SUSPENDIDO nunca se ve rojo** (azul-pizarra + glifo pausa; "en pausa desde DD/MM",
no cuenta días vencidos). **Modal irreversible "Enviar a Ventanilla"** con fricción (escribir el
número de expediente), **deshabilitado** si hay obligatorios pendientes (espejo del gate de datos).

### 6.2 Panel Ventanilla (mínimo — "mostrador de radicación")

Deliberadamente pobre en acciones. Banda fija: *"Ventanilla radica y da fe. La revisión técnica ya
la hizo Planeación."* Bandeja "listos para radicar" con **proyección minimizada** (§3.7 — sin PII
completa). NO abre el interior del expediente. Modal de fe pública; el número de radicado **no se
muestra antes de confirmar** (sale del consecutivo, no es determinístico). Post-radicación:
seguimiento (solo lectura) + archivo, con silencio positivo señalizado en rojo intenso.

### 6.3 Admin del checklist (`tramite_definiciones`)

Editor de definiciones sin código: requisitos (nombre, obligatorio/opcional, ayuda, orden drag),
flags de rama. Serie TRD **solo lectura** (viene de `series-documentales.ts`). Versionado
explícito borrador→publicar; publicar crea v(n+1); **los expedientes en curso conservan su foto**.

`[VALIDACIÓN EXTERNA: Planeación]` — antes de codear: texto del oficio de subsanación, mecánica de
confirmación del envío irreversible, política ante nueva versión de checklist para expedientes en
curso, texto del aviso de silencio positivo (con jurídica).

---

## 7. Riesgos consolidados

| # | Riesgo | Sev. | Mitigación | Fase |
|---|---|---|---|---|
| R1 | Fase de resolución NO genérica (concepto vs resolución, visita, colindantes tocan código) | ALTA | Acotar motor genérico a la intake; enum de resolución cerrado por ADR con revisión legal; construir por trámite | ADR / Fase 2+ |
| R2 | Reloj de subsanación hardcodeado a Ley 1755 (`plazoSubsanacion:308`, `dentroVentanaRequerimiento:349`) → plazo ilegal para D.1077 | ALTA | Parametrizar por régimen `{dias,unidad,prorroga,ventana}`; **es cambio de código, no reutilización tal cual** | Fase 0 |
| R3 | Dos subsanaciones conflacionadas (pre-radicación sin reloj vs post-radicación con reloj) | ALTA | Separar máquinas explícitamente en el ADR | ADR / Fase 0 |
| R4 | Enum de estados no cerrado; contradicción prosa vs modelo | MEDIA | Cerrar enum de verdad en el ADR antes de codear el núcleo | ADR |
| R5 | Doble radicación de entrada de migrados (handoff consume `radicados` sin leer `radicadoEntradaExistente`) | ALTA | Bifurcar dentro de la tx por `origen`; reconciliar §5↔§b.4 | Fase de migración |
| R6 | Detector de fantasmas ciego a sobrescritura y a serie `expedientes`; `counters` rebobinable desde cliente | ALTA | Guard monotónico bloqueante; prohibición codificada de escribir legados en series reales; extender detector | Fase 0 (pre-req) |
| R7 | Handoff radica con Storage huérfano (gate valida checklist, no existencia real) | MEDIA-ALTA | Gate exige `moveVerificado` por requisito antes de `COMPLETO` | Fase 0 |
| R8 | Auditoría falsificable (evento reconstruido = evento en vivo) | MEDIA-ALTA | Schema único con `origen`, doble fecha, split de actor, `documentoRespaldoRef` obligatorio | Fase de migración |
| R9 | PII completa a Ventanilla / todas las dependencias (Ley 1581) | MEDIA | Proyección minimizada en bandeja; consultas por cédula/matrícula server-side con scope+auditoría | Fase 0 |
| R10 | Índice faltante llega a PROD (no hay gate `verificar:indices`) | ALTA | Enumerar los 8 índices antes del frontend; migración aborta si el guard falla | Fase 0 |
| R11 | Silencio positivo por término mal anclado (Ley 388 art. 99) | ALTA | Certificación de completitud con fecha; revisión previa con plazo reglado y salida forzosa | ADR + jurídica |
| R12 | Revisión previa sin plazo → tutela por derecho de petición | ALTA | Plazo máximo ≤30 hábiles + salida forzosa reglada | ADR + jurídica |
| R13 | Reactivación de histórico: enlace no atómico / doble-click duplica | MEDIA | Dos escrituras en una tx + token de idempotencia | Fase de migración |
| R14 | `predio`/matrícula hardcodeados: rompe promesa multi-secretaría | MEDIA | Declarar campos como dominio urbanístico opcional; no vender "cero código toda secretaría" | ADR |
| R15 | Rol de Planeación diferido | BAJA | `FUNCIONARIO@SEC_PLANEACION` (YAGNI); rol nuevo vía ADR si emerge permiso inexpresable | Fase 0 |

---

## 8. Plan por fases sugerido

**Precondiciones bloqueantes (antes de cualquier código):**
1. `[VALIDACIÓN EXTERNA]` **Concepto jurídico formal** de la oficina jurídica de la Alcaldía sobre
   §4 (revisión previa reglada, silencio positivo, doble numeración AGN, constancias) + **acto
   administrativo** del alcalde que fije el procedimiento.
2. `[VALIDACIÓN EXTERNA]` **Checklist oficial real** de Licencia de Construcción (Res. 463/2017 +
   TRD 120.22.01 confirmada, hoy "borrador en aprobación").
3. `[VALIDACIÓN EXTERNA]` **Sesión con la Secretaría de Planeación** (§6.3) — usuario distinto de
   recepción.
4. **ADR Nivel 3 aprobado** por el propietario: enum cerrado (§2.1), límite código/dato, seam
   Expediente↔Radicado, formato `numeroExpediente`, parametrización del reloj de subsanación,
   nombre `expedientes`.

**Fase 0 — Cimientos + Licencia de Construcción como primera instancia (solo intake):**
- Guard monotónico `counters` + narrowing wildcard (R6, pre-requisito de seguridad).
- Extender `SerieConsecutivo` con `'expedientes'`; extender detector de fantasmas.
- Tipos compartidos en `src/types/expediente.ts` (enum de intake cerrado).
- Colecciones `tramite_definiciones` + `expedientes` (+ subcolecciones), reglas
  `create/update/delete:if false`, 8 índices enumerados.
- Reloj de subsanación **parametrizado por régimen** (R2/R3).
- Núcleo server-side: `construirExpediente()`, `evaluarCompletitud()` puro, gate con
  `moveVerificado` (R7), handoff atómico con bifurcación por `origen` (R5).
- Storage ruta `expedientes/` + helper con magic-bytes.
- Paneles Planeación (checklist, subsanación, timeline claro) + Ventanilla mínimo con proyección
  minimizada (R9). Admin del checklist.
- **Salida de Fase 0:** un expediente de Licencia de Construcción nace, se revisa, se completa y
  se radica. La **resolución** (desenlace) NO entra aquí.

**Fase 1 — Resolución de Licencia de Construcción (fase de estudio):**
- Enum de resolución cerrado por ADR con revisión legal: visita técnica, citación a colindantes
  (rama topológica + forma de datos para oposiciones), proyección de resolución motivada,
  notificación CPACA, firmeza, silencio positivo.

**Fase 2 — Migración (b) en trámite** con todos los controles de §5.

**Fase 3 — Segundo trámite (uso del suelo o subdivisión):** valida empíricamente qué es dato y
qué fue "licencia con nombre genérico"; primer trámite que ejercita el desenlace-CONCEPTO y/o la
rama de colindantes. Aquí se mide de verdad la genericidad.

**Fase 4 — Históricos (c) bajo demanda.**
