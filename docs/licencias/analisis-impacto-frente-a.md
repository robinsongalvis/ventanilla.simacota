# Análisis de impacto — Frente A: el sistema emite la resolución

- **Fecha:** 30 de agosto de 2026
- **Estado:** ANÁLISIS. No autoriza implementación. Precede al ADR, que precede al código.
- **Nivel de triaje (Principio 1):** **3 — estructural.** Serie nueva, documento
  que el sistema autoría, texto con efectos jurídicos, cuatro módulos tocados.
- **Decide:** el propietario, sobre la norma
- **Relacionado:** ADR-0036 (la copia derivada), ADR-0038 (el término se
  suspende), R17 · R18 · R19, `matriz-normativa-requisitos.md`

---

## 1. Qué se propone

Que el sistema **produzca** la resolución de licencia —hoy escrita a mano en
Word— calcada del formato oficial `F-PGJ-002`, llenando solo los espacios
variables desde el expediente.

**El reencuadre que originó el frente:** el propietario preguntó cómo *leer* una
resolución escaneada para autocompletar datos. La respuesta fue que el sistema
debe **escribirla**, no leerla: todo lo que ese papel imprime ya vive en el
expediente, y las reglas que enuncia ya están codificadas.

**Y el propio documento real lo sostiene.** La Resolución LSU 001-2026 de
Simacota, que sirve de modelo, trae tres cicatrices del camino manual:

| Error en el acto firmado | Qué lo produce |
|---|---|
| «licencia de Subdivisión No. **001 – 206**» (debe ser 001–2026), **en el artículo resolutivo** | teclear un número que el sistema ya tiene |
| Una **regla de tres a lápiz** sobre la página firmada, que usa 245 donde el cuadro de áreas dice **247** | calcular a mano lo que es aritmética |
| «**TUTULAR** LICENCIA», dos veces en el encabezado | plantilla copiada y pegada |

Un documento compuesto desde datos no comete ninguno de los tres.

---

## 2. LA TENSIÓN CENTRAL, y cómo se resuelve

El ADR-0036 decidió que la constancia de radicación es una **copia derivada y
desechable**:

> *«se genera de datos nuestros, es determinista y pesa nada, y materializarla
> habría creado una segunda verdad»*

**La resolución es lo contrario en todo lo que importa:**

| | Constancia | Resolución |
|---|---|---|
| ¿De dónde sale su contenido? | 100 % de datos del sistema | datos **+ texto libre del ingeniero** (observaciones técnicas, decisión) |
| ¿Es determinista? | sí — mismos datos, mismo papel | **no** — dos ingenieros escriben distinto |
| ¿Qué es jurídicamente? | prueba de un hecho registrado | **el acto administrativo mismo** |
| ¿Va firmada? | no | **sí**, por el Secretario |
| ¿Se puede regenerar? | siempre, sin consecuencia | **jamás**: regenerarla sería otro acto |

### La regla que los separa, y sirve para todo documento futuro

> **Si todo el contenido sale de los datos → se deriva a demanda.**
> **Si una persona escribe dentro → se materializa y se congela.**

Un documento derivado se recalcula; uno que contiene la voluntad de alguien no
puede recalcularse sin perder esa voluntad. La constancia se puede volver a
imprimir mil veces idéntica; la resolución, una vez expedida, es un hecho del
mundo.

**Consecuencia de diseño:** la resolución se **materializa en Storage**, con su
hash, y el expediente guarda su referencia. No se regenera nunca. Si hay que
corregirla, se expide una **resolución de corrección** —que es lo que la ley
prevé— y las dos quedan.

**Y una consecuencia incómoda que hay que decir:** eso significa que el sistema
guarda un PDF que **no puede volver a producir**. Si el formato cambia mañana,
las resoluciones viejas siguen viéndose como el día que se firmaron. Es correcto
y es deliberado.

---

## 3. La serie LSU

La resolución lleva su propio número —`RESOLUCIÓN LSU No. 001 DE 2026`— que **no
es** el número del expediente ni el radicado de ventanilla. Es una tercera serie.

**Lo que ya existe y se reutiliza entero:**

`lib/server/consecutivo-legal.ts` gobierna cuatro series (`radicados`,
`salidas`, `planillas`, `expedientes`) con reserva de unicidad transaccional y
**apertura explícita obligatoria** (`exigeAperturaExplicita`, ADR-0031/R16): sin
contador del año, la emisión falla ruidosamente en vez de duplicar en silencio.

`SerieConsecutivo` es una **unión cerrada de tipos**. Añadir `'resoluciones-lsu'`
hace que `tsc` señale todos los sitios que deben contemplarla — el mismo patrón
de «Record completo sobre un dominio» que este proyecto usa a propósito.

**Lo que hay que decidir, y no es técnico:**

1. **¿Una serie por tipo de licencia o una sola de resoluciones?** El modelo dice
   `LSU` (licencia de subdivisión urbana). Si construcción usa `LC`, urbanización
   `LU`, etc., son series paralelas y el prefijo es parte del número.
2. **¿Desde qué número abre?** Planeación lleva resoluciones en papel. Sembrar el
   contador por encima del máximo del libro es un acto autorizado, igual que el
   pendiente de `expedientes` (R16).
3. **¿Numeración anual?** El modelo dice «001 DE 2026», así que sí.

**Nada de esto se supone.** Es la conversación con Planeación que quedó pendiente.

---

## 4. El molde `F-PGJ-002`

**Requisito innegociable del propietario:** calcado. Mismo encabezado, misma
estructura y orden, mismo pie, y los textos fijos palabra por palabra —incluidas
las advertencias—. El sistema solo llena los variables.

**Y la fidelidad es al formato aprobado, NO a sus erratas:** los tres errores del
documento real no se calcan.

### Plan A — llega el fuente (Word o PDF del formato en blanco)

`pdf-lib` ya está en el proyecto (`^1.17.1`) y **sabe cargar un PDF existente**:
`PDFDocument.load(bytesOriginal)` es exactamente lo que hace hoy
`lib/sello/generar-sello-pdf.ts`. El trabajo pasa de *reproducir un documento* a
*llenar campos en el documento*.

- Fidelidad **exacta por construcción**: el molde es el oficial.
- Elimina la clase entera de defectos «se parece pero no es».
- **Coste: 5–6 unidades.**

### Plan B — no llega el fuente

Hay que **redibujar** el maquetado en código: tipografías, la tabla del cuadro de
áreas, el encabezado con sus celdas, el pie. Y validarlo página por página contra
el escaneo.

- Fidelidad **aproximada**, que alguien tiene que certificar.
- **Coste: 9–11 unidades**, y con incertidumbre alta.

### Los activos institucionales — CORRECCIÓN

Dije que `public/` no tenía ninguno. **Era falso**: `public/brand/logo-alcaldia-simacota.png`
está ahí desde el 6 de agosto y es el escudo. Busqué solo en la raíz y no miré
las subcarpetas.

Lo que sí falta es el **lockup horizontal con el texto** «Alcaldía de Simacota»,
que el propietario ya envió y hay que incorporar al repositorio.

---

## 5. Las nueve dimensiones (Principio 1, Nivel 3)

**Técnico.** Reutiliza `consecutivo-legal.ts` (serie), `pdf-lib` (composición),
`expedientes-documentos` (persistencia y hash), y el patrón de rutas puras +
orquestación. Lo genuinamente nuevo: la plantilla y el mapeo campo↔dato.

**Funcional.** El ingeniero deja de teclear un Word y pasa a revisar un borrador
compuesto, escribir sus observaciones técnicas y su decisión, y firmar. **No se
le quita ninguna decisión**: se le quita la transcripción.

**Seguridad.** Emitir un acto administrativo es la operación más sensible del
módulo. Exige: transacción con reserva de unicidad del número (como el acto de
radicar), actor capturado en servidor (D8), y el candado R10 —una resolución
`esPrueba` no puede consumir un número de la serie legal—.

**Rendimiento.** Composición de un PDF de 5 páginas por acto: irrelevante. Pero
la materialización en Storage **sí** entra al respaldo de adjuntos, que copia 35
objetos hoy. Cada resolución suma. No es problema; es un dato para el respaldo.

**UX.** El borrador se revisa **antes** de expedir, no después. Y el momento de
la firma tiene que dejar clarísimo que es irreversible — el patrón del acto de
radicar, con su vista previa y su motivo, es el modelo.

**Normativo.** El fundamento del contenido está en la matriz
(`matriz-normativa-requisitos.md`). Los artículos que la resolución cita —Ley
388 art. 99, D.1077, el Acuerdo 013 (EOT) y el 026 (tarifas)— son datos de la
plantilla, no prosa libre.

**IA.** **Ninguna.** La resolución no se sugiere, no se autocompleta con modelos,
no se redacta con IA. Es un acto administrativo: la IA propone y el funcionario
decide (Principio 9), y aquí no hay nada que proponer que no salga de los datos.

**Deuda.** Retira deuda: elimina la transcripción manual y sus tres errores
demostrados. Añade una: un formato calcado hay que mantenerlo sincronizado si la
Alcaldía lo actualiza — por eso el plan A importa tanto.

**Reutilización.** Alta. Serie, PDF, documentos, actuaciones y el patrón de acto
irreversible ya existen. La plantilla es lo único sin precedente.

---

## 6. Los tres huecos, como parte del diseño

Esto **no** son pendientes paralelos: son piezas de la misma cadena de cierre.

**R17 — la notificación a vecinos colindantes.** El ARTÍCULO OCTAVO de la
resolución real ordena notificar «al interesado **y a los vecinos**», y la
palabra no aparece en la cadena de cierre. **Sube a ALTA con este frente**: si el
sistema produce la resolución y declara la firmeza sin exigir esa notificación,
convierte una omisión ocasional en sistemática — y desde la firmeza corren las
vigencias.

**R18 — la constancia de ejecutoria.** El sistema registra `fechaFirmeza` pero no
emite el papel que la acredita. Se transparenta al reverso de la página firmada
del escaneo. Es el eslabón final de la misma cadena y **debe entrar con A**, no
después: una resolución sin su constancia de ejecutoria deja el trámite otra vez
a medio camino.

**R19 — el expediente limpio sin puerta.** Un expediente sin observaciones no
tiene actuación que lo lleve a `EN_VIABILIDAD`, y `CONCEDIDA`/`NEGADA` solo se
alcanzan desde ahí. **Es bloqueante para A**: no tiene sentido construir la
emisión de la resolución si el trámite limpio no puede llegar al estado desde el
cual se resuelve.

> **Orden forzado por la dependencia:** R19 primero —o al menos con A—, porque
> sin él la resolución no tiene desde dónde nacer.

---

## 7. Costo

| Fase | Unidades |
|---|---|
| **0 · Cerrar R19** — la actuación que lleva a viabilidad sin acta | 2 |
| **1 · La serie LSU** — tipo, apertura explícita, reserva de unicidad | 3 |
| **2 · La plantilla y el mapeo** — plan A | **5–6** |
| **2′ · La plantilla** — plan B, si no llega el fuente | **9–11** |
| **3 · El acto de expedir** — transacción, materialización, hash, irreversibilidad | 4 |
| **4 · La pantalla** — borrador, revisión, firma | 3 |
| **5 · R17 notificación a vecinos** | 3 |
| **6 · R18 constancia de ejecutoria** | 2 |

**Plan A: 22 unidades. Plan B: 26–28.**

**Supuesto declarado (Principio 13):** no hay medición de esfuerzo en este
proyecto; los números son estimación por analogía con trabajos comparables. La
fase 2 es la de mayor incertidumbre y la única que depende de un archivo que no
controlamos.

---

## 8. Lo que este análisis NO decide

- **El diseño de la serie LSU** (una o varias, desde qué número). Es conversación
  con Planeación.
- **Qué campos llena el ingeniero a mano.** El propietario lo listó
  —observaciones técnicas y decisión— pero hay que confirmarlo contra el formato.
- **Si el fuente del `F-PGJ-002` existe.** De eso depende la fase 2 entera.
- **Nada se implementa** hasta el ADR, y el ADR después de la reunión.

## 9. Precondiciones ajenas al código

1. El **Word o PDF del `F-PGJ-002` en blanco**. Decide plan A o B.
2. El **lockup horizontal** con el texto (el escudo ya está en el repositorio).
3. Las **decisiones de la serie LSU**.
4. Las tres precondiciones que ya bloqueaban la operación real: abrir R10,
   sembrar `counters/expedientes-{año}` y dejar de forzar `esPrueba`.
