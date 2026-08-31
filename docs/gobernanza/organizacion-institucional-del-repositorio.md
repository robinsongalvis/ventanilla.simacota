# El repositorio deja de colgar de una cuenta personal

- **Fecha:** 30 de agosto de 2026
- **Estado:** DISEÑO. No implementado.
- **Decide:** el propietario, y en parte la Alcaldía
- **Va DESPUÉS de:** `identidad-del-agente-en-firebase.md` — datos antes que código
- **Relacionado:** `separacion-de-identidad-agente.md` (camino B)

---

## 1. Dónde está hoy, y por qué importa

```
owner.type: "User"   ·   robinsongalvis   ·   público
```

El código de la Ventanilla Única Digital de la Alcaldía de Simacota —el que emite
radicados de la serie legal, guarda expedientes de licencias y produce actos
administrativos— **cuelga de una cuenta personal de GitHub**.

No es un problema de hoy. Es un problema del día que alguien pregunte:

- **¿De quién es este software?** Un contrato de desarrollo no transfiere la
  cuenta personal de nadie. Si el repositorio está en su cuenta, la Alcaldía
  depende de usted para tener su propio código.
- **¿Qué pasa si usted no está?** Vacaciones, un cambio de contrato, un
  accidente. Hoy no hay nadie más con acceso administrativo.
- **¿Cómo se audita?** Control Interno pide trazabilidad institucional. «Está en
  la cuenta de GitHub del contratista» no es una respuesta que aguante.

Y hay una consecuencia técnica ya verificada: **la restricción de quién puede
empujar a una rama solo existe en repositorios de organización**. Mientras el
repositorio sea personal, «producción la abro yo» no puede pasar de promesa a
candado.

---

## 2. Qué organización

### La recomendación: una organización de la Alcaldía, no suya

| Opción | Qué resuelve | Qué deja abierto |
|---|---|---|
| **A ·** Organización personal suya (`rdg-software`) | la restricción de push, y separa lo profesional de lo personal | **el software sigue siendo suyo ante la Alcaldía** |
| **B ·** Organización de la Alcaldía (`alcaldia-simacota`) | todo lo anterior **+ la titularidad institucional** | pide un interlocutor en la Alcaldía que la cree |

**B.** A es un paso a medias que habría que volver a dar.

**Nombre sugerido:** `alcaldia-simacota` o `simacota-santander` — el que la
Alcaldía use para su presencia digital. Conviene que coincida con el dominio
institucional (`simacota-santander.gov.co`) para que sea reconocible.

**Plan:** el gratuito basta. Repositorios públicos ilimitados, Actions incluidas,
y **la restricción de push funciona en repositorios públicos de organización**.

---

## 3. Quién es dueño, y cómo queda cada rol

Esta es la parte que no es técnica.

| Rol | Quién | Puede |
|---|---|---|
| **Propietario de la organización** | La Alcaldía — el Secretario de Planeación o quien designe | crear y borrar repositorios, administrar miembros, transferir |
| **Propietario adicional** | Usted | lo mismo. **Dos, nunca uno** |
| **Administrador del repositorio** | Usted | protección de ramas, secretos, integraciones. **El merge a `main`** |
| **Miembro con escritura** | Andrés y quien colabore | ramas y PRs |
| **GitHub App del agente** | — | ramas y PRs. **Sin merge, sin administración** |

**Dos propietarios y no uno**, en las dos direcciones: si la Alcaldía es el único
dueño, un cambio de administración puede dejar el proyecto sin quien lo
administre técnicamente; si usted es el único, seguimos donde estamos.

**Su rol no se reduce: se hace explícito.** Hoy usted puede todo porque el
repositorio es suyo. Mañana podrá lo mismo porque tiene un rol asignado — y eso se
puede enseñar en una auditoría, y sobrevive a que usted no esté.

### La conversación que hay que tener

La Alcaldía tiene que **querer** ser dueña. Eso significa alguien que reciba las
credenciales de propietario y entienda qué significan. Si hoy no hay ese
interlocutor, la opción honesta es **A como paso intermedio, con B declarada como
destino** — y no dejarlo en A para siempre.

---

## 4. Qué se reconecta

El traslado cambia la URL: `github.com/robinsongalvis/…` →
`github.com/alcaldia-simacota/…`. GitHub redirige lo viejo, pero **no todo se
apoya en el redirect**.

| Qué | Cómo queda | Riesgo |
|---|---|---|
| **Vercel** | reconectar el repositorio en el proyecto existente | **el mayor**: mal hecho, se crea un proyecto nuevo y con él **un dominio y unas variables de entorno nuevas** |
| **Secretos de Actions** | se van con el repositorio ✔ | verificar `CRON_SECRET`, el WIF de los respaldos y la credencial de Firebase |
| **Identidad WIF de los respaldos** | apunta al repositorio por su ruta | **hay que actualizar la condición del proveedor**, o los respaldos dejan de autenticarse |
| **Protección de `main`** | se conserva, y **gana la restricción de push** | ✔ el objetivo |
| **PR e issues abiertas** | se trasladan ✔ | ninguno |
| **Remotos locales** | `git remote set-url` en cada copia y worktree | menor |
| **Enlaces en documentos** | los ADR y este documento citan URLs | menor; el redirect los cubre |

**El orden importa:** primero se anota qué hay conectado, luego se traslada, y
después se verifica **uno por uno**. El respaldo de adjuntos es el que más
silenciosamente puede romperse — y esta semana ya demostró que puede fallar
durante días sin que nadie lo note.

---

## 5. Comprobaciones, y ninguna se da por buena sin verla

1. **Vercel despliega** desde la URL nueva, al **mismo** dominio de producción.
2. **El respaldo de Firestore** corre y termina en verde.
3. **El respaldo de adjuntos** corre y termina en verde — el WIF es el que más
   probablemente se rompa.
4. Los **cinco crones** se disparan y dejan su rastro.
5. **La restricción de push funciona:** una cuenta que no sea la del propietario
   intenta mergear a `main` y **debe fallar**.

La 5 es la razón de todo el traslado. Sin verla fallar, no está probada.

---

## 6. Lo que este diseño NO decide

- **Quién de la Alcaldía es propietario.** Es una decisión institucional, no
  técnica, y probablemente la conversación más lenta de las tres.
- **Si el repositorio sigue siendo público.** Hoy lo es. Un repositorio público de
  una entidad territorial es defendible —transparencia, reutilización por otros
  municipios, que es literalmente la visión del proyecto— pero merece decidirse a
  propósito y no por inercia.
- **Qué pasa con las cuentas de los colaboradores** cuando termine su vínculo.

---

## 7. Orden dentro del plan de gobernanza

```
1. Firebase: sacar la llave maestra del portátil y rotarla   ← se puede hoy
2. Firebase: cuentas del agente y sus dos comprobaciones
3. GitHub App + camino A (revisión aprobatoria obligatoria)
4. Organización: la conversación con la Alcaldía
5. Organización: traslado, reconexión y las cinco comprobaciones
6. Restricción de push — la regla se vuelve candado
```

**Lo primero cierra lo más grave y no depende de nadie más.** Lo último depende de
una conversación institucional que puede tardar, y por eso no debe bloquear al
resto.
