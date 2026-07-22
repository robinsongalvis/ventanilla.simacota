# SEV-1 2026-07-21 — Evidencia cruda de los 7 frentes del war room

Producción (ventanilla-simacota.vercel.app, main=1957817) con todo el plano servidor en 500 por ERR_REQUIRE_ESM al cargar firebase-admin/auth. Detectado por el propietario ~17:40 Colombia. Reglas del war room: nadie mergea, nadie toca producción, rollback solo con autorización del propietario.

---

## FRENTE 1 — SEGURIDAD (veredicto: DESCARTADO como causa)

- Reglas firestore/storage: diff vacío entre pre-#130 (d9a93e0) y prod (1957817); últimos cambios 11-jul y 09-jul; CI no contiene ningún `firebase deploy` (sin vector de deploy accidental).
- Env vars: conjunto de referencias `process.env.*` idéntico entre ambos commits (diff exit 0). Un env faltante daría error español en request-time, jamás ERR_REQUIRE_ESM.
- Credenciales: descartadas — `lib/firebase-admin.ts` importa `firebase-admin/auth` en línea 2 top-level; `FIREBASE_SERVICE_ACCOUNT` solo se lee en `parseServiceAccount()` en request-time; el módulo muere ANTES. 58 rutas API importan getFirebaseAdmin* → explica el 500 uniforme.
- Lockfile prod: pre-#130 = firebase-admin 13.10.0 → jwks-rsa 3.2.2 → jose 4.15.9 (dual CJS/ESM); post = 14.2.0 → 4.1.0 → 6.2.3 (ESM-only).
- Acceso malicioso: sin evidencia; actividad de GitHub normal; coincidencia temporal exacta con merge #130 → causa interna.
- Superficie con servidor caído: TODO falla cerrado (storage read:false, catch-all deny); riesgo CR-1 (escrituras cliente permitidas hasta Fase 4) NO cambia durante el incidente.
- **HALLAZGO COLATERAL CRÍTICO:** `.github/workflows/backup-firestore.yml` (añadido d3e9541, 20-jul) JAMÁS ha corrido un backup: GitHub lo rechaza con runs failure de 0 jobs en cada push (14 fallos el 21-jul); no hay punto de restauración automatizado pese a que docs/disaster-recovery.md lo da por operativo.
- Colateral operativo: crons legales (alertas-vencimiento, desistimiento-tacito, auditoria-consecutivos) caídos con el servidor → revisión manual de términos del día tras restaurar.

## FRENTE 2 — DATOS (veredicto: INTEGRIDAD INTACTA, verificado contra producción)

- Escrituras parciales IMPOSIBLES por construcción: error en evaluación de módulo → handler nunca se define; la tx del consecutivo jamás se abre; staging jamás corre. Las 60+ rutas servidor importan admin estáticamente; único import dinámico (`lib/simi-juridico/baseTemplates.ts:348`) es inalcanzable (su caller también importa estático).
- Barrida read-only contra producción (22:50-22:52 -05, script nuevo `scripts/laboratorio/verificar-integridad-sev1.mjs`, sin commitear): 0 docs creados en la ventana en ventanilla_radicados/salidas/planillas; 0 duplicados; huecos idénticos a línea base histórica (radicados [1-8], salidas [1-5] — los 13 con constancias AGN); contadores intactos (últimas escrituras 04/10/15-jul) — nadie consumió un número.
- Flujo cliente de la funcionaria siguió funcional (SDK cliente puro, contador con guard anti-carrera); nadie radicó por esa vía en la ventana. Radicado interno sin analisisIa es shape normal, no anomalía.
- Ciudadano: ve el formulario (página 200) pero el POST devuelve 500 → error visible al enviar; sin rastro parcial en Firestore. Volumen histórico ~0,12 radicados/día (último radicado real: 10-jul) → pérdida esperada ≈ 0. Conteo exacto de intentos solo saldría de logs Vercel (mayoría expirados).
- TRANSPARENCIA: el agente ejecutó por accidente `scripts/laboratorio/instalar-service-account.mjs` (no parsea --help): instaló FIREBASE_SERVICE_ACCOUNT en el .env.local de su worktree desde ~/Downloads (borrando el JSON de Downloads, por diseño del script). Solo lectura sobre Firestore. El propietario decide si rota la credencial.

## FRENTE 3 — OBSERVABILIDAD (timeline forense, hora Colombia = UTC-5)

| Evento | UTC | Colombia |
|---|---|---|
| PR Dependabot fb-admin14 (cba68e0) FALLA CI (type errors e2e) | 15:32 | 10:32 |
| Último main sano d9a93e0 (merge #123) | 16:14 | 11:14 |
| Deployment sano fu0zz4hbl (d9a93e0) ready | 16:15:29 | 11:15 |
| CI PR #130 verde | 16:51-16:54 | 11:51 |
| Merge #130 → 05b053a | 17:00:26 | 12:00 |
| **4gekqem9z (05b053a) ready = INICIO EXPOSICIÓN** | **17:02:21** | **12:02** |
| Merge #132 → a78be16; hz2usxew9 ready | 21:33 / 21:35 | 16:33/16:35 |
| Merge #131 → 1957817; lpiks67jh ready (ACTUAL) | 22:04 / 22:06 | 17:04/17:06 |
| Propietario reporta | ~22:40 | ~17:40 |
| Primer error RETENIDO en logs (límite retención ~30min-1h) | 22-jul 03:34:31 | 21-jul 22:34 |

- Ventana de exposición: ~11 h (desde 12:02 Colombia, EN JORNADA — no ~5h).
- Logs de 4gekqem9z y anteriores EXPIRADOS → el primer 500 real no es observable; la correlación con 05b053a es inferencia con evidencia fuerte de lockfile.
- Conteo en la ventana retenida (~18 min): 9× GET /interno/dashboard 500, 2× POST /api/radicacion 500, 2× GET /api/public/radicado/consulta 500. **DISCREPANCIA A RECONCILIAR:** el frente lo reporta como "tráfico ciudadano afectado", pero el coordinador observa que esa ventana coincide exactamente con las sondas curl del propio war room (coordinador: 1 POST + 1 consulta; QA: 1 POST + 1 consulta = exactamente 2+2), y los 9 GET dashboard = refrescos del propietario + curls del coordinador. Datos: pérdida esperada ≈ 0.
- CI de main verde toda la ventana (runs listados). Todos los gates pasaron: el hueco es estructural, no de ejecución.
- Los runs failure de backup-firestore.yml son pre-existentes al incidente (no gate roto de este deploy).

## FRENTE 4 — DEPENDENCIAS (cadena causal cerrada + fixes simulados)

- Cadena declarativa exacta: root ^14.2.0 → firebase-admin@14.2.0 declara jwks-rsa ^4.0.1 → jwks-rsa@4.1.0 declara jose ^6.1.3 → jose@6.2.3. Resolución npm NORMAL, sin anomalía.
- Línea que revienta: `node_modules/jwks-rsa/src/utils.js:1` = `const jose = require('jose')`. jose@6 ESM-only desde 6.0.0 (2025-02-22): exports sin condición require. jose 4/5 eran duales.
- jwks-rsa 4.x lo hace A PROPÓSITO apoyándose en require(esm) nativo: engines `^20.19.0 || ^22.12.0 || >=23.0.0`. firebase-admin@14 declara engines `>=22` — INCONSISTENTE (22.0-22.11 revienta). npm install no falla por engines.
- Reproducción local: Node 24 OK; con `--no-experimental-require-module` → error IDÉNTICO al de producción.
- Fechas: árbol tóxico posible desde 08-jun-2026 (firebase-admin 14.0.0); entró a main 21-jul 12:00 con #130. jose 6.2.4 salió HOY 21:26 UTC (posterior al merge).
- Upstream NO va a arreglar: issue auth0/node-jwks-rsa#493 cerrado sin build dual ("usa Node con require(esm)"); 14.2.0 es latest de firebase-admin; 4.1.0 es latest de jwks-rsa.
- FIXES SIMULADOS (worktree, con salida real): (a) `overrides:{"jose":"^5"}` → FUNCIONA sin require(esm); jose@5.10.0 anidado bajo jwks-rsa con entrada CJS; lockfile ±9 líneas; APIs usadas por jwks-rsa existen en jose 5. (b) downgrade firebase-admin ^13 → FUNCIONA; diff 116+/458−; revierte migración #130. (c) bump 14.x más nuevo → NO EXISTE. (d) subir Node del runtime Vercel a uno con require(esm) → funciona por diseño (demostrado en Node 24); cero código; es el fix que upstream espera.

## FRENTE 5 — BACKEND (imports + compatibilidad Next/Vercel)

- Trazado eager exacto: firebase-admin/auth → auth.js → base-auth.js → token-verifier.js → utils/jwt.js (`require("jwks-rsa")`) → JwksClient → utils.js (`require('jose')`). 58/73 route.ts importan lib/firebase-admin.ts.
- /interno/dashboard es 'use client' + force-dynamic: NO importa admin; cae porque sus fetch() a /api/* devuelven 500. Páginas estáticas: cero referencias a admin → 200.
- Next: `firebase-admin` está en serverExternalPackages POR DEFECTO (node_modules/next/dist/lib/server-external-packages.jsonc:44) → excluido del bundling, require() crudo llega al runtime. next.config.ts no configura nada al respecto. Con bundling de webpack el interop se habría resuelto en build.
- CONTRA el revert a 13: `npm audit` del árbol 13.10.0 = 8 advisories MODERATE (uuid vía @google-cloud/firestore→google-gax) que 14.2.0 NO tiene. Árbol 14 actual: 2 HIGH pero de sharp/next preexistentes no relacionados.
- jwks-rsa usa de jose SOLO `importJWK` y `exportSPKI` (grep exhaustivo de src/*.js — 2 llamadas; el frente de dependencias mencionó 4 APIs incluyendo decodeJwt/decodeProtectedHeader — RECONCILIAR: en cualquier caso todas existen en jose 5 como function, verificado).
- Candidato (d2) `transpilePackages:['firebase-admin']`: mecanismo verificado en el código de Next (webpack-config.js:681) pero riesgo medio-alto (bindings nativos grpc no bundlean limpio) y sin prueba en vivo.
- Frase clave para lecciones: ninguna herramienta nuestra (tsc, next build, vitest, npm audit) ejecuta require() bajo el runtime real de Vercel Functions; todas corren en Node local con require(esm) activo.

## FRENTE 6 — DEVOPS (runtime + deployments + preview engañoso)

- **CONTRADICCIÓN CLAVE:** Project Settings muestra Node **24.x AHORA** (23:00 -05 aprox), pero el stack trace de producción solo lo emite un Node SIN require(esm). La versión de Node se congela en build por deployment. Hipótesis: (a) el setting era menor cuando se construyeron los 4 deployments de hoy y alguien lo subió a 24.x durante el incidente → un REDEPLOY de main probablemente resuelve sin tocar código; (b) el setting ya era 24.x pero la imagen lambda ejecuta un Node menor (p.ej. AWS nodejs22.x=22.11). DISCRIMINADOR: dashboard → deployment lpiks67jh → pestaña Functions (runtime exacto) — solo el propietario puede verlo. Intento de leer nodeVersion por API REST: denegado por permisos.
- Build de 4gekqem9z sin `npm warn EBADENGINE` → el Node del contenedor de BUILD sí cumplía engines; build y runtime no son el mismo Node.
- Timeline de deployments (verificado por API): fu0zz4hbl=d9a93e0 11:14 (fb-admin 13, SANO); 4gekqem9z=05b053a 12:00; hz2usxew9=a78be16 16:33; lpiks67jh=1957817 17:04 (ACTUAL; alias confirmado).
- Preview verde = 3 capas de falso verde: (1) "Ready" = build exitoso, nada más; (2) CI corre Node 22 reciente de GH Actions CON require(esm) — el único entorno sin la feature es la lambda de Vercel; (3) Deployment Protection (302→SSO) hace IMPOSIBLE ejercitar /api/* del preview desde fuera sin bypass.
- Retención de logs Vercel: ~1h Hobby / 1d Pro; logs de runtime >~30min expirados. Sentry tendría el firstSeen exacto (no consultado — recomendado).
- FICHA ROLLBACK verificada: dpl_4Mt7pP2pDv7DF6nr8AKaZfK9ZVVq (fu0zz4hbl), commit d9a93e0 (ancestro directo de 05b053a, verificado merge-base), lockfile SIN la cadena tóxica. Advertencia: retiraría Fase 1 (#131) y parche fast-uri (#132).

## FRENTE 7 — QA (reproducción 3 niveles + gate validado)

- Matriz producción confirmada (22-jul 03:51Z): /, /consulta, /radicacion, /directorio → 200; /interno/dashboard, /api/public/radicado/consulta, POST /api/radicacion → 500.
- Local Node 24.18.0: build OK, next start OK, rutas normales (el 500 del POST local es por Content-Type, error distinto y esperado) → NO reproduce.
- Determinista: `node --no-experimental-require-module -e "require('firebase-admin/auth')"` → error idéntico. jose 6.2.3 sin condición require + jwks-rsa/src/utils.js:1.
- **Servidor real bajo Node 20.18.0** (binario vía npx node@20.18.0): `next start` REVIENTA AL ARRANCAR (antes de cualquier request); las 7 rutas dan 500 con el error exacto de producción.
- **PRECISIÓN al boundary:** require(esm) también fue retroportado a Node 20 recientes: 20.20.2 NO reproduce; 20.18.0 SÍ. El límite depende del PATCH exacto del runtime, no solo del major.
- **GATE DE REGRESIÓN implementado y validado:** `__tests__/regresion-esm-require-firebase-admin.test.ts` (worktree QA, sin commitear): fuerza --no-experimental-require-module sobre los 4 subpaths usados en producción. Con fb-admin 14: FALLA exactamente en auth (1/4). Con 13: PASA 4/4. Sin red/secretos, ~1-5s. Límite declarado: lista de subpaths manual; no escanea todo node_modules (gate general posible, mayor costo, evaluarlo con devops).
- Suite completa: 1144/1146 (las 2: su test nuevo que DEBE fallar hasta el fix + eventos-negocio flaky conocido que pasa aislado 11/11).
- Blast radius local vs prod: en local el crash es de boot (tumba todo); en prod las estáticas sobreviven pre-renderizadas. Para smoke-test futuro: vigilar stderr del boot basta.

---

## DISCREPANCIAS A RECONCILIAR (obligatorio por regla del propietario)

1. "Tráfico ciudadano afectado" (Observabilidad: 2 POST + 2 consultas en 500) vs "son las sondas del propio war room" (coordinador; conteo coincide exactamente) vs "pérdida esperada ≈0" (Datos).
2. APIs de jose usadas por jwks-rsa: 2 (Backend, grep exhaustivo) vs 4 (Dependencias).
3. Boundary de require(esm): "22.12+/20.19+" (Dependencias/Backend) vs "depende del patch exacto; 20.18.0 rompe, 20.20.2 no" (QA).
4. Ventana de caída: ~5h (percepción inicial) vs ~11h desde 12:02 Colombia (Observabilidad).
5. Runtime real de Vercel: hipótesis (a) setting cambiado hoy vs (b) imagen lambda con Node menor — pendiente del discriminador del propietario (pestaña Functions).

## ARTEFACTOS DISPONIBLES (sin commitear, en worktrees de agentes)

- Gate de regresión: worktree agent-a8979834d90470f5b, `__tests__/regresion-esm-require-firebase-admin.test.ts`.
- Script de integridad: `scripts/laboratorio/verificar-integridad-sev1.mjs` (worktree peaceful-wiles).
- Simulaciones de fix (a)/(b) documentadas con salidas en el informe de Dependencias (worktrees restaurados a limpio).
