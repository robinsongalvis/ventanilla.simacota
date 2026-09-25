# ADR-0023 — Blueprint Arquitectónico: especificación formal previa a toda implementación

- **Fecha:** 2026-07-14
- **Estado:** aceptado (2026-07-14, por el propietario)
- **Responsable:** Robinson David Galvis (propietario)
- **Rol:** Arquitecto Principal de Producto y Plataforma Institucional.
- **Relación:** añade una compuerta de proceso sobre ADR-0021/0022; no los sustituye.

## Contexto

Una ficha arquitectónica completa (documento rector) describe *qué es* una
capacidad, pero no basta para autorizar construcción. Falta un **proceso de diseño
formal** que obligue a cuestionar cada decisión —simplificar, consolidar, reutilizar,
evitar construir— y a proyectar la decisión a 5 años **antes** de escribir código.
El objetivo es que la plataforma siga siendo coherente, mantenible, escalable y
sencilla de evolucionar dentro de 5–10 años.

## Decisión

**1. Ninguna capacidad se considera "lista para implementación" solo por tener
ficha.** Debe superar un **Blueprint Arquitectónico**: la especificación completa
previa a cualquier código. Plantilla obligatoria en
`docs/blueprints/_PLANTILLA_BLUEPRINT.md`; un Blueprint por capacidad en
`docs/blueprints/CN-<capacidad>.md`.

**2. Contenido mínimo del Blueprint:**
arquitectura funcional detallada · arquitectura lógica · límites del dominio ·
entidades y agregados · eventos de negocio · reglas de negocio · flujos principales
y alternos · actores · permisos · APIs · integraciones · modelo de datos ·
reutilización de componentes existentes · componentes nuevos (solo si son
estrictamente necesarios) · impacto sobre SIMI · sobre seguridad · sobre auditoría ·
sobre rendimiento · sobre mantenibilidad · riesgos · estrategia de migración · de
pruebas · de despliegue.

**3. Análisis crítico obligatorio (cierre del Blueprint).** Toda especificación
termina respondiendo, con evidencia:
- ¿Qué estamos simplificando?
- ¿Qué estamos eliminando?
- ¿Qué estamos consolidando?
- ¿Qué estamos reutilizando?
- ¿Qué estamos evitando construir?
- ¿Existe una alternativa aún más simple?
- ¿Qué ocurrirá dentro de cinco años si esta decisión permanece?

**4. Bucle de re-revisión automático.** Si alguna respuesta del análisis crítico
demuestra que la solución puede **simplificarse o consolidarse más**, el Blueprint
**vuelve automáticamente a revisión** antes de autorizar desarrollo. No se avanza
con una solución que ya se sabe mejorable.

**5. Definición de "listo para implementación" (Definition of Ready).** Una
capacidad es candidata a desarrollo solo cuando tiene: **(a)** Blueprint completo,
**(b)** superadas las Cuatro Preguntas (ADR-0021), **(c)** Valor Neto favorable
(ADR-0020), y **(d)** análisis crítico superado sin disparar el bucle de
re-revisión. Faltando cualquiera, no es candidata.

## Alternativas evaluadas

1. **Autorizar con la ficha del documento rector.** Descartada: la ficha describe,
   no especifica ni fuerza el cuestionamiento de diseño.
2. **Blueprint sin análisis crítico ni bucle.** Descartada: permite congelar la
   primera solución aunque exista una más simple.
3. **Blueprint + análisis crítico + re-revisión automática** *(elegida)*.

## Consecuencias

- **Positivas:** cada capacidad llega a desarrollo con diseño cerrado, reutilización
  máxima y complejidad justificada; la proyección a 5 años entra en la decisión; se
  evita construir de más.
- **Costo:** el Blueprint es trabajo de diseño previo; se mitiga porque reutiliza la
  ficha del rector y evita retrabajo y deuda caros después.
- **Relación con el congelamiento:** no autoriza implementación; el Bloque 2 sigue
  congelado. El proceso gobierna diseño y planificación.

## Verificación de cumplimiento

Antes de proponer una capacidad a desarrollo se verifica: Blueprint completo (todas
las secciones) + análisis crítico respondido + Cuatro Preguntas superadas + Valor
Neto favorable + bucle de re-revisión no disparado (o resuelto). Sin ello, la
capacidad no es candidata.
