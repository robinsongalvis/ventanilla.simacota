---
name: gate-adr0028-dictamen-jsyaml
description: Dictamen 7-ago-2026 — excepción js-yaml GHSA-5p4m-2wfm-xmqj RECHAZADA (existía fix 4.3.1); lección: títulos de advisory pueden estar desactualizados, verificar rango de npm audit + registry antes de allowlistar
metadata:
  type: project
---

Dictamen del 7-ago-2026: primera solicitud de excepción al gate de auditoría gobernado (ADR-0028, `audit-allowlist.json`) por GHSA-5p4m-2wfm-xmqj / CVE-2026-59870 (js-yaml !!omap CPU cuadrático, high) que bloqueaba CI de PRs #161/#162. **VISTO RECHAZADO** — no por riesgo, sino porque SÍ había fix aplicable: js-yaml 4.3.1 (publicado 2026-07-31) es el backport del fix, dentro del rango `^4.3.0` de `@eslint/eslintrc`; `npm audit fix` lo resolvía con un solo cambio de lockfile. El título de la advisory decía "fix not backported" pero estaba DESACTUALIZADO respecto al backport posterior.

**Why:** el invariante de la allowlist exige "SIN fix upstream" — allowlistar con fix disponible falsearía el campo `justificacion` y degradaría el gate. La alcanzabilidad sí era nula (transitiva exclusiva de eslint devDependency, cero YAML en runtime), pero eso solo no basta.

**How to apply:** ante futuras solicitudes de excepción, NO fiarse del título/texto del advisory ("fix not backported", "no patch"): verificar (1) rango vulnerable exacto en `npm audit --json`, (2) `npm view <pkg> versions` + fechas de publicación, (3) `npm audit fix --dry-run` como evidencia de remediación mínima, (4) que el paquete no esté en `dependencies` directas. Solo emitir entrada de allowlist si tras eso no hay fix aplicable. El formato de entrada exige los 7 campos de `esquema_entrada` y caducidad ≤ 90 días. Relacionado: [[auditoria-externa-h1-h2]] (protocolo de refutación con evidencia).
