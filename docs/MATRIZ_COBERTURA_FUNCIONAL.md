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

## M-GSC-8200-170-002 — Manual Ventanilla de Correspondencia (ejercicio inverso)

| Capacidad del software | Estado | Nota / Backlog |
|---|---|---|
| Login con usuario de dominio institucional | ✅ | Auth interna |
| Radicado automático | ✅ | |
| Radicado pre-generado externo (máquina/reloj) | ❌ | **BM-B14** |
| Catálogo de tipos (incl. felicitación, denuncia anticorrupción, queja anónima) | 🔎 | **BM-B16** |
| Días hábiles por tipo + override manual del término | 🟡 | Cálculo ✅; override ❌ → **BM-B15** |
| Consultar persona por cédula (solicitante frecuente) | ✅ | |
| "No aporta información" | ✅ | datosNoAportados |
| Campos (asunto, teléfonos, dirección, email, ubicación, folios, anexos) | ✅ | |
| Modo de respuesta (correo / dirección / consulta en sitio) | ✅ | |
| Asignar dependencia + funcionario + comentarios de asignación | 🟡 | Asignación ✅; comentarios 🔎 |
| Comprobante imprimible (radicado + URL de consulta + usuario) | ✅ | Constancia |
| Correo interno "Asignación de solicitud" a la dependencia | ❌ | **BM-B17** |
| Adjuntar la solicitud escaneada al radicado | 🟡 | → **BM-B03** |
| Correo automático al ciudadano con los datos del registro | ✅ | Notificación |
| Generar planilla de reparto (PDF, número único, por dependencia/área) | ✅ | |
| Alerta de radicados sin planilla | ❌ | **BM-B19** |
| Registrar entrega (fecha/hora/quién recibe) + planilla firmada escaneada | 🟡 | → **BM-B06/B18** |
| Admin planillas: reimprimir, descargar firmada, **anular** | 🟡 | → **BM-B18** |
| Consulta de la solicitud por número + imprimir datos (PDF) | ✅ | |

## M-GSC-8200-170-004 — Comunicaciones Internas y Externas (ejercicio inverso)

| Capacidad del software | Estado | Nota / Backlog |
|---|---|---|
| Bandeja "Mis solicitudes asignadas" (Asignadas/Por vencer/Vencidas) | ✅ | Mi Gestión + semáforos |
| Bandeja "Recibidas" con 6 alertas: **Prioridad**, Radicados, **Sin Término**, Por Vencer, Vencidas, **Devueltas** | 🟡 | Semáforos ✅; Prioridad/Sin Término/Devueltas → **BM-B25/B24/B26** |
| Exportar a Excel la lista de solicitudes | ✅ | Reportes |
| Detalle: info + digitalizada / trazabilidad / anexos / **observaciones** / responder-devolver / prórroga | 🟡 | Casi todo ✅; pestaña Observaciones → **BM-B29** |
| Responder (envía al correo + adjunto; cierra la solicitud) | ✅ | |
| Devolver por no competencia con observación | ✅ | Devolución |
| Registrar prórroga | ✅ | |
| **Módulo de Comunicaciones Internas** (solicitud/respuesta/circular/informativo) | ❌ | **BM-B20** (mayor vacío) |
| Destino Interno (dependencias) / Externo (personas) | 🟡 | Externo ✅; interno inter-dependencias ❌ → **BM-B20** |
| Consecutivos por dependencia + serie propia de circulares | ❌ | **BM-B21** |
| Envío de copias (CC) a otras dependencias | ❌ | **BM-B22** |
| Selección del jefe firmante | 🟡 | Existe para respuestas SIMI → **BM-B23** |
| Medio de radicado (Oficio/Web/Email/Teléfono) | 🔎 | → **BM-B27** |
| Ayuda in-app (video tutoriales + infografía) | ❌ | **BM-B28** |

## P-GSC-170-003 — Gestión de Comunicaciones Internas y/o Externas

| Aspecto funcional | Estado | Nota / Backlog |
|---|---|---|
| Generar comunicación interna/externa con consecutivo GSC | ❌ | **BM-B20/B21** |
| Redactar con base en las TRD | ❌ | liga **BM-B02 ↔ BM-B20** |
| Sección "Cuerpo" (redactar) + adjuntos | ❌ | **BM-B20** |
| Circuito de firma: "Comunicaciones por firmar" → revisar → **Corregir/Firmar** | 🟡 | Existe para respuestas SIMI → **BM-B23** |
| Firma física (imprimir/firmar/escanear/cargar) vs electrónica | 🟡 | Salidas con PDF ✅; internas ❌ → **BM-B23** |
| Catálogo de cargos autorizados para firmar | ❌ | **BM-B31** (G-GSC-170-003 no entregado) |
| Copia a líder / "todos" | ❌ | **BM-B22** |

## Documentos referenciados en el corpus pero NO entregados

| Documento | Relevancia | Backlog |
|---|---|---|
| G-GSC-8200-170-003 Guía de cargos autorizados para firmar | Alta | BM-B31/B23 |
| M-GSC-8200-170-003 Manual Gestión del Servicio | Media | — |
| PO-GSC-8200-170-001 Política de PQRSD | Media | — |
| P-GFP-3100-170-039 Clasificar PQRSD de Hacienda | Baja | BM-B11 |
| NORMOGRAMA F-MC-1000-238,37-020 | Media (normativa) | varios |
| Formatos F-GSC-238-37-002/006/007/017/018 | Media | BM-B08/B09/B10 |

## TRD (10 archivos: 100 Alcalde … 150 Agricultura)

| Aspecto | Estado | Nota / Backlog |
|---|---|---|
| Clasificación por serie/subserie documental por dependencia | ❌ | **BM-B02** |
| Retención (gestión/central) y disposición final (CT/E/M/S) | ❌ | **BM-B02** |

## Estado del análisis
Todos los documentos compartidos fueron **leídos en su totalidad** (texto
extraído con `pymupdf`; se resolvió la limitación previa de renderizado). Ningún
documento quedó por fuera del benchmarking por causas técnicas. El único detalle
diferido es el desglose serie-por-serie de las TRD, que se hará al scopear
**BM-B02** (estructura ya confirmada).
