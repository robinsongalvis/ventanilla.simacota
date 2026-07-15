# ADR-0007 — Pruebas unitarias de reglas Firestore (aislamiento por tenant)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (validó la Ola 1)
- **Roles consultados:** arquitecto-principal (plan), seguridad + firestore-datos (diseño de matriz)

## Contexto

El aislamiento por `tenantId` es un invariante de producto (ningún municipio ve datos de
otro), hoy **sin prueba automática**: `firestore.rules` se valida por sintaxis/dry-run pero
no por comportamiento. `@firebase/rules-unit-testing` **no está** en `package.json`. El
emulador **sí funciona en CI** (job `laboratorio-emulador`, Java 21, `emulators:exec`);
local es best-effort (Java 8, sin Docker). Riesgo ALTA latente.

## Decisión

Incorporar `@firebase/rules-unit-testing` (devDependency) y una **matriz de pruebas
tenant × rol × colección** ejecutada contra el emulador en CI, que verifique el invariante de
aislamiento definido en `firestore.rules` (`userTenant()` contra `oficinaDestino` /
`dependenciaOrigen` / `tenantId`).

- **Alcance (Ola 1):** matriz mínima que cubra el invariante para las colecciones núcleo
  (`ventanilla_radicados` y las que dependen de tenant); casos positivos (acceso legítimo del
  tenant dueño) y negativos (rechazo del acceso cruzado). NO exhaustiva.
- **Política de no-regresión de cobertura:** cada colección o regla nueva agrega su fila a la
  matriz (queda escrito en el archivo de tests y en la deuda declarada).
- **Fuera de alcance:** `storage.rules` (candidata post-Ola-1).

## Consecuencias

- **Positivas:** el invariante de aislamiento queda protegido por prueba de comportamiento; el
  CI falla si una regla regresiona el aislamiento (control de regresión del riesgo).
- **Deuda aceptada:** ejecución local best-effort (CI es la compuerta); matriz no exhaustiva
  (mitigada por la política de fila-por-colección); `storage.rules` diferido.

## Control de regresión (obligatorio)

La propia matriz de `rules-unit-testing` es el control: corre en CI (extendiendo el job del
emulador) y falla si el acceso cruzado entre tenants deja de ser rechazado.
