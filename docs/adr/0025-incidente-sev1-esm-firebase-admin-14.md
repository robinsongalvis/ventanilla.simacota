# ADR-0025 — Incidente SEV-1 ERR_REQUIRE_ESM (firebase-admin 14) y política resultante de dependencias/runtime

- **Estado:** ACEPTADO (2026-07-22) · Incidente **CERRADO** — cierre documentado 2026-08-06 (ver **§Adenda 2026-08-06 — Cierre oficial**). Monitoreo de 24 h superado, estabilidad sostenida >2 semanas, integridad intacta, G6 (backups) resuelta. La **ratificación formal es del propietario** y se materializa al aprobar/mergear este cambio (hasta entonces, "cierre propuesto").
- **Decisores:** Propietario (Robinson David Galvis) + war room de 7 frentes + panel adversarial de 6 revisores
- **Nota de numeración:** ADR-0024 reservado (formato de radicado AAAAMM, rama `feat/formato-radicado-aaaamm`).

## Contexto

El 21-jul-2026 a las 12:02 (Colombia) el merge del PR #130 (migración `firebase-admin` 13→14) dejó **todo el plano servidor de producción en 500** durante ~14,3 horas (restaurado 22-jul 09:21). El build, el type-check, la suite (1142+ tests), `npm audit` y el preview de Vercel salieron **verdes**: el fallo era exclusivamente de runtime.

## Línea de tiempo (Colombia, UTC-5)

| Hora | Evento |
|---|---|
| 21-jul 10:32 | PR de Dependabot con firebase-admin 14 FALLA CI (type errors en e2e) |
| 11:14 | Último main sano `d9a93e0` → deployment `fu0zz4hbl` (fb-admin 13, jose 4) |
| 11:51 | CI del PR #130 (migración manual de tipos) VERDE |
| 12:00 | Merge #130 → `05b053a` |
| **12:02** | **Deployment `4gekqem9z` ready → INICIO DE EXPOSICIÓN** (inferencia con evidencia fuerte: lockfile tóxico + fallo determinista de carga) |
| 16:33 / 17:04 | Merges #132 (fast-uri) y #131 (Fase 1) heredan el lockfile tóxico — 3 deployments rotos |
| ~17:40 | Propietario detecta (`/interno/dashboard` → Internal Server Error). MTTD ≈ 5h38m |
| 17:45–23:30 | War room 7 frentes (RCA, integridad, timeline, dependencias, runtime, reproducción) |
| 22-jul 00:30–03:00 | Refutación de hipótesis con evidencia directa (runtime `nodejs24.x` declarado en sanos y rotos; sin NODE_OPTIONS; loader de Turbopack descartado) |
| 08:15–08:40 | Rama fix: `overrides jose@^5` + `sharp@^0.35` + gate de regresión ESM; validación completa + batería A/B en servidores reales |
| 09:05 | Panel adversarial 6/6 SIN OBJECIONES → veredicto MERGE AUTORIZABLE |
| 09:14 | Propietario autoriza (6 confirmaciones con evidencia) → merge #133 → `4e683c1` |
| **09:21** | **Producción restaurada** — `/api/health` 200, matriz completa verde, logs limpios, integridad de datos verificada |

## Causa raíz (demostrada, no hipótesis)

`firebase-admin@14.2.0` → `jwks-rsa@4.1.0` → `jose@6.2.3`. jose 6 es **solo-ESM** (sin condición `require` en `exports`, desde 6.0.0). `jwks-rsa/src/utils.js:1` hace `require('jose')` estático, apoyándose en el `require(esm)` nativo de Node (engines `^20.19||^22.12||>=23`). El runtime de Vercel Functions —**Node v24.18.0 real**, confirmado post-fix por `/api/health`— ejecuta con `require(esm)` **desactivado a nivel de proceso** (comportamiento demostrado por batería A/B con `--no-experimental-require-module`, que reproduce el error carácter por carácter; reportes públicos apuntan a un flag inyectado en `execArgv` por la plataforma). Next.js excluye `firebase-admin` del bundling por defecto (`serverExternalPackages`) → el `require` llega crudo al runtime. `lib/firebase-admin.ts` importa `firebase-admin/auth` en top-level y es importado por 58/73 rutas → 500 uniforme al cargar el módulo, antes de cualquier handler.

**Por qué ningún gate lo vio (3 capas de falso verde):** (1) "Ready" de Vercel = build exitoso, no runtime; (2) CI y local corren Node con `require(esm)` activo — el único entorno sin la feature era la lambda; (3) Deployment Protection (SSO) hacía imposible ejercitar `/api/*` del preview desde fuera. Además: la validación del #130 fue documental/estática — ninguna herramienta ejecuta `require()` bajo el runtime real.

## Impacto

- 58/73 rutas API en 500 ~14,3 h (radicación ciudadana, consulta pública, panel interno, crons legales). Páginas estáticas y flujo cliente de la funcionaria operativos.
- **Datos: INTEGRIDAD INTACTA** (verificado contra producción: 0 escrituras parciales —imposibles por construcción—, 0 docs en ventana, 0 huecos/duplicados nuevos, contadores en línea base). Pérdida ciudadana esperada ≈ 0 (volumen 0,12 rad/día; sin evidencia de tráfico real afectado; certeza imposible por retención de logs ~30-60 min).
- Crons legales sin ejecutar en la ventana → revisión manual de términos del 21-jul.
- Sin componente de seguridad: todo falló cerrado.

## Decisión técnica

**Fix-forward con `overrides: {"jose": "^5"}`** (jose 5.10.0, dual CJS/ESM) + `overrides: {"sharp": "^0.35.0"}` (advisory GHSA-f88m-g3jw-g9cj sobrevenido) + **gate de regresión** `__tests__/regresion-esm-require-firebase-admin.test.ts` (fuerza `--no-experimental-require-module` — emulación exacta del runtime de Vercel — sobre los 4 subpaths de firebase-admin en uso). PR #133, mergeado `4e683c1`.

**Alternativas evaluadas y descartadas:** rollback a `fu0zz4hbl` (válido como puente; innecesario al validar el fix de punta a punta; perdía Fase 1 + fast-uri); downgrade a firebase-admin 13 (reintroduce 8 advisories MODERATE; revierte migración; 13 rumbo a EOL); esperar upstream (jose 6.2.4 sigue sin CJS; issues cerrados sin fix); `transpilePackages` (bindings nativos, riesgo sin necesidad); `NODE_OPTIONS=--experimental-require-module` (anulado por la plataforma según reportes; no documentado).

**Sustento del panel adversarial (6/6 sin objeciones):** jose no se EJECUTA en ningún camino usado (verificación de tokens va por X.509+jsonwebtoken; jwks-rsa→jose solo en App Check/teléfono, no usados); el único breaking change 5↔6 (`importJWK`: KeyObject/CryptoKey) está absorbido por el switch de compatibilidad de jwks-rsa (verificado línea a línea + E2E criptográfico real 3/3 con RSA/EC/Ed25519); árbol/lockfile impecables (un solo jose; `npm ci` limpio; overrides materializados en el build real de Vercel); 160 requests + 3 cold starts sin errores de módulo; sin otras bombas ESM-only en el grafo de producción; sin downgrade criptográfico (0 advisories jose 5.10.0).

## Medidas preventivas (vinculantes)

| # | Medida | Dueño | Estado/Disparador |
|---|---|---|---|
| G1 | Gate ESM en CI (ya viaja en #133; mantener en suite obligatoria) | QA | ✅ ACTIVO |
| G2 | Pin de runtime: `engines` + `.nvmrc` + `node-version` CI, **incluyendo el flag `--no-experimental-require-module`** en jobs que ejerciten dependencias de servidor | devops | Esta semana |
| G3/G4 | Smoke-test post-deploy de rutas reales + Protection Bypass for Automation (secret del propietario) | devops | Esta semana |
| G5 | **Política de majors:** todo bump mayor de dependencia de producción cuyo `engines` cambie (propio o transitivo) = **triaje nivel 3** con matriz de runtime DEMOSTRADA (no documental) antes de merge | arquitecto | VIGENTE desde este ADR |
| G6 | Reparar workflow de backups Firestore (jamás ha corrido — hallazgo del war room) + regla: ningún doc de DR se declara operativo sin restauración probada | devops | **URGENTE** |
| G7 | Sentry como fuente forense primaria (retención Vercel insuficiente); sondas del war room siempre marcadas (header/UA) | devops | Esta semana |
| D1 | **Retiro del override `jose@^5`** (v5 EOL 2026-04-30): INMEDIATO si aparece advisory contra 5.10.0; PLANIFICADO cuando firebase-admin/jwks-rsa publiquen árbol compatible o Vercel habilite require(esm) (ticket abierto como sensor); **revisión trimestral, primera 2026-10-31**; el gate G1 valida el retiro | dev-backend + seguridad | PROGRAMADO |
| D2 | Scope anidado del override (global → `jwks-rsa>jose`) | dev-backend | Antes del próximo bump de firebase-admin |
| D3 | Gate ESM ampliado (barrido automático del grafo + `npm explain jose` en cada bump) | QA + devops | Evaluar con G1-G7 |
| D4 | Rama diagnóstica y previews con endpoint temporal eliminados | devops | ✅ HECHO 22-jul (404 verificado) |
| D5 | Rotación de `FIREBASE_SERVICE_ACCOUNT` (colateral del war room) | propietario | A su criterio (recomendado) |

## Lecciones

1. **Validación documental ≠ validación de runtime** (Principio 13): un major de la dependencia más crítica del servidor exige ejecutar el código en un entorno equivalente al de producción.
2. "Verde" mide que no rompimos lo que ya medíamos; **conformidad con el entorno real** requiere gates que lo emulen (G1 lo hace con el flag exacto).
3. Los engines de npm no son un gate (npm no falla por engines de transitivas) — la inconsistencia firebase-admin(`>=22`) vs jwks-rsa(`^22.12`) pasó sin ruido.
4. En incidentes: sondas propias marcadas, Sentry como memoria forense, y el mecanismo de rollback REAL verificado antes de necesitarlo (Instant Rollback en Hobby solo retrocede un deployment).
5. El proceso funcionó: la exigencia del propietario de evidencia sobre hipótesis descartó dos causas falsas (runtime viejo, NODE_OPTIONS) antes de actuar.

---

## Adenda 2026-08-06 — Cierre oficial del incidente

El incidente SEV-1 se declara **CERRADO**. La **ratificación formal corresponde al propietario** (IA propone / funcionario decide, Principio 9) y se materializa al aprobar/mergear este cambio; hasta entonces es un **cierre propuesto**.

### Condiciones de cierre verificadas
- **Producción restaurada** el 22-jul 09:21 (`/api/health` 200, matriz verde, integridad de datos verificada) — ver Línea de tiempo.
- **Estabilidad sostenida:** >2 semanas sin recurrencia. El reconocimiento adversarial del 5-6 ago halló el plano servidor operativo. **Ventana de monitoreo de 24 h superada** (única condición de cierre declarada en el estado original).
- **Integridad de datos intacta** (verificada en el war room; sin hallazgos nuevos posteriores).
- **Deuda URGENTE ligada al cierre — G6 (backups) RESUELTA:** primer export real verificado el 6-ago (GitHub Actions run `31088181768`) a `gs://ventanilla-simacota-backups/diario/2026-08-06/`; script de provisión corregido (PR #152). Se cumple así la regla G6 ("ningún doc de DR se declara operativo sin restauración probada" → export durable verificado; ver `docs/disaster-recovery.md`).

### Efecto sobre la Fase 2 del motor de expedientes
Se **levanta el congelamiento de Fase 2 imputable al SEV-1** ("Fase 2 CONGELADA hasta cierre oficial"). **Esto NO abre la Fase 2 por sí solo:** la Fase 2 sigue gobernada por sus otras precondiciones (ADR-0026 §Precondiciones), en particular **P1 (concepto jurídico)**, aún pendiente. El cierre del SEV-1 elimina *este* bloqueo, no los demás.

### Estado de las medidas preventivas al cierre
Las medidas G/D eran **seguimiento con dueños y disparadores propios**, no condición del cierre del incidente (que solo exigía el monitoreo de 24 h). Estado verificado al 6-ago:

| Medida | Estado |
|---|---|
| **G1** gate ESM en CI | ✅ **ACTIVO** (`__tests__/regresion-esm-require-firebase-admin.test.ts`) |
| **G2** pin de runtime | 🟡 **PARCIAL** — CI fija `node-version: 22`; el flag `--no-experimental-require-module` lo ejerce el test G1; faltan `.nvmrc`/`engines` explícitos |
| **G3/G4** smoke-test post-deploy + bypass automation | ⏳ **ABIERTO** |
| **G5** política de majors (triaje N3, matriz de runtime demostrada) | ✅ **VIGENTE** (reforzada por el gate de auditoría gobernado, ADR-0028) |
| **G6** backups Firestore | ✅ **RESUELTO** (#152, export verificado 6-ago) |
| **G7** Sentry forense | ⏳ **ABIERTO** (no configurado; forense aún depende de logs de Vercel) |
| **D1** retiro del override `jose@^5` | 🗓️ **PROGRAMADO** (revisión trimestral, primera 2026-10-31; override `^5` vigente) |
| **D2** scope anidado del override | ⏳ antes del próximo bump de `firebase-admin` |
| **D3** gate ESM ampliado | ⏳ a evaluar |
| **D4** rama diagnóstica/endpoint temporal | ✅ **HECHO** 22-jul |
| **D5** rotación `FIREBASE_SERVICE_ACCOUNT` | ⏳ a criterio del propietario |

Las medidas abiertas (**G2 parcial, G3/G4, G7, D1-D3, D5**) quedan como **backlog de endurecimiento gestionado**, con dueños y disparadores ya definidos en la tabla de medidas preventivas. **No** bloqueaban el cierre del incidente ni bloquean la Fase 2; se rastrean como deuda operativa continua. Recomendación al propietario: priorizar **G7 (Sentry)** y completar **G2** en la próxima ventana de devops.
