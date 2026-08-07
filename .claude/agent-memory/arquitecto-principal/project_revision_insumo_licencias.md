---
name: revision-insumo-licencias
description: Veredicto 6-ago-2026 sobre ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md (APROBADO CON CAMBIOS) y las tensiones arquitectónicas detectadas
metadata:
  type: project
---

Revisé (6-ago-2026) `docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md` como insumo pre-ADR de Fase 2 del motor: **APROBADO CON CAMBIOS**. Calidad alta (separación H/I/REC limpia, respeta bloqueo jurídico D.1077).

**Why:** el documento servirá de anexo de evidencia del ADR de Fase 2; las tensiones no resueltas se volverían decisiones implícitas.

**How to apply:** al revisar el ADR de Fase 2 o cualquier PR de series/migración de licencias, verificar que estas tensiones quedaron resueltas:
1. `SerieConsecutivoLegal` con `serieId` libre y `formato` como dato choca con D9 (enum cerrado `SerieConsecutivo`, `consecutivo-legal.ts:33`) y con el patrón `counters/{serie}-{año}` — debe declararse capa de metadatos sobre el mecanismo existente o enmendar D9 por ADR.
2. `verificarAvanceCounter` existe pero NO está cableada (deuda #7 ADR-0026 §A2); la siembra del contador al go-live (semilla 26-0019) no tiene doctrina frente al guard ni al detector de fantasmas (deuda #12).
3. Migración = **Fase 5** del plan, no Fase 2 (el doc mezclaba taxonomía).
4. `predio`/`modalidades` no pueden entrar al `Expediente` genérico del núcleo (viola A3.2/A3.3); van como dato por Definición o extensión por trámite.
5. Colisión de nombres: `radicadoLegal` (doc) vs `numeroExpediente` (blueprint §2) vs `radicadoId` (Fase 0) — exigir glosario.
6. Cohorte 2022-2024 sin columna estado (~132 registros) y conteo 201 vs 202 expedientes: deben resolverse antes del criterio de reconciliación automatizado.
