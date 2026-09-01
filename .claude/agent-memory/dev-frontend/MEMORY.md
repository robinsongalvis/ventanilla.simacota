# Project Memory — dev-frontend

- [Ola 2 — ventana del stream (2A)](project_ola2_ventana_stream_2a.md) — ADR-0010/R11: `useVentanillaRadicados` acotado a 180 días + limit(500); cambio de semántica en useAnalytics 'TODO'
- [Límites de rol](feedback_limites_de_rol.md) — declinar tareas de otro rol (normativa/seguridad/backend) reenviadas por el coordinador a mitad de tarea; reportar, no ejecutar
- [Bloque A3 — checklist + documentos](project_bloque_a3_checklist_documentos.md) — POST .../documentos y PATCH .../contexto tienen contrato REAL distinto al briefing; verificar código, no el encargo, antes de construir sobre esos endpoints
- [Bloque A4 — handoff radicado⇄expediente](project_bloque_a4_handoff_radicado_expediente.md) — contrato real de los 3 endpoints; `metadata.tipo` NO existe, comunicacion-enviada se distingue por prefijo de `detalle`
- [Fecha input → ancla Bogotá](feedback_fecha_input_ancla_bogota.md) — `<input type="date">` que alimenta atLocalNoon/sumarDiasHabiles debe enviarse como `T12:00:00-05:00`, si no corre un día antes
- [Bloque B — Licencias como VistaActual](project_bloque_b_licencias_vistaactual.md) — 'LICENCIAS' embebida vía VistaLicencias; props aditivas onAbrirExpediente/onVolver; ruta standalone/layout/guard viva a propósito
- [Bloque C — Libro Consecutivo](project_bloque_c_libro_consecutivo.md) — reemplaza el Excel; lógica pura en presentacion-libro-consecutivo.ts; 11-ago: buscador rápido (coincideBusquedaLibro) compartido con la Bandeja; `predio` SÍ existe ya en tipos.ts
- [Testing sin fake timers](feedback_testing_libro_consecutivo_sin_fake_timers.md) — vi.useFakeTimers()+waitFor() se cuelgan; leer el valor real del control, seleccionar el año del fixture, o pasar `hoy` explícito a la función pura en vez de fijar el reloj
- [RTL getByText y elementos anidados](feedback_rtl_gettext_elementos_anidados.md) — getByText solo une nodos de texto DIRECTOS; un `<strong>` interpolado "esconde" el número del matcher del contenedor
- [Rediseño modales Licencias](project_rediseno_modales_licencias.md) — PR #303; base corregida a `main` tras hallar #293 ya fusionada; tokens en licencias-tema.css; ADR-0039 nuevo (mutación realista + grep de consultas RTL)
- [Preview en otro worktree](feedback_preview_worktree_distinto.md) — el Browser pane puede levantar `next dev` en el worktree del coordinador, no en el mío; verificar `lsof -p <pid> | grep cwd` antes de depurar 404/rutas
