# Deuda técnica planificada — Migraciones de versión mayor

> **ACTUALIZACIÓN 2026-07-21 (tarde):** la migración #1 (`firebase-admin` 13→14)
> fue **EJECUTADA Y CERRADA** por orden del propietario (PR #130, merge `05b053a`):
> 15 archivos de `e2e/`/`scripts/` migrados a la API modular, producción intacta
> (0 archivos de `app/`/`lib/`/`src/`), 6 validaciones verdes y **Preview de
> Vercel en `success` sobre el commit exacto `7e1e4c8`**. Esta deuda queda
> **eliminada del backlog**. Permanecen diferidas las otras 3 (TypeScript 7,
> ESLint 10, @types/node 26) para su sesión dedicada.

- **Estado:** DIFERIDAS deliberadamente. No son bugs ni pendientes urgentes — son
  migraciones que requieren su propio plan, pruebas y revisión.
- **Decisión del propietario (2026-07-21):** no mezclar migraciones de tooling con
  la implementación de la pieza angular. Un único objetivo por ciclo. Se
  programará una **sesión exclusiva** para estas 4, como frente independiente,
  **después** de que la pieza angular esté implementada, estabilizada y validada
  en producción.
- **Ninguna tiene advisory de seguridad** que obligue a subir ahora. Las versiones
  actuales son seguras y funcionan en producción.

## Las 4 migraciones

| # | Paquete | Actual → destino | Por qué es migración, no bump | Tamaño estimado |
|---|---|---|---|---|
| 1 | `firebase-admin` | 13.10 → 14.2 | v14 quitó el namespace de tipos `admin.firestore.Firestore` (y equivalentes). Rompe el type-check. | Acotada: **13 archivos, todos en `e2e/` y `scripts/`** — ningún archivo de producción (`app/`, `lib/`, `src/`) lo usa (ya usan la API modular `getFirestore()`). ~0.5 día |
| 2 | `typescript` | 5.9 → 7.0 | TS 7 es el compilador reescrito (port a Go) — comportamiento y estrictez pueden cambiar; puede aflorar errores de tipo nuevos en todo el repo. | Media-alta: validar build + suite completa; migrar lo que rompa. 1–2 días |
| 3 | `eslint` | 9 → 10 | Cambios de configuración/reglas (flat config, compatibilidad de plugins). | Media: revisar config + plugins. ~1 día |
| 4 | `@types/node` | 20 → 26 | Alinear tipos con el runtime; puede endurecer chequeos y aflorar errores de tipo. | Baja-media: suele ir con la de TypeScript. ~0.5 día |

## Evidencia (firebase-admin 14, la que ya falló su preview)

```
./e2e/lab-admin.ts:18 — Type error: Namespace 'firebase-admin/lib/index'
  has no exported member 'firestore'.
> let dbInstancia: admin.firestore.Firestore | null = null;
```
El preview del PR de Dependabot (#128) falló el `tsc` del build por esto. **Producción
NO se ve afectada** (main sigue en v13). El gate/preview atrapó el breaking change —
exactamente el comportamiento deseado: un mayor no se mergea a ciegas.

## Plan cuando se aborden (sesión dedicada)

1. Una migración por PR (no agrupar), con su análisis de impacto.
2. `firebase-admin 14` primero (la más acotada y con evidencia clara): migrar los 13
   archivos de tooling al tipo de v14 (`import { Firestore } from 'firebase-admin/firestore'`
   o `FirebaseFirestore.Firestore`), verificar build verde, mergear.
3. `typescript 7` + `@types/node 26` juntas (se afectan): correr build + suite completa,
   migrar errores de tipo nuevos.
4. `eslint 10` por separado.
5. Cada una: revisión cruzada + CI verde + preview verde antes de mergear.

## Configuración vigente de Dependabot

Los grupos de `npm` ahora solo agrupan `minor`/`patch`; los **mayores llegan como PR
individuales** para revisarse uno a uno (evita el "todo o nada" que mezclaba un mayor
que rompe con parches seguros). Ver `.github/dependabot.yml`.

Los PRs de Dependabot de estos 4 majors (#125 typescript, #126 eslint, #127 @types/node,
#128 firebase-admin) se **cierran** para no dejar previews rojos ni ruido; Dependabot los
volverá a proponer, y se abordarán en la sesión dedicada según este plan.
