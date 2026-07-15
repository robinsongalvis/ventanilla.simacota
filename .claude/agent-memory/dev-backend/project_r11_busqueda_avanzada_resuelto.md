---
name: r11-busqueda-avanzada-resuelto
description: R11 cerrado — busqueda-avanzada/route.ts acotada por lotes con cursor (ADR-0010 §2.1); diseño y trade-offs del escaneo acotado
metadata:
  type: project
---

Cerrado 2026-07-11 (dev-backend, ADR-0010 §2.1). `app/api/radicados/busqueda-avanzada/route.ts`
ya NO hace `.orderBy().get()` sin límite. Reemplazado por escaneo por lotes con
cursor (`limit(pageSize)` + `startAfter`), techo duro `MAX_DOCS_ESCANEADOS = 500`
(mismo presupuesto INTERACTIVO que `useVentanillaRadicados`). Promovido en
`scripts/laboratorio/presupuesto-rendimiento.mjs` de `PENDIENTE_2A` a `ACOTADA`
— el control ahora ENFORCE esta superficie (falla si pierde el `limit`/cursor).

**Decisión de diseño clave (no es un `≤pageSize` literal siempre):** la búsqueda
admite filtros de subcadena/texto libre (nombre, documento, correo, asunto,
responsable, `q`) que Firestore no puede resolver sin infraestructura de texto
completo (Algolia/Typesense — fuera de alcance, YAGNI). Por eso el acotamiento
es un escaneo por lotes que se detiene al reunir la página pedida, agotar la
colección, o tocar el techo de 500 — NO garantiza exactamente `pageSize` docs
leídos en TODOS los casos, pero SIEMPRE queda acotado por 500, independiente
de N. Para el caso más común (sin filtros, página 1 — lo que el panel dispara
por defecto), el bucle termina en 1 lote y SÍ lee exactamente `pageSize`.

Filtros empujados a Firestore (sin índices nuevos, reutilizan el índice
compuesto ya existente `clasificacion.oficinaDestino` + `control.fechaRadicado desc`):
tenant (ya existía) y `dependencia` (nuevo, solo para ADMIN/RECEPCIONISTA/CONTROL_INTERNO
cuando el filtro está activo). Deliberadamente NO se empujaron los rangos de
fecha (`fechaDesde`/`fechaHasta`) — el emulador de Firestore no corre local
([[project_entorno_firebase_local]]) y la lógica de "incluir el día completo"
tiene un borde sutil (`+1 día -1ms` vs. ``); se prefirió no arriesgar un
bug de exclusión silenciosa sin poder validarlo contra un emulador. Queda
declarado como optimización futura de bajo riesgo si se mide que vale la pena.

**Contrato del endpoint:** preservado 100% aditivamente — mismo shape
`{items, total, page, pageSize, totalPaginas, filtrosAplicados}` +
2 campos nuevos que el frontend actual ignora sin romperse: `limiteAlcanzado`
(bool) y `docsEscaneados` (number). CERO cambios en
`BusquedaAvanzadaPanel.tsx` (no se tocó — fuera de mi rol, y el contrato
compatible lo hizo innecesario). `total`/`totalPaginas` dejaron de ser un
conteo exacto de TODO el histórico cuando hay filtros de texto libre activos
(antes exigía leer la colección completa para darlo); ahora reflejan lo
encontrado dentro del escaneo acotado — declarado explícitamente en el código
y en `docs/auditorias/rendimiento-2a-busqueda-avanzada.md`.

**Refactor reutilizable:** `lib/busqueda/filtros-radicado.ts` ganó
`filtrarLote` (alcance+filtros puro, sin ordenar/paginar) y
`priorizarCoincidenciaExacta` (el sort de coincidencia exacta de radicado),
extraídos de la duplicación entre `filtrarRadicados`/`buscarRadicados`. El
route los reutiliza por lote — mismo predicado exacto que antes, sin duplicar
lógica ni aflojar el cierre de R9 (exclusión server-side de reservados/anónimos
por identidad).

**Re-medición (Principio 13):** mismo N=210 que la línea base
([[project_linea_base_lectura_2b]]) → 210→25 docs leídos (−88%), p95 824ms→426ms.
Método: `node scripts/laboratorio/medir-escala-lectura.mjs --volumenes=210 --runs=20 --pageSize=25`
(el patrón ACOTADA de ese script es idéntico, línea por línea, al que ejecuta
el endpoint real en el caso sin filtros/página 1). Detalle completo en
`docs/auditorias/rendimiento-2a-busqueda-avanzada.md`. El caso multi-lote
(filtros de texto activos) NO se midió empíricamente — la garantía de tope 500
es analítica/por diseño, ya validada empíricamente para el patrón ACOTADA
hasta N=800 en `docs/auditorias/rendimiento-escala-2b.md`.

**Why:** el propietario exigía cerrar el núcleo de R11 (medido, no solo
declarado) — la línea base y el presupuesto 2B ya habían dejado esta
superficie explícitamente `PENDIENTE_2A`/bloqueante para declarar R11 RESUELTO.

**How to apply:** si una futura tarea toca este endpoint, preservar: (1) el
techo `MAX_DOCS_ESCANEADOS` como única fuente de verdad del presupuesto —
subirlo requiere justificar y el control lo verifica; (2) `filtrarLote` como
punto único de aplicación de filtros (no duplicar `pasaFiltros` en otro
sitio); (3) si se decide empujar más filtros a Firestore (fecha, estado,
tipoSolicitudId), coordinar con firestore-datos para confirmar índices y
validar contra emulador antes de confiar en la lógica de rango.
