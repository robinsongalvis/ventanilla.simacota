---
name: bloque-a3-checklist-documentos
description: Checklist de requisitos + carga de documentos en el detalle de licencia (Bloque A·A3) — contrato REAL de los endpoints diverge del briefing original
metadata:
  type: project
---

Pantalla del checklist con carga de documentos, en
`app/interno/licencias/[expedienteId]/DetalleLicenciaClient.tsx`, alimentada
por componentes nuevos en `app/interno/licencias/components/`:
`ChecklistRequisitos.tsx` (orquestador — corre `evaluarCompletitud` real,
`lib/motor-expedientes/completitud.ts`), `RequisitoItem.tsx`,
`PanelHechosCaso.tsx`, `OtrosDocumentos.tsx`, `ControlSubidaDocumento.tsx`
(control de subida compartido) + `estilos-estado-requisito.ts` (tríos de
color reutilizados de `estilos-chip-estado.ts`/`estilos-estado-juridico.ts`).

**Hallazgo clave (verificar código real, no el encargo, antes de construir
sobre estos dos endpoints):** el encargo original describía
`POST .../documentos → {ok, documento, expediente}` y
`PATCH .../contexto → body {contexto:{...}} → {ok, expediente}`. El código
REAL (`app/api/licencias/expedientes/[id]/documentos/route.ts` y
`.../contexto/route.ts`, verificados 8-ago-2026) hace algo distinto:

- `POST .../documentos` responde `{ok, documentoId, numeroVersion,
  documentoNuevo, storagePath, hashSha256}` — NUNCA el `DocumentoExpedienteDoc`
  completo ni el `expediente`.
- `PATCH .../contexto` espera el body PLANO (`{esApoderado: true}`, NO
  `{contexto: {esApoderado: true}}` — el route trata el body entero como el
  mapa de claves) y responde `{ok, contexto}` (el contexto YA mergeado), no
  `{ok, expediente}`.

**Cómo se adaptó la UI (sin tocar las rutas, fuera de mi alcance):**
`ChecklistRequisitos` es un componente CONTROLADO (no duplica
`contexto`/`aportes`/`documentos` en estado propio). Tras un `POST`
exitoso llama a `onDocumentoSubido` → el padre hace un refetch SILENCIOSO
del `GET` completo (`cargar({silencioso:true})` en `DetalleLicenciaClient`,
que NO pasa por `estadoCarga:'cargando'` para evitar que la pantalla
parpadee) — es la única forma honesta de mostrar el documento/versión real
dado que el `POST` no los devuelve. Tras un `PATCH` exitoso, en cambio, se
aplica DIRECTO el `contexto` que sí trae la respuesta
(`onContextoActualizado`, sin refetch) — el `PATCH` no cambia `aportes` ni
`documentos`, así que un refetch completo ahí sería trabajo de red inútil.

**Deuda opcional declarada (no bloqueante):** si `dev-backend`/el
arquitecto deciden alinear esas dos rutas al contrato originalmente
diseñado (devolver el documento/expediente completos), la subida podría
dejar de depender del refetch silencioso — mejora de rendimiento menor, no
funcional.

**Otra decisión no obvia:** el "toggle sí/no" pedido para las claves de
contexto booleanas se implementó como SELECT de 3 estados (Sin definir /
Sí / No) en `PanelHechosCaso.tsx`, no un switch binario — un binario
forzaría siempre un valor y ocultaría la semántica INDETERMINADO
fail-closed de `evaluarCondicion` (lógica de Kleene,
`lib/motor-expedientes/completitud.ts`).

Ver [[project_sistema_subagentes]] para el marco de roles/ADR (ADR-0026,
ADR-0029) que gobierna este bloque.
