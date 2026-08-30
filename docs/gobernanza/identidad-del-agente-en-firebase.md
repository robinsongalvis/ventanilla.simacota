# Identidad propia del agente en Firebase

- **Fecha:** 30 de agosto de 2026
- **Estado:** DISEÑO. No implementado.
- **Decide:** el propietario
- **Va ANTES de:** el traslado del repositorio a una organización
  (`separacion-de-identidad-agente.md` §2, camino B)
- **Motivo del orden:** aquí se tocan **datos**, no código.

---

## 1. La brecha, y es mayor que la de GitHub

En `.env.local` de esta máquina vive
`firebase-adminsdk-fbsvc@ventanilla-unica-f31b1` — la cuenta de servicio del
**Admin SDK de producción**.

**El Admin SDK NO PASA POR `firestore.rules`.** Ese es el punto entero. Todo el
aislamiento por `tenantId`, el *deny-by-default* de `storage.rules`, las
comprobaciones de rol, la protección de identidades reservadas: **nada de eso le
aplica**. Por diseño de Firebase, el Admin SDK es una llave maestra.

Comprobado hoy con esa credencial, en solo lectura:

```
lee expedientes            sí
lee ventanilla_radicados   sí
lee users                  sí        ← datos personales de funcionarios
lee counters               sí        ← contadores de la serie legal
lee unicidad_radicados     sí        ← reservas de unicidad AGN
```

Leer es lo que hice. **Escribir es igual de posible**, y con el mismo alcance:
esa credencial puede reescribir cualquier expediente, alterar un contador de la
serie legal, o borrar reservas de unicidad — todo lo que los Acuerdos del AGN
obligan a proteger.

### Por qué pesa más que lo de GitHub

| | GitHub | **Firebase** |
|---|---|---|
| Qué se toca | código | **datos de ciudadanos y la serie legal** |
| Hay revisión previa | sí, la PR y CI | **no: es efecto inmediato** |
| Se puede revertir | sí, `git revert` | **un dato sobrescrito no vuelve** |
| Deja traza | commit, PR, despliegue | **el Admin SDK no deja auditoría por operación** |

El propietario lo dijo antes de que yo lo verificara: *«datos pesa más que
código»*. Los números le dan la razón.

### Y lo que ya ocurrió

Con esa credencial y con el CLI —autenticado como `davidgalvis1519@gmail.com`—
el agente en 48 horas:

- leyó expedientes, contadores y usuarios de **producción**;
- **desplegó dos índices de Firestore a producción**;
- leyó, **escribió y sembró** en stage;
- **generó enlaces de restablecimiento de contraseña** en stage (Auth admin).

Todo autorizado, y las lecturas de producción fueron deliberadamente de solo
lectura. **Pero la capacidad era total en todo momento**, y ninguna de esas
operaciones distingue en el registro al agente del propietario.

---

## 2. La regla de reparto

> **El agente LEE producción. El agente ESCRIBE stage. Lo que toca la
> configuración o los datos de producción es del propietario.**

| Operación | Producción | Stage |
|---|---|---|
| Leer Firestore | **agente** ✔ | agente ✔ |
| Escribir Firestore | **propietario** | agente ✔ |
| Leer Storage | **agente** ✔ | agente ✔ |
| Escribir Storage | **propietario** | agente ✔ |
| Desplegar **índices** | **propietario** | agente ✔ |
| Desplegar **reglas** | **propietario** | agente ✔ |
| Auth (usuarios, contraseñas) | **propietario** | agente ✔ |
| IAM y facturación | **propietario** | **propietario** |

**Los índices y las reglas quedan reservados** aunque hoy sean lo que más he
tocado. Un índice mal desplegado degrada consultas; unas reglas mal desplegadas
abren datos. Que el despliegue del índice del 29-ago saliera bien no es un
argumento: salió bien porque se comparó antes y se verificó después, no porque el
permiso fuera adecuado.

---

## 3. Las cuentas y sus roles

Cuatro cuentas de servicio, una por propósito. **Ninguna es Admin SDK salvo la
que la aplicación necesita para funcionar.**

### 3.1 `agente-lectura-prod@ventanilla-unica-f31b1`

| Rol de GCP | Da |
|---|---|
| `roles/datastore.viewer` | leer Firestore. **Sin escritura, en ningún sitio.** |
| `roles/storage.objectViewer` | leer objetos de Storage |
| `roles/firebase.viewer` | ver el estado del proyecto |

Es la que sustituye a la llave maestra en `.env.local`. Con ella se hacen los
diagnósticos —la consulta del vigía, el conteo de expedientes— y **no se puede
escribir aunque se quiera**.

**Sin `firebaseauth.admin`:** el agente no debe poder leer ni tocar cuentas de
funcionarios en producción.

### 3.2 `agente-stage@ventanilla-simacota-stage`

| Rol | Da |
|---|---|
| `roles/datastore.user` | leer y escribir Firestore |
| `roles/storage.objectAdmin` | leer y escribir Storage |
| `roles/firebaseauth.admin` | administrar cuentas de prueba |
| `roles/datastore.indexAdmin` | desplegar índices |

Stage existe para esto. Aquí el agente trabaja sin pedir permiso, y por eso stage
tiene que ser **de verdad** stage: la guarda anti-producción que ya llevan los
guiones de `scripts/laboratorio/` es parte de este diseño, no un extra.

### 3.3 La que usa la aplicación en producción — **no cambia, pero se muda**

La app necesita el Admin SDK para funcionar: escribe expedientes, emite números,
reserva unicidad. **Eso no se puede recortar sin romper el producto.**

Lo que sí cambia es **dónde vive**:

> **La llave maestra de producción sale de esta máquina.** Vive solo en las
> variables de entorno de Vercel, y en ningún portátil.

Es la recomendación más importante del documento, y la más barata.

### 3.4 La cuenta del propietario

Sigue siendo la de los despliegues de índices y reglas, IAM y Auth. **Con una
condición nueva:** el agente prepara el cambio, lo compara y lo documenta; el
propietario ejecuta. Igual que con los merges.

---

## 4. Consecuencias operativas

**Se rota la clave actual.** Ha estado en un portátil; una vez fuera, la que
estuvo expuesta se revoca y se emite otra directamente en Vercel. Sin rotación,
sacarla de la máquina no sirve de nada: la copia ya salió.

**El diagnóstico sigue funcionando.** Todo lo que hice de lectura en producción
—la consulta del vigía, el conteo bloqueado, el sondeo del semáforo— se hace
igual con `agente-lectura-prod`.

**Los índices pasan a ser una propuesta, no un acto.** Yo comparo lo desplegado
contra `firestore.indexes.json`, dejo el `--dry-run` corriendo y el comando
listo; usted lo ejecuta. Es exactamente lo que hicimos el 29-ago, **menos el
último paso**.

**Stage se vuelve más importante.** Si el agente no escribe en producción, todo
lo que necesite escritura se ensaya en stage — lo cual es donde debía ensayarse
desde siempre.

---

## 5. La comprobación, obligatoria

Igual que con la GitHub App, y por el mismo motivo:

> **Con `agente-lectura-prod` configurada, el agente intenta escribir en
> producción y DEBE FALLAR.** Y intenta desplegar un índice, y **debe fallar**.

Un control que no se ha visto fallar no está probado (§4.6-ter). Dos intentos, dos
rechazos, y se anota el mensaje exacto de cada uno.

---

## 6. Lo que este diseño NO resuelve

**Quien lea las variables de Vercel tiene la llave maestra.** Sacarla del portátil
reduce la superficie a una; no la elimina. Cerrar eso pide control de acceso en
Vercel, y es otra conversación.

**El Admin SDK sigue sin auditoría por operación.** Firebase no registra qué
documento escribió cada credencial. Si eso llega a hacer falta —y para actos
administrativos probablemente sí— se resuelve con auditoría *en la aplicación*,
que ya existe parcialmente (`Actuacion` captura actor y fecha en servidor), no
con permisos.

**Las copias de seguridad.** El respaldo corre con su propia identidad en
Actions. Fuera de alcance aquí, pero conviene revisarla con el mismo criterio.

---

## 7. Orden propuesto

1. **Sacar la llave maestra del portátil** y rotarla. Es una tarde y cierra lo
   más grave.
2. Crear `agente-lectura-prod` y ponerla en `.env.local`.
3. Crear `agente-stage` y ponerla en `.env.stage`.
4. **Las dos comprobaciones de fallo** (§5).
5. Después, la GitHub App y el camino A de la protección de rama.
6. Y por último el traslado a una organización.

**El 1 no depende de nada y se puede hacer hoy.** Los demás pueden esperar a que
haya calma.
