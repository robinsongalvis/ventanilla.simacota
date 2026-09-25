# ADR-0018 — Arquitectura funcional: marco comparativo, naturaleza del requerimiento y compuerta de dos preguntas

- **Fecha:** 2026-07-13
- **Estado:** aceptado (2026-07-13, por el propietario)
- **Responsable:** Robinson David Galvis (propietario)
- **Roles consultados:** arquitecto-principal (como **Arquitecto Funcional**), product-owner, gobierno-digital.

## Contexto

El Backlog Maestro (ADR-0017) inventaría el trabajo futuro, pero el objetivo del
propietario no es **replicar** el software de referencia (GSC de Bucaramanga)
sino construir una **plataforma superior**. Para eso, el análisis de cada
documento/fuente debe ir más allá de generar ítems: debe comparar, decidir qué
vale la pena y qué se simplifica, y clasificar cada capacidad por su naturaleza
(obligatoria, buena práctica, operativa, UX, innovación). Se institucionaliza el
rol de **Arquitecto Funcional** y su marco.

## Decisión

**1. Lente comparativo (obligatorio en cada análisis).** Todo documento nuevo se
analiza también respondiendo:
- **Ellos mejor:** ¿qué hace mejor el software de referencia que nosotros?
- **Nosotros mejor:** ¿qué hacemos mejor que el software de referencia?
- **Simplificar:** ¿qué oportunidad hay de resolver el mismo problema de forma
  más simple, **sin copiar** el software existente?
- **Innovar:** ¿qué funcionalidad nueva aportaría valor y que **ninguno** de los
  dos sistemas tiene hoy?

**2. Naturaleza del requerimiento (clasificación adicional en el Backlog).** Cada
ítem se etiqueta con una o más:
- **Norma** — obligatoria por normativa (AGN, Ley 1755, 1712, 1581, 594, etc.).
- **Buena práctica** — estándar de gestión documental/servicio.
- **Operativa** — necesidad real de la operación de Simacota.
- **UX** — mejora de experiencia de usuario.
- **Innovación** — valor agregado propuesto por nosotros.

Esto separa lo que se implementa **por obligación** de lo que conviene **por
operación** y de lo que es **valor agregado**.

**3. Compuerta de dos preguntas (antes de proponer cualquier implementación).**
Ningún ítem se propone para desarrollo sin responder explícitamente:
- **(P1)** ¿Existe ya algo equivalente en nuestra plataforma? (reutilización —
  Principio 3).
- **(P2)** ¿Existe una forma más simple de resolver el mismo problema **sin
  copiar** exactamente el software de referencia? (KISS / superioridad).

**4. El Backlog Maestro es el documento maestro de evolución funcional.** Cada
ítem conserva trazabilidad **técnica** (módulo, esfuerzo, dependencias),
**funcional** (valor, decisión, comparativa) y **normativa** (naturaleza,
fuente legal).

## Alternativas evaluadas

1. **Replicar el software de referencia 1:1.** Descartada: el objetivo es una
   plataforma superior, no una copia; replicar arrastra su deuda (numeración
   inconsistente, UI legada, sin IA ni seguridad moderna).
2. **Solo inventariar brechas técnicas.** Descartada: pierde la oportunidad de
   simplificar e innovar.
3. **Marco comparativo + naturaleza + dos preguntas** *(elegida)*.

## Consecuencias

- **Positivas:** las decisiones de producto se toman por impacto/costo/beneficio
  y por naturaleza (obligación vs. valor); se evita copiar por copiar; se prioriza
  la simplificación y la innovación. Trazabilidad técnica + funcional + normativa.
- **Costo:** cada análisis exige el ejercicio comparativo y responder las dos
  preguntas; se mitiga porque es liviano y aporta claridad de priorización.
- **Relación con el congelamiento:** no autoriza implementación; el Bloque 2
  sigue "implementación completada – pendiente de validación". El marco solo
  gobierna el análisis y la priorización.
