---
name: project-r11-busqueda-avanzada-pendiente
description: R11 NO cerrado del todo — busqueda-avanzada sigue leyendo O(N); 2A paso 1 (cursor) no aterrizó
metadata:
  type: project
---

Al cerrar 2B (2026-07-11), `app/api/radicados/busqueda-avanzada/route.ts` **seguía leyendo la
colección completa** (`.orderBy('control.fechaRadicado','desc').get()` sin `limit`/cursor) — el
mismo endpoint que la línea base midió (210 docs, p95 824 ms). El commit `c783a2a` de 2A solo
acotó el **stream** (`useVentanillaRadicados`, ventana 180d + `limit(500)`), NO el endpoint.

**Why:** ADR-0010 §2.1 exige cursor + `limit` server-side en ese endpoint, coordinado con la
tarea externa `task_7f9e8ba3`; ese paso no llegó a este árbol. Por eso el presupuesto de
rendimiento clasifica el endpoint como `PENDIENTE_2A` (reportado de forma prominente, no
bloqueante, para dar línea base verde y evidencia de mutación limpia) en lugar de deuda
aceptable — no es deuda, es R11 sin cerrar.

**How to apply:** R11 no puede declararse RESUELTO hasta que 2A aterrice ese cursor. Cuando lo
haga, promover la entrada de `busqueda-avanzada` de PENDIENTE_2A a ACOTADA (≤ pageSize 100) en
el REGISTRO de `scripts/laboratorio/presupuesto-rendimiento.mjs` — a partir de ahí el control
la enforza permanentemente. Es una decisión de arquitectura/coordinación, no de DevOps.
Relacionado: [[reference-stage-y-presupuesto]].

**Hallazgo adyacente 2B:** `app/api/cron/alertas-vencimiento/route.ts` también lee sin cota y
NO estaba en la deuda declarada de ADR-0010; catalogado como DEUDA_DECLARADA en el registro
con recomendación de acotarlo (`limit` + `where(estado activo)`) — pendiente de decisión.
