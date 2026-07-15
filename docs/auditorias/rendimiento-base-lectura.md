# Línea base de rendimiento — lectura de radicados (ADR-0011, incremento 2B)

- **Fecha de la medición:** 2026-07-11
- **Responsable:** dev-backend (Ola 2, incremento 2B — ADR-0011)
- **Proyecto medido:** `ventanilla-simacota-stage` (Firestore `nam5`)
- **Punto medido:** `app/api/radicados/busqueda-avanzada/route.ts:86-94` (rol sin
  restricción de tenant — ADMIN/RECEPCIONISTA/CONTROL_INTERNO — el caso que lee
  más documentos, sin `where` adicional): `db.collection('ventanilla_radicados').orderBy('control.fechaRadicado', 'desc').get()`.
- **Propósito (Principio 13):** capturar el número ANTES de que 2A introduzca
  `limit`/cursor, para demostrar la mejora con dato, no con opinión.

## Método

1. **Volumen sintético conocido y controlado**, sembrado directamente con el
   Admin SDK (sin pasar por el endpoint público) mediante
   `scripts/laboratorio/medir-linea-base-lectura.mjs`:
   - Volumen de partida en stage: **37** documentos reales (Alcaldía Sintética,
     ADR-0002, + el radicado de auditoría protegido).
   - Se sembraron **173** documentos sintéticos adicionales — clones de la
     forma/tamaño real de un radicado existente (no *stubs* vacíos), marcados
     `isTest: true` + `excludeFromMetrics: true` + `laboratorio.generador:
     'medicion-linea-base-2b'` (namespaced, mismo patrón que
     `alcaldia-sintetica.ts`), con `control.consecutivo` en un rango fuera de
     banda (900000+) que nunca colisiona con el contador real.
   - **Volumen total medido: 210 documentos** — deliberadamente cercano al
     rango 209–216 que `docs/PLAN_OLA2.md` §7 ya identifica como el que
     desestabiliza el E2E 01 hoy, para que la línea base sea representativa
     de ese mismo punto de dolor conocido.
   - Los documentos sintéticos, al llevar `isTest: true`, quedan filtrados de
     los *resultados visibles* de la búsqueda (línea 96-98 del endpoint) —
     pero Firestore los lee igual en `query.get()`: es exactamente ese costo
     de lectura previo al filtro en memoria lo que este ADR pide medir.
2. **Medición de la consulta real** (idéntica en forma a la del endpoint,
   ejecutada directamente vía Admin SDK — no requiere servidor corriendo):
   - 1 corrida "fría" (incluye el *setup* de conexión del Admin SDK, se
     reporta aparte por no ser representativa de una petición en caliente).
   - 20 corridas "calientes" consecutivas, de las que se calculan
     min/p50/p95/max/promedio.
3. **Limpieza**: al terminar, el script borra los 173 documentos sembrados
   (namespaced por `laboratorio.generador`, nunca toca el radicado protegido
   ni fixtures de otros generadores/auditores). Verificado tras la corrida:
   stage volvió a 37 documentos, 0 residuos del generador de medición.

Reproducible con:
```
node scripts/laboratorio/medir-linea-base-lectura.mjs --volumen=210 --runs=20
# o, para dejar el volumen sembrado y re-medir en las mismas condiciones tras 2A:
node scripts/laboratorio/medir-linea-base-lectura.mjs --volumen=210 --runs=20 --mantener
node scripts/laboratorio/medir-linea-base-lectura.mjs --solo-limpiar
```

## Resultado (línea base, ANTES de 2A)

| Métrica | Valor |
|---|---|
| Documentos leídos por consulta | **210** (= tamaño total de la colección — patrón O(N), sin `limit` ni cursor) |
| Latencia fría (incl. setup Admin SDK) | 1200 ms |
| Latencia mínima (20 corridas calientes) | 656 ms |
| Latencia p50 | 730 ms |
| **Latencia p95** | **824 ms** |
| Latencia máxima | 925 ms |
| Latencia promedio | 743.4 ms |

Muestras crudas (ms, 20 corridas calientes, orden de ejecución):
`925, 761, 824, 719, 731, 741, 802, 812, 730, 716, 706, 762, 688, 686, 696, 762, 755, 656, 704, 691`

## Lectura del resultado

- **Documentos leídos escala linealmente con el tamaño de la colección**: con
  37 documentos la misma consulta lee 37; con 210, lee 210. No hay techo — es
  el patrón O(N) que el KPI #1 de `PLAN_OLA2.md` §7 describe.
- **Latencia**: p95 de 824 ms para 210 documentos, en una consulta que hoy no
  tiene límite. El propio `PLAN_OLA2.md` §7 documenta que este mismo rango de
  volumen (~209–216) ya desestabiliza el E2E 01 del dashboard — la latencia
  medida aquí es consistente con esa observación previa (antes solo
  cualitativa; ahora cuantificada).
- **Meta de 2A** (`PLAN_OLA2.md` §7): lecturas por consulta ≤ `pageSize`
  (25/50/100), independiente de N. Tras 2A, re-correr este mismo script con
  `--volumen=210` (mismo volumen, comparación justa) debe mostrar
  `docsLeidos` acotado al `pageSize` solicitado y una latencia
  proporcionalmente menor — esa comparación *antes/después* es la evidencia
  que exige el propietario (Principio 13).

## Limitación declarada del método (Principio 13 — transparencia del supuesto)

- Medición desde una máquina de desarrollo local hacia Firestore en `nam5`
  (no desde el runtime de producción de Vercel) — la latencia de red absoluta
  puede diferir del entorno real de despliegue; el **número de documentos
  leídos** (la métrica que 2A corrige directamente) es independiente del
  entorno y por tanto la comparación antes/después es válida igual.
  La latencia debe tratarse como orden de magnitud, no como SLA exacto.
- Muestra de 20 corridas (no miles): el p95 reportado es sobre una muestra
  pequeña, declarado explícitamente en vez de presentarlo como una medición
  de producción con tráfico real.

## Cobertura de instrumentación (qué quedó cubierto en este incremento)

- **Instrumentado**: `busqueda-avanzada/route.ts` — server-side, único punto
  de lectura medible sin ambigüedad de alcance. Emite `registrarEventoNegocio`
  con `operacion: 'busqueda_radicados'`, `docsLeidos` (= `snap.size`, antes
  del filtro `isTest`/paginación en memoria) y `latenciaMs`, sin PII (mismo
  saneo institucional que las 4 escrituras — control de regresión en
  `__tests__/observabilidad-lectura.test.ts`).
- **Fuera de alcance de este incremento (decisión documentada, no omisión)**:
  el stream operativo del dashboard (`lib/hooks/useVentanillaRadicados.ts`,
  `onSnapshot` sobre Firestore client SDK, `'use client'`) es lectura en el
  **navegador**, no en el servidor. `registrarEventoNegocio` es un primitivo
  server-side (usa `console.log` de Node + breadcrumb de `@sentry/nextjs`
  server); forzarlo en un hook de cliente no encaja con su diseño y no fue
  parte del pedido explícito de este incremento. Queda para 2A/dev-frontend,
  donde de todas formas se toca ese mismo hook para acotar la ventana del
  stream (`docs/PLAN_OLA2.md` §5, punto 2A.4).
