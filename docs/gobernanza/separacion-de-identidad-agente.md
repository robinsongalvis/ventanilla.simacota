# Separar la identidad del agente de la del propietario

- **Fecha:** 30 de agosto de 2026
- **Estado:** DISEÑO. No implementado. Se ejecuta cuando el propietario lo revise.
- **Decide:** el propietario
- **Origen:** el propietario preguntó quién había hecho cuatro merges a producción.
  La traza no podía contestarlo.

---

## 1. La brecha, verificada

Los cuatro merges de la madrugada del 30-ago figuran en GitHub como hechos por
`robinsongalvis`. **Los cuatro fueron órdenes suyas** —«subelos», «mergea el 277
y el 278», «mergea el 279»— y la traza lo confirma en los tiempos. No hubo
ninguna acción no autorizada.

**El problema no es lo que pasó: es que el registro no puede distinguirlo.**

```
gh auth status → Logged in to github.com account robinsongalvis
                 Token scopes: gist, read:org, repo, workflow
```

El `repo` incluye permiso de merge. Todo lo que el agente ejecuta queda firmado
con la cuenta del propietario, y para el registro **no hay diferencia entre lo
que él teclea y lo que el agente ejecuta**.

En un sistema que produce actos administrativos —y que aspira a ser auditado por
Control Interno y por la Contraloría— eso no aguanta una auditoría: la pregunta
«¿quién autorizó este cambio en producción?» no tiene respuesta comprobable.

**Y la regla existe, pero es una promesa.** El estado actual de la protección de
`main`:

| Control | Hoy |
|---|---|
| Revisiones aprobatorias exigidas | **0** |
| Se aplica a administradores (`enforce_admins`) | **NO** |
| Restricción de quién puede empujar | **ninguna** |
| Checks obligatorios | 3, estrictos ✔ |
| Force-push / borrado de rama | bloqueados ✔ |

Nada impide técnicamente que el agente mergee. Lo único que lo impide es que no
lo haga.

---

## 2. El obstáculo que cambia el diseño

La solución natural sería la **lista de quién puede empujar** a `main`: se nombra
al propietario, y punto. Con eso «producción la abro yo» dejaría de ser promesa.

**No está disponible en este repositorio.** La restricción de push de la
protección de ramas clásica existe **solo en repositorios de una organización**, y
este es de un **usuario** (`owner.type: "User"`, público).

Eso deja dos caminos, y no son equivalentes.

### Camino A — sin mover el repositorio

**Exigir una revisión aprobatoria.** El agente abre la PR; **no puede aprobar su
propia PR** (GitHub lo impide), así que el propietario tiene que aprobarla antes
de que sea mergeable.

- ✅ Es una restricción técnica, no una promesa.
- ✅ Se activa hoy, en dos clics, sin mover nada.
- ⚠️ **No es exactamente la regla:** una vez aprobada, el agente *podría* pulsar
  el merge. El gate es la aprobación, no el botón.
- Se acompaña de `enforce_admins: true`, para que los poderes de administrador no
  la salten en silencio.

### Camino B — mover el repositorio a una organización

Crear una organización de GitHub (gratis) y trasladar el repositorio. Entonces sí
existe la lista de push, y **el merge a `main` queda físicamente reservado** a la
cuenta del propietario.

- ✅ Es exactamente la regla: el agente no puede mergear aunque quisiera.
- ✅ Y aporta algo más: una organización es el sitio natural de un repositorio
  institucional. Hoy el código de la Alcaldía cuelga de una cuenta personal.
- ⚠️ Cambia la URL del repositorio; hay que reconectar Vercel y revisar los
  secretos de Actions.
- ⚠️ Trabajo de una tarde, no de cinco minutos.

**Recomendación:** **A ahora, B cuando haya calma.** A cierra la brecha hoy con
dos clics; B la cierra del todo y además saca el proyecto de una cuenta personal,
que es una conversación que este proyecto va a tener igual el día que se
institucionalice.

---

## 3. La identidad del agente: GitHub App, no cuenta bot

| | Cuenta bot | **GitHub App** |
|---|---|---|
| Identidad en la traza | usuario aparte | **actor propio**, aparece como `app/nombre` |
| Credenciales | contraseña + 2FA que alguien custodia | token de instalación, rotado solo |
| Permisos | los de un colaborador: gruesos | **finos, por recurso** |
| Coste de asiento | ocupa uno en la organización | **ninguno** |
| Revocar | borrar la cuenta | desinstalar la App |

**GitHub App.** No hay contraseña que custodiar ni 2FA que administrar, y los
permisos se recortan al hueso.

### Permisos exactos

| Recurso | Nivel | Para qué |
|---|---|---|
| **Contents** | Lectura y escritura | crear ramas y empujar commits |
| **Pull requests** | Lectura y escritura | abrir PR, comentar, actualizar |
| **Metadata** | Lectura | obligatorio siempre |
| **Actions** | Lectura | consultar el estado de CI |
| **Checks** | Lectura | leer el veredicto de las compuertas |
| **Administration** | **NINGUNO** | que no pueda tocar la protección de rama |
| **Issues** | Lectura y escritura *(opcional)* | anotar riesgos, cerrar la del respaldo |

**`Contents: write` es la que incomoda**, porque es la misma que permite mergear
una PR. Por eso el candado no puede vivir en el permiso de la App: vive en la
protección de la rama (§2). La App puede escribir en ramas; `main` está protegida
para todos.

---

## 4. Lo que NO resuelve, y hay que decirlo

Separar la identidad de GitHub **no separa las otras dos**, y en este proyecto
las otras dos tocan producción de verdad:

**Firebase.** El CLI de esta máquina está autenticado como
`davidgalvis1519@gmail.com`. El despliegue del índice de Firestore del 29-ago
—una operación sobre la infraestructura de datos de producción— quedó firmado
como el propietario. Separarlo pide una **cuenta de servicio propia** con roles
recortados, y es un diseño aparte.

**Vercel.** Despliega por push a `main`. Si el merge queda cerrado (§2), el
despliegue queda cerrado con él: se resuelve solo.

**Y el autor de los commits.** Hoy todos dicen:

```
Author: Robinson David Galvis <davidgalvis1519@gmail.com>
```

Aunque la App firme las operaciones de la API, **la línea de autoría del commit
seguiría diciendo el nombre del propietario**. Es la traza que un auditor mira
primero.

Propuesta: los commits que produce el agente llevan **autor la App** y conservan
el `Co-Authored-By: Claude`. La dirección del trabajo —que es del propietario—
consta en la PR, que es donde consta la orden. Un commit no es una firma de
autoridad; la PR aprobada sí.

---

## 5. Qué cambia en mi flujo de trabajo

**Lo que sigue igual:** leer el repositorio, crear ramas, escribir código,
empujar, abrir PR, esperar CI, leer los resultados, iterar. Es la mayor parte.

**Lo que cambia:** cuando usted diga «mergea el X», **no voy a poder**. Le
responderé con el estado de CI y el enlace o el comando, y lo pulsa usted.

**Y le cuesta algo, que no le voy a esconder:** las cadenas de anoche —arreglar,
probar, mergear, verificar el despliegue, seguir— dejarán de ser continuas. Cada
merge pasará por usted. En noches como la de ayer eso son varias esperas.

**Mi opinión, y va con interés propio en contra:** vale la pena igual. La
continuidad que se pierde es comodidad mía; lo que se gana es que la frase «esto
lo autorizó el propietario» se pueda demostrar en vez de recordar. Para un
sistema que emite licencias de construcción, eso no es opcional.

**Lo que también gano yo:** dejo de poder equivocarme en producción. Ayer no pasó
nada; pero la única razón de que no pasara es que no me equivoqué.

---

## 6. Pasos, cuando lo autorice

**Camino A — hoy, dos clics del propietario**

1. `Settings → Branches → main`: exigir **1 revisión aprobatoria**.
2. Marcar **`enforce_admins`** para que los poderes de administrador no la salten.
3. Crear la GitHub App con los permisos del §3 e instalarla en el repositorio.
4. Reconfigurar el `gh` de esta máquina para actuar con el token de la App.
5. Ajustar el autor de los commits del agente (§4).

**Camino B — cuando haya calma**

6. Crear la organización y trasladar el repositorio.
7. Reconectar Vercel y revisar los secretos de Actions.
8. Añadir la restricción de push a `main` nombrando solo al propietario.

**Comprobación de que funciona, y no se da por buena sin ella:** con la App
instalada, el agente intenta mergear una PR de prueba y **debe fallar**. Un
control que no se ha visto fallar no está probado — es la regla §4.6-ter de la
casa, aplicada a la gobernanza.

---

## 7. Lo que este diseño no decide

- **Si se mueve el repositorio a una organización.** Es del propietario, y tiene
  consecuencias más allá de esto.
- **La separación de Firebase.** Diseño aparte, y más urgente de lo que parece:
  ahí se tocan datos, no solo código.
- **Si el agente conserva permiso de Issues.** Útil para anotar riesgos; también
  es escritura. Se decide con el resto.
