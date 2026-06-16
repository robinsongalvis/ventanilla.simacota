# Reportes MIPG — Ventanilla Única Digital
## Alcaldía Municipal de Simacota

**Clasificación:** Uso Institucional Interno · **Aplica desde:** 2026-06-15

> **Sprint Catálogo (2026-06-16):** las hojas Radicados y Diccionario de Datos
> incorporan los metadatos del catálogo institucional de tipos de solicitud
> (`lib/catalogos/tipos-solicitud.ts`): id, categoría, término, validación
> jurídica, herencia del sistema actual y, si aplica, el tipo original previo
> a la reclasificación interna. Ver `docs/CATALOGO_SOLICITUDES.md`.

> **Sprint Búsqueda Histórica (2026-06-16):** el botón **Exportar Excel MIPG**
> respeta los filtros activos de la **Búsqueda Histórica Avanzada**
> (`docs/BUSQUEDA_HISTORICA.md`). Cuando hay filtros, el Resumen Ejecutivo
> incluye una sección "Filtros aplicados" con la lista completa, y solo se
> exportan los radicados que cumplen los filtros y son visibles para el rol.

---

## 1. Qué entrega el módulo

Desde el dashboard interno, vista **Reportes MIPG**, el funcionario autorizado puede descargar dos artefactos:

| Botón | Archivo | Para qué |
|---|---|---|
| **Exportar Excel MIPG** (principal) | `Reporte_MIPG_Simacota_AAAA-MM-DD.xlsx` | Reporte institucional con 8 hojas, formato, filtros, freeze panes y semáforos. Pensado para Control Interno, Administración y rendición de cuentas. |
| **CSV técnico** (respaldo) | `MIPG_Radicados_AAAA-MM-DD.csv` | Volcado plano sin formato, útil para integraciones externas o respaldo. |

El Excel es el reporte oficial. El CSV se conserva solo como respaldo técnico.

---

## 2. Hojas del libro Excel

| # | Hoja | Contenido | Para qué |
|---|---|---|---|
| 1 | Resumen Ejecutivo | Datos de generación + 14 indicadores clave + conclusión automática | Vista de una página para director |
| 2 | Indicadores MIPG | Tabla con valor, fórmula, interpretación y estado (semáforo) por cada indicador | Evidencia auditable de cómo se calcula cada KPI |
| 3 | Radicados | Una fila por radicado, columnas operativas + bloque del catálogo (`Tipo Solicitud ID`, `Categoría Solicitud`, `Término Días`, `Tipo Días`, `Requiere Validación Jurídica`, `Heredado Sistema Actual`, `Tipo Reclasificado`, `Tipo Original`). NO incluye respuesta completa ni trazabilidad larga | Análisis maestro |
| 4 | Trazabilidad | Una fila por evento de auditoría de cada radicado | Línea de tiempo completa |
| 5 | Cumplimiento Dependencia | Agregado por secretaría: total, resueltos, vencidos, % cumplimiento | Comparación entre dependencias |
| 6 | Notificaciones | Eventos de correo: enviadas, fallidas, omitidas por idempotencia, gestionadas manualmente | Garantía de comunicación con el ciudadano |
| 7 | SIMI | Uso del asistente: usuario, rol, acción, evaluación de competencia, feedback útil/no | Trazabilidad del apoyo IA |
| 8 | Diccionario de Datos | Glosario de cada campo, fuente y uso MIPG | Comprensión y auditoría |

---

## 3. Indicadores y cómo interpretarlos

| Indicador | Fórmula | Estado |
|---|---|---|
| Total radicados | `count(visibles)` | Informativo |
| Tasa de resolución (%) | `(resueltos / total) × 100` | ≥ 80 verde · 60–79 ámbar · < 60 rojo |
| Cumplimiento de términos (%) | `(en_término / resueltos_con_dato) × 100` | ≥ 80 verde · 60–79 ámbar · < 60 rojo |
| Resueltos en término | `count(cumplioTermino == true)` | Siempre verde |
| Resueltos fuera de término | `count(cumplioTermino == false)` | 0 verde · > 0 rojo |
| Por vencer | `count(diasRestantes ≤ 2 && estado activo)` | 0 verde · > 0 ámbar |
| Vencidos | `count(diasRestantes < 0 && estado activo)` | 0 verde · > 0 rojo |
| Promedio días de respuesta | `avg(fechaResp − fechaRad)` para resueltos | Informativo |
| Radicados sin responsable | `count(activo && !funcionarioResponsable)` | 0 verde · > 0 ámbar |
| Notificaciones fallidas | `count(alertaNotificacionFallida == true)` | 0 verde · > 0 ámbar (gestionar por canal alterno) |
| Anónimos / Reservados | `count(esAnonimo || tipoPresentacion ∈ {ANONIMA, RESERVADA})` | Informativo |

El semáforo se aplica en la columna **Estado** de la hoja Indicadores MIPG y en la columna **Estado Término** de la hoja Radicados.

---

## 4. Filtros por rol

El reporte respeta los permisos del rol del usuario que lo descarga:

| Rol | Alcance |
|---|---|
| ADMIN | Todos los radicados |
| CONTROL_INTERNO | Todos los radicados |
| RECEPCIONISTA | Todos los radicados |
| FUNCIONARIO | Solo radicados de su dependencia (`tenantId`) |
| JEFE_DEPENDENCIA | Solo radicados de su dependencia (`tenantId`) |

La misma regla aplica a las hojas SIMI y Notificaciones, que filtran por `tenantId` cuando el usuario es FUNCIONARIO o JEFE_DEPENDENCIA.

---

## 5. Privacidad y datos sensibles

El reporte **nunca** expone:

- UID internos de funcionarios (Firebase Auth).
- `archivoPath` privado de Storage (solo el nombre del oficio cuando existe).
- Identidad del solicitante cuando `esAnonimo == true` o `tipoPresentacion ∈ {ANONIMA, RESERVADA}` o `identidadReservada == true`. En esos casos:
  - Solicitante → `Anónimo / Reservado`
  - Documento, correo, dirección → `No disponible`
- Respuesta oficial completa en la hoja Radicados (solo `Sí/No`). El texto vive en el documento del radicado y en la consulta pública sanitizada.
- Trazabilidad completa en la hoja Radicados (solo `Sí`/conteo). El detalle vive en la hoja Trazabilidad.

---

## 6. Diferencia Excel institucional vs CSV técnico

| Aspecto | Excel MIPG | CSV técnico |
|---|---|---|
| Hojas separadas | 8 hojas | 1 hoja única |
| Formato visual | Encabezados verdes, semáforos, filtros, freeze panes, wrap text | Texto plano |
| Privacidad | Sí (anónimos/reservados enmascarados, sin UID) | Sí |
| Trazabilidad | Hoja separada con una fila por evento | No (referencia a Firebase) |
| SIMI | Hoja con auditoría y feedback | No |
| Indicadores con fórmula | Sí | No (solo datos por radicado) |
| Tamaño | Más pesado pero usable | Liviano pero crudo |
| Apertura en Excel | Directa, con formato | Posible pero textos largos rompen filas |
| Para quién | Control Interno, Administración, rendición de cuentas | Integraciones externas, respaldo técnico |

---

## 7. Limitaciones conocidas

- **Gráficas reales**: la librería `exceljs` no genera gráficas nativas. La hoja Cumplimiento Dependencia entrega los datos listos para que el usuario inserte la gráfica desde Excel (`Insertar → Gráfica` sobre el rango). Si más adelante se requieren gráficas embebidas, se evaluará migrar a `xlsx-populate` o generar PDF con `puppeteer`.
- **SPF/DKIM en correos**: el reporte de notificaciones registra correos fallidos pero no diagnostica causa raíz; ver `docs/RUNBOOK_INCIDENTES_SMTP.md` para análisis de SPF/DKIM.
- **Rangos de fecha**: el endpoint actual exporta todos los radicados visibles al rol. Filtrado por rango es trivial de agregar en próxima iteración (campo `rangoFechas` ya está soportado por el composer).

---

## 8. Cómo abrir y usar el reporte

1. Vista **Reportes MIPG** → botón **Exportar Excel MIPG**.
2. Esperar 5–30 segundos (depende del volumen).
3. Abrir el archivo en Microsoft Excel, LibreOffice Calc o Google Sheets.
4. La hoja **Resumen Ejecutivo** queda al frente — léala primero.
5. Use los filtros (icono de embudo) en cada hoja para acotar por dependencia, estado, etc.
6. Las columnas largas tienen wrap text; haga doble clic en el borde para ajustar altura si necesita ver todo.

---

*Generado el 2026-06-15 · Sprint Reporte Excel MIPG Institucional · Ventanilla Única Digital · Alcaldía Municipal de Simacota, Santander, Colombia*
