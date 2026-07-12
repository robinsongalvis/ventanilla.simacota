# ADR-0010 — Escalabilidad de la consulta de radicados: paginación por cursor + ventana del stream (2A, R11)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (validó la Ola 2)
- **Roles consultados:** arquitecto-principal + firestore-datos (diseño), dev-backend + seguridad (revisión), coordinador

## Contexto

R11 confirmado en código y **medido** (línea base 2B, `docs/auditorias/rendimiento-base-lectura.md`):
la consulta de radicados lee la colección completa. Base actual: **210 documentos leídos por
consulta, p95 824 ms** con volumen controlado — patrón O(N), crece con el total de la
plataforma. Evidencia: `app/api/radicados/busqueda-avanzada/route.ts:86-94` (`.orderBy().get()`
sin `limit`; paginación en memoria en `lib/busqueda/filtros-radicado.ts`), y
`lib/hooks/useVentanillaRadicados.ts` (`onSnapshot` sobre la colección; para ADMIN/RECEPCIONISTA/
CONTROL_INTERNO sin `where` de tenant = tiempo real de toda la colección).

## Decisión

Acotar toda lectura de radicados para que el nº de documentos leídos sea **independiente de N**:

1. **Búsqueda avanzada (server):** paginación por **cursor** (`startAfter`) + `limit` server-side
   en `busqueda-avanzada/route.ts` + `lib/busqueda/filtros-radicado.ts`; eliminar la paginación
   en memoria sobre toda la colección. Lecturas por consulta ≤ `pageSize` (25/50/100).
   **Coordinación obligatoria con `task_7f9e8ba3`** (misma ruta): verificar su estado antes de
   tocar; si ya paginó, este ADR se reduce a validar + el resto de los frentes.
2. **Stream operativo (cliente):** acotar `useVentanillaRadicados` a una **ventana** (temporal
   reciente y/o `limit`) en vez de suscribir la colección completa; el histórico se consulta por
   la búsqueda paginada. `useAnalytics` (`app/interno/dashboard/components/...useAnalytics.ts`)
   se adapta a datos acotados o su agregación se mueve a una consulta agregada (a delimitar en
   implementación; si excede el alcance, se declara y difiere).

**Preservación (condición del propietario):** el aislamiento por tenant NO cambia — los `where`
de tenant y las reglas (P-B/R8) se mantienen intactos; esto es acotamiento de volumen, no de
alcance de acceso. Trazabilidad y cumplimiento intactos.

## Alternativas evaluadas

1. **Mantener paginación en memoria.** Descartada: sigue leyendo O(N); no resuelve R11.
2. **Rearquitectura completa (colección por tenant / índices agregados materializados).** Diferida:
   mayor riesgo; la paginación por cursor da la mayor parte del retorno con bajo riesgo (YAGNI).

## Consecuencias

- **Positivas:** lecturas ≤ `pageSize` independientes del volumen total → levanta el techo de R11;
  costo y latencia dejan de crecer con la plataforma.
- **Deuda declarada:** otras lecturas "leer todo" de menor criticidad (`reportes/mipg/excel`,
  `ai/copilot`, `control-interno`) heredan el patrón y se abordan después; la agregación de
  analítica sobre ventana puede requerir una consulta agregada propia (a decidir en implementación).

## Control de regresión (obligatorio)

- **Presupuesto de rendimiento en CI (2B):** falla si una consulta de radicados lee sin límite o
  supera el umbral de documentos — probado por mutación (una consulta ilimitada rompe el job).
- **Re-medición vs. línea base:** tras 2A, volver a medir docs/consulta y latencia con el mismo
  método de `medir-linea-base-lectura.mjs`; la mejora se demuestra con dato (≤ pageSize vs. 210).
- **E2E sin regresión:** bandeja (stream acotado) y búsqueda (paginada) verdes.
