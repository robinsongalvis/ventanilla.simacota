# Acta de limpieza de datos de prueba — producción

**Fecha del acta:** 23-ago-2026 · **Marco:** PLAN_GO_LIVE §Limpieza (Fase 2)
**Autorización:** el propietario, por chat, 23-ago-2026, sobre la lista literal
de este acta, tras inventario en solo lectura (`inventario-datos-prueba.mjs`,
detalle en `docs/auditorias/inventario-datos-prueba.local.json`, fuera de git).
**Ejecución:** `scripts/operacion/limpiar-datos-prueba.mjs` — lista literal,
huella por objetivo, todo-o-nada, ensayado en stage (siembra→ejecución→
verificación→limpieza) antes de tocar producción.

## Por qué dos tratamientos

Los registros de prueba DENTRO de una serie consecutiva oficial no se borran:
borrar deja en la foliación AGN un hueco indistinguible de un registro
desaparecido. Se ANULAN como en el libro de papel — el número se pierde con
constancia, el registro queda marcado (`isTest` + `excludeFromMetrics` +
bloque `anulado` + trazabilidad) y este acta explica el porqué para siempre.
Los registros FUERA de las series se borran: no dejan hueco en nada.

## Lista autorizada

### Se BORRAN (8 — fuera de las series oficiales)
| Id | Qué era |
|---|---|
| `1-WEB-2026-64476419` | Botón de prueba E2E, `isTest` |
| `1-WEB-2026-81440313` | Botón de prueba E2E, `isTest` |
| `1-WEB-2026-82744426` | Botón de prueba E2E, `isTest` |
| `1-WEB-2026-82843811` | Botón de prueba E2E, `isTest` |
| `SIM-UAT-1780191487988` | «Ciudadano UAT Prueba», UAT 31-may, confirmado por el propietario |
| `31d5ef52-…` (expediente `DEMO-26-e70bf488`) | Ensayo del motor, serie demo, `esPrueba` |
| `3fd53fd2-…` (expediente `DEMO-26-6945103e`) | Ensayo del motor, serie demo, `esPrueba` |
| `acd849c8-…` (expediente `DEMO-26-793362d5`) | Ensayo del motor, serie demo, `esPrueba` |

### Se ANULAN con constancia (2 — números de la serie legal 1-110)
| Id | Qué era | Efecto |
|---|---|---|
| `1-110-2026-00000025` | «Prueba Sistema Claude — DATO DE PRUEBA» (10-jul) | Número 25 anulado; registro queda marcado |
| `1-110-202607-00000026` | «PRUEBA UAT» escrito por la preview de UAT en producción (23-jul) | Número 26 anulado; sale de la bandeja operativa |

### No se tocan
Los 17 radicados legítimos (incluidos los del formato de consecutivo
anterior — la copia del sistema de la alcaldía, previos a la adopción del
`1-110` el 15-jul: son archivo real del municipio), los 196 expedientes
históricos, la salida y las 2 planillas.

## Salvaguardas aplicadas
- Huella dactilar por objetivo: si un dato cambió desde el inventario, el
  script aborta COMPLETO sin tocar nada.
- Verificación de vínculos: ningún expediente se borra si un radicado
  legítimo lo enlaza (`vinculoExpediente`).
- `counters/` y `unicidad_*` jamás se tocan (espíritu DF-9).
- Ensayo previo en stage con dobles `ENSAYO-*`: VÁLIDO (10/10).

## Resultado de la ejecución
**PENDIENTE** — se completa con la salida del comando tras ejecutarlo el
propietario. Residual conocido: los archivos de Storage de los radicados
borrados (si los hubiera) quedan huérfanos e inaccesibles desde la
aplicación; su barrido queda para el paquete PT-4.
