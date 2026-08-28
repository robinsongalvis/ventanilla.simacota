# ADR-0036 — El sello sobre los documentos: la copia es un derivado desechable

- **Estado:** ACEPTADO
- **Fecha:** 28-ago-2026
- **Decide:** el propietario
- **Relacionado:** ADR-0033 §4.6-bis (declarar el alcance), ADR-0028 (respaldos)

---

## 1. Contexto

El patrón físico de ventanilla es el sello de recibido: el número estampado
sobre la copia de los papeles que el ciudadano se lleva. En digital, los
documentos del expediente de licencias podían descargarse, pero salían
desnudos: sin número y sin fecha.

## 2. Decisión

> **Los documentos del expediente pueden descargarse con el número de radicado y
> la fecha estampados en cada página. El original queda intacto en Storage: el
> sello solo existe en la copia.**

Y la condición que gobierna todo lo demás:

> **La copia sellada es un DERIVADO DESECHABLE Y REGENERABLE. El original es el
> expediente, y es el único que se respalda.**

## 3. Materialización perezosa, y por qué no las otras dos

La descarga normal es hoy un `302` a una URL firmada: los bytes van de Storage
al navegador **sin pasar por el servidor**.

| | Al vuelo | Materializar siempre | **Perezoso (elegido)** |
|---|---|---|---|
| Bytes por descarga | ~10 MB entran + 10 MB salen de la función, cada vez | 0 | 0 |
| Almacenamiento | ×1 | ×2 de todo | ×2 solo de lo pedido |
| Rompe el patrón actual | **Sí** | No | No |

Se sella la primera vez que alguien lo pide y se guarda; a partir de ahí es un
`302` como cualquier otro.

**Contraste deliberado con la constancia de radicación**, que se decidió
*derivada sin materializar*: aquella se genera **de datos nuestros**, es
determinista y pesa nada, y materializarla habría creado una segunda verdad que
puede desviarse de la actuación. El sello se aplica sobre **bytes que no son
nuestros** y su resultado es una **copia para entregar**, no una afirmación de un
hecho. Mismo razonamiento, conclusión opuesta.

## 4. El respaldo excluye `sellados/`, declarándolo

`scripts/backups/verificar-respaldo-adjuntos.mjs` lo declara en
`PREFIJOS_EXCLUIDOS` **con su razón, y lo imprime en el informe**. Excluir es
legítimo; excluir sin darse cuenta no.

La exclusión se aplica **a los dos lados** de la conciliación: si solo se
excluyera del respaldo y no de las referencias, cada copia sellada aparecería
como un adjunto perdido y el informe gritaría en falso hasta que alguien dejara
de leerlo.

**Nota de alcance:** esto cambia también la postura para las copias selladas de
los radicados de ventanilla, que ya vivían bajo `sellados/` y sí se respaldaban.
Se acepta por el mismo motivo: son regenerables desde el original.

## 5. La página que no admite el sello

**No se aborta el documento entero.** Perder cuarenta sellos porque la página 37
era un recorte es un castigo desproporcionado. Se sellan las que admitan y se
devuelve `paginasSinSello` para que la pantalla lo diga.

**Pero no pasa en silencio.** La pantalla nombra las páginas que quedaron sin
sello y cuántas sí lo llevan.

**Y si no se pudo sellar ninguna, falla**: entregar una «copia sellada» sin un
solo sello afirmaría con el nombre del archivo algo que el documento no dice.

### El hallazgo que cambió esta regla

La geometría **encoge** el sello para que quepa, así que «no cabe» solo ocurre
en páginas de menos de 24 pt (0,85 cm) — un caso que no existe. **El problema
real era el contrario**: en una página pequeña el sello cabía *encogido hasta
ser ilegible*, y eso se reportaba como estampado con éxito.

Por eso se añadió un **suelo de legibilidad** (120 × 52 pt, cotas derivadas del
contenido: las cuatro líneas del sello y el ancho del número en Courier 8,5).
Por debajo de él la página cuenta como **sin sello** y se nombra. Un sello que
nadie puede leer no es un sello.

**La constancia va en la pantalla, no en el papel**: la página sin sello es, por
definición, la que no tiene sitio para uno.

## 6. Alcance declarado: solo PDF

El expediente admite PDF, JPG, PNG, WEBP, DOCX, XLSX y PPTX. **El sello solo
existe para PDF.**

Para los demás, la pantalla **dice por qué** —«es una imagen JPG, y el sello solo
puede estamparse sobre PDF»— en vez de esconder el botón. Un botón que aparece
unas veces sí y otras no lleva a la funcionaria a concluir que el sistema falla.

## 7. Qué NO decide este ADR

- **Un sello para imágenes y ofimática.** Requeriría convertir a PDF primero, y
  esa conversión es otra decisión con sus propios riesgos de fidelidad.
- **Si la copia sellada tiene valor probatorio.** Aquí se decide expresamente que
  **no**: es una comodidad de entrega, y el original es el registro.
- **La limpieza de `sellados/`.** Hoy nada las borra. Al ser regenerables, una
  política de retención es posible y no urgente.
