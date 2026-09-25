# INFORME FINAL — Incidente SEV-1 ERR_REQUIRE_ESM (21-22 jul 2026)

**Estado al emitir este informe:** Producción restaurada ✅ · Incidente mitigado ✅ · Postmortem entregado ✅ · **Cierre oficial pendiente de monitoreo 24 h y verificación de crons (23-jul)** 🔄

Expediente completo: `SEV1_2026-07-21_evidencia_7_frentes.md` · `SEV1_2026-07-21_informe_consolidado.md` (+adenda de runtime) · `SEV1_2026-07-21_auditoria_final_pr133.md` · **ADR-0025** (decisión y política resultante).

## 1. Resumen ejecutivo

La migración a `firebase-admin` 14 (PR #130, 21-jul 12:00) introdujo una dependencia transitiva solo-ESM (`jose@6`) que el runtime de Vercel Functions no puede cargar por `require()`. Las 58 rutas API del plano servidor quedaron en 500 durante **~14,3 horas** (12:02 → 09:21 del 22-jul), incluyendo radicación ciudadana, consulta pública y crons legales. Todos los gates (build, tsc, tests, audit, preview) salieron verdes: el fallo era exclusivamente de runtime y ningún entorno de validación emulaba la lambda real. **La integridad de datos quedó intacta** (verificado contra producción) y la pérdida ciudadana esperada es ≈ 0. Se recuperó con fix-forward (`overrides jose@^5`, PR #133) validado por batería A/B en servidores reales, panel adversarial de 6 revisores sin objeciones y CI completo; el gate de regresión que viaja en el mismo PR emula el runtime exacto de Vercel y hace irrepetible la reincidencia silenciosa.

## 2. Línea de tiempo

Ver tabla completa en ADR-0025 §Línea de tiempo. Hitos: exposición desde 21-jul **12:02** · detección **~17:40** (MTTD ≈ 5h38m) · war room 7 frentes 17:45-23:30 · refutación de hipótesis con evidencia directa 00:30-03:00 · fix construido y validado 08:15-08:40 · panel adversarial 6/6 · merge autorizado 09:14 · **servicio restaurado 09:21** · limpieza diagnóstica 09:35.

## 3. Causa raíz demostrada

Cadena: `firebase-admin@14.2.0 → jwks-rsa@4.1.0 → jose@6.2.3 (solo-ESM)`. `jwks-rsa/src/utils.js:1` hace `require('jose')`; el runtime de Vercel (Node v24.18.0 real, confirmado in-process post-fix) ejecuta con `require(esm)` desactivado; Next entrega el require crudo (firebase-admin en `serverExternalPackages` por defecto); `lib/firebase-admin.ts` (línea 2, import top-level) es importado por 58/73 rutas → muerte del módulo antes de cualquier handler. Reproducido carácter por carácter con `--no-experimental-require-module` en servidor de producción local (batería A/B).

## 4. Evidencias (por origen)

- **Producción:** stack trace de logs de Vercel; matriz de rutas 500/200 pre-fix y post-fix; `/api/health` con `nodeVersion v24.18.0`; barridas de integridad read-only (21-jul 22:50 y 22-jul 09:23): 0 parciales, 0 huecos nuevos, contadores en línea base.
- **Local (condición del incidente):** A/B con `--no-experimental-require-module` — árbol main revienta idéntico a producción; árbol fix sirve 200/307/405 lógicos; E2E criptográfico jwks-rsa+jose5 con RSA/EC/Ed25519 3/3; 160 requests sin errores de módulo; `npm ci` desde cero limpio.
- **Registro/npm:** lockfiles pre/post #130; exports de jose 4/5/6 (6.2.4 incluido, sin CJS); engines de jwks-rsa vs firebase-admin; advisories (0 para jose 5.10.0; GHSA-f88m-g3jw-g9cj cerrado por sharp 0.35).
- **CI/GitHub:** timeline forense de PRs/deployments con timestamps; PR de Dependabot fallando por tipos mientras el manual pasó; 4/4 checks del PR #133.

## 5. Decisión tomada y justificación

**Fix-forward, no rollback** (decisión del propietario sobre recomendación única del Arquitecto tras panel adversarial): el fix estaba validado de punta a punta bajo la condición exacta del fallo, conservaba firebase-admin 14 + Fase 1 + fast-uri, dejaba el audit gate verde y añadía el gate preventivo. El rollback quedó armado como contingencia de ~5 s (`vercel alias set` a `fu0zz4hbl` — mecanismo corregido por el panel: Instant Rollback en plan Hobby solo retrocede un deployment) y no fue necesario.

## 6. Cambios introducidos

- `package.json`: `overrides jose@^5` (mitigación; ver plan de retiro) y `sharp@^0.35` (advisory sobrevenido). Lockfile acotado a esos subárboles.
- `__tests__/regresion-esm-require-firebase-admin.test.ts`: gate permanente.
- Documentación: expediente `docs/incidentes/` + ADR-0025.
- Limpieza: rama diagnóstica y 3 previews con endpoint temporal **eliminados** (404 verificado); rama del fix borrada tras merge.
- Producción: deployment del merge `4e683c1` sirviendo desde 09:21.

## 7. Riesgos residuales

R1 jose v5 EOL (MEDIA — mitigada: jose no se ejecuta en caminos usados; 0 advisories; retiro programado D1) · R2 firma contra certs reales de Google (BAJA — pendiente login real del propietario como cierre) · R3 override global (BAJA — D2) · R4 barrido ESM sin gate automático (BAJA — D3) · R5 dependencia de flag no documentado de Vercel (BAJA — asimetría favorable: si lo retiran, nada se rompe) · R6 backup Firestore inoperante (**preexistente, URGENTE — G6**) · R7 primer hit lento en `/` post cold start (informativo, Next 16).

## 8. Acciones preventivas

G1 gate ESM ✅ activo · G2 pin de Node + flag en CI · G3/G4 smoke post-deploy + bypass de protección · G5 política de majors con engines = triaje nivel 3 (vigente desde ADR-0025) · G6 backups (urgente) · G7 Sentry forense + sondas marcadas · D1 retiro del override (disparadores: advisory→inmediato; árbol upstream compatible o require(esm) en Vercel→planificado; revisión trimestral desde 2026-10-31) · D2 scope anidado · D3 gate ESM ampliado · D5 rotación de service account (criterio del propietario).

## 9. Lecciones aprendidas

1. Validación documental ≠ validación de runtime (Principio 13): los majors del plano servidor se prueban EJECUTANDO en entorno equivalente a producción.
2. El CI verde mide lo que ya medías: el gate nuevo emula el runtime real (flag exacto) — esa es la clase de gate que faltaba.
3. npm no vigila engines de transitivas; la inconsistencia upstream pasó sin ruido.
4. La mecánica de rollback se verifica ANTES de necesitarla (Instant Rollback ≠ lo que se asumía).
5. Sondas de diagnóstico siempre marcadas; Sentry como memoria forense (los logs de Vercel expiran en minutos).
6. La exigencia de evidencia sobre hipótesis (propietario) evitó dos remediaciones err) equivocadas: "subir Node" (inútil: ya era 24) y "quitar NODE_OPTIONS" (no existía).

## 10. Estado final del sistema

- **Producción:** restaurada y verificada (matriz completa, logs limpios, datos íntegros, `nodeVersion v24.18.0`). Madurez del pipeline REFORZADA respecto al 20-jul (gate ESM nuevo + política G5).
- **Pendientes para el cierre oficial:** monitoreo 24 h (logs sin ERR_REQUIRE_ESM, sin incremento 5xx, sin degradación), verificación de los 3 crons el 23-jul (desistimiento-tácito 01:00, alertas-vencimiento 08:00 Colombia; auditoría-consecutivos lunes 27), login real del propietario (cierra R2), revisión manual de términos del 21-jul.
- **Fase 2 de la pieza angular:** CONGELADA en worktree aislado sin contaminación; se descongela únicamente con la declaración de cierre oficial del propietario.
