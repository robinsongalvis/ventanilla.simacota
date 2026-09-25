---
name: adr0012-r6-prorroga
description: Estado de R6 (control temporalidad de prórroga, ADR-0012) implementado — pendiente revisión cruzada
metadata:
  type: project
---

R6 (ADR-0012, frente 2C Ola 2) implementado 2026-07-11: `validarProrroga`
(`lib/server/radicados-security.ts`) ahora acepta `fechaVencimiento?: string`
(ISO) y `ahora?: Date | (() => Date)` (reloj inyectable, patrón H1). Regla
nueva evaluada en tercer lugar (orden: unicidad → tope → temporalidad):
rechaza con status 409 si `fechaVencimiento <= ahora` (frontera "vence
exactamente ahora" cuenta como vencido — decisión explícita, "antes del
vencimiento" excluye el instante exacto). `fechaVencimiento` es opcional
para no romper llamadas previas a R6 (compatibilidad con tests H1
existentes) — si se omite, la regla R6 no se evalúa.

Endpoint `app/api/radicados/[radicadoId]/prorroga/route.ts` cablea
`radicado.termino.fechaVencimiento` y un `Date` real capturado antes de la
escritura (`ahoraDate`), reutilizado luego para el resto de la operación.

Tests nuevos en `__tests__/prorroga-validacion.test.ts` (13/13 verdes),
`tsc --noEmit` 0, `eslint` 0 en los 3 archivos tocados.

**Pendiente:** revisión cruzada de gobierno-digital (conformidad Ley
1755/2015 art. 14) y seguridad — según instrucción del encargo, no hice
commit; el coordinador consolida. Ver también [[project_laboratorio_alcaldia_sintetica]]
por el patrón de revisión cruzada con condiciones pendientes usado en Ola 2.
