# Guía de Usuario — Ventanilla Única Digital
## Alcaldía Municipal de Simacota, Santander

**Versión:** 1.0  
**Sistema:** https://ventanilla-simacota.vercel.app

---

## Acceso al sistema

1. Abrir el navegador (Google Chrome recomendado).
2. Ir a: `https://ventanilla-simacota.vercel.app/interno/login`
3. Iniciar sesión con el correo y contraseña asignados por el administrador.
4. El sistema lo redirige al Dashboard según su rol.

---

## Rol: RECEPCIONISTA

**Función:** Recibir solicitudes ciudadanas y asignarlas a la dependencia competente.

### Radicar una solicitud

1. En el menú lateral, hacer clic en **Radicación**.
2. Llenar el formulario:
   - Datos del solicitante (nombre, documento, email, teléfono).
   - Tipo de solicitud (Petición, Informativo, etc.).
   - Asunto y descripción del caso.
   - Adjuntar documentos si los hay (PDF o imagen, máx. 10 MB).
3. Hacer clic en **Radicar**.
4. El sistema genera automáticamente un número de radicado (ej: `1-WEB-2026-00000047`).
5. Entregar o comunicar este número al ciudadano.

### Asignar un radicado

1. En el **Tablero**, hacer clic sobre el radicado a asignar.
2. En el panel derecho, ir a la pestaña **Traslado / Asignación**.
3. Seleccionar la **dependencia destino**.
4. Seleccionar el **funcionario responsable** del listado.
5. Hacer clic en **Confirmar traslado**.
6. El radicado cambia a estado **Asignado** y el funcionario lo verá en su bandeja.

### Asignación masiva

1. En la vista **Bandeja de asignación**, marcar las casillas de los radicados a asignar.
2. Seleccionar la dependencia destino.
3. Hacer clic en **Asignar seleccionados**.

---

## Rol: FUNCIONARIO

**Función:** Atender solicitudes asignadas a su dependencia y dar respuesta al ciudadano.

### Ver radicados asignados

1. Al ingresar, el Dashboard muestra solo los radicados de su dependencia.
2. Los semáforos de color indican el estado del término:
   - **Verde:** En término (más de 2 días).
   - **Amarillo:** Próximo a vencer (0-2 días).
   - **Rojo:** Vencido.
3. Usar las tarjetas superiores para filtrar: Todos, Asignadas, Por Vencer, Vencidas, etc.

### Responder un radicado

1. Hacer clic sobre el radicado en la tabla.
2. En el panel derecho, ir a la pestaña **Prórroga / Resp.**
3. Escribir la respuesta (mínimo 10 caracteres).
4. Si corresponde, adjuntar el **oficio PDF firmado** (máx. 10 MB).
5. Hacer clic en **Marcar como resuelto**.
6. El sistema:
   - Guarda la respuesta en Firestore.
   - Registra `cumplioTermino` (si fue a tiempo o no).
   - Envía email automático al ciudadano (si tiene email).
   - Registra el evento en la trazabilidad.

### Solicitar prórroga

1. En la pestaña **Prórroga / Resp.**, escribir el motivo (mín. 5 caracteres).
2. Seleccionar los días de prórroga.
3. Hacer clic en **Aplicar prórroga**.
4. La nueva fecha de vencimiento se actualiza automáticamente.

### Devolver un radicado

1. En la pestaña **Prórroga / Resp.**, escribir el motivo de devolución (mín. 10 caracteres).
2. Hacer clic en **Devolver**.
3. El radicado queda en estado **Devuelto** — requiere acción del ciudadano.

---

## Rol: JEFE DE DEPENDENCIA

**Función:** Supervisar el estado de los radicados de su dependencia. **Solo lectura.**

### Qué puede hacer

- Ver todos los radicados asignados a su dependencia.
- Ver el detalle completo: solicitante, asunto, responsable, trazabilidad.
- Ver los semáforos de cumplimiento.
- Filtrar por estado: En término, Por vencer, Vencidas, etc.
- Ver la vista de Analytics con métricas de su dependencia.
- Ver las Alertas predictivas.

### Qué NO puede hacer

- No puede asignar, trasladar, responder, devolver ni prorrogar radicados.
- Los botones de acción aparecen deshabilitados con el mensaje: *"Tu rol no permite realizar acciones sobre radicados."*

---

## Rol: CONTROL INTERNO

**Función:** Auditar el cumplimiento MIPG de todas las dependencias. **Solo lectura global.**

### Qué puede hacer

- Ver **todos los radicados de todas las dependencias** (visibilidad global).
- Filtrar por dependencia usando el selector de tenant.
- Ver métricas globales:
  - Tasa de resolución.
  - Tasa de cumplimiento de términos (MIPG Req. 8).
  - Radicados vencidos por dependencia.
  - Tiempo promedio de respuesta.
- Ver los semáforos de cumplimiento de cada radicado.
- **Exportar CSV MIPG** con las 25 columnas auditoriables.
- Ver la vista de Alertas (radicados críticos con severity score).
- Ver la trazabilidad completa de cada radicado (pestaña Trazabilidad MIPG).

### Exportar reporte MIPG

1. En el menú lateral, hacer clic en **Reportes**.
2. Hacer clic en el botón **Exportar CSV MIPG**.
3. Se descarga un archivo `MIPG_Radicados_YYYY-MM-DD.csv`.
4. Abrir en Excel — el archivo usa UTF-8 con BOM (tildes y ñ correctos).
5. El CSV tiene 25 columnas que cubren los 8 requisitos de trazabilidad MIPG.

### Qué NO puede hacer

- No puede modificar ningún radicado, asignar, responder ni trasladar.

---

## Rol: ADMIN

**Función:** Gestión completa del sistema. Todas las acciones disponibles para todos los tenants.

Tiene acceso a todo lo que puede hacer RECEPCIONISTA + FUNCIONARIO + CONTROL_INTERNO, más:
- Selector de dependencia global (puede ver y actuar en cualquier tenant).
- Gestión de usuarios (Firebase Console).
- Vista de Supervisión IA (calidad de clasificación).

---

## Consulta ciudadana (sin cuenta)

El ciudadano puede consultar el estado de su solicitud sin necesidad de crear cuenta:

1. Ir a: `https://ventanilla-simacota.vercel.app/consulta`
2. Ingresar el número de radicado (ej: `1-WEB-2026-00000047`).
3. Hacer clic en **Consultar**.
4. El sistema muestra:
   - Estado actual (Pendiente, Asignado, En proceso, Resuelto, etc.).
   - Dependencia asignada con datos de contacto.
   - Historial de eventos en lenguaje ciudadano.

**Nota:** Solo se muestra información pública. Datos internos como notas del funcionario, responsable asignado o clasificación IA no son visibles para el ciudadano.

---

## Notificación por email

Cuando un funcionario marca un radicado como **Resuelto**, el sistema envía automáticamente un email al ciudadano (si proporcionó su correo al radicar):

- Asunto: *"Su solicitud [número] ha sido respondida – Alcaldía de Simacota"*
- Contenido: estado resuelto, respuesta del funcionario, datos de contacto de la dependencia.
- Si se adjuntó un oficio, el email indica que el documento está disponible.

El ciudadano puede responder directamente al correo de la dependencia.

---

## Semáforos de cumplimiento

Cada radicado muestra un indicador visual de cumplimiento de término legal:

| Color | Significado | Acción requerida |
|---|---|---|
| 🟢 Verde | En término (> 2 días) | Normal — atender según prioridad |
| 🟡 Amarillo | Próximo a vencer (0-2 días) | Urgente — priorizar respuesta |
| 🔴 Rojo | Vencido | Crítico — responder de inmediato |
| ⚪ Gris | Resuelto | Cerrado — no requiere acción |
| 🩷 Rosa | Resuelto fuera de término | Cerrado — registrado como incumplimiento |

---

## Glosario

| Término | Significado |
|---|---|
| **Radicado** | Solicitud ciudadana registrada formalmente con número único |
| **MIPG** | Modelo Integrado de Planeación y Gestión del DAFP |
| **Tenant** | Dependencia de la Alcaldía (Secretaría, Inspección, etc.) |
| **Trazabilidad** | Registro inmutable de todas las acciones sobre un radicado |
| **Cumplió término** | Si la respuesta se dio dentro del plazo legal establecido |
| **Prórroga** | Extensión del plazo legal, justificada y registrada |
| **Oficio** | Documento PDF firmado adjunto a la respuesta oficial |

---

*Alcaldía Municipal de Simacota · Santander · Sistema de Ventanilla Única Digital*
