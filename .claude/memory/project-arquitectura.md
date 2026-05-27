---
name: project-arquitectura
description: Stack técnico, estructura de colecciones Firestore y flujo de datos del sistema de Ventanilla Única de Simacota
metadata:
  type: project
---

Sistema "Ventanilla Única MIPG" — Alcaldía de Simacota (Next.js 16, React 19, Firebase 12, Tailwind 4).

**Colecciones Firestore:**
- `radicados` — radicados legacy vía portal web público (tipo `Radicado`, con clasificacionIA). NO tocar.
- `ventanilla_radicados` — radicados institucionales nuevos (tipo `VentanillaRadicado`). Sistema MIPG.
- `users/{uid}` — perfil del funcionario: `{ nombre, rol, tenantId }`.
- `counters/radicados-{year}` — consecutivo anual para IDs tipo `1-WEB-2026-00000047`.

**Roles:** `ADMIN` ve todo · `RECEPCIONISTA` ve todo y radica · `FUNCIONARIO` ve solo su tenantId.

**TenantId:** 15 dependencias en `DIRECTORIO_TENANTS` (reglas-negocio.ts). Fuente única de verdad.

**Why:** Reemplaza sistema ASPX que caía constantemente. Alineado con MIPG y Rendición de Cuentas.
**How to apply:** Nuevos radicados siempre van a `ventanilla_radicados`. Preservar `radicados` legacy.
