# ADR-0026 — Separación de entornos (producción / stage) y arranque limpio en go-live

- **Estado:** ACEPTADO (2026-07-23)
- **Decisor:** Propietario (Robinson David Galvis)
- **Contexto de origen:** UAT de la Fase 3 de la pieza angular.

## Contexto

Hasta hoy el proyecto opera con **un solo proyecto Firebase** (`ventanilla-unica-f31b1`) que sirve simultáneamente a producción y a las pruebas. No existe entorno de stage (brecha conocida desde el Laboratorio de Calidad). Durante el UAT de la Fase 3, el preview se configuró con la `FIREBASE_SERVICE_ACCOUNT` de producción y, en consecuencia, **escribió en la base de datos real**: la radicación de prueba `1-110-2026-00000026` quedó en la colección de producción y consumió el consecutivo legal 26.

Los consecutivos de radicado tienen valor jurídico (norma AGN). Entregar el sistema al municipio con la serie iniciando en 27/35/40 por pruebas internas es inaceptable.

## Decisión

1. **Los 26 radicados existentes son TODOS de prueba** — generados durante desarrollo, validación y fases de prueba. Ninguno tiene validez jurídica ni corresponde a un trámite real. En consecuencia, **producción arranca limpia desde el radicado 1** en el go-live.

2. **Separación definitiva de entornos:**
   - **Producción:** limpia, sin datos de prueba, numeración desde 1. La limpieza/reset se ejecuta **solo después de tener respaldos operativos y probados** (G6 del ADR-0025 es precondición dura e innegociable).
   - **Stage/UAT:** proyecto Firebase **independiente**, con sus propias credenciales apuntadas exclusivamente a los previews. Todas las pruebas futuras se realizan ahí.

3. **Criterio de arquitectura vigente desde 2026-07-23:** NO se realizan más pruebas funcionales sobre la base de datos de producción.

## Consecuencias

- El UAT de la Fase 3 sobre producción queda **pausado**; se retomará sobre stage.
- Se abre un frente de trabajo (nivel 3, con plan propio): provisión de backups (G6), creación del proyecto stage con siembra de catálogos (TRD, tenants, tipos de solicitud) y usuarios de prueba, y procedimiento de limpieza/reset de producción con su respaldo previo.
- El radicado de prueba `1-110-2026-00000026` y los 4 docs UAT `isTest` del Bloque 2 quedan inventariados para la limpieza.
- **Orden recomendado:** stage y backups antes de la limpieza; la limpieza se ejecuta como paso final del go-live, con respaldo hecho y verificado.

## Riesgos y salvaguardas

- **Irreversibilidad de la limpieza** → backup probado antes (regla del ADR-0025). Sin restauración ensayada, no se toca producción.
- **Valor legal de la serie** → la decisión de reset a 1 se sustenta en que no hay radicados reales; queda constancia en este ADR.
