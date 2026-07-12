---
name: linea-base-lectura-2b
description: Línea base medida de la lectura de radicados (ADR-0011, 2B) — cifras y método para comparar tras 2A
metadata:
  type: project
---

Capturada 2026-07-11 (dev-backend, incremento 2B, `docs/adr/0011-auditor-rendimiento-presupuestos.md`):
con 210 documentos en `ventanilla_radicados` (37 reales de stage + 173 sintéticos
sembrados y luego limpiados por `scripts/laboratorio/medir-linea-base-lectura.mjs`),
la consulta de `app/api/radicados/busqueda-avanzada/route.ts` (sin `limit`, patrón
O(N)) lee **210 docs** por invocación, con latencia p50 730ms / p95 824ms / máx
925ms (20 corridas calientes contra stage). Artefacto completo con método y
limitaciones declaradas en `docs/auditorias/rendimiento-base-lectura.md`.

**Why:** el propietario exige demostrar la mejora de 2A (paginación) con dato,
no con opinión (Principio 13). Sin esta línea base, 2A no tendría con qué comparar.

**How to apply:** cuando 2A (cursor/`limit` en `busqueda-avanzada/route.ts`)
esté implementado, re-correr `node scripts/laboratorio/medir-linea-base-lectura.mjs
--volumen=210 --runs=20` (mismo volumen, comparación justa) y contrastar
`docsLeidos`/latencia contra estos números. El script siembra y limpia solo
(namespaced `laboratorio.generador: 'medicion-linea-base-2b'`), no requiere
servidor corriendo (Admin SDK directo). La señal de observabilidad en sí (`operacion: 'busqueda_radicados'`,
`docsLeidos`, `latenciaMs`) ya vive en `lib/observabilidad/eventos-negocio.ts`
(extendida en este mismo incremento) — en producción se puede leer la métrica
real desde ahí en vez de medir solo desde stage.

Decisión documentada (no pendiente): el stream del dashboard
(`lib/hooks/useVentanillaRadicados.ts`, `onSnapshot` cliente) NO se instrumentó
en 2B — `registrarEventoNegocio` es primitivo server-side, no encaja en un hook
`'use client'`. Queda para 2A/dev-frontend, que de todas formas toca ese hook
para acotar la ventana del stream (`PLAN_OLA2.md` §5, 2A.4).
