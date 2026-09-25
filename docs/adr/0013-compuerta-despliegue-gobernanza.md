# ADR-0013 — Compuerta de despliegue como mecanismo de gobernanza técnica (2D)

- **Fecha:** 2026-07-12
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (validó la Ola 2 y aprobó 2D)
- **Roles consultados:** arquitecto-principal + devops (diseño), seguridad (revisión), coordinador

## Contexto

La Ola 1–2 construyó controles automatizados dispersos: pruebas funcionales (suite unitaria +
E2E Playwright), controles normativos ejecutables (H1/R6/R9), aislamiento por tenant
(`rules-unit-testing`, ADR-0007), presupuesto de rendimiento (ADR-0011), observabilidad
(ADR-0005/0011), lint/tsc/npm-audit/build. Hoy corren, pero **no existe una compuerta única ni
un informe consolidado que condicione el despliegue**: `ci.yml` no es precondición dura de `main`
y no emite un veredicto agregado y trazable. El propietario exige que 2D no sea "un pipeline"
sino un **mecanismo de gobernanza**: ningún cambio llega a producción sin evidencia objetiva y
trazable de que la plataforma mantiene sus garantías.

## Decisión

La compuerta de despliegue se compone de dos piezas:

1. **Precondición dura de `main` (branch protection):** el merge a `main` requiere que pasen
   TODOS los checks de CI existentes (job `validate` + `laboratorio-emulador`). Ningún cambio
   entra sin ellos en verde. (Configuración de GitHub; si requiere permisos de admin, se
   documenta como acción del propietario.)

2. **Orquestador + informe de despliegue (la gobernanza):** un paso de CI que **agrega** el
   resultado de cada control en un **informe único con semáforo**, emitido por corrida y
   trazable:
   - **Categorías agregadas:** funcional (suite + estado del E2E de stage), normativo (controles
     ejecutables verdes + conceptos), seguridad (matriz de aislamiento + npm audit), rendimiento
     (presupuesto), observabilidad (señal presente). Cada categoría → verde/amber/rojo con su
     evidencia (enlace al paso de CI / artefacto).
   - **Veredicto global:** *verde* = desplegable; *amber* = desplegable solo con aceptación
     explícita del propietario registrada; *rojo* = bloqueado.
   - **Trazabilidad:** el informe se emite como artefacto de la corrida (y opcionalmente a
     `docs/auditorias/`), con el SHA, la fecha y el detalle por categoría.

- **El E2E de stage** (no corre en CI: necesita stage + credenciales) es un **input requerido**
  del informe: el orquestador registra el resultado de la última corrida E2E (verde + SHA/fecha)
  y marca *amber* si no hay una corrida E2E reciente contra el SHA candidato. El propietario
  decide la aceptación en ese caso.

## Alternativas evaluadas

1. **Solo branch protection.** Insuficiente: da el "pasa/no pasa" pero no el **informe de
   gobernanza** con veredicto agregado y trazable que pidió el propietario.
2. **Solo el informe, sin branch protection.** Insuficiente: sin precondición dura, un cambio
   podría mergearse con CI en rojo.
3. **Mover el E2E a CI.** Diferido: requiere stage + credenciales en CI (riesgo/coste); el E2E
   sigue siendo verificación pre-deploy referenciada por el informe (Ola 3 puede automatizarlo).

## Consecuencias

- **Positivas:** cada despliegue queda respaldado por un veredicto objetivo y trazable; la
  gobernanza técnica deja de depender de la memoria del equipo. Eleva la madurez (el propietario
  lo destacó).
- **Deuda declarada:** el E2E no corre en CI (input registrado, no automático en el pipeline);
  el amber por aceptación de riesgo depende del criterio del propietario (por diseño).

## Control de regresión (obligatorio)

El propio orquestador se prueba por **mutación** (mismo estándar que P-B/2B): forzar un control a
rojo (p. ej. una prueba que falle) debe producir un informe **rojo** y —con branch protection—
bloquear el merge. Se demuestra que la compuerta *bloquea*, no solo que reporta.
