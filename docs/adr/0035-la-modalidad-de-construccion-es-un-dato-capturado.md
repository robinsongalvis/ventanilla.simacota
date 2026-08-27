# ADR-0035 — La modalidad de construcción es un dato que se captura, no se supone

- **Estado:** ACEPTADO
- **Fecha:** 27-ago-2026
- **Decide:** el propietario
- **Relacionado:** ADR-0029 (catálogo normativo congelado), ADR-0033 §4.6-bis (declarar el alcance), ADR-0026 (motor genérico)

---

## 1. Contexto

El sistema **validaba** la modalidad de la licencia de construcción contra el
catálogo normativo —las nueve del art. 2.2.6.1.1.7— y acto seguido **la
descartaba**. No era un subtipo, no era clave de contexto, no había campo que la
guardara. Nadie se la preguntaba al funcionario.

Las consecuencias no eran teóricas:

- **El checklist** evaluaba siempre contra la definición de obra nueva. Un
  expediente de demolición recibía los diecinueve requisitos de obra nueva,
  proyecto arquitectónico incluido, para tumbar una casa.
- **Los papeles del ciudadano** —constancia impresa y acuse de recibo— tuvieron
  que dejar de nombrar la modalidad (#258), porque nombrarla habría sido
  inventarla.
- **`seleccionarReglaVigencia`** devuelve `MODALIDAD_REQUERIDA` para toda
  licencia de construcción: un consumidor que llevaba tiempo esperando un dato
  que nunca llegaba.

## 2. Decisión

> **La modalidad se captura al crear el expediente y se guarda en
> `Expediente.modalidadesConstruccion`. Lo que no se capturó, no se supone.**

Tres reglas, y las tres son el objeto de la decisión:

1. **La pregunta aparece solo cuando la figura la tiene.** La condición se
   resuelve con `exigeModalidadConstruccion()`, la misma función en pantalla y
   en servidor — no una condición escrita dos veces que pueda divergir.
2. **Las opciones se derivan del catálogo** (`MODALIDADES_CONSTRUCCION`), nunca
   de una lista escrita a mano en la pantalla.
3. **La ausencia se conserva como ausencia.** Un expediente anterior a este
   campo no lo trae, y no se rellena con un valor por defecto.

## 3. Por qué una lista y no un valor

El **parágrafo 1 del mismo artículo** permite combinar varias modalidades en una
sola licencia —ampliación con demolición parcial, por ejemplo—. Guardar una sola
obligaría a elegir cuál se escribe y cuál se pierde.

`seleccionarReglaVigencia` recibe hoy una modalidad **singular**. Alimentarla
desde una combinación es una decisión de vigencias, que ya tiene su propio error
explícito para lo que no puede desambiguar; **no se resuelve de tapadillo** aquí.
Queda como trabajo separado y consciente.

## 4. Por qué NO va en `subtipos` ni en `clavesContexto`

- **`clavesContexto`** es `Record<string, string | number | boolean>`: no admite
  listas. Montarla ahí forzaría una sola modalidad y haría inaplicable la matriz
  justo en las solicitudes combinadas.
- **`subtipos`** guarda códigos de FIGURA. Hay una colisión de vocabulario
  heredada: el JSDoc de `DefinicionTramite.subtipos` ponía como ejemplo «Obra
  Nueva, Ampliación», que son modalidades. Ese JSDoc se corrigió en el mismo
  cambio; el campo sigue siendo de figuras.

## 5. La subdivisión no necesita la pregunta

Sus tres modalidades —rural, urbana y reloteo— están modeladas en el catálogo
como **tres figuras distintas** agrupadas por `claseDe: 'SUBDIVISION'`, así que
ya viajan en `subtipos`. Preguntarle la modalidad a una subdivisión sería
preguntar dos veces lo mismo. **CONSTRUCCION es hoy la única figura con un eje
de modalidad propio.**

## 6. Consecuencias

- Es el **prerequisito de la matriz de requisitos por modalidad** que sale de la
  reunión con Planeación: sin este campo, la matriz no tiene contra qué
  aplicarse.
- Los papeles del ciudadano **vuelven a poder nombrar la modalidad** — pero solo
  cuando esté capturada. La prueba que lo vigilaba detectó el cambio por sí sola
  y pasó a vigilar la regla nueva, sin que nadie tuviera que acordarse.
- El detalle del expediente muestra **«modalidad sin capturar»** en los
  anteriores al campo. El hueco es un hecho sobre el expediente, no un defecto
  de la pantalla.
- **Queda abierto, y es deliberado:** parametrizar el checklist por modalidad
  (la mina de `__tests__/checklist-ciego-a-la-modalidad.test.ts` sigue armada) y
  alimentar `seleccionarReglaVigencia`. Este ADR captura el dato; no decide
  todavía qué se hace con él.

## 7. Lo que este ADR NO decide

- **Qué requisitos exige cada modalidad.** Esa es la matriz, y sale de la
  reunión con Planeación — no de una inferencia nuestra sobre el decreto.
- **Cómo se desambigua una combinación** para el régimen de vigencias.
- **Si se pregunta la modalidad a los expedientes ya creados.** Hoy se muestran
  como «sin capturar»; rellenarlos es una decisión de datos, no de código.
