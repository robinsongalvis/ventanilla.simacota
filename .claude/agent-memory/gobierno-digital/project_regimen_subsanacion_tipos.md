---
name: regimen-subsanacion-por-tipo
description: Dictamen 6-ago-2026 sobre bloqueo del requerimiento art. 17 por régimen del tipo de solicitud — cambios exigidos y riesgo de ids
metadata:
  type: project
---

Dictamen emitido 6-ago-2026 (hallazgo ALTO: subsanación art. 17 aplicada a
cualquier tipo del catálogo). Mitigación validada: bloqueo fail-closed por
régimen + textos parametrizados.

**Cambios que exigí sobre la clasificación propuesta** (verificar si fueron
aceptados antes de reutilizar):
- HABEAS_DATA → ESPECIAL_NO_HABILITADO (Ley 1581 art. 15: ventana 5 días,
  plazo 2 meses; el art. 17 de la 1755 PERJUDICA al titular).
- PETICION_ENTES_CONTROL → ESPECIAL_NO_HABILITADO (potestades de vigilancia
  CP 267/277; desistimiento tácito contra un ente de control es insostenible).
- PETICION_ENTRE_AUTORIDADES sí queda en LEY_1755 (art. 30 solo modifica el
  término; Capítulo I aplica en lo no regulado).

**Why:** el fallback a LEY_1755 para ids desconocidos convierte cualquier typo
de id en aplicación silenciosa del art. 17 — detecté que el id real del
catálogo es `DECLARACION_RETENCION_ICA` (no `RETENCION_ICA`).

**How to apply:** en futuras revisiones de subsanación/regímenes, exigir mapa
exhaustivo tipado sobre `TipoSolicitudCatalogoId` (falla en compilación si un
tipo queda sin régimen) y revisar [[anclas-normativas-frecuentes]] para las
citas verificadas (D.1077 art. 2.2.6.1.2.2.4, Ley 1581 art. 15, CPACA 74/76).
Transición aceptada: subsanaciones YA abiertas bajo 1755 sobre tipos ahora
bloqueados continúan su ciclo (prórroga/reactivación/desistimiento), con
advertencia en trazabilidad al confirmar desistimiento.
