# ADR-0012 — Controles normativos ejecutables: R6 y R9 (2C)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (validó la Ola 2)
- **Roles consultados:** gobierno-digital (concepto, `docs/laboratorio/CONCEPTO_NORMATIVO_OLA2.md`), arquitecto-principal, seguridad (revisión), coordinador

## Contexto

El frente 2C convierte hallazgos normativos abiertos en controles ejecutables (modelo probado
con H1 y R8). El concepto de gobierno-digital (verificado contra código) dictaminó:
- **R6** (prórroga sobre término ya vencido) — convertible ya. `validarProrroga`
  (`lib/server/radicados-security.ts:71-94`) no recibe `fechaVencimiento` ni reloj; el endpoint
  no compara contra la fecha actual. Ley 1755/2015 art. 14 parágrafo ("antes del vencimiento").
- **R9** (inferencia en la búsqueda) — convertible ya. El servidor **ya cierra R9**
  (`lib/busqueda/filtros-radicado.ts:157,183-193` excluye reservados); la brecha vive solo en
  los **filtros rápidos del cliente** (`page.tsx:210-218`, `VistaVentanilla.tsx:68-72`) que
  matchean nombre/documento sin guarda. Ley 1581/2012 art. 4 f/g.
- **R10** (necesidad de conocer) — NO convertible aún: es la variante B, requiere decisión del
  product-owner (quién revela, condición, traza, alcance). Variante A vigente es conforme.

## Decisión

Se implementan **dos controles ejecutables** en la Ola 2:

1. **R6 — control de temporalidad de la prórroga.** `validarProrroga` recibe `fechaVencimiento`
   y un reloj inyectable; rechaza la prórroga si el término original ya venció. Control de
   regresión: casos nuevos en `__tests__/prorroga-validacion.test.ts` (función pura, patrón H1).
   Rol: **dev-backend**. Decisión de producto menor resuelta: **rechazar** (no registrar
   extemporánea) por defecto.
2. **R9 — control anti-inferencia en filtros de cliente.** Extraer el predicado de filtro rápido
   a una función pura que **reutilice** el criterio de reserva ya existente (`identidadProtegida`),
   de modo que un reservado no matchee por nombre/documento (sí por radicadoId). Control de
   regresión: test unitario que falla si el filtro vuelve a matchear identidad reservada.
   Rol: **dev-frontend** (revisión gobierno-digital). Reutilización, no duplicación (Principio 3).

**R10 queda EN DECISIÓN** (dueño: product-owner) en `docs/REGISTRO_RIESGOS.md`; no entra a la
Ola 2 hasta que exista la decisión de variante B. Sin urgencia jurídica (variante A conforme).

## Consecuencias

- **Positivas:** dos hallazgos normativos abiertos pasan a controles verdes en CI (KPI trazabilidad);
  R6 cierra una brecha de derecho fundamental (art. 23 CP).
- **Deuda declarada:** R10 diferido a una decisión de producto (variante B).

## Control de regresión (obligatorio)

R6: test unitario de `validarProrroga` con reloj inyectable (prórroga sobre término vencido →
rechazada). R9: test unitario del predicado de filtro (reservado no matchea por identidad).
Ambos fallan si la conformidad regresiona.
