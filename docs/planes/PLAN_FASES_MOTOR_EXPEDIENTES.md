# Plan de implementación por fases — Motor de Expedientes (primer caso: Licencia de Construcción)

> **Estado: PROPUESTA PARA APROBACIÓN. No se escribe código todavía.** Base: ADR-0026 + blueprint v2. Cada fase con criterio de terminado, revisión cruzada y PdC del propietario, como la pieza angular. La Licencia de Construcción es la **primera instancia** del motor, no un módulo aparte.
> **Precondiciones globales (bloquean la Fase 1 en adelante):** concepto jurídico formal (hito de radicación + plazo de revisión previa + competencia), checklist oficial completo (falta pág. 2), validación con la Secretaría de Planeación. La Fase 0 puede avanzar sin ellas.

## Principios (todas las fases)
Una fase = un PR con CI verde + revisión cruzada · escritura server-side · evidencia por entrega · rollback definido · PdC del propietario · **nada toca producción de Simacota** (el módulo se prueba en stage cuando exista — coordinar con el frente de entornos). Regla de autorización de 6 pasos vigente para cualquier acción que toque un servicio.

## FASE 0 — Cimientos del motor (sin UI, sin datos vivos) `[no requiere concepto jurídico]`
**Qué:** las piezas de núcleo que el ADR declara CÓDIGO, aisladas y testeadas:
- Extender `SerieConsecutivo` con `'expedientes'` (verificado no-breaking) + **guard monotónico en `counters`** y prohibición de números legados (D9 — precondición de seguridad de datos).
- Tipos del **motor**: `DefinicionTramite` (checklist con requisitos condicionales, términos, régimen de subsanación), `Expediente`, `Actuacion` (con marca real/reconstruido), `Observacion`.
- Evaluador de **completitud** puro (requisitos obligatorios/condicionales → ¿completo?) — con tests.
- **Reloj de subsanación parametrizado por régimen** (`{días, unidad, prórroga, ventana}`) — nuevo, con tests que prueben D.1077 (30+15 hábiles) vs Ley 1755.
**Criterio de terminado:** tests unitarios verdes del evaluador y los relojes; `SerieConsecutivo` extendido sin romper la suite; guard de counters probado. Sin tocar reglas ni datos.
**Revisión cruzada:** datos + seguridad. **Rollback:** `git revert` (solo código nuevo aislado). **PdC 0.**

## FASE 1 — Definición de Trámite + reglas + Storage (parametrización) `[requiere checklist completo]`
**Qué:** modelar la **Definición de Trámite** en Firestore (colección administrable), cargar la **Licencia de Construcción** como primera Definición (los 19 requisitos con sus condiciones), reglas de aislamiento de `expedientes` + subcolecciones (`create/update/delete: if false`; lectura solo Planeación), y las rutas/reglas de Storage (carga server-side, descarga autorizada por tenant, hash server-side). Índices compuestos de la bandeja (enumerados — no hay gate que los cace).
**Criterio:** reglas desplegadas a stage con `--dry-run` OK; Definición de Licencia cargada y validada; índices declarados. **Revisión cruzada:** datos + seguridad. **PdC 1.**

## FASE 2 — Intake server-side (endpoints, sin resolución) `[requiere concepto jurídico para el hito]`
**Qué:** los endpoints `app/api/planeacion/*` de la fase de intake: crear expediente (consecutivo), cargar/versionar documentos, marcar checklist, crear observación de subsanación (reloj parametrizado), evaluar completitud, y el **handoff a Ventanilla** (tx cross-collection con guard `radicadoVentanillaId==null`, proyección minimizada, anti-forja). Gate de rol por transición, relectura de precondiciones en-tx.
**Criterio:** matriz de pruebas (rol, anti-forja, completitud bloqueante, handoff idempotente, sin huérfanos) verde; concurrencia contra emulador (precondición de cutover, como la pieza angular). **Revisión cruzada:** seguridad + datos + QA + arquitecto. **PdC 2.**

## FASE 3 — Paneles (UI) `[requiere validación con Planeación]`
**Qué:** panel de **Planeación** (dashboard, bandeja con búsqueda por predio/matrícula/solicitante, semáforo con 4º estado SUSPENDIDO, revisión documental + checklist, subsanaciones, timeline persistente, "Enviar a Ventanilla" con modal de fricción y bloqueo por obligatorios pendientes) y panel de **Ventanilla** (listos para radicar, radicación, seguimiento). Admin del checklist. Reutiliza componentes existentes (`BusquedaAvanzadaPanel`, `TimelineAuditoria`, etc.); design system claro real.
**Criterio:** UAT con la funcionaria de Planeación (sobre stage); criterios de aceptación UX del panel. **Revisión cruzada:** UX + frontend + QA. **PdC 3.**

## FASE 4 — Resolución de Licencia de Construcción (específico, con revisión legal) `[requiere concepto jurídico completo]`
**Qué:** la fase de resolución **propia de licencias** (no genérica): estudio técnico, visita, **citación a colindantes (valla, 5 días hábiles)**, proyección del **acto administrativo (resolución motivada)**, notificación CPACA, recursos, **silencio positivo**. Estados de resolución al enum vía este alcance, con Gobierno Digital.
**Criterio:** cumplimiento normativo verificado; términos y silencio positivo probados. **Revisión cruzada:** gobierno digital + seguridad + QA + arquitecto. **PdC 4.**

## FASE 5 — Migración `[tras el motor estable]`
**Qué:** el módulo de migración (D6): asistente de expedientes en trámite (con auditoría, actuaciones marcadas reconstruidas, guard anti-doble-radicación), y expediente-referencia para históricos bajo demanda.
**Criterio:** migración de prueba en stage sin huecos/duplicados (detector de fantasmas), historial preservado. **Revisión cruzada:** datos + gobierno digital. **PdC 5.**

## Después: segundo trámite como prueba del motor
Instanciar **"Concepto de uso del suelo"** como segunda Definición → medir cuánto es dato (intake) y cuánto código (resolución). Es la validación empírica de que el motor generaliza en la intake (veredicto del blueprint v2).

## Orden y dependencias
```
Fase 0 (cimientos) ─────────────► puede empezar ya (no necesita jurídico)
   │
   ▼ (checklist completo)
Fase 1 (definición + reglas)
   │
   ▼ (CONCEPTO JURÍDICO — bloqueante para el hito de radicación)
Fase 2 (intake) ──► Fase 3 (paneles, con Planeación) ──► Fase 4 (resolución) ──► Fase 5 (migración)
```
**Recomendación:** arrancar por la **Fase 0** (cimientos) en cuanto lo autorices — es la única que no depende del concepto jurídico ni del checklist completo, y deja el motor listo para recibir la parametrización. En paralelo, tú gestionas el concepto jurídico y la página 2 del checklist.
