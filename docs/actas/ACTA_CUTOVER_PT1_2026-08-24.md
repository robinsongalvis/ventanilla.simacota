# Acta de cierre — PT-1: cutover de la radicación al servidor

**Fecha:** 24-ago-2026 · **Marco:** PLAN_GO_LIVE, paquete PT-1 (Fase 2)
**Autorización:** propietario, 23-ago-2026, por chat («dale, arranca el cutover»)

## Qué se ejecutó, en orden

1. **PR-A [#215]** — `USA_RADICACION_INTERNA_SERVER: false → true`. La
   radicación interna pasó del navegador a `POST /api/radicacion/interna`
   (Admin SDK, transacción, guard D9). Test guardián actualizado para fijar
   el estado ON con la autorización citada.
2. **UAT en stage por el propietario** — radicado `1-110-202608-00000344`
   por Radicación Rápida con la cuenta de laboratorio. Verificación interna:
   contador 343→344 (avance exacto de 1), trazabilidad con **id
   determinístico de servidor** (`ev_…_RADICACION`, la firma que la ruta
   legada no puede producir), actor capturado de la sesión por el servidor.
3. **PR-B [#217]** — reglas: `counters` write→false (**CR-1 cerrado**),
   `ventanilla_radicados` create→false (**CR-2 cerrado**),
   `ventanilla_salidas` create→false. Matriz del emulador: 4 casos volteados
   a «denegado» + 3 nuevos — la regresión queda vigilada en CI.
4. **Deploy de reglas** — ensayado en stage (24-ago), ejecutado en
   producción por el propietario (`✔ Deploy complete!`, proyecto
   `ventanilla-unica-f31b1`).

## Efecto

- La foliación AGN 060 del municipio solo puede avanzar en el servidor,
  detrás del guard de monotonicidad. Ninguna sesión de navegador — incluidas
  las cuentas UAT aún no retiradas (PT-3) — puede alterarla ni forjar
  registros oficiales.
- La ventana de rollback de 1 línea quedó CERRADA a propósito: revertir el
  cutover exige ahora también redesplegar reglas.

## Qué queda del paquete (no cerrado por este acta)

- **PR-C**: migrar los 5 flujos de cliente que escriben `trazabilidad`
  (patrón D8) y cerrar su regla — hasta entonces, la trazabilidad de
  radicados sigue abierta a cliente (riesgo conocido, AMARILLO en la
  auditoría).
- Retiro de usuarios UAT y endurecimiento de Storage (PT-3).

## Incidencias durante la ejecución

- 2 corridas de CI consumidas por la flake de doble instanciación del stub
  (endurecida en #216 por la tarea paralela del propietario).
- 3 casos de la matriz afirmaban las puertas viejas y no salieron en el
  barrido inicial (se buscó «radicar» donde decía «crea») — volteados en el
  segundo commit del PR-B.
- El PR #214 (limpieza de datos de prueba) quedó BEHIND y se reportó
  erróneamente como mergeado durante unas horas; corregido con verificación
  explícita de estado. La ejecución de la limpieza en producción no se vio
  afectada — solo su documentación llegó tarde a main.
- Detectado en paralelo: la zona DNS `simacota.gov.co` caída globalmente
  (SERVFAIL en resolvers públicos; `simacota-santander.gov.co` sano). No
  relacionado con el cutover; la aplicación sirve por el dominio de Vercel.
  Escalamiento a cargo del propietario con el administrador del dominio.
