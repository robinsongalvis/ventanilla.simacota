# Retrospectiva técnica — Fases 0 y 1 del Laboratorio Institucional de Calidad

- **Fecha:** 2026-07-10
- **Alcance:** adopción del SOI (ADR-0001), arquitectura y Fases 0–1 del laboratorio
  (ADR-0002), auditoría funcional E2E completa contra stage.
- **Evidencia base:** PR #88 (mergeado), PR #89, radicado sintético
  `1-110-2026-00000001` (ciclo completo en stage), corridas de CI, informe de auditoría.

## Qué salió bien

1. **El triaje de proporcionalidad funcionó en la práctica.** Los fixes triviales
   (timeouts de tests, tildes) fluyeron directo con justificación en el commit; lo
   estructural (laboratorio) pasó por arquitectura y ADR. Ninguna tarea quedó
   bloqueada por proceso.
2. **"Medición antes que opinión" evitó tres errores reales:** la máquina de estados
   del agente legado resultó obsoleta al verificarla contra el código (migrarla habría
   envenenado al equipo); el "debounce" reportado en los tests flaky no existía (el fix
   correcto era otro); los ceros en la bandeja del funcionario parecían diseño de roles
   y eran un índice faltante.
3. **Stage demostró la tesis del laboratorio en su primera sesión:** auditoría E2E de
   16 etapas sin tocar un dato institucional, que además destapó un defecto de
   reproducibilidad (índice single-field que abortaba el deploy completo) invisible en
   producción pero letal para cualquier municipio nuevo.
4. **La automatización de pendientes humanos redujo la intervención del propietario a
   clics de merge:** proyecto stage, APIs, service account y PRs se provisionaron por
   API con las credenciales ya presentes en la máquina.
5. **El sistema falla cerrado:** ante configuración rota (H1) y ante verificación
   incorrecta en consulta pública, nunca hubo fuga de información.

## Qué podemos hacer mejor

1. **Coordinación push/merge:** el PR #88 se mergeó 2 segundos antes del push de Fase 1
   y el commit quedó huérfano. Regla práctica adoptada (sin nueva burocracia): el
   coordinador empuja TODO antes de anunciar un PR como listo, y lo que llegue después
   va en PR nuevo.
2. **Infra nueva declarada "sin probar" debe correr cuanto antes en un entorno
   equivalente:** el job del emulador se declaró honestamente no probado y falló en su
   primer run (firebase-tools exige Java 21, no 17). El proceso funcionó — monitoreo,
   diagnóstico por logs, fix en minutos — pero costó un ciclo de CI que una prueba
   previa en contenedor habría evitado.
3. **La auditoría manual con navegador es frágil por naturaleza** (dobles submits por
   timing, selectores por texto). Es exactamente lo que la Fase 2 automatiza con
   Playwright y esperas reales.

## Deuda técnica aparecida (registrada, no corregida — congelamiento)

| Ítem | Tipo | Destino |
|---|---|---|
| El panel del jefe sugiere "asignar responsable funcional" sin ofrecer control para hacerlo | UX (Media) | Backlog post-congelamiento |
| El selector de asignación en bandeja no precarga el destino de la radicación dirigida | UX (Media) | Backlog post-congelamiento |
| Defaults de tipo distintos entre Radicación Rápida (`PETICION_INFORMACION`) y Registro Exprés (`PETICION_GENERAL`) | Consistencia (Media) | Backlog post-congelamiento |
| `scripts/uat-1.ts` sigue apuntando a producción | Proceso | Migrar a stage o retirar en Fase 2 |
| `docker-compose.lab.yml` sin probar localmente (no hay Docker) | Infra | Validar cuando exista Docker local; CI ya cubre |
| Etapas 9 (adjuntos/Storage) y variantes (anónima, reservada, traslado, prórroga) sin auditar | Cobertura | Escenarios obligatorios de Fase 2 |

## Qué podemos automatizar (insumo directo de Fase 2)

- Los 16 pasos manuales de la auditoría → ≤15 escenarios Playwright.
- El seed de datos coherentes (hoy: 5 usuarios + 1 radicado a mano) → Alcaldía Sintética.
- La verificación de integridad (hoy: lecturas Admin manuales) → script comparador
  documento ↔ trazabilidad ↔ consulta pública.
- Chequeo post-deploy de índices en estado READY (el fallo de hoy se detectó por UI).

## Qué aprendimos / capacidades nuevas descubiertas

1. **El provisioning municipal es automatizable de punta a punta** (proyecto, APIs,
   base, auth, seed) con el token del CLI. Esto es, en germen, el *onboarding de un
   municipio nuevo* — la capacidad más alineada con la visión de plataforma nacional
   que ha aparecido hasta ahora. Registrada como candidata post-congelamiento, con esta
   evidencia como sustento.
2. **La línea de tiempo ciudadana filtra eventos internos por diseño** — patrón de
   privacidad reutilizable para cualquier superficie pública futura.
3. **El modelo de roles es más fino de lo documentado:** jefe de dependencia es
   deliberadamente solo-lectura ("Tu rol no permite realizar acciones sobre
   radicados"). Funciona, pero no está escrito en ninguna parte — `documentacion` debe
   registrarlo para que nadie lo "arregle" por error.

## ¿Alguna regla estorbó sin aportar? (revisión exigida por la Regla Suprema)

- **Ninguna regla bloqueó ni frenó la ejecución.** El congelamiento evitó activamente
  scope creep (tres hallazgos UX tentadores quedaron en backlog en vez de arreglarse
  "ya que estamos").
- **Señal honesta a vigilar:** la matriz de revisión cruzada entre subagentes aún no se
  ha ejercitado con delegación real — por eficiencia de contexto, la sesión
  coordinadora ejecutó las Fases 0–1 directamente. En Fase 2 hay que delegar de verdad
  en los roles (qa, firestore-datos, seguridad) y medir si la revisión cruzada aporta
  hallazgos o resulta ceremonia. Si tras la Fase 2 no hay evidencia de valor, se
  propone su ajuste por ADR — no se mantiene por inercia.

## Patrón reutilizable

**"Entorno como evidencia":** cada pieza del laboratorio se validó usándola de
inmediato contra stage (el seed creando usuarios reales, el índice corregido
redeplegándose, el radicado recorriendo el ciclo). Regla práctica para Fase 2: ningún
componente del laboratorio se declara terminado sin haber producido su primera
evidencia real.
