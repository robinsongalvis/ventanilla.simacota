# Roadmap a v1.0 — priorización Impacto × Esfuerzo

> **LÍNEA BASE ACTUALIZADA — 2026-07-21 (cierre de jornada)**
>
> - **Madurez actual: 8.0/10** (desde 7.0 al inicio de la auditoría).
> - **Completado desde la auditoría:** P1 íntegra (deps+Dependabot, crons
>   escalables+maxDuration, useSalidas acotado, gate anti-falso-verde, gate de
>   índices al informe, branch protection verificada) · P2.4 backups (código+
>   runbook; activación GCP pendiente del propietario) · P2.6 WhatsApp
>   (pertenencia verificada) · **P0 sobrevenido** (radicación pública y salidas
>   rotas por guard de identidad — descubierto por la Fase 0 y corregido, PR
>   #121) · higiene de dependencias (seguras al día; **firebase-admin 14
>   MIGRADO Y CERRADO**, PR #130) · Fase 0 de la pieza angular (golden de
>   paridad en main).
> - **Riesgos críticos abiertos:** CR-1 (counters/create cliente-escribibles) y
>   CR-2 (ruta interna client-side) — ambos los cierra la **pieza angular
>   (P2.1, Fases 1-4)**, con blueprint v2 revisado por pares, cronograma con
>   criterios objetivos aprobado y Fase 0 completada. CR-3 (backups) cerrado en
>   código; falta la **activación GCP del propietario** para respaldo real.
> - **Prioridades restantes (orden):** 1) Pieza angular Fases 1→4 (→ ~8.4-8.7,
>   v1.0); 2) activación de backups + restauración de prueba (propietario);
>   3) P2.3 FormRespuesta y P2.5 huérfanos de Storage; 4) P3 consolidación
>   (tests sin falso verde, Excel/copiloto, God component); 5) migraciones
>   mayores restantes (TS 7, ESLint 10, @types/node 26) en sesión dedicada.
> - **Externos del propietario:** firma de las 13 constancias (cierra Bloque 2),
>   SMTP institucional, activación GCP de backups.

- **Base:** auditoría integral 2026-07-20 (`docs/AUDITORIA_INTEGRAL_2026-07-20.md`), `origin/main` `d1414bd`.
- **Objetivo:** máximo incremento de madurez con el menor esfuerzo; llegar a v1.0 lista para producción.
- **Estado actual: 7.0 / 10 (70 %).**
- **Escalas:** Seguridad/Estabilidad/Mantenibilidad = ↑↑↑ alto · ↑↑ medio · ↑ bajo · – nulo. Esfuerzo en días de ingeniero (asistido por agentes).

---

## PRIORIDAD 1 — Alto impacto / Bajo esfuerzo (inmediato)

| Mejora | Riesgo que elimina | Componente | Seg | Estab | Mant | Esfuerzo | Dependencias | Migración/Downtime |
|---|---|---|---|---|---|---|---|---|
| **P1.1** `npm audit fix` | CR-5: pipeline rojo + vuln. alta viva | `package-lock.json` | ↑↑↑ | ↑↑ | – | 0.25 d | Ninguna | No |
| **P1.2** Dependabot (security + version, agrupado) | CR-5 recurrente: 3 advisories/semana parcheadas a mano | `.github/dependabot.yml` | ↑↑↑ | ↑↑ | ↑↑ | 0.5 d | P1.1 primero | No |
| **P1.3** Branch protection en `main` (3 checks required + admins) | CR-4: la compuerta no bloquea; merge en rojo llega a prod | GitHub (config) | ↑↑↑ | ↑↑↑ | ↑ | 0.25 d (propietario) | El pipeline debe estar verde (P1.1) | No |
| **P1.4** `maxDuration` en los 4 crons + acotar consultas por rango | CR/M: alertas de plazo legal truncadas en silencio a escala | `app/api/cron/*` + índice `fechaVencimiento` | ↑ | ↑↑↑ | ↑ | 1.5 d | Índice nuevo (deploy) | Sí: deploy de 1 índice (background, sin downtime) |
| **P1.5** Acotar `useSalidas` (ventana + `limit`) + ampliar gate a `onSnapshot` | Falso verde: stream sin cota invisible al gate R11 | `lib/hooks/useSalidas.ts`, `verificar-indices`/nuevo | ↑ | ↑↑ | ↑↑ | 0.75 d | Ninguna | No |
| **P1.6** Cablear `OUTCOME_INDICES` al informe de gobernanza | Semáforo humano no refleja el gate de índices | `ci.yml`, `informe-despliegue.mjs` | – | ↑ | ↑↑ | 0.5 d | Ninguna | No |

**Subtotal P1 ≈ 3.75 días.** Sin migraciones de datos, sin downtime. **Madurez tras P1: 7.8/10.**

---

## PRIORIDAD 2 — Alto impacto / Esfuerzo medio (madurez de producción)

| Mejora | Riesgo que elimina | Componente | Seg | Estab | Mant | Esfuerzo | Dependencias | Migración/Downtime |
|---|---|---|---|---|---|---|---|---|
| **P2.1** Pieza angular: ruta interna de radicación → endpoint server (Admin SDK) + **constructor puro compartido** | CR-2: lógica crítica en cliente; trazabilidad fuera de tx; sin magic-bytes | `lib/actions/radicarVentanilla.ts` → `app/api/radicacion/interna`; `lib/radicacion/constructor` | ↑↑↑ | ↑↑↑ | ↑↑↑ | 4–6 d | Base de todo P2 | Cutover con kill-switch de 1 línea; sin downtime |
| **P2.2** Cerrar reglas: `counters write:if false` + `ventanilla_radicados create:if false` | **CR-1**: reset del consecutivo legal / forja de radicados desde cliente | `firestore.rules` | ↑↑↑ | ↑↑ | ↑ | 0.5 d | **Estricta: después de P2.1** (si no, rompe la interna) | Sí: deploy de reglas (secuencia dura post-cutover) |
| **P2.3** Verificar y resolver `FormRespuesta` (escribe a colección legacy que las reglas niegan) | Función de respuesta rota / dato en modelo huérfano | `FormRespuesta.tsx`, `ModalRadicado.tsx` | ↑ | ↑↑ | ↑↑ | 0.5–1 d | Aclarar si es feature viva o muerta | Posible migración de datos si hay radicados legacy vivos |
| **P2.4** Backups automatizados (Cloud Scheduler → export Firestore) + **1 restauración de prueba a stage** | **CR-3**: pérdida irreversible de registros legales | Infra GCP + runbook | ↑↑ | ↑↑↑ | ↑ | 1.5–2 d | Proyecto stage disponible | No (el export es online) |
| **P2.5** Conciliación de huérfanos de Storage (N8): cron de barrido `_pendientes/` + TTL + flag `archivoEnFinalizacion` | Acumulación de PII sin ciclo de vida (roza Ley 1581) | `app/api/cron/*`, capa de descarga, `storage.rules` | ↑↑ | ↑↑ | ↑ | 1.5 d | Idealmente tras P2.1 | No |
| **P2.6** Verificación de pertenencia radicado↔tenant y teléfono↔solicitante en WhatsApp | M-3: fuga/suplantación por funcionario interno | `app/api/simi/notificaciones/whatsapp/route.ts` | ↑↑ | ↑ | ↑ | 0.5 d | Ninguna | No |
| **P2.7** Deploy automatizado de reglas/índices (job con aprobación manual) + `.firebaserc` | CR/C2: drift entre repo y producción | `ci.yml`, `.firebaserc` | ↑↑ | ↑↑ | ↑↑ | 1 d | Branch protection (P1.3) | No |

**Subtotal P2 ≈ 10–13 días.** **Cierra los 5 riesgos críticos.** **Madurez tras P2: 8.7/10 → v1.0 lista para producción.**

---

## PRIORIDAD 3 — Consolidación (rendimiento, escala, observabilidad, pruebas)

| Mejora | Riesgo que reduce | Componente | Seg | Estab | Mant | Esfuerzo | Dependencias | Migración/Downtime |
|---|---|---|---|---|---|---|---|---|
| **P3.1** Excel MIPG: paginación por cursor + rango de fechas; trazabilidad en lotes | OOM/throttling a 100k radicados (N+1) | `app/api/reportes/mipg/excel/route.ts` | – | ↑↑ | ↑ | 2 d | Ninguna | No |
| **P3.2** Copiloto IA: contadores agregados en vez de doble full-scan; migrar a Admin SDK | O(N) por invocación; SDK cliente en servidor | `app/api/ai/copilot/route.ts` | ↑ | ↑↑ | ↑ | 2 d | Ninguna | Migración: crear docs-contador |
| **P3.3** Red de seguridad de pruebas: test H3 contra código real; reglas de Storage en emulador; test del gate R11; concurrencia+fallo | Falso verde en tests críticos | `e2e/rules/*`, `firebase.json`, `presupuesto-rendimiento.mjs` | ↑↑ | ↑↑ | ↑↑ | 2–3 d | P2.1 (para invocar la ruta real) | No |
| **P3.4** Medición de cobertura (`@vitest/coverage-v8`) + Playwright E2E en CI | Cobertura no medible; regresión E2E no continua | `vitest.config`, `ci.yml` | ↑ | ↑↑ | ↑↑ | 1.5 d | Ninguna | No |
| **P3.5** Descomponer God component `dashboard/page.tsx` (5160 L → contenedores) | Mantenibilidad #1; frena toda evolución del panel | `app/interno/dashboard/*` | – | ↑ | ↑↑↑ | 4–6 d (incremental) | Ninguna | No |
| **P3.6** Unificar modelo dual del radicado + renombrar `clasificacionIA` (OAT-01) | Doble shape; nombre engañoso | `src/types/*`, consumidores | – | ↑ | ↑↑↑ | 3–4 d | P2.3 aclarado | Migración de lectura dual |
| **P3.7** Borrar código muerto + regenerar `firestore-schema.ts` | Trampa de mantenibilidad (id obsoleto reusable) | `lib/radicacion.ts`, `radicado-institucional.ts`, `src/types` | – | ↑ | ↑↑ | 0.5 d | Confirmar sin callers | No |

**Subtotal P3 ≈ 15–19 días.** **Madurez tras P3: 9.3/10.**

---

## PRIORIDAD 4 — Excelencia técnica (institucional)

| Mejora | Valor | Componente | Seg | Estab | Mant | Esfuerzo | Dependencias | Migración/Downtime |
|---|---|---|---|---|---|---|---|---|
| **P4.1** Contador de consecutivos aislado por tenant (`{tenantId}-{serie}-{año}`) | Precondición del multi-municipio | `consecutivo-legal.ts`, `counters`, reglas | ↑↑ | ↑ | ↑↑ | 2 d | P2.1/P2.2 | Migración de contadores (cuando entre 2.º municipio) |
| **P4.2** Validación de esquema (zod) transversal en rutas | Consistencia de entrada en 73 rutas | `app/api/*` | ↑↑ | ↑↑ | ↑↑ | 2–3 d | Ninguna | No |
| **P4.3** Hardening adicional: magic-bytes por central directory; verificación fail-closed de env en build; fijar región Vercel | Superficies residuales | varios | ↑↑ | ↑ | ↑ | 1–2 d | Ninguna | No |
| **P4.4** Automatizaciones preventivas: alerta si un cron no reporta en su ventana; monitoreo de uptime; reintento de correos fallidos; informe MIPG mensual automático | Detección proactiva; menos trabajo humano | crons + observabilidad | ↑ | ↑↑ | ↑↑ | 2–3 d | P1.4 | No |
| **P4.5** Runbook único de operación (`docs/OPERACION.md`) + completar DR runbook | Un ingeniero nuevo opera sin perderse | `docs/` | – | ↑↑ | ↑↑↑ | 1 d | P2.4 | No |
| **P4.6** DX: `engines` pin (Node), pre-commit hooks, plantillas de PR/issue | Menos drift, onboarding | tooling | – | ↑ | ↑↑ | 1 d | Ninguna | No |

**Subtotal P4 ≈ 9–13 días.** **Madurez tras P4: 9.6/10 (excelencia institucional).**

---

## Trayectoria de madurez

| Hito | Madurez | Qué se logra |
|---|---|---|
| **Estado actual** | **7.0 / 10** | Núcleo sólido; última milla e integridad abiertas |
| **Tras Prioridad 1** (~4 días) | **7.8 / 10** | Pipeline verde y obligatorio, dependencias automatizadas, crons que escalan. La gobernanza pasa de asesora a **vinculante** |
| **Tras Prioridad 2** (~2–3 semanas) | **8.7 / 10** | **v1.0 lista para producción**: 5 riesgos críticos cerrados; integridad del registro legal blindada extremo a extremo; recuperación demostrada |
| **Tras Prioridad 3** (~1 mes) | **9.3 / 10** | Escala a 100k+ radicados; pruebas sin falso verde; UI mantenible |
| **Tras Prioridad 4** (~2 semanas) | **9.6 / 10** | Excelencia institucional: multi-municipio habilitado, hardening completo, operación autónoma y documentada |

**Ruta de máximo incremento por esfuerzo:** P1 sube 0.8 puntos en ~4 días (la mejor relación del roadmap). P2 es el salto grande de valor (integridad + recuperación) que define el "listo para producción". P3/P4 son consolidación hacia excelencia y pueden solaparse con nuevas capacidades (C2 comunicaciones).

**Pendientes externos del propietario (fuera del código, condicionan el 1.0):** firma de las 13 constancias AGN (cierra el Bloque 2) y configuración del buzón SMTP institucional.
