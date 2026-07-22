# Auditoría final adversarial — PR #133 (fix SEV-1: override jose@^5)

Panel de 6 refutadores con mandato de refutar (Datos, Seguridad, Dependencias, QA, DevOps, Backend): **6/6 NO OBJETAN**. Veredicto del Arquitecto Principal: **MERGE AUTORIZABLE — aprobado con condiciones**. Documento fuente de los veredictos: transcripciones del panel (22-jul); resumen y arbitraje del Arquitecto íntegro a continuación (secciones 1-4 + veredicto + deudas D1-D5).

## Hallazgos determinantes del panel

- **jose nunca se ejecuta en nuestras rutas** (verifyIdToken/verifySessionCookie van por X.509 + jsonwebtoken; jwks-rsa→jose solo en App Check/teléfono, no usados) — el riesgo 5-vs-6 queda reducido a la carga del módulo [Datos].
- El único breaking change real (importJWK: KeyObject↔CryptoKey) está absorbido por el switch de compatibilidad de jwks-rsa; **E2E criptográfico real 3/3** (RSA/EC/Ed25519, JWKS por HTTP, firmas verificadas con node:crypto, bajo el flag) [Backend].
- Árbol/lockfile impecables (un solo jose; npm ci desde cero exit 0; overrides materializados en el build real de Vercel: added 1/removed 1; binarios sharp linux-x64 presentes) [Dependencias].
- 160 requests + 3 cold starts bajo el flag sin un solo error de módulo; RSS estable [QA].
- Sin downgrade criptográfico; sharp 0.35.3 cierra GHSA-f88m-g3jw-g9cj por completo; diff limpio de 3 archivos [Seguridad].
- **Plan de rollback corregido** [DevOps]: NO usar Instant Rollback (en Hobby solo vuelve al deployment inmediatamente anterior = hz2usxew9, también roto). Mecanismo correcto: `npx vercel alias set https://ventanilla-simacota-fu0zz4hbl-robinsongalvis-projects.vercel.app ventanilla-simacota.vercel.app` (~5 s, no apaga auto-promoción; fu0zz4hbl verificado vivo). Regla de congelamiento: tras un rollback, NINGÚN push a main (un revert re-desplegaría un build roto y pisaría el alias).

## Riesgos residuales (con dueño)

R1 jose v5 EOL (MEDIA — mitigada: no se ejecuta; 0 advisories; disparador de retiro D1) · R2 firma contra certs reales de Google no ejercitable localmente (BAJA — prueba de producción: login real) · R3 override global (BAJA — D2 scope anidado) · R4 barrido ESM sin gate automático (BAJA — D3) · R5 dependencia de flag no documentado de Vercel (BAJA — asimetría favorable: si lo retiran, nada se rompe) · R6 backup Firestore inoperante (preexistente, G6 urgente) · R7 primer hit lento en / (informativo, Next 16, no relacionado).

## Condiciones del veredicto (no negociables)

1. **Sonda T−1 pre-merge (30 s, propietario):** abrir `https://ventanilla-simacota-5mepj95yd-robinsongalvis-projects.vercel.app/api/diagnostico/runtime` (probe jose OK) o `https://ventanilla-simacota-g02dc5ses-robinsongalvis-projects.vercel.app/api/health` (200). Un 500 = NO mergear.
2. Checklist post-merge en ejecución con el comando de rollback armado en terminal ANTES del merge y regla de congelamiento entendida.
3. Deudas D1-D5 registradas en el ADR del incidente en el mismo ciclo.

## Checklist post-merge (resumen operativo)

T+0→2 min: `/api/health` 500→**200** (señal go/no-go) · matriz 7 rutas · logs sin ERR_REQUIRE_ESM. T+2→10: **login real de funcionario sin 5xx** (cierra R2) · Sentry limpio (+capturar contexts.runtime.version para el acta) · latencia de `/` registrar sin reaccionar. T+0 y T+60: `verificar-integridad-sev1.mjs --desde <hora deploy>`. Mañana 23-jul: crons legales sanos; revisión manual de términos del 21-jul.

## Deudas para el ADR

D1 retiro override jose (inmediato si advisory; planificado con fix upstream o require(esm) en Vercel; revisión trimestral, primera 2026-10-31) · D2 scope anidado del override (antes del próximo bump de firebase-admin) · D3 gate ESM ampliado + `npm explain jose` en cada bump · D4 borrar rama/preview diagnóstico tras el acta · D5 arrastradas SEV-1: backup (G6 urgente), pin Node+flag en CI (G2), smoke con bypass (G3/G4), política majors-engines nivel 3 (G5), Sentry forense (G7), rotación FIREBASE_SERVICE_ACCOUNT (propietario).
