# Preparación de diseño — Fase 2 (intake server-side) y Fase 3 (paneles) del motor genérico de expedientes

> **Estado: PREPARACIÓN DE DISEÑO (diseño-prep). NO es implementación.** No se escribe código con este
> documento. Su único objetivo es dejar **congelados los contratos construibles hoy** y **aislados con
> placeholder** los puntos que dependen de insumos externos, de modo que, cuando lleguen (a) el concepto
> jurídico formal, (b) la página 2 del checklist de Licencia y (c) la validación con la Secretaría de
> Planeación + stage con datos, la implementación **continúe sin retrabajo** (sin rediseñar contratos ni
> tipos ya fijados).
>
> **Regla dura de este documento (inviolable):** no se inventa ni se asume **ninguna** regla de negocio,
> plazo legal, hito, silencio administrativo ni requisito. Toda incógnita de negocio aparece como
> `<<PLACEHOLDER: NOMBRE — insumo: …>>`, etiquetada con el insumo externo que la desbloquea. Donde las
> fuentes citan un valor (p. ej. "45 días hábiles", "30+15"), este documento lo trata como **valor
> pendiente de confirmación jurídica** —las propias fuentes lo marcan `[VALIDACIÓN EXTERNA]`— y **no** lo
> endurece.
>
> **Fuentes tratadas como material ya decidido:**
> `docs/adr/0026-motor-generico-expedientes-administrativos.md` (D1-D9 + adenda §A1-A3),
> `docs/blueprints/CN-motor-expedientes-administrativos.md` (v2),
> `docs/blueprints/CN-modulo-planeacion-licencias.md`,
> `docs/planes/PLAN_FASES_MOTOR_EXPEDIENTES.md`,
> `docs/blueprints/requisitos-licencia-construccion-obra-nueva.md` (checklist **pág. 1 de 2**),
> y el código de Fase 0: `lib/motor-expedientes/{tipos,completitud,subsanacion-regimen}.ts`,
> `lib/server/consecutivo-legal.ts`, más la pieza angular `app/api/radicacion/interna/route.ts`.

---

## 1. Propósito y alcance

- **Qué ES:** un mapa de contratos. Separa, para Fase 2 y Fase 3, tres cosas: (i) lo que **ya está
  decidido** por ADR-0026 y el blueprint v2, (ii) lo que se puede **construir/congelar ahora** sin
  ninguna regla de negocio, y (iii) lo que está **bloqueado** por un insumo externo, encapsulado como
  placeholder.
- **Qué NO ES:** no es implementación, no es un ADR nuevo, no prioriza backlog, no valida normativa. El
  Arquitecto Principal produce este análisis en solo-lectura; la ejecución la reparten los especialistas
  (§ roles indicados en cada paso).
- **Numeración de fases:** se usa la de `PLAN_FASES_MOTOR_EXPEDIENTES.md` (autoritativa): **Fase 2 =
  intake server-side**, **Fase 3 = paneles**. Ver Inconsistencia I-8 sobre el desfase con la numeración
  del blueprint §8 y con la tabla de deudas A2 del ADR (que usan otra numeración) — se señala para que
  ningún especialista confunda "Fase 2 del ADR-A2" (migración) con "Fase 2 del plan" (intake).
- **Precondición estructural heredada:** este documento nace en una rama basada en `origin/main`, donde
  **todavía no existen** ADR-0026, los blueprints del motor, `PLAN_FASES_MOTOR_EXPEDIENTES.md`,
  `docs/planes/` ni `lib/motor-expedientes/*` (viven en la rama de Fase 0, sin mergear). Ver Inconsistencia
  I-9: las rutas que este documento referencia se resuelven cuando la rama de Fase 0 + el ADR aterricen
  en `main`. No es un error del diseño-prep; es una dependencia de orden de merge.

---

## 2. FASE 2 — Intake server-side

### 2.a) Decisiones YA tomadas (citadas, no reabiertas)

Estas decisiones vienen de ADR-0026 (D1-D9) y del blueprint v2. Aquí solo se listan como marco fijo; no
se rediscuten.

| Ref. | Decisión fija | Origen |
|---|---|---|
| D-A | Endpoints de intake bajo `app/api/planeacion/*`, **escritura exclusivamente server-side (Admin SDK)**; cliente nunca escribe el expediente (cierra CR-1/CR-2/R8 por diseño). | ADR D3; blueprint §3.7; PLAN Fase 2 |
| D-B | **Handoff Planeación → Ventanilla** como **transacción cross-collection** (`runTransaction` único), con **guard de idempotencia por campo** (`radicadoId == null` en el expediente — el blueprint lo llama `radicadoVentanillaId`), NO por id determinístico (el `radicadoNumero` sale del consecutivo). | ADR D2/D3; blueprint §3.8; código `consecutivo-legal.ts` |
| D-C | **Gate de rol por transición**, explícito (no basta `requireActiveInternalUser`): intake lo opera Planeación (`FUNCIONARIO`@`SEC_PLANEACION` + `ADMIN`); el paso `RADICADO` lo ejecuta Ventanilla (`RECEPCIONISTA`/`ADMIN`). Sin rol nuevo (YAGNI, R15). | ADR D2; blueprint §3.7; patrón `radicacion/interna/route.ts:280-284` |
| D-D | **Relectura de precondiciones dentro de la tx** (completitud, `radicadoId==null`, `origen`) — no confiar en el estado leído antes de abrir la transacción. | blueprint §3.8; revisión Seguridad §C-15 |
| D-E | **Proyección minimizada** hacia Ventanilla (bandeja "listos" ve `numeroExpediente`/`tipoTramite`/`estado`, **sin PII** de solicitante/predio); consultas por cédula/matrícula solo server-side, con scope de tenant + auditoría (R9, Ley 1581). | blueprint §3.7/§6.2 |
| D-F | **Anti-forja:** el radicado deriva estado/consecutivo/actor **server-side**; el expediente solo aporta campos **whitelisted** (proyección). El body nunca aporta campos de estado. | blueprint §3.8/C-15; patrón `radicacion/interna/route.ts:300-355,433-451` |
| D-G | **Gate de existencia real de Storage** antes de `COMPLETO` (`moveVerificado==true` por requisito `RECIBIDO`, o verificación de existencia) — evita radicar con evidencia huérfana (R7, N8). | blueprint §3.8 |
| D-H | El motor es **genérico en la intake** (recepción→revisión→completitud→handoff→radicación) y **específico en la resolución** (Fase 4, por código con ADR). Fase 2 **no** incluye resolución. | ADR D1; blueprint §1/§2.1 |

### 2.b) Contratos construibles AHORA (sin ninguna regla de negocio)

Todo lo de esta sección se puede especificar y congelar hoy. Ninguna de estas firmas cambia cuando lleguen
los insumos externos; los insumos rellenan **datos** (la Definición de Trámite) o **un único campo** del
handoff (`termino`), no la forma de los contratos.

#### 2.b.1 — Esqueleto ESTRUCTURAL de la máquina de estados de intake (flujo, no ley)

Transiciones de **flujo** (cerradas en código, blueprint §2.1). No son reglas legales: son el orden en que
un expediente atraviesa la recepción. La *cantidad de días* de cada plazo y *cuándo arranca el término*
son datos/placeholder (§2.c), no forman parte de este esqueleto.

```
RECIBIDO ──► EN_REVISION ──► COMPLETO ──► RADICADO
                 ▲   │
                 │   ▼
              SUBSANACION  (SUSPENDIDO reservado EXCLUSIVAMENTE para suspensión de término, no para intake)
```

Contrato de cada transición (a fijar como tabla en código, sin valores legales):
`{ desde, hacia, rolAutorizado, precondicionEstructural, eventoTrazabilidadObligatorio }`.
- `EN_REVISION → COMPLETO`: precondición estructural = `evaluarCompletitud(...).completo === true` **y** gate
  de Storage D-G. (El evaluador ya existe y es puro — §2.b.4.)
- `EN_REVISION ⇄ SUBSANACION`: al crear observación de subsanación se transita a `SUBSANACION`; al resolver,
  vuelve a `EN_REVISION`. El **plazo** de la subsanación es dato del régimen (§2.b.4), no del esqueleto.
- `COMPLETO → RADICADO`: lo ejecuta Ventanilla vía handoff (§2.b.3). Es la frontera Planeación↔Ventanilla.
- **Trabajo de cierre de contrato (Fase 1/2, no invención):** reconciliar el enum mínimo de Fase 0
  (`EN_REVISION | SUBSANACION | COMPLETO | RADICADO | SUSPENDIDO | ARCHIVADO`, `tipos.ts:171-177`) con el
  enum de intake del blueprint (`RECIBIDO → EN_REVISION → SUBSANACION_PLANEACION ↔ EN_REVISION → COMPLETO →
  RADICADO`). Faltan `RECIBIDO` y el nombre `SUBSANACION_PLANEACION`. Es **cierre de enum estructural**
  (deuda A2-#2/#11), decidible sin insumo jurídico. → **firestore-datos + dev-backend + arquitecto.**

#### 2.b.2 — Firma request/response de cada endpoint del intake

Todos: `runtime = 'nodejs'`; gate D-C; validación estricta anti-forja D-F; rate-limit por `uid` (patrón
`radicacion/interna/route.ts:164,286`). Las firmas son **estructurales**; ningún campo de estado se lee del
body. El único campo cuyo **cálculo** está gated por placeholder es `termino` en el handoff (§2.c).

| Endpoint | Método | Request (whitelist) | Response OK | Notas |
|---|---|---|---|---|
| `/api/planeacion/expedientes` | POST | `{ tramiteId, solicitante{...}, contexto:Record<string,primitivo>, predio?{...} }` | `{ ok, expedienteId, numeroExpediente }` | Crea expediente `origen:'NATIVO'`, estado inicial `RECIBIDO`, **congela** la Definición vigente (foto inmutable, patrón `radicacion/route.ts` de "definición congelada"). `numeroExpediente` ← serie `expedientes` (§2.b.5). Formato del número = `<<PLACEHOLDER: FORMATO_NUMERO_EXPEDIENTE>>`. |
| `/api/planeacion/expedientes/{id}/documentos` | POST (multipart) | `{ requisitoId, archivo }` | `{ ok, documentoId, version, hashSha256, moveVerificado }` | Staging → magic-bytes → **hash SHA-256 server-side** → versión inmutable append-only (D7). Reusa el flujo staging→finalize de la pieza angular (`radicacion/interna/route.ts:453-467,599-607`). |
| `/api/planeacion/expedientes/{id}/checklist` | POST | `{ requisitoId, estado:'APORTADO'|'NO_APLICA'|'PENDIENTE', documentoIds:string[] }` | `{ ok, completitud: ResultadoCompletitud }` | Actualiza el `AporteRequisito` y **reevalúa completitud** con la función pura (§2.b.4). No decide legalidad, solo refleja estado documental. |
| `/api/planeacion/expedientes/{id}/observaciones` | POST | `{ requisitoId?, texto }` | `{ ok, observacionId, fechaLimite, estado:'SUBSANACION' }` | Crea observación y transita a `SUBSANACION`. `fechaLimite` ← reloj parametrizado (§2.b.4) con el **régimen de la Definición** (valores = `<<PLACEHOLDER: REGIMEN_SUBSANACION_LICENCIA_VALORES>>`). |
| `/api/planeacion/expedientes/{id}/completitud` | GET | — | `{ completitud: ResultadoCompletitud }` | Proyección de solo lectura del evaluador puro; alimenta el gate del modal "Enviar a Ventanilla" (§3). |
| `/api/planeacion/expedientes/{id}/handoff` | POST | `{ confirmacion }` (fricción; nunca campos de estado) | `{ ok, radicadoNumero, expedienteEstado:'RADICADO' }` | Handoff atómico (§2.b.3). |

Contrato de error uniforme (patrón `RespuestaRadicacionInternaError`): `{ error:string, errores?:string[] }`
con status `400|401|403|429|500`. **dev-backend** implementa; **seguridad** revisa anti-forja; **firestore-datos**
revisa shapes/índices; **qa** arma la matriz.

#### 2.b.3 — Contrato del handoff (idempotencia + anti-forja) — congelable hoy salvo el campo `termino`

Molde confirmado en `radicacion/interna/route.ts:471-596` y `consecutivo-legal.ts`. Secuencia dentro de un
**único `runTransaction`** (solo cómputo puro + `tx.*`, ningún I/O de Storage dentro del callback):

```
1. leerConsecutivosLegales(tx, db, ahora, [{ serie:'radicados', formatear: <formateador legal> }])
   └─ (para NATIVO). Se CONSERVA el arreglo devuelto (identidad exigida por confirmar…).
2. Relectura in-tx del expediente:  radicadoId == null  (GUARD idempotencia)
                                     estado == COMPLETO   (gate de flujo)
                                     gate D-G (moveVerificado por requisito RECIBIDO)
                                     evaluarCompletitud(...).completo === true (gate de datos)
3. SEAM de bifurcación por `origen` (R5):  NATIVO → consume 'radicados'
                                           MIGRADO_EN_TRAMITE → consume 'salidas' o enlaza legado  [Fase 5]
4. construir proyección minimizada del radicado (campos whitelisted; anti-forja D-F)
5. confirmarConsecutivosLegales(tx, ahora, pendientes)
6. tx.create(ventanilla_radicados/{radicadoNumero}, radicado)     // tx.create → fail-closed ante colisión
7. tx.update(expedientes/{id}, { radicadoId, radicadoNumero, estado:'RADICADO', termino: <ver placeholder> })
8. tx.set(expedientes/{id}/actuaciones/{detId}, actuación fundacional EN_VIVO/REAL)  // dentro de la tx
```

- **Idempotencia:** garantizada por el guard de campo (paso 2) + `tx.create` (paso 6). Un reintento no
  duplica; concurrentes serializan (Firestore).
- **Anti-forja:** el radicado deriva estado/consecutivo/actor server-side (paso 4); el expediente aporta
  solo campos whitelisted.
- **SEAM de migrados presente desde ahora (paso 3):** aunque Fase 2 solo maneja `NATIVO`, la bifurcación
  queda como punto de extensión explícito para que Fase 5 se inserte **sin rediseñar** la transacción
  (corrige R5 por diseño, no por parche posterior).
- **El ÚNICO punto gated por placeholder es el paso 7 (`termino`)** y el paso 1 (**qué serie/número inicia
  términos**): *cuándo* nace el término, *cuál* de los dos números lo dispara y su *valor* dependen del
  concepto jurídico (§2.c: `INICIO_TERMINO_PRINCIPAL`, `NOMENCLATURA_DOS_NUMEROS_AGN060`,
  `TERMINO_PRINCIPAL_LICENCIA_VALOR`). El **resto de la transacción se congela hoy**; rellenar el término
  es fijar un campo de datos + una rama de cálculo ya prevista, no rediseñar el handoff.

**Deuda ya registrada que este contrato consume (no es deuda nueva):** A2-#7 (cablear
`verificarAvanceCounter` a `confirmarConsecutivosLegales` **antes** de introducir la serie `expedientes`),
A2-#6 (`tenantId` denormalizado en `Actuacion`/`Observacion` para `collectionGroup`), A2-#9 (mapper ISO→
`Timestamp` en la frontera de persistencia). Se resuelven en Fase 1; el contrato del handoff las asume.

#### 2.b.4 — Cómo reusa Fase 0 (piezas puras, sin cambio de firma)

- `evaluarCompletitud(tramite, aportes, contexto)` (`completitud.ts:173`) — **se usa tal cual** en el
  endpoint de checklist y en el gate del handoff. Devuelve `{ completo, faltantes, noAplicables,
  indeterminados }`. Semántica fail-closed de tres valores (Kleene) ya implementada: un requisito
  `INDETERMINADO` (contexto incompleto) **nunca** deja `completo:true`. El endpoint solo persiste el
  resultado.
- Reloj de subsanación parametrizado (`subsanacion-regimen.ts`): `calcularLimiteSubsanacion`,
  `calcularLimiteConProrroga`, `calcularFinVentanaRequerimiento`, `dentroVentanaRequerimientoRegimen` — se
  usan tal cual. **No hay ningún número legal hardcodeado**; consumen el `RegimenSubsanacion` de la
  Definición (valores = placeholder).
- `consecutivo-legal.ts`: `leerConsecutivosLegales` / `confirmarConsecutivosLegales` (patrón H3, atomicidad
  contador↔documento) y `verificarAvanceCounter` (guard D9). La serie `'expedientes'` **ya está** en el
  tipo `SerieConsecutivo` (`:32`), extensión verificada no-breaking (el `WeakMap` está keyed por `tx`,
  agnóstico al valor de serie).
- Tipos: `DefinicionTramite`, `Expediente`, `AporteRequisito`, `Actuacion`, `Observacion`,
  `ContextoEvaluacionRequisito`, `CondicionRequisito` (`tipos.ts`) — son el vocabulario del intake. Se
  reconcilian con `src/types/expediente.ts` en Fase 1 (deuda A2-#11), sin cambiar semántica.

### 2.c) BLOQUEOS de Fase 2 (con placeholder)

Cada bloqueo indica **qué queda listo hoy** y **qué se rellena** al llegar el insumo. Ningún placeholder
esconde una regla inventada: son huecos declarados.

- **`<<PLACEHOLDER: INICIO_TERMINO_PRINCIPAL — insumo: concepto jurídico formal>>`**
  El hito que dispara el término administrativo principal (D5: ¿radicación en Ventanilla vs recepción/"legal
  y debida forma"?). *Listo hoy:* el handoff (§2.b.3) escribe `termino` en el paso 7 y la máquina de estados
  reserva el momento; la estructura no cambia. *Se rellena:* el disparador (qué transición) y la política de
  anclaje. **Nota:** las fuentes contienen una tensión no resuelta sobre este hito — ver Inconsistencia I-1.

- **`<<PLACEHOLDER: TERMINO_PRINCIPAL_LICENCIA_VALOR — insumo: concepto jurídico formal>>`**
  Valor `{dias, unidad}` del término principal. Las fuentes citan "45 días hábiles (Decreto 1077)" pero lo
  marcan `[VALIDACIÓN EXTERNA: oficina jurídica]`; aquí se trata como valor a confirmar. *Listo hoy:*
  `TerminoLegal {dias, unidad}` (`tipos.ts:28`) congelado; es **dato** de la Definición. *Se rellena:* el
  valor. **Salvedad técnica ya registrada (A2-#3):** si el término se expresara en MESES,
  `TerminoLegal.unidad` aún no admite `'MESES'` (sí lo admite `RegimenSubsanacion`) → ampliación aditiva de
  la unión, no rediseño.

- **`<<PLACEHOLDER: REGIMEN_SUBSANACION_LICENCIA_VALORES — insumo: concepto jurídico formal>>`**
  Valores `{dias, unidad, prorrogaDias, ventanaRequerimiento}`. Fuentes citan "30+15 hábiles (Decreto 1077,
  NO Ley 1755)" marcado `[VALIDACIÓN EXTERNA]`. *Listo hoy:* `RegimenSubsanacion` (`tipos.ts:57`) y el reloj
  parametrizado congelados. *Se rellena:* los valores, como dato de la Definición.

- **`<<PLACEHOLDER: PLAZO_MAX_REVISION_PREVIA — insumo: concepto jurídico formal>>`**
  Plazo reglado máximo de la fase previa de Planeación (salvaguarda de silencio positivo, D5). *Listo hoy:*
  el estado `EN_REVISION`/`SUBSANACION` existe; se puede colgar un reloj de "revisión previa" parametrizado
  reutilizando el motor de fechas. *Se rellena:* el tope y su unidad. **Nota:** sin este tope, el diseño
  tiene un flanco jurídico abierto — Inconsistencia I-3.

- **`<<PLACEHOLDER: SALIDA_FORZOSA_REVISION_PREVIA — insumo: concepto jurídico formal>>`**
  La salida obligatoria al vencer la revisión previa (devolución motivada o radicación en legal y debida
  forma). *Listo hoy:* punto de transición reservado en la máquina de estados. *Se rellena:* la acción y sus
  precondiciones legales.

- **`<<PLACEHOLDER: NOMENCLATURA_DOS_NUMEROS_AGN060 — insumo: concepto jurídico formal>>`**
  Relación entre `numeroExpediente` (interno) y `radicadoNumero` (legal) frente a AGN 060, y **cuál número
  inicia los términos**. *Listo hoy:* los dos números existen como campos distintos y series distintas
  (`expedientes` vs `radicados`); el enlace bidireccional está en el handoff. *Se rellena:* cuál es
  "radicado-de-comunicación" vs "número-de-expediente", y qué dice la constancia. **Nota:** Inconsistencia
  I-5.

- **`<<PLACEHOLDER: ACTO_COMPETENCIA_EXPEDIR — insumo: acto administrativo del alcalde + concepto jurídico>>`**
  Acto que designa la competencia de expedir en Planeación (municipio sin curador, Ley 388 art. 99). *Listo
  hoy:* nada de código depende de esto en la intake. *Se rellena:* respaldo administrativo del procedimiento
  (no es campo de datos; es precondición de legitimidad del módulo).

- **`<<PLACEHOLDER: SILENCIO_POSITIVO_REGLA — insumo: concepto jurídico formal>>`**
  Cómo blindar el momento en que nace el término y cómo señalizar el riesgo de silencio positivo (Ley 388
  art. 99). *Listo hoy:* certificación de completitud con fecha (dato del handoff); estado/alerta
  reservables. *Se rellena:* la regla y su efecto. (La **resolución** motivada, recursos y notificación
  CPACA son **Fase 4**, fuera de este alcance — D-H.)

- **`<<PLACEHOLDER: REQUISITOS_LICENCIA_PAGINA_2 — insumo: página 2 del checklist + validación Planeación>>`**
  Los requisitos faltantes (hoy solo pág. 1 de 2). *Listo hoy:* la pág. 1 (19 requisitos) es expresable con
  el DSL categórico actual — obligatorio/opcional/condicional con `IGUAL/DISTINTO/EN/Y/O/NO` (ej.:
  `esApoderado`, `categoriaComplejidad∈{BAJA,MEDIA}`, `sujetoTituloENSR10=false`,
  `predioRodeadoEspacioPublico=false`, `tipoPersona`). *Se rellena:* añadir los requisitos de la pág. 2
  como **dato** de la Definición. **⚠ Riesgo acotado (A1/A2-#5):** si la pág. 2 introduce un requisito con
  **umbral numérico** (área, nº de pisos, valor de obra), **alternativa "N-de-M"** o **condición sobre el
  aporte de otro requisito**, eso **no** es expresable por dato y exige ampliar el DSL **por ADR** (no
  implícito). Es el único punto donde rellenar un placeholder podría tocar el núcleo — ver §5.

- **`<<PLACEHOLDER: CONTEXTO_CLAVES_LICENCIA — insumo: página 2 del checklist + validación Planeación>>`**
  El catálogo completo de claves de `ContextoEvaluacionRequisito` para Licencia. *Listo hoy:* el mapa de
  contexto es abierto (`tipos.ts:83`); las claves de la pág. 1 ya se conocen. *Se rellena:* el conjunto
  completo + su validador declarativo (deuda A2-#4: catálogo de claves + validación al publicar la
  Definición, para que un typo dé error, no un `INDETERMINADO` silencioso).

- **`<<PLACEHOLDER: FORMATO_NUMERO_EXPEDIENTE — insumo: ADR/propietario + validación Planeación>>`**
  Formato del `numeroExpediente` interno (el blueprint sugiere `EXP-{AAAA}-{#####}`, marcado `[VALIDACIÓN
  EXTERNA]`). *Listo hoy:* el `SolicitudSerie.formatear` es una función inyectada (`consecutivo-legal.ts:37`);
  cambiar el formato es cambiar un formateador, no el flujo. *Se rellena:* la función de formato + revisión
  de namespacing/sharding del contador (deuda A2-#13).

---

## 3. FASE 3 — Paneles

### 3.a) Decisiones YA tomadas (blueprint §6)

| Panel | Decisión fija |
|---|---|
| **Planeación** (mesa de revisión, completo) | Bandeja con **búsqueda por predio/matrícula/solicitante**; KPI cards con riel; **semáforo de 4.º estado SUSPENDIDO** (azul-pizarra + glifo pausa, "en pausa desde DD/MM", **nunca rojo**, no cuenta días vencidos). Detalle por pestañas: Resumen · **Requisitos** (checklist tri-estado por requisito, `OBLIG`/`OPCIONAL` como **texto** además de color, observación por requisito, versionado por documento lógico colapsado) · Documentos · Subsanaciones (notificación **humana**, nunca automática — Principio 9; al enviar → `SUSPENDIDO`) · Visitas · **Actuaciones (timeline persistente)**. **Modal irreversible "Enviar a Ventanilla"** con fricción (escribir el número de expediente), **deshabilitado si hay obligatorios pendientes** (espejo del gate de datos §2.b.4). |
| **Ventanilla** (mostrador, mínimo) | Deliberadamente pobre en acciones. Bandeja "listos para radicar" con **proyección minimizada** (D-E, sin PII). **No abre el interior** del expediente. Modal de fe pública; el número de radicado **no se muestra antes de confirmar** (sale del consecutivo). Post-radicación: seguimiento (solo lectura) + archivo. |
| **Admin del checklist** (`tramite_definiciones`) | Editor sin código: requisitos (nombre, obligatorio/opcional/condicional, ayuda, orden drag), flags de rama. Serie TRD **solo lectura**. Versionado explícito borrador→publicar; publicar crea v(n+1); **los expedientes en curso conservan su foto** de Definición. |
| Design system | **Tema claro real** (canvas `#F8FAF7`, tarjetas blancas, verde institucional `#14532D`), verificado contra `VistaMiGestion`/`page.tsx`, **no** la memoria oscura (D-UX 21). |

### 3.b) Mapa de reutilización de componentes existentes + andamiaje

Componentes reales localizados en el repo y su seam de reutilización (todos bajo
`app/interno/dashboard/components/`):

| Componente existente | Uso en Fase 3 | Seam / adaptación necesaria (estructural, sin datos reales) |
|---|---|---|
| `BusquedaAvanzadaPanel.tsx` | Bandeja de Planeación con búsqueda | Está **tipado a `VentanillaRadicado`** y llama `POST /api/radicados/busqueda-avanzada`. **Adaptación:** parametrizar (o crear hermano) sobre una proyección de `Expediente`, con filtros por predio/matrícula/solicitante. No se reescribe el patrón (modal lateral + chips + paginación); se generaliza el tipo y el endpoint. → **dev-frontend + arquitecto** (definir la interfaz genérica). |
| `TimelineAuditoria.tsx` | Timeline persistente de Actuaciones | Está **tipado a `AuditoriaEntry`** (radicado) y **nace oscuro** (`bg-indigo-500`, emojis). **Adaptación:** re-tematizar a claro (D-UX/§6.1), mapear `Actuacion` (`tipos.ts:224`) al shape del timeline, y **añadir distintivo `REAL` vs `RECONSTRUIDO`** (honestidad probatoria — relevante en Fase 5, pero el badge se prevé ya). → **dev-frontend.** |
| `mipg/SemaforoTermino.tsx` (`calcularSemaforo`, `EstadoTermino`) | Semáforo de la bandeja | `EstadoTermino` hoy es `EN_TERMINO \| POR_VENCER \| VENCIDO \| RESUELTO` — **falta `SUSPENDIDO`** (4.º estado exigido, slate + pausa, nunca rojo). Además está acoplado a `VentanillaRadicado.termino`; el `Expediente.termino` es **`null` hasta la radicación** → el semáforo debe manejar un estado "sin término" (ligado a `INICIO_TERMINO_PRINCIPAL`). **Adaptación aditiva:** extender el enum + variante visual; leer `Expediente.termino`. → **dev-frontend + ux.** |
| KPI cards con riel (panel operativo ampliado) + `ModalRadicado.tsx` (patrón modal + anti-doble-submit) | KPIs de la bandeja; base del modal de fricción "Enviar a Ventanilla" | Reusar patrón de tarjetas y de modal con confirmación; **añadir** la fricción "escribir el número de expediente" y el bloqueo por obligatorios pendientes (espejo de `evaluarCompletitud`). → **dev-frontend.** |

**Andamiaje de rutas/estructura (construible sin datos reales, con fixtures/mock):**
- `app/planeacion/*` — bandeja + detalle por pestañas; visible solo a roles de Planeación (gate en layout).
- Bandeja "listos para radicar" de Ventanilla — nueva vista sobre la proyección minimizada (puede colgar
  del dashboard interno existente).
- Admin del checklist — editor de `tramite_definiciones` (borrador→publicar), serie TRD solo lectura.
- Todo lo anterior se **maqueta con datos mock** hasta la validación con Planeación + stage.

### 3.c) BLOQUEOS de Fase 3 (con placeholder)

- **`<<PLACEHOLDER: CAMPOS_PREDIO_Y_BUSQUEDA — insumo: validación Secretaría de Planeación>>`**
  Los campos exactos del predio (dirección, matrícula inmobiliaria, cédula catastral, área, uso del suelo,
  …) y los criterios reales de búsqueda. *Maquetable hoy:* la bandeja, los filtros y el layout con campos
  provisionales. *Se rellena:* el conjunto de campos y los índices compuestos que cada búsqueda exige
  (deben enumerarse en `firestore.indexes.json` **antes** del frontend — no hay gate que cace un índice
  faltante; R10).

- **`<<PLACEHOLDER: FLUJO_REAL_PLANEACION — insumo: validación Secretaría de Planeación>>`**
  El orden real de revisión, etiquetas, y la mecánica de confirmación del envío irreversible. *Maquetable
  hoy:* las pestañas y el modal de fricción con copy provisional. *Se rellena:* el flujo y los textos
  operativos.

- **`<<PLACEHOLDER: TEXTOS_OFICIALES — insumo: Secretaría de Planeación + oficina jurídica>>`**
  Texto del oficio de subsanación, del aviso de silencio positivo y del modal de fe pública de Ventanilla.
  *Maquetable hoy:* los contenedores/plantillas. *Se rellena:* el copy legal (jurídica para el aviso de
  silencio; Planeación para el oficio).

- **`<<PLACEHOLDER: POLITICA_VERSION_CHECKLIST_EN_CURSO — insumo: validación Secretaría de Planeación>>`**
  Política ante una nueva versión de checklist para expedientes en curso. *Decidido a nivel de dato:* los
  expedientes conservan su **foto** de Definición (blueprint §6.3). *Se rellena:* si Planeación exige alguna
  excepción operativa a esa regla.

- **`<<PLACEHOLDER: DATOS_STAGE — insumo: entorno stage con datos>>`**
  UAT del panel con datos reales sobre stage (precondición de la Fase 3 en PLAN_FASES; stage aún no existe —
  frente de entornos). *Maquetable hoy:* todo con mock. *Se rellena:* la validación de aceptación UX con la
  funcionaria de Planeación.

---

## 4. Registro consolidado de bloqueos

| # | Bloqueo (placeholder) | Qué habilita al desbloquearse | Insumo requerido | Responsable del insumo |
|---|---|---|---|---|
| B1 | `INICIO_TERMINO_PRINCIPAL` | Cálculo del `termino` en el handoff (paso 7) y la política de anclaje | Concepto jurídico formal | Oficina jurídica (Alcaldía) |
| B2 | `TERMINO_PRINCIPAL_LICENCIA_VALOR` | Valor `{dias,unidad}` del término (dato de la Definición) | Concepto jurídico formal | Oficina jurídica |
| B3 | `REGIMEN_SUBSANACION_LICENCIA_VALORES` | Valores del reloj de subsanación (dato de la Definición) | Concepto jurídico formal | Oficina jurídica |
| B4 | `PLAZO_MAX_REVISION_PREVIA` | Reloj y salida de la revisión previa (salvaguarda silencio positivo) | Concepto jurídico formal | Oficina jurídica |
| B5 | `SALIDA_FORZOSA_REVISION_PREVIA` | Acción/precondición al vencer la revisión previa | Concepto jurídico formal | Oficina jurídica |
| B6 | `NOMENCLATURA_DOS_NUMEROS_AGN060` | Constancia + cuál número inicia términos | Concepto jurídico formal | Oficina jurídica |
| B7 | `ACTO_COMPETENCIA_EXPEDIR` | Legitimidad del procedimiento (competencia de Planeación) | Acto administrativo del alcalde + concepto | Alcalde / jurídica |
| B8 | `SILENCIO_POSITIVO_REGLA` | Blindaje del hito + señalización de riesgo | Concepto jurídico formal | Oficina jurídica |
| B9 | `REQUISITOS_LICENCIA_PAGINA_2` | Completar la Definición de Licencia (dato) | Página 2 del checklist | Secretaría de Planeación |
| B10 | `CONTEXTO_CLAVES_LICENCIA` | Catálogo completo de claves + validador de la Definición | Página 2 + validación | Secretaría de Planeación |
| B11 | `FORMATO_NUMERO_EXPEDIENTE` | Formateador del `numeroExpediente` (función inyectada) | ADR/propietario + Planeación | Propietario / Planeación |
| B12 | `CAMPOS_PREDIO_Y_BUSQUEDA` | Campos del predio + índices compuestos de búsqueda | Validación con Planeación | Secretaría de Planeación |
| B13 | `FLUJO_REAL_PLANEACION` | Orden/etiquetas/mecánica del panel | Validación con Planeación | Secretaría de Planeación |
| B14 | `TEXTOS_OFICIALES` | Copy legal (oficio, aviso silencio, fe pública) | Planeación + jurídica | Planeación / jurídica |
| B15 | `POLITICA_VERSION_CHECKLIST_EN_CURSO` | Excepciones a la regla de "foto" de Definición | Validación con Planeación | Secretaría de Planeación |
| B16 | `DATOS_STAGE` | UAT del panel con datos reales | Stage con datos | Frente de entornos |

**Pre-requisitos técnicos (no placeholders de negocio — se cierran sin insumo externo, en Fase 1):**
guard monotónico de `counters` + narrowing del wildcard (hoy `firestore.rules:208-211` da `read,write` a
ADMIN/RECEPCIONISTA **sin constraint de valor** — R6/D9); cableado de `verificarAvanceCounter` a
`confirmarConsecutivosLegales` (A2-#7); extensión del detector de fantasmas a `expedientes`; los 8 índices
compuestos enumerados **antes** del frontend (R10); `tenantId` denormalizado en `Actuacion`/`Observacion`
(A2-#6); mapper ISO→`Timestamp` (A2-#9). → **firestore-datos + seguridad.**

---

## 5. Checklist "listo para continuar sin retrabajo"

Contratos/interfaces que quedan **congelados** de modo que rellenar los placeholders sea fijar **datos** o
**un campo previsto**, sin rediseñar. Cada ítem: qué se congela y por qué rellenar el hueco no lo rompe.

- [x] **`TerminoLegal {dias, unidad}`** — el término es dato. Rellenar B2 = editar la Definición. (Salvedad
  aditiva A2-#3: si es en MESES, ampliar la unión `UnidadTermino`; aditivo, no rediseño.)
- [x] **`RegimenSubsanacion {dias, unidad, prorrogaDias, ventanaRequerimiento}`** + reloj parametrizado — el
  régimen es dato. Rellenar B3 = editar la Definición. Ningún valor legal vive en código.
- [x] **`DefinicionTramite`** (requisitos[], términos, régimen, flags) versionada append-only con **foto
  congelada** en cada expediente — añadir la pág. 2 (B9) = editar/publicar la Definición; los expedientes en
  curso no se alteran.
- [x] **DSL `CondicionRequisito` (categórico) + `ContextoEvaluacionRequisito` (mapa abierto)** — nuevas
  condiciones categóricas = dato. **⚠ Única frontera que puede forzar cambio de núcleo:** si B9/B10 traen un
  **umbral numérico**, **"N-de-M"** o **condición sobre aportes**, se amplía el DSL **por ADR** (A1/A2-#5) —
  escape hatch conocido y gobernado, **no** un rediseño silencioso. Este es el punto a vigilar cuando llegue
  la pág. 2.
- [x] **`evaluarCompletitud` (fail-closed, tres valores)** — pura y estable; los endpoints solo persisten su
  salida.
- [x] **Firmas request/response de los 6 endpoints de intake** (§2.b.2) — estructurales; ningún campo de
  estado en el body. El **único** campo gated es `termino` en el handoff.
- [x] **Esqueleto de la máquina de estados de intake** (`RECIBIDO→EN_REVISION⇄SUBSANACION→COMPLETO→
  RADICADO`, `SUSPENDIDO` reservado) — cerrado en código. Los estados de **resolución** (Fase 4) se añaden al
  enum **por ADR**, de forma aditiva, sin tocar la intake.
- [x] **Transacción de handoff** (guard `radicadoId==null`, `tx.create` fail-closed, anti-forja, consecutivo,
  actuación fundacional in-tx) con **seam de bifurcación por `origen`** ya presente — Fase 5 (migrados) se
  inserta sin rediseñar; rellenar B1/B6 fija el término y la numeración, no la transacción.
- [x] **Proyección minimizada Ventanilla** (D-E) — shape congelado; sin PII.
- [x] **Serie `expedientes`** en `SerieConsecutivo` + guard D9 — extensión no-breaking ya en el tipo; el
  formateador (B11) es una función inyectada.
- [x] **Seams de reutilización UI** identificados (§3.b): `BusquedaAvanzadaPanel` (generalizar tipo/endpoint),
  `TimelineAuditoria` (re-tema claro + `REAL/RECONSTRUIDO`), `SemaforoTermino` (añadir `SUSPENDIDO` + término
  nulo), modal de fricción. Rellenar B12/B13/B14 = poblar campos/copy/mocks, no reescribir componentes.

**Conclusión de diseño-prep:** con estos contratos congelados, los insumos externos rellenan **datos de
Definición**, **valores legales**, **copy** y **campos de predio** — más **un** campo de cálculo en el
handoff (`termino`). El **único** punto que puede exigir tocar el núcleo (y solo vía ADR, nunca implícito)
es la aparición de un requisito **no categórico** en la pág. 2 del checklist. Todo lo demás continúa sin
retrabajo.

---

## Anexo — Inconsistencias detectadas (SEÑALADAS, no resueltas)

Conforme al encargo, se señalan las tensiones entre el procedimiento interno y la normativa (o entre las
propias fuentes). **No se resuelven aquí** — su resolución es del concepto jurídico (I-1..I-5) o de cierre
técnico en Fase 1 (I-6..I-9).

- **I-1 — Hito de arranque del término (tensión viva).** El procedimiento que quiere la Alcaldía arranca el
  término en la "radicación en Ventanilla" (ADR D5); el blueprint §4.1 reinterpreta que "radicación en legal
  y debida forma" (D.1077 art. 2.2.6.1.2.3.1) coincide materialmente con el **expediente completo** al final
  de la revisión; y la revisión v1 de `CN-modulo-planeacion-licencias` (§A.1) afirma que el término
  legalmente arranca en la **recepción**. Tres anclajes distintos conviven en las fuentes. Bloqueante para
  B1. **Insumo:** concepto jurídico.
- **I-2 — Constancia de radicación al primer contacto.** El flujo solo radica en el paso final; CPACA art.
  15 y AGN 060 art. 5 obligan a numeración consecutiva cronológica + constancia **desde la presentación**.
  Negarlo podría vulnerar el derecho a radicar. **Insumo:** concepto jurídico.
- **I-3 — Revisión previa sin figura legal ni plazo.** Riesgo de tutela por derecho de petición (revisión
  indefinida) y de silencio positivo si el ciudadano presentó completo (Ley 388 art. 99). Requiere plazo
  reglado + salida forzosa (B4/B5). **Insumo:** concepto jurídico.
- **I-4 — Dos subsanaciones conflacionadas.** Completitud pre-radicación (no suspende: el término aún no
  nace) vs acta de observaciones post-radicación (D.1077 art. 2.2.6.1.2.2.4, suspende los términos).
  Tratarlas con una sola máquina produce cómputos ilegales. El código de Fase 0 ya separa el reloj
  parametrizado; falta la decisión jurídica de cuál régimen aplica a cuál fase. **Insumo:** concepto jurídico.
- **I-5 — AGN 060 y los dos números.** No pueden ser dos radicados del mismo hecho; deben ser
  radicado-de-comunicación vs número-de-expediente, uno referenciando al otro, y la constancia debe indicar
  cuál inicia los términos (B6). **Insumo:** concepto jurídico.
- **I-6 — `counters` rebobinable desde cliente (código vs seguridad).** `firestore.rules:208-211` concede
  `read,write` a ADMIN/RECEPCIONISTA **sin constraint de valor** sobre `counters/{document}` (wildcard) —
  permitiría rebobinar el contador y, por ser wildcard, expondría `counters/expedientes-{año}`. Debe cerrarse
  (guard monotónico o narrowing) **antes** de introducir la serie `expedientes`. Cierre técnico Fase 1
  (R6/D9). **Insumo:** ninguno externo — decisión de seguridad.
- **I-7 — Enum de intake sin cerrar.** El enum mínimo de Fase 0 (`tipos.ts:171-177`) carece de `RECIBIDO` y
  usa `SUBSANACION` donde el blueprint §2.1 exige `SUBSANACION_PLANEACION`, y reserva `SUSPENDIDO` solo para
  suspensión de término. Cierre estructural en Fase 1/2 (A2-#2/#11), sin insumo externo.
- **I-8 — Desfase de numeración de fases entre fuentes.** `PLAN_FASES_MOTOR_EXPEDIENTES.md` (autoritativo:
  Fase 2 = intake, Fase 3 = paneles, Fase 5 = migración) **difiere** de la tabla A2 del ADR y del §8 del
  blueprint, que bundlean paneles dentro de "Fase 0" y sitúan migración en "Fase 2". Riesgo de que un
  especialista confunda "Fase 2" del ADR-A2 (migración) con la "Fase 2" del plan (intake). Se señala para
  alinear la comunicación; sin insumo externo.
- **I-9 — Rutas fuente ausentes en `origin/main`.** ADR-0026, blueprints del motor, `PLAN_FASES`,
  `docs/planes/` y `lib/motor-expedientes/*` no están aún en `main` (viven en la rama de Fase 0, sin
  mergear). Este documento los referencia por ruta esperada; su resolución depende del orden de merge. Sin
  insumo externo — es coordinación de ramas.

---

*Documento de preparación de diseño — Arquitecto Principal. Solo-lectura sobre el código; ninguna decisión
de producto, seguridad o ley se toma aquí. Los veredictos y ADRs correspondientes son de sus roles.*
