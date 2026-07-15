---
name: project-auditor-funcional-playwright
description: Estado del auditor funcional Playwright (ADR-0002 Fase 2) — qué existe, qué falta del presupuesto de 15, y cómo correrlo
metadata:
  type: project
---

Entregado 2026-07-10 en dos tandas: primera entrega (6 escenarios) +
Batch A (5 más, 07-11) — 11 de 15 del presupuesto duro de ADR-0002. Suite
en verde (7 corridas consecutivas confirmadas en total: 4 de la primera
entrega, 3 del Batch A con los 11 juntos) contra
`ventanilla-simacota-stage`. Coordinador ya consolidó la primera entrega
(commit hecho, eslint config corregido para `e2e/**` — ver
`eslint.config.mjs`, regla `react-hooks/rules-of-hooks` daba falso
positivo sobre el parámetro `use` de los fixtures de Playwright).

**Cómo correr:** servidor `npm run dev:stage` arriba en otra terminal
(JAMÁS `npm run dev`), luego `npm run test:e2e`. Vitest (`__tests__/`,
`npm test`) queda intacto y aparte — `vitest.config.mts` excluye `e2e/**`
explícitamente.

**Los 11 escenarios:** ciclo dorado (01), radicación anónima (02), consulta
pública incorrecta (03), radicación con adjunto — `test.fixme` por CORS
(04), jefe solo lectura (05), perímetro sin sesión (06), identidad
reservada (07), traslado entre dependencias (08), prórroga con
notificación (09), devolución (10), Registro exprés (11). Detalle completo
y hallazgos en `docs/laboratorio/FASE2_BITACORA.md` sección "Auditor
funcional Playwright (qa)" (incluye subsección "Batch A").

**4 escenarios restantes del presupuesto (priorizados, no implementados):**
numeración consecutiva bajo concurrencia, comparación de expediente
completo inicio→cierre, sello de documento PDF, registro de salida con
constancia de despacho (`RegistrarSalidaModal`, distinto del de Registro
exprés).

**Hallazgos activos sin cerrar (2026-07-10):**
- [[feedback_cors_stage_storage_adjuntos]] — bloqueante, bloquea el 100% de
  radicaciones con adjunto en stage; rol devops.
- Huecos de numeración cuando la radicación con adjunto no termina de
  crearse — rol dev-backend, no confirmado en producción.
- **[NUEVO, Batch A] Prórroga sin límite de unicidad** (Ley 1755/2015):
  `POST /api/radicados/{id}/prorroga` no bloquea una segunda prórroga sobre
  el mismo radicado (`assertNotClosed` solo bloquea RESUELTO/RECHAZADO, no
  PRORROGA) — confirmado aplicando una segunda a propósito en
  `e2e/09-prorroga-con-notificacion.spec.ts` (`prorrogasAplicadas` llega a
  2 sin error). Rol: gobierno-digital (interpretación normativa) +
  dev-backend (implementar el guard).
- **[NUEVO, Batch A] Protección de "identidad reservada" inconsistente**
  entre vistas internas: protegida en el mostrador de Ventanilla, NO
  protegida en la Bandeja ni en el panel de detalle completo (nombre y
  documento en texto plano). Rol: gobierno-digital (¿es conforme?) +
  dev-frontend si no lo es.
- Barrido retroactivo de 3 radicados `[E2E-AUTO]` sin `isTest:true`
  (00000032, 00000042, 00000073) sigue bloqueado por permisos — ver
  [[feedback_permiso_admin_sdk_mutacion_stage]]. No creció con el Batch A
  (el mecanismo automático marcó los 11 nuevos + 1 salida). Script listo:
  `node e2e/marcar-retroactivo.mjs`.

**Mecanismo isTest (ver `e2e/lab-admin.ts` + `e2e/fixtures.ts`):** cada test
que radica llama `registrarRadicadoDePrueba(id)`; el marcado real vía Admin
SDK ocurre en el TEARDOWN de la fixture, nunca al crear — si se marcara
antes, `useVentanillaRadicados` (filtra `isTest` del lado cliente) haría
desaparecer el radicado de la Bandeja/Tablero a mitad del propio test.
Extendido en Batch A con `registrarDocumentoDePrueba(coleccion, id)` para
colecciones distintas a `ventanilla_radicados` (Registro exprés también
crea un doc en `ventanilla_salidas`).
