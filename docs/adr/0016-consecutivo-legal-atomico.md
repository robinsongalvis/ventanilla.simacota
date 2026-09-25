# ADR-0016 — Corrección de H3: asignación atómica del consecutivo legal (Bloque 2)

- **Fecha:** 2026-07-13
- **Estado:** implementación completada — **pendiente de validación formal** (ADR-0015: cierre condicionado a integración por CI + barrida de Producción). No CERRADO hasta esas dos evidencias.
- **Responsable:** Robinson David Galvis (propietario)
- **Roles consultados:** arquitecto-principal, dev-backend, firestore-datos, seguridad, qa, devops, gobierno-digital (diseño + revisión cruzada 6/6 + revisión adversarial).

## Contexto

H3 (hallazgo de la línea base `docs/auditorias/AUDITORIA_ARQUITECTONICA_2026-07-13.md`):
el consecutivo legal (Acuerdo AGN 060/2001) se asignaba en una transacción del
contador **separada** de la persistencia del documento; un fallo entre medias
dejaba un "consecutivo fantasma" (número consumido sin documento). Reproducido
en rojo (Bloque 1) y confirmado en STAGE (`FASE2_BITACORA.md:524-538`). El
defecto existía en **5 rutas / 3 series** (radicados, salidas, planillas). No
existía ningún ADR previo que registrara la arquitectura de numeración — este es
el primero.

## Decisión

**Invariante rectora:** *ningún consecutivo confirmado sin su documento*
(no-huérfano, por-radicado) — no igualdad de cardinalidad.

1. **Helper único de dos fases** `lib/server/consecutivo-legal.ts`:
   `leerConsecutivosLegales` (todas las lecturas de contador antes de cualquier
   escritura) + `confirmarConsecutivosLegales` (escribe los contadores). El
   helper **recibe la transacción del caller, nunca abre la suya**; solo se
   invoca dentro de una `runTransaction`, con cómputo puro y `tx.set` (ningún
   I/O dentro del callback).
2. **Rutas Admin SDK** (`registro-expres`, `planillas/generar`, `radicacion`
   ciudadana, `salidas/registrar`): consecutivo + documento se confirman en
   **una sola `runTransaction`** (atómico). Para adjuntos, patrón
   **staging → transacción → finalize**: subir a `radicados/_pendientes/{requestId}`
   (o `salidas/_pendientes/...`) **antes** de la tx (una subida fallida no gasta
   número), construir el path final canónico dentro de la tx, y `move`
   post-commit. Preserva la convención de path que consume la autorización
   anti-IDOR de descarga (H-01) sin tocarla.
3. **Ruta interna** (`lib/actions/radicarVentanilla.ts`, SDK cliente) — **Opción A**:
   fix mínimo client-side. `peek` del contador (solo lectura) → subir adjuntos →
   `runTransaction` del SDK cliente que confirma contador + documento juntos, con
   guarda anti-concurrencia (operador único; aborta y reintenta, nunca repetido).
   **No** se migra a servidor en este bloque (ver deuda).

## Alternativas evaluadas

1. **`upload-after` en vez de staging→move.** Válida y más simple, pero el
   propietario pidió validar `staging → transacción → finalize` en la ruta
   ciudadana; se implementó ese patrón. Para la interna (cliente, sin `move` en
   el SDK) se usó el orden peek→upload→tx equivalente.
2. **Wrapper de orquestación sobre el helper.** *Rechazado por ahora* (ADR-0015:
   no introducir abstracción sin defecto demostrado). Se reevalúa en Bloque 3
   con la evidencia de divergencia real tras las 5 migraciones (hoy: cero
   divergencia funcional observada).
3. **Migración cliente→servidor de la interna ahora.** *Rechazada en Bloque 2*:
   exige extraer/duplicar el constructor del radicado (refactor diferido) para
   cerrar N4. Se difiere completa a Bloque 3 (Opción A cierra H3 sin ese refactor).

## Consecuencias

- **Positivas:** H3 eliminado en código en las 5 rutas, con control de regresión
  por **mutación** en cada una (rojo contra el defecto, verde con el fix) y suite
  completa en verde (899/899). El primitivo de numeración queda centralizado en
  un helper (reutilización, Principio 3).
- **Deuda declarada, diferida a Bloque 3** (ver `docs/PLAN_BLOQUE3.md`):
  N1 (`counters` escribible por cliente), N3 (magic bytes en la ruta interna),
  N4 (`create` forjable desde cliente) — los tres requieren la migración
  cliente→servidor de la interna + cierre de reglas; N8 (huérfanos de Storage:
  Storage no es transaccional con Firestore) queda **mitigado, no cerrado**
  (falta flag `archivoEnFinalizacion`, capa de descarga, reconciliación, TTL);
  consolidación cliente→servidor + refactor del constructor (triplicado);
  evaluación del wrapper de orquestación.
- **Divergencia temporal:** la ruta interna quedó con una variante *cliente* del
  patrón (el helper es Admin-typed). Se unifica al migrarla en Bloque 3.

## Verificación de cumplimiento (ADR-0015)

- Reproducción en rojo + fix + control por mutación **por ruta** (hecho).
- Suite completa en verde (hecho: 899/899).
- **Integración contra emulador real** (`e2e/rules/h3-atomicidad-integracion.test.mjs`,
  job `laboratorio-emulador`): pendiente de corrida en el PR sin merge.
- **Barrida del detector de consecutivos fantasma sobre Producción**
  (`scripts/laboratorio/detectar-consecutivos-fantasma.mjs`, solo lectura):
  pendiente. 0 huecos → cierre limpio; N huecos → N constancias (art. 5) antes
  de cerrar.

H3 se declara **CERRADO** solo cuando existan las dos últimas evidencias, en el
Acta de Cierre Formal del Bloque 2.
