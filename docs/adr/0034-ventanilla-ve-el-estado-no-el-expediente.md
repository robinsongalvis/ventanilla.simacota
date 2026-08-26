# ADR-0034 — Ventanilla ve el estado del trámite, no el expediente jurídico

- **Estado:** ACEPTADO
- **Fecha:** 26-ago-2026
- **Decide:** el propietario, con Planeación
- **Relacionado:** ADR-0033 (estado previo a la debida forma), ADR-0007 (aislamiento por tenant)

---

## 1. Contexto

En la Administración Municipal **todo entra por ventanilla**. No hay trámites de
Planeación por un lado y trámites de la Alcaldía por otro: es una sola entrada y
un solo libro, y por eso las licencias consumen la serie `1-110-`.

Pero el expediente de licencias vive en `expedientes`, una colección cerrada a
todo cliente y visible únicamente desde el módulo de Planeación. La persona de
ventanilla no ve nada de él. El ciudadano entra por la puerta, lo primero que
encuentra es ventanilla, pregunta ahí — y la respuesta es *«suba a Planeación»*,
que es exactamente lo que la Ventanilla Única vino a eliminar.

## 2. Decisión

> **Ventanilla ve el ESTADO DEL TRÁMITE. No ve el expediente jurídico.**

Se expone una **proyección reducida**, de **solo lectura**, con los cuatro datos
que la funcionaria necesita para responderle al ciudadano sin levantarse:

| Dato | Campo |
|---|---|
| En qué va | `estadoJuridico`, con su etiqueta legible |
| Desde cuándo corre el plazo | `fechaRadicacionDebidaForma` |
| Cuándo vence | `fechaAlertaConservadora` |
| Qué documentos faltan | `completitud.faltantes` |

Los cuatro ya están **persistidos en el documento raíz del expediente**. La
proyección los lee; no calcula nada nuevo ni trae la subcolección.

## 3. Qué queda FUERA, explícitamente

Esta lista es el objeto de la decisión, no un detalle de implementación. Está
escrita para que dentro de seis meses nadie amplíe la proyección «de paso»
porque le pareció útil:

- **Las actuaciones.** La serie de hechos del expediente —quién hizo qué y
  cuándo— es el trabajo de Planeación, no información de mostrador.
- **Los documentos.** Ni la lista, ni los metadatos, ni las descargas.
  Ventanilla puede decir *qué falta*; no puede ver *qué se aportó*.
- **Las actas de observaciones.** Su contenido es un acto administrativo
  dirigido al ciudadano por conducto de Planeación, y su redacción es
  deliberación técnica hasta que se expide.
- **Toda deliberación interna de Planeación**: notas, conceptos, borradores,
  motivaciones, cualquier campo que refleje criterio profesional en formación.
- **Cualquier capacidad de escritura.** Ventanilla no cambia estados, no carga
  documentos, no registra actuaciones, no radica. **Ventanilla informa;
  Planeación decide.**

**Regla de ampliación:** añadir un campo a esta proyección exige modificar
*este* ADR. Un campo que resulte útil no es motivo suficiente: la utilidad fue
siempre el argumento con el que las proyecciones crecen hasta dejar de ser
proyecciones.

## 4. Cómo se dice lo que todavía no ha pasado

Mientras el acto de radicar no esté cableado —o simplemente mientras un
expediente concreto siga en `PRESENTADA`— `fechaRadicacionDebidaForma` estará
vacía. La pantalla **no muestra un guion ni un espacio en blanco**: muestra, con
esas palabras,

> **El plazo aún no ha empezado a correr.**

La funcionaria tiene que poder leérselo al ciudadano tal cual. Un guion la
obliga a interpretar, y lo que interprete será suyo, no del sistema. Es la misma
doctrina del ADR-0033: no afirmar un hecho que no ocurrió, y tampoco callarlo.

## 5. Seguridad

El permiso de servidor **ya existe**: `canOperateTenant` admite `RECEPCIONISTA`
sobre cualquier dependencia, y es el mismo que exigen las rutas del detalle de
licencias. La exclusión actual es de **interfaz**, no de autorización.

Eso es precisamente lo que obliga a lo siguiente: **los casos de aislamiento por
tenant sobre `expedientes` entran en el MISMO PR que la proyección**, no
después. Hoy la matriz de `e2e/rules/matriz-aislamiento-tenant.test.mjs` tiene
**cero** casos sobre esa colección — está verde por ausencia, que es la misma
familia de todo lo que se ha corregido esta semana. El endpoint nuevo no nace
sin ellos.

## 6. Consecuencias

- La funcionaria de ventanilla responde las cuatro preguntas del ciudadano sin
  levantarse. El caso que motiva todo el módulo deja de terminar en *«suba a
  Planeación»*.
- La proyección es de solo lectura por construcción, no por convención: el
  endpoint no expone ninguna operación de escritura.
- Se acepta un costo: ventanilla no podrá responder *por qué* un documento se
  rechazó ni *qué dice* un acta. Es deliberado — esas preguntas son de
  Planeación, y contestarlas mal desde el mostrador es peor que remitirlas.

## 7. Lo que este ADR NO decide

- **Si el ciudadano puede consultar su licencia por sí mismo.** Hoy `/consulta`
  resuelve radicados de ventanilla, no expedientes. Ampliarla exige un
  vocabulario ciudadano para los estados jurídicos y un segundo factor propio;
  es otra decisión y otro ADR.
- **Si la licencia aparece como una fila más en el libro de ventanilla.** Esta
  proyección se lee desde el detalle del radicado ya vinculado. Que el
  expediente figure en el listado es una decisión distinta, con efectos sobre
  los indicadores de cumplimiento.
