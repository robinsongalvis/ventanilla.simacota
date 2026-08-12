# Reporte E2E — Módulo de Licencias en STAGE (2.ª y 3.ª pasada)

**Fecha:** 12-ago-2026
**Entorno:** stage exclusivamente (`ventanilla-stage`). **Producción NO se tocó** — ni lectura ni escritura.
**Lote de datos:** `E2E-LICENCIAS` (8 expedientes sintéticos, ids `e2e-lic-*`, números `…-9001`…`…-9008`).
**Repetible:** `node scripts/laboratorio/sembrar-licencias-stage.mjs [--limpiar]`

---

## 1. Los tres hallazgos: cerrados

### Hallazgo 1 — Un expediente resuelto se leía como incumplimiento ✅

**Antes:** el expediente EN FIRME mostraba «Vencido hace 88 días hábiles». El plazo de
los 45 días hábiles dejó de correr cuando la Administración decidió; medirlo contra
"hoy" convertía el simple paso del tiempo en un incumplimiento inexistente.

**Corrección — lógica, no maquillaje** (era la instrucción explícita):

| Pieza | Cambio |
|---|---|
| `lib/motor-expedientes/estados-licencia.ts` | `ESTADOS_RESUELTOS_LICENCIA` + `terminoResolucionSigueCorriendo()`, fuente única (antes había una constante duplicada dentro de `BandejaLicenciasClient`) |
| `presentacion-libro-consecutivo.ts` | `urgenciaFilaLibro` y `textoDiasVencimientoLibro` reciben el estado jurídico y devuelven banda NEUTRO / texto `null` |
| `PanelTerminoDual.tsx` | Bloque gris «Término ya cerrado» **sin** `role="alert"`, mutuamente excluyente con la alerta roja |

**Verificado en la aplicación real (stage):**

| Expediente | Estado | Columna «Vence» | Franja | `role="alert"` |
|---|---|---|---|---|
| 9004 | En firme | `11/09/2026` (sin conteo) | gris | **0** ✔ |
| 9003 | Con acta (en trámite) | `06/08/2026` · Vencido hace 3 días hábiles | roja | 1 ✔ |
| 9001 | En revisión | 16 días hábiles | verde | 0 ✔ |
| 9002 | En revisión | 2 días hábiles | ámbar | 0 ✔ |

El dato **no se ocultó**: el panel del 9004 conserva la fecha y la explica —
«El expediente ya fue resuelto — el plazo para decidir dejó de correr con la
decisión. Esta fecha queda solo como referencia de cuándo vencía.»

**Regresión:** bloque `urgenciaFilaLibro — expediente YA RESUELTO no está en mora`
(5 estados resueltos + `HISTORICO_SIN_RESOLVER` + los 4 en trámite + exclusión del filtro).

### Hallazgo 2 — Responsive móvil ✅

**Diagnóstico real (el `min-w-0` de la 1.ª pasada apuntaba un nivel por debajo del culpable):**
el contenedor de página `p-4 … max-w-[1400px] mx-auto` es hijo flex con `min-width: auto`,
así que se dimensionaba por su contenido y la tabla lo estiraba a **1070 px**. Efecto doble:
en 375 px se cortaban subtítulo, aviso y buscador, y el `overflow-x-auto` de la tabla quedaba
**muerto** (`clientWidth === scrollWidth`) — el contenedor crecía en vez de que la tabla se
desplazara.

**Corrección:** `w-full min-w-0` en el contenedor de página (`LibroConsecutivoClient.tsx`).

| Medición | Antes | Después |
|---|---|---|
| Contenedor de página @375 px | 1070 px | **375 px** |
| Elementos fuera de pantalla (excluida la tabla) | 6+ | **0** |
| Columnas de la tabla | 8 | **8** (ninguna sacrificada) |
| Desplazamiento lateral de la tabla | no funcionaba | **695 px dentro de su scroll** |

**Escritorio no se degradó** — verificado en dos anchos:

| Viewport | Contenedor | Tabla | Fuera de pantalla |
|---|---|---|---|
| 1440 px | 1190 px (ancho disponible) | cabe sin barra lateral | 0 |
| 1800 px | **1400 px** (clampado), márgenes 75/75 (sigue centrado) | cabe | 0 |

Bandeja y detalle verificados también a 375 px: contenedor 375, cero desbordes.

### Hallazgo 3 — Aviso obsoleto ✅

Reescrito y verificado en pantalla: ahora dice que los históricos 2022–2026 se migraron
el **11-ago-2026** como *Histórico sin resolver*, que conservan lo que decía el libro pero
les falta cédula y estado, y remite al filtro «Históricos incompletos».

---

## 2. Defecto que introduje al corregir el hallazgo 1 — detectado y cerrado

Al pasar el expediente resuelto a banda NEUTRO, la fecha quedó pintada con
`--color-border`, que es un token de **filete de 4 px**. Medido en la aplicación real:
**1.33:1** sobre blanco — la funcionaria no podía leer la fecha. «No es incumplimiento»
no puede degenerar en «no se ve».

**Corrección:** `COLOR_TEXTO_URGENCIA_LIBRO` separado de `COLOR_URGENCIA_LIBRO`
(deriva del primero y solo redefine `NEUTRO` → `--text-secondary`). **1.33 → 4.97:1**, cumple
WCAG AA. Tres pruebas de regresión añadidas.

---

## 3. Hallazgos NUEVOS de esta pasada — requieren su decisión

### N-1 · ALTA — Imprimir el libro recorta las tres últimas columnas

La tabla vive dentro de `overflow-x-auto` sobre una tarjeta `overflow-hidden`, y **ninguna
regla `@media print`** les devuelve `overflow: visible` (verificado enumerando las 4 reglas
`@media print` cargadas). En papel no hay desplazamiento lateral: lo que excede el ancho
se pierde.

Simulando el ancho útil de A4 vertical (190 mm ≈ 718 px):

| Se imprime | **Se pierde** |
|---|---|
| N.° expediente, Fecha radicación, Solicitante, Tipo, Estado | **Vence, Vigencia hasta, N.° licencia** |

Se pierde el **número de licencia** — el dato más importante de un libro consecutivo, en la
pantalla que tiene botón «Imprimir» y que por diseño *reemplaza el Excel de Planeación*.

No lo corregí porque la solución obliga a una decisión de producto sobre un documento
oficial: (a) `@page { size: landscape }` para esta pantalla, (b) `print:overflow-visible` +
reducción de tipografía, o (c) imprimir un subconjunto de columnas declarado. **Dígame cuál
y lo implemento.**

### N-2 · MEDIA — El libro no muestra las colisiones de radicado

El importador marca `numeroExpediente.colision: true` (DF-9, R1) y el propio análisis
documenta el caso real `68745-0-25-0037` (dos solicitantes, mismo radicado). Pero
`FilaLibroConsecutivo` no expone el campo y la tabla no lo pinta: el expediente sembrado
con `colision: true` se ve idéntico a los demás.

Un número consecutivo duplicado es exactamente la anomalía que un libro debe exponer, y
**ese duplicado ya está en producción** desde la migración del 11-ago. Hoy es invisible.

### N-3 · MEDIA (preexistente) — Contraste insuficiente en las bandas ámbar y verde

La medición del punto 2 destapó que el problema no era solo de NEUTRO:

| Banda | Contraste sobre blanco | WCAG AA (4.5:1) |
|---|---|---|
| Vencido (rojo) | 4.83:1 | ✔ |
| **Por vencer (ámbar)** | **2.15:1** | ✘ |
| **En término (verde)** | **3.30:1** | ✘ |
| Resuelto (gris, ya corregido) | 4.97:1 | ✔ |

Es preexistente y no lo toqué: arreglarlo bien exige variantes de texto de los tokens
semánticos (`--color-warning-text`, `--color-success-text`) que afectan a toda la aplicación,
y usted pidió explícitamente no crear estilos paralelos. Lo más grave es el ámbar: es
precisamente la alerta de «quedan 2 días hábiles».

---

## 4. Recorrido E2E completo — resultados

| Paso | Resultado |
|---|---|
| Login autenticado | ✔ `planeacion.lab@simacota.gov.co` en stage |
| Bandeja | ✔ sin desbordes a 375 px |
| Libro consecutivo | ✔ KPIs correctos (Total 5 / En trámite 4 — el EN FIRME queda fuera) |
| Búsqueda | ✔ por nombre, número parcial, matrícula y cédula; estado vacío con «Limpiar búsqueda»; al limpiar vuelven los 5 |
| Detalle | ✔ panel con solicitante, contexto, historial y proyección |
| Términos | ✔ resuelto → gris sin alerta; en trámite → alerta roja. Mutuamente excluyentes |
| Vigencia | ✔ 9004: «Vence el 15/03/2027 · 12 meses desde la firmeza · No admite prórroga» |
| Históricos (2025) | ✔ los 3 con «Vence» en «—» (R9: no generan reloj legal); subtipo en cuarentena como «? LCR VISR»; filtro «Históricos incompletos» 3/3 con «SIN CÉDULA» |
| Impresión | ✘ **ver N-1** |
| Responsive | ✔ 375 px y escritorio (1440/1800) |

### Observación sobre los datos sembrados (no es defecto)

En el 9003 el libro dice `06/08/2026` y el panel calcula `12/08/2026`. Es artefacto del
sembrado: el script escribe `fechaAlertaConservadora` directamente, sin pasar por el motor,
mientras el panel la deriva del ancla de radicación. En producción el espejo lo escribe
`derivarEventosTermino` en la misma transacción que la actuación, y existe prueba
anti-divergencia. Lo dejo anotado para que no se lea como bug.

---

## 5. Estado de la suite (`TZ=UTC`, obligatorio: local es Bogotá, CI es UTC)

**Resultado efectivo: 2049/2049.**

La suite destapó **un fallo real mío**: al reescribir el aviso (hallazgo 3) dejé
`libro-consecutivo-render.test.tsx:293` asertando el texto viejo («se incorporarán con la
migración»). Corregido — y la prueba ahora fija el **tiempo verbal**: exige «migrados el
11-ago-2026» y verifica explícitamente que la promesa a futuro **no** reaparezca. Así el
aviso no se puede volver a quedar obsoleto en silencio.

Los demás fallos fueron el flake conocido por timeouts bajo carga, no regresiones:

| Corrida | Fallos | Duración | Lectura |
|---|---|---|---|
| 1.ª (con servidor de desarrollo activo) | 1 real + 0 | 928 s | el aviso obsoleto |
| 2.ª (misma carga) | 14 | 1203 s | degradación por carga |
| 3.ª (servidor detenido) | 3 | ~1100 s | mismo flake, menos carga |
| Los 3 aislados (`--no-file-parallelism`) | **0** | 21 s | confirmado flake |

Los tres archivos flakies (`fase2-golden-radicacion-interna-servidor`,
`radicacion-interna-atomicidad`, `radicacion-interna-finalize-falla`) son de radicación
interna: **ninguno toca el código que modifiqué**. El síntoma es el mismo de siempre
(«pass a timeout value…»), y el número de fallos escala con la carga de la máquina — 14
con el servidor de desarrollo corriendo, 3 sin él, 0 en aislamiento.

Otras verificaciones: `tsc --noEmit` limpio, `eslint` limpio sobre las áreas tocadas.

## 6. Pendiente de su decisión

1. **N-1 (impresión)** — elegir estrategia; es el único paso E2E que no pasa.
2. **N-2 (colisiones)** — ¿se expone en el libro en esta entrega o entra al backlog?
3. **N-3 (contraste ámbar/verde)** — requiere ADR por tocar tokens globales.
4. **Merge** — a la espera de su visto bueno, según su instrucción.


---

# 3.ª pasada — las tres decisiones del propietario (12-ago-2026)

Instrucción: (1) A4 horizontal para que no se recorten columnas, (2) incluir las
colisiones en esta entrega, (3) ADR de contraste sin bloquear el PR.

## N-1 · Impresión A4 horizontal — RESUELTO

**El problema no era solo la orientación.** `@page` no admite selectores: su gramática
solo acepta pseudo-clases de página o un nombre, así que cualquier `@page` cargado en el
documento gobierna TODA la impresión. Poner `landscape` en `globals.css` habría volteado
las otras **9 superficies** que imprimen — constancia de radicación (190 mm), sello de
recibido, comprobante, sello de despacho, planilla de reparto, acto de desistimiento…

**Solución en dos capas independientes:**

1. **Reglas permanentes** en `globals.css`, acotadas a las clases del libro: desrecortan
   la cadena (`overflow: visible`), pasan el contenedor a `display: block` (el medio
   paginado no fragmenta bien dentro de flex — el propio repo ya lo aprendió en
   `layout.tsx`), repiten el `<thead>` en cada hoja, evitan partir filas y compactan a
   8,5 pt alcanzando también a los descendientes que fijan su tamaño.
2. **`@page { size: A4 landscape }` acotado en el TIEMPO**: se inyecta al pulsar Imprimir
   y se retira al terminar. Es el patrón que el repo ya usa cinco veces.

**Medido simulando el medio paginado (copiando las 21 reglas `@media print` y midiendo):**

| Escenario | Ancho útil | Columnas impresas | Recortadas |
|---|---|---|---|
| A4 horizontal (botón Imprimir) | 1047 px | **8 de 8** | ninguna |
| A4 vertical (Ctrl+P / Safari) | 733 px | **8 de 8** | ninguna |

La capa 1 hace que **incluso Ctrl+P salga completo** (tabla compactada a 728 px): la
corrección no depende de que la funcionaria use el botón.

**Dos defectos que aparecieron al verificar y que también se corrigieron:**

- **La franja de urgencia desaparecía en papel.** Es un `box-shadow: inset`, y Chrome no
  imprime sombras si «Gráficos de fondo» está desmarcado (el valor por defecto). Ahora se
  imprime como `border-left` con el color de urgencia. Verificado: `4px solid rgb(220,38,38)`
  en la fila vencida, con la sombra apagada.
- **El texto de «Vence» era ilegible impreso** (ámbar 2,15:1). Se oscurece por banda con
  tonos que ya existen en el módulo. Medido tras el cambio: **6,79 / 7,12 / 9,16 / 7,58**.

**Y un fallo ALTA que la revisión adversarial encontró antes de codear:** `Comprobante
Radicado` y `PanelReparto` inyectan su hoja de impresión UNA sola vez y **nunca la
retiran** — y contienen `body * { visibility: hidden !important; }`. Como el Libro se monta
también dentro de `/interno/dashboard`, el camino real *radicar → imprimir constancia →
pestaña Licencias → Libro → Imprimir* habría producido **hojas en blanco**. Ahora se apagan
antes de imprimir y se restauran después. Verificado en la aplicación real y con prueba de
regresión.

## N-2 · Colisiones de radicado — RESUELTO

El flag `numeroExpediente.colision` existía, lo escribe el importador y llega íntegro al
cliente: **moría en `construirFilasLibroConsecutivo`**, que no lo mapeaba.

- Marca roja **«Colisión»** junto al número, reutilizando el trío de
  `ESTILOS_ESTADO_JURIDICO.NEGADA` (7,95:1, cero hex nuevo). Con `role="note"` para que el
  `aria-label` sea válido — ARIA lo prohíbe sobre un `<span>` genérico, y una prueba con
  `getByLabelText` habría dado verde igualmente.
- **Dice con QUIÉN colisiona**, que es lo que se necesita para resolver: cada fila nombra a
  la otra. Verificado en stage — Ana nombra a Pedro y Pedro nombra a Ana.
- Chip de filtro **«Colisiones»** con conteo, visible solo cuando hay alguna, con guarda que
  resetea el filtro si el conteo cae a 0.
- Columna **`COLISION`** en el CSV (aditiva, al final): sin ella la anomalía seguiría
  invisible una capa más abajo. Verificado: 10 columnas alineadas, 2 filas en `SI`.

**Disciplina de honestidad mantenida:** la marca se enciende SOLO con el flag persistido,
nunca comparando números repetidos en la vista — hay una prueba dedicada a que dos filas con
el mismo número pero sin flag NO se marquen. Y cuando el gemelo no está a la vista, el texto
habla del dato («el importador marcó este número como duplicado») en vez de afirmar una
existencia que el libro no puede verificar.

### Corrección de fondo incluida

El JSDoc de `colision` decía que el flag significa choque contra un expediente REAL. Es
falso: `esColision` cuenta repeticiones dentro del snapshot del Excel y nunca consulta
`unicidad_expedientes`. Se corrigió antes de construir una marca legal encima de una
descripción equivocada.

### Riesgo ABIERTO que descubrió la revisión (no cubierto por esta entrega)

Ningún control detecta hoy duplicados de `numeroExpediente` entre expedientes **REAL**:
`verificarColisionNumeroExpediente` no tiene ningún caller de producción, y el cron
`auditoria-consecutivos` no barre la colección `expedientes`. La marca del libro solo delata
lo que el importador declaró. **Queda sin dueño y conviene registrarlo en el registro de
riesgos.**

## N-3 · Contraste — ADR-0030 abierto, sin tocar tokens

`docs/adr/0030-tokens-de-texto-accesibles-wcag-aa.md`. Verifiqué sus valores con cálculo
independiente y **coinciden exactamente**:

| Token propuesto | Valor | s/ blanco | s/ bg-base | s/ bg-surface-2 |
|---|---|---|---|---|
| `--color-warning-text` | `#8E5C06` | 5,70 | 5,43 | 5,11 |
| `--color-success-text` | `#117937` | 5,51 | 5,25 | 4,93 |
| `--color-danger-text` | `#B91C1C` | 6,47 | 6,16 | 5,80 |

El ADR encontró además dos cosas que yo no había medido:

- **`--color-danger` tampoco está a salvo**: 4,33:1 sobre `--bg-surface-2`. No estaba
  «salvado», estaba al borde — cualquier fondo que no sea blanco puro lo tumba.
- **El código ya parcheó el problema tres veces**, con tres ámbares ad-hoc distintos
  (`#D97706` en 10 sitios, `#B45309` en 9, `#92400E` en 16), uno de ellos igualmente
  inaccesible. El vacío del token no era teórico.

Alcance de la migración: **82 sitios en 28 archivos**. Trabajo separado, como usted indicó.

## Verificación de la 3.ª pasada

| Comprobación | Resultado |
|---|---|
| Suite `TZ=UTC` | **2068/2068** (1 fallo = flake de timeout en `radicacion-interna-magic-bytes`, 5288 ms contra 5000; verde aislado en 2,8 s, no toca este código) |
| `tsc --noEmit` | limpio |
| `eslint` | limpio |
| Impresión A4 horizontal y vertical | 8/8 columnas |
| Franja de urgencia en papel | borde con color, sombra apagada |
| Hojas de impresión ajenas | apagadas durante, restauradas después |
| Colisiones en pantalla | 2 marcas, cada una nombra a la otra |
| CSV | 10 columnas alineadas, 2 en `SI` |
| Buscador | intacto (por número y por nombre del gemelo) |
| Responsive 375 px | contenedor 375, 0 desbordes, 8 columnas, marca visible |
| Detalle y términos | sin regresión (resuelto: 0 alertas; en trámite: 1) |
| Producción | **no se tocó** |
