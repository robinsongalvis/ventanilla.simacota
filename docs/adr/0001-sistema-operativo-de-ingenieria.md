# ADR-0001 — Adopción del sistema operativo de ingeniería (visión, Regla Suprema y 13 principios)

- **Fecha:** 2026-07-09
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (propietario del proyecto)
- **Roles consultados:** sesión principal de Claude Code (coordinadora), en representación del equipo de subagentes recién constituido

## Contexto

El proyecto Ventanilla Única Inteligente de Simacota superó la etapa de
prototipo: tiene capas operativas en producción (radicación de entrada/salida,
panel operativo, SIMI asistivo, consulta pública), maneja datos personales de
ciudadanos y aspira a ser referente nacional de transformación digital
municipal. El desarrollo venía funcionando por sprints ad-hoc coordinados en
conversación, sin gobernanza escrita. El 2026-07-09 se constituyó un equipo de
12 subagentes especializados bajo el Principio de Responsabilidad Única, lo
que exige reglas explícitas de colaboración para que la especialización no
degenere en descoordinación.

## Alternativas evaluadas

1. **Seguir ad-hoc** — máxima velocidad percibida; riesgo creciente de deuda
   técnica invisible, decisiones sin registro y regresiones al crecer el sistema.
2. **Proceso pesado uniforme** — todo cambio (incluso trivial) pasa por análisis
   arquitectónico completo de 9 dimensiones y revisión cruzada; máxima
   trazabilidad, pero costo desproporcionado: un fix de una línea exigiría el
   mismo circuito que un módulo nuevo.
3. **Principios + triaje de proporcionalidad** *(elegida)* — los principios se
   aplican siempre, pero la profundidad del proceso se gradúa en 3 niveles según
   el impacto del cambio (trivial / feature / estructural).

## Decisión

Se adoptan los 13 principios del proyecto: los 12 formulados por el propietario
(arquitectura antes que implementación; todo cambio justificado; reutilización
por defecto; calidad institucional; revisión cruzada; decisiones registradas;
pensamiento sistémico; calidad antes que velocidad; IA como copiloto; visión de
producto; mejora continua; excelencia profesional) más un decimotercero
incorporado por él al aceptar esta ADR: **medición antes que opinión** — las
decisiones importantes se apoyan en métricas y evidencia siempre que sea
posible; sin métrica disponible, el supuesto se declara explícitamente.

El Principio 1 se instrumenta con un **triaje de proporcionalidad de 3 niveles**
(Trivial / Feature / Estructural), aceptado explícitamente por el propietario,
con criterios de clasificación documentados en `.claude/agents/README.md`.
Texto vinculante en `AGENTS.md`.

Se adoptan además, por directriz del propietario:

- **Visión del proyecto:** plataforma pública moderna, segura, escalable,
  mantenible e inteligente, referente para la transformación digital de los
  municipios colombianos; toda decisión se evalúa también por su capacidad de
  evolucionar durante años y servir a otras entidades territoriales. Se aplica
  con la disciplina de "no cerrar puertas" (sin generalidad especulativa).
- **Regla Suprema (prevalece sobre todo principio):** la realidad del proyecto
  tiene prioridad sobre el proceso. Las reglas que dejan de aportar se cambian
  mediante ADR; el proceso se revisa en cada retrospectiva. Dos salvaguardas:
  (1) invocar la Regla Suprema para saltarse una regla exige constancia escrita
  de una línea, y la excepción repetida obliga a proponer el cambio de regla;
  (2) la Regla Suprema gobierna reglas de proceso — no autoriza a violar
  invariantes de producto, seguridad o ley (aislamiento por tenant, IA
  asistiva, protección de datos, normativa vigente).

## Razones

- Los principios convierten en regla escrita prácticas que ya eran decisiones
  vigentes del proyecto (IA sugiere/funcionario decide, validar con la
  funcionaria, aislamiento por tenant), eliminando la dependencia de la memoria
  conversacional.
- El triaje evita el fallo conocido de los procesos uniformes: cuando todo
  requiere el proceso completo, el proceso se ignora. La proporcionalidad lo
  hace cumplible y por tanto real.
- La revisión cruzada y los ADRs atacan los dos riesgos principales de un
  equipo de agentes especializados: puntos ciegos por especialización y
  pérdida de contexto entre sesiones.

## Consecuencias

- **Positivas:** trazabilidad de decisiones, menor deuda invisible, calidad
  verificable antes de cada entrega, base para auditorías externas (control
  interno, AGN, MinTIC).
- **Negativas / deuda aceptada:** los cambios de nivel 2 y 3 cuestan más tiempo
  y tokens (análisis previo + revisión cruzada). Se acepta a sabiendas
  (Principio 8). Revisar en retrospectiva si el triaje clasifica bien tras ~3
  funcionalidades.
- **Impacto en otros módulos:** `docs/adr/` y `docs/retrospectivas/` pasan a ser
  parte del flujo obligatorio; el agente `documentacion` redacta los ADRs que
  el `arquitecto-principal` origina.
