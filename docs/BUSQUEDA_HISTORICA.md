# Búsqueda Histórica Avanzada de Radicados

**Sprint:** 2 · **Estado:** Operativo en preoperación controlada.

La Ventanilla Única Digital permite encontrar radicados antiguos (semanas, meses
o años) usando filtros combinables, paginación y exportación a Excel MIPG.

## Acceso

Desde el dashboard interno, sobre la tabla maestra de radicados, se expone el
botón **Filtros avanzados**. El botón aparece para todos los roles internos. La
visibilidad del resultado depende del rol.

## Filtros disponibles

| Filtro | Campo | Comportamiento |
|---|---|---|
| Búsqueda rápida | `q` | Coincidencia parcial en radicado, asunto, tipo, dependencia, responsable, solicitante, documento y correo. |
| Número de radicado | `radicadoId` | Coincidencia exacta o parcial. Si la cadena tiene formato `N-CANAL-AAAA-XXXXX` se prioriza la coincidencia exacta. |
| Solicitante | `nombre` | Texto. Bloqueado en radicados anónimos/reservados. |
| Documento | `documento` | Texto. Bloqueado en anónimos/reservados. |
| Correo | `correo` | Texto. Bloqueado en anónimos/reservados. |
| Asunto | `asunto` | Texto en `detalle.asunto`. |
| Tipo de solicitud | `tipoSolicitudId` | Selecciona desde el catálogo central (`lib/catalogos/tipos-solicitud.ts`). |
| Categoría | `categoria` | PQRSD · TRAMITE · INTERNO · ESPECIAL. |
| Dependencia | `dependencia` | TenantId. |
| Responsable | `responsable` | Nombre snapshot MIPG-2. |
| Estado | `estado` | PENDIENTE · EN_REVISION · ASIGNADO · EN_PROCESO · PRORROGA · RESUELTO · DEVUELTO · RECHAZADO. |
| Fecha desde / hasta | `fechaDesde` / `fechaHasta` | ISO `YYYY-MM-DD`. La fecha hasta incluye todo el día. |
| Mes / Año | `mes` / `anio` | 1..12 / cuatro dígitos. |
| Canal respuesta | `canalRespuesta` | CORREO · TELEFONO · PRESENCIAL · DIRECCION_FISICA. |
| Anónimo | `anonimo` | `esAnonimo === true` o `tipoPresentacion === ANONIMA`. |
| Reservado | `reservado` | `identidadReservada === true` o `tipoPresentacion === RESERVADA`. |
| Cumplió término | `cumplioTermino` | `true` / `false`. |
| Notificación fallida | `conNotificacionFallida` | `alertaNotificacionFallida === true`. |
| Con respuesta oficial | `conRespuestaOficial` | Existe `respuestaOficial.fecha`. |

## Presets de rango de fechas

- **Hoy**
- **Esta semana** (lunes → hoy)
- **Este mes**
- **Mes anterior**
- **Año actual**
- **Personalizado** (desde/hasta libres)

## Permisos por rol

| Rol | Alcance |
|---|---|
| ADMIN | Todo el histórico. |
| CONTROL_INTERNO | Todo el histórico. |
| RECEPCIONISTA | Todo el histórico. |
| FUNCIONARIO | Solo radicados con `clasificacion.oficinaDestino === user.tenantId`. |
| JEFE_DEPENDENCIA | Solo radicados con `clasificacion.oficinaDestino === user.tenantId`. |

El filtrado server-side por dependencia usa el índice compuesto
`clasificacion.oficinaDestino + control.fechaRadicado desc`.

## Privacidad

El endpoint sanitiza la respuesta antes de devolverla al cliente:

- Anónimos/Reservados: `nombreCompleto` → `"Anónimo / Reservado"`, documento
  enmascarado, correo/teléfono/dirección reemplazados por `null`.
- Se elimina `clasificacion.funcionarioResponsableUid` (no se expone UID).
- Se elimina `respuestaOficial.archivoPath` (ruta privada de Storage). El nombre
  del oficio sí puede mostrarse.

## Endpoint

```
POST /api/radicados/busqueda-avanzada
Content-Type: application/json
Cookie: __session=...
{
  "filtros": { ... },
  "page": 1,
  "pageSize": 25
}
```

Respuesta:

```json
{
  "items": [VentanillaRadicado, ...],
  "total": 142,
  "page": 1,
  "pageSize": 25,
  "totalPaginas": 6,
  "filtrosAplicados": { ... }
}
```

Errores `401 / 403` cuando la sesión es inválida. Errores `500` al fallo de
Firestore (registrados en logs).

## Chips de filtros activos

El panel muestra cada filtro activo como chip. Cada chip permite removerse
individualmente. El botón **Limpiar filtros** vacía todo el formulario.

## Exportación Excel filtrada

Cuando el usuario presiona **Exportar Excel filtrado**, se llama al endpoint
`POST /api/reportes/mipg/excel` con el mismo `filtros`. El libro resultante:

1. Contiene solo los radicados visibles para el rol que pasan los filtros.
2. Agrega al **Resumen Ejecutivo** una sección "Filtros aplicados" con la lista
   completa para evidencia MIPG.

## Índices Firestore

`firestore.indexes.json` declara:

- `control.fechaRadicado desc`
- `clasificacion.oficinaDestino + control.fechaRadicado desc`
- `estadoActual + control.fechaRadicado desc`
- `termino.tipoSolicitudId + control.fechaRadicado desc`
- `cumplioTermino + control.fechaRadicado desc`

Despliegue:

```bash
firebase deploy --only firestore:indexes
```

Si Firebase pide índices adicionales (por nuevas combinaciones del cliente),
agregarlos al archivo y volver a desplegar.

## Tests

`__tests__/busqueda-avanzada.test.ts` cubre los 12 casos del Sprint + extras
(notificación fallida, respuesta oficial, mes/año, presets).
