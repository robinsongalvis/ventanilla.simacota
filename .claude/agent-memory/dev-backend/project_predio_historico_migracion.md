---
name: predio-historico-migracion
description: Modelado de DatosPredio en el motor + mapearPredioHistorico en el importador de históricos (rama claude/datos-predio-historico, 11-ago-2026); decisiones sobre qué campos del libro de Planeación son aprovechables
metadata:
  type: project
---

Rama `claude/datos-predio-historico` (11-ago-2026): se añadió `Expediente.predio?: DatosPredio` (`lib/motor-expedientes/tipos.ts` — `direccion`, `barrioVereda`, `matriculaInmobiliaria`, `areaTexto`, todos opcionales, `areaTexto` es TEXTO a propósito porque el origen mezcla unidades "48 HA 2469 M2") y `mapearPredioHistorico` (`lib/migracion/planificar-importacion-consecutivo.ts`) que decide campo por campo qué es aprovechable del libro histórico de licencias.

**Hallazgos verificados contra las 202 filas reales** (`.local.json`, gitignored):
- `direccion`: 54/202, y las 54 valen literalmente "SIMACOTA" (el municipio) — se descarta siempre (`DIRECCION_ES_MUNICIPIO`), comparando con `normalizarTextoHistorico`.
- `area`: 16/202, columna DESALINEADA — solo 5 son áreas reales (contienen token `HA`/`M2` con `\b`, no substring — "EL CHANCE" contiene la subcadena "HA" y sería un falso positivo sin los límites de palabra); las otras 11 son direcciones/veredas coladas, reportadas como `AREA_DESALINEADA` con hoja/fila en `PlanImportacion.datosPredio.filasAreaDesalineada`.
- `matricula`: 11/202, TODAS calzan `/^\d{3}-\d{4,8}$/` (círculo 321, folios de 4-5 dígitos) — único campo limpio.
- `barrioVereda`: 13/202, se conserva verbatim (mezcla veredas reales con al menos una dirección urbana, sin señal para separarlas).

**Diseño clave**: el predio es ORTOGONAL a las puertas de cuarentena (P1′/P4′/fecha/identidad) — ausencia o descarte de un campo de predio NUNCA cuarentena un registro. `PlanImportacion.datosPredio` se calcula sobre los 202 registros del snapshot completo, no solo sobre los importables (que hoy son 0).

**Decisión de alcance**: `correcciones` (3/202, valores "X"/"x" sin contenido textual) se declaró FUERA DE ALCANCE — modelarlo de forma útil exigiría escribir a la subcolección `observaciones`, lo que cambia la FORMA de `PlanImportacion` y del ejecutor `.mjs`, no justificado para un campo en 1.5% de filas sin contenido más allá de sí/no. `noLicencia` SÍ se mapea, a `actoFinal.numero` (con `cierreDesconocido: true` intacto, porque `validarCierreExpediente` exige numero+fecha+fechaFirmeza los tres para considerarlo completo).

**Doctrina PII confirmada vigente**: `direccion`/`barrioVereda`/`matricula`/`area` NO están en `.sanitizado.json` (versionado) — solo en `.local.json` (gitignored). En CI, `datosPredio` siempre da 0 en los 4 conteos; verificado con un test dedicado que carga el `.sanitizado.json` DIRECTO (sin el fallback que usa el resto de la suite), ver `__tests__/migracion-reconciliacion-snapshot-real.test.ts`.

Ver también [[project_importador_historicos]] (bloque padre, PR #176 Fase 5) para el contexto completo del importador.
