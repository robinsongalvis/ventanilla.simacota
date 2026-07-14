# Matriz de Cobertura Funcional

Compara cada documento/procedimiento analizado contra la solución actual
(ADR-0017). Estados: **✅ Ya implementado** · **🟡 Implementado parcialmente** ·
**❌ No implementado** · **➖ No aplica para Simacota** · **🔎 Requiere validación
con la Alcaldía**. Cada fila referencia el ítem del Backlog Maestro cuando aplica.

> Alcance de esta versión: procedimientos P-GSC-170-001/014/007 y la planilla
> real de Simacota (leídos). Manuales M-002/M-004 y las 15 TRD: **pendientes**
> (PDF imagen, sin OCR en este entorno) — sus filas quedan marcadas.

## P-GSC-170-001 — Comunicaciones externas: ventanilla de correspondencia y PQRSD

| Aspecto funcional | Estado | Nota / Backlog |
|---|---|---|
| Radicación con número único + dependencia destino | ✅ | Radicación dirigida (destino desde el nacimiento) |
| Canales: web, presencial, verbal | ✅ | Web público + registro exprés + PQRSD verbal |
| Validar datos mínimos + medio de respuesta | ✅ | Formulario de radicación |
| Generar número de radicado | 🟡 / 🔎 | Formato divergente (año vs AAAAMM) → **BM-B01** |
| Imprimir el radicado en el documento físico (rótulo) | ❌ | **BM-B04** |
| Digitalizar el documento físico (imagen fiel) + cargar | 🟡 | Web adjunta; falta flujo físico → **BM-B03** |
| Clasificar por Secretaría/Oficina + casilleros | ➖ (casilleros) | Clasificación por destino ✅; casilleros físicos ➖ **BM-B13** |
| Imprimir planilla + entrega física (control) | 🟡 | Planilla de reparto ✅; columnas/ciclo → **BM-B06/B07** |
| Escanear la planilla firmada y subirla | 🟡 / 🔎 | → **BM-B06** |
| Devolución por no competencia (24 h, bloqueo posterior) | 🟡 | Devolución/traslado ✅; regla dura de 24 h ❌ → **BM-B05** |
| Reclasificación por la dependencia (Hacienda) | 🔎 | ¿lo cubre el traslado? → **BM-B11** |
| Seguimiento de vencimientos + comunicaciones + informes | ✅ | SIMI alertas + panel MIPG/KPIs |
| Respuesta por correo/módulo/físico según términos Ley 1755 | ✅ | Oficio + medio de respuesta |
| Términos ajustados por Decreto 396/2020 | 🔎 | Verificar → **BM-B12** |

## P-GSC-170-014 — PQRSD verbal (telefónico y presencial)

| Aspecto funcional | Estado | Nota / Backlog |
|---|---|---|
| Registrar PQRSD verbal especificando el medio | ✅ | PQRSD verbal (VERBAL_PRESENCIAL / VERBAL_TELEFONICO) |
| Asignar dependencia + generar radicado | ✅ | Radicación dirigida |
| Enviar el radicado al correo del ciudadano (si lo dio) | ✅ | Notificación al ciudadano |
| Comunicar verbalmente / entregar copia física si no hay correo | 🔎 | Verificar el caso "sin correo" (verbal/físico) |
| Marca de atención prioritaria | ❌ | **BM-B10** |

## P-GSC-170-007 — Contingencia por falla del sistema

| Aspecto funcional | Estado | Nota / Backlog |
|---|---|---|
| Procedimiento operativo de contingencia documentado | ✅ | `docs/CONTINGENCIA_OPERATIVA.md` |
| Formatos imprimibles (Solicitud PQRSD física, Registro de Incidentes) | ❌ | **BM-B09** |
| Radicación diferida: emitir el radicado al restablecer + avisar | ❌ | **BM-B08** |
| Registro de incidentes en el sistema | ❌ | **BM-B09** (parte) |
| Atención prioritaria en contingencia | ❌ | **BM-B10** |

## Planilla de entrega de correspondencia (F-GSC-8200-238-37-001, salida real de Simacota)

| Columna / campo | Estado | Nota / Backlog |
|---|---|---|
| No., Fecha/Hora de Radicado, Número de Radicado | ✅ / 🔎 | Formato del número → **BM-B01** |
| Dependencia Asignada | ✅ | |
| Área Asignada | 🟡 | Existe el concepto de área; validar que se imprime |
| Nombre del Solicitante Natural/Jurídica | ✅ | |
| Asunto (Tema/Asunto) | ✅ | |
| Dirección/Teléfonos | ✅ | |
| Nro. Folios | ✅ | |
| Anexos | 🟡 / 🔎 | Verificar la columna en el PDF de planilla → **BM-B07** |
| Fecha/Hora de Recibido | 🔎 | Control de recibido en la entrega → **BM-B07** |
| Devuelta SI/NO / Reasignada a | ❌ | **BM-B07** |
| Nombre y Firma (de quien recibe) + quien entrega | 🟡 / 🔎 | → **BM-B06/B07** |

## Documentos pendientes de lectura (no evaluados aún)

| Documento | Estado de análisis |
|---|---|
| M-GSC-8200-170-002 (Manual Ventanilla) | ⏳ Pendiente (PDF imagen, sin OCR) |
| M-GSC-8200-170-004 (Manual Comunicaciones int/ext) | ⏳ Pendiente (PDF imagen, sin OCR) |
| 15 TRD (100 Alcalde … 150 Agricultura) | ⏳ Pendiente (PDF imagen, sin OCR) → alimentan **BM-B02** |

Al leerlos (OCR / `poppler` / versiones texto), sus filas se completan y se
generan/actualizan los ítems del Backlog Maestro correspondientes, sin duplicar.
