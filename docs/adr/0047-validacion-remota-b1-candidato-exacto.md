# ADR-0047 — Validación remota temporal del candidato B1 exacto

- **Estado:** Aceptada temporalmente para B1
- **Fecha:** 2026-09-24
- **Decisor:** propietario del release

## Contexto

El candidato de release `54256f54cf1ad0cd1b3c61e59fc3c1424889e3f9` ya superó
los gates locales y tiene un preview Vercel asociado. La validación final exige
Linux, Java 21, Chromium y credenciales de STAGE. El pipeline ordinario no
ejecuta Playwright ni permite probar de forma explícita el SHA candidato.

Dar secretos de STAGE a un runner de CI es una integración de Nivel 3: puede
crear datos sintéticos y debe mantenerse fuera de forks, producción y del
flujo ordinario de despliegue.

## Decisión

Se crea una rama temporal de validación con un workflow que se activa solo al
agregar la etiqueta `run-b1-stage-e2e` a su PR. El job:

1. acepta solo PRs cuyo head pertenece a este repositorio;
2. requiere aprobación del GitHub Environment protegido `stage-e2e`;
3. hace checkout literal del SHA B1 y aborta si no coincide;
4. confirma por GitHub Deployments API que el preview esperado pertenece a ese
   SHA;
5. rechaza secretos cuyo proyecto Firebase no sea
   `ventanilla-simacota-stage`;
6. ejecuta build, emulador Firestore, E2E 01/06 y smoke de lectura sobre el
   preview;
7. publica únicamente reportes y logs sin secretos como artefactos.

Los E2E pueden crear datos en STAGE, pero su fixture los marca `isTest`. No se
autoriza producción, `pull_request_target`, forks, merges ni promociones.

## Consecuencias

- La evidencia autoritativa de B1 es el log del workflow con el SHA literal,
  no el SHA sintético de merge de un PR.
- El Environment `stage-e2e` debe contener `LAB_PASSWORD`,
  `FIREBASE_SERVICE_ACCOUNT` y las seis variables públicas Firebase de
  STAGE; requiere revisor antes de liberar secretos.
- Una vez cerrado B1 se cierran los PRs sin merge y se eliminan la rama y este
  workflow temporal.
