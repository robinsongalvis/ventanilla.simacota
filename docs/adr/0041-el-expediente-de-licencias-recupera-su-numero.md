# ADR-0041 — El expediente de licencias recupera su número: dos series, dos significados

- **Estado:** PROPUESTO — pendiente de aprobación del propietario.
- **Fecha:** 1-sep-2026.
- **Decide:** el propietario (decisión de numeración legal — triaje nivel 3).
- **Deroga:** el pivote del 26-ago-2026 («el número no se emite, se recibe»),
  que nunca tuvo ADR propio y vive en tres rastros de código citados en §2.
- **Amplía:** ADR-0034 (ventanilla ve el estado) §tabla de proyección.
- **Relacionado:** ADR-0016 (consecutivo legal atómico), ADR-0031 (apertura
  explícita de series), ADR-0024 (formato del radicado), ADR-0037 §2 (consulta
  ciudadana), `docs/planes/HOJA_DIA_ARRANQUE_OPERACION_REAL.md`.

## 1. La decisión

> **Las licencias urbanísticas llevan `68745-0-AA-CCCC` como número del
> EXPEDIENTE, emitido en la radicación en debida forma, continuando el
> consecutivo del libro del ingeniero de Planeación. El radicado
> `1-110-AAAAMM-XXXXXXXX` sigue siendo el número de ENTRADA y el ancla del
> término. Los dos conviven, cada uno con su significado.**

Decidido por el propietario el 1-sep-2026. Serie **única para todas las
modalidades** (LC / LSR / LSU / PH / LR / LA / LU): así la lleva el libro, y
`docs/planes/INVESTIGACION_NORMATIVA_LICENCIAS.md:24` ya estableció que las
series por modalidad no tienen base normativa.

Lo que el propietario propuso primero —`68745-0-25-0000` con los últimos
cuatro dígitos editables a mano— quedó descartado con razones verificadas
contra su propio libro: el consecutivo `0000` no existe en ninguna vigencia
(todas abren en `0001`: es el formato, no el número), la vigencia 25 cerró en
`0050`, y unos dígitos editables reabren exactamente el defecto que el libro
manual ya produjo — el `68745-0-25-0037` **está repetido** en el snapshot, dos
solicitantes con el mismo número. La apertura del contador es el único momento
editable, y es un acto con autorización y constancia.

## 2. Contexto — el campo que cambió de significado dos veces

`numeroExpediente` nació para la serie `expedientes`. El 26-ago un cambio sin
ADR («el número no se emite, se recibe») lo puso a cargar el radicado de
ventanilla con `serieId: 'radicados'`, y dejó la maquinaria de emisión
(`emitirNumeroExpedienteReal`) **completa, probada y sin un solo llamador**.

Ese pivote se deroga aquí. Sus rastros, que este ADR reemplaza como fuente:

| Rastro | Qué afirma | Estado |
|---|---|---|
| `lib/server/expedientes-licencias.ts:1893-1896` | «La serie es `radicados`… afirmar `expedientes` haría creer que consumió un consecutivo» | **Derogado.** Consumirá `expedientes`, y ese es el punto. |
| `lib/server/numero-radicado-manual.ts` (cabecera) | el número se transcribe, no se emite | **Matizado:** el 1-110 se sigue capturando; el 68745 se emite. |
| ADR-0037 §2 | «el número del expediente ES el del libro… el ciudadano consulta con el número que tiene en la mano» | **Derogado en su premisa** (§7 de este ADR). |
| `presentacion-libro-consecutivo.ts` | *(el comentario 1894 dice que el Libro clasifica por `serieId`)* | **Falso hoy:** cero menciones de `serieId` en el módulo. Hay que construir esa clasificación (§8). |

## 3. Las seis decisiones que este ADR cierra

### 3.1 Dónde vive el 1-110 — campo espejo propio

Hoy no hay campo en el raíz del expediente para el número de entrada: solo
`radicadoId`, que **sí porta el 1-110 exacto** (verificado:
`formatearRadicadoInstitucional` produce ese string y el documento vive en
`ventanilla_radicados/{radicadoId}`), pero es `null` en expedientes sin
vínculo y en legados puede ser `1-WEB-` / `1-PRESENCIAL-` / `EXT-`.

**Decisión:** un campo espejo nuevo, `numeroRadicadoEntrada`, escrito por el
acto de radicar. Razón: `radicadoId` es una llave foránea, no un dato de
papel; con el espejo, **toda superficie lee un solo sitio** sin ramificar en
«¿hay vínculo?». Contra el riesgo de divergencia: cuando existe vínculo, el
acto **valida que el número capturado sea igual a `radicadoId`** — hoy nadie
lo compara y dos 1-110 distintos pasan en silencio (`radicar/route.ts:221-235`).
Ese hueco se cierra en el mismo acto.

### 3.2 Cómo se captura el 1-110 — la transcripción sobrevive, ahora contrastada

**Decisión:** se conserva la transcripción manual (es la vía del expediente sin
vínculo digital, y su reserva en `unicidad_radicados` impide que dos licencias
compartan número del libro). Lo que cambia: **con vínculo, lo transcrito se
contrasta contra `radicadoId` y diverger es un error del acto**, no un dato que
entra callado.

### 3.3 Qué año manda — cada serie por su propio criterio

**Decisión:** el `68745` se indexa por la **fecha de emisión** (reloj del
servidor anclado a mediodía local); el `1-110` imputa por **el año de su
propio número**. Pueden diferir legítimamente —una debida forma de enero sobre
un radicado de diciembre— y eso **no es un defecto**: el año del radicado dice
cuándo entró a la alcaldía; el del expediente, cuándo se abrió el expediente.
Queda escrito para que nadie lo «arregle».

### 3.4 El camino DEMO conserva su número DEMO

**Decisión:** el expediente real nace **sin número**; el de demostración sigue
naciendo con `{DEMO-…, serieId: 'demo'}`. Razón: esa dupla es la **huella de
limpieza** (`limpiar-datos-prueba.mjs` borra por `esPrueba && serieId==='demo'`)
y la que hace fail-closed los gates de sello. Quitarle el número al demo dejaría
al script de limpieza sin huella el día del arranque.

### 3.5 El vínculo en ventanilla espeja el 68745

**Decisión:** `vinculoExpediente.numeroExpediente` pasa a **opcional** (hoy es
un `string` obligatorio) y carga el `68745` cuando existe. Guardar allí el
1-110 sería redundante puro: el documento que lo contiene **es** ese radicado.
Se sanea de paso el campo `fecha`, que hoy recibe el ancla jurídica donde el
tipo promete reloj del servidor.

### 3.6 El candado R10 gobierna la ruta de radicar

**Decisión:** `evaluarCandadoEmisionReal` —hoy sin ningún llamador— se vuelve
el gate de la ruta que emite, evaluado **fuera** de la transacción, como el
resto de validación de configuración. Su JSDoc ya prescribe este patrón; lo que
faltaba era una ruta que emitiera. Ninguna emisión ocurre con el candado
cerrado, y abrirlo sigue siendo cambiar una constante, nunca reescribir lógica.

### 3.7 Se encuentra por CUALQUIERA de los dos números

*(Añadida el 1-sep tras una pregunta del propietario que el análisis de impacto
no cubrió: «¿qué pasa cuando un funcionario busca con el 1-110 pero es 68745, y
al revés?». Los cuatro mapas no miraron la búsqueda. La revisión posterior
encontró una mitad resuelta y una mitad rota.)*

> **Regla: quien tenga uno de los dos números encuentra el trámite. Siempre, en
> toda superficie de búsqueda.** Tener dos números no puede convertirse en tener
> que adivinar cuál sirve.

Inventario de las cuatro superficies, verificado en código:

| Superficie | Quién la usa | Estado |
|---|---|---|
| **Libro consecutivo** | Funcionario de Planeación | ✅ Ya busca por ambos |
| **Bandeja de licencias** | Funcionario de Planeación | ✅ Ya busca por ambos (misma función) |
| **Consulta pública** | El ciudadano | ❌ Solo el `1-110` |
| **Búsqueda de ventanilla** | Quien atiende el mostrador | ❌ Solo el `1-110` |

**Lo que YA cumple** — el Libro busca sobre un `haystack` que **ya incluye
`numeroExpediente` y `radicadoId`** juntos, con fragmentos independientes y sin
acentos; y la bandeja llama a **esa misma función** (su propio marcador de
posición ya promete «Buscar por expediente, radicado, nombre, documento,
matrícula, tipo o estado»). El funcionario de Planeación ya encuentra por
cualquiera de los dos y seguirá haciéndolo. Falta una línea: añadir al
`haystack` el campo espejo de §3.1, para los expedientes **sin vínculo digital**.

**Lo que está ROTO para el ciudadano** — la consulta pública resuelve
**únicamente** por el radicado: `ventanilla_radicados/{numeroRadicado}`. Un
ciudadano que teclee su `68745` recibe la misma negativa que un número
inexistente. Y es peor que hoy, porque **ese número va a estar impreso en su
constancia y en su sello**: le entregamos un número que nuestra propia consulta
no reconoce.

**Lo que está ROTO en el mostrador, y contradice al ADR-0034** — el texto libre
de la búsqueda de ventanilla (`matchTextoLibre`) recorre radicado, asunto, tipo,
dependencia, responsable y —si la identidad no está protegida— nombre, documento
y correo. **No recorre el número del expediente vinculado.** Es decir: cuando el
ciudadano llame o se pare en el mostrador diciendo «mi licencia es la
68745-0-26-0021» —el número que le imprimimos nosotros—, **quien atiende no lo
encuentra**. Y esa es justamente la función que el ADR-0034 le asignó a
ventanilla: ver el estado y responderle al ciudadano. El número del expediente
no es dato de identidad, así que entra al texto libre sin tocar la regla de
identidad reservada.

**Decisión:** las cuatro superficies encuentran por los dos números. La consulta
pública acepta ambos formatos resolviendo al radicado de entrada y siguiendo por
el camino de siempre; la búsqueda de ventanilla suma el número del expediente
vinculado a su texto libre; el Libro y la bandeja suman el campo espejo.

Con dos condiciones que no se negocian:

1. **La autorización no se toca.** Cambia por dónde se ENCUENTRA el trámite, no
   quién puede verlo: el dato de verificación se sigue exigiendo igual, y la
   respuesta denegada sigue siendo indistinguible entre «no existe» y «no
   autorizado» — hoy esa indistinguibilidad es lo que impide enumerar radicados,
   y una ruta nueva que respondiera distinto sería un canal de fuga.
2. **El registro de fallos y la auditoría cubren el camino nuevo** desde el
   primer día, no como añadido posterior.

**Regla de secuencia:** el ciudadano empieza a VER el `68745` en el paso 2 del
orden (§6). La búsqueda debe aceptarlo **en ese mismo paso o antes** — nunca
después. Entregar un número que la consulta rechaza es exactamente el defecto
de «pintado y nunca construido» que este proyecto ya pagó una vez.

## 4. Cómo se rotula — por `serieId`, nunca por posición

El significado de un número **lo declara su `serieId`, documento por
documento**. Ningún documento viejo se reescribe: un expediente con
`{1-110, serieId: 'radicados'}` conserva su asiento y se rotula «Radicado»;
uno con `{68745, serieId: 'expedientes'}` se rotula «Expediente». Renumerar
está prohibido (AGN 060), y este ADR **no renumera nada**.

| Superficie | Hoy | Debe decir |
|---|---|---|
| Cabecera del detalle | «Radicado {n}» | Rótulo por `serieId` |
| Constancia de radicación | «Número de radicado» | Los dos, etiquetados |
| Carátula del paquete | «N.° DE RADICADO» | Los dos, etiquetados |
| Sello estampado | recibe `numeroExpediente` como `radicadoId` | El 1-110 en su fila; el 68745 en la línea «Exp.» |
| Acuse por correo | protagoniza `numeroExpediente` | Protagoniza el 1-110 (al crear, es el único que existe) |
| Consulta pública | muestra el número sin etiqueta | Etiquetados, y **la búsqueda sigue siendo por radicado** |
| Proyección a ventanilla | expone `numeroExpediente` (quinto campo no listado en ADR-0034) | Regularizado aquí: ventanilla ve **ambos**, etiquetados |

**La línea «Exp.» del sello vuelve.** La PR #315 la descartó con razón —
entonces los dos números eran el mismo objeto y habría impreso el mismo dato
dos veces. Con esta decisión tiene contenido propio, y vuelve con su custodio.

## 5. Riesgos, y cómo los trata este ADR

1. **Duplicado legal silencioso histórico ↔ vivo.** Los ~202 históricos
   importados **no reservaron** `unicidad_expedientes` (prohibido por DF-9), así
   que el `tx.create` de una emisión viva triunfaría sobre un número ya usado en
   el libro. La única defensa es abrir el contador **en el máximo del libro**.
   Por eso el orden **importación → apertura → activación** queda como
   invariante de despliegue, no como detalle operativo (§6).
2. **Papel oficial que miente de serie.** Hoy las rutas de sello pasan
   `numeroExpediente` como `radicadoId`: tras el cambio estamparían «RECIBIDO
   POR VENTANILLA ÚNICA 68745-…». Estas superficies se corrigen **antes** de que
   el campo cambie de contenido (PR 1 y 2 de §6), nunca después.
3. **El acuse con `undefined`.** El gate anti-DEMO corta por prefijo: con el
   número ausente deja de cortar, y el acuse hace `numeroExpediente!.numero`.
   Sería un correo real a un ciudadano real diciendo «Expediente undefined». Se
   cierra **antes** del nacimiento sin número.
4. **El término que no arranca.** La debida forma pasa a depender de que la
   serie esté abierta; hoy `SerieNoAbiertaError` caería como un 500 opaco. Se
   exige mapearlo a un error legible: si la emisión falla, el acto no ocurre y
   el término de 45 días hábiles no empieza a correr.
5. **Stage contaminado.** El ensayo sembró `68745-0-26-0001` con el contador en
   1, contradiciendo el máximo 19 del libro: ensayar la activación sobre eso
   validaría un estado falso. Se limpia antes.
6. **Inventario, no supuesto.** Es *probable* que en producción no exista ningún
   expediente con `serieId: 'radicados'` (el gate de `esPrueba` bloquea la
   debida forma y toda creación fuerza `esPrueba`), pero se **demuestra con una
   lectura**, no se asume.

## 6. Orden de implementación — cada paso seguro por sí solo

| # | Qué | Por qué en ese lugar |
|---|---|---|
| **0** | Este ADR aprobado + **inventario de producción** (solo lectura) | Nada se codifica antes |
| **1** | Saneos compatibles: gate de comunicaciones por «sin número» en vez de «DEMO-», sello lee `radicadoId`, rótulos por `serieId`, custodios de wording que faltan | Cierra los riesgos 2 y 3 **sin** cambiar comportamiento observable (no-op verificable) |
| **2** | Los dos números en papel y correo (aún sin emisión) **+ la búsqueda por ambos (§3.7)** | Compatible: mientras el campo cargue el 1-110, la segunda fila coincide o se omite. La búsqueda va aquí y no después: es el paso donde el ciudadano empieza a ver el 68745 |
| **3** | El expediente nace **sin** número | Seguro: los lectores ya toleran la ausencia; el acuse quedó protegido en el paso 1 |
| **4** | Cableado de la emisión, **con el candado cerrado** | Rama inalcanzable en producción; se prueba por inyección, como ya hace su test |
| **5** | Operación: limpiar stage → importar históricos si faltan → confirmar el libro con el ingeniero → **abrir la serie** | Protocolo autorización → ejecución. Precondición del abridor |
| **6** | **ACTIVACIÓN** — solo con orden explícita del propietario | El punto de no retorno de la hoja del arranque |
| **7** | Deuda #12: auditoría de continuidad de la serie contra documentos | Idealmente antes de la primera emisión real |

Aceptación del paso 6: **la primera emisión produce el número siguiente al
máximo confirmado del libro** (si el libro sigue en 19: `68745-0-26-0020`), con
su reserva presente en `unicidad_expedientes`.

## 7. Lo que este ADR NO cambia

- **El término.** Ancla, cómputo, alertas y semáforo son ciegos al número: nada
  del plazo depende de la serie. Verificado en los cuatro mapas.
- **El ADR-0034 en su fondo.** Todo sigue entrando por ventanilla; el 1-110
  sigue siendo la entrada y el ancla. Lo que se amplía es la proyección: se
  regulariza el quinto campo y ventanilla verá **los dos números etiquetados**.
- **Quién puede ver un trámite.** La búsqueda se amplía a los dos números
  (§3.7), pero la autorización es exactamente la misma: el dato de verificación
  se sigue exigiendo y la negativa sigue siendo indistinguible.
- **Ningún documento existente.** No se renumera nada.

## 8. Deudas que este ADR deja declaradas

- **La clasificación por `serieId` en el Libro consecutivo no existe** (el
  comentario que la afirma es prosa aspiracional). Sin ella, el Libro mezcla
  formatos ordenados por string y detecta duplicados sin distinguir serie. Debe
  construirse; mientras tanto, la hoja mixta es transitoria y consciente.
- **`verificarColisionNumeroExpediente` no tiene llamador**: una importación D6
  posterior a emisiones vivas no se contrasta contra nada. Necesita dueño.
- **La maquinaria de huecos del cron asume el formato 1-110** y no sirve tal
  cual para esta serie.

## Fuentes

Análisis de impacto del 1-sep-2026: cuatro lectores paralelos (cableado de la
emisión, consumidores del campo, superficies de papel y UI, libro/migración/
unicidad, ventanilla y término) más un crítico de completitud; 241 lecturas de
código. Hechos verificados de nuevo a mano antes de escribir: `radicadoId` porta
el 1-110, el gate DEMO y su aserción non-null, la obligatoriedad de
`vinculoExpediente.numeroExpediente`, y la ausencia total de `serieId` en el
Libro.

**§3.7 no salió de ese análisis: salió de dos preguntas del propietario.** Los
cinco agentes recorrieron emisión, campos, papeles, libro, ventanilla y término,
y **ninguno miró la búsqueda** — el trabajo automático cubrió lo que se le pidió
y no lo que faltaba pedir. La primera pregunta («¿y si buscan con el otro
número?») destapó la consulta pública; la segunda, que nombró dos superficies
concretas, destapó el mostrador de ventanilla — el hueco más grave de los dos,
porque contradice la función que el ADR-0034 le asignó.

Lección del método, anotada para el próximo análisis de nivel 3: **«¿cómo se
ENCUENTRA esto después, y desde qué mostrador?» va en la lista de preguntas
desde el principio**, junto a «¿qué se rompe?» y «¿qué papel lo muestra?».
