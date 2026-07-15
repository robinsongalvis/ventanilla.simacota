---
name: consolidacion-post-ola2
description: Revisión cruzada 13 jul 2026 de GOBERNANZA.md y BACKLOG_TECNICO.md; ADR-0014 propuesto pendiente de aceptación del propietario
metadata:
  type: project
---

Revisión cruzada del 2026-07-13 (pausa de consolidación post-Ola 2, congelamiento de código vigente): el arquitecto validó `docs/GOBERNANZA.md` y `docs/BACKLOG_TECNICO.md` contra el repo y aplicó 3 correcciones (guarda anti-prod sobredeclarada en §6; nombres visibles exactos de los checks en §3.4; la pregunta de branch protection del backlog omitía `informe-despliegue`).

**Why:** ADR-0013 §Decisión.1 nombra solo `validate` + `laboratorio-emulador` porque el job del informe no existía al redactarse; el informe puede ser el ÚNICO job en rojo cuando el rojo viene del input E2E registrado (`docs/auditorias/e2e-ultimo.json`), así que branch protection debe exigir los TRES checks por su nombre visible (GitHub identifica checks por el `name:` del job).

**How to apply:** en cualquier tarea futura que toque la compuerta (R14/R15) o branch protection, usar GOBERNANZA §3.4 como lectura autoritativa, no el texto literal de ADR-0013. Pendientes a vigilar: aceptación del propietario de `docs/adr/0014-principio-ritmo-vs-calidad.md` (principio ritmo-vs-calidad, redactado por mí en estado *propuesto*); branch protection aún sin aplicar; e2e-ultimo.json aún en "pendiente" (nunca ha habido corrida E2E registrada contra un SHA real).
