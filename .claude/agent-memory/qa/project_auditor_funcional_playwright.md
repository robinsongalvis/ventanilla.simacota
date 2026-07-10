---
name: project-auditor-funcional-playwright
description: Estado del auditor funcional Playwright (ADR-0002 Fase 2) — qué existe, qué falta del presupuesto de 15, y cómo correrlo
metadata:
  type: project
---

Entregado 2026-07-10: `playwright.config.ts` + `e2e/` (6 de 15 escenarios del
presupuesto duro de ADR-0002). Suite en verde (4 corridas consecutivas
confirmadas) contra `ventanilla-simacota-stage`.

**Cómo correr:** servidor `npm run dev:stage` arriba en otra terminal
(JAMÁS `npm run dev`), luego `npm run test:e2e`. Vitest (`__tests__/`,
`npm test`) queda intacto y aparte — `vitest.config.mts` excluye `e2e/**`
explícitamente para que el glob por defecto de Vitest no lo recoja.

**Los 6 escenarios:** ciclo dorado completo (01), radicación anónima (02),
consulta pública con verificación incorrecta (03), radicación con adjunto
— `test.fixme` por hallazgo de infraestructura (04), jefe solo lectura
(05), perímetro sin sesión (06). Detalle completo y hallazgos en
`docs/laboratorio/FASE2_BITACORA.md` sección "Auditor funcional Playwright
(qa)".

**9 escenarios restantes del presupuesto (priorizados, no implementados):**
identidad reservada (tercera variante de tipoPresentacion), traslado entre
dependencias, devolución por datos incompletos, prórroga con notificación,
numeración consecutiva bajo concurrencia, comparación de expediente
completo inicio→cierre, sello de documento PDF, registro de salida con
constancia, Registro exprés.

**Hallazgos activos sin cerrar (2026-07-10):**
- [[feedback_cors_stage_storage_adjuntos]] — bloqueante, bloquea el 100% de
  radicaciones con adjunto en stage; rol devops.
- Huecos de numeración cuando la radicación con adjunto no termina de
  crearse (`lib/radicado-institucional.ts` incrementa el consecutivo antes
  de que el radicado esté garantizado) — rol dev-backend, no confirmado en
  producción.
- Barrido retroactivo de 3 radicados `[E2E-AUTO]` sin `isTest:true`
  (00000032, 00000042, 00000073) bloqueado por permisos — ver
  [[feedback_permiso_admin_sdk_mutacion_stage]]. Script listo:
  `node e2e/marcar-retroactivo.mjs`.

**Mecanismo isTest (ver `e2e/lab-admin.ts` + `e2e/fixtures.ts`):** cada test
que radica llama `registrarRadicadoDePrueba(id)`; el marcado real vía Admin
SDK ocurre en el TEARDOWN de la fixture, nunca al crear — si se marcara
antes, `useVentanillaRadicados` (filtra `isTest` del lado cliente) haría
desaparecer el radicado de la Bandeja/Tablero a mitad del propio test.
