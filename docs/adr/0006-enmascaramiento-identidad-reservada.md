# ADR-0006 — Enmascaramiento transversal de identidad reservada (H2, variante A)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (propietario eligió variante A)
- **Roles consultados:** gobierno-digital (concepto normativo), arquitecto-principal (plan), coordinador

## Contexto

Hallazgo H2 (`docs/REGISTRO_RIESGOS.md`): la identidad reservada se enmascara en el
mostrador de Ventanilla, la consulta pública y los reportes MIPG, pero **se filtra en las
vistas internas de gestión** — panel de detalle (`app/interno/dashboard/page.tsx`
~2492-2501), bandeja (~4290-4292), filas (1495/1585/2223/2547) **y la exportación CSV/Excel
(~3687-3692)**, que emite `nombreCompleto` + `numeroDocumento` sin guarda (vector de
exfiltración de mayor impacto, confirmado por el coordinador). La función `identidadProtegida`
existe una sola vez y local a `VistaVentanilla.tsx:75`. Norma: Ley 1581/2012 art. 4 f/g/h
(acceso restringido, seguridad, confidencialidad).

## Decisión

**Variante A — enmascarar por defecto** (elegida por el propietario). La identidad
reservada **nunca** se muestra en vistas internas de gestión ni en la exportación:

- Elevar el criterio de `identidadProtegida` a un helper compartido reutilizable (no local a
  un componente) que decida el valor visible del solicitante (`'Identidad protegida'` y
  documento enmascarado cuando `identidadReservada`), aplicado de forma **transversal** en
  todas las superficies internas citadas y en la exportación.
- La revelación controlada por rol y necesidad de conocer (variante B) queda **diferida** como
  candidata post-Ola-1; no se implementa ahora.

## Alternativas evaluadas

- **Variante B (revelar con traza por rol).** Más funcional pero exige control de auditoría de
  accesos y definición de quién puede revelar; mayor complejidad y superficie. Descartada por
  el propietario para la Ola 1.
- **Parche puntual solo en el export.** Descartada: dejaría las demás superficies filtrando.

## Consecuencias

- **Positivas:** cierra la fuga en todas las superficies internas + export; conformidad Ley 1581.
- **Deuda aceptada:** la revelación legítima (variante B) se difiere; si un rol necesitara ver
  la identidad para un trámite, se abrirá como frente propio bajo el ciclo institucional.
- **Verificación de flujo:** la gestión interna opera por `radicadoId`, no por el nombre, así
  que el enmascaramiento no debe bloquear asignar/responder — se verifica en el E2E.

## Control de regresión (obligatorio)

- Test unitario del helper de enmascaramiento (reservada → protegido; no reservada → visible).
- `e2e/07-identidad-reservada.spec.ts` **invertido/extendido**: hoy solo verifica el mostrador;
  debe asertar el enmascaramiento también en detalle, bandeja y **exportación** (que la fila
  exportada de un reservado NO contenga su nombre ni documento). Falla si la fuga reaparece.
