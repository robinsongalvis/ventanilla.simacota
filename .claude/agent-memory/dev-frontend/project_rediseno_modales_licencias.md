---
name: rediseno-modales-licencias
description: PR #303 — rediseño visual de RadicarSolicitudModal/CrearDesdeRadicadoModal según mockup de Figma; tokens del módulo en licencias-tema.css; base corregida a main tras hallar #293 ya fusionada
metadata:
  type: project
---

31-ago-2026: encargo de Robinson para rediseñar (SOLO presentación) los
modales «Recibir solicitud» y «Crear expediente desde radicado» de
Licencias, según mockup aprobado en Figma. Entregado como PR #303
(`feat/rediseno-modales-licencias` → `main`).

**Verificar la base ANTES de empezar, no confiar en el encargo a ciegas.**
La instrucción decía apilar sobre `fix/subtipos-sin-codigos-internos` (PR
#293, «recién abierta»). Al arrancar, `git merge-base --is-ancestor` mostró
que la #293 **ya estaba fusionada a `main`** (commit `564cacb`, junto con
`docs/adr/0039-gobierno-de-las-pruebas-custodias.md`) y que la rama fuente
había quedado obsoleta (le habían añadido un merge posterior que no era
ancestro de `main`). El encargo tenía razón cuando se escribió; la realidad
se movió mientras tanto. Reapunté la rama con `git stash` → `git reset
--hard origin/main` → `git stash pop` (sin conflictos, cero solapamiento
con los archivos que cambiaron entre una base y otra) y lo declaré en el
cuerpo de la PR. Lección: con tareas que dan una rama base explícita, un
`git merge-base --is-ancestor <esa-rama> origin/main` de 5 segundos antes de
tocar código evita apilar sobre algo que ya no existe como tal.

**Tokens del módulo, no globales.** `app/interno/licencias/components/
licencias-tema.css` define `.tema-licencias` con las variables que fija el
mockup (`--verde-institucional: #14452F`, etc.) — deliberadamente distintas
de `app/globals.css` (verde global `#14532D`). Se aplica la clase en el
`<div role="dialog">` raíz de cada modal; como las custom properties CSS
heredan por el árbol del DOM, no hace falta repetirla en
`SelectorSubtiposNormativos` (aunque se dejó también ahí, por si algún día
se usa fuera de estos dos modales).

**El chip reemplaza el legend, pero el legend sigue siendo hijo directo del
fieldset.** Para que "Subtipos (figuras normativas)" + chip "Selecciona al
menos una" queden en la misma línea sin romper el nombre accesible del
grupo, el chip se posiciona con `absolute` sobre un `fieldset relative`, NO
anidado dentro del `<legend>` — anidarlo habría inflado el nombre accesible
del fieldset con el texto del chip.

**Grid de 2 columnas + `col-span-2` en la 7.ª figura resuelve solo el layout
pedido.** Las 7 figuras de tipo LICENCIA en grid de 2 columnas dejan a
ESPACIO_PUBLICO (7.ª, impar) sola en su fila — coincide exactamente con que
el mockup pide esa figura a ancho completo. No hace falta lógica especial
de layout más allá de `col-span-2` condicional por código.

Ver también [[feedback_preview_worktree_distinto]] (por qué las capturas se
hicieron con `prettyDOM` en vez de screenshots reales) y
[[feedback_limites_de_rol]] (ampliación de alcance del coordinador a mitad
de tarea — el custodio del banner R10 fue una ampliación legítima, no una
tarea de otro rol, así que sí se ejecutó).

**ADR-0039 (nuevo, 31-ago-2026)** — «Gobierno de las pruebas custodias»:
formaliza que todo custodio nuevo necesita su mutación realista vista en
rojo antes de darse por bueno (§2), y que buscar un custodio existente exige
grepear también las CONSULTAS de RTL, no solo literales (§4). Vigente para
cualquier custodio de presentación que se añada de aquí en adelante.
