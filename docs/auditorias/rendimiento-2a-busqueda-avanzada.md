# Re-medición 2A — `busqueda-avanzada/route.ts` acotada (ADR-0010 §2.1, R11)

- **Fecha de la medición:** 2026-07-11
- **Responsable:** dev-backend (Ola 2, incremento 2A — ADR-0010 §2.1, cierre de R11)
- **Proyecto medido:** `ventanilla-simacota-stage` (Firestore `nam5`)
- **Propósito (Principio 13):** demostrar con dato, al MISMO volumen que la
  línea base (`docs/auditorias/rendimiento-base-lectura.md`, N = 210), la
  mejora del endpoint tras acotar `busqueda-avanzada/route.ts` por lotes con
  cursor (`limit` + `startAfter`), reemplazando el `.orderBy().get()` sin
  límite que leía la colección completa.

## Qué cambió en el código medido

`app/api/radicados/busqueda-avanzada/route.ts` ya no ejecuta
`db.collection('ventanilla_radicados').orderBy(...).get()` (sin límite). Ahora
escanea por lotes de tamaño `pageSize` con cursor (`limit(pageSize)` +
`startAfter(cursor)`), aplicando en memoria — por lote, no sobre toda la
colección — los filtros no empujables a Firestore (`filtrarLote`, reutilizado
de `lib/busqueda/filtros-radicado.ts`), hasta reunir la página pedida o tocar
un techo duro `MAX_DOCS_ESCANEADOS = 500` (detalle de diseño y por qué no es
un `≤ pageSize` estricto en todos los casos: comentario de cabecera del route
+ ADR-0010 §2.1).

**Caso medido aquí — el mismo que la línea base**: rol sin restricción de
tenant (ADMIN/RECEPCIONISTA/CONTROL_INTERNO), **sin filtros activos**,
página 1. Es el caso que la auditoría de línea base ya identificó como "el
que lee más documentos, sin `where` adicional", y es también el que
`app/interno/dashboard/components/BusquedaAvanzadaPanel.tsx` dispara por
defecto al abrir el panel (sin filtros). Bajo esas condiciones, el nuevo
código ejecuta **exactamente un lote**: `orderBy(fechaRadicado desc).limit(pageSize).get()`
— sin filtros que descartar, la primera página del escaneo ya satisface el
objetivo y el bucle termina en la primera vuelta. Esto es idéntico, línea por
línea, al patrón `ACOTADA` que `scripts/laboratorio/medir-escala-lectura.mjs`
ya mide (hermano de `medir-linea-base-lectura.mjs`), así que se reutiliza sin
modificarlo.

## Método

Mismo volumen sintético namespaced que la línea base y la demostración de
escala (Admin SDK directo, `isTest`+`excludeFromMetrics`, fuera de banda,
autolimpiable):

```
node scripts/laboratorio/medir-escala-lectura.mjs --volumenes=210 --runs=20 --pageSize=25
```

`pageSize=25` porque es el valor por defecto del panel de Búsqueda Avanzada
(`BusquedaAvanzadaPanel.tsx`, `useState<25|50|100>(25)`); `volumenes=210` para
comparar al MISMO N que la línea base (2026-07-11, `rendimiento-base-lectura.md`).

## Resultado (antes/después, mismo N = 210)

| Patrón | Documentos leídos | p50 | p95 |
|---|---|---|---|
| **SIN_COTA** (línea base, código anterior) | 210 | 730 ms | **824 ms** |
| **SIN_COTA** (re-confirmado en esta corrida, mismo patrón, N=210) | 210 | 807 ms | 891 ms |
| **ACOTADA** (código nuevo, `busqueda-avanzada` real, N=210, pageSize=25) | **25** | 383 ms | **426 ms** |

- **Documentos leídos: 210 → 25** (−88 %) al mismo volumen.
- **Latencia p95: 824 ms → 426 ms** (~2× más rápido) al mismo volumen.
- La fila "SIN_COTA re-confirmado" es el mismo patrón `.orderBy().get()` sin
  límite ejecutado en esta misma corrida (no el código de producción, que ya
  no existe con esa forma) — se incluye para verificar que el volumen
  sembrado (210) y las condiciones de red son comparables a la línea base
  original (824 ms vs 891 ms, mismo orden de magnitud — variación normal
  entre corridas, no una regresión).
- Autolimpieza verificada por el script: volumen final de stage = volumen
  inicial (39), 0 residuos del generador `medicion-escala-2b`.

## Independencia de N (evidencia ya existente, reutilizada)

La propiedad clave de R11 no es solo "más rápido a N=210" sino que el costo
**deja de crecer con N**. Esa curva ya está demostrada en
`docs/auditorias/rendimiento-escala-2b.md` (N = 50/200/800 → ACOTADA se
mantiene plana en documentos leídos y latencia) para el mismo patrón
`.limit(pageSize).get()` que ahora es real en producción. No se repite aquí
para no duplicar evidencia; se referencia porque el patrón medido allí es,
tras este incremento, exactamente el que ejecuta el endpoint en el caso sin
filtros.

## Caso NO cubierto por esta medición (declarado, Principio 13)

Con **filtros de texto libre activos** (subcadena en nombre/documento/correo/
asunto/responsable, `q` libre) que Firestore no puede resolver server-side,
el escaneo puede necesitar más de un lote — acotado por el techo duro
`MAX_DOCS_ESCANEADOS = 500` (`scripts/laboratorio/presupuesto-rendimiento.mjs`
lo enforce: falla si esa constante sube del techo INTERACTIVO). Ese caso no
se midió empíricamente en esta corrida (requeriría poblar datos con
distribución de texto controlada para forzar un escaneo multi-lote
representativo); la garantía en ese caso es **analítica y por diseño**, no
por N: en el peor caso se leen hasta 500 documentos, nunca más, sin importar
cuánto crezca la colección — la misma cota ya validada empíricamente para el
patrón `ACOTADA` en `rendimiento-escala-2b.md` hasta N=800. Queda como
mejora de instrumentación declarada para un incremento futuro si el patrón de
uso real muestra que las búsquedas con filtros de texto libre son frecuentes
y profundas (medir antes de invertir más, Principio 13).

## Relación con el control de regresión

`app/api/radicados/busqueda-avanzada/route.ts` se promovió de `PENDIENTE_2A`
a `ACOTADA` en el REGISTRO de `scripts/laboratorio/presupuesto-rendimiento.mjs`
(cota declarada: `const MAX_DOCS_ESCANEADOS = 500`). El presupuesto ahora
ENFORCE esta superficie: perder el `limit`/cursor, o subir la cota por
encima de 500, rompe `npm run presupuesto:rendimiento` (verificado en verde
tras la promoción). R11 queda RESUELTO en el núcleo que la línea base midió.
