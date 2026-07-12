# Concepto normativo — Ola 2, Frente 2C (hallazgos → controles ejecutables)

**Rol emisor:** Especialista en Gobierno Digital y normatividad colombiana
**Fecha:** 2026-07-11
**Alcance:** convertir los hallazgos abiertos R6, R9 y R10 (`docs/REGISTRO_RIESGOS.md`)
en **controles ejecutables** siguiendo el modelo validado con H1 (ADR-0003) y R8 (ADR-0008):
un test automatizado que **falle si la conformidad regresiona**.
**Restricción de rol:** este documento es concepto normativo. NO propone ni implementa código,
NO decide arquitectura. Es el insumo para el **ADR-0012** que consolida el coordinador.
**Método:** cada afirmación fue verificada contra el código real del worktree (archivo:línea),
no asumida. Los artículos se citan según el análisis ya asentado en
`docs/laboratorio/CONCEPTO_NORMATIVO_FASE2.md` (H1/H2), verificado en fuente oficial.

---

## Resumen del veredicto

| Hallazgo | ¿Convertible a control en Ola 2? | Requisito previo |
|---|---|---|
| **R6** — prórroga sobre término ya vencido | **SÍ** — control directo, sin decisión previa | Ninguno (micro-decisión "rechazar vs. registrar extemporánea": recomiendo rechazar, ver §R6) |
| **R9** — canal de inferencia en búsqueda del mostrador | **SÍ** — control directo; el patrón correcto ya existe en el servidor y solo hay que replicarlo en el cliente | Ninguno |
| **R10** — necesidad de conocer (variante B) | **NO todavía** — requiere decisión de producto/arquitectura (¿qué rol revela, con qué traza?) antes de existir una regla que asertar | Decisión del product-owner sobre el alcance de la variante B (ADR-0006) |

---

## HALLAZGO R6 — La prórroga no se impide si el término original ya venció

### 1. Concepto: **NO CUMPLE** (brecha activa) · Convertible a control: **SÍ**

La Ley 1755/2015 art. 14 (parágrafo) exige que la ampliación excepcional del término se informe
al interesado **antes del vencimiento** del término inicial, con los motivos y el nuevo plazo. Una
prórroga aplicada cuando el término **ya venció** es extemporánea: su premisa legal (avisar antes
de que el plazo expire) ya no puede cumplirse, y no sanea la mora ya consumada del derecho de
petición. El control ejecutable de H1 (`validarProrroga`) enforce **unicidad** y **tope del doble**,
pero **no verifica el timing**: deja pasar una prórroga sobre un radicado vencido.

### Verificación en el código (leído, no asumido)

| Artefacto | Qué verifiqué | Resultado |
|---|---|---|
| `lib/server/radicados-security.ts:71-94` (`validarProrroga`) | Función pura. Solo recibe `prorrogasAplicadas`, `diasProrroga`, `diasRespuesta`. No recibe `fechaVencimiento` ni un reloj; **no existe regla de timing**. | Brecha confirmada: el validador no puede detectar el vencimiento. |
| `app/api/radicados/[radicadoId]/prorroga/route.ts:85-95` | Calcula `nuevaFecha = fechaVencimiento + diasProrroga` y escribe, **sin comparar `fechaVencimiento` contra la fecha actual**. Un radicado con `fechaVencimiento` en el pasado se prorroga igual. | Brecha confirmada en el punto de escritura. |
| `__tests__/prorroga-validacion.test.ts` | Cubre unicidad, tope y frontera `===` (H1). **No hay caso de término vencido.** | Cobertura ausente para R6. |

Nota: `termino.fechaVencimiento` se almacena como fecha concreta ya calculada en días hábiles al
crear/actualizar el radicado. Por eso el control de timing **no necesita recomputar el calendario
hábil colombiano**: le basta comparar `fechaVencimiento` contra el instante de la solicitud. El
cómputo hábil ya está encapsulado en el valor almacenado.

### 2. Análisis por norma

| Norma y artículo | Exigencia | Estado en el sistema | Brecha |
|---|---|---|---|
| **Ley 1755/2015, art. 14, parágrafo** | La ampliación excepcional se informa al interesado **antes del vencimiento** del término, con motivos y nuevo plazo (≤ doble). | Se permite prorrogar con el término ya vencido; el "antes del vencimiento" no se enforce. | **Activa.** El requisito temporal del parágrafo no se cumple. |
| **Ley 1437/2011 (CPACA), art. 3 (celeridad; términos perentorios)** | Los términos son perentorios; su ampliación es reglada y **anticipada**, no retroactiva. | Prórroga extemporánea admitida. | Refuerza la anterior. |
| **Constitución Política, art. 23** | Derecho fundamental de petición → respuesta oportuna. | Una prórroga post-vencimiento oculta una mora ya consumada. | Riesgo de tutela por mora. |

### 3. Aserción exacta del control (la regla hecha test)

> Aplicar una prórroga sobre un radicado cuyo `termino.fechaVencimiento` es **anterior** al instante
> de la solicitud → **rechazado** (no se escribe). Frontera: si `fechaVencimiento === ahora` o es
> futura → permitido (sujeto a las reglas de unicidad y tope ya existentes).

Precedencia sugerida: evaluar el **vencimiento antes** que unicidad/tope (un radicado vencido se
rechaza por extemporáneo con mensaje propio, con independencia de cuántas prórrogas tenga).

### 4. Tipo de control y rol

- **Tipo: test unitario de función pura** — idéntico patrón a H1. Se extiende `validarProrroga` para
  recibir `fechaVencimiento` y un `ahora` **inyectable** (reloj como parámetro, para determinismo del
  test), devolviendo un `RechazoProrroga` cuando el término ya venció. La determinística del reloj es
  lo que hace la aserción reproducible (Principio 13: reproducir antes de corregir).
- **Casos mínimos del control de regresión:** (a) vencido ayer → rechazado; (b) vence hoy/frontera →
  permitido; (c) vence mañana → permitido; (d) precedencia: vencido **y** con prórroga previa → gana
  el rechazo por vencimiento (mensaje de extemporaneidad).
- **Complemento E2E (opcional, no bloqueante):** invertir/extender `e2e/09-prorroga-con-notificacion.spec.ts`
  con un radicado sembrado ya vencido → 409/400, contador y fecha intactos por lectura del documento.
- **Rol técnico: dev-backend** (extiende `validarProrroga` y su invocación en `route.ts`; añade casos
  a `__tests__/prorroga-validacion.test.ts`).

### 5. Micro-decisión de producto (menor, no bloquea el control)

Existe una elección de postura: **(A) rechazar** la prórroga extemporánea (impedir, como H1) o
**(B) permitirla registrándola como "extemporánea"** con traza. Recomiendo **(A) rechazar**: es la
lectura conservadora y conforme, coherente con la casa (H1 "impedir, no advertir") y con el carácter
perentorio del término. Si el product-owner prefiere (B), el control simplemente asertaría "queda
marcada como extemporánea + traza", no cambia el rol ni el tipo de test. Por su bajo peso, **no
degrada R6 a "requiere decisión previa"**: entra en Ola 2 con la postura (A) por defecto.

---

## HALLAZGO R9 — Canal de inferencia en la búsqueda del mostrador

### 1. Concepto: **CUMPLE PARCIALMENTE** (residual de H2) · Convertible a control: **SÍ**

La visualización ya está enmascarada de forma transversal (H2, ADR-0006). El residual es un **canal
de inferencia**: la búsqueda rápida del **cliente** filtra por `nombreCompleto` y `numeroDocumento`
**también sobre radicados reservados**. La fila sale enmascarada, pero su sola aparición al teclear un
nombre/documento concreto **confirma la existencia** de un radicado reservado de esa persona. No revela
una identidad desconocida; permite **confirmar una hipótesis previa** (oráculo). El punto crítico es el
**denunciante con identidad reservada** (Comisaría de Familia, Inspección de Policía): confirmar que
existe su radicado reservado ya es información sensible frente a represalias.

### Verificación en el código (leído, no asumido)

| Artefacto | Qué verifiqué | Resultado |
|---|---|---|
| `app/interno/dashboard/page.tsx:210-218` | El filtro rápido del dashboard compara `r.solicitante.nombreCompleto` y `r.solicitante.numeroDocumento` contra el término, **sin guarda de `identidadProtegida`/`ocultarIdentidad`**. Un reservado coincide por nombre/documento. | Canal de inferencia confirmado (cliente). |
| `app/interno/dashboard/components/ventanilla/VistaVentanilla.tsx:68-72` (`coincideMostrador`, aplicado en `:105`) | Idéntico: matchea `nombreCompleto`/`numeroDocumento` sin guarda de reserva. | Canal de inferencia confirmado (mostrador). |
| `lib/busqueda/filtros-radicado.ts:155-174` (`matchTextoLibre`) | El texto libre `q` protege nombre/documento/email con `!oculto` (líneas 165-167): un reservado **no** matchea por esos campos. | **Patrón correcto ya existente** (servidor). |
| `lib/busqueda/filtros-radicado.ts:183-193` (filtros `nombre`/`documento`/`correo`) | Cada uno hace `if (ocultarIdentidad(r)) return false;` antes de comparar: el reservado se **excluye** de la búsqueda por identidad. | **Patrón correcto ya existente** (servidor). |
| `lib/busqueda/filtros-radicado.ts:83-88` (`ocultarIdentidad`) | Criterio de reserva equivalente a `lib/seguridad/identidad-protegida.ts:37-44`. | La regla ya está codificada; el cliente no la aplica al buscar. |

Conclusión de verificación: la **búsqueda avanzada del servidor ya cierra R9**; la brecha vive solo en
los **filtros rápidos del cliente** (dashboard y mostrador), que buscan sobre el dato crudo. El arreglo
es **replicar el criterio ya existente**, no inventarlo (Principio 3: reutilización).

### 2. Análisis por norma

| Norma y artículo | Exigencia | Estado en el sistema | Brecha |
|---|---|---|---|
| **Ley 1581/2012, art. 4 lit. f (acceso y circulación restringida)** | El conocimiento del dato reservado debe estar **restringido**; no disponible salvo a autorizados. | La búsqueda del cliente permite confirmar existencia por nombre/documento a cualquier interno. | **Baja-media.** Fuga por inferencia, no por visualización. |
| **Ley 1581/2012, art. 4 lit. g (seguridad)** | Medidas para evitar **consulta o uso no autorizado**. | El predicado de búsqueda es una consulta que responde sobre el reservado. | **Baja-media.** |
| **Ley 1474/2011 (reserva de identidad del denunciante)** | La reserva protege al denunciante frente a represalias; el acceso se limita a quien tramita. | Confirmar existencia del radicado reservado erosiona esa reserva. | **Media** en el caso denunciante (numeral exacto a confirmar antes de cita vinculante). |

### 3. Aserción exacta del control (la regla hecha test)

> Dado un radicado con identidad reservada/anónima cuyo `nombreCompleto = "X"` y
> `numeroDocumento = "N"`, una búsqueda del mostrador/dashboard con término `"X"` o `"N"` **NO** debe
> devolverlo (no matchea por identidad). El mismo radicado **sí** sigue siendo hallable por su
> `radicadoId` (que no es dato personal reservado) y por su asunto, igual que hoy hace el servidor.

Es exactamente la invariante que ya cumple `filtros-radicado.ts`; el control la fija también para el
predicado del cliente.

### 4. Tipo de control y rol

- **Tipo: test unitario de función pura.** Hoy el predicado del cliente está **inline** en
  `page.tsx:210-218` y en `coincideMostrador` — no es directamente testeable. Para tener un control de
  regresión, el predicado de búsqueda debe quedar en una **función pura** que aplique el criterio de
  reserva (idealmente **reutilizando** `matchTextoLibre`/`ocultarIdentidad` de `filtros-radicado.ts` o
  el helper `identidadProtegida`, en vez de duplicar el criterio). El test asertaría los casos de la §3.
  La extracción a función pura es el habilitador del control (misma lógica que hizo testeable a H1).
- **Rol técnico: dev-frontend** (extrae el predicado y lo alinea al criterio de reserva ya existente),
  con **revisión cruzada de gobierno-digital** sobre la conformidad. Alternativamente, si se decide que
  el mostrador consuma el mismo predicado del servidor, participa **dev-backend** para exponer la función
  compartida — esa es decisión técnica del arquitecto, no la fija este concepto.

### 5. Nota de reutilización (Principio 3, sin opinar de arquitectura)

Observo que el criterio de reserva está hoy en **dos** lugares equivalentes
(`lib/seguridad/identidad-protegida.ts:37-44` y `lib/busqueda/filtros-radicado.ts:83-88`). Lo señalo
solo porque la norma exige **coherencia** del criterio de reserva entre canales: si divergen, un canal
podría proteger y otro no. Unificar o no es decisión técnica; la exigencia normativa es que el criterio
sea **uno solo y consistente**.

---

## HALLAZGO R10 — Necesidad de conocer (variante B)

### 1. Concepto: **CUMPLE** (conservador y conforme) · Convertible a control en Ola 2: **NO todavía**

La variante A (ADR-0006) enmascara la identidad reservada para **todos**, incluido el funcionario
responsable que legítimamente podría necesitarla para tramitar. Esto **no es un incumplimiento**: errar
hacia la protección es conforme a la confidencialidad (Ley 1581/2012 art. 4 lit. f/g/h). Lo que queda
pendiente es habilitar el **acceso legítimo por rol y necesidad de conocer** (variante B).

### Verificación en el código (leído, no asumido)

| Artefacto | Qué verifiqué | Resultado |
|---|---|---|
| `lib/seguridad/identidad-protegida.ts:37-44` | `identidadProtegida(r)` decide **solo por atributos del radicado** (anónimo/reservado). **No recibe rol ni contexto del actor**: no existe hoy un concepto de "quién puede revelar". | Confirmado: no hay eje de autorización sobre el que asertar. |
| ADR-0006 | La revelación controlada por rol/necesidad de conocer (variante B) está **diferida** como candidata; no hay regla definida. | Confirmado: la regla no existe aún. |

### 2. Por qué requiere decisión previa (no se puede forzar un control)

Un control de regresión asevera una **regla**. Para R10 la regla aún no existe: el product-owner debe
decidir **antes** —y el arquitecto registrar en ADR—:

1. **Quién** revela (¿solo el `funcionarioResponsable` del radicado? ¿el jefe de dependencia? ¿un rol
   de Comisaría?).
2. **Bajo qué condición** (¿siempre para el responsable? ¿bajo justificación explícita?).
3. **Con qué traza** (la Ley 1581 art. 4 lit. g exige registro del acceso: el revelado debe quedar en
   `trazabilidad` — acceso auditable, no silencioso).
4. **Alcance del dato revelado** (¿nombre y documento? ¿también correo/teléfono/dirección?).

Sin esas cuatro definiciones no hay aserción posible: cualquier test que escribiéramos hoy estaría
fijando una política de acceso que nadie ha decidido, lo que violaría el Principio 9 (la IA propone,
el funcionario/PO decide) y el Principio 1 (nivel 3 → ADR antes de codear).

### 3. Aserción que el control tendría — **una vez decidida** la variante B

> Con identidad reservada: (a) el rol autorizado por la política (p. ej. funcionario responsable del
> radicado, en su propio tenant) obtiene la identidad en claro **y** queda registrado un evento de
> acceso en `trazabilidad`; (b) **cualquier otro rol** (incluido funcionario de otro tenant) sigue
> viendo el marcador protegido. La revelación sin traza está prohibida.

- **Tipo probable de control (cuando exista la regla):** combinación de **test unitario** de la función
  de autorización (`¿puedeRevelarIdentidad(actor, radicado)?`, pura) **más** una fila de la matriz de
  **rules-unit-testing** (patrón R8/ADR-0007) si la autorización se apoya además en `firestore.rules`,
  **más** verificación de que el revelado deja traza. Un E2E de una superficie confirmaría el revelado
  end-to-end.
- **Rol técnico: product-owner + gobierno-digital** para definir la política (fase de decisión);
  **dev-backend + firestore-datos** para la autorización y la traza; **dev-frontend** para el revelado
  controlado en la vista. Nada de esto entra hasta cerrar la decisión.

---

## Tabla resumen priorizada (por riesgo jurídico)

| # | Hallazgo | Riesgo jurídico | Norma clave | ¿Convertible ya? | Aserción del control | Tipo de control | Rol |
|---|---|---|---|---|---|---|---|
| 1 | **R6** prórroga post-vencimiento | **Medio** (der. fundamental de petición, art. 23 CP; mora → tutela) | Ley 1755/2015 art. 14 parágrafo | **SÍ** | prórroga sobre `fechaVencimiento` pasada → rechazada | Unitario (función pura, `validarProrroga` + reloj inyectable); E2E 09 opcional | dev-backend |
| 2 | **R9** inferencia en búsqueda del cliente | **Bajo-medio** (sube a medio con denunciante) | Ley 1581/2012 art. 4 f/g; Ley 1474/2011 | **SÍ** | reservado no matchea búsqueda por nombre/documento (sí por radicadoId) | Unitario (extraer predicado a función pura, reutilizando criterio existente) | dev-frontend (+ rev. gobierno-digital) |
| 3 | **R10** necesidad de conocer | **Bajo** (hoy conforme; es mejora, no brecha) | Ley 1581/2012 art. 4 f/g/h | **NO — requiere decisión PO** | (definir tras variante B) revelado solo a rol autorizado + traza; resto enmascarado | Unitario + rules-unit-testing + E2E (a futuro) | PO + gobierno-digital, luego dev-backend/firestore/frontend |

---

## Recomendación de entrada a la Ola 2

**Entran a la Ola 2 como controles ejecutables (cierran con un test de regresión):**

- **R6** — prioridad **alta dentro del frente** por tocar un derecho fundamental. Control unitario de
  función pura, patrón H1 ya probado, bajo costo, sin dependencias. Recomiendo postura **(A) rechazar**
  la prórroga extemporánea por defecto; si el PO prefiere registrar-con-marca, el control se ajusta sin
  cambiar rol ni tipo.
- **R9** — prioridad **media**. Convertible ya; el patrón correcto **ya existe en el servidor**
  (`filtros-radicado.ts`) y solo debe replicarse/reutilizarse en el predicado del cliente, extrayéndolo
  a función pura para poder asertar la invariante. Sin decisión previa pendiente.

**Espera decisión del propietario (no se fuerza control):**

- **R10** — **no convertible aún**. Es la variante B ya diferida en ADR-0006. Requiere que el
  product-owner (con gobierno-digital) defina **quién revela, bajo qué condición, con qué traza y qué
  alcance de dato**, y que el arquitecto lo registre en ADR (Principio 1, nivel 3). Solo entonces existe
  una regla que un control pueda proteger. Recomiendo **declararlo formalmente EN DECISIÓN** en
  `docs/REGISTRO_RIESGOS.md` (dueño: product-owner), no arrastrarlo como "pendiente técnico". Mientras
  tanto la variante A vigente **es conforme**; no hay urgencia jurídica.

**Consecuencia para el ADR-0012:** consolidar R6 y R9 como los dos controles ejecutables del Frente 2C
(uno por dev-backend, uno por dev-frontend con revisión cruzada de gobierno-digital), y dejar R10 como
punto de decisión de producto que precede a cualquier implementación.

---

## Fuentes

- **Ley 1755 de 2015**, art. 14 y su parágrafo — términos para resolver peticiones (15/10/30 días
  hábiles) y ampliación excepcional informada **antes del vencimiento**, con nuevo plazo ≤ doble del
  inicial. Sustenta R6. (Verificada en Función Pública / Secretaría del Senado en el concepto de Fase 2.)
- **Ley 1437 de 2011 (CPACA)**, art. 3 — celeridad y carácter perentorio de los términos. Refuerza R6.
- **Constitución Política**, art. 23 — derecho fundamental de petición (riesgo de tutela por mora). R6.
- **Ley 1581 de 2012**, art. 4 lit. f (acceso y circulación restringida), lit. g (seguridad, evitar
  consulta/uso no autorizado), lit. h (confidencialidad). Sustenta R9 (canal de inferencia) y R10
  (necesidad de conocer / traza de acceso).
- **Ley 1474 de 2011 (Estatuto Anticorrupción)** — reserva de identidad del denunciante; eleva el riesgo
  de R9 en el caso denunciante. El numeral exacto de la reserva del denunciante **debe confirmarse**
  antes de usarse como cita literal en un acto vinculante (salvedad ya declarada en el concepto de Fase 2).

### Salvedades de precisión (declaradas, no asumidas)

- La exigencia "**antes del vencimiento**" de R6 es texto expreso del parágrafo del art. 14; la postura
  de **rechazar** (vs. registrar como extemporánea) es interpretación conservadora recomendada, no
  mandato literal de la norma — es la micro-decisión de producto señalada en §R6.5.
- R9 es un canal de **inferencia** (confirma existencia), no de **visualización** (la fila sigue
  enmascarada por H2). Su severidad es baja-media y solo escala a media en el escenario de denunciante
  reservado.
- R10 **no es incumplimiento**: la variante A vigente es conforme. Es una mejora de acceso legítimo que
  requiere decisión de producto antes de ser convertible a control.

---

## R6 — Remediación verificada (2026-07-11)

**Rol:** revisión cruzada de conformidad normativa (gobierno-digital). dev-backend implementó el
control R6 que este mismo concepto (Frente 2C) definió; esta sección es la validación independiente —
nadie valida su propio trabajo (Principio 5). Solo lectura de código y ejecución de tests; sin cambios.

### Veredicto de conformidad: **CONFORME** — R6 → **RESUELTO**

El control satisface la exigencia temporal del art. 14 (parágrafo) de la Ley 1755/2015: impide aplicar
una ampliación cuando el término original ya venció, haciendo efectivo el mandato de informar la
ampliación **ANTES del vencimiento**. El estado de R6 pasa de **NO CUMPLE** (brecha activa) a
**CONFORME / remediado**, con conformidad demostrada por pruebas de regresión.

### Verificación en el código (leído, no asumido)

| Artefacto | Qué verifiqué | Resultado |
|---|---|---|
| `lib/server/radicados-security.ts:79-117` (`validarProrroga`) | Función pura. Recibe `fechaVencimiento?: string` y `ahora?: Date \| (() => Date)`. Tercera regla (líneas 105-114): si `vencimiento.getTime() <= ahora.getTime()` → rechazo **409** con mensaje que cita "antes del vencimiento". Reloj inyectable (valor o fábrica). Si se omite `fechaVencimiento`, R6 no aplica (compatibilidad). | Correcto |
| Orden de evaluación (líneas 91-114) | Unicidad(409) → Tope(400) → Temporalidad(409), exactamente como declara el JSDoc. | Correcto |
| `app/api/radicados/[radicadoId]/prorroga/route.ts:78-88` | Cablea `radicado.termino.fechaVencimiento` + `ahoraDate = new Date()`; el rechazo retorna (línea 86-88) **antes** de la escritura (línea 92+). Reutiliza `ahoraDate` para el timestamp del evento. IMPIDE, no advierte. | Correcto |
| `__tests__/prorroga-validacion.test.ts:80-164` (8 casos R6) | Cubre: vencido con reloj fijo; vigente; frontera `=== ahora`; reloj como fábrica; omisión de fecha; regresión (vencido hace un mes); precedencia unicidad-sobre-temporalidad. | Cobertura suficiente |
| Ejecución `npx vitest run` | **13/13 verdes** (6 H1 + 7 R6). | Evidencia de regresión satisfecha |

### Análisis normativo de la remediación

| Pregunta del coordinador | Análisis | Veredicto |
|---|---|---|
| ¿Satisface el art. 14 (informar la ampliación ANTES del vencimiento)? | La regla bloquea toda prórroga sobre un término cuyo `fechaVencimiento` es igual o anterior al instante de la solicitud. La ampliación solo procede mientras el término sigue corriendo → el mandato "antes del vencimiento" queda enforced. | **Sí** |
| ¿La frontera (vence exactamente ahora = vencido → rechaza) es la interpretación correcta? | "Antes del vencimiento" **excluye** el instante mismo del vencimiento: en `fechaVencimiento === ahora` el término ya arribó a su expiración, informar "en" el vencimiento no es "antes" de él. El uso de `<=` es la lectura conservadora y correcta, coherente con la postura de la casa (H1: impedir, errar hacia la protección del término perentorio). | **Sí, correcta** |
| ¿El mensaje cita la norma? | "El término original ya venció: la Ley 1755/2015 (art. 14, parágrafo) exige informar la ampliación del término ANTES de su vencimiento, no después." Cita correcta y precisa (norma + artículo + parágrafo), enuncia la regla y es clara para el funcionario. | **Sí** |

### Sobre el orden elegido (desviación menor de mi recomendación, sin efecto en conformidad)

En §R6.4 sugerí evaluar la temporalidad **antes** que unicidad/tope. El dev la ubicó **al final**
(unicidad → tope → temporalidad), fijándolo en el test de precedencia (línea 153). **No es una brecha
normativa:** la temporalidad se evalúa siempre que unicidad y tope pasen, de modo que **ningún radicado
vencido llega a prorrogarse** — si ya tiene prórroga se rechaza por unicidad, y si no, se rechaza por
temporalidad. El resultado (rechazado, sin escritura) y la conformidad son idénticos; solo cambia cuál
mensaje se muestra cuando coinciden dos causales, y en ese caso el de unicidad es al menos igual de
informativo. Mi sugerencia era "sugerida", no mandato. Desviación aceptada.

### Brechas residuales

- **Ninguna que bloquee el cierre de R6.** El cómputo de días hábiles no se recomputa aquí porque
  `fechaVencimiento` ya lo encapsula (comparación de instantes = correcta).
- **Observación de robustez (baja/teórica, no brecha activa):** si `fechaVencimiento` llegara como cadena
  inválida, `new Date(...).getTime()` sería `NaN` y `NaN <= ahora` es `false` → la regla no dispararía
  (permitiría). Hoy `termino.fechaVencimiento` es campo requerido y siempre poblado en los tres caminos
  de creación (verificado en la remediación de H1), por lo que el riesgo es teórico. Misma clase que R7;
  se anota como observación, no como brecha. **Rol futuro si se endurece: dev-backend.**

### Micro-decisión de producto (§R6.5) — resuelta por la implementación

La implementación adoptó la postura **(A) rechazar** la prórroga extemporánea (409), que era la
recomendada. Queda coherente con H1 ("impedir, no advertir") y con el carácter perentorio del término.

**Conclusión:** la remediación de R6 es **conforme** al art. 14 (parágrafo) de la Ley 1755/2015 en la
exigencia temporal, con conformidad protegida por 8 pruebas de regresión (13/13 verdes en el archivo).
R6 puede marcarse **RESUELTO** en `docs/REGISTRO_RIESGOS.md`. Referencia de decisión: **ADR-0012**.

---

## R9 — Remediación verificada (2026-07-11)

**Rol:** revisión cruzada de conformidad normativa (gobierno-digital). dev-frontend implementó el
control R9 que este concepto (Frente 2C) definió; esta sección es la validación independiente
(Principio 5). Solo lectura de código y ejecución de tests; sin cambios.

### Veredicto de conformidad: **CONFORME** — R9 → **RESUELTO**

El canal de inferencia del cliente queda cerrado: los filtros rápidos del mostrador y del Tablero ya no
confirman la existencia de un radicado reservado al teclear el nombre o el documento del solicitante. Se
satisface el principio de acceso y circulación restringida y el deber de seguridad (Ley 1581/2012 art. 4
lit. f y g), cerrando el residual de H2. El estado de R9 pasa de **CUMPLE PARCIALMENTE** a **CONFORME**.

### Verificación en el código (leído, no asumido)

| Artefacto | Qué verifiqué | Resultado |
|---|---|---|
| `lib/busqueda/coincidencia-filtro-rapido.ts:46-56` (`coincideIdentidadFiltroRapido`) | Función pura, única fuente de verdad del predicado. Matchea `radicadoId` primero; si `identidadProtegida(r)` → `return false` (no evalúa nombre/documento); si no está reservado, matchea nombre/documento normalmente. **Reutiliza** `identidadProtegida` (ADR-0006), no duplica el criterio. | Correcto |
| `app/interno/dashboard/components/ventanilla/VistaVentanilla.tsx:14,74-75,107` | `coincideMostrador` ahora **delega** en `coincideIdentidadFiltroRapido`; ya no lee `nombreCompleto`/`numeroDocumento` crudos. | Enmascarado en búsqueda |
| `app/interno/dashboard/page.tsx:37,215-221` | El filtro del Tablero usa `coincideIdentidadFiltroRapido(r, q)` para identidad + radicadoId; asunto/oficina/responsable matchean directo aparte. El `radicadoId` crudo ya no se compara por fuera del predicado. | Enmascarado en búsqueda |
| `grep` de otros filtros de cliente (`app/`, `components/`) que toquen `solicitante.nombreCompleto`/`numeroDocumento` con `.includes` | **Sin resultados** fuera de los helpers `…Visible` y de `coincide…`. No hay otra superficie de cliente que matchee identidad sin guarda. | Cobertura completa |
| `__tests__/coincidencia-filtro-rapido.test.ts` (11 casos) | Reservado no coincide por nombre/fragmento/documento; sí por radicadoId (completo y fragmento); no-reservado coincide normal; anónimo (solo `esAnonimo`) tampoco coincide por identidad. | Cobertura suficiente |
| Ejecución `npx vitest run` | **11/11 verdes**. | Evidencia de regresión satisfecha |

### Respuestas a las preguntas del coordinador

| Pregunta | Análisis | Veredicto |
|---|---|---|
| ¿Cierra la brecha de inferencia del cliente conforme al art. 4 f/g? | Ambas superficies delegan el match de identidad en un predicado que devuelve `false` sobre nombre/documento de radicados reservados. El servidor ya la cerraba (`filtros-radicado.ts`); ahora el cliente aplica la misma invariante. Teclear un nombre/documento reservado ya **no** hace aparecer la fila → no se confirma la existencia. | **Sí, cierra** |
| ¿Es correcto dejar asunto/oficina/funcionario sin guarda? | **Sí.** La reserva protege la **identidad del solicitante** (nombre y documento), que son exactamente los dos campos ahora guardados. El **asunto** es el contenido de la petición, no un identificador del ciudadano; la **oficina de destino** es enrutamiento institucional; el **funcionario responsable** es un servidor público (no el ciudadano). Ninguno es dato personal reservado del solicitante. Además es **coherente con el servidor**, que también matchea asunto directo (`matchTextoLibre`, `filtros-radicado.ts:161`, sin guarda). | **Correcto** |
| ¿El `radicadoId` searchable en reservados es una fuga? | No. El número de radicado no es dato personal reservado, sino la clave institucional de seguimiento; para teclearlo hay que **conocerlo ya**. No se infiere la identidad de una persona a partir de él (art. 4 f protege el dato del titular, no el consecutivo AGN). | **Conforme** |

### Brechas residuales

- **Ninguna que bloquee el cierre de R9.** El canal de inferencia por identidad del solicitante queda
  cerrado en cliente y servidor con una invariante común, protegida por pruebas.
- **Observación de higiene de captura (fuera del alcance de R9, no brecha del predicado):** si al radicar
  se hubiera escrito el nombre del ciudadano **dentro del campo asunto**, ese texto seguiría siendo
  buscable (asunto no se enmascara, y normativamente no debe enmascararse de forma general). Es un
  problema de **calidad del dato en la captura**, no del predicado de búsqueda; se menciona para que no
  se confunda con R9. Mitigación natural: guía de captura / validación en el radicador. **Rol futuro si
  se aborda: dev-frontend + ux.** No abre R9.

### Sobre la duplicación del criterio de reserva (`ocultarIdentidad` local vs. `identidadProtegida`)

Pregunta expresa del coordinador. Comparé los dos criterios carácter a carácter:

- `lib/seguridad/identidad-protegida.ts:37-44` (`identidadProtegida`): `esAnonimo === true || identidadReservada === true || tipoPresentacion === 'ANONIMA' || tipoPresentacion === 'RESERVADA'`.
- `lib/busqueda/filtros-radicado.ts:83-88` (`ocultarIdentidad`, local): mismas cuatro disyunciones, **solo cambia el orden**.

**Hoy son lógicamente idénticos: no hay divergencia ni brecha activa.** Por tanto, en el estado actual
es **solo deuda técnica (DRY)**, no un incumplimiento.

**Pero es deuda técnica normativamente sensible**, y conviene no tratarla como un DRY cosmético: lo que
está duplicado es la **definición misma de "qué cuenta como identidad reservada"**, que es el predicado
de cumplimiento del art. 4 f/g. Si mañana se añade una quinta condición de reserva (un nuevo valor de
`tipoPresentacion`, un flag nuevo) a **una** copia y no a la otra, un canal protegería y el otro filtraría
→ eso **sí** sería una brecha normativa real (una ruta de búsqueda dejaría de enmascarar). Probabilidad
baja, pero impacto-si-ocurre = brecha de cumplimiento, y el modo de fallo es **silencioso** (no rompe
ningún test existente). Por eso el criterio de reserva debe ser **fuente única**.

Recomendación (no bloquea R9; es backlog): hacer que `ocultarIdentidad` **importe** `identidadProtegida`
en vez de reimplementarla —el predicado de cliente de R9 ya da el ejemplo correcto—; y/o un test de
equivalencia que asegure que ambos coinciden sobre una matriz de entradas, de modo que cualquier
divergencia futura falle en CI. **Rol: dev-backend.** Lo registro como ítem propio del backlog
(candidato a control preventivo), severidad **baja** (latente, no activa).

**Conclusión:** la remediación de R9 es **conforme** al art. 4 (f/g) de la Ley 1581/2012 —y mitiga el
agravante de denunciante reservado (Ley 1474/2011)— en las dos superficies de filtro rápido de cliente,
con la invariante compartida con el servidor y protegida por 11 pruebas de regresión. R9 puede marcarse
**RESUELTO** en `docs/REGISTRO_RIESGOS.md`. La duplicación del criterio de reserva queda como deuda
técnica normativamente sensible (backlog, no bloqueante). Referencia de decisión: **ADR-0012**.

### Preservación tras el cierre de R11 (acotación por cursor) — verificado 2026-07-12

**R9 sigue CONFORME tras el refactor de `busqueda-avanzada` (R11, ADR-0010).** dev-backend reescribió la
lectura a escaneo por lotes con cursor + techo `MAX_DOCS_ESCANEADOS` (500) y extrajo `filtrarLote`; revisé
que la exclusión server-side de reservados se conserva **sin cambio de semántica**:

- **Predicado reutilizado verbatim.** `filtrarLote` (`lib/busqueda/filtros-radicado.ts:292-299`) aplica
  `aplicarAlcanceRol` + `pasaFiltros` a cada radicado del lote; `pasaFiltros` conserva intactos los
  guardas `if (ocultarIdentidad(r)) return false` para `nombre`/`documento`/`correo` (líneas 184/188/192)
  y `matchTextoLibre` con `!oculto` (líneas 157,165-167). Un reservado **no** matchea por identidad —
  misma regla que antes, ahora invocada por lote en `route.ts:178` en vez de una vez sobre todo el
  dataset. No hay ningún camino nuevo donde un reservado coincida por identidad.
- **Acotar la lectura no abre brecha (es más restrictivo, no menos).** Un reservado que quede fuera del
  escaneo (≤500 docs) simplemente **no aparece**; dentro del lote sigue excluido de la coincidencia por
  identidad; y lo que sí sale se enmascara igualmente en `sanitizarRadicado` (`route.ts:203`). El techo
  reduce visibilidad, nunca la amplía.
- **Tenant e `isTest` preservados.** El tenant se empuja a Firestore para FUNCIONARIO/JEFE_DEPENDENCIA
  (`route.ts:148-149`) **y** se reaplica en memoria vía `aplicarAlcanceRol` dentro de `filtrarLote`
  (doble refuerzo del aislamiento); `!isTest && !excludeFromMetrics` se filtra por lote antes de
  `filtrarLote` (`route.ts:174-176`).
- **Evidencia (Principio 13):** `npx vitest run __tests__/busqueda-avanzada.test.ts` → **19/19 verdes**
  (la suite incluye casos de exclusión de reservados/identidad); `coincidencia-filtro-rapido` sigue
  11/11. Sin regresión de R9 por el refactor de R11.

**Veredicto:** el cierre de R11 **no introduce ninguna brecha** en R9. La conformidad al art. 4 f/g se
mantiene en cliente y servidor.
