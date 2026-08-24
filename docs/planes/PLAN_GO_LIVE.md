# Plan de Go-Live — Ventanilla Única de Simacota

**Fecha:** 23-ago-2026 · **Rol:** arquitecto de release · **Estado:** Fase 1 EN CURSO
**Diagnóstico de base:** `docs/auditorias/AUDITORIA_GO_LIVE_2026-08-23.md`
(0 🔴 · 27 🟠 · 21 🟡 · 9 🟢 sobre `c11e140`)

> **El objetivo cambió.** El contrato está asignado: ya no construimos
> indefinidamente — preparamos un sistema para OPERAR. Todo lo 🟡 y 🟢 del
> diagnóstico queda explícitamente FUERA del camino al go-live: se hace
> después de operar, no antes. La vara de cada decisión es una sola:
> *¿impide operar el día D de forma segura, trazable y defendible?*

## Veredicto de la auditoría

**GO CONDICIONADO.** Cero bloqueantes. El sistema puede operar el día D; los
27 🟠 se agrupan en 7 paquetes de trabajo finitos (abajo) que convierten
«puede operar» en «opera con contrato». Infraestructura: **no se agrega
ningún servicio** — Vercel + Firebase + GitHub Actions + Sentry (gratis) +
un monitor de uptime (gratis) bastan; todo lo pendiente es configuración de
lo que ya existe.

## Los 7 paquetes de cierre (los 27 🟠)

| # | Paquete | Esfuerzo | Depende de |
|---|---|---|---|
| PT-1 | ✅ **EJECUTADO 24-ago** (acta `ACTA_CUTOVER_PT1_2026-08-24.md`): flip + UAT con huella de servidor + CR-1/CR-2 cerrados y reglas desplegadas en stage y producción. Resta el PR-C (trazabilidad server-only, patrón D8) | PR-C: ~1-2 días | — |
| PT-2 | **Canales de alerta vivos**: SMTP · DSN Sentry · uptime contra `/api/health` · contacto de contingencia · el cron de alertas debe fallar RUIDOSO cuando 0 envíos salgan | horas | 4 acciones del propietario + 2 h dev |
| PT-3 | **Superficie de seguridad**: auth en `/api/ai/feedback` · endurecer `storage.rules` · verificar proveedores de Auth (sin auto-registro) · retirar 4 usuarios UAT | ~1 día | verificación en consola (propietario) |
| PT-4 | **Respaldo de adjuntos**: versioning del bucket + export diario de Storage (el export de Firestore NO incluye los archivos) | ~½ día | 1 comando del propietario + workflow |
| PT-5 | **Pipeline de reglas**: deploy versionado de `firestore.rules`/`storage.rules` + detección de deriva repo↔producción | ~½ día | — |
| PT-6 | **Control de release**: smoke-test post-deploy (G3/G4 del SEV-1) · `npm ci` en CI · registrar el E2E de stage (cierra el AMBER de la compuerta) | ~1 día | — |
| PT-7 | **Definición de producto**: doble reloj radicado↔expediente (¿el handoff suspende la PQRSD?) · toggles de IA decorativos · siembra R10 de la serie legal | corto + decisiones | funcionaria/Jurídica · dato de Planeación |

## Las 6 acciones que solo el propietario puede hacer

1. Buzón SMTP institucional (variables ya creadas en Vercel, vacías) — en gestión.
2. DSN de Sentry en Vercel (~15 min; el código #212 espera dormido).
3. Monitor de uptime gratuito contra `/api/health` (~30 min).
4. Contacto real de soporte en `CONTINGENCIA_OPERATIVA.md` (5 min).
5. Verificar en Firebase Auth: sin auto-registro ni anónimo (captura como evidencia).
6. Autorizaciones: cutover (PT-1) y siembra de la serie legal (PT-7, con el
   dato escrito del ingeniero de Planeación).

## Las fases

### Fase 1 — Freeze ✅ EN CURSO (este documento la inaugura)
- `main` congelado para todo lo que no sea PT-1..PT-7 y docs del plan.
- Commit candidato etiquetado: **`v1.0.0-rc1` = `c11e140`** (lo desplegado hoy).
- Backlog de PRs en cero (verificado 23-ago). Cambios accidentales: ninguno
  (`main` sin movimiento desde el 18-ago).

### Fase 2 — Production Readiness (~2 semanas)
- Ejecutar PT-1 a PT-6 + las 6 acciones del propietario.
- Política de privacidad y aviso de tratamiento (Jurídica, corre en paralelo).
- Limpieza de datos de prueba en producción (procedimiento propio, con acta —
  ver §Limpieza).
- **Compuerta de salida:** checklist verificado contra código y consolas
  (nunca contra documentos), con evidencia por punto.

### Fase 3 — Smoke test en stage (2 días)
El flujo completo como usuario real, de punta a punta: radicar → consecutivo
→ constancia por correo REAL → handoff a expediente → documentos →
trazabilidad → roles/permisos (una cuenta por rol) → un error forzado que
llega a Sentry → alerta de vencimiento que llega al buzón.
**Compuerta:** acta de smoke con evidencia; el E2E queda registrado.

### Fase 4 — Go-Live (1 día)
- Tag final `v1.0.0` sobre el commit que pasó la Fase 3; deploy.
- Smoke en producción: un radicado de prueba marcado (`isTest`) y archivado
  con acta; verificación de crons y monitor.
- **Compuerta:** 24 h de estabilidad con Sentry y uptime en silencio.

### Fase 5 — Operación
- **Diario:** Sentry (0 eventos nuevos = bien) · uptime · la incidencia
  automática de respaldos (si aparece, se atiende ese día).
- **Semanal:** tendencia del tamaño del export · vencimientos próximos ·
  triaje de lo 🟡 del diagnóstico.
- **Mensual:** ensayo de restauración · revisión de accesos y roles ·
  retrospectiva breve (Principio 11).
- **Incidentes:** runbooks existentes (`CONTINGENCIA_OPERATIVA`,
  `RUNBOOK_RESTAURACION`, `RUNBOOK_INCIDENTES_SMTP`).
- **Rollback:** redeploy del tag anterior en Vercel (1 clic) — los datos no
  se revierten jamás sin acta y orden expresa.
- **Cambios:** todo por PR con checks (ya vigente); los merges a `main`
  despliegan — hasta cerrar PT-6, mergear ES desplegar y se hace con esa
  conciencia.

## §Limpieza de datos de prueba (resumen; procedimiento detallado aparte)
Los datos de prueba en producción son de DOS clases y se tratan distinto:
1. **Fuera de la serie legal** (`1-WEB-*` del botón de prueba, marcados
   `isTest`): se pueden BORRAR — no dejan hueco en el consecutivo AGN.
2. **Dentro de la serie legal** (`1-110-*` radicados de ensayo de la UAT):
   NO se borran — se ANULAN con acta (estado/marca de anulación y constancia),
   porque borrar deja un hueco inexplicable en la foliación oficial.
   El número se pierde, el registro queda.
Ambas requieren: inventario en dry-run primero, acta de lo actuado después,
y autorización explícita del propietario para cada paso que toque producción.
