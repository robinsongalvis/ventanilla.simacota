# Fase 3 — Propuesta de planificación

- **Estado:** PROPUESTA (pendiente de aprobación; al aprobarse se registra como ADR-0004 y levanta el congelamiento de forma gobernada)
- **Fecha:** 2026-07-11
- **Marco:** criterio de éxito v2 (confiabilidad/cumplimiento/mantenibilidad demostrados con evidencia automatizada) + 4 principios + ciclo permanente de hallazgos (Riesgo→ADR→Implementación→Pruebas→Revisión cruzada→Evidencia→Cierre).

## Norte de la Fase 3

No es una lista de funcionalidades. Fase 2 dejó un sistema **verificado** (auditado
punta a punta, 15 E2E, Alcaldía Sintética, primer control normativo ejecutable).
Fase 3 lo convierte en un sistema **auto-verificable, gobernable y más autónomo**:
que demuestra su propia confiabilidad y cumplimiento de forma continua, integra la
IA como capacidad transversal verificable, y reduce el trabajo operativo humano sin
perder trazabilidad. Cada avance debe poder mostrarse con métricas, no afirmarse.

## 1. Objetivos de la Fase 3

Cinco pilares de evolución (no features):

- **P-A · Cumplimiento como código.** Convertir los hallazgos normativos abiertos en
  controles ejecutables (extiende el modelo de H1) y construir el **auditor normativo
  ejecutable**: una matriz de aserciones con norma+artículo que corre en CI.
- **P-B · Auditoría continua y compuerta de despliegue.** Completar los auditores del
  laboratorio (seguridad con `rules-unit-testing`, rendimiento con presupuestos) y el
  **orquestador + informe ejecutivo** que corre antes de cada despliegue. Regla ya
  acordada: los E2E y controles corren antes de cualquier deploy.
- **P-C · Observabilidad y criterios de aceptación desde el diseño.** Estándar (principio 1):
  todo módulo nace instrumentado (métricas/trazas estructuradas, Sentry) con criterio de
  aceptación explícito. Instrumentar primero los flujos críticos existentes (radicación,
  asignación, prórroga, respuesta) para que las KPIs se midan, no se supongan.
- **P-D · IA transversal verificable.** SIMI deja de ser módulo aislado: registro de
  prompts versionado, datasets dorados de evaluación, trazabilidad de cada interacción,
  umbrales de confianza, y el invariante "IA sugiere / funcionario decide" convertido en
  **control ejecutable** (test que falla si una salida de IA muta estado sin acción humana).
- **P-E · Autonomía operativa gobernada.** Reducir trabajo humano con trazabilidad intacta:
  aprovisionamiento de municipio de punta a punta (hoy ~85% por script) e informes
  automáticos. Cada incremento se mide en "pasos manuales eliminados".

## 2. Riesgos técnicos y normativos prioritarios

| # | Riesgo | Tipo | Sev. | Trata en |
|---|--------|------|------|----------|
| H2 | Identidad reservada visible en vistas internas (Ley 1581) | Normativo | MEDIA-ALTA (ALTA si denunciante) | P-A (control + enmascaramiento reutilizando `identidadProtegida`) |
| R3 | Hueco de consecutivo AGN si la subida de adjunto no completa | Técnico/normativo | MEDIA | P-A / P-C (atomicidad + control) |
| R6 | Prórroga no impedida tras vencimiento del término (art. 14) | Normativo | MEDIA-BAJA | P-A |
| — | Unidad calendario/hábiles de la prórroga (deuda declarada en ADR-0003) | Normativo | BAJA | P-A |
| R4/R5 | Carreras de UI (modal "Resumen del día"; confirmación de asignación) | Técnico/UX | MEDIA/BAJA | P-C (observabilidad revela; corrección con control) |
| — | Reglas de Firestore sin prueba unitaria (aislamiento por tenant no verificado automáticamente) | Seguridad | ALTA (latente) | P-B (`rules-unit-testing`) |
| — | Datos institucionales propios del municipio (dependencias/TRD) sin importador | Producto | MEDIA | P-E |
| — | IA sin dataset de evaluación ni control del invariante asistivo | IA/normativo | MEDIA | P-D |

Riesgo transversal de gobernanza: levantar el congelamiento reintroduce el riesgo de
scope creep. Mitigación: Fase 3 se ejecuta bajo el ciclo permanente de hallazgos y el
triaje; cada pilar entra por ADR.

## 3. Dependencias entre módulos

```
P-C (observabilidad)  ──► habilita medición de ► P-B (auditor rendimiento) y KPIs
        │                                         │
        └──► instrumenta flujos ► P-D (medir IA)  │
P-A (controles normativos) ──► alimentan ► P-B (orquestador: los agrega en el informe)
P-B (auditores individuales) ──► son prerequisito de ► orquestador + compuerta de deploy
P-E (autonomía/provisioning) ──► depende de ► Alcaldía Sintética (Fase 2) + modelo de datos institucional
```

- **P-C es fundacional**: sin observabilidad no hay KPIs verificables ni auditor de rendimiento.
- **El orquestador (P-B) es el último en integrarse**: agrega auditores que deben existir antes.
- **P-A es en gran parte independiente** y de alto valor inmediato (reutiliza patrones ya probados en H1).
- **P-D depende de P-C** para medir la IA con evidencia.

## 4. Entregables medibles

- **P-A:** control de H2 (enmascaramiento por rol + test de regresión); controles de R6 y de la unidad de prórroga; auditor normativo ejecutable v1 (matriz Ley 1755/1437/1581/AGN con aserciones en CI). *Medible:* Nº de hallazgos normativos con control automatizado / total.
- **P-B:** `rules-unit-testing` (matriz tenant×rol×colección) en CI; presupuestos de rendimiento (Lighthouse + latencia p95 + lecturas Firestore) con umbrales; orquestador `auditar.ts` que emite `docs/auditorias/AAAA-MM-DD.md` con semáforo de preparación para producción. *Medible:* % de despliegues precedidos por informe verde.
- **P-C:** flujos críticos instrumentados (radicación, asignación, prórroga, respuesta) con métricas y trazas; plantilla "módulo nuevo nace con observabilidad+tests+aceptación". *Medible:* % de flujos con observabilidad.
- **P-D:** registro de prompts versionado + datasets dorados con precisión mínima; trazabilidad 100% de interacciones IA; control ejecutable del invariante asistivo. *Medible:* precisión del dataset; % interacciones IA auditadas.
- **P-E:** provisioning de municipio de punta a punta documentado y medido; importador de datos institucionales (dependencias/TRD); informe institucional automático. *Medible:* pasos manuales por municipio (baseline ~5 externos + datos propios).

## 5. Indicadores de éxito (KPIs)

Alineados al criterio v2 — todos verificables con evidencia automatizada:

1. **% de hallazgos ALTA/MEDIA con control de regresión** — meta 100% (hoy: H1 ✔, resto abierto).
2. **Cobertura de auditoría automática pre-deploy** — auditores (funcional, seguridad, normativo, rendimiento, IA) en verde como compuerta; meta: ningún deploy sin informe verde.
3. **% del flujo institucional con observabilidad instrumentada** — meta ≥ 90% de flujos críticos.
4. **MTTR de hallazgos** (tiempo Riesgo→Cierre trazable) — tendencia a la baja; H1 es la línea base.
5. **Pasos manuales eliminados por iteración** (autonomía) — cada iteración reduce ≥ 1 paso humano sin perder trazabilidad.
6. **Calidad y trazabilidad de IA** — pass-rate del dataset dorado ≥ umbral acordado; 100% de interacciones IA con registro auditable; 0 mutaciones de estado por IA sin acción humana (control ejecutable verde).
7. **Regresiones normativas** — 0 (todos los controles de cumplimiento en verde en CI).

## 6. Orden óptimo de ejecución (valor ↑ / riesgo ↓)

Secuencia por olas; cada pilar entra por ADR y bajo el ciclo permanente de hallazgos.

- **Ola 1 — Fundaciones y valor inmediato (paralelizable):**
  - **P-C** (observabilidad de flujos críticos) — desbloquea toda medición posterior.
  - **P-A/H2** (control de identidad reservada) — resuelve el mayor riesgo normativo abierto reutilizando patrones probados; bajo riesgo técnico, alto valor de cumplimiento.
  - **P-B/seguridad** (`rules-unit-testing`) — cierra el riesgo ALTA latente de aislamiento por tenant, hoy sin prueba automática.
- **Ola 2 — Cumplimiento y rendimiento como código:**
  - **P-A** auditor normativo ejecutable v1 + controles de R3/R6/unidad de prórroga.
  - **P-B/rendimiento** presupuestos y contadores de costo.
- **Ola 3 — IA transversal:**
  - **P-D** gobernanza de IA + invariante asistivo como control + evaluación; se apoya en la observabilidad de la Ola 1.
- **Ola 4 — Integración y autonomía:**
  - **P-B** orquestador + informe + compuerta de despliegue (agrega todos los auditores).
  - **P-E** autonomía de provisioning e informes automáticos.

Justificación del orden: primero lo que **habilita medición** (P-C) y lo que **cierra
riesgo abierto con bajo costo** (H2, rules-unit-testing); luego lo que **amplía la
cobertura de cumplimiento y rendimiento**; después la **IA transversal** (necesita
medición previa); y al final la **integración/orquestación**, que por definición
agrega lo construido antes. Cada ola entrega valor demostrable de forma independiente:
si el proyecto pausa tras cualquier ola, lo entregado ya rinde.

## Gobernanza de la Fase 3

- Al aprobarse, esta propuesta se registra como **ADR-0004** y levanta el congelamiento
  de forma gobernada (solo para el alcance de los pilares aprobados).
- Cada pilar/ola: análisis de arquitectura + ADR antes de codear (triaje Nivel 3),
  delegación real con revisión cruzada, y cierre trazable con control de regresión.
- La planificación fina (backlog, estimación, criterios de aceptación por entregable) la
  detalla `product-owner`; el diseño técnico de cada pilar lo valida `arquitecto-principal`.
- Supuesto declarado (Principio 13): las olas no traen estimación temporal hasta que
  `product-owner` las dimensione con la funcionaria y el estado real del repo.
