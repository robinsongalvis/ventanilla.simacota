# Cronograma de implementación — Pieza angular (P2.1)

> **ESTADO (2026-07-21, tarde):**
> - **Fase 0 ✅ CERRADA** (PdC 0 aprobado) — golden de paridad en `main` vía PR #121; de paso destaparon el P0 del guard de consecutivos (corregido en el mismo PR con regresión).
> - **Fase 1 ✅ CERRADA** (PdC 1 aprobado por el propietario con dossier de 6 puntos) — PR #131 mergeado en `main` = `1957817`; golden diff 0 sin editarlos; `lib/radicacion.ts` retirado (0 refs); consulta `EXT-` 34/34; mutación probada; revisión cruzada firestore-datos + arquitecto (aprobado con observaciones, ninguna bloqueante); Production de Vercel `success` sobre el commit exacto; 0 previews en Error.
> - **Condiciones de entrada registradas para Fase 2** (del PdC 1): el contrato IMPLEMENTADO del constructor es la fuente de verdad (no la firma del blueprint); `horaRadicado` con `timeZone: 'America/Bogota'` explícita en el endpoint servidor; ampliar el golden a bordes (anónimo, reservada, 0/1/N adjuntos, sin correo) antes de fijar la política de `null` explícito.
> - **Fase 2 🔄 EN CURSO** — reglas de control adicionales del propietario: revisiones cruzadas (Seguridad, Datos, QA + auditoría de conformidad arquitectónica con 5 preguntas) ANTES de abrir el PR; evidencia etiquetada por origen (local / CI-emulador / producción) sin mezclar niveles; comprobación explícita de alcance (kill-switch OFF, `firestore.rules` y `storage.rules` sin diff, producción idéntica); sección "Lecciones aprendidas" en el dossier; cero adaptaciones silenciosas del diseño.
> - **DECISIONES DEL PROPIETARIO (22-jul, PdC 2 — constancia por Regla Suprema):**
>   1. **Evidencia de concurrencia:** el criterio "contra el emulador" era inejecutable localmente (solo Java 8) desde su redacción. Se ACEPTA para el PdC 2 la evidencia con el handler POST real + mocks fieles en la frontera del SDK (revisada por QA caso por caso), y el test contra emulador real en CI pasa a ser **PRECONDICIÓN DE LA FASE 3** (dueño: QA + devops) — la concurrencia real se demuestra ANTES de encender el switch.
>   2. **Re-alcance de la Fase 3:** el kill-switch se entregó como constante NO cableada al dashboard (decisión documentada, no silenciosa). La Fase 3 deja de ser "flip de 1 línea": es un **PR de conmutación** (fetch+FormData+estados+anti-doble-submit) con revisión cruzada propia; el rollback es revert+redeploy (~3 min), no instantáneo. Precondiciones de Fase 3 añadidas: test de emulador (punto 1), verificación de `FIREBASE_STORAGE_BUCKET` en prod, medición p50/p95 cold/warm, UAT con la funcionaria (R8), contrato FormData tipado compartido (DT-4), y test del blueprint §move-finalize-falla (H2, cerrado en Fase 2).

- **Base:** blueprint v2 aprobado (`docs/blueprints/CN-pieza-angular-radicacion-interna.md`, PR #119), revisión cruzada de arquitectura/seguridad/datos/QA.
- **Autorización:** propietario, con condiciones (retiro de `lib/radicacion.ts` con evidencia previa — aportada; `null` explícito; estándar por fases con rollback; **definición objetiva de "terminada" por fase**).
- **Objetivo:** cerrar CR-1 y CR-2 llevando la radicación interna a servidor, sin migración de datos ni downtime. Madurez 7.8 → ~8.4.
- **Regla rectora:** estabilidad, seguridad, trazabilidad y calidad por encima de velocidad. Cada fase es reversible, medible, y tiene punto de control (PdC) del propietario.

## Principios de ejecución (todas las fases)

1. **Una fase = un PR** con CI verde (3 checks) + revisión cruzada de los agentes que correspondan.
2. **Cada agente en worktree aislado** (lección de la contención del 21-jul).
3. **Evidencia por entrega**: tests, mutación (ADR-0015), y verificación en producción donde aplique.
4. **Definición objetiva de "terminada"**: ninguna fase se da por completa por "ejecutar tareas", sino por cumplir sus **criterios de éxito medibles** con evidencia.
5. **Rollback definido y con disparadores explícitos** en cada fase antes de ejecutarla.
6. **Punto de control (PdC):** ninguna fase avanza sin tu visto bueno explícito, respaldado en la evidencia de la fase.
7. **Secuencia dura:** las reglas se cierran en un deploy SEPARADO y POSTERIOR al cutover confirmado. Nunca antes.

> **Convención de cada fase:** *Qué se hace · Criterios de éxito (definición de terminado) · Métricas a monitorear · Disparadores de rollback · Criterio de aprobación (PdC).*

---

## FASE 0 — Línea base de paridad (red de seguridad, sin cambio funcional)

**Qué se hace:** tests *golden/snapshot* que capturan la forma EXACTA en disco del `VentanillaRadicado` que produce hoy cada superficie (público `api/radicacion` + interno `radicarVentanilla`), incluyendo el `null` explícito de campos no diligenciados.

**Criterios de éxito (terminado):**
- Existe un snapshot por cada una de las 2 superficies vivas.
- Cada snapshot incluye al menos un caso con campos no diligenciados y los fija como **`null` explícito** (no ausentes).
- Los snapshots son **deterministas** (fecha/uid inyectados, sin `new Date()` libre) — corren verde dos veces seguidas.

**Métricas a monitorear:** superficies cubiertas (meta = 2); casos con `null` explícito capturados (≥ 1 por superficie); corridas verdes consecutivas (2/2); `tsc`/lint = 0.

**Disparadores de rollback:** N/A (solo agrega tests). Si un snapshot no es determinista o no captura el `null`, **se corrige antes del PdC** — no se aprueba la fase.

**Criterio de aprobación (PdC 0):** snapshots verdes, deterministas, con el `null` explícito capturado, revisados por ti. → autoriza Fase 1.

## FASE 1 — Constructor puro compartido + retiro de código muerto (M1)

**Qué se hace:** crear `lib/recepcion/construir-radicado.ts` (superset parametrizado, preserva `null`, N adjuntos como `api/radicacion`); refactorizar las 2 superficies vivas para usarlo; **retirar `lib/radicacion.ts`** (código muerto ya evidenciado). **NO se toca** la consulta pública de radicados legacy `EXT-`.

**Criterios de éxito (terminado):**
- **Diff de los golden snapshots de Fase 0 = 0** (la forma en disco no cambia byte a byte antes/después).
- `lib/radicacion.ts` eliminado; **0 referencias rotas** (`tsc` verde).
- La consulta pública de radicados `EXT-` sigue funcionando (test verde).
- Mutación probada: revertir el uso del constructor → la suite falla.

**Métricas a monitorear:** diff de snapshot (meta = 0); referencias rotas (meta = 0); superficies migradas al constructor (2); test de consulta `EXT-` (verde); suite total (≥ conteo actual); resultado de mutación (rojo al revertir).

**Disparadores de rollback (`git revert` del PR):** cualquier diff de snapshot ≠ 0; rotura de la consulta `EXT-`; caída de la suite; regresión detectada en la ruta pública de radicación.

**Criterio de aprobación (PdC 1):** paridad byte-idéntica + revisión cruzada firestore-datos (shape) y arquitecto (shared-fate) SÓLIDA + CI verde. → autoriza Fase 2.

## FASE 2 — Endpoint servidor de radicación interna (M2), con kill-switch OFF

**Qué se hace:** crear `app/api/radicacion/interna` (Admin SDK; gate de rol explícito ADMIN/RECEPCIONISTA; `consecutivo-legal`; `staging→tx→finalize`; **`tx.create`** para el doc; **trazabilidad `tx.set` con id determinístico dentro de la tx**; `tipoPresentacion` por enum server-side; magic-bytes; límites de archivo server-side; tenant forzado; **sin leer campos de estado del body**). Frontend con **kill-switch de 1 línea, por defecto OFF**.

**Criterios de éxito (terminado):**
- **Matriz de pruebas 100% verde** (todos los casos abajo).
- **Kill-switch OFF verificado** por test/grep ⇒ la producción no cambia su comportamiento.
- Concurrencia+fallo probada **invocando el endpoint real** contra el emulador (no reimplementación).
- Mutación probada en la ruta nueva.

**Métricas a monitorear:** casos de la matriz verdes (meta = 100%): autorización por rol (FUNCIONARIO/JEFE→403, ADMIN/RECEPCIONISTA→200, sin sesión→401), forja de estado (body ignorado), concurrencia+fallo (endpoint real), fallo en `staging` ⇒ 0 consecutivo/0 radicado, **tx aborta ⇒ ni radicado ni trazabilidad parcial**, integridad de adjunto, mutación. Además: estado del switch (OFF); CI incl. emulador (verde).

**Disparadores de rollback (`git revert`):** cualquier caso de la matriz en rojo; el switch resulta ON por error; el endpoint acepta un rol no autorizado o un campo de estado del body; hallazgo ALTO en la revisión cruzada de seguridad.

**Criterio de aprobación (PdC 2):** matriz 100% verde + 3 revisiones cruzadas (seguridad **sin hallazgos altos**, datos **sólido**, qa **suficiente**) + evidencia de switch OFF + CI verde. → **autorizas el cutover** (Fase 3).

## FASE 3 — Cutover: activar el kill-switch ON (convivencia + monitoreo)

**Qué se hace:** activar el switch — la radicación interna pasa al endpoint servidor. El cliente viejo permanece disponible (rollback instantáneo).

**Criterios de éxito (terminado):**
- Radicaciones internas reales de prueba **correctas** (radicado + consecutivo + trazabilidad atómicos).
- **Cero errores** en la ventana de monitoreo que definas.
- El consecutivo avanza **sin huecos ni duplicados** (detector = 0/0).

**Métricas a monitorear (ventana):** tasa de error del endpoint interna (meta = 0%); latencia p95; nº de radicaciones internas exitosas; huecos/duplicados en la serie (detector, meta 0/0); fallos de `move` de Storage (N8, vigilado); logs/eventos de error.

**Disparadores de rollback (→ switch OFF inmediato, 1 línea):** cualquier error de radicación interna en producción; hueco o duplicado en la serie; latencia inaceptable sostenida; adjunto perdido; cualquier comportamiento no previsto.

**Criterio de aprobación (PdC 3):** ventana de monitoreo (duración que tú decidas — p. ej. 48–72 h o N radicaciones) **sin incidencias** + barrida de consecutivos limpia + tu confirmación de estabilidad. → autoriza Fase 4.

## FASE 4 — Cierre de reglas (M3), deploy SEPARADO post-cutover

**Qué se hace (solo tras cutover confirmado):** `firestore.rules` (`counters write:if false` + `ventanilla_radicados create:if false`) y `storage.rules` (`radicados/{id}/{archivo} create:if false`). Deploy de reglas **separado**, precedido de `--dry-run`.

**Criterios de éxito (terminado):**
- Un cliente **ya NO puede** escribir `counters`/`create`/`storage` — demostrado por test `e2e/rules` con reglas cerradas.
- La radicación interna **sigue funcionando** server-side (no afectada por el cierre).
- Barrida de consecutivos en producción **0 huecos / 0 duplicados**.

**Métricas a monitorear:** test e2e de denegación (cliente bloqueado = éxito); barrida post-cierre (0/0); tasa de error de radicación interna post-cierre (meta 0%); verificación read-only en prod de que las reglas niegan la escritura cliente.

**Disparadores de rollback (re-deploy de reglas previas):** la radicación interna falla tras cerrar reglas (señal de cutover incompleto / kill-switch no OFF); cualquier escritura legítima bloqueada; error en el deploy de reglas.

**Criterio de aprobación (PdC 4):** denegación cliente demostrada + radicación server-side intacta + barrida limpia + tu visto bueno final. → **CR-1 y CR-2 CERRADOS · madurez ~8.4.**

---

## Tablero de control — resumen

| Fase | Definición de terminado (evidencia) | Reversible por | Métrica-guardián |
|---|---|---|---|
| 0 | Golden deterministas con `null` explícito | (solo tests) | diff determinista 2/2 |
| 1 | Diff de snapshot = 0 + `EXT-` intacto | `git revert` | diff de forma = 0 |
| 2 | Matriz 100% verde + switch OFF | `git revert` | casos rojos = 0 |
| 3 | Ventana sin incidencias + serie 0/0 | **switch OFF (instantáneo)** | tasa de error = 0% |
| 4 | Cliente denegado + interna intacta + barrida 0/0 | Re-deploy de reglas previas | escrituras cliente bloqueadas |

## Estimación

- **Esfuerzo:** 7–10 días asistidos: Fase 0 ~0.5 d · Fase 1 ~2–3 d · Fase 2 ~3–4 d · Fase 3 ~0.5 d + ventana de monitoreo (tú decides) · Fase 4 ~1 d.
- **Madurez:** 7.8 → ~8.4 al cerrar Fase 4. **Impacto:** seguridad ↑↑↑, mantenibilidad ↑↑↑, estabilidad ↑↑. Sin migración de datos ni downtime.

## Riesgos vigilados (del blueprint, con mitigación en el cronograma)

- **R1 secuencia de reglas invertida** → Fases 3 y 4 separadas; reglas solo post-cutover; precondición dura.
- **R2 rollback de dos planos** → runbook explícito; reglas versionadas aparte.
- **R3 regresión de authz** → gate de rol explícito + matriz de roles (Fase 2).
- **R4 shared-fate del constructor** → golden paridad (Fase 0) bloquea cambios de forma.
- **R9 superficie Storage** → incluida en el cierre de Fase 4.
