# Procedimiento — Abrir la serie legal de expedientes

**Fecha:** 13-ago-2026 · **Estado:** PREPARADO, sin ejecutar · **Requiere:** autorización expresa del propietario
**Base:** ADR-0031 · **Riesgo que cierra:** R16 de `docs/REGISTRO_RIESGOS.md`

---

## 1. Qué es esto, en una frase

Escribir en `counters/expedientes-2026` el número **19**, que es el último
consecutivo que el libro de papel de Planeación ya consumió este año, para
que la primera licencia real que emita el sistema sea la **20** y no
duplique una que ya existe.

## 2. Por qué hace falta

El libro de Planeación (2022–2026) se migró a Firestore, pero el importador
tiene **prohibido por diseño** tocar los contadores (DF-9). Así que esos
números están ocupados sin que la serie lo sepa.

Hasta ADR-0031, un contador inexistente se leía como «la serie va por cero».
Si se hubiera habilitado la emisión real, las **19 primeras licencias**
habrían salido con números ya usados — y nada lo habría detectado, porque la
reserva de unicidad solo protege contra lo que ella misma emitió.

Desde ADR-0031 eso ya no puede pasar en silencio: el sistema **se niega a
emitir** si la serie no está abierta. Este procedimiento es el acto de
abrirla.

> **Lo que este procedimiento NO hace:** no habilita la emisión real. El
> candado `EMISION_REAL_EXPEDIENTES_HABILITADA` sigue cerrado y es una
> decisión aparte. Abrir la serie es el **requisito previo**, no el
> interruptor.

## 3. El número, y de dónde sale

| Año | En Firestore | Solo en el libro (cuarentena) | Máximo del libro | ¿Se abre? |
|---|---|---|---|---|
| 2022 | 47 | 14, 15 | 49 | **NO** — año cerrado |
| 2023 | 42 | 32, 33 | 44 | **NO** — año cerrado |
| 2024 | 39 | — | 39 | **NO** — año cerrado |
| 2025 | 50 | — | 50 | **NO** — año cerrado |
| **2026** | **17** | **2, 3** | **19** | **SÍ → abrir en 19**, próxima emisión `0020` |

**Solo se abre 2026.** Las cuatro primeras filas están aquí como evidencia
del cálculo, **no como comandos a ejecutar**: abrir la serie de un año
cerrado no protege de nada y habilitaría emisiones retroactivas sobre
números del libro.

El script lo impide por su cuenta (guarda 6): rechaza cualquier `--anio`
anterior al año en curso. Ojo — la guarda de ADR-0031 **no** protege contra
esto: ADR-0031 es lo que exige abrir la serie, y este script es precisamente
el que la abre.

### El detalle que decide la corrección del número

Seis registros del libro quedaron en **cuarentena** por fecha inválida y
**nunca llegaron a Firestore**. Sus números están consumidos en papel. Dos de
ellos son de 2026: `26-0002` y `26-0003`.

Si el máximo se calculara mirando Firestore, para 2026 daría **17** y las
licencias 18 y 19 volverían a duplicar. Por eso el cálculo se hace sobre el
**libro completo** — el snapshot `consecutivo-licencias-snapshot.sanitizado.json`,
que está versionado y sin datos personales — y el script rechaza cualquier
valor que no coincida.

> El plan de importación (`plan-importacion.generado.json`) da los mismos
> números, pero está en `.gitignore`: no sirve como insumo de un
> procedimiento que otra persona deba poder reproducir.

Validación cruzada: contando la cuarentena, el libro es **contiguo `1..máx`
en los cinco años, sin un solo hueco**. Los «huecos» que se ven mirando solo
Firestore son exactamente los 6 de cuarentena.

> **Prohibido reutilizar esos números.** No están libres: están asignados en
> el libro de papel. Reutilizarlos sería renumerar la serie legal histórica.

## 3-bis. PRECONDICIÓN BLOQUEANTE — confirmar el libro con Planeación

**Este es el paso que ningún código puede hacer por usted, y sin él todo lo
demás es teatro.**

El número 19 sale de un snapshot del Excel extraído el **9-ago-2026**. Ese
Excel **sigue vivo**: su propia procedencia lo dice —«el corte definitivo se
hará tras la reunión»— y su último asiento de 2026 es del 24-jun. Si
Planeación radicó en papel la licencia `68745-0-26-0020` desde entonces (el
ritmo histórico es de ~4 al mes), abrir la serie en 19 haría que la primera
emisión real produjera un número **ya usado**.

Y no hay forma de detectarlo desde el sistema: ese número no está en el
snapshot ni en Firestore. La verificación en seco del paso 4 compara el
snapshot contra sí mismo — **es tautológica respecto a este riesgo**.

**Antes de ejecutar, obtenga por escrito del ingeniero de Planeación:**

> ¿Cuál es el último número de expediente de 2026 asentado en el libro, a día
> de hoy? (esperado: `68745-0-26-0019`)

- **Si responde 0019:** siga. Anote la fecha de la confirmación — el script
  la exige en `--libro-confirmado-el` y la graba como evidencia.
- **Si responde un número mayor:** **pare**. Hay que volver a extraer el
  Excel, regenerar el insumo y rehacer este procedimiento. Las pruebas
  (`__tests__/abrir-serie-expedientes.test.ts`) fijan 2026→19 y fallarán
  avisando de que el documento quedó obsoleto.

El script rechaza una confirmación de más de **7 días** de antigüedad.

## 4. Antes de ejecutar — verificación en seco

Corre sin escribir nada y muestra qué haría:

```bash
node scripts/migracion/abrir-serie-expedientes.mjs --anio 2026 --proyecto ventanilla-unica-f31b1
```

**Debe imprimir exactamente:** `Consecutivos ocupados en el libro: 19 (máximo 19)`
y proponer `ultimo=19`. Si dice otra cosa, **pare aquí**: el plan cambió y el
procedimiento hay que rehacerlo.

## 5. Ejecución

### Las credenciales — importante, esto falló en el ensayo

`FIREBASE_SERVICE_ACCOUNT` contiene un JSON con comillas. **`source .env` no
sirve**: el shell se come las comillas y el script recibe `{type:service_account…}`
en vez de JSON válido. En el ensayo del 13-ago-2026 abortó con código 9 por
esta razón — sin escribir nada, que es lo correcto, pero perdiendo el intento.

Cárguelas así:

```bash
export FIREBASE_SERVICE_ACCOUNT="$(grep '^FIREBASE_SERVICE_ACCOUNT=' .env.produccion | cut -d= -f2-)"
```

Compruebe antes de seguir que apunta a donde cree:

```bash
node -e "console.log(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id)"
```

Debe imprimir `ventanilla-unica-f31b1`. Si imprime otra cosa —o falla— pare:
la guarda 3 lo detendría igualmente, pero es mejor descubrirlo aquí.

```bash
CONFIRMO_ESCRITURA=si node scripts/migracion/abrir-serie-expedientes.mjs --anio 2026 --proyecto ventanilla-unica-f31b1 --ultimo 19 --libro-confirmado-el AAAA-MM-DD --ejecutar
```

Sustituya `AAAA-MM-DD` por la fecha de la confirmación del paso 3-bis.

**El contraste contra Firestore debe imprimir:** `196 leídos · 17 del año 2026
· máximo 19`. Si dice `0 del año 2026`, el script aborta solo (código 6): es
la señal de que se está apuntando a la base equivocada.

### Las ocho guardas que trae puestas

| # | Guarda | Qué evita |
|---|---|---|
| 1 | Dry-run por defecto | Que un comando a medio escribir escriba |
| 2 | `--ejecutar` **y** `CONFIRMO_ESCRITURA=si` | Que se ejecute sin decisión consciente |
| 3 | `--proyecto` debe coincidir con el service account | Abrir la serie del proyecto equivocado |
| 4 | `--ultimo` debe coincidir con el máximo del libro | Un error de tecleo que deje la serie baja o alta |
| 5 | `--libro-confirmado-el`, obligatoria y de ≤7 días | Escribir sobre un snapshot viejo sin que nadie mirara el libro |
| 6 | Solo el año en curso (salvo `--anio-futuro`) | Abrir series de años cerrados y habilitar emisiones retroactivas |
| 7 | Escribe con `create`, nunca `set` | Pisar una serie abierta y **retroceder** el consecutivo |
| 8 | Contraste contra Firestore, fail-closed en ambos sentidos | Base equivocada (0 del año) o libro superado (máximo por encima) |
| — | Flags repetidos abortan | Que `--ultimo 19 --ultimo 99` use silenciosamente el primero |

**Códigos de salida:** `0` correcto (dry-run **o** escritura: distíngalos por
la evidencia) · `1` uso incorrecto o precondición no cumplida · `2` sin
credenciales · `3` falta `CONFIRMO_ESCRITURA` · `4` proyecto equivocado ·
`5` `--ultimo` no coincide · `6` Firestore no cuadra · `7` la serie **ya
estaba abierta** · `8` **fallo de escritura, la serie NO quedó abierta** ·
`9` error inesperado.

> `7` y `8` son distintos a propósito: `7` es benigno (ya estaba hecho), `8`
> significa que **no** se escribió. Confundirlos haría guardar como evidencia
> de éxito lo que fue un fallo.

## 6. Evidencia y verificación

El script imprime al terminar el documento escrito **y releído de Firestore**.
Guarde esa salida. Debe verse:

```json
{
  "path": "counters/expedientes-2026",
  "leidoDeVuelta": { "ultimo": 19, "abiertaEn": "...", "motivo": "..." }
}
```

Comprobación independiente, después — **de solo lectura**:

```bash
node scripts/migracion/abrir-serie-expedientes.mjs --anio 2026 --proyecto ventanilla-unica-f31b1 --verificar
```

Debe imprimir `ABIERTA` y el documento. Este modo **no escribe nada**, así
que puede repetirse sin riesgo. (Antes este paso proponía relanzar el comando
de escritura esperando el código 7; se cambió porque enseñaba a repetir una
escritura contra producción como si fuera una comprobación.)

## 6-bis. Ensayo previo en stage — recomendado

La mitad del script que toca Firestore (conexión, contraste, `create`) no se
ha ejecutado nunca. Estrenarla contra producción, con el propietario
esperando, es cuando se improvisa.

Con `.env.stage` cargado:

```bash
CONFIRMO_ESCRITURA=si node scripts/migracion/abrir-serie-expedientes.mjs --anio 2026 --proyecto <id-de-stage> --ultimo 19 --libro-confirmado-el AAAA-MM-DD --ejecutar
```

Los expedientes de prueba (`68745-0-26-9001`…) **se ignoran** en el contraste,
así que no disparan la guarda 8. Después, `--verificar` debe decir `ABIERTA`,
y repetir la escritura debe dar código **7**.

> Si stage no tiene los históricos importados, la guarda 8 aborta con código
> 6 («0 del año 2026»). Es correcto, pero entonces el ensayo NO valida el
> camino de escritura. Para un ensayo fiel hay que sembrar antes en stage los
> históricos del año, sin marcarlos como prueba (el contraste ignora
> `esPrueba` y `loteVerificacion`).

### Resultado del ensayo del 13-ago-2026

Ejecutado contra `ventanilla-simacota-stage` con los 17 históricos de 2026
sembrados. Las nueve guardas verificadas **contra Firestore real**:

| Comprobación | Código | Resultado |
|---|---|---|
| Verificación en seco | 0 | propone `ultimo=19` |
| Escritura | 0 | contraste `17 · 17 · máximo 19`; evidencia releída correcta |
| `--verificar` | 0 | `ABIERTA` con el documento |
| Reintento de escritura | **7** | «ya estaba abierta» — benigno, no pisó nada |
| Proyecto equivocado | **4** | detectó que el service account era de stage |
| Base sin históricos | **6** | «el libro dice 19 y Firestore no muestra ninguno» |
| Credenciales mal cargadas | **9** | «NO se escribió nada» |
| `--ultimo` equivocado / flag repetido / año cerrado / confirmación vieja | 5 / 1 / 1 / 1 | abortan antes de conectar |

Stage quedó limpio: se retiraron los 17 expedientes sembrados y el contador.

## 7. Si sale mal

El script **no puede** dejar la serie a medias: escribe un solo documento con
`create`. Los escenarios posibles son:

- **Aborta antes de escribir** (códigos 1–6): no pasó nada. Corrija y repita.
- **Escribió un valor equivocado**: no lo corrija con este script — solo sabe
  crear. Corregir un contador ya abierto es una operación aparte, y si ya se
  emitió algún número con él, **bajarlo duplicaría**. Consulte antes de tocar.

## 8. Lo que este cambio le exige cada año — importante

La guarda de ADR-0031 vale para **todos** los años. El 1 de enero de 2027,
`counters/expedientes-2027` no existirá y **la primera emisión real fallará**
hasta que alguien abra la serie.

Es deliberado —abrir una serie legal debe ser un acto consciente— pero no
puede ser una sorpresa. Para 2027 en adelante el libro no tiene números, así
que la apertura es en **0**:

```bash
CONFIRMO_ESCRITURA=si node scripts/migracion/abrir-serie-expedientes.mjs --anio 2027 --proyecto ventanilla-unica-f31b1 --ultimo 0 --ejecutar
```

**Recomendación pendiente:** que el cron de auditoría avise cuando la serie
del año en curso no esté abierta, en vez de descubrirlo con una emisión
fallida. Queda como trabajo siguiente, junto con el barrido de duplicados que
ADR-0031 dejó fuera por ruido.

## 9. Trazabilidad

- ADR-0031 — la decisión de que abrir la serie sea un acto explícito.
- R12 en `docs/REGISTRO_RIESGOS.md` — el riesgo que esto cierra.
- `scripts/migracion/abrir-serie-expedientes.mjs` — el ejecutor.
- `__tests__/abrir-serie-expedientes.test.ts` — fija los números de la tabla
  del punto 3 leyendo el snapshot **versionado**, así que corre en CI y en
  cualquier clon. Si el libro cambia, estas pruebas fallan y avisan de que
  este procedimiento quedó obsoleto.
- Acuerdo AGN 060/2001 art. 5 — unicidad del consecutivo.
