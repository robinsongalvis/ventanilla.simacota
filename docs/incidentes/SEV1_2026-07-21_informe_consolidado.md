# INFORME CONSOLIDADO SEV-1 — 2026-07-21 — ERR_REQUIRE_ESM en producción

**Arquitecto Principal · War Room · main = 1957817 · Estado al cierre del informe: producción caída (plano servidor)**

Convención: **[HECHO]** = observado directamente · **[INFERENCIA]** = deducción con evidencia · **[SUPUESTO]** = declarado sin verificación posible. Origen: (local) / (CI) / (producción) / (repo). Evidencia cruda completa de los 7 frentes: `SEV1_2026-07-21_evidencia_7_frentes.md`.

## Resumen Ejecutivo

- **Qué pasó:** el merge del PR #130 (migración a firebase-admin 14, 12:00 Colombia) introdujo la cadena firebase-admin@14.2.0 → jwks-rsa@4.1.0 → jose@6.2.3 (ESM-only). El runtime de Vercel Functions ejecuta el `require('jose')` crudo (Next excluye firebase-admin del bundling por defecto) en un Node sin `require(esm)` → las 58 rutas API que importan el módulo admin devuelven 500.
- **Exposición:** ~11 horas y contando, desde las 12:02 Colombia (deployment 4gekqem9z ready), en plena jornada. Detección ~17:40 (MTTD ≈ 5h38m).
- **Impacto en datos:** integridad verificada intacta contra producción; pérdida esperada de radicados ≈ 0. Crons legales caídos toda la ventana. Colateral crítico: el backup automatizado de Firestore jamás ha corrido.
- **Recomendación única (escalonada):** paso 0 informativo — propietario lee el runtime exacto (pestaña Functions); paso 1 — **rollback autorizado a fu0zz4hbl** (~99% de éxito bajo ambas hipótesis de runtime, minutos); paso 2 — re-aterrizar #130/#131/#132 con `overrides: {"jose": "^5"}` + gate de regresión de QA en el mismo PR; paso 3 — blindaje estructural (G1-G7).
- **Por qué nadie lo vio:** falso verde en tres capas — ninguna herramienta del pipeline ejecuta `require()` bajo el runtime real de la lambda.

## 1. Timeline (UTC / Colombia)

| # | Evento | UTC | Colombia | Etiqueta |
|---|---|---|---|---|
| 1 | PR Dependabot fb-admin14 (cba68e0) falla CI (types e2e) | 15:32 | 10:32 | [HECHO] (CI) |
| 2 | Último main sano d9a93e0 (merge #123) | 16:14 | 11:14 | [HECHO] (repo) |
| 3 | Deployment sano fu0zz4hbl ready (fb-admin 13.10.0) | 16:15:29 | 11:15 | [HECHO] (producción) |
| 4 | CI del PR #130 verde | 16:51–16:54 | 11:51 | [HECHO] (CI) |
| 5 | Merge #130 → 05b053a | 17:00:26 | 12:00 | [HECHO] (repo) |
| 6 | **4gekqem9z ready = INICIO DE EXPOSICIÓN** | **17:02:21** | **12:02** | [HECHO]; fallo desde el primer request [INFERENCIA] |
| 7 | Merge #132 → a78be16; hz2usxew9 ready | 21:33/21:35 | 16:33/16:35 | [HECHO] |
| 8 | Merge #131 → 1957817; lpiks67jh ready (ACTUAL) | 22:04/22:06 | 17:04/17:06 | [HECHO] |
| 9 | Propietario detecta y reporta | ~22:40 | ~17:40 | [HECHO] |
| 10 | Primer error RETENIDO en logs (retención ~30min–1h) | 22-jul 03:34:31 | 22:34 | [HECHO] (producción) |

Primer error real: no observable (logs expirados). Inicio 12:02 = [INFERENCIA] con evidencia fuerte (lockfile tóxico en 05b053a + determinismo del fallo). Sentry tendría el firstSeen (G7). Los merges #131/#132 se construyeron sobre el lockfile tóxico: los tres deployments de la tarde rotos por igual [HECHO].

## 2. RCA — cadena causal demostrada

```
58 de 73 route.ts ──import estático──▶ lib/firebase-admin.ts        [HECHO repo: git grep en 1957817]
   ▼ línea 2 top-level (se evalúa al cargar, ANTES de leer env)
import { getAuth } from 'firebase-admin/auth'                        [HECHO repo]
   ▼ firebase-admin@14.2.0 (lockfile)                                [HECHO repo]
auth.js → base-auth.js → token-verifier.js → utils/jwt.js: require("jwks-rsa")   [HECHO local]
   ▼ jwks-rsa@4.1.0 (declara jose ^6.1.3)                            [HECHO]
node_modules/jwks-rsa/src/utils.js:1 → const jose = require('jose')  [HECHO local]
   ▼ jose@6.2.3 — ESM-only desde 6.0.0 (2025-02-22): exports SIN condición require
ERR_REQUIRE_ESM en cualquier Node sin require(esm)                   [HECHO local]
```

- El `require` crudo llega al runtime porque `firebase-admin` está en `serverExternalPackages` POR DEFECTO de Next (server-external-packages.jsonc:44); `next.config.ts` no lo modifica [HECHO local].
- El error es de CARGA, no de request: el import de línea 2 mata el módulo antes de existir el handler; credenciales/env descartadas (solo se leen en request-time) [HECHO repo, Frente 1].
- Legal para npm, letal en runtime: jwks-rsa 4.x exige engines `^20.19.0 || ^22.12.0 || >=23.0.0` (require(esm) nativo); firebase-admin@14 declara `>=22` — inconsistente (22.0–22.11 revienta); npm no falla por engines de transitivas [HECHO local]. Upstream cerró auth0/node-jwks-rsa#493 sin build dual [HECHO].
- Confirmación determinista: `node --no-experimental-require-module -e "require('firebase-admin/auth')"` → error idéntico al stack de producción [HECHO local, Frentes 4 y 7].
- Cabo abierto (no afecta el RCA): por qué la lambda corre Node sin require(esm) si Settings muestra 24.x — ver D5.

## 3. Reproducción

| Entorno | Resultado |
|---|---|
| Producción (matriz QA 22-jul 03:51Z) | `/`, `/consulta`, `/radicacion`, `/directorio` → 200; `/interno/dashboard`, GET consulta pública, POST radicación → 500 [HECHO] |
| Local Node 24.18.0 | NO reproduce (build/start/rutas OK) [HECHO] |
| Local determinista | flag `--no-experimental-require-module` → error idéntico [HECHO] |
| Local servidor real Node 20.18.0 | `next start` revienta EN EL ARRANQUE; las 7 rutas 500 con el error exacto [HECHO, QA] |
| Preview Vercel | imposible de sondear: Deployment Protection 302→SSO [HECHO] |

Diferencias explicadas: (1) el único entorno del ciclo sin require(esm) es la lambda [INFERENCIA fuerte]; (2) boundary por PATCH, no por major: 20.20.2 no reproduce, 20.18.0 sí [HECHO, QA]; (3) blast radius: local crash de boot tumba todo, en prod sobreviven las estáticas pre-renderizadas [HECHO]; (4) build-Node ≠ runtime-Node en Vercel (build sin EBADENGINE) [HECHO].

## 4. Impacto

- **Afectadas:** 58/73 route.ts (500 uniforme); `/interno/dashboard` (client, cae por sus fetch a /api); radicación ciudadana POST y consulta pública (formulario visible, envío falla) [HECHO].
- **No afectadas:** estáticas (/, /consulta, /radicacion, /directorio); flujo cliente de la funcionaria (SDK cliente; nadie radicó en la ventana) [HECHO].
- **Datos comprometidos: NINGUNO** [HECHO, verificado contra producción]: escrituras parciales imposibles por construcción; barrida read-only 22:50: 0 docs en ventana, 0 duplicados, huecos = línea base histórica (13 con constancias AGN), contadores intactos. Pérdida ciudadana esperada ≈ 0 (volumen 0,12/día, último radicado 10-jul) — esperanza estadística, no certeza (logs de 10,5h expirados) [SUPUESTO declarado].
- **Servicios degradados:** crons legales caídos ~11h (alertas-vencimiento, desistimiento-tacito, auditoria-consecutivos) → revisión manual de términos del 21-jul obligatoria post-restauración. **Colateral crítico:** backup-firestore.yml JAMÁS ha corrido (runs failure 0 jobs en cada push; 14 el 21-jul); no hay punto de restauración automatizado pese a docs/disaster-recovery.md [HECHO, CI].
- **Colateral de proceso:** el agente de Datos ejecutó por accidente el instalador de service account (credencial quedó en .env.local de su worktree; JSON de ~/Downloads borrado por diseño; solo lectura ejercida). Rotación: decisión del propietario; recomendación del arquitecto: rotar por higiene.

## 5. Opciones de recuperación

| Opción | Riesgo | Tiempo | P(éxito) | Reversión |
|---|---|---|---|---|
| **1. Rollback a fu0zz4hbl** (dpl_4Mt7pP2pDv7DF6nr8AKaZfK9ZVVq, commit d9a93e0, lockfile sano verificado) | Bajo — retira Fase 1 y fast-uri (ninguno sirvió tráfico sano); reintroduce 8 advisories MODERATE del árbol 13 por días | Minutos (re-alias, sin build) | **~99%, bajo AMBAS hipótesis de runtime** | Re-alias instantáneo |
| **2. Hotfix `overrides:{"jose":"^5"}`** (simulado y verificado: funciona sin require(esm); ±9 líneas de lockfile; APIs usadas existen en jose 5) | Bajo (no probado en vivo aún) | 30–60 min (PR+CI+deploy) | ~95%, ambas hipótesis | Revert trivial |
| **3. Redeploy bajo Node 24** (solo si hipótesis (a)) | Medio por incertidumbre: nulo si (b) | ~10 min | 60–70% [SUPUESTO] | Rollback |
| **4. Downgrade fb-admin ^13** | RECHAZADA como definitiva: revierte migración autorizada, reintroduce 8 advisories, 13.x quedará sin soporte | — | — | — |

### RECOMENDACIÓN ÚNICA (secuencia escalonada)

> **Paso 0 (propietario, 2 min, informativo, NO bloquea):** dashboard → lpiks67jh → pestaña Functions → anotar runtime exacto (resuelve D5, alimenta G2 y el ADR).
> **Paso 1 — MITIGAR AHORA: rollback a fu0zz4hbl con autorización del propietario.** Única opción ~99% independiente del discriminador; restaura servicio y crons en minutos; reversión instantánea. Verificación: matriz de 7 rutas + crons.
> **Paso 2 — RE-ATERRIZAR: PR con `overrides:{"jose":"^5"}` + gate de regresión de QA commiteado en el MISMO PR** sobre main actual (recupera #130+#131+#132). Condición de merge: gate verde + smoke local bajo `--no-experimental-require-module`. Ejecutan dev-backend + QA, revisión cruzada.
> **Paso 3 — BLINDAR (esta semana):** gates G1–G7 + reparar backup + revisión manual de términos del 21-jul + ADR del incidente. Cuando el runtime con require(esm) quede pineado, el override jose@5 se retira por PR (el gate lo validará) — el override es mitigación, el pin es la corrección definitiva.

Por qué rollback primero y no hotfix directo: la caída lleva ~11h con crons legales incluidos; el hotfix exige 30–60 min de pipeline cuyo verde —quedó demostrado hoy— no garantiza el runtime. El rollback usa un artefacto que ya sirvió producción. "Calidad antes que velocidad" no aplica a mantener producción caída para ahorrar un paso.

## 6. Lecciones aprendidas

**Por qué CI no lo detectó:** ninguna herramienta (tsc, next build, vitest, npm audit) ejecuta `require()` bajo el runtime real de Vercel Functions; CI usa `node-version: 22` flotante (≥22.12, con require(esm)); el repo no tiene NINGÚN pin de Node (sin engines, sin .nvmrc) — no existía contrato de runtime; npm no falla por engines de transitivas; el PR de Dependabot sí falló CI (por types) y la migración manual pasó con "validación documental" — validación documental ≠ validación de runtime (Principio 13 violado en la práctica).

**Por qué Preview salió verde — 3 capas de falso verde:** (1) "Ready" = build exitoso, nada más; (2) CI corre en Node con require(esm); (3) Deployment Protection (302→SSO) hacía imposible ejercitar /api/* del preview desde fuera.

**Gates a añadir:**

| # | Gate | Ejecutor | Prioridad |
|---|---|---|---|
| G1 | Commitear el gate de QA validado (`regresion-esm-require-firebase-admin.test.ts`) y correrlo en CI | QA+devops | Paso 2 (mismo PR) |
| G2 | Pin de runtime: engines + .nvmrc + node-version CI alineados a versión con require(esm) ESTABLE (22.12+/24.x; nunca por major — 20.18.0 vs 20.20.2) + verificación contra setting de Vercel | devops | Paso 3 |
| G3 | Smoke-test de runtime real post-deploy (2-3 rutas /api del preview, exigir no-500; complemento: smoke de boot en CI bajo Node mínimo) | devops+QA | Paso 3 |
| G4 | Protection Bypass for Automation (secret) para que G3 atraviese el SSO | devops (secret: propietario) | Paso 3, antes de G3 |
| G5 | Política de majors con cambio de engines (propio o de transitivas) → triaje nivel 3 con matriz de runtime demostrada; registrar en ADR | arquitecto+devops | Paso 3 |
| G6 | Alerta de workflows programados que fallan con 0 jobs; ningún doc de DR "operativo" sin restauración probada | devops | Paso 3, urgente |
| G7 | Sentry como fuente forense primaria (retención Vercel ~30min-1h); verificar firstSeen de ESTE incidente mientras exista | devops | Paso 3 |

## Reconciliación de discrepancias

- **D1 (tráfico ciudadano):** en la ventana retenida (~18 min), los 2+2 errores coinciden exactamente con las sondas del war room → sin evidencia de afectación ciudadana en esa ventana; sobre las ~10,5h expiradas: pérdida esperada ≈ 0, certeza imposible → verificar en Sentry (G7). Corrección de proceso: sondas propias deben marcarse (header/user-agent) en incidentes futuros.
- **D2 (APIs de jose: 2 vs 4):** prevalece el grep exhaustivo: 2 llamadas. Operativamente irrelevante: las 4 existen en jose 5. Se consigna por trazabilidad.
- **D3 (boundary require(esm)):** engines = contrato declarado; medición de QA = realidad ejecutable. El discriminante operativo es el PATCH exacto. Vinculante para G2: pin solo a versiones con require(esm) estable; prohibido razonar por major.
- **D4 (ventana 5h vs 11h):** ganan los datos: exposición desde 12:02 Colombia [HECHO]; ~5h era sesgo del observador (medía desde la detección). Para el acta: inicio 12:02, MTTD ≈ 5h38m.
- **D5 (runtime real):** irresoluble con la evidencia disponible (discriminador solo visible al propietario; API denegada). Decisión correcta: no apostar — la recomendación funciona bajo ambas hipótesis; el paso 0 es informativo.

## Cabos abiertos (para el acta)

1. Autorización del propietario para el rollback (bloquea paso 1).
2. Lectura de pestaña Functions (paso 0, solo propietario).
3. Rotación de FIREBASE_SERVICE_ACCOUNT (recomendación: rotar).
4. Sentry firstSeen (degradaría la inferencia del timeline a hecho).
5. Revisión manual de términos legales del 21-jul tras restaurar.
6. jose 6.2.4 (salió hoy 21:26 UTC): verificar changelog por condición require — no cambia la recomendación.

Cierre requerido: ADR del incidente (causa raíz, política G5, contrato de runtime G2, retirada futura del override) + retrospectiva con la pregunta: ¿por qué una "validación documental" bastó para autorizar un major de la dependencia más crítica del plano servidor?

**Artefactos sin commitear:** gate de QA (worktree del agente de QA); `verificar-integridad-sev1.mjs`; simulaciones de fix del Frente 4.

---

## ADENDA — Diagnóstico único revisado (runtime verificado, contradicción resuelta)

Evidencia nueva del coordinador vía API de Vercel: las **207 lambdas de los 3 deployments (sano incluido) declaran `nodejs24.x`**; `projectSettings.nodeVersion: 24.x`; **no existe NODE_OPTIONS** ni env que desactive require(esm); `externalImport` de Turbopack = `await import(id)` limpio; sonda de aislamiento: ruta sin firebase-admin → **410 (app ejecuta normal)**, rutas con admin transitivo → 500.

**Resolución de la contradicción (Arquitecto):** Vercel **inyecta `--no-experimental-require-module` en `process.execArgv` de sus Functions** (confirmado por staff de Vercel en el foro oficial, hilo oct-nov 2025, runtime 22.x; anula incluso NODE_OPTIONS del usuario). Node 24 genuino ES compatible con firebase-admin 14; **Vercel Functions no lo es**, con cualquier versión declarada de Node, porque el flag desactiva `require(esm)`. Cada observación del incidente queda explicada sin residuo (el deployment sano corría el mismo runtime+flag: jose 4 dual jamás ejercitó la feature). Único supuesto restante: que el flag siga inyectándose en nodejs24.x en jul-2026 — [INFERENCIA] respaldada por el comportamiento observado, confirmable con un preview diagnóstico (endpoint con `process.version` + `process.execArgv` + probe de `require('jose')`).

**Consecuencias sobre las opciones:**
- Rollback a fu0zz4hbl: **reforzado** (~99% — sirvió tráfico sano bajo este mismo runtime+flag; ya no depende de hipótesis).
- Override `jose@^5`: **única vía definitiva** para conservar firebase-admin 14 en Vercel (jose 5 dual CJS no necesita require(esm) bajo ningún escenario residual).
- Redeploy bajo Node 24 (opción 3): **MUERTA** — producción ya declara nodejs24.x y el flag anula la feature.
- Gate de QA (`--no-experimental-require-module`): resulta ser la **emulación exacta** del runtime real de Vercel; G2 debe incluir el flag en los jobs de CI que ejerciten dependencias de servidor.
- Ticket a Vercel (paralelo, no bloqueante): exigir documentación del flag y roadmap de retiro.
