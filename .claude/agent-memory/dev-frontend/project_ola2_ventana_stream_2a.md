---
name: ola2-ventana-stream-2a
description: Frente 2A (Ola 2, ADR-0010, R11) — ventana operativa del stream del dashboard, criterio y semántica cambiada en useAnalytics
metadata:
  type: project
---

`lib/hooks/useVentanillaRadicados.ts` ya no suscribe la colección completa en
tiempo real. Se acotó con `where('control.fechaRadicado','>=',cutoff)` +
`limit(LIMITE_DOCUMENTOS_STREAM)` — `VENTANA_DIAS_STREAM = 180` días,
`LIMITE_DOCUMENTOS_STREAM = 500`.

**Por qué 180 días:** el término legal más largo del catálogo
(`lib/catalogos/tipos-solicitud.ts`) es 45 días hábiles; la prórroga máxima
duplica el término inicial (Ley 1755/2015 art. 14) → hasta 90 días hábiles
≈ ~126 días calendario en el peor caso legal. 180 días da margen (~54 días)
sin volver a acoplar la lectura al volumen histórico total. Riesgo residual
declarado: un radicado activo que exceda 180 días sin resolverse (ya de por
sí una anomalía fuera del término legal máximo) sale de la ventana del
stream y solo es localizable por la búsqueda avanzada paginada.

**No requirió índice nuevo:** el rango temporal es sobre el mismo campo
del `orderBy` ya cubierto por el índice compuesto existente
(`clasificacion.oficinaDestino ASC | control.fechaRadicado DESC`) y, sin
tenant, por el índice de campo único automático de Firestore.

**Cambio de semántica en `useAnalytics`** (`app/interno/dashboard/components/analytics/useAnalytics.ts`):
el hook sigue siendo puro (no cambió su lógica de cálculo), pero el array
que recibe ya no es "todo el histórico" — es la ventana de 180 días. La
opción `'TODO'` de `PeriodoAnalytics` dejó de significar "histórico
completo desde el origen"; ahora significa "todo dentro de la ventana
operativa del stream". Se corrigió la copia de `VistaAnalytics.tsx` que
antes decía "Histórico completo" / "N en histórico" (ahora "Ventana
operativa (180 d)" / "N en ventana operativa") para no mentir al usuario —
**copy provisional, pendiente de revisión de ux-ui** (declarado, no
finalizado unilateralmente).

Una analítica sobre el histórico real completo más allá de la ventana
requeriría una consulta agregada propia (fuera de alcance de 2A, deuda
declarada en el propio archivo).

**Control de regresión:** `__tests__/ventana-stream-radicados.test.ts` —
mockea `firebase/firestore` y verifica que la consulta SIEMPRE incluye el
rango temporal + `limit()`, con y sin filtro de tenant. Verificado por
mutación manual (quitar el rango/limit hace fallar 3 de los 5 tests).

Ver [[project_sistema_subagentes]] para el marco de roles/ADR que rige esta
decisión (ADR-0010, `docs/PLAN_OLA2.md` frente 2A).
