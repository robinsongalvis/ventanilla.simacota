# Datos de migración — insumos crudos

Snapshot de **solo lectura** del libro de consecutivo de licencias de la
Secretaría de Planeación (`CONSECUTIVO LICENCIAS Simacota Santander.xlsx`,
compartido por el ingeniero el 6-ago-2026), extraído el 9-ago-2026 para la
migración de Fase 5 (expedientes RECONSTRUIDOS, importador de históricos).

- **202 registros**, con procedencia verificable (`_procedencia.sha256` del
  archivo `.xlsx` origen, hoja/fila por registro).
- El Excel **sigue vivo** en Planeación — esto es un snapshot, no un corte
  definitivo. El corte y congelamiento formal ocurrirá tras la reunión con
  el ingeniero (doctrina R7 del análisis, `docs/planes/
  ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`).
- La hoja de impuestos 2022 **NO** se extrajo (R8: fuera del alcance de esta
  migración; decide P9).

## Esquema de DOS archivos (remediación PII, ago-2026)

El primer corte de este directorio versionó un único snapshot con nombres de
solicitantes. Corrección de diseño (hallazgo del coordinador, ago-2026): un
nombre propio **jamás** debe entrar a la historia de git, ni en un
repositorio privado — la historia es **permanente** incluso si el archivo se
borra o se sobrescribe después; "privado hoy" no protege contra un cambio de
visibilidad del repo mañana, un fork, o un clon ya hecho. Ley 1581/2012
(protección de datos personales) es un invariante de PRODUCTO, no un detalle
de proceso — no se negocia por conveniencia de migración.

Por eso este directorio distingue dos archivos, generados a partir de la
MISMA fuente:

| Archivo | Contenido | ¿Se versiona? |
|---|---|---|
| `consecutivo-licencias-snapshot.sanitizado.json` | Los 202 registros, con TODOS los campos que usa el planificador (`hoja`, `fila`, `radicado`, `fechaSolicitud`, `tipo`, `estado`, `noLicencia`) — **sin** `solicitante`/`direccion`/`barrioVereda`/`area`/`matricula`/`correcciones` | **Sí** — este es el que corre en CI y el que ve cualquiera que clone el repo |
| `consecutivo-licencias-snapshot.local.json` | Los 202 registros COMPLETOS, con nombres de solicitantes y el resto de campos retirados arriba | **NO, nunca** (`.gitignore`: `*.local.json`) — vive solo en la máquina del propietario |

La **reconciliación es idéntica** entre los dos archivos (202 total / 0
planificados / 202 en cuarentena / 2 colisiones, con la semilla provisional
de hoy): el planificador (`lib/migracion/planificar-importacion-consecutivo.ts`)
es el MISMO código para ambos, y ningún campo retirado en el sanitizado
participa en las decisiones de cuarentena por código (P1′) o estado (P4′) —
solo cambia si `RegistroEnCuarentena.solicitante` viene poblado (local) o
`undefined` (sanitizado); la puerta IDENTIDAD_INCOMPLETA ya bloqueaba el
100% de los registros por el lado del documento (que NUNCA existió en el
libro histórico, en ninguna versión) antes de esta remediación, así que el
resultado numérico del dry-run no cambió.

**Excepción declarada — datos de PREDIO (ago-2026, `mapearPredioHistorico`):**
`PlanImportacion.datosPredio` (conteos de `direccion`/`barrioVereda`/
`matricula`/`area` aprovechables + descartes) NO es idéntico entre los dos
archivos, a diferencia de la reconciliación general de arriba. Los cuatro
campos de predio están en la lista de columnas que el `.sanitizado.json`
retira a propósito (misma doctrina PII de esta sección) — así que contra
ESE archivo `datosPredio` siempre da **0** en los cuatro conteos "con..." y
en los tres motivos de descarte, sin excepción; solo contra el
`.local.json` (máquina del propietario) se ven los conteos reales: 0/202
con dirección aprovechable (las 54/202 que la traen valen literalmente
"SIMACOTA", el municipio, no una dirección — se descartan), 13/202 con
barrio/vereda, 11/202 con matrícula inmobiliaria válida, 5/202 con área
reconocible (11/202 más están en la columna "area" pero DESALINEADAS —
veredas o direcciones coladas ahí, reportadas en la sección "Datos de
predio" del reporte dry-run para que el ingeniero corrija su libro). Esto
es CORRECTO y ESPERADO, no una regresión de la doctrina de dos archivos:
verificado por
`__tests__/migracion-reconciliacion-snapshot-real.test.ts` ("datos de
predio contra el `.sanitizado.json`" corre SIEMPRE, sin el fallback de
archivo, para que la aserción "0 en CI" no dependa de qué snapshot usó el
resto de la suite).

### Nota R8 — datos personales (PII)

- **`*.local.json` JAMÁS se commitea.** Si alguna vez aparece en
  `git status` como candidato a versionar, es una señal de alarma — deténgase
  y revierta antes de cualquier `git add`/commit. Tampoco se copia fuera del
  circuito autorizado del proyecto (mensajería, correo, otro repositorio),
  con o sin control de versiones de por medio.
- **`*.sanitizado.json` sí se versiona** — es la fuente de verdad para CI y
  para cualquiera que necesite reproducir el dry-run sin acceso a datos
  personales.
- Los artefactos GENERADOS (`plan-importacion.generado.json`,
  `reporte-dry-run.generado.md`) **siguen gitignored** siempre, sea cual sea
  el snapshot de origen: en la máquina del propietario (con `.local.json`
  presente) SÍ contienen los mismos datos personales que ese archivo, así
  que sería un error tratarlos como seguros de commitear solo porque a veces
  se generan desde el sanitizado. Son reproducibles en cualquier momento con
  `planificarImportacion`/`generarReporteDryRun` — no aportan nada que el
  snapshot de origen no tenga ya.

### Cómo se usa

`lib/migracion/planificar-importacion-consecutivo.ts` (`planificarImportacion`)
consume el snapshot (cualquiera de los dos archivos — mismo tipo
`SnapshotConsecutivoLicencias`) y produce un `PlanImportacion` — PURO, sin
escribir nada. Dentro, `mapearPredioHistorico` decide campo por campo qué
datos de predio (dirección, barrio/vereda, matrícula, área) son
aprovechables sin inventar ni normalizar nada; ver su JSDoc y la excepción
declarada arriba para el detalle por archivo. `__tests__/migracion-reconciliacion-snapshot-real.test.ts` usa
`.local.json` si existe (máquina del propietario, para artefactos con
fidelidad completa antes de la reunión) y cae a `.sanitizado.json` en
cualquier otro entorno (CI, un clon nuevo). La escritura real (fuera del
alcance de este entregable: la EJECUCIÓN contra producción queda gated a
autorización expresa del propietario) la hace
`scripts/migracion/importar-consecutivo-licencias.mjs --ejecutar`.
