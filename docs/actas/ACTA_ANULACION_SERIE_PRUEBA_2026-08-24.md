# Acta de anulación de la serie de prueba 2026 (ronda 2)

**Fecha:** 24 de agosto de 2026
**Autoriza:** el propietario del proyecto, por chat.
**Ejecuta:** `scripts/operacion/limpiar-datos-prueba.mjs --ronda 2026-08-24`
**Antecedente:** [ACTA_LIMPIEZA_DATOS_PRUEBA_2026-08-23.md](ACTA_LIMPIEZA_DATOS_PRUEBA_2026-08-23.md) (ronda 1)
**Plan:** `docs/planes/PLAN_GO_LIVE.md` §Limpieza

---

## 1. Qué se pidió y qué se hace

El propietario pidió **borrar** los radicados que quedaban visibles en el
tablero (números 9 a 24, y el 27). Tras verificarlo contra el código, **no se
borra ninguno: se anulan los 17 con constancia.** El motivo está en §2.

## 2. Por qué no se borran — el consecutivo es UNO SOLO

Los números de esa lista llevan prefijos distintos (`1-WEB-`, `1-OFICIO-`,
`1-EMAIL-`, `1-PRESENCIAL-`, `1-110-`), y eso invita a creer que son series
separadas. No lo son:

- `lib/radicado-institucional.ts` es explícito: *«El consecutivo anual
  continúa: solo cambia la máscara»*, y el contador es único por año
  (`counters/radicados-{año}`). El prefijo es una **etiqueta de canal**, no una
  serie.
- La consulta pública los acepta en **una sola expresión regular**:
  `^1-(110|WEB|OFICIO|EMAIL|PRESENCIAL)-\d{4}(?:0[1-9]|1[0-2])?-\d{8}$`
  (`lib/seguridad/consulta-publica-radicado.ts`). El buscador los llama
  literalmente *«etiqueta histórica por canal»*.
- La numeración lo confirma: 9, 10, …, 24 → **25 y 26 (ya anulados en la ronda
  1)** → 27. Continua, sin saltos ni repeticiones.

Borrar del 9 al 24 dejaría un hueco de dieciséis números en **la misma serie**
cuya integridad se protegió el 23 de agosto al negarse a borrar el 25 y el 26.
Un hueco en la foliación es indistinguible de una pérdida documental
(AGN 060/2001) — que es exactamente lo que una auditoría busca.

## 3. Condición sin la cual esto no se ejecuta

Varios de los registros están **vencidos** (hasta 34 días) y algunos llevan
nombres con cédula que no son los del propietario. Se preguntó de forma
explícita, y el propietario **confirmó que los 17 son datos de prueba propios**
(suyos, de Andrés o inventados durante la construcción) y que **ninguno
corresponde a una petición de un ciudadano real**.

Esa confirmación es la que autoriza la anulación. Si alguno fuera real, anular
su número dejaría sin efecto una petición viva y borraría la evidencia de un
incumplimiento de términos.

## 4. Objetivos (17)

| # | Radicado | Fecha | Solicitante (según el tablero) |
|---|---|---|---|
| 9 | `1-OFICIO-2026-00000009` | 01/06/26 | Robinson David Galvis |
| 10 | `1-WEB-2026-00000010` | 09/06/26 | identidad protegida |
| 11 | `1-WEB-2026-00000011` | 11/06/26 | identidad protegida |
| 12 | `1-WEB-2026-00000012` | 11/06/26 | Robinson David Galvis |
| 13 | `1-WEB-2026-00000013` | 14/06/26 | Robinson David Galvis |
| 14 | `1-WEB-2026-00000014` | 15/06/26 | Robinson David Galvis |
| 15 | `1-WEB-2026-00000015` | 17/06/26 | Carlos Alberto García Ferreira |
| 16 | `1-WEB-2026-00000016` | 30/06/26 | Robinson David Galvis |
| 17 | `1-OFICIO-2026-00000017` | 01/07/26 | Robinson David Galvis |
| 18 | `1-OFICIO-2026-00000018` | 02/07/26 | Robinson David Galvis Quintero |
| 19 | `1-OFICIO-2026-00000019` | 02/07/26 | robindon |
| 20 | `1-PRESENCIAL-2026-00000020` | 02/07/26 | Jaime Durán |
| 21 | `1-OFICIO-2026-00000021` | 06/07/26 | identidad protegida |
| 22 | `1-EMAIL-2026-00000022` | 06/07/26 | robindon |
| 23 | `1-OFICIO-2026-00000023` | 08/07/26 | Carlos Alberto García Ferreira |
| 24 | `1-WEB-2026-00000024` | 09/07/26 | identidad protegida |
| 27 | `1-110-202608-00000027` | 17/08/26 | Andrés Camilo Montaño Quintero |

Tratamiento idéntico al de la ronda 1: `isTest` + `excludeFromMetrics` (el
mecanismo que ya los saca de bandeja y de métricas), bloque `anulado` con
referencia a esta acta, y entrada de trazabilidad `ANULACION_DATO_PRUEBA`.
El registro **queda**; el número se pierde **con constancia**.

## 5. Rectificación del acta del 23-ago sobre estos 17

El acta anterior, bajo «No se tocan», los declaró por escrito **«archivo real
del municipio»**, por no llevar marca explícita de prueba. Esta acta
**sustituye esa determinación** para esos 17 registros. La evidencia nueva es
la confirmación expresa del propietario del 24-ago-2026: son datos de prueba
propios y ninguno corresponde a una petición ciudadana real. Se deja
constancia del cambio para que la cadena de custodia no muestre dos actas
consecutivas afirmando lo contrario sin explicación.

## 6. Defecto corregido en la herramienta

El clasificador del inventario decidía la pertenencia a la serie **por el
aspecto del id** (`RE_SERIE_LEGAL` solo reconocía `1-110-`, `2-SAL/2-110-` y
`PL-`). Con esa regla, los 16 radicados de canal habrían salido **«C1
borrables»** — la herramienta habría recomendado justo lo que esta acta
prohíbe. Es la segunda vez que la misma constante se queda corta: el ensayo en
stage ya la había pillado cuando no cubría las salidas.

Se corrigió en dos niveles:

1. **Criterio primario, estructural** — y en dos condiciones, porque la
   revisión adversarial tumbó dos versiones previas de esta regla:
   `control.consecutivo` (bajo `control`, no en la raíz) debe **casar con la
   cola numérica del id** *y* estar **dentro del rango ya emitido por el
   contador**. Ninguna basta sola: el botón E2E fabricaba
   `control.consecutivo` desde su `testRunId` sin tocar el contador y generaba
   el id con `Date.now() % 1e8` **rellenado a ocho con ceros**, así que ni
   «tiene el campo» ni «empieza por ceros» prueban nada. El contador se lee,
   jamás se escribe (DF-9); si no se puede leer, ningún borrado se autoriza.
2. **Guarda en el limpiador:** ningún objetivo de BORRADO puede tener
   `consecutivo`. Si lo tiene, el script **aborta completo** y exige decidirlo
   en un acta. Una lista mal armada ya no puede provocar un borrado en la serie.

El regex se conserva como señal secundaria, ampliado a las etiquetas de canal
**pero anclado a los ceros de relleno** (`000` + 5 dígitos): el botón E2E
emitía `1-WEB-2026-{8 dígitos aleatorios}` sin tocar el contador, y esos sí
eran borrables — se borraron en la ronda 1 y estuvo bien.

## 7. Verificación

- 13 casos de clasificación probados, incluidos los cuatro aleatorios del botón
  E2E que **deben** seguir dando «fuera de la serie»: los 13 correctos.
- Guardas comprobadas: sin `--ronda` aborta; ronda inexistente aborta;
  credencial de otro proyecto aborta; sin credencial aborta. Ninguna llega a
  leer la base.
- Integridad de la lista: 17 ids únicos, cada uno casa con su `consecutivo`,
  y la ronda no contiene ninguna orden de borrado.
- Criterio de serie probado con 8 casos, **incluido un id del E2E con ceros de
  relleno** que la versión anterior daba por miembro de la serie.
- `tsc --noEmit` y `eslint` limpios tras incorporar al tipo los campos
  `isTest`, `excludeFromMetrics` y `anulado`, que el código usaba desde hacía
  meses sin declararlos.

### Lo que la revisión adversarial tumbó de mi primera versión

| Defecto | Efecto real |
|---|---|
| La huella leía `consecutivo` en la **raíz**; vive en `control.consecutivo` | El script habría abortado en los 17 sin escribir nada — inútil, aunque sin daño |
| La «guarda estructural» usaba esa misma ruta | Era **código muerto**: nunca protegía de nada |
| El criterio «tiene el campo ⇒ consumió el contador» | **Falso**: el E2E fabrica el campo sin tocar el contador |
| El ancla «empieza por ceros» del regex | El E2E rellena con `padStart(8,'0')`: puede colisionar |
| `retrato()` leía `fechaRadicacion` / `fechaCreacion` | Campos inexistentes: la columna FECHA salía «—» en las 17 filas, dejando al humano sin nada que comparar |
| El dry-run imprimía el nombre de solicitantes con **identidad reservada** | Fuga de PII en la terminal, justo lo que la ley protege |
| `RONDAS[rondaPedida]` sin `Object.hasOwn` | `--ronda constructor` pasaba la guarda y reventaba con un stack trace |

## 8. Ejecución

**Advertencia sobre el alcance real de la anulación.** Marcar `isTest` +
`excludeFromMetrics` + `anulado` los saca de la bandeja operativa, de la
búsqueda avanzada, del reporte MIPG, de los dos crones de plazo legal y —desde
este cambio— de Control Interno. **No los saca de la consulta pública del
ciudadano**, que no filtra por estas marcas: quien tenga el número seguirá
viendo el radicado como si estuviera en trámite. Queda anotado como pendiente;
no bloquea esta ronda porque nadie de fuera conoce esos números.

_(a completar por el propietario tras correr el comando)_

- Dry-run:
- Ejecución (`CONFIRMO_LIMPIEZA=SI`):
- Verificación de cierre (re-inventario):

## 9. Consecuencia pendiente de decidir

Anulados el 25, 26 y ahora del 9 al 24 y el 27, **la serie 2026 de este sistema
queda sin ningún radicado real**. El contador, en cambio, sigue en 27: el
primer radicado auténtico nacería como el número **28**.

Hay que decidir con la alcaldía —y dejarlo por escrito— **con qué número debe
abrir la operación real**. Si el libro de la alcaldía va por otro número, abrir
en 28 rompe la continuidad institucional que motivó adoptar el formato `1-110`.
Esta decisión pertenece al paquete PT-7 del plan y **debe cerrarse antes de
recibir la primera petición ciudadana**, porque después ya no se puede cambiar
sin tocar números emitidos.
