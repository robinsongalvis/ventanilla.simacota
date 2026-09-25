# ADR-0008 — Cierre del aislamiento por tenant en la escritura de trazabilidad (R8)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (propietario autorizó el mini-ciclo)
- **Roles consultados:** seguridad + firestore-datos; hallazgo original de P-B (rules-unit-testing)

## Contexto

Hallazgo R8 (`docs/REGISTRO_RIESGOS.md`), detectado por la matriz de aislamiento
(ADR-0007): en `firestore.rules`, `canWriteTrazabilidad()` (usada en el `allow create`
de `ventanilla_radicados/{radicadoId}/trazabilidad`, líneas ~57-60 y ~165) valida solo
el **rol** (`ADMIN`/`FUNCIONARIO`/`RECEPCIONISTA`), **no** que el radicado padre
pertenezca al tenant del usuario — a diferencia del `allow read` de la misma subcolección
(líneas ~160-163), que sí hace el `get()` del documento padre y compara con `userTenant()`.
Un funcionario de otro municipio podría, a nivel de regla, crear trazabilidad cruzada.
Mitigado hoy (todas las escrituras van por Admin SDK server-side, que ignora las reglas),
pero es un gap de defensa en profundidad. El propietario autorizó corregirlo en mini-ciclo.

## Decisión

Endurecer la escritura de trazabilidad para que valide el aislamiento por tenant,
reflejando el mismo patrón que el `allow read`: la creación solo se permite si el
`oficinaDestino` (o el campo de tenant equivalente) del radicado padre coincide con
`userTenant()`. El control de regresión es la propia matriz: el caso que hoy documenta
el comportamiento como `'permitido'` (con marca ⚠) se **voltea a `'denegado'`** y debe
pasar en CI contra el emulador tras el fix.

## Alternativas evaluadas

1. **Backlog / aceptar el riesgo.** Descartada por el propietario: aunque no es explotable
   desde la UI actual, un cambio futuro que abra una ruta cliente-side lo volvería explotable.
2. **Fix en código server-side.** Innecesario: las escrituras server-side (Admin SDK) ya
   controlan el tenant en la lógica; la brecha es de la *regla*, que es la barrera de
   defensa en profundidad. Se corrige donde está el gap: la regla.

## Consecuencias

- **Positivas:** el invariante de aislamiento por tenant queda completo también en la
  escritura de trazabilidad, protegido por la matriz en CI (control de regresión).
- **Deuda:** ninguna nueva. La ejecución local del emulador sigue siendo best-effort (CI
  es la compuerta), como en ADR-0007.

## Control de regresión (obligatorio)

El caso `[trazabilidad] FUNCIONARIO de OTRO tenant … crear trazabilidad cross-tenant` de
`e2e/rules/matriz-aislamiento-tenant.test.mjs` pasa de `esperado: 'permitido'` a
`'denegado'`; falla en CI si la regla vuelve a permitir la escritura cruzada.
