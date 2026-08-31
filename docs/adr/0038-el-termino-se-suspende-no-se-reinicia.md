# ADR-0038 — El término se SUSPENDE, no se reinicia: lo dice el artículo

- **Estado:** ACEPTADO
- **Fecha:** 30-ago-2026
- **Decide:** el propietario, sobre la norma
- **Relacionado:** ADR-0029 (cierra su «hueco 1»), ADR-0037 (correos de hitos), ADR-0033 §4.6-bis, **ADR-0039** (§6-bis se extrajo allí)
- **Ampliado:** 30-ago-2026 — ver §9. Absorbe R19 y una SEGUNDA causa de suspensión.

---

## 1. Contexto — un hueco que no era hueco

El ADR-0029 declaró abierto el «hueco 1»: qué le pasa al término de 45 días
hábiles cuando hay un acta de observaciones y el ciudadano subsana. Sin respuesta,
el sistema hizo lo prudente: calcular **las dos hipótesis** —suspensión con
reanudación, y reinicio a cero— y alertar siempre sobre la más temprana, para
proteger a la Administración.

Ese doble cómputo se construyó entero: motor, panel con las dos fechas, alerta
conservadora, y una nota en pantalla que decía que la interpretación *«sigue
pendiente de concepto escrito de Jurídica»*. Hubo además una contradicción verbal
de Jurídica sobre este mismo punto, que es la razón por la que se exigió concepto
escrito (RN-5).

**La norma lo dice expresamente.** Decreto 1077 de 2015, artículo 2.2.6.1.2.2.4:

> «levantará **por una sola vez**, si a ello hubiere lugar, un acta de observaciones»
>
> «El solicitante contará con un plazo de **treinta (30) días hábiles** para dar respuesta»
>
> «Este plazo podrá ser ampliado, a solicitud de parte, hasta por un término
> adicional de **quince (15) días hábiles**»
>
> **«Durante este plazo se suspenderá el término para la expedición de la licencia»**
>
> si no se responde: «la solicitud **se entenderá desistida** y en consecuencia se
> procederá a archivar el expediente mediante acto administrativo»

**«Se suspenderá».** En derecho administrativo el término es preciso: suspender es
parar y continuar donde iba. Reiniciar exigiría decirlo, y no lo dice.

## 2. Decisión

> **El término de 45 días hábiles se SUSPENDE con la comunicación del acta de
> observaciones y se REANUDA donde se detuvo. No se reinicia a cero.**
>
> Fundamento: D.1077/2015 art. 2.2.6.1.2.2.4. No es una interpretación: es el
> texto.

En consecuencia:

1. **El doble cómputo se retira.** `calcularVencimientoDual` deja de ofrecer dos
   hipótesis; el cómputo pasa a ser `SUSPENSION_REANUDACION`, con su cita.
2. **El panel muestra UNA fecha**, no dos, y cita el artículo en vez de decir
   «pendiente de concepto».
3. **La prórroga de 15 días hábiles se implementa**, porque la norma la
   contempla. Hoy solo vive en el texto del correo al ciudadano
   (`lib/email/templates/aviso-acta-observaciones.ts`, que ya la nombra): **el
   correo promete algo que el reloj no sabe hacer**. El cómputo tiene que
   conocerla.
4. **El acta es única** («por una sola vez») — ya está implementado y ya cita
   este mismo artículo.
5. **El desistimiento por no responder** — ya está implementado y ya cita este
   mismo artículo.

## 3. La regla rectora, escrita

> **Si la norma lo dice, se cita el artículo y se implementa.** No hace falta que
> nadie lo dicte. La interpretación de un tercero se pide cuando la norma calla;
> cuando la norma habla, se lee.

Los tres niveles son norma y los tres sirven de fundamento: **nacional** (ley),
**reglamentario** (decreto, resolución) y **municipal** (acuerdo). Un requisito
fundado en el Acuerdo Municipal 026 está tan fundado como uno del Decreto 1077.

### Corolario

> **Este sistema no inventa hechos ni para bien.**

El caso que lo fija es la **prórroga de 15 días hábiles**. Es «a solicitud de
parte»: no se concede sola. El cómputo podría presumirla cuando falta el dato —y
presumirla *protegería* al ciudadano, porque retrasaría un archivo por
desistimiento— pero estaría afirmando que alguien la pidió y que alguien la
concedió, cuando nadie registró ni lo uno ni lo otro.

Un sistema que inventa hechos favorables inventa hechos. La dirección del favor
no cambia la naturaleza del acto, y un expediente que afirma lo que no consta
deja de servir como prueba de nada.

Va probado en las dos direcciones: sin el dato el plazo son 30, con él son 45, y
`prorrogaConcedida: false` y la ausencia del campo se tratan igual.

## 4. La lección de las 19 citas

**Este artículo estaba citado DIECINUEVE VECES en el código** antes de este ADR.
Se usaba para el acta única, para el desistimiento tácito, para el plazo de 30
días, y hasta para nombrar los quince días de prórroga en el correo al ciudadano.

**Todo el artículo estaba dentro del proyecto — menos la frase que resolvía el
hueco.** Se construyó un doble cómputo entero, con su alerta conservadora y su
nota de «pendiente de concepto», para una pregunta que el mismo artículo ya citado
contestaba en una línea.

Nadie lo leyó completo. Se citaban sus pedazos.

> ### Regla nueva, hermana de «leer primero uno hecho a mano»
>
> **Cuando una norma se cite en el código, se lee el artículo COMPLETO la primera
> vez, no solo la frase que se necesita.** Un artículo es una unidad de sentido;
> sus frases sueltas no lo son.

La hermana mayor de esta regla nació el 29-ago-2026 leyendo la Licencia de
Subdivisión 2026-001: *cuando el sistema vaya a producir un documento que hoy se
hace a mano, leer primero uno hecho a mano*. Las dos dicen lo mismo desde dos
lados: **el original completo antes que el fragmento cómodo.**

## 5. Todo evento que mueva el plazo se ve y se avisa

**Una sola fuente, dos salidas. Nunca dos cálculos.**

Cualquier evento que altere el cómputo —el acta que suspende, la respuesta que
reanuda, la prórroga de 15 días del ciudadano, una prórroga del término de
decisión— debe:

1. **Reflejarse solo en el reloj.** El ingeniero abre el expediente y el reloj
   dice la verdad de hoy: cuánto queda, si está pausado, de quién es el turno,
   hasta cuándo. Sin que nadie recalcule nada a mano.
2. **Disparar solo el correo al ciudadano.** Sin que ningún funcionario tenga que
   acordarse.

El criterio de clasificación ya vive en un solo sitio
(`lib/motor-expedientes/semaforo-termino.ts`, extraído el 29-ago-2026 justo para
esto): la pantalla y el correo lo consultan, ninguno lo repite. Este ADR extiende
esa regla a los eventos que mueven el plazo.

### 5.1 El reloj detenido se VE

Ya implementado (29-ago-2026): con el término suspendido, la tarjeta muestra el
reloj parado —anillo a trazos, símbolo de pausa, de quién es el turno— en vez de
desaparecer. Desaparecer decía «aquí no hay nada», que es lo mismo que decía para
un expediente sin ancla, y son situaciones opuestas.

**Sin cuenta atrás, y es deliberado:** cuántos días quedaban al congelarse depende
de la serie de eventos, y el servidor todavía no manda ese dato. Cuando el cómputo
único lo calcule, la tarjeta podrá decir «le quedan N de 45» con fundamento.
Hasta entonces: antes no darlo que darlo inventado.

## 6. PRECONDICIÓN: sin destinatario no hay avisos automáticos

**Verificada en código, no supuesta.**

El expediente de licencias guardaba `solicitanteNombre` y `solicitanteDocumento` y
nada más. La decisión de comunicar lo decía literal: *«no se copia email al
expediente, proyección mínima D2»*. Un expediente sin radicado vinculado **no
tenía a quién escribirle, nunca, por diseño**.

> **El correo sale perfecto hacia nadie.**

Por eso la captura del contacto (punto 6 del encargo) es **PRECONDICIÓN** de los
avisos automáticos de este ADR, no una prioridad paralela. Construir el envío
automático sobre expedientes sin destinatario sería fabricar otra vez la familia
«construido e inalcanzable».

**Estado de la precondición:** cerrada el 30-ago-2026 —resolutor con precedencia,
captura obligatoria en el formulario, aviso en pantalla cuando no hay
destinatario— y probada. La precedencia vive en un solo sitio
(`lib/motor-expedientes/destinatario-expediente.ts`): el radicado manda siempre;
sin radicado manda la captura propia; y **sin correo en el radicado NO se cae a la
captura**, porque eso serían dos fuentes disfrazadas de una.

## 6-bis. Cuándo SÍ se reescribe una prueba custodiada

> **La regla general vive ahora en el ADR-0039 — «Gobierno de las pruebas
> custodias: cómo se prueba una, y cuándo se reescribe».**
>
> Esta sección NO desaparece: se conserva para que las citas existentes
> —`ADR-0038 §6-bis`, en comentarios de pruebas y en commits— sigan
> resolviendo. Lo que ya no está aquí es el criterio, para que no haya dos
> copias que puedan divergir.

Se extrajo el 31-ago-2026. La regla llegó a este ADR porque **este ADR reescribió
una custodiada** y documentó el criterio en el sitio; pero gobierna *cualquier*
reescritura, y archivada bajo «el término se suspende» no la encontraba quien la
necesitaba.

**Lo que queda aquí es el caso, que sí es de este ADR:**

`panel-termino-dual-render` custodiaba las dos fechas del cómputo dual y la
alerta sobre la más temprana. Este ADR retiró el doble cómputo **citando el
artículo**. Lo que sobrevive —que la alerta va sobre la fecha operativa con su
`role="alert"`, y que el estado vacío distingue el histórico migrado del real sin
radicar— sigue custodiado, y se añadió lo que la decisión exige: que la pantalla
**cite el artículo** y ya no diga «pendiente de concepto».

Los tres criterios que lo autorizaron —decisión documentada con su fundamento
delante, invariante superviviente conservado, y constancia escrita de qué se
retiró— están en el **ADR-0039 §3**.

## 6-ter. «Construido y nunca pintado» — el patrón, y la regla que lo cierra

Cuarta aparición, y con la cuarta deja de ser anécdota. Decisión del propietario,
31-ago-2026:

> **Cada vez que un dato se persiste «para que la pantalla lo muestre», el mismo
> PR abre la pantalla o deja la prueba que falla si no la abre. Persistir sin
> consumidor es la mitad de un trabajo que se cuenta como entero.**

### Las cuatro

| # | Qué se construyó | Qué faltó | Cómo se descubrió |
|---|---|---|---|
| 1 | El cómputo de la debida forma, servido en `computos.debidaForma` | El cliente leía `body.debidaForma` — **el botón nunca se pintó** | El propietario, mirando la pantalla |
| 2 | El resolutor de destinatario, con su precedencia y sus pruebas | El expediente no guardaba correo: **el correo salía perfecto hacia nadie** | Leyendo la decisión D2, que lo decía literal |
| 3 | El acto de trámite del art. 2.2.6.1.2.3.1 | Ninguna actuación lo producía: **cuarto sin puerta** (R19) | Derivando la pantalla del mapa de transiciones |
| 4 | `fechaAlertaConservadora`, persistida y servida por fila | **Ninguna pantalla la leía.** Veinte días | El propietario, preguntando qué faltaba en la bandeja |

### Por qué la cuarta es la más instructiva

No fue un olvido: fue **una contradicción documentada en tres sitios a la vez**.

- La ruta la daba por **«RESUELTO»** — y servir no es mostrar.
- El panel del vigía omitía la fecha por expediente *«porque la bandeja ya lo
  muestra en cada fila»*.
- La bandeja declaraba que **«NUNCA muestra una fecha de vence»**, por una razón
  —«sin actuaciones no hay forma honesta de proyectarlo»— que **era cierta cuando
  se escribió y dejó de serlo** al persistirse el espejo, sin que nadie volviera a
  esa cabecera.

Cada uno omitía la fecha creyendo que la ponía otro. **Un comentario que envejece
mal no es documentación desactualizada: es una instrucción vigente que manda hacer
lo contrario de lo que hace falta.**

### Cómo se cumple la regla

Con una prueba de ALCANZABILIDAD, que se pone roja si la pantalla deja de pintar
el dato. La de esta cuarta es `__tests__/bandeja-vence-alcanzable.test.tsx`, y está
verificada por mutación en sus dos mitades: arrancar la celda pone **6 pruebas en
rojo**; arrancar la cabecera, **1**.

No sirve una prueba que compruebe que el dato SE PERSISTE —esa ya existía en las
cuatro— ni que el `fetch` lo trae. Tiene que montar la pantalla y buscar el dato
donde lo vería una persona.

## 7. Consecuencias

- **El panel deja de mostrar dos fechas.** La funcionaria ve una, con su artículo.
  Se acaba la pregunta «¿y cuál de las dos es?».
- **Se retira la alerta conservadora** como mecanismo: existía para protegerse de
  una incertidumbre que ya no hay. La fecha única ES la exigente.
- **Cuatro sitios cambian**: el motor (`termino.ts`), el panel, el vigía y los
  correos. Por eso esto es un ADR y no un commit.
- **Se acepta un costo:** si algún día un concepto de autoridad competente
  contradijera esta lectura, habría que volver. Se asume, porque el texto es
  explícito y la alternativa —seguir calculando dos hipótesis para una pregunta
  resuelta— es peor.

## 8. Lo que este ADR NO decide

- **Cuántos días quedaban al suspender.** El cómputo tiene que derivarlo de la
  serie de eventos; el diseño de ese cálculo es implementación, no decisión.
- **Si Planeación usa la prórroga.** El sistema la implementa porque la norma la
  contempla; que se conceda o no es operativo.
- **Los requisitos del checklist.** La auditoría
  (`docs/licencias/auditoria-requisitos-checklist.md`) es documento de análisis:
  ningún requisito se toca hasta que el propietario lo consulte con la ingeniera
  de Planeación.

## 9. AMPLIACIÓN (30-ago-2026) — la segunda suspensión, y el acto que faltaba

Al ir a cerrar **R19** —«un expediente limpio se queda parado en `EN_REVISION`»—
se leyó completo el artículo que el propio mapa de transiciones ya citaba para esa
rama. Aplicando la regla del §4: **el artículo entero, no la frase**.

**D.1077/2015 art. 2.2.6.1.2.3.1, parágrafo 1** — texto literal:

> «Cuando se encuentre viable la expedición de la licencia, se proferirá un
> **acto de trámite** que se comunicará al interesado por escrito, y en el que
> además se le requerirá para que aporte los documentos señalados en el artículo
> 2.2.6.6.8.2 del presente decreto, los cuales deberán ser presentados en un
> término máximo de **treinta (30) días** contados a partir del recibo de la
> comunicación. **Durante este término se entenderá suspendido el trámite para la
> expedición de la licencia.**»

De ahí salen tres cosas, y solo la primera era R19.

### 9.1 La actuación que falta tiene nombre en la norma

Es un **acto de trámite**: la autoridad declara viable y requiere los documentos
de pago. No es una decisión de fondo — no concede ni niega.

**Se añade `acto-viabilidad` a `TipoActuacionPermitida`**, produciendo
`EN_REVISION → EN_VIABILIDAD`. Con eso, un expediente sin observaciones deja de
estar en un cuarto sin puerta, y `CONCEDIDA`/`NEGADA` —que solo se alcanzan desde
`EN_VIABILIDAD`— vuelven a ser alcanzables.

### 9.2 `EN_VIABILIDAD` SUSPENDE el término — y el sistema no lo sabía

**Comprobado en el código el 30-ago-2026:** `clasificarFrenteAlTermino` devuelve
para `EN_VIABILIDAD` la situación **`CORRIENDO`**, nivel `AVISO`. Es decir:
durante los días en que el ciudadano reúne los documentos de pago, la pantalla y
el cron **cuentan tiempo contra la Secretaría que la norma no cuenta**.

Es la misma familia que el defecto original de este módulo —el rojo con 41 días
por delante— pero al revés: aquí el sistema **apura a quien la ley no apura**.

`ESTADO_TERMINO_SUSPENDIDO` es hoy un valor único
(`CON_ACTA_DE_OBSERVACIONES`). **Pasa a ser un conjunto**, con las dos causas que
la norma declara:

| Estado | Artículo | Qué suspende |
|---|---|---|
| `CON_ACTA_DE_OBSERVACIONES` | 2.2.6.1.2.2.4 | «Durante este plazo se suspenderá el término para la expedición de la licencia» |
| `EN_VIABILIDAD` | 2.2.6.1.2.3.1 par. 1 | «Durante este término se entenderá suspendido el trámite para la expedición de la licencia» |

Un `Set` y no un `if` encadenado, por el mismo motivo de siempre: que añadir una
tercera causa mañana sea un dato y no una rama.

### 9.3 Una discrepancia que este ADR NO resuelve: ¿días hábiles o calendario?

El comentario del mapa dice «máx. 30 días **hábiles**». El artículo dice
**«treinta (30) días»**, sin la palabra — y eso contrasta con el art.
2.2.6.1.2.2.4, que sí escribe «treinta (30) días **hábiles**» para el acta.

Si son calendario, el plazo del ciudadano es **notablemente más corto** de lo que
el sistema asumiría, y un desistimiento podría declararse tarde o temprano por
contar mal.

**RESUELTO el 30-ago-2026 leyendo el artículo al que remite.** Son **días
hábiles**, y el motivo de la aparente discrepancia es que el 2.2.6.1.2.3.1 no lo
dice porque REMITE al 2.2.6.6.8.2, que sí lo escribe:

> «los curadores sólo podrán expedir la licencia cuando el interesado demuestre
> la cancelación de las correspondientes obligaciones, para lo cual contará con
> un término de **treinta (30) días hábiles**, contados a partir del
> requerimiento de aportar los comprobantes de pago por tales conceptos. Dentro
> de este mismo término se deberán cancelar al curador urbano las expensas
> correspondientes al cargo variable.»

Quien escribió «hábiles» en el comentario del mapa tenía razón. **Un artículo que
remite a otro no está callando: está citando** — y leer solo el que remite habría
dejado la duda abierta para siempre.

El plazo del ciudadano en viabilidad se puede implementar: son 30 días hábiles
desde el requerimiento, y en el mismo término se paga el cargo variable.

### 9.4 Y una pregunta de máquina de estados que este ADR SOLO NOMBRA

Por la norma, a viabilidad se llega por un **acto de la autoridad**. El mapa hace
que también se llegue desde `CON_ACTA_DE_OBSERVACIONES` con la **respuesta del
ciudadano** (`respuesta-subsanacion → EN_VIABILIDAD`).

Cabe que lo correcto sea: la respuesta **devuelve a `EN_REVISION`** —se reanuda el
término y la revisión continúa— y la viabilidad sea **siempre** el acto de
trámite, venga de donde venga.

**LO QUE LA NORMA SÍ CONTESTA (leído el 30-ago-2026).** El art. 2.2.6.1.2.2.4
completo **calla** sobre el efecto de la respuesta: solo dice que durante el
plazo se suspende el término. Pero el 2.2.6.1.2.3.1 par. 1 empieza así:

> «**Cuando se encuentre viable** la expedición de la licencia, se proferirá un
> acto de trámite…»

La viabilidad es, por tanto, una **determinación de la autoridad**, materializada
en un acto suyo. **No es un efecto automático de la respuesta del ciudadano.**

Eso basta para afirmar que el modelo actual —`respuesta-subsanacion →
EN_VIABILIDAD`— pone al expediente en viabilidad por un acto del ciudadano, y la
norma reserva esa declaración a la autoridad.

**LO QUE LA NORMA NO CONTESTA:** en qué estado queda el expediente entre la
respuesta y el acto de trámite. No dice si vuelve formalmente a revisión ni si la
autoridad puede proferir el acto en el mismo momento de recibir la respuesta.

**Por eso queda como DEFINICIÓN PENDIENTE, para consultar — no se decide por
lógica nuestra.** Deducir el estado intermedio sería exactamente lo que el
corolario del §3 prohíbe: afirmar un hecho que no consta, aunque la deducción
parezca razonable.

### 9.5 Consecuencia sobre el costo

El ADR pasa de **6–8** a **8–10 unidades** de implementación: entran la actuación
nueva, el conjunto de estados que suspenden, y sus pruebas.

**R19 queda absorbido por este ADR.** Deja de ser un riesgo suelto: es una de las
piezas de la misma implementación.

## Fuentes

- Decreto 1077 de 2015, art. 2.2.6.1.2.2.4 (redacción del D.1783/2021 art. 19)
- Decreto 1077 de 2015, art. 2.2.6.1.2.3.1 par. 1 — el acto de trámite y la segunda suspensión
- Decreto 1077 de 2015, art. 2.2.6.6.8.2 — documentos de pago (POR LEER: decide la unidad del plazo)
- Ley 1437 de 2011 (CPACA) art. 87 — firmeza
- ADR-0029 (hueco 1, que este cierra) · ADR-0037 · ADR-0033 §4.6-bis
