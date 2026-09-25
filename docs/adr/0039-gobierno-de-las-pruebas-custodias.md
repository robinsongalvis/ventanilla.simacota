# ADR-0039 — Gobierno de las pruebas custodias: cómo se prueba una, y cuándo se reescribe

- **Estado:** ACEPTADO
- **Fecha:** 31-ago-2026
- **Decide:** el propietario
- **Relacionado:** ADR-0033 §4.6-bis (todo vigilante declara su alcance) y §4.6-ter
  (un detector no se da por bueno hasta verlo fallar); ADR-0038 §6-bis, de donde
  se extrae la regla de reescritura.

## 1. Contexto — dos reglas sueltas y una lección nueva

Este proyecto vive de sus pruebas: son lo que sostiene que la serie legal no se
rompa, que una identidad reservada no llegue a un modelo de terceros, y que un
plazo no corra contra la Administración cuando la norma lo tiene suspendido.

Sobre ellas ya había dos reglas escritas, y una tercera acaba de aprenderse:

1. **Los textos custodiados no se negocian.** Si una prueba de *wording* se pone
   roja, el que está mal es el rediseño. Regla de la casa, vigente.
2. **Cuándo SÍ se reescribe una custodiada.** Escrita en el ADR-0038 §6-bis, que
   es un ADR **de plazos** — llegó ahí porque ese ADR reescribió una y documentó
   el criterio en el sitio. Funcionaba, pero una regla que gobierna *cualquier*
   reescritura estaba archivada bajo «el término se suspende», y nada apuntaba
   hacia ella desde donde se necesita.
3. **Cómo se prueba que un custodio custodia** — lo que faltaba, y lo que el
   barrido del 30 y 31 de agosto obligó a fijar.

El barrido midió **44 pruebas de 46 candidatas que pasaban sin probar lo que
decían**. Tres de ellas eran de seguridad, y en tres casos la suite ENTERA
—2812 pruebas— pasaba con el fallo dentro: no es que la prueba acusada no
vigilara, es que **no vigilaba nadie**.

## 2. Decisión 1 — un custodio no vale hasta verlo fallar, y la mutación tiene que ser realista

> **Para dar por bueno un custodio hay que meterle al código el fallo que dice
> vigilar y ver la prueba en ROJO. Y la mutación tiene que ser LA SIMPLIFICACIÓN
> QUE ALGUIEN HARÍA DE VERDAD, no una cosmética.**

La primera mitad ya estaba en el ADR-0033 §4.6-ter. La segunda es nueva, y sin
ella la primera se puede cumplir sin averiguar nada.

### La evidencia que la obliga (31-ago-2026)

La traducción entre lo que escribe el ingeniero de Planeación y lo que guarda el
sistema **no es uno a uno**: `LC y PH` son dos figuras normativas, `LC, PH y LSU`
son tres. La pregunta era si alguien vigila esa expansión.

**Mutación cosmética** — cambiar una fila de la tabla para que `LC y PH` diera un
solo código:

```
catálogo (el resolutor)     🔴 1 roja
```

Conclusión aparente: está cubierto. Y esa conclusión habría sido **falsa**.

**Mutación realista** — la simplificación que alguien haría de verdad: aplanar el
resolutor entero, que rompe todas las combinaciones de golpe.

```ts
- return fila.codigos;
+ return fila.codigos.slice(0, 1);
```

```
catálogo (el resolutor)     🔴 5 rojas
migración (quien lo CONSUME) 🟢 47 de 47 VERDES
```

La unidad estaba vigilada. **La integración no.** Nadie comprobaba que un
expediente migrado naciera con sus dos subtipos, y uno con `['CONSTRUCCION']` en
vez de `['CONSTRUCCION','APROBACION_PH']` pierde la figura de propiedad
horizontal —con sus requisitos y sus vigencias— sin un solo rojo.

**La mutación cosmética tocaba un dato; la realista tocó el mecanismo.** Solo la
segunda encontró el hueco.

### Cómo se elige la mutación

| Prefiere | Sobre |
|---|---|
| El **mecanismo** — el resolutor, la guarda, el predicado, el `return` | Un **dato** — una fila de una tabla, un literal, un fixture |
| El **refactor plausible**: «juntemos los dos gates», «esta guarda es redundante», «devolvamos el primero» | Lo que nadie escribiría nunca |
| Lo que **compila y pasa `tsc`** — si no compila, CI lo caza antes y la prueba no era la defensa | Lo que rompe tipos |
| Correr **también la capa que consume**, no solo la unidad | Quedarse en la unidad y dar por cubierta la integración |

**Nunca una mutación que borre datos.** Son expedientes de ciudadanos con
retención legal: si la única forma de demostrar algo es insertar un borrado, el
hallazgo queda sin probar y se dice así.

## 3. Decisión 2 — cuándo SÍ se reescribe una prueba custodiada

*(Extraído del ADR-0038 §6-bis, que queda como referencia a este ADR.)*

La regla de la casa es que los textos custodiados no se negocian: **si una prueba
de *wording* se pone roja, el que está mal es el rediseño**. Esa regla sigue en
pie y esa dirección es siempre la equivocada.

**La distinción, escrita para que no se use como excusa:**

| Se reescribe | NO se reescribe |
|---|---|
| Una **decisión documentada** retira lo que la prueba custodiaba, **con su fundamento delante** | Un cambio visual se topa con ella y resulta incómoda |
| El invariante que sobrevive se conserva y se sigue probando | Se afloja «porque ahora se ve mejor» |
| Queda escrito qué se retiró, por qué, y qué se conservó | Se actualiza en silencio para poner el verde |

**El fundamento va en el código, no en el mensaje del commit.** Encima de la
prueba reescrita, donde lo lea quien la abra dentro de un año. Un commit se
consulta si alguien sospecha; un comentario se lee siempre.

### Los dos casos que ya aplicaron esta regla

**ADR-0038 · `panel-termino-dual-render`.** El ADR retiró el doble cómputo citando
el artículo. Sobrevive —y sigue custodiado— que la alerta va sobre la fecha
operativa con su `role="alert"`, y que el estado vacío distingue el histórico
migrado del real sin radicar. Se añadió lo que la decisión exige: que la pantalla
cite el artículo y ya no diga «pendiente de concepto».

**31-ago-2026 · `radicar-solicitud-form`.** Custodiaba que el checklist mostrara
«nombre **y código**». La decisión del propietario retiró los códigos internos, y
el fundamento está verificado contra la fuente: el ingeniero escribe `LSR`, `LSU`,
`LC`; el sistema guarda `SUBDIVISION_RURAL`, `CONSTRUCCION`; y existe una tabla
cuyo único trabajo es traducir entre ambos. Sobrevive —y se sigue probando— que
cada figura sea alcanzable **por su nombre** como casilla accesible.

## 4. Decisión 3 — buscar un custodio no es grepear literales

Antes de afirmar «este texto no tiene quien lo cuide», hay que buscar también en
las **consultas** de las pruebas, no solo en los literales:

```bash
grep -rn "<fragmento>" __tests__/                        # insuficiente
grep -rnE "name:\s*/.*<fragmento>" __tests__/            # el texto vive DENTRO de la consulta
grep -rnE "getByRole|getByLabelText|toHaveAccessibleName" __tests__/ | grep -i "<fragmento>"
```

El 31-ago un barrido de literales concluyó «ninguna prueba exige que el código se
vea». Sí la había:

```ts
screen.getByRole('checkbox', { name: /Licencia de construcción.*CONSTRUCCION/i })
```

El código no estaba suelto: vivía dentro de una regex sobre el nombre accesible.
La suite lo desmintió después, en rojo — pero la conclusión ya había viajado como
un hecho.

> **Si el barrido no encuentra nada, se dice «no encontré», no «no existe».**

Es la misma familia del doble verde, vista del revés: allí la prueba afirmaba más
de lo que miraba; aquí el barrido afirmó más de lo que miró.

## 5. Consecuencias

- Toda PR que **añada** un custodio trae su mutación y el rojo que produjo.
- Toda PR que **reescriba** uno trae, encima de la prueba, qué se retiró, con qué
  fundamento y qué se conservó.
- Un custodio verde y nunca visto fallar **no cuenta como cobertura**.
- El coste es real: cada mutación es aplicar, correr y restaurar. Se acepta,
  porque el barrido demostró que sin ella la cobertura es una cifra y no un hecho.

## 6. Lo que este ADR NO decide

- **Qué textos son custodiados.** Eso lo decide quien escribe la prueba y lo
  declara en su alcance (ADR-0033 §4.6-bis).
- **Si toda prueba necesita mutación.** No: el estándar aplica a los CUSTODIOS
  —lo que existe para impedir una regresión concreta—, no a cada aserción.
- **Automatizar la mutación en CI.** Es tentador y no se decide aquí: un mutador
  automático sobre este repositorio es un frente propio, con su coste de tiempo
  de CI.

## Fuentes

- ADR-0033 §4.6-bis y §4.6-ter — alcance declarado y detector visto fallar.
- ADR-0038 §6-bis — origen de la regla de reescritura, hoy referencia a este ADR.
- Barrido de dobles verdes, 30–31 ago 2026: 44 de 46 candidatos confirmados por
  mutación; tres protecciones donde pasaba la suite entera con el fallo dentro.
