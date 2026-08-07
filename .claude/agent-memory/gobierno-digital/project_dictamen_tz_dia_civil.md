---
name: dictamen-tz-dia-civil
description: Dictamen 6-ago-2026 sobre fix atLocalNoon (America/Bogota) — defecto confirmado; regla transicional con acciones pendientes de verificar
metadata:
  type: project
---

Dictamen exprés 6-ago-2026 (ADR-0026 §A2 deuda #15 / RS-1): el anclaje de
`atLocalNoon` a America/Bogota es CORRECCIÓN DE DEFECTO, no cambio de
criterio — el día civil jurídicamente relevante es el de la hora legal
colombiana (ver [[anclas-normativas-frecuentes]]).

**Why:** en Vercel (UTC) instantes > ~19:00 Bogotá se corrían al día civil
siguiente. Sesgo UNIDIRECCIONAL (UTC ≥ Bogotá): nunca se acortó plazo;
vencimientos almacenados solo pudieron quedar +1 día hábil.

**Regla transicional dictaminada (vigilar cumplimiento):**
1. Plazos comunicados AL CIUDADANO (límite de subsanación): se honran tal
   como se comunicaron, prohibido acortar (C.P. 83, CPACA 3.4).
2. Plazos de respuesta DE LA ENTIDAD en radicados EN TRÁMITE: exigido
   barrido one-off (recalcular o alertar) — el término real lo fija la ley,
   no la BD; +1 día induce extemporaneidad (Ley 1755 art. 31).
3. Radicados CERRADOS: no tocar (integridad, Ley 594 art. 19); basta
   constancia en ADR + REGISTRO_RIESGOS.

**How to apply:** en próximas revisiones verificar si el barrido (2) y las
constancias (cierre deuda #15 en ADR-0026, RS-1 en REGISTRO_RIESGOS.md) se
ejecutaron; supuesto declarado sin verificar: que fechaRadicacion/constancias
usan timestamp real y no día civil derivado de atLocalNoon.
