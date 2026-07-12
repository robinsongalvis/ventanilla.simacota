---
name: reference-stage-y-presupuesto
description: Credenciales de stage presentes localmente + ubicación del control de presupuesto de rendimiento (R11) y su registro
metadata:
  type: reference
---

**Acceso a stage desde local (laboratorio):** `.env.stage` (raíz del repo) contiene
`FIREBASE_SERVICE_ACCOUNT` apuntando al proyecto `ventanilla-simacota-stage` (NO prod
`ventanilla-unica-f31b1`). Los scripts de `scripts/laboratorio/*` (medición de línea base,
demostración de escala) corren directamente contra stage vía Admin SDK, **sin servidor y sin
emulador** — el emulador Firestore local no corre (Java 8, ver entorno). Todos llevan guarda
anti-producción (abortan si el service account es prod) y siembran/limpian con volumen
sintético namespaced (`laboratorio.generador`).

**Control de presupuesto de rendimiento (cierra R11 por regresión, ADR-0011 / 2B):**
`scripts/laboratorio/presupuesto-rendimiento.mjs` — guardarraíl estático que falla si una
lectura de colección sobre `ventanilla_radicados` que debe estar acotada pierde su
`limit()`/cursor, o si aparece una lectura ilimitada nueva sin clasificar. Cableado en
`.github/workflows/ci.yml` (job `validate`, paso "Presupuesto de Rendimiento (R11 Gate)")
y en `npm run presupuesto:rendimiento`. Tiene un REGISTRO inline con el inventario de todas
las lecturas de colección clasificadas (ACOTADA / DEUDA_DECLARADA / PENDIENTE_2A). Cuando 2A
aterrice el cursor en `busqueda-avanzada`, promover esa entrada de PENDIENTE_2A a ACOTADA para
enforzarla. Ver [[project-r11-busqueda-avanzada-pendiente]].

**Evidencia de escala:** `scripts/laboratorio/medir-escala-lectura.mjs` + registro en
`docs/auditorias/rendimiento-escala-2b.md` (patrón sin cota O(N) vs acotado plano).
