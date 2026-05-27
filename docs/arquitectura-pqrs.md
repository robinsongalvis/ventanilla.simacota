# Arquitectura PQRS / Ventanilla Unica

## Colecciones Firestore

### `radicados/{radicadoId}`

Documento principal para consulta rapida de dashboard y detalle.

Campos principales:

- `radicadoId`: formato institucional `1-WEB-2026-00000047`.
- `estadoActual`: `PENDIENTE`, `ASIGNADO`, `EN_REVISION`, `EN_PROCESO`, `RESUELTO`, `DEVUELTO`, `RECHAZADO`, `PRORROGA`.
- `prioridad`: `ROJO`, `NARANJA`, `AMARILLO`.
- `solicitante`: datos normalizados de persona natural/juridica.
- `control`: consecutivo, fecha/hora, medio de recepcion y origen.
- `termino`: tipo de solicitud, dias, unidad y fecha de vencimiento.
- `clasificacion`: oficina destino, funcionario responsable y zona.
- `detalle`: asunto, descripcion, folios y anexos.
- `archivos`: metadatos de Firebase Storage.
- `trazabilidad`: copia corta de los ultimos eventos para pintar timeline rapido.

### `radicados/{radicadoId}/trazabilidad/{eventoId}`

Bitacora completa e inmutable. Cada accion operativa debe crear un evento:

- `RADICACION`
- `ASIGNACION`
- `TRASLADO`
- `DEVOLUCION`
- `PRORROGA`
- `RESPUESTA_FUNCIONARIO`
- `CAMBIO_ESTADO`

### `usuarios/{uid}`

Perfil interno enlazado con Firebase Auth.

- `nombre`
- `email`
- `rol`
- `tenantId`
- `activo`

### `counters/radicados-{year}`

Contador transaccional por vigencia para generar consecutivos institucionales.

- `ultimo`
- `anio`
- `actualizadoEn`

## Indices recomendados

- `radicados`: `clasificacion.oficinaDestino ASC`, `control.fechaRadicado DESC`.
- `radicados`: `estadoActual ASC`, `termino.fechaVencimiento ASC`.
- `radicados`: `control.medioRecepcion ASC`, `control.fechaRadicado DESC`.

## Storage

Ruta propuesta:

```text
radicados/{radicadoId}/{timestamp}_{nombreArchivo}
```

El documento guarda solo metadatos y `path`. La descarga se controla con reglas de Storage y/o URLs firmadas segun el rol.

