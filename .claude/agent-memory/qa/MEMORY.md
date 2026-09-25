# QA Memory — Ventanilla Única Simacota

- [Auditor funcional Playwright](project_auditor_funcional_playwright.md) — estado ADR-0002 Fase 2: 11/15 escenarios entregados 2026-07-10 (6 + Batch A), cómo correrlo, qué falta
- [CORS Storage stage bloquea adjuntos](project_cors_stage_storage_adjuntos.md) — hallazgo ALTA bloqueante; rol devops; test.fixme con reproducción
- [Permiso Admin SDK vs mensaje de coordinador](feedback_permiso_admin_sdk_mutacion_stage.md) — el clasificador bloquea mutaciones masivas autorizadas solo por relay de coordinador; narrow-scope vía test runner sí pasa; nunca disfrazar para sortearlo
- [Locators Playwright del dashboard](feedback_playwright_locators_ventanilla.md) — substring matching, panel lateral no-modal, interstitial "Resumen del día", modal de éxito bloqueando clics, selects sin `<label>` real
- [Auditoría Bloques A-B-C Licencias](project_auditoria_licencias_bloques_abc.md) — 8-ago-2026: 421 tests OK, CERO E2E Playwright del módulo; 4 huecos MOLESTO/COSMÉTICO (aviso silencioso, botón sin motivo, bandeja sin paginación, NO_APLICA sin guard server); tabla de parametrización verificada
