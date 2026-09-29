# Registro de autorización y propuesta de apertura de contingencia

Fecha de la instrucción: 29-sep-2026.

**No es un acta administrativa numerada ni una resolución.** Es la referencia
técnica solicitada por el propietario para conservar la instrucción y su alcance.
No se inventa número oficial ni se afirma una apertura que no se ha ejecutado.

## Autoridad declarada por el propietario

`autorizadoPor="Secretaría de Gobierno de Simacota — instrucción de contingencia comunicada el 29-sep-2026"`

`referencia="docs/actas/ACTA_APERTURA_CONTINGENCIA_RADICADOS_2026-09-29.md"`

El propietario confirma que el libro/sistema externo está congelado y que los
19 radicados existentes, consecutivos 9–27, son datos de prueba ya identificados
con `isTest=true` y `excludeFromMetrics=true`. No se borran ni reescriben.

## Propuesta pendiente de ejecución

| Concepto | Valor |
| --- | --- |
| Proyecto | `ventanilla-unica-f31b1` |
| Documento de contador | `counters/radicados-2026` |
| Valor actual observado | 27 |
| Valor propuesto | 1744 |
| Primer radicado real | `1-110-202609-00001745` |
| Siguiente radicado real | `1-110-202609-00001746` |

No se emiten 28–1744; no se reutiliza ningún histórico. Los números 1745 y1746
se reservan exclusivamente para operación real. No se consumen para pruebas.

## Evidencia del dry-run de esta entrega

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

La evidencia corresponde a una lectura puntual, no a una reserva anticipada.
Debe repetirse bajo ventana de apertura antes de una futura escritura, con
relectura transaccional del contador y comprobación de colisiones. Si el período
Bogotá cambia a octubre, se debe revisar la autorización; nunca antedatar.

## Puerta de revisión

Autorizadas en esta fase: implementación aislada, pruebas locales, una radicación
sintética en Stage con identidad legítima y dry-run Production de solo lectura.
**No autorizadas todavía: apertura 27→1744 ni despliegue Production.**

La apertura formal y el despliegue final requieren revisar la evidencia Stage
y confirmar su ejecución. Este archivo no reemplaza esa confirmación.
