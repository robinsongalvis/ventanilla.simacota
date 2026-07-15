# ADR-0011 — Auditor de rendimiento y presupuestos en CI sobre la señal de observabilidad (2B)

- **Fecha:** 2026-07-11
- **Estado:** aceptado
- **Responsable:** Robinson David Galvis (validó la Ola 2)
- **Roles consultados:** arquitecto-principal + devops (diseño), seguridad (revisión), coordinador

## Contexto

La observabilidad de P-C (`lib/observabilidad/eventos-negocio.ts`, ADR-0005) instrumenta solo
las 4 **escrituras** (`OperacionCritica`, línea 27). La **lectura** —donde vive R11— NO está
instrumentada, así que hoy no existe una latencia p95 ni un conteo de documentos leídos
medidos para la consulta de radicados. Sin línea base medida no se puede demostrar la mejora
de 2A (paginación): el propietario exige mejoras demostrables, no declarativas.

## Decisión

1. **Extender la señal de observabilidad a la lectura**, reutilizando `registrarEventoNegocio`
   (sin duplicar): ampliar el vocabulario de operaciones para incluir la(s) lectura(s) de
   radicados (stream del dashboard y consulta), emitiendo **latencia** y **nº de documentos
   leídos**, sin PII (mismo saneo institucional).
2. **Capturar la línea base ANTES de 2A** (Principio 13): medir latencia p95 y nº de documentos
   por carga con el patrón actual (O(N)) contra un stage con volumen representativo, y
   registrarla. Tras 2A, volver a medir → la mejora se demuestra con dato.
3. **Presupuesto de rendimiento en CI**: un control que **falla** si una consulta de radicados
   lee sin límite (o supera un umbral de documentos/latencia acordado). Debe probarse por
   **mutación** (una consulta ilimitada hace fallar el job) — mismo estándar que P-B.

- **Alcance:** la señal de lectura + la captura de base + el presupuesto en CI. NO incluye APM
  ni dashboards (deuda declarada, ADR-0005). Emulador local no corre (Java 8) → CI es la compuerta.

## Consecuencias

- **Positivas:** habilita el KPI "más evidencia automatizada" y "mayor escala"; da la base
  numérica para demostrar 2A; el presupuesto en CI previene regresiones de rendimiento.
- **Deuda declarada:** sin APM; cobertura inicial de la lectura de radicados (otras lecturas
  "leer todo" de menor criticidad heredan el patrón de 2A — ver PLAN_OLA2 §deuda).

## Control de regresión (obligatorio)

El presupuesto de rendimiento en CI es el control: falla ante una consulta ilimitada
(verificado por mutación). La señal de lectura se prueba (emite latencia + nº docs, sin PII).
