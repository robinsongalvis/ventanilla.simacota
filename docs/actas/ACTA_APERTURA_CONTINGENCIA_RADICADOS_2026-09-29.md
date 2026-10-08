# Registro de autorización y propuesta de apertura de contingencia

Fecha de la instrucción: 29-sep-2026.

**No es un acta administrativa numerada ni una resolución.** Es la referencia
técnica solicitada por el propietario para conservar la instrucción y su alcance.
No se inventa número oficial ni se afirma una apertura que no se ha ejecutado.

## Adenda técnica del 7-oct-2026

El propietario confirmó dos hechos posteriores que sustituyen las premisas
operativas, sin borrar la evidencia histórica de septiembre:

1. Los consecutivos 28 y 29 fueron radicados de prueba/verificación creados y
   borrados directamente por el propio propietario durante el diagnóstico. No
   corresponden a ciudadanos ni a un proceso no autorizado, por lo que **no se
   clasifican como incidente de seguridad o integridad**. Sus reservas quedan
   conservadas: 28 y 29 están consumidos, son inmutables y no se reutilizan. El
   contador vigente observado después de esas pruebas es 29.
2. El libro físico no quedó congelado en septiembre y continuó avanzando. La
   mención a 1745 era una referencia puntual de esa fecha, no el número definitivo
   de arranque. En la ventana real de salida, el ADMIN consulta el libro, lo
   congela y escribe expresamente el número `N` confirmado. No existe cifra
   sugerida ni esperada por anticipado; el contador queda en `N-1` y el primer
   trámite real consume `N`.

La salida histórica del dry-run incluida más abajo se conserva para trazabilidad,
pero está **superada y no es una instrucción operativa**. Antes de abrir debe
repetirse el preflight con `--primer-numero N` y el contador que exista entonces.

## Autoridad declarada por el propietario

`autorizadoPor="Secretaría de Gobierno de Simacota — instrucción de contingencia comunicada el 29-sep-2026"`

`referencia="docs/actas/ACTA_APERTURA_CONTINGENCIA_RADICADOS_2026-09-29.md"`

El propietario confirmó el 29-sep-2026 que los 19 radicados existentes,
consecutivos 9–27, eran datos de prueba ya identificados con `isTest=true` y
`excludeFromMetrics=true`. No se borran ni reescriben. La declaración de que el
libro estaba congelado quedó sustituida por la adenda del 7-oct-2026.

## Propuesta pendiente de ejecución

| Concepto | Valor |
| --- | --- |
| Proyecto | `ventanilla-unica-f31b1` |
| Documento de contador | `counters/radicados-2026` |
| Valor observado el 29-sep-2026 | 27 (evidencia histórica; después avanzó a 29 por pruebas) |
| Primer consecutivo sugerido | Ninguno |
| Primer consecutivo definitivo | `N`, cotejado en el libro físico e ingresado por un ADMIN autorizado una sola vez |
| Valor que recibirá el contador | `N-1` |
| Primer radicado real | Se construye con período Bogotá vigente y consecutivo `N` |
| Siguiente radicado real | Mismo período institucional y consecutivo `N+1` |

No se reutiliza ningún histórico. El número elegido y el siguiente se reservan
exclusivamente para operación real. No se consumen para pruebas.

## Evidencia histórica del dry-run de esta entrega

Lectura oficial con `--propuesta-contingencia-solo-lectura`, sin persistir
configuración de apertura:

```text
CURRENT_COUNTER=27
PROPOSED_COUNTER_VALUE=1744
PROPOSED_FIRST_NUMBER=1745
EXPECTED_NUMBER_CHECK=OK
TARGET_DOCUMENT_COLLISIONS=0
TARGET_RESERVATION_COLLISIONS=0
HISTORICAL_TEST_RECORDS=19
PRODUCTION_WRITES=false
SERIES_DRY_RUN_OK=true
```

Esta evidencia corresponde a la referencia temporal de septiembre y queda
conservada únicamente como lectura histórica. **No autoriza, reserva, recomienda
ni obliga a usar 1745.** Debe repetirse bajo ventana de apertura, antes de
cualquier escritura, con `--primer-numero N`, relectura del contador vigente y
comprobación de colisiones iguales o posteriores a `N`. El período del radicado
siempre será el vigente en `America/Bogota`; nunca se antedata.

## Puerta de revisión

Autorizadas en esta fase: implementación aislada, pruebas locales, una radicación
sintética en Stage con identidad legítima y dry-run Production de solo lectura.
**La evidencia de 2026-09-29 no autorizó la apertura 27→1744.** Cualquier
apertura posterior debe usar el contador vigente y el `N` confirmado en el
libro físico; esta referencia técnica no sustituye la autorización operativa.

La apertura formal y el despliegue final requieren revisar la evidencia Stage
y confirmar su ejecución. Este archivo no reemplaza esa confirmación.
