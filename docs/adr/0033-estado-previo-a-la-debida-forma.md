# ADR-0033 — Estado previo a la radicación en debida forma (Licencias)

- **Estado:** PROPUESTO — pendiente de decisión del propietario
- **Fecha:** 24 de agosto de 2026
- **Contexto previo:** [auditoría del módulo](../licencias/auditoria-radicacion.md) · ADR-0026 (motor de expedientes) · ADR-0031 (apertura explícita de la serie)

---

## 1. El problema

La máquina de estados jurídicos de Licencias **arranca** en `RADICADA_EN_DEBIDA_FORMA`
(`lib/motor-expedientes/estados-licencia.ts:27`). No existe ningún estado anterior. Consecuencia
directa: todo expediente nace afirmando un hecho que nadie verificó.

Los dos puntos de creación escriben `estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA'` junto a
`aportes: []` — cero documentos (`lib/server/expedientes-licencias.ts:337` y `:763`). Ese estado
es, según el propio código, el hito que **afirma que la solicitud se presentó con documentación
completa verificada** (art. 2.2.6.1.2.1.1 par. 1) y el que **ancla el término de 45 días hábiles**.

El checklist existe, pero se evalúa en el navegador y su único efecto es una etiqueta de color:
no bloquea nada y el servidor no lo consulta.

**No es un problema de hoy:** no hay ciudadanos reales, ni constancias despachadas, ni términos
corriendo. Es exactamente lo que estaría vivo el día que llegue el primer expediente real.

## 2. Por qué esto va antes que el cableado del emisor

El emisor transaccional de consecutivos (`emitirNumeroExpedienteReal`) está escrito, probado y
**sin llamadores**. Parece independiente de esta decisión. No lo es:

> Dónde se dispara el emisor depende de dónde quede la frontera de la debida forma. Si se añade
> el estado previo, la radicación deja de ocurrir al crear el expediente y pasa a ocurrir en la
> transición `presentada → debida forma`. Cablearlo hoy contra la creación es escribir un
> *callsite* que hay que mover, con la prueba de concurrencia repetida y el consecutivo ya con
> huecos de ensayo.

Barato ahora, molesto después. Por eso este ADR precede al cableado.

## 3. Opciones consideradas

| # | Opción | Por qué no / por qué sí |
|---|---|---|
| 1 | **Bloquear la creación** hasta que el checklist esté completo | Inviable: los documentos se suben **a** un expediente que ya debe existir. Círculo cerrado. |
| 2 | **Añadir un estado previo** con identidad propia | Es la única donde el estado dice la verdad. Coste real medido en §5. |
| 3 | **Dejar la creación** y poner la compuerta en actuaciones posteriores | Más barato, pero no arregla lo esencial: el expediente seguiría naciendo afirmando una completitud que nadie verificó. |

**Se propone la opción 2.**

## 4. La decisión, en cuatro piezas

### 4.1 Un estado previo

Se añade un estado anterior a `RADICADA_EN_DEBIDA_FORMA` — nombre propuesto: **`PRESENTADA`**.
Significa *«la solicitud está en poder de la Administración; su completitud aún no se ha
verificado»*. Un expediente en ese estado **puede recibir documentos** y **no tiene término
corriendo**.

Arcos: `PRESENTADA → RADICADA_EN_DEBIDA_FORMA` (verificación superada) y `PRESENTADA → DESISTIDA`
(retiro del solicitante). Ningún otro.

### 4.2 Identidad sin consumir la serie legal

Esta es la pieza que hace viable la opción 2. Un expediente en estado previo se identifica con un
**número de recepción** propio, que **no** es el consecutivo de la serie legal. El número legal se
emite **al cruzar la frontera**, no antes.

**Hallazgo que abarata esto:** el modelo **ya lo soporta**. `numeroExpediente` es opcional desde su
declaración, con el JSDoc *«ausente hasta que se emite»* (`lib/motor-expedientes/tipos.ts:412`).
No hay que cambiar el tipo: hay que **dejar de rellenarlo** al crear, y añadir un campo propio
para el número de recepción.

Queda por resolver un contrato: `VinculoExpedienteRadicado` lleva hoy `numeroExpediente`
(`lib/server/expedientes-licencias.ts:570`), y ese vínculo se escribe en `ventanilla_radicados` en
la misma transacción que crea el expediente. **Antes de emitir el número legal ahí debe ir el
número de recepción**, y el campo debe distinguir cuál de los dos es — o el vínculo hereda el
mismo problema que este ADR quiere arreglar.

### 4.3 Cuándo ancla el término — verificación declarativa, no constitutiva

La pregunta que ningún compilador va a señalar: al mover la frontera, ¿el término arranca en la
radicación del ciudadano o en la verificación del funcionario?

**Propuesta: en el momento en que el expediente quedó completo, no en el que alguien lo miró.**

La verificación **declara** un hecho, no lo crea. Si el ciudadano presentó todo el día 10 y la
funcionaria verifica el 14, el expediente **estuvo en debida forma desde el 10**: los cuatro días
de demora administrativa no se le pueden descontar. Si presentó incompleto el 10 y subsanó el 20,
el ancla es el 20.

En la práctica: el ancla es la fecha del **último requisito obligatorio aportado**, que el sistema
ya conoce por los propios aportes. Nunca la fecha del clic de verificación.

Esto **preserva** la corrección ya desplegada (PR #235): hoy el ancla es
`radicado.control.fechaRadicado` y sigue siendo correcta para el caso normal — expediente completo
desde el principio.

### 4.4 Un solo reloj de record

Las fechas con efecto jurídico las sella la **base de datos**, no el proceso de aplicación. No por
riesgo de manipulación, sino para que exista **un único reloj de record** cuando mañana haya varios
entornos de ejecución (Vercel, crons, trabajos de migración, un futuro servicio aparte).

Matiz honesto: `new Date()` dentro de una *route handler* ya es hora de servidor, no del navegador
— el punto D4 de la auditoría sonaba peor de lo que era. Esto no corrige un defecto vivo; fija el
criterio antes de que la divergencia sea posible.

Restricción técnica a resolver en la implementación: `serverTimestamp()` es un centinela que no se
puede leer dentro de la misma transacción que lo escribe, y el cálculo del término necesita el
valor. Hay que elegir entre dos escrituras o derivar el ancla de los aportes (§4.3), que ya llevan
fecha.

## 5. Impacto medido

No estimado: levantado contra el código, y cada rotura verificada reproduciéndola.

### Rompe el build — el compilador lo señala con ubicación exacta

| Qué | Dónde |
|---|---|
| `TRANSICIONES` es un `Record` exhaustivo sobre la unión de estados | `lib/motor-expedientes/estados-licencia.ts:113` |
| `ESTILOS_ESTADO_JURIDICO` — exige decidir color y etiqueta en español | `app/interno/licencias/estilos-estado-juridico.ts:33` |
| `ETIQUETA` en el test del chip, **y** una cardinalidad fija `toBe(10)` que falla en ejecución | `__tests__/chip-estado-juridico-render.test.tsx:18` y `:39` |

Hay precedente vivido: el mismo coste se pagó al añadir `HISTORICO_SIN_RESOLVER`, y el código lo
**predijo por escrito** (`estados-licencia.ts:316-320`).

### No rompe nada y hace el daño — lo que hay que tocar sí o sí

**`terminoResolucionSigueCorriendo()`** (`estados-licencia.ts:188`) decide con
`ESTADOS_RESUELTOS_LICENCIA`, que es un **array**, no un `Record`. Compila perfecto. Un estado
nuevo no está en esa lista, así que la función devolvería **`true`**: el sistema afirmaría que el
término de 45 días **ya corre** para un expediente que por definición todavía no lo ancló.

Es exactamente lo contrario del propósito del cambio, y es la misma clase de defecto que el código
dice haber corregido en agosto. **Si de este ADR solo se recuerda una línea, que sea ésta.**

### Desaparece sin avisar

Los KPIs de la bandeja y el libro consecutivo clasifican con arrays de inclusión
(`BandejaLicenciasClient.tsx:57-58`, `presentacion-libro-consecutivo.ts:54-59`). Un estado que no
cae en ningún balde no rompe nada: **los expedientes presentados se vuelven invisibles**.

Síntoma de fondo: **los `Record` avisan, los arrays derivan en silencio.** Prueba viva —
`__tests__/estados-licencia.test.ts:14-17` mantiene un array `TODOS_LOS_ESTADOS` que **hoy ya está
desactualizado**: omite `HISTORICO_SIN_RESOLVER`.

### Cuesta menos de lo que parecía

- `numeroExpediente` **ya es opcional** (§4.2).
- Los guards defensivos con `in` para estados desconocidos **ya existen**
  (`presentacion-libro-consecutivo.ts:314` y `:697`): se comportan bien solos.
- `ESTADO_DESTINO_POR_TIPO_ACTUACION` se indexa por tipo de actuación, no por estado: **no rompe**.
- Los ficheros de migración usan anotaciones y *casts*, no `Record` exhaustivos: **no rompen**.
- El cambio es **aditivo**: los expedientes ya escritos conservan su estado y no requieren migración.

### 4.5 El estado previo también tiene plazo

Un expediente sin término anclado **no es un caso a ignorar: es un caso a
vigilar con otra regla**. Si algo entra en estado previo y se queda ahí, eso
también es un plazo — el de la Administración para verificar completitud, que no
puede ser indefinido. El vigía debe **reportarlos, no saltárselos**, y disparar
alerta al superar una edad máxima.

De ahí se sigue que el vigía distinga **tres situaciones y no dos**: término
corriendo, término suspendido por observaciones, y expediente sin anclar. Cada
una con su regla. Colapsarlas en «tiene fecha / no tiene fecha» vuelve invisible
el tercer caso, que es el mismo error de fondo que este ADR corrige.

**Sobre la edad máxima, y cómo debe preguntarse.** Ese número no mide solo
cuánto puede tardar la Administración. Mide el tiempo durante el cual un
ciudadano **ya entregó su solicitud y todavía no tiene término corriendo a su
favor**. Los dos intereses apuntan en direcciones opuestas: mientras más largo,
más cómoda la verificación y más tiempo la persona en el limbo. Planteado como
*«¿cuántos días necesitan ustedes?»*, la respuesta natural será un número
grande.

Criterio adoptado: el valor es **configurable, no constante en código**, y
arranca en **el número más corto que Planeación diga que puede sostener**, no en
el más cómodo. Ampliarlo después con evidencia es una conversación fácil;
reducirlo cuando ya se acostumbraron, no.

Implementado en `app/api/cron/vencimientos-licencias` con defecto conservador de
3 días hábiles, pendiente del valor definitivo (§7).

### 4.6 La regla de fondo, enunciada una vez

Buena parte de lo corregido en este módulo es **la misma regla aplicada en
formas distintas**. Conviene dejarla escrita una vez, en lugar de
redescubrirla cada vez:

> **El instrumento que vigila el silencio no puede filtrar por el campo que
> falta justo en los casos que más importan.**

No es una máxima abstracta: se ha materializado tres veces en este módulo, y
las tres veces el defecto **compilaba, pasaba las pruebas y no se quejaba**.
Por eso se registran como casos, con nombre y con lo que cada uno habría
ocultado.

#### Caso 1 — El clasificador de estados del vigía

Al escribir el vigía deduje «suspendido» de `terminoResolucionSigueCorriendo`,
que responde *«¿ya se resolvió?»* y no *«¿está suspendido?»*.
`CON_ACTA_DE_OBSERVACIONES` no figura entre los estados resueltos, así que
habría caído en **corriendo**.

*Lo que habría ocultado:* un expediente con el reloj legalmente detenido,
contado y alertado como si el plazo siguiera corriendo. Y el caso simétrico —
el expediente **sin anclar**— habría desaparecido por completo si el vigía se
hubiera escrito con dos categorías («tiene fecha / no tiene fecha») en vez de
cuatro.

*Cómo se cazó:* al redactar la prueba, antes de ejecutarla. El colapso de
categorías cometido dentro del código escrito para evitarlo.

#### Caso 2 — La cota de lectura del vigía

La forma natural de acotar la consulta era por rango de fecha de vencimiento,
que es como lo hace el cron equivalente de PQRSD.

*Lo que habría ocultado:* **exactamente el caso que este ADR crea.** Un
expediente en estado previo no tiene fecha de vencimiento — es su definición.
Filtrar por ese campo lo excluye del barrido, y el instrumento construido para
detectar el silencio se vuelve ciego precisamente ante él.

*Cómo se resolvió:* cota **numérica** (techo de documentos), no por consulta.
Queda registrado en el presupuesto de rendimiento R11 con esa justificación,
porque de otro modo parece un descuido.

#### Caso 3 — La expresión que reconoce rutas de adjuntos

El verificador de conciliación del respaldo descubre las rutas de Storage
recorriendo el JSON de cada documento. La primera expresión usaba `[^\s]+`.

*Lo que habría ocultado:* todo archivo **con espacios en el nombre** — y el
sanitizador de nombres del sistema los conserva. En la prueba, el que se
perdía era `respuestas/…/oficio firmado.pdf`: precisamente el oficio de
respuesta firmado, que es el documento irreemplazable del expediente. La
verificación habría reportado «conciliado» sin haber mirado el archivo que más
importa.

*Cómo se cazó:* probando el detector contra las ocho formas reales de ruta
antes de subirlo. Ocurrió **dentro de la herramienta escrita para aplicar esta
misma regla**, y unas horas después de enunciarla aquí.

---

El defecto que este ADR corrige es de la misma familia: un expediente nace
afirmando completitud porque el sistema no tenía cómo representar «todavía no
verificado». **Lo que no se puede nombrar, no se puede vigilar** — y lo que se
filtra por el campo ausente, tampoco.

De los tres casos se sigue una prueba práctica, barata de aplicar: **ante todo
filtro, preguntar qué caso queda fuera por no tener ese campo.** Si la
respuesta es «el que estoy buscando», el filtro está mal.

## 6. Consecuencias

**A favor:** el estado deja de afirmar lo que no verificó; el término arranca cuando debe; el
consecutivo legal se consume solo cuando hay algo que numerar; y el emisor se cablea una vez, en el
sitio definitivo.

**En contra:** tres roturas de compilación, un test de cardinalidad, y una función que hay que
tocar aunque no se queje. Aparece además una categoría nueva —expedientes legítimamente **sin
término**— que las pantallas deben saber mostrar sin inventarse un cero ni un `NaN`.

**Si no se hace:** el módulo sigue certificando por escrito una completitud que nadie comprobó, y
el día que se abra la emisión real esa afirmación viaja con un número de la serie legal detrás.

## 7. Lo que este ADR NO decide

- El **nombre definitivo** del estado y su etiqueta en español: es lenguaje institucional y lo
  decide la Secretaría de Planeación, no ingeniería.
- El **formato del número de recepción**.
- Si la verificación de completitud genera **acta** o basta la bitácora.
- La **edad máxima en estado previo** (§4.5). El defecto de 3 días hábiles es
  provisional, elegido por conservador y no por estudiado.
- **Con qué número abre la operación real** la serie de radicados — decisión pendiente con gestión
  documental, independiente de este ADR pero del mismo momento.
