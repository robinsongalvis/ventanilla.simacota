# ADR-0031 — Abrir la serie de expedientes es un acto explícito

- **Fecha:** 2026-08-13
- **Estado:** aceptado
- **Responsable:** arquitecto-principal
- **Roles consultados:** dev-backend (emisión y contadores), gobierno-digital (unicidad AGN), qa (regresión), firestore-datos (unicidad y reservas)
- **Nivel de triaje:** 2 — cambia el contrato de una función de servidor (`leerConsecutivosLegales`) y el comportamiento de la emisión de una serie legal. No crea colección ni módulo, no cambia el modelo de datos.

## Reserva de numeración

El último ADR es **0030**. El **0027** sigue vacante por la renumeración descrita en ADR-0028 §Reserva de numeración y **no se reutiliza**. Este ADR toma el **0031**.

## Contexto

### El agujero, medido

`leerConsecutivosLegales` resolvía el contador anual así:

```ts
const ultimoActual = Number(snaps[i].data()?.ultimo ?? 0);
const consecutivo = ultimoActual + 1;
```

Ese `?? 0` hace que **«no existe el contador» y «la serie va por cero» sean
indistinguibles**. Para las series nacidas digitales —`radicados`, `salidas`,
`planillas`— eso es correcto y deseable: el 1 de enero no hay documento y el
primer radicado del año debe ser el `0001`.

Para `expedientes` no lo es, porque esa serie **no nació digital**. Existe un
libro de papel de Planeación (2022–2026) cuyos números ya se importaron a
Firestore como `numeroExpediente.numero`. Y el importador tiene **prohibido
por diseño** (DF-9, con guarda `RUTAS_PROHIBIDAS` que lanza) escribir en
`counters/` y en `unicidad_expedientes/`. Consecuencia: esos números están
ocupados **sin reserva de unicidad y sin haber avanzado la serie**.

### Por qué las protecciones existentes no cubrían esto

| Protección | Qué cubre | Por qué no cubría este caso |
|---|---|---|
| `tx.create` sobre `unicidad_expedientes/{numero}` | REAL contra REAL | Los históricos nunca reservaron: no hay documento contra el que chocar |
| Guard D9 (`verificarAvanceCounter`) | Que un RECONSTRUIDO no consuma la serie viva | Protege la serie de los reconstruidos, no a los reconstruidos de la serie — la asimetría es exactamente el agujero |
| `firestore.rules` | Acceso de cliente | `expedientes` es `write: if false` (solo Admin SDK, que salta reglas), y Firestore no expresa unicidad entre documentos |
| `verificarColisionNumeroExpediente` | Un número de migración contra una reserva real | Comprueba la dirección contraria, y no tiene ningún llamador de producción |

### Cifras (13-ago-2026)

De los 196 expedientes importados a producción el 11-ago-2026, **17 son de
2026**: consecutivos `{1, 4..19}`. `counters/expedientes-2026` **no existe**.

Si se levantara el candado R10 antes del 31-dic-2026 sin sembrar el contador,
las **19 primeras emisiones reales** producirían `68745-0-26-0001` … `-0019`:
17 duplicarían un documento de Firestore y 2 (`26-0002`, `26-0003`)
duplicarían números que constan en el libro físico pero están **ausentes de
Firestore**, porque quedaron en cuarentena por fecha inválida. De la emisión
20 en adelante la serie vuelve a ser correcta por casualidad aritmética.

El daño sería **jurídico, no cosmético**: dos actos administrativos con el
mismo número de expediente, en silencio, contra la unicidad que exige el
Acuerdo AGN 060/2001 art. 5 — y es exactamente el defecto (el duplicado
`25-0037` del libro) que el módulo existe para no repetir.

### Qué NO era

El riesgo **no puede dispararse hoy**: además del candado
`EMISION_REAL_EXPEDIENTES_HABILITADA = false`, ninguna ruta importa el
emisor y el único camino de creación vivo produce ids `DEMO-{AA}-{idCorto}`.
Abrir el candado rompe dos tests, así que exige un cambio deliberado. Lo que
faltaba no era un candado más: era que ese cambio deliberado **no estaba
atado por código a la siembra del contador**.

## Alternativas evaluadas

1. **Sembrar el contador y ya.** Correcto y necesario, pero es un acto de
   datos, no un control: no impide que el año siguiente —u otro tenant, u
   otra serie con libro previo— repita el olvido. **Rechazada como solución
   única**; se conserva como el acto de cierre (ver Consecuencias).
2. **Retro-poblar `unicidad_expedientes` con los 196 históricos**, para que
   `tx.create` falle. Atractiva, pero **contradice DF-9** (los reconstruidos
   no reservan) y sería un ADR de más calado. Además no cubriría los 2
   números en cuarentena, que no están en Firestore. **Aplazada**: es una
   decisión de doctrina archivística, no una corrección de defecto.
3. **Consultar la colección `expedientes` antes de emitir**, buscando el
   número. Requiere una lectura por query dentro de la transacción y un
   índice, y **tampoco vería los números en cuarentena**. Da falsa
   sensación de cobertura. **Rechazada.**
4. **Fail-closed para TODAS las series.** Rompería la apertura legítima de
   `radicados`/`salidas`/`planillas` cada 1 de enero. **Rechazada.**

## Decisión

**Para la serie `expedientes`, un contador anual inexistente es un error, no
una serie en cero.** Se añade `exigeAperturaExplicita` a `SolicitudSerie`;
`leerConsecutivosLegales` lanza `SerieNoAbiertaError` cuando la bandera está
activa y `counters/{serie}-{año}` no existe. La activa
`emitirNumeroExpedienteReal`.

Abrir la serie pasa a ser un **acto explícito y trazable**: alguien decide
con qué número arranca el año, por encima de lo que el libro ya consumió.
Eso convierte un duplicado silencioso en un fallo ruidoso y accionable — el
error nombra la serie, el año y qué hacer.

**Además**, el Libro Consecutivo enciende su aviso de colisión también cuando
detecta dos filas con el mismo número **aunque el importador no lo haya
declarado**. Ese cálculo (`otrosConMismoNumero`) ya se pagaba y se
descartaba, porque el aviso exigía la bandera `colision`, que solo escribe el
importador. Es el único detector que la funcionaria vería el día del
incidente, y ahora distingue en el texto lo declarado de lo no declarado.

Se conserva el invariante de honestidad: el Libro **no fabrica** la bandera
persistida — solo cambia lo que muestra, no lo que afirma del dato.

## Relación con el guard D9 — por qué abrir la serie no lo viola

D9 (ADR-0026) prohíbe que **un consecutivo de origen `RECONSTRUIDO` avance el
contador vigente**: las actuaciones reconstruidas se marcan como tales pero
no consumen la serie legal. `verificarAvanceCounter` lo implementa
rechazando `origen: 'RECONSTRUIDO'`.

Una lectura literal podría concluir que abrir la serie en 19 —un valor
derivado de números históricos— viola D9. **No es así, y conviene dejarlo
escrito porque bajo esa lectura el riesgo sería irreparable**: nunca se
podría sembrar el contador y la colisión sería inevitable.

La diferencia es qué operación se hace:

| | Lo que D9 prohíbe | Abrir la serie |
|---|---|---|
| Qué ocurre | Un expediente RECONSTRUIDO **consume** un número de la serie viva | Se declara el **piso** de la serie: cuántos números consumió ya el libro |
| Quién emite | El flujo de emisión, con un origen falseado | Nadie. No se emite ningún expediente |
| Efecto sobre los históricos | Les daría un número de la serie vigente | Ninguno: siguen exactamente como están |
| Efecto sobre la serie | La haría avanzar por un hecho que no ocurrió | Refleja un hecho que **sí** ocurrió: el libro de papel |

Dicho de otro modo: D9 impide que el pasado **consuma** la serie; abrir la
serie es reconocer lo que el pasado **ya consumió** fuera del sistema. Es un
acto archivístico de apertura, autorizado y trazable, no una emisión.

Las tres invariantes de `verificarAvanceCounter` se cumplen igualmente en la
apertura: el valor es un entero ≥ 0; es estrictamente mayor que el estado
anterior (que no existe, luego 0); y no hay `origen` porque no hay emisión.
El script no invoca el guard —vive en TypeScript y el ejecutor es `.mjs`—
pero aplica comprobaciones **más estrictas**: escribe con `create`, de modo
que es imposible tocar una serie ya abierta, y rechaza cualquier valor que no
coincida con el máximo del libro.

## Consecuencias

- **Positivas.**
  - El olvido de sembrar el contador deja de ser silencioso. Es el cambio de
    un fallo invisible a uno ruidoso, que es el objetivo.
  - Un duplicado que nadie declaró deja de ser invisible en la pantalla que
    la funcionaria sí mira.
  - La apertura de una serie legal queda como acto explícito, que es lo que
    archivísticamente es.
- **Negativas / deuda aceptada.**
  - **El cierre real sigue pendiente y es un acto de datos**: sembrar
    `counters/expedientes-{año}` por encima del máximo del libro, autorizado
    por el propietario, ANTES de levantar R10. Este ADR lo hace imposible de
    olvidar, no lo ejecuta. Registrado como **R16** en
    `docs/REGISTRO_RIESGOS.md`.
  - Los 2 números en cuarentena (`26-0002`, `26-0003`) están ocupados en el
    libro de papel y ausentes de Firestore. **Ninguna** protección basada en
    consultar Firestore los vería: solo la siembra por encima del máximo del
    libro los respeta. Queda declarado.
  - El cambio rompió 3 tests que codificaban el comportamiento anterior
    («counter inexistente → consecutivo 1»). Es un cambio de contrato
    consciente; los tests se actualizaron y se añadió la regresión de la
    guarda.
- **No cubierto por este ADR.**
  - Extender el cron `auditoria-consecutivos` para barrer `expedientes` y
    reportar duplicados por correo. Se diseñó y se midió, pero la evaluación
    del riesgo latente **dispararía severidad crítica para los cinco años a
    la vez** en la primera corrida (el consecutivo 1 está ocupado en todos y
    ningún contador existe), y un control que grita el primer día es un
    control que nadie vuelve a leer. Necesita acotarse al año en curso y a la
    condición de que la emisión real sea posible. Queda como trabajo
    siguiente.

## Referencias

`lib/server/consecutivo-legal.ts` (`exigeAperturaExplicita`, `SerieNoAbiertaError`) · `lib/server/emitir-numero-expediente.ts` · `app/interno/licencias/presentacion-libro-consecutivo.ts` (`textoColisionLibro`) · `__tests__/emitir-numero-expediente.test.ts` · `docs/REGISTRO_RIESGOS.md` (R16) · Acuerdo AGN 060/2001 art. 5 · ADR-0026 (motor de expedientes, D6/D9) · ADR-0029 (DF-9).
