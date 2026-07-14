# Plan del Bloque 3 — Consolidación arquitectónica (preparación)

- **Fecha:** 2026-07-13
- **Estado:** **preparación** — NO autoriza implementación. El Bloque 3 se abre
  solo tras el Acta de Cierre Formal del Bloque 2 (H3 CERRADO con las dos
  evidencias pendientes: CI + barrida de Producción).
- **Objetivo:** cerrar la deuda arquitectónica que el Bloque 2 difirió
  deliberadamente (primero cerrar el riesgo H3; después optimizar), sobre una
  base estable y con evidencia.

## 1. Deuda técnica generada/declarada en el Bloque 2

| # | Deuda | Origen | Por qué se difirió |
|---|---|---|---|
| D1 | **Migración cliente→servidor de la ruta interna** (`radicarVentanilla.ts`) | Opción A (ADR-0016) | Cerrar H3 no la exigía; su refactor sí. |
| D2 | **Refactor del constructor del radicado** (hoy triplicado: cliente + `api/radicacion` + interna) | Hallazgo de implementación (evidencia archivo:línea) | El propietario prohibió refactor mientras H3 abierto. |
| D3 | **N1** — `counters` escribible por cliente (`firestore.rules:208-211`) | Auditoría | Requiere que ninguna escritura cliente de contador sobreviva → depende de D1. |
| D4 | **N4** — `create` de `ventanilla_radicados` forjable desde cliente (`firestore.rules:143-144`) | Auditoría / seguridad | Cerrar la regla depende de D1 (mover el `create` a servidor). |
| D5 | **N3 en la ruta interna** — sin validación de magic bytes | Auditoría | La interna sigue en cliente; se cierra con D1. |
| D6 | **N8 completo** — huérfanos/ventana referencial de Storage | Plataforma (Storage no transaccional con Firestore) | Mitigado (staging→move / upload-after); falta flag `archivoEnFinalizacion`, capa de descarga (procesando vs 404), reconciliación (cron) y TTL de `_pendientes/`. |
| D7 | **Wrapper de orquestación** del helper transaccional | Propuesta rechazada por YAGNI | Sin divergencia funcional demostrada tras 5 migraciones; reevaluar con datos. |
| D8 | **N5** — 17 tests `readFileSync + toContain` frágiles | qa | Se actualizan al tocar cada archivo; consolidar a tests de comportamiento. |
| D9 | **Acta de subsanación AGN 060/2001 art. 5** para fantasmas históricos | gobierno-digital | Solo si la barrida de Producción arroja huecos. |
| D10 | **Branch protection** (los 3 checks requeridos) | ADR-0013 | Acción administrativa del propietario. |

## 2. Arquitectura propuesta (Bloque 3)

Secuencia recomendada, por dependencia y máximo desbloqueo:

1. **D1+D2 juntos (pieza angular):** crear `app/api/radicacion/interna` (Admin
   SDK, `requireActiveInternalUser` + **autorización rol/tenant** reimplementada
   —ADMIN/RECEPCIONISTA—, validación estricta de entrada, **magic bytes** [cierra
   D5], **no** leer campos de estado del body [cierra la vía de forja de D4]).
   La construcción del radicado se extrae a un **constructor puro compartido**
   (resuelve D2) que reusan las tres superficies. El frontend conmuta con
   kill-switch de una línea. Reutiliza el helper `consecutivo-legal` (Admin) y el
   patrón staging→tx→finalize ya validados → elimina la divergencia cliente.
2. **D3+D4 (cierre de reglas):** tras el cutover confirmado, `counters write:if
   false` y `ventanilla_radicados create:if false`. Secuencia dura: reglas
   **después** del cutover (revertir reglas sin revertir el cliente deja el
   sistema sin escritura).
3. **D6 (N8):** flag transaccional `archivoEnFinalizacion`, distinción en la
   capa de descarga, cron de reconciliación, TTL de `_pendientes/`.
4. **D7 (wrapper):** decidir con la evidencia de divergencia (ver §5).
5. **D8 (N5):** consolidar los tests frágiles a comportamiento donde el emulador
   lo permita.

## 3. Riesgos y su mitigación

| Riesgo | Mitigación |
|---|---|
| **Regresión de autorización** al mover la interna a servidor | Reimplementar rol/tenant en el handler; matriz `test:rules` que cubra que el `create` cerrado no deja puertas laterales. |
| **Ventana de cutover** (cliente vivo + servidor nuevo) | Operador único + kill-switch de 1 línea; deploy en pasos separados con orden explícita del propietario. |
| **Secuencia de reglas invertida** | Precondición dura: reglas después del cutover; test que falle si se activan antes. |
| **Cold start / latencia** navegador→Vercel→GCS | Medir p50/p95 segregando cold/warm (Principio 13); `maxDuration` en `vercel.json`. |
| **N8 lifecycle nunca aplicado** (patrón H5) | Runbook versionado del `gsutil lifecycle set`; TTL > ventana de reconciliación. |
| **Shared fate** del constructor compartido | Cobertura exhaustiva + revisión cruzada obligatoria. |

## 4. Estrategia de pruebas (Bloque 3)

- Repros por ruta que hoy dependen de mocks → migrar a **integración contra
  emulador** donde toquen reglas (el harness `e2e/rules/` ya existe).
- **Concurrencia + fallo** (intersección aún no cubierta): extender la
  integración H3 con un caso de fallo simultáneo, no solo camino feliz.
- Autorización del nuevo endpoint interno: matriz de roles (FUNCIONARIO/JEFE no
  radican por la interna) + validación de `oficinaDestino` contra el alcance.
- N8: test de `move` fallido → radicado válido + flag + reconciliación.
- Mutación en cada corrección (ADR-0015): revertir → rojo.

## 5. Vacíos de cobertura detectados (para cerrar en Bloque 3)

1. **Concurrencia + fallo** en la asignación de consecutivo (hoy: concurrencia
   feliz en la integración; fallo aislado en mocks; **la intersección no**).
2. **Prueba de reglas** que garantice que la identidad reservada y los campos de
   estado no son escribibles/legibles indebidamente desde cliente (liga a N4 y
   al H1 de la auditoría, fuera de H3).
3. **`storage.rules`** y la categoría IA no están en la compuerta (R14/R15 del
   registro) — el gate confía en "suite verde" sin verificar tests específicos.
4. **N5:** 17 tests de texto (`readFileSync`) — frágiles ante refactor; no
   validan comportamiento.
5. **Cobertura de `move`/reconciliación** de Storage (N8) — inexistente.

## 6. Oportunidades de simplificación/consolidación (a discutir con H3 cerrado)

- **Constructor puro único** del radicado (elimina la triplicación D2) — mayor
  retorno de mantenibilidad; es la pieza que además desbloquea D3/D4/D5.
- **Wrapper de orquestación** (`asignar → construir(puro) → confirmar → set`):
  reevaluar con la evidencia real de las 5 migraciones. Criterio objetivo: si
  hay divergencia funcional o costo de mantenimiento medible, se justifica; si
  no, se mantiene el helper de bajo nivel (evitar abstracción anticipada).
- **Helpers de Storage** (`guardarEnStorage`/`moverEnStorage` y sus gemelos de
  salidas) hoy duplicados por ruta — candidatos a un único módulo si el wrapper
  o el constructor compartido los absorbe.
- **Detector de fantasmas como control periódico** (no solo de cierre): cron de
  auditoría de continuidad del consecutivo (reduce trabajo humano, criterio de
  éxito v2).

## 7. Plan de reversión (Bloque 3)

Aditivo por diseño: cada migración de ruta deja el camino anterior vivo un ciclo
(kill-switch de 1 línea). Reglas se revierten con 2 líneas (por eso van después
del cutover). La tx no cambia el formato de los documentos → sin migración de
datos hacia atrás. Objetos de `_pendientes/` → reconciliación o TTL.

## 8. Condición de arranque

El Bloque 3 **no se abre** hasta: (a) Acta de Cierre Formal del Bloque 2 con H3
CERRADO; (b) branch protection aplicada (D10). Recomendación: empezar por D1+D2
(pieza angular), que cierra en cascada D3/D4/D5 y elimina la divergencia.
