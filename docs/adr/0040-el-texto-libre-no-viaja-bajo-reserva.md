# ADR-0040 — Bajo reserva de identidad, el texto libre del ciudadano no viaja a la IA

- **Estado:** ACEPTADO
- **Fecha:** 1-sep-2026
- **Decide:** el propietario (issue #299, decisión del 31-ago-2026: «opción 1, por ADR»)
- **Relacionado:** ADR-0033 §4.6-bis/ter; ADR-0039 (custodios por mutación);
  PR #291 (donde el hueco quedó reportado por escrito); issue #300 (el canal de
  respuesta — pieza hermana, decidida aparte).

## 1. Contexto — el hueco, medido y no supuesto

El barrido del 30–31 de agosto dejó reportado, dentro del propio archivo de
pruebas de SIMI, el defecto A: con `RESERVADA` activa, el **asunto y la
descripción** —texto libre escrito por el ciudadano— viajaban a Gemini pasados
solo por `sanitizarPiiTextoSimi`, que **declara en su propio docstring** que no
detecta nombres, ni direcciones, ni teléfonos fijos: solo borra correo, móvil
colombiano y documento con prefijo explícito.

Un «Yo, Juan García, propietario de la matrícula 300-12345 en la vereda Caño
San Pedro…» escrito por un solicitante con identidad reservada **llegaba íntegro
al modelo de un tercero**. El trade-off del sanitizador («preferimos falsos
negativos») se aceptó para el caso general y nunca se reexaminó para el caso en
que la Ley 1581/2012 (art. 4 lit. f — circulación restringida) exige protección
reforzada.

## 2. Decisión

> **Cuando `debeOcultarIdentidad(r)` es cierto, el asunto y la descripción NO
> entran al bloque que viaja al modelo.** En su lugar, el bloque declara la
> omisión y su fundamento, e instruye al modelo a no pedir ni inferir ese
> contenido. SIMI sugiere con lo demás.

### La opción 2, descartada con la razón escrita

La alternativa era «sanitización reforzada» bajo reserva: intentar detectar y
tachar nombres, direcciones y matrículas dentro del texto. **Se descarta porque
prometería una detección que el sanitizador declara no saber hacer** — sería
otro letrero que miente, la especie exacta que el barrido de esta semana vino a
extinguir. Una omisión total es verificable por custodio con una aserción
exacta («el asunto no está en el bloque»); una detección «mejorada» solo sería
verificable contra los casos que a alguien se le ocurrieron.

### El costo, asumido

En los radicados con reserva, la sugerencia de SIMI pierde el contenido del
texto libre. Se asume: son pocos, son justamente los de protección reforzada, y
la **heurística local de competencia** (`evaluarCompetenciaRadicado`, código
puro que no sale de la entidad) sigue usando el texto completo — la reserva
protege frente al TERCERO, no frente al cálculo propio de la entidad.

## 3. Alcance — qué toca y qué no

- **Toca:** únicamente el `bloqueTexto` que `construirContextoSimi` produce y
  que `app/api/simi/radicado` envía al modelo. Es el único camino del texto
  libre hacia afuera (verificado en la PR #291).
- **NO toca:** la radicación ni el almacenamiento (la funcionaria sigue leyendo
  el texto completo en su pantalla — la reserva es frente a terceros, no frente
  a la entidad que responde); la heurística local de competencia; `meta` y la
  auditoría interna de SIMI; y el **canal de respuesta** (issue #300), que es
  la pieza hermana con su propia decisión y su propia PR.

## 4. Custodia (ADR-0039)

El custodio asevera las dos direcciones —bajo reserva el texto no está y la
declaración de omisión sí; identificado, el texto está y la declaración no— con
los cuatro marcadores de reserva probados **en solitario**, y se dio por bueno
solo tras verlo en rojo con la mutación realista: restaurar la inclusión
incondicional que el código tenía ayer.
