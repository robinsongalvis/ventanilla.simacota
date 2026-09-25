# ADR-0032 — Sistema de diseño interno (`app/components/design-system/`)

- **Estado:** BORRADOR — pendiente de ratificación del propietario.
  Documenta *a posteriori* una decisión que entró al código sin ADR
  (PR #200, 18-ago-2026, colaborador nuevo) — registrar tarde es mejor
  que no registrar, pero este ADR no blanquea el salto del proceso:
  lo deja escrito para que no se repita (Principio 1: un módulo
  transversal nuevo es Nivel 3 y su análisis va ANTES de codear).
- **Fecha del borrador:** 24-ago-2026 (redacción nocturna autónoma;
  decisiones de fondo ya materializadas en el código, aquí solo se
  describen y se acotan).

## Contexto

El PR #200 introdujo 9 componentes reutilizables en
`app/components/design-system/` (StatusBadge, MetricCard, MetricsSummary,
SectionHeader, CollapsibleSection, EmptyState, SearchToolbar,
PriorityBanner, más el índice) y refactorizó las vistas del tablero para
consumirlos. El objetivo declarado: reducir la duplicación visual del
panel interno (badges, tarjetas de métrica y encabezados se reimplementaban
por vista) sin tocar lógica de negocio.

## Decisión (la que de hecho rige)

1. Los componentes visuales **reutilizables del panel interno** viven en
   `app/components/design-system/` y se consumen desde las vistas; no se
   reimplementan por vista (Principio 3).
2. Conviven con el sistema de **tokens CSS** existente (`app/globals.css`,
   ADR-0030): los componentes DEBEN consumir tokens para color de texto y
   estados. Donde el #200 no lo hizo, ya se corrigió con regresión
   (#202 contraste de métricas, #203 `nota` de SectionHeader).
3. Un color de KPI viaja SIEMPRE en pareja `{color, colorTexto}` — el tono
   identifica, la variante `-text` se lee (lección #202, fijada por tipo
   obligatorio y test).

## Deudas reconocidas de la decisión

- **Pérdida funcional del tablero**: las tarjetas grandes mostraban el
  radicado más crítico por KPI con apertura de un clic; `MetricsSummary`
  solo muestra cuentas. Decisión de producto PENDIENTE del propietario
  (restaurar, adaptar, o aceptar) — registrada en la revisión del #200.
- Los componentes **no tienen tests propios** (solo las regresiones de
  contraste); cobertura pendiente.
- `--text-muted` (#94A3B8) rinde 2,3–2,6:1 en ~236 usos de la app —
  deuda de accesibilidad PREEXISTENTE al #200, requiere decisión global.

## Consecuencias

- Nuevas vistas internas deben componer desde `design-system/` antes de
  crear marcado propio; añadir un componente nuevo al sistema exige
  actualizar este ADR (adenda) y pruebas de contraste si pinta texto.
- La revisión cruzada de cambios de UI comprueba parejas
  `{color, colorTexto}` y consumo de tokens — la matriz de contraste
  (`__tests__/tablero-metricas-contraste.test.ts`) es el guardián.

## Ratificación

Pendiente del propietario. Si se ratifica, cambiar Estado a ACEPTADO con
fecha; si se decide revertir el enfoque, este documento registra qué
habría que deshacer.
