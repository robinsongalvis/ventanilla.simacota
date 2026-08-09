---
name: bloque-c-libro-consecutivo
description: Libro Consecutivo real (reemplazo del Excel de Planeación) — arquitectura de archivos, contrato de columnas y decisión de testing sin fake timers
metadata:
  type: project
---

Implementado 8-ago-2026 en rama `claude/bloque-c-libro`, sobre [[project_bloque_b_licencias_vistaactual]]: `LibroConsecutivoClient.tsx` (nuevo) reemplaza el placeholder honesto en las dos rutas duales (standalone `/interno/licencias/libro-consecutivo` y sub-pestaña de `VistaLicencias`), consumiendo el mismo `GET /api/licencias/expedientes` que la Bandeja (sin filtro de año en servidor — se filtra en cliente).

Lógica pura extraída a `app/interno/licencias/presentacion-libro-consecutivo.ts` (naming: sigue el patrón `presentacion-*.ts` ya usado por actuaciones/subtipos): `añoRadicacionColombia` (año vía Intl timezone Bogotá, no UTC crudo — mismo principio que [[feedback_fecha_input_ancla_bogota]]), `añosDisponiblesLibro`, `construirFilasLibroConsecutivo` (filtra+ordena asc por número de expediente), `generarCsvLibroConsecutivo` (BOM+`;`+CRLF, columnas: N.EXPEDIENTE/FECHA RADICACION/SOLICITANTE/DOCUMENTO/SUBTIPOS/ESTADO JURIDICO/N.LICENCIA/FECHA FIRMEZA/PRUEBA).

**Por qué:** el ingeniero de Planeación lleva HOY un Excel real (`docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`, RF-6) — condición de adopción de la plataforma. `actoFinal.numero`/`fechaFirmeza` casi siempre ausentes hoy (H5: 0/202 históricos): la UI muestra "—", nunca inventa.

**Cambio colateral necesario:** el botón "Exportar libro consecutivo ↓" del pie de `BandejaLicenciasClient` era `BotonAccionPlaceholder` (no conectado) — se reemplazó por un enlace/botón real con prop aditiva opcional `onIrALibroConsecutivo` (mismo patrón que `onAbrirExpediente` del Bloque B). `LicenciasSidebar`/`LicenciasTopBarMovil`/`layout.tsx` ganaron `print:hidden` + overrides `print:overflow-visible` (el chrome es `h-screen overflow-hidden` en pantalla, cortaría la tabla al imprimir sin esto).

**How to apply:** si se toca este módulo de nuevo, el generador de CSV y el filtro de año viven en `presentacion-libro-consecutivo.ts` (funciones puras, testeadas en `__tests__/presentacion-libro-consecutivo.test.ts`) — no reimplementar en el componente.

Ver también [[feedback_testing_libro_consecutivo_sin_fake_timers]] para la trampa de testing que costó tiempo en esta tarea.
