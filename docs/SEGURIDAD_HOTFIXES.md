# Bitácora de hotfixes de seguridad

Este documento registra las correcciones aplicadas a los hallazgos del informe
[Auditoría integral](AUDITORIA_SEGURIDAD_DATOS_ESCALABILIDAD.md). Sirve como
historial vivo del avance hacia el go-live.

---

## H-01 — Descarga de adjuntos protegida por rol y dependencia

**Estado:** ✅ Corregido — Sprint Seguridad P1-01.
**Severidad original:** P1 — Alto.
**Archivos:**
- `lib/seguridad/autorizar-descarga-archivo.ts` *(nuevo, helper puro)*
- `app/api/interno/archivo/route.ts` *(reescrito)*
- `__tests__/autorizar-descarga-archivo.test.ts` *(nuevo)*

### Qué se hizo

Se agregó validación de **pertenencia del archivo al radicado** y **control de
acceso por rol y dependencia** antes de generar URL firmada de descarga.

Cadena de validaciones aplicada por el endpoint:

1. **Sesión interna activa** vía `requireActiveInternalUser()` (cookie + revocación + usuario activo).
2. **Path estructuralmente válido** (prefijo permitido — `radicados/` o
   `respuestas/` — sin `..`, sin `/` inicial, sin doble barra, sin caracteres
   de control, alfabeto restringido).
3. **Identificación del radicado** a partir del path y lectura del documento en
   `ventanilla_radicados/{id}`.
4. **Pertenencia del archivo al radicado**:
   - Para `radicados/...` debe aparecer en `radicado.archivos[].path`.
   - Para `respuestas/...` debe coincidir con `radicado.respuestaOficial.archivoPath`.
5. **Permiso institucional**:
   - `ADMIN`, `RECEPCIONISTA`, `CONTROL_INTERNO` → acceso global.
   - `FUNCIONARIO`, `JEFE_DEPENDENCIA` → solo si
     `usuario.tenantId === radicado.clasificacion.oficinaDestino`.
6. **Firma de URL** (TTL 15 min) **solo** si todas las validaciones pasan.

### Respuestas humanas y seguras

| Código | Cuándo | Mensaje |
|--------|--------|---------|
| `400` | Path vacío, no string, con `..`, prefijo no permitido, etc. | `La ruta del archivo no es válida.` |
| `401` | Sin sesión o sesión expirada | `Debe iniciar sesión nuevamente.` |
| `403` | Funcionario/Jefe de otra dependencia | `No tiene permiso para descargar este archivo.` |
| `404` | Radicado inexistente **o** archivo no registrado en el radicado (mensaje uniforme para no revelar existencia) | `Archivo no encontrado.` |
| `500` | Falla interna | `No fue posible generar la descarga. Intente nuevamente.` |

Nunca se devuelve: el `path` completo, el `bucket`, stack traces ni UIDs.

### Auditoría / trazabilidad

Cada decisión queda en consola estructurada:

- `ARCHIVO_DESCARGA_AUTORIZADA` — `console.info` con
  `{ radicadoId, tipo, actorRol, actorTenant, timestamp }`.
- `ARCHIVO_DESCARGA_DENEGADA` — `console.warn` con
  `{ radicadoId, motivo, actorRol, actorTenant, prefijo, timestamp }`.

No se registra la URL firmada, el path completo ni datos personales.

### Tests

`__tests__/autorizar-descarga-archivo.test.ts` cubre los 13 casos exigidos:

1. ADMIN descarga cualquier dependencia.
2. RECEPCIONISTA descarga cualquier dependencia.
3. CONTROL_INTERNO descarga cualquier dependencia.
4. FUNCIONARIO descarga su dependencia.
5. FUNCIONARIO **no** descarga otra dependencia (403, sin filtrar path).
6. JEFE_DEPENDENCIA descarga su dependencia.
7. JEFE_DEPENDENCIA **no** descarga otra dependencia (403).
8. Sin sesión → 401.
9. Path vacío/inválido → 400.
10. Path con `../` → 400, mensaje sin filtrar detalle.
11. Path no registrado en el radicado → 404 con mensaje uniforme.
12. Respuesta oficial solo si coincide con `archivoPath`.
13. Mensajes de error sin path, sin bucket, sin stack.

Más casos extra: parser rechaza prefijos no permitidos, doble barra,
segmentos extra y caracteres de control; helper `aRadicadoParaDescarga`
extrae adjuntos válidos del documento de Firestore.

### Resumen ejecutivo

> Se agregó validación de pertenencia del archivo al radicado y control de
> acceso por rol/dependencia antes de generar URL firmada. Un funcionario
> de una dependencia ya no puede descargar adjuntos de otra dependencia ni
> de solicitudes anónimas o reservadas que no le correspondan.
