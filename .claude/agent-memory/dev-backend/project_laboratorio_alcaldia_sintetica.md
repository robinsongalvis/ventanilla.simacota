---
name: project-laboratorio-alcaldia-sintetica
description: Revisión cruzada dev-backend del generador Alcaldía Sintética (Fase 2 laboratorio, ADR-0002) — veredicto y condiciones pendientes
metadata:
  type: project
---

`scripts/laboratorio/alcaldia-sintetica.ts` (autor: firestore-datos) genera
~30 radicados sintéticos en STAGE naciendo por las API routes reales
(`/api/radicacion`, `asignar`, `prorroga`, `resolver`), con sesiones de
usuarios `.lab`, retrodatación coherente vía Admin SDK reutilizando
`calcularFechaVencimiento()` de `lib/tiempos-radicado.ts`, y marca
`isTest:true`. Documentado en `docs/laboratorio/FASE2_BITACORA.md`.

Revisé como consumidor real del backend (matriz SOI: dev-backend revisa lo
que produce firestore-datos) el 2026-07-10. **Veredicto: APROBADO CON
CONDICIONES.** Verifiqué con lectura directa a stage (Admin SDK, sin
escribir) que 6 radicados sintéticos muestreados (3 sin retrodatar + escenarios
9/23/29 dirigidos) tienen `termino.fechaVencimiento` idéntico al recalculado
con la función real de producción y `cumplioTermino` coherente — la
retrodatación es fiel, no produce estados imposibles.

Condiciones pendientes de corrección por el autor (no bloqueantes para stage,
sí antes de reutilizar el script más allá de esta corrida):
1. **[MEDIA]** Reset del contador anual en `limpiar()` (líneas ~554-567) no
   está envuelto en `runTransaction` — riesgo TOCTOU de colisión de
   consecutivo si hay escrituras concurrentes de terceros. Ya declarado como
   límite conocido por el autor; pedí envolverlo igual que hace el endpoint
   real (`app/api/radicacion/route.ts:178-197`).
2. **[MEDIA]** `adoptarHuerfanos()` (líneas ~523-539) identifica documentos
   ajenos por igualdad exacta de `detalle.descripcion` — identificador débil
   pero de bajo riesgo práctico; pedí matizar la afirmación de la bitácora
   ("nunca toca documentos ajenos") con el mecanismo real.

Hallazgo colateral fuera de mi área, reportado a seguridad/dev-backend: ver
[[project_hallazgo_ratelimit_xff]].

Mi sección completa de revisión (hallazgos 1-4, verificado-como-correcto,
impacto fuera de área) está en
`docs/laboratorio/FASE2_BITACORA.md` bajo "Revisión cruzada del seed
(dev-backend)". No hice commit — pendiente de que el coordinador consolide.
