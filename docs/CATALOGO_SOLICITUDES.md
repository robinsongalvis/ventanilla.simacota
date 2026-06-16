# Catálogo institucional de tipos de solicitud

**Archivo fuente:** `lib/catalogos/tipos-solicitud.ts`
**Sprint:** Catálogo Institucional de Tipos de Solicitud (Sprint 1).

Este catálogo es la **fuente única de verdad** para los tipos de solicitud que tramita
la Ventanilla Única Digital de la Alcaldía Municipal de Simacota. Alimenta:

- Formulario ciudadano (`/radicacion`).
- Panel interno de Ventanilla (`/interno/recepcion`).
- Dashboard institucional (`/interno/dashboard`).
- Cálculo de fechas de vencimiento (`lib/tiempos-radicado.ts`).
- Reportes MIPG y libro Excel institucional (`lib/reportes-mipg/excel.ts`).
- Contexto de SIMI (`lib/simi/contexto-radicado.ts`).
- Consulta pública del radicado (`/consulta`).

## Estructura de un tipo

```ts
interface TipoSolicitudCatalogo {
  id: string;
  nombre: string;
  nombreCorto: string;
  categoria: 'PQRSD' | 'TRAMITE' | 'INTERNO' | 'ESPECIAL';
  terminoDias: number;
  tipoDias: 'HABILES' | 'CALENDARIO';
  visibleCiudadano: boolean;
  visibleInterno: boolean;
  permiteAnonimo: boolean;
  requiereAnexo?: boolean;
  dependenciaSugerida?: TenantId;
  descripcion: string;
  fundamento?: string;
  activo: boolean;
  requiereValidacionJuridica?: boolean;
  heredadoSistemaActual?: boolean;
  prioridadSugerida?: 'ROJO' | 'NARANJA' | 'AMARILLO';
}
```

## Tipos visibles al ciudadano

Solo aparecen en `/radicacion`. Son los tipos PQRSD básicos amparados por Ley 1755/2015.

| ID                    | Nombre                                  | Término       |
|-----------------------|-----------------------------------------|---------------|
| PETICION_GENERAL      | Petición general                        | 15 hábiles    |
| PETICION_INFORMACION  | Petición de información                 | 10 hábiles    |
| PETICION_DOCUMENTOS   | Petición de documentos                  | 10 hábiles    |
| CONSULTA              | Petición para elevar una consulta       | 30 hábiles    |
| QUEJA                 | Queja                                   | 15 hábiles    |
| RECLAMO               | Reclamo                                 | 15 hábiles    |
| SUGERENCIA            | Sugerencia                              | 15 hábiles    |
| FELICITACION          | Felicitación                            | 15 hábiles    |
| DENUNCIA              | Denuncia                                | 15 hábiles    |
| HABEAS_DATA           | Solicitud de datos personales           | 10 hábiles    |

## Tipos internos

Solo aparecen en panel interno de Ventanilla. **No** se muestran al ciudadano.

| ID                              | Nombre                                  | Término         | Validación jurídica |
|---------------------------------|-----------------------------------------|-----------------|---------------------|
| DECLARACION_RETENCION_ICA       | Declaración Retención ICA               | 15 hábiles      | Sí                  |
| INFORMATIVO                     | Informativo                             | 10 calendario   | —                   |
| INVITACION                      | Invitación                              | 15 calendario   | —                   |
| LICENCIA_CONSTRUCCION           | Licencia de construcción                | 45 hábiles      | Sí                  |
| PERMISO_ESTABLECIMIENTO_PUBLICO | Permiso establecimientos públicos       | 15 hábiles      | —                   |
| PETICION_INFORMACION_CORTA      | Petición de información (término corto) | 5 hábiles       | Sí                  |
| PETICION_ENTES_CONTROL          | Petición entes de control               | 5 hábiles       | Sí                  |
| PETICION_ENTRE_AUTORIDADES      | Petición entre autoridades              | 15 hábiles      | —                   |
| QUERELLA                        | Querella                                | 5 hábiles       | Sí                  |
| RESPUESTA_A_SOLICITUD           | Respuesta a solicitud                   | 15 hábiles      | —                   |
| SOLICITUD_SUBDIVISION           | Solicitud de subdivisión                | 45 hábiles      | Sí                  |
| SOLICITUD_SAC                   | Solicitud SAC                           | 15 hábiles      | —                   |
| URGENTE                         | Urgente                                 | 2 hábiles       | Sí                  |

## Reclasificación interna

Solo **RECEPCIONISTA** y **ADMIN** pueden reclasificar el tipo de solicitud de un radicado.
Cada reclasificación:

- Persiste el tipo anterior y el nuevo.
- Recalcula la fecha de vencimiento usando `calcularFechaVencimiento`.
- Emite un evento `TIPO_SOLICITUD_RECLASIFICADO` en la subcolección de trazabilidad.
- Devuelve `advertenciaTerminoMenor = true` si el nuevo término en días hábiles es menor
  al anterior, para que la UI lo muestre al usuario.

Endpoint: `POST /api/radicados/:radicadoId/reclasificar`.

Helper cliente: `lib/actions/reclasificarTipoSolicitud.ts`.

## Helpers públicos

`lib/catalogos/tipos-solicitud.ts` exporta:

- `getTipoSolicitudById(id)`
- `getTiposSolicitudCiudadano()`
- `getTiposSolicitudInternos()`
- `getTiposSolicitudActivos()`
- `getTerminoTipoSolicitud(id)`
- `esTipoSolicitudInterno(id)`
- `requiereValidacionJuridica(id)`
- `getLabelTipoSolicitud(id)`
- `getLabelInternoTipoSolicitud(id)`

## Cálculo de términos

`lib/tiempos-radicado.ts::calcularFechaVencimiento(fecha, tipoSolicitudId)`:

- Si `tipoDias = HABILES` → cuenta días hábiles colombianos (sin fines de semana ni
  festivos, según `festivosColombia(year)`).
- Si `tipoDias = CALENDARIO` → suma días calendario.
- Si el tipo no existe en el catálogo → fallback a `PETICION_GENERAL` (15 hábiles).

## Alias legacy

Para no romper documentos radicados antes del Sprint:

| ID legacy             | Nuevo                       |
|-----------------------|-----------------------------|
| PETICION              | PETICION_GENERAL            |
| PETICION_AUTORIDADES  | CONSULTA                    |
| ENTES_CONTROL_URGENTE | PETICION_ENTES_CONTROL      |

El resolver `resolverTipoSolicitud(id)` los traduce automáticamente en lectura.

## Marcado de tipos heredados y validación jurídica

Todo tipo tomado del sistema actual lleva:

```ts
heredadoSistemaActual: true,
fundamento: 'Tipo heredado del sistema actual. Validar jurídicamente/institucionalmente antes de go-live oficial.'
```

Los tipos que requieren visto bueno jurídico antes de operar tienen también
`requiereValidacionJuridica: true`. El panel interno y SIMI exhiben una advertencia
visible cuando se selecciona alguno de estos tipos.
