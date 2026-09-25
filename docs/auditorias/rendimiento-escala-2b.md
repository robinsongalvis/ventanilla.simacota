# Demostración de escala — lectura de radicados (ADR-0011, incremento 2B)

- **Fecha de la medición:** 2026-07-11
- **Responsable:** devops (Ola 2, incremento 2B — ADR-0011)
- **Proyecto medido:** `ventanilla-simacota-stage` (Firestore `nam5`)
- **Script:** `scripts/laboratorio/medir-escala-lectura.mjs` (hermano de
  `medir-linea-base-lectura.mjs`), volumen sintético namespaced + autolimpiable.
- **Pregunta del propietario que responde con evidencia:** *"¿Puede la
  plataforma crecer durante años sin que el rendimiento se degrade de forma
  perceptible?"*

## Método

Contra stage, a volúmenes **crecientes** (N = 50, 200, 800 documentos totales
en la colección), se ejecutan y comparan dos patrones de lectura sobre la misma
colección `ventanilla_radicados`:

- **SIN_COTA** (línea base O(N)) — `.orderBy('control.fechaRadicado','desc').get()`:
  el patrón exacto de `app/api/radicados/busqueda-avanzada/route.ts` y de la
  línea base (`rendimiento-base-lectura.md`). Lee **toda** la colección.
- **ACOTADA** (meta de 2A, ADR-0010) — `.orderBy(...).limit(pageSize).get()`
  con `pageSize = 100`: lee **≤ pageSize** documentos, independiente de N.

Volumen sintético namespaced (`laboratorio.generador = 'medicion-escala-2b'`,
`control.consecutivo` fuera de banda 800000+, `isTest`+`excludeFromMetrics`),
sembrado con Admin SDK directo (sin pasar por el endpoint). 10 corridas
calientes por patrón y por N (1 fría descartada). **Autolimpieza garantizada**
al terminar (bloque `finally` + limpieza de emergencia en `catch`): stage se
deja como se encontró.

Reproducible con:

```
node scripts/laboratorio/medir-escala-lectura.mjs --volumenes=50,200,800 --runs=10 --pageSize=100 --json
node scripts/laboratorio/medir-escala-lectura.mjs --solo-limpiar   # limpieza manual si hiciera falta
```

## Resultado (medición real, 2026-07-11)

| N (total) | SIN_COTA docs leídos | SIN_COTA p95 | ACOTADA docs leídos | ACOTADA p95 |
|---|---|---|---|---|
| 50 | 50 | 486 ms | 50 | 546 ms |
| 200 | 200 | 856 ms | 100 | 742 ms |
| 800 | 800 | 1941 ms | 100 | 760 ms |

Detalle p50 (ms): SIN_COTA 423 / 687 / 1456 · ACOTADA 422 / 534 / 526.

Volumen inicial de stage: 39 documentos reales. Volumen final tras autolimpieza:
39 (0 residuos del generador de escala) — verificado por el propio script.

## Lectura del resultado

- **SIN_COTA escala linealmente con N**: documentos leídos = N (50 → 200 → 800)
  y la latencia p95 crece con el volumen (486 → 856 → **1941 ms**). Es el patrón
  O(N) que R11 describe: el costo de cada lectura queda acoplado al histórico
  total de la plataforma. A N = 10.000 (un municipio real a algunos años) esta
  curva seguiría subiendo.
- **ACOTADA se mantiene ~plana**: documentos leídos topados en `min(N, pageSize)`
  = 100 y la latencia p95 **independiente de N** (546 → 742 → **760 ms**). Entre
  N = 200 y N = 800 (4× más volumen) la lectura acotada no cambia — ni en
  documentos ni en latencia perceptible.
- **A N = 800**: la lectura acotada lee **8× menos documentos** (100 vs 800) y es
  **~2.6× más rápida** en p95 (760 ms vs 1941 ms). La brecha se ensancha con N:
  a mayor histórico, mayor la ventaja del patrón acotado.
- **Coherencia con la línea base** (`rendimiento-base-lectura.md`, 210 docs →
  p95 824 ms): el punto SIN_COTA a N ≈ 200 (856 ms) reproduce esa medición con
  método independiente, confirmando la validez de ambas.

**Conclusión (respuesta a la pregunta del propietario):** con la lectura
acotada (patrón que 2A instala y que el presupuesto de rendimiento 2B blinda),
el costo de consulta deja de crecer con el volumen — la plataforma puede crecer
durante años sin degradación perceptible de la lectura de radicados. Con el
patrón SIN_COTA, no.

## Limitaciones declaradas del método (Principio 13)

- Medición desde máquina de desarrollo hacia Firestore `nam5` (no desde el
  runtime de producción de Vercel): la latencia absoluta puede diferir; el
  **número de documentos leídos** —la métrica que la acotación corrige
  directamente— es independiente del entorno, por lo que la comparación es
  válida igual. Tratar la latencia como orden de magnitud, no como SLA.
- Muestra de 10 corridas por punto (no miles): p50/p95 sobre muestra pequeña,
  declarado explícitamente.
- El patrón ACOTADA aquí es la referencia de lo que 2A debe lograr en el
  endpoint real; en este árbol la búsqueda avanzada **aún** lee SIN_COTA (2A
  paso 1 pendiente — ver el estado `PENDIENTE_2A` del presupuesto de
  rendimiento y el escalamiento del incremento 2B).

## Relación con el control (presupuesto de rendimiento)

Esta demostración es la **evidencia de escala**; el **control de regresión** que
impide volver al patrón O(N) es `scripts/laboratorio/presupuesto-rendimiento.mjs`
(cableado en `.github/workflows/ci.yml`, paso "Presupuesto de rendimiento").
Juntos cierran el ciclo del propietario: evidencia de que la lectura acotada
escala + control automatizado que impide la regresión.
