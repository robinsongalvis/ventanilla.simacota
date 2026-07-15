---
name: backlog-consolidacion-post-ola2
description: docs/BACKLOG_TECNICO.md (13 jul 2026) ordena R14>R15a>E2E-CI>R3>R4>R13>R12>R5>R7; 3 decisiones del propietario pendientes (R10, credenciales stage en CI, branch protection)
metadata:
  type: project
---

El backlog técnico de la pausa de consolidación post-Ola 2 vive en
`docs/BACKLOG_TECNICO.md` (13 jul 2026). Criterio de ordenación: primero lo que
fortalece la gobernanza de la compuerta (R14, R15a, deuda E2E-en-CI), luego
riesgos por severidad con desempate normativo > operativo > escala >
mantenibilidad.

**Why:** prioridad declarada del propietario para esta etapa =
institucionalizar lo construido; mientras la compuerta tenga puntos ciegos, la
evidencia de los demás cierres vale menos.

**How to apply:** al planificar el levantamiento del congelamiento, partir de
ese documento (no reinventar el orden). Decisiones abiertas del propietario:
(1) R10 variante B — recomendación PO: mantener variante A salvo que la
funcionaria confirme necesidad real; (2) credenciales de stage en CI (habilita
automatizar el E2E del informe); (3) activación de branch protection (acción
admin, precondición de 2E). 2E queda fuera hasta cumplir branch protection +
validación de ventana 180d con la funcionaria. R15b (categoría IA) bloqueado
por P-D.
