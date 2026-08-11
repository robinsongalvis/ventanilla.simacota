# Project Memory — dev-backend

- [Alcaldía Sintética (Fase 2 laboratorio)](project_laboratorio_alcaldia_sintetica.md) — revisión cruzada APROBADO CON CONDICIONES; 2 condiciones media pendientes del autor (firestore-datos)
- [Hallazgo rate limit x-forwarded-for](project_hallazgo_ratelimit_xff.md) — posible bypass del rate limit público de /api/radicacion; pendiente de seguridad/devops
- [Línea base lectura 2B](project_linea_base_lectura_2b.md) — ADR-0011: 210 docs leídos, p95 824ms, sin límite; método reproducible para comparar tras 2A
- [ADR-0012 R6 prórroga](project_adr0012_r6_prorroga.md) — control temporalidad implementado, tests verdes; pendiente revisión cruzada gobierno-digital + seguridad
- [R11 busqueda-avanzada RESUELTO](project_r11_busqueda_avanzada_resuelto.md) — ADR-0010 §2.1: escaneo por lotes con cursor, techo 500, 210→25 docs (−88%); contrato aditivo, sin tocar frontend; pendiente revisión cruzada seguridad+gobierno-digital+arquitecto
- [Predio histórico — migración](project_predio_historico_migracion.md) — `Expediente.predio` + `mapearPredioHistorico`: direccion=municipio siempre descartada, area 16/202 desalineada, matricula 11/202 limpia; correcciones fuera de alcance; PII sigue en 0 en CI
- [DF-10 — histórico sin resolver](project_df10_historico_sin_resolver.md) — marca APARTE (no enum), reutiliza `faltaCedula=''`/`esSubtipoEnCuarentena` ya anticipados por frontend; 196/6 real; 3er código sin resolver hallado; KPI "En trámite" del Libro sigue pendiente de excluir RECONSTRUIDO
