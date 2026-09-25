# SIMI — Asistente Institucional Contextual
## Ventanilla Única Digital · Alcaldía de Simacota

**Versión:** SIMI-1  
**Modelo:** Gemini 2.5 Flash  
**API:** `POST /api/simi/radicado`

> **Sprint Catálogo (2026-06-16):** SIMI ahora recibe en su contexto el bloque
> del catálogo (`tipoSolicitudId`, `categoriaSolicitud`, `terminoDias`,
> `tipoDias`, `dependenciaSugeridaTipo`, `requiereValidacionJuridica`,
> `heredadoSistemaActual`). Si el tipo está marcado como heredado del sistema
> actual o requiere validación jurídica, SIMI emite la advertencia institucional
> *"Este tipo fue heredado del sistema actual y requiere validación
> jurídica/institucional antes de usarse como criterio definitivo."*

---

## Principio fundamental

```
SIMI sugiere. El funcionario revisa. El funcionario aprueba. El sistema registra.
```

SIMI no ejecuta acciones críticas automáticamente. No envía respuestas al ciudadano, no marca radicados como resueltos, no cambia dependencias sin confirmación humana.

---

## Acciones disponibles (SIMI-1)

| Acción | Descripción | Roles |
|---|---|---|
| `RESUMIR_RADICADO` | Resumen ejecutivo del caso | Todos |
| `EXPLICAR_ESTADO` | Significado del estado actual + acciones esperadas | Todos |
| `REVISAR_TERMINO` | Análisis de cumplimiento del término legal MIPG | Todos |
| `SUGERIR_DEPENDENCIA` | Recomienda dependencia basándose en el contenido | ADMIN, RECEPCIONISTA |
| `SUGERIR_RESPUESTA` | Borrador de respuesta para revisión del funcionario | ADMIN, FUNCIONARIO |
| `VALIDAR_RESPUESTA` | Revisa si un borrador cubre la solicitud del ciudadano | ADMIN, FUNCIONARIO |
| `GENERAR_BORRADOR_OFICIO` | Borrador de oficio formal con estructura institucional | ADMIN, FUNCIONARIO |
| `RESUMIR_TRAZABILIDAD` | Resumen cronológico de eventos del radicado | ADMIN, JEFE_DEP, CONTROL_INTERNO |

---

## Permisos por rol

| Rol | Accede a radicados de | Puede usar SIMI | Puede ejecutar acciones |
|---|---|---|---|
| ADMIN | Todos | Todas las acciones | Sí (con confirmación) |
| RECEPCIONISTA | Su tenant | Resumir, estado, término, sugerir dependencia | Sí (asignación) |
| FUNCIONARIO | Su tenant | Resumir, estado, término, respuesta, oficio, validar | Sí (resolución) |
| JEFE_DEPENDENCIA | Su tenant | Resumir, estado, término, trazabilidad | No (solo lectura) |
| CONTROL_INTERNO | Todos | Resumir, estado, término, trazabilidad | No (solo lectura) |

---

## Contexto que recibe SIMI

Para cada consulta, SIMI recibe:

- Datos del radicado (solicitante, asunto, descripción, estado, dependencia)
- Responsable funcional asignado
- Término legal (días restantes, vencimiento, prórrogas)
- Trazabilidad (hasta 20 eventos cronológicos)
- Archivos adjuntos (nombres, no contenido — SIMI-2)
- Rol y dependencia del usuario que consulta
- Respuesta oficial si existe

**No se envía:** secretos, variables de entorno, UIDs de Firebase, datos de otros radicados.

---

## Auditoría

Cada uso de SIMI se registra en `simi_auditoria/{eventoId}`:

```typescript
{
  actorUid:         string;
  actorNombre:      string;
  actorRol:         RolInterno;
  tenantId:         TenantId;
  radicadoId:       string;
  accion:           AccionSimi;
  fecha:            string;       // ISO
  modelo:           string;       // "gemini-2.5-flash"
  resultadoResumen: string;       // primeros 200 chars
}
```

---

## Reglas de seguridad

### Permitido
- Resumir, analizar, sugerir, generar borradores
- Indicar datos faltantes o inconsistencias
- Alertar sobre vencimientos o riesgos

### Prohibido
- Responder automáticamente al ciudadano
- Marcar radicados como resueltos
- Cambiar roles o dependencias
- Ocultar o borrar trazabilidad
- Inventar datos no presentes en el radicado

---

## Roadmap

| Sprint | Descripción |
|---|---|
| **SIMI-1** ✅ | Asistente contextual: 8 acciones, prompt institucional, auditoría |
| SIMI-2 | Extracción documental: lectura de PDFs, OCR, prellenado de campos |
| SIMI-3 | Clasificación inteligente: mejora del clasificador con feedback |
| SIMI-4 | Agente MIPG: análisis predictivo de cumplimiento por dependencia |

---

*Ventanilla Única Digital · Alcaldía de Simacota, Santander*
