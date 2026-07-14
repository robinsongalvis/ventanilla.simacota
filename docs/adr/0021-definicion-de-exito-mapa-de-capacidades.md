# ADR-0021 — Definición de éxito por iniciativa, mapa de capacidades y las Cuatro Preguntas de autorización

- **Fecha:** 2026-07-14
- **Estado:** aceptado (2026-07-14, por el propietario)
- **Responsable:** Robinson David Galvis (propietario)
- **Roles consultados:** arquitecto-principal, product-owner, gobierno-digital, qa, seguridad, ia-simi.
- **Relación:** cierra el marco de gobernanza funcional-arquitectónica (ADR-0017/0018/0019/0020). No sustituye ninguno.

## Contexto

El marco ya justifica, compara, automatiza y evalúa sostenibilidad. Falta lo que
convierte un backlog en un **roadmap arquitectónico**: (1) saber por anticipado
**cómo mediremos** que una capacidad aportó valor una vez exista (definición de
éxito, alineada con el criterio de éxito v2 — evidencia, no opinión), y (2) ver
las iniciativas como un **mapa de capacidades** conectadas, no como features
sueltas. Y falta la compuerta ejecutiva que resume todo antes de autorizar.

## Decisión

**1. Definición de Éxito (obligatoria antes de proponer implementación).** Cada
iniciativa registra, cuando aplique:
- **Objetivo esperado** — qué cambia cuando exista.
- **Resultado medible** — el efecto observable.
- **KPIs / indicadores de éxito** — métricas concretas.
- **Verificación de reducción** — cómo probaremos que bajó tiempos, errores o
  carga administrativa (línea base → medición posterior; ADR-0015).
- **Beneficio concreto para el ciudadano.**
- **Beneficio concreto para el funcionario.**
- **Riesgos que introduce y su mitigación.**
- **Costo de mantenimiento futuro.**
- **Impacto sobre la arquitectura existente.**
- **Efecto sobre la evolución futura de la plataforma.**

Sin definición de éxito medible, una iniciativa no pasa a "Aprobada para
desarrollo". Cuando un KPI no tenga métrica disponible, se declara el supuesto
(Principio 13) en vez de presentarlo como hecho.

**2. Mapa de capacidades (relaciones entre iniciativas).** Cada iniciativa indica,
cuando corresponda:
- **Habilita** — qué otras capacidades vuelve posibles.
- **Depende de** — qué necesita antes.
- **Consolida con** — qué comparte dominio funcional (candidato a unificar).
- **Se implementa junto a** — qué conviene entregar en el mismo lote.
- **Puede esperar porque** — qué otra iniciativa ya cubre parcialmente la
  necesidad.

El Plan Maestro deja de ser una lista priorizada y pasa a ser un **roadmap
arquitectónico**: un mapa de dominios (Comunicaciones, Clasificación, Contingencia,
Planillas, Identidad/Solicitante, IA-SIMI, Integraciones) con sus dependencias.

**3. Las Cuatro Preguntas (compuerta ejecutiva de autorización).** Ninguna
iniciativa se propone a desarrollo sin superar, **con evidencia objetiva**, las
cuatro:
1. **¿Resuelve un problema real?** (Principio 2 + fuente/evidencia)
2. **¿Es la mejor solución posible?** (comparativa y P2 de ADR-0018)
3. **¿Aporta más valor que complejidad?** (Principio de Valor Neto, P3 de ADR-0020)
4. **¿Contribuye a la visión de largo plazo?** (rejilla de sostenibilidad, lente F)

Si alguna no se supera con evidencia, la iniciativa **no se propone**. Las Cuatro
Preguntas son la síntesis ejecutiva de las compuertas detalladas (P1–P3 + lentes
A–F + J1–J5), no las reemplazan.

## Alternativas evaluadas

1. **Dejar el éxito para después de construir.** Descartada: sin línea base no se
   puede demostrar valor (contradice ADR-0015 y el criterio de éxito v2).
2. **Mantener backlog plano priorizado.** Descartada: oculta dependencias y
   oportunidades de consolidación; lleva a construir features que se pisan.
3. **Definición de éxito + mapa de capacidades + Cuatro Preguntas** *(elegida)*.

## Consecuencias

- **Positivas:** cada capacidad nace con su forma de medirla; el roadmap muestra
  qué construir junto y en qué orden; la autorización se vuelve una decisión
  basada en evidencia (4 preguntas) y no en entusiasmo.
- **Costo:** más trabajo de análisis por ítem; se mitiga aplicándolo primero a las
  iniciativas de mayor valor y declarando supuestos cuando falte métrica.
- **Relación con el congelamiento:** no autoriza implementación; el Bloque 2 sigue
  "implementación completada – pendiente de validación". Gobierna análisis y
  priorización. El foco operativo pasa a **enriquecer el Plan Maestro** con
  retroalimentación de la Alcaldía, validación de funcionarios y evidencia de la
  operación real.

## Verificación de cumplimiento

Un ítem está listo para proponerse a desarrollo cuando tiene: comparativa (0018),
naturaleza, automatización/E (0019), sostenibilidad/F y valor neto/P3 (0020),
**definición de éxito medible**, **relaciones del mapa de capacidades**, ≥1
criterio J1–J5, y **supera las Cuatro Preguntas con evidencia**.
