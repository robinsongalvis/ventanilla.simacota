# ADR-0024 — Formato del número de radicado alineado al legado municipal (AAAAMM)

- **Fecha:** 2026-07-15
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (propietario) — decisión aprobada 2026-07-15
- **Roles consultados:** dev-backend (implementación); pendiente revisión cruzada gobierno-digital + seguridad (formato del identificador legal y ecosistema de validación).

## Contexto

BM-B01 (`docs/BACKLOG_MAESTRO.md`) registraba como pendiente la inconsistencia
entre el formato de radicado de la Ventanilla (`1-110-{AAAA}-{########}`,
decidido con la ingeniera MIPG — código de oficina RADICADORA, nunca cambia al
trasladar) y el formato del sistema legado municipal, que los funcionarios ya
conocen de la planilla física real y que codifica el mes en el tercer
segmento (`{AAAAMM}`).

El propietario aprobó adoptar la máscara del legado para continuidad
institucional: el número que produce la Ventanilla debe ser reconocible por
quien lleva años radicando en el sistema anterior. Esta es una decisión de
**formato del identificador**, no de la mecánica de asignación — no toca el
defecto H3 (consecutivo fantasma) corregido en ADR-0016, ni el helper
transaccional `lib/server/consecutivo-legal.ts`.

Este ADR **supersede la parte de formato** de la decisión registrada en el
encabezado de `lib/radicado-institucional.ts` (sprint "Número con oficina
radicadora", jul 2026, sin ADR propio en ese momento — este es el primero que
formaliza el string exacto). El código de oficina radicadora (`110`) y el
principio de que el número nunca cambia al trasladar **no se revisan**: siguen
vigentes tal cual.

## Decisión

1. **Entrada:** `1-110-{AAAAMM}-{consecutivo 8 dígitos}`
   (`lib/radicado-institucional.ts` → `formatearRadicadoInstitucional`).
2. **Salida:** `2-110-{AAAAMM}-{consecutivo 8 dígitos}`
   (`lib/salidas/radicado-salida.ts` → `formatearRadicadoSalida`), reemplazando
   el canal `SAL` por el mismo código de oficina `110` que usa la entrada —
   consistente con que la salida también la radica la Secretaría General y
   Gobierno.
3. **El mes es informativo, el consecutivo sigue siendo ANUAL.** Acuerdo AGN
   060/2001 exige una serie anual continua y sin reinicios; el mes solo se
   incrusta en el string del id. `counters/radicados-{año}` y
   `counters/salidas-{año}` **no cambian de esquema** — siguen indexados por
   año puro (`fecha.getFullYear()`), exactamente como antes.
4. **El helper transaccional `lib/server/consecutivo-legal.ts` no se toca.**
   Sigue recibiendo un `formatear: (consecutivo, fecha) => string` por serie;
   solo cambió el cuerpo de las dos funciones que se le pasan. Los 5
   llamadores (`app/api/radicacion`, `app/api/dependencias/registro-expres`,
   `app/api/salidas/registrar`, `lib/actions/radicarVentanilla.ts`) no se
   modificaron — usan el formateador canónico por referencia, nunca arman el
   string a mano (verificado por grep exhaustivo antes de implementar).
5. **Manejo de fecha/zona horaria: el preexistente, sin cambios.** El año ya
   se derivaba con `fecha.getFullYear()`; el mes se deriva de la MISMA
   instancia `Date` con `fecha.getMonth() + 1` y `padStart(2, '0')`. No se
   introdujo ninguna conversión de zona horaria nueva — si el manejo de tz
   preexistente tenía algún matiz, este cambio lo hereda sin alterarlo.
6. **Compatibilidad hacia atrás obligatoria.** Los ids ya emitidos con el
   formato anterior (`1-110-{AAAA}-…`, `2-SAL-{AAAA}-…`, y los históricos por
   canal `1-WEB-…`/`1-OFICIO-…`/etc.) **nunca se reescriben** (AGN 060/2001
   art. 5). Todo consumidor que valide, filtre o parsee el formato debe
   aceptar AMBAS máscaras conviviendo en el mismo año:
   - `lib/seguridad/consulta-publica-radicado.ts` (`INSTITUCIONAL_RADICADO_RE`):
     el tercer segmento ahora es `\d{4}(?:0[1-9]|1[0-2])?` (4 o 6 dígitos).
   - `scripts/laboratorio/detectar-consecutivos-fantasma.mjs`: el filtro por
     año pasa de `.includes('-{año}-')` a la función exportada
     `perteneceAlAnio(docId, anio)`, que acepta `-{año}-` **o**
     `-{año}{MM}-`.
   - `e2e/helpers.ts` (`RE_NUMERO_RADICADO`, `RE_NUMERO_RADICADO_AMPLIO`,
     `RE_NUMERO_SALIDA`): mismas reglas, más el prefijo `SAL` legado para
     salidas.

## Alternativas evaluadas

1. **Reiniciar el consecutivo cada mes (serie mensual).** *Rechazada*: viola
   AGN 060/2001 (serie anual continua) y complicaría la reconciliación de
   huecos/duplicados del detector forense (Bloque 2) sin ningún beneficio —
   el propietario fue explícito en que el mes es solo informativo en el id.
2. **Reescribir los ids históricos al nuevo formato (migración de datos).**
   *Rechazada*: viola el principio de no-enmienda de AGN 060/2001 art. 5 y es
   innecesaria — el string del id es inmutable por diseño; la convivencia de
   formatos dentro del mismo año ya es el estado actual del sistema (ids
   `1-WEB-…` conviven con `1-110-…` desde antes de este cambio).
3. **Mantener el canal `SAL` en la salida y solo agregar el mes.** *Rechazada
   por el propietario*: la instrucción explícita fue unificar también el
   código de oficina (`110`) entre entrada y salida, no solo agregar el mes.

## Consecuencias

- **Positivas:** continuidad institucional con el sistema legado (menor
  fricción para funcionarios que ya conocen la máscara); el consecutivo anual
  y la mecánica atómica de H3 quedan completamente intactos — cambio aislado
  a la plantilla del string.
- **Negativas / riesgo aceptado:** dentro de un mismo año calendario
  convivirán ids con y sin mes (`1-110-2026-00000025` junto a
  `1-110-202607-00001217`) — es un estado esperado y documentado, no una
  inconsistencia a corregir; todo el ecosistema de validación fue actualizado
  para tratarlo como válido por diseño.
- **Deuda:** ninguna nueva. La convivencia de formatos por canal ya existía
  (`1-WEB-…` vs `1-110-…`); este cambio agrega una dimensión más (con/sin
  mes) al mismo patrón que el sistema ya maneja.
- **BM-B01 pasa de "Pend. validar" a Implementado** en
  `docs/BACKLOG_MAESTRO.md`.

## Pendiente

Revisión cruzada por gobierno-digital (conformidad AGN 060/2001 art. 5 y Ley
1755/2015 del string exacto) y seguridad (que ningún regex de validación de
entrada quedó más permisivo de lo necesario) antes de considerar este ADR
cerrado sin condiciones.
