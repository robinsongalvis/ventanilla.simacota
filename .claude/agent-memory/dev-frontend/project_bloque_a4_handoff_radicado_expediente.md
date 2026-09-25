---
name: bloque-a4-handoff-radicado-expediente
description: UI del handoff radicado⇄expediente (Bloque A·A4) — contrato real de los 3 endpoints nuevos, y el gap "metadata.tipo" del briefing vs. el servidor
metadata:
  type: project
---

Modal "Crear desde radicado" (`app/interno/licencias/components/
CrearDesdeRadicadoModal.tsx`) + vínculo mostrado en el detalle
(`[expedienteId]/DetalleLicenciaClient.tsx`) + etiqueta propia de la
actuación `comunicacion-enviada` en el timeline (`presentacion-
actuaciones.ts`, `EventoTimeline.tsx`) + campo `fechaComunicacion` en
`RegistrarActuacionModal.tsx`. Construido 8-ago-2026 sobre server ya
implementado y probado por dev-backend (sin tocar `lib/server/expedientes-
licencias.ts` ni las rutas).

**Mismo patrón que [[project_bloque_a3_checklist_documentos]] — el briefing
puede describir un contrato que NO es el real; verificar código antes de
construir.** Esta vez el hallazgo:

- El encargo pedía renderizar la actuación `comunicacion-enviada` "según
  `metadata.tipo`". `Actuacion`/`ActuacionLicenciaDoc`
  (`lib/motor-expedientes/tipos.ts`, `lib/server/expedientes-licencias.ts`)
  **no tienen campo `metadata`** — nunca lo tuvieron. Constancia (creación
  por handoff) y aviso de acta (A5) comparten `tipo: 'comunicacion-enviada'`
  y SOLO se distinguen por el PREFIJO del `detalle` que arma
  `construirActuacionComunicacionEnviada`: `"Constancia de radicación en
  legal y debida forma…"` vs. `"Aviso de acta de observaciones y
  correcciones…"`. La UI resuelve esto con
  `tituloComunicacionEnviada(detalle)` en `presentacion-actuaciones.ts`
  (string-match sobre el prefijo, con fallback genérico si no coincide).
  Frágil por diseño — si el texto de `tipoComunicacion` cambia en el
  servidor sin avisar al frontend, la etiqueta cae al genérico
  "Comunicación enviada al ciudadano" en vez de romperse, pero deja de
  distinguir constancia/aviso. **Dependencia declarada:** si dev-backend
  llega a tocar `construirActuacionComunicacionEnviada`, sería más robusto
  agregar un campo discriminador propio (p. ej. `subtipo:
  'constancia'|'aviso-acta'`) en vez de que el frontend siga parseando
  texto libre — no urgente, la solución actual funciona.

**Contrato real verificado (8-ago-2026), por si se retoma este bloque:**
- `GET /api/licencias/radicados-candidatos` → `{ok, radicados:
  {radicadoId, tipoSolicitud, solicitanteNombre, fechaRadicado}[]}`.
- `POST /api/licencias/expedientes/desde-radicado` body `{radicadoId,
  subtipos, contexto?}` → 201 `{ok, expediente, vinculoExpediente,
  constanciaEnviada}`; 409 si el radicado ya está vinculado o está cerrado
  (mensaje literal, ya trae el número del expediente existente).
- `GET /api/licencias/expedientes/{id}` ahora incluye `radicadoVinculado:
  {id, fecha} | null` (proyección mínima — solo si el expediente nació por
  handoff).

Ver [[project_sistema_subagentes]] (ADR-0026/0029) y
[[feedback_fecha_input_ancla_bogota]] (decisión de UI no obvia de este
mismo bloque, sobre el campo `fechaComunicacion`).
