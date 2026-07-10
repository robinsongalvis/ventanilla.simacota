<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Estándares de código

- TypeScript estricto (`strict: true` ya activo): no usar `any` ni `unknown` sin justificación.
- Nombres en **español** para entidades del dominio (radicado, dependencia, solicitante)
  y en **inglés** para utilidades técnicas.
- Mensajes de error para el usuario final: descriptivos y en español.
- JSDoc en funciones públicas complejas; exportar tipos para todos los modelos de Firestore.

# Sistema operativo de ingeniería

## Visión del proyecto

La Ventanilla Única Inteligente de Simacota no resuelve solo las necesidades
actuales del municipio: construimos una plataforma pública moderna, segura,
escalable, mantenible e inteligente, capaz de convertirse en referente de la
transformación digital de los municipios colombianos. Toda decisión técnica,
funcional o arquitectónica se evalúa también por su capacidad de evolucionar
durante años y de servir como base para otras entidades territoriales.

Disciplina de aplicación: la visión orienta decisiones, pero no justifica
generalidad especulativa (YAGNI sigue vigente). La regla práctica es **no
cerrar puertas** — no acoplar el código a particularidades de Simacota que ya
cubre el modelo multi-tenant — en lugar de construir features para municipios
hipotéticos que nadie ha pedido.

## Regla Suprema

> **La realidad del proyecto siempre tiene prioridad sobre el proceso.**

- Ninguna regla se mantiene solo porque "siempre se ha hecho así".
- Si una regla deja de aportar valor, genera burocracia o dificulta el
  desarrollo sin mejorar la calidad, se propone su modificación mediante ADR.
- El proceso evoluciona con el proyecto: cada retrospectiva (Principio 11)
  incluye la pregunta *"¿alguna regla estorbó sin aportar en esta iteración?"*
  — esa es la revisión periódica de los principios.
- **Salvaguarda de trazabilidad:** saltarse una regla invocando la Regla
  Suprema exige dejar constancia de una línea (en el commit o en la respuesta)
  con el porqué. Si la excepción se repite, deja de ser excepción: se propone
  el cambio de regla por ADR.
- **Alcance:** la Regla Suprema gobierna las reglas de *proceso*. No autoriza a
  saltarse invariantes de producto, seguridad o ley, que no son proceso sino
  correctitud: aislamiento por `tenantId`, IA sugiere / funcionario decide,
  protección de datos personales, y las obligaciones normativas vigentes.

## Los 13 principios

Decisión registrada en `docs/adr/0001-sistema-operativo-de-ingenieria.md`;
protocolo completo del equipo de subagentes y criterios detallados de triaje en
`.claude/agents/README.md`. Resumen vinculante:

1. **Arquitectura antes que implementación** — según el triaje de proporcionalidad:
   - *Nivel 1 (trivial)*: bug puntual, texto, test aislado → directo, justificación en el commit.
   - *Nivel 2 (feature dentro de un módulo)*: revisión arquitectónica exprés + revisión cruzada.
   - *Nivel 3 (estructural)*: módulo nuevo, colección nueva, cambio de flujo o integración →
     análisis completo de impacto (técnico, funcional, seguridad, rendimiento, UX, normativo,
     IA, deuda, reutilización) ANTES de codear, + ADR.

   Criterios de clasificación detallados en `.claude/agents/README.md`.
   Ante la duda entre dos niveles, aplica el superior.
2. **Todo cambio se justifica** — debe responder al menos una: ¿qué problema resuelve?,
   ¿qué mejora medible aporta?, ¿qué riesgo elimina?, ¿qué deuda reduce?, ¿qué capacidad
   futura habilita? Si ninguna aplica, no se implementa. "Se ve mejor" no es justificación.
3. **Reutilización por defecto** — antes de crear un archivo, componente, servicio, hook,
   función o API, buscar si ya existe equivalente en el repo. Duplicar lógica está prohibido.
4. **Calidad institucional** — SOLID, DRY, KISS, YAGNI, Clean Architecture, accesibilidad,
   seguridad, rendimiento y mantenibilidad en cada entrega. Sin atajos que hipotequen el futuro.
5. **Revisión cruzada obligatoria** — nadie valida su propio trabajo (matriz en
   `.claude/agents/README.md`).
6. **Decisiones registradas** — toda decisión importante genera un ADR en `docs/adr/`.
7. **Pensamiento sistémico** — optimización global, no local: analizar el efecto de cada
   cambio sobre el resto del sistema.
8. **Calidad antes que velocidad.**
9. **IA como copiloto** — la IA propone, el funcionario decide. Nunca decisiones
   administrativas, jurídicas o institucionales automáticas.
10. **Visión de producto** — plataforma pública referente nacional para municipios
    colombianos; cada decisión debe acercar a ese objetivo.
11. **Mejora continua** — retrospectiva técnica breve al cerrar cada funcionalidad
    (`docs/retrospectivas/`).
12. **Excelencia profesional** — criterio de ingeniero senior: cuestionar solicitudes que
    empeoren arquitectura, deuda, seguridad o buenas prácticas, y proponer la alternativa
    superior antes de implementar. Nada de respuestas complacientes.
13. **Medición antes que opinión** — las decisiones importantes se apoyan en métricas y
    evidencia siempre que sea posible: reproducir un bug antes de corregirlo, medir antes
    de optimizar (y después, para demostrar la mejora), datos de uso o validación directa
    con la funcionaria antes de priorizar, evidencia de tests en todo veredicto de calidad.
    Cuando no exista métrica disponible, se declara el supuesto explícitamente en lugar de
    presentarlo como hecho. Medir no puede volverse parálisis: si medir cuesta más que
    tomar una decisión reversible, se decide, se registra el supuesto y se mide después.
