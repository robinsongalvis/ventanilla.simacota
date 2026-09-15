# Acta de apertura de series — 15-sep-2026

- **Base:** ADR-0031 (apertura explícita), ADR-0041 paso 5, ADR-0016 (consecutivo atómico)
- **Ordena:** el propietario, tras confirmar los números directamente con la Secretaría de Planeación
- **Estado:** **ENSAYADA EN STAGE.** Producción **pendiente de ejecución por el propietario**

---

## 1. Qué se abre, y con qué número

| Serie | Contador venía de | Queda en | Primer número que emitirá |
|---|---|---|---|
| `expedientes` | 2 | 25 | **26** → `68745-0-26-0026` |
| `actos-lsr` | 0 | 13 | **14** → `LSR No. 014-2026` |

`desde` es el PRIMER número a emitir, así que el contador queda en `desde − 1`:
la próxima emisión suma uno y sale el número pedido. Confundirlo desplaza la
serie entera en uno, que es un error silencioso y caro.

**Fuente de los números** (confirmada con Planeación el 15-sep-2026):

- Libro `CONSECUTIVO LICENCIAS Simacota Santander.xlsx`, último asentado de
  2026: `68745-0-26-0025`.
- Libro de resoluciones, última LSR expedida: `013 de 2026`.

## 2. Qué NO se abre, y por qué

**Las otras cinco series de actos** —`actos-lc`, `actos-lsu`, `actos-ph`,
`actos-lr`, `actos-lu`— existen en el dominio pero **quedan sin abrir**. No es
un olvido: la orden fue abrir LSR, y una serie sin abrir **no puede emitir**
(ADR-0031). Abrirlas es un acto aparte, el día que se vaya a expedir en esa
modalidad, con su propio número confirmado del libro.

**`actos-la` no existe.** La ampliación comparte el consecutivo de construcción
mientras no se aclare la descripción del ingeniero —«es la misma de LC en
términos, pero siguen siendo diferentes»—. El criterio está razonado en
`lib/motor-expedientes/acto-lsr/serie-acto-lsr.ts`: entre abrirle serie propia
y hacerla compartir, se eligió el error recuperable. Un hueco se explica con
acta; un número repetido ya está notificado a dos ciudadanos.

**`radicados`, `salidas` y `planillas`** no llevan punto de apertura
configurado y el script las dejó intactas.

## 3. Lo que este acto NO habilita

> **No se emitió ningún expediente ni ninguna licencia.**

`EMISION_REAL_EXPEDIENTES_HABILITADA` sigue en `false`
(`lib/server/expedientes-licencias.ts:74`). Abrir la serie es el **requisito
previo** de la emisión, no el interruptor. Encenderla es el paso 6 del ADR-0041
y es otra decisión, del propietario.

## 4. Evidencia

El script graba el salto dentro de cada contador. Verificado tras la ejecución
en stage:

```
counters/expedientes-2026 → { ultimo: 25, apertura: { veniaDe: 2, abiertoEn: 26,
  fecha: 2026-09-15T00:33:29.699Z, autorizadoPor: "Secretaría de Planeación e
  Infraestructura — confirmado con el propietario el 2026-09-15",
  referencia: "Libro CONSECUTIVO LICENCIAS: último asentado 68745-0-26-0025" } }

counters/actos-lsr-2026 → { ultimo: 13, apertura: { veniaDe: 0, abiertoEn: 14,
  fecha: 2026-09-15T00:33:29.699Z, autorizadoPor: "…",
  referencia: "Libro de resoluciones: última expedida LSR No. 013-2026" } }
```

Cada uno lleva además `motivoDelSalto`, que explica por qué la serie se abre por
encima del libro y no en el siguiente: entre la consulta y el arranque puede
colarse un radicado manual, y **un hueco se explica con acta, un duplicado no se
arregla**.

**Acto único, comprobado:** al volver a ejecutar sobre las series ya abiertas,
el script responde *«NO se toca: bajar un contador es emitir dos veces el mismo
número»* y no escribe. La apertura no se puede aplicar dos veces por error.

## 5. Producción — lo que falta, y quién lo hace

El ensayo se hizo contra `ventanilla-simacota-stage`. **Producción la abre el
propietario**, y esta máquina no tiene ni debe tener sus credenciales
(`.env.produccion` no existe aquí).

Dos pasos, en este orden:

**1 · Fijar el punto de apertura** en `configuracion/series` de producción:

```
apertura: {
  expedientes: { desde: 26, autorizadoPor: "<quien autoriza>",
                 referencia: "Libro CONSECUTIVO LICENCIAS: último asentado 68745-0-26-0025" },
  "actos-lsr": { desde: 14, autorizadoPor: "<quien autoriza>",
                 referencia: "Libro de resoluciones: última expedida LSR No. 013-2026" }
}
```

**2 · Ejecutar**, primero en seco y después de verdad:

```bash
export FIREBASE_SERVICE_ACCOUNT="$(grep '^FIREBASE_SERVICE_ACCOUNT=' .env.produccion | cut -d= -f2-)"
node -e "console.log(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id)"   # debe decir ventanilla-unica-f31b1
node scripts/operacion/abrir-series.mjs --proyecto ventanilla-unica-f31b1            # DRY-RUN
CONFIRMO_APERTURA=SI node scripts/operacion/abrir-series.mjs --proyecto ventanilla-unica-f31b1
```

**Antes de ejecutar el segundo**, contraste contra el libro lo que imprima el
dry-run: tiene que decir `EL PRIMER NÚMERO SERÁ: 26` para expedientes y `14`
para actos-lsr. Si el libro avanzó desde la confirmación, **pare y vuelva a
fijar el punto** — el script no puede saberlo por su cuenta.

> Aviso de la carga de credenciales: `source .env` **no sirve** — el shell se
> come las comillas del JSON. Use el `export` de arriba, tal cual. En el ensayo
> del 13-ago-2026 el script abortó por esto (sin escribir nada, que es lo
> correcto).

## 6. Salvedades jurídicas — se mantienen intactas

Este acto **no toca** ninguna de ellas:

- La vigencia se sigue contando **desde la expedición**, apartándose del
  D.1783/2021 art. 27 transcrito como «desde la firmeza», con la salvedad
  escrita en `acto-lsr/decisiones-tomadas.ts`.
- El **concepto escrito de Jurídica** sigue pendiente: momento de la
  reanudación del término, renuncia expresa y descuento expedición→comunicación
  (`CONSULTA_JURIDICA_REANUDACION_TERMINO.md`).
- El **texto de recursos** aplica «solo reposición»; su fórmula exacta sigue
  reservada al concepto escrito.
