# ADR-0020 — Plataforma de largo plazo: rejilla de sostenibilidad, principio de valor neto y decisiones revisables por evidencia

- **Fecha:** 2026-07-14
- **Estado:** aceptado (2026-07-14, por el propietario)
- **Responsable:** Robinson David Galvis (propietario)
- **Roles consultados:** arquitecto-principal, product-owner, gobierno-digital, seguridad, ia-simi, ux-ui.
- **Relación:** complementa ADR-0017/0018/0019 (Plan Maestro, Arquitecto Funcional y de Transformación). No sustituye ninguno.

## Contexto

El objetivo dejó de ser "un buen sistema de ventanilla" para ser **la plataforma
institucional que la Alcaldía usará durante muchos años** y que sirva de referente
nacional. Encontrar brechas y llenar el backlog ya no basta: cada análisis debe
evaluar la plataforma como un sistema vivo, sostenible y evolutivo, y debe
preferir la simplicidad cuando el valor no justifique la complejidad.

## Decisión

**1. Sexto lente permanente — "F. Sostenibilidad / plataforma de largo plazo".**
Cada funcionalidad, mejora o corrección se evalúa contra esta rejilla (marcar
impacto +/0/− y una nota cuando sea relevante):

| # | Dimensión | Pregunta guía |
|---|---|---|
| 1 | **Escalabilidad** | ¿aguanta más volumen/tenants sin rediseño? |
| 2 | **Simplicidad operativa** | ¿el funcionario hace menos pasos, no más? |
| 3 | **Facilidad de capacitación** | ¿se aprende sin manual extenso? |
| 4 | **Reducción de carga/tiempos** | ¿quita trabajo administrativo repetitivo? |
| 5 | **Automatización SIMI** | (lente E, ADR-0019) ¿qué asiste la IA? |
| 6 | **Experiencia del ciudadano** | ¿mejora medible para quien radica/consulta? |
| 7 | **Cumplimiento normativo** | ¿respeta AGN/Ley 1755/1712/1581/594? |
| 8 | **Seguridad, trazabilidad y auditoría** | ¿aislamiento por tenant, huella auditable? |
| 9 | **Mantenibilidad** | ¿el código queda más claro y testeable? |
| 10 | **Reutilización / no duplicidad** | ¿reusa lo existente en vez de duplicar (Principio 3)? |
| 11 | **Preparación para integraciones** | GOV.CO, Carpeta Ciudadana, firma electrónica, interoperabilidad SGDEA. |
| 12 | **Crecimiento modular** | ¿habilita nuevos módulos **sin** rediseñar la plataforma? |

**2. Lente de consolidación (obligatorio).** Además de proponer lo nuevo, cada
análisis identifica si hay oportunidad de **simplificar la arquitectura existente,
reutilizar componentes, eliminar complejidad innecesaria o unir varias
funcionalidades aisladas en un único flujo más inteligente**. Consolidar cuenta
como entrega de valor, no solo agregar features.

**3. Principio de Valor Neto (permanente).** *Cada nueva capacidad debe aumentar
el valor de la plataforma sin incrementar innecesariamente su complejidad.* Si una
funcionalidad añade más complejidad de la que aporta valor, se **replantea o se
descarta**. Se formaliza como **tercera pregunta de la compuerta** (junto a P1/P2
de ADR-0018):
- **(P3)** ¿El valor neto supera la complejidad añadida (código, operación,
  capacitación, mantenimiento)? Si no, se simplifica, se pospone o se descarta.

**4. Decisiones revisables por evidencia.** Ninguna decisión arquitectónica previa
(ADR incluido) es una restricción inamovible. Si el análisis encuentra **evidencia
objetiva** de una alternativa claramente superior, se **documenta y se propone**
mediante un ADR que *supersede* al anterior (mecanismo de la Regla Suprema). Las
decisiones anteriores se respetan, pero no se vuelven dogma.

**5. Medición antes que opinión (reafirmado).** Una hipótesis se descarta con
evidencia antes que sostener una conclusión equivocada (como ocurrió con el
catálogo de series documentales: se creyó ausente el ciclo vital y la medición
demostró que ya existía).

## Alternativas evaluadas

1. **Seguir evaluando solo por brechas/valor funcional.** Descartada: no protege
   escalabilidad, mantenibilidad ni simplicidad a largo plazo.
2. **Añadir dimensiones pero sin compuerta de complejidad.** Descartada: permite
   que features de bajo valor inflen la plataforma.
3. **Rejilla de sostenibilidad + principio de valor neto + decisiones revisables**
   *(elegida)*.

## Consecuencias

- **Positivas:** cada iniciativa se juzga como parte de una plataforma de años;
  se premia consolidar y simplificar; se frena el crecimiento por acumulación; las
  decisiones evolucionan con evidencia en vez de petrificarse.
- **Costo:** cada análisis agrega la rejilla F y la pregunta P3; se mitiga porque
  la rejilla es una checklist ligera y evita retrabajo caro más adelante.
- **Relación con el congelamiento:** no autoriza implementación; el Bloque 2 sigue
  "implementación completada – pendiente de validación". Gobierna análisis y
  priorización.

## Verificación de cumplimiento

Un ítem del Plan Maestro está bien formado cuando registra: comparativa (0018),
naturaleza, automatización (0019, lente E), **rejilla de sostenibilidad (lente F)**,
**valor neto (P3)** y al menos un criterio de justificación (J1–J5). Sin P3
favorable, no se propone a desarrollo.
