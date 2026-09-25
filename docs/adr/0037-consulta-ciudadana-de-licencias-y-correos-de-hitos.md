# ADR-0037 — El ciudadano consulta su licencia y recibe sus hitos

- **Estado:** ACEPTADO
- **Fecha:** 28-ago-2026
- **Decide:** el propietario
- **Relacionado:** ADR-0034 §7 (lo dejó abierto), ADR-0033 §4.6-bis (declarar el alcance)

---

## 1. Contexto

El ADR-0034 §7 dejó abierta la consulta ciudadana de licencias con dos reparos:

> *«Ampliarla exige un vocabulario ciudadano para los estados jurídicos y un
> segundo factor propio; es otra decisión y otro ADR.»*

Este es ese ADR. **Uno de los dos reparos desapareció solo.**

## 2. El segundo factor no hubo que inventarlo

Desde #252 el número del expediente **es** el del libro de ventanilla, y el
radicado guarda `vinculoExpediente`. El ciudadano ya consulta con el número que
tiene en la mano, por la ruta que ya existe, verificado con el mismo segundo
factor —correo, últimos cuatro del documento, o token para anónimos— y bajo el
mismo límite de tasa.

> **No se abre superficie nueva: se añade un bloque a la respuesta que ya se
> devolvía.**

La licencia se lee **después** de verificar. Leerla antes haría observable la
existencia del expediente sin pasar el segundo factor.

## 3. El vocabulario ciudadano sí hubo que escribirlo

«Con acta de observaciones» es exacto y no significa nada fuera de Planeación.
«En viabilidad», tampoco. Reutilizar las etiquetas internas habría sido gratis y
habría dejado al ciudadano igual de perdido —con la diferencia de que ahora
creería que le informamos.

Cada uno de los once estados se traduce a **qué pasó** y **si le toca hacer
algo**. Ese segundo dato es el que convierte una pantalla informativa en una
útil.

Es un `Record` completo, no un `switch` con `default`: un estado nuevo sin texto
**no compila**. Un `default` habría dejado al ciudadano leyendo «en trámite»
sobre un estado que nadie decidió cómo explicarle.

Y hay una prueba que verifica que **ningún texto ciudadano es la etiqueta
interna copiada**.

## 4. Los correos de hitos

`HITO_NOTIFICABLE` es un `Record` sobre **los once estados**, no una lista de
los que sí. Un estado nuevo sin decisión no compila; una lista lo habría dejado
fuera en silencio, que es exactamente cómo un aviso deja de llegar sin que nadie
se entere. **Cada exclusión lleva su razón.**

| Se comunica | Por qué |
|---|---|
| Radicada en debida forma | A partir de ahí corre el plazo legal |
| Con acta de observaciones | Le toca hacer algo, y hay plazo |
| Concedida / Negada | Hay decisión |
| Desistida | Puede estar esperando una respuesta que ya no llegará |

| NO se comunica | Por qué |
|---|---|
| Presentada | Ya se envió el acuse de recibo; repetirlo entrena a ignorarnos |
| En revisión / En viabilidad | Etapas internas, sin efecto para el ciudadano |
| Notificada | La notificación **es** el acto; un correo podría leerse como ella |
| En firme | Mero transcurso del plazo: no hay hecho nuevo ni nada que hacer |
| Histórico sin resolver | Nunca hubo hito: es la ausencia declarada de uno |

**El texto sale de la misma fuente que la consulta.** Dos redacciones del mismo
hecho divergen, y entonces el ciudadano lee una cosa en el correo y otra en la
pantalla sobre el mismo expediente.

## 5. Lo que este correo NO es

> **No es la notificación del acto administrativo.**

La notificación de una decisión tiene forma legal propia (Ley 1437, arts. 66 y
ss.) y no se agota con un correo informativo. El pie del correo lo dice
expresamente y hay una prueba que lo exige.

Dar por notificado a alguien con un correo automático le quitaría los plazos de
recurso sin que se enterara.

## 6. Lo que este ADR NO decide

- **El canal.** Hoy es correo. WhatsApp y SMS son otra decisión.
- **Qué documentos faltan, en la consulta pública.** Se dice que hay
  observaciones y a dónde acudir: el listado crudo de requisitos incumplidos,
  leído sin contexto, asusta más que orienta.
- **La notificación electrónica formal**, que exige consentimiento previo del
  ciudadano y acuse propio.
