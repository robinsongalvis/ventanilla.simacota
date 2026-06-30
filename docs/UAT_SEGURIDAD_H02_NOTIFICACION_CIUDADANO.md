# UAT Seguridad H-02 — Notificación al ciudadano

**Hallazgo:** H-02 — `/api/interno/notificar-ciudadano` aceptaba destinatario y
contenido provistos por el cliente; el endpoint debe tomar todo del radicado y
validar rol más dependencia.

**Severidad original:** P1 — Alto (control de acceso / correo).

**Estado:** Pendiente de ejecución y aprobación funcional.

**Entorno autorizado:** local o Preview. **No ejecutar en producción.**

**Referencia técnica:**
- `app/api/interno/notificar-ciudadano/route.ts`
- `lib/seguridad/autorizar-notificacion-ciudadano.ts`
- `lib/email/mailer.ts`, `lib/email/templates/respuesta-ciudadano.ts`
- `lib/email/debe-notificar-ciudadano.ts`
- Pruebas: `__tests__/autorizar-notificacion-ciudadano.test.ts`

---

## 1. Objetivo

Verificar en ambiente Preview que la notificación al ciudadano cumple los
controles introducidos para cerrar H-02:

- Sólo roles autorizados pueden disparar el envío.
- `FUNCIONARIO` queda restringido a su dependencia.
- El destinatario, asunto, cuerpo HTML y `replyTo` se construyen siempre desde
  el servidor a partir del radicado y del directorio de dependencias, nunca
  desde el cliente.
- Anónimos, reservados o sin correo válido no generan correo.
- La auditoría y la trazabilidad no almacenan PII del destinatario ni el cuerpo
  del correo.
- Los mensajes de error al cliente son genéricos y no revelan stack, SMTP ni
  el correo destino.

---

## 2. Alcance

- Endpoint `POST /api/interno/notificar-ciudadano`.
- Acciones `RESPUESTA_OFICIAL` y `REINTENTO_NOTIFICACION` (ambas comparten
  autorización).
- Persistencia colateral: subcolección `ventanilla_radicados/{id}/trazabilidad`
  y colección `seguridad_notificaciones_auditoria`.
- Marca `alertaNotificacionFallida` en el documento del radicado cuando SMTP
  falla.

Fuera de alcance:

- Flujos legacy `respuestaOficial` desde la consola interna que NO usan este
  endpoint.
- Cron de alertas (cubierto por la UAT de H-05).
- Notificación de cambio de estado (cubierta por otra UAT).

---

## 3. Entorno autorizado

| Aspecto | Valor |
|---|---|
| Ambiente | Preview de Vercel del PR o entorno local con Firebase emulado. |
| URL base | `https://ventanilla-simacota-git-<branch>.vercel.app` (no producción). |
| SMTP | Cuenta sandbox (Mailtrap, Ethereal, Mailpit o equivalente). **Prohibido** apuntar a un buzón real de ciudadano. |
| `EMAIL_PASS` | Marcado **Sensitive** en Vercel. |
| Datos | Radicados sintéticos con correos `@example.test` o equivalente. |

> Si Preview no tiene SMTP sandbox, abortar la UAT. Marcar como bloqueada y
> escalar a operaciones antes de continuar.

---

## 4. Precondiciones

| # | Precondición | Estado | Verificado por |
|---|---|:-:|---|
| P-1 | PR #18 (`feat/seguridad-h02-notificaciones`) desplegado en Preview. | ☐ | |
| P-2 | SMTP sandbox configurado en Preview; correos no salen a Internet. | ☐ | |
| P-3 | Variables `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` apuntan al sandbox. | ☐ | |
| P-4 | Usuarios UAT creados desde **Administración → Usuarios** y activos. | ☐ | |
| P-5 | Radicados UAT creados según la sección 6, archivados al cerrar. | ☐ | |
| P-6 | Sentry sin errores críticos en las últimas 24 h. | ☐ | |
| P-7 | Acceso de lectura a la consola Firestore del proyecto Preview. | ☐ | |

> Si algún P está ☐, no iniciar la matriz.

---

## 5. Usuarios UAT requeridos

| Rol | Email | Dependencia | Uso |
|---|---|---|---|
| `ADMIN` | `admin.uat@simacota.gov.co` | `VENTANILLA_UNICA` | H02-01 |
| `RECEPCIONISTA` | `recepcion.uat@simacota.gov.co` | `VENTANILLA_UNICA` | H02-02 |
| `FUNCIONARIO` (propio tenant) | `funcionario.gobierno.uat@simacota.gov.co` | `SEC_GOBIERNO` | H02-03, H02-20 |
| `FUNCIONARIO` (otro tenant) | `funcionario.planeacion.uat@simacota.gov.co` | `SEC_PLANEACION` | H02-04 |
| `JEFE_DEPENDENCIA` | `jefe.gobierno.uat@simacota.gov.co` | `SEC_GOBIERNO` | H02-06 |
| `CONTROL_INTERNO` | `controlinterno.uat@simacota.gov.co` | `VENTANILLA_UNICA` | H02-05 |

Todos con `activo: true`. Al cerrar la UAT, archivar (`archivado: true`) para
preservar auditoría.

---

## 6. Radicados UAT requeridos

| ID lógico | Características | Dependencia | Estado | Uso |
|---|---|---|---|---|
| R-IDENT | Identificado, correo `ciudadano.uat@example.test`, con `respuestaOficial.nota` y al menos una asignación. | `SEC_GOBIERNO` | RESUELTO | H02-01, H02-02, H02-03, H02-04, H02-12, H02-13, H02-14, H02-15, H02-16, H02-20 |
| R-ANON | Marcado `esAnonimo: true`, sin correo. | `SEC_GOBIERNO` | RESUELTO | H02-09 |
| R-RESERV | Marcado `identidadReservada: true` o `tipoPresentacion: 'RESERVADA'`. | `SEC_GOBIERNO` | RESUELTO | H02-10 |
| R-SIN-CORREO | Identificado pero `solicitante.email = ''` o inválido. | `SEC_GOBIERNO` | RESUELTO | H02-11 |
| R-SIN-RESPUESTA | Identificado con correo válido, **sin** `respuestaOficial.nota`. | `SEC_GOBIERNO` | EN_PROCESO | H02-11 (variante) |
| (sin ID) | Número con formato `1-WEB-2099-00099999` que no existe. | — | — | H02-08 |

> Ningún correo de prueba debe ser de un ciudadano real. Si el operador detecta
> un correo real en los datos, abortar y limpiar antes de continuar.

---

## 7. Matriz de casos

Leyenda: ✅ APROBADO · 🟡 APROBADO CON OBSERVACIÓN · ❌ FALLIDO · ⬜ PENDIENTE · 🚫 BLOQUEADO

| Caso | Rol / Sesión | Acción | Resultado esperado | Resultado obtenido | Evidencia | Estado | Obs. |
|---|---|---|---|---|---|:-:|---|
| H02-01 | ADMIN | `POST /api/interno/notificar-ciudadano` con `{radicadoId: R-IDENT, accion: 'RESPUESTA_OFICIAL'}`. | `200 {enviado:true}`. Llega correo al sandbox con asunto institucional y cuerpo del template. Auditoría `NOTIFICACION_CIUDADANO_AUTORIZADA` + `NOTIFICACION_CIUDADANO_ENVIADA`. Trazabilidad `NOTIFICACION_CORREO_ENVIADA`. | | | ⬜ | |
| H02-02 | RECEPCIONISTA | Igual que H02-01. | Igual que H02-01. | | | ⬜ | |
| H02-03 | FUNCIONARIO `SEC_GOBIERNO` | Igual sobre `R-IDENT` (su dependencia). | Igual que H02-01. | | | ⬜ | |
| H02-04 | FUNCIONARIO `SEC_PLANEACION` | Igual sobre `R-IDENT` (de `SEC_GOBIERNO`). | `403 {"error":"No tiene permiso para realizar esta acción."}`. Auditoría `DENEGADA` motivo `DEPENDENCIA_NO_AUTORIZADA`. **No** se envía correo. **No** hay trazabilidad de envío. | | | ⬜ | |
| H02-05 | CONTROL_INTERNO | Igual sobre `R-IDENT`. | `403`. Auditoría `DENEGADA` motivo `ROL_NO_AUTORIZADO`. **No** se envía correo. | | | ⬜ | |
| H02-06 | JEFE_DEPENDENCIA | Igual sobre `R-IDENT`. | `403`. Auditoría `DENEGADA` motivo `ROL_NO_AUTORIZADO`. **No** se envía correo. | | | ⬜ | |
| H02-07 | Sin sesión (cookie ausente o caducada) | Igual sobre `R-IDENT`. | `401 {"error":"Debe iniciar sesión nuevamente."}`. **No** se llega a registrar auditoría con `actorUid` real. **No** se envía correo. | | | ⬜ | |
| H02-08 | ADMIN | POST con `radicadoId: 1-WEB-2099-00099999`. | `404 {"error":"No fue posible localizar el radicado."}`. Auditoría `DENEGADA` motivo `RADICADO_NO_ENCONTRADO`. | | | ⬜ | |
| H02-09 | ADMIN | POST sobre `R-ANON`. | `400 {"error":"El radicado no cuenta con un correo válido para notificación."}`. Auditoría motivo `RADICADO_ANONIMO_O_RESERVADO`. **No** se envía correo. | | | ⬜ | |
| H02-10 | ADMIN | POST sobre `R-RESERV`. | Igual que H02-09 (mismo mensaje, mismo motivo en auditoría). | | | ⬜ | |
| H02-11 | ADMIN | POST sobre `R-SIN-CORREO` y luego sobre `R-SIN-RESPUESTA`. | `400`. Auditoría motivo `CORREO_INVALIDO` (primero) y `RESPUESTA_OFICIAL_NO_DISPONIBLE` (segundo). | | | ⬜ | |
| H02-12 | ADMIN | POST con `{radicadoId: R-IDENT, destinatario: "atacante@example.test"}`. | `403 {"error":"No tiene permiso para realizar esta acción."}`. Auditoría motivo `PAYLOAD_NO_PERMITIDO`. **No** se envía correo. El destinatario rechazado **no aparece** en auditoría ni en logs. | | | ⬜ | |
| H02-13 | ADMIN | Cinco POST separados, cada uno con uno de: `asunto`, `mensaje`, `html`, `nota`, `tenantId`. | Cada uno → `403` motivo `PAYLOAD_NO_PERMITIDO`. **No** se envía correo en ninguno. | | | ⬜ | |
| H02-14 | ADMIN | POST exitoso H02-01 (autorizado). | Inspeccionar el correo recibido en el sandbox: el header `To:` coincide con `R-IDENT.solicitante.email` normalizado en minúsculas. Ningún `To:` proviene del payload. | | | ⬜ | |
| H02-15 | ADMIN | POST exitoso H02-01. | Inspeccionar el correo: el asunto contiene `radicadoId`; el cuerpo es el template institucional; `Reply-To` = `DIRECTORIO_TENANTS[SEC_GOBIERNO].emailOficial`; la nota viene de `R-IDENT.respuestaOficial.nota`. Cuerpo y asunto **no** provienen de strings del cliente. | | | ⬜ | |
| H02-16 | ADMIN | Forzar fallo SMTP (cambiar `EMAIL_PASS` a inválido en Preview o derribar Mailpit) y ejecutar H02-01. | `500 {"error":"No fue posible enviar la notificación."}` sin host ni credenciales. Auditoría `NOTIFICACION_CIUDADANO_FALLIDA` motivo `SMTP_FALLIDO`. Trazabilidad `NOTIFICACION_CORREO_FALLIDA`. Doc del radicado queda con `alertaNotificacionFallida: true`. | | | ⬜ | |
| H02-17 | Inspector Firestore | Tras correr H02-01 a H02-16, revisar 5 documentos al azar de `seguridad_notificaciones_auditoria`. | Cada doc contiene sólo `tipo`, `actorUid`, `actorRol`, `actorTenant`, `radicadoId`, `motivo` (enum), `fecha`. **No** contiene correo del ciudadano, asunto, cuerpo, stack, host SMTP, IP, ni cookie. | | | ⬜ | |
| H02-18 | Inspector Firestore | Revisar subcolección `ventanilla_radicados/R-IDENT/trazabilidad` tras H02-01 y H02-16. | Eventos `NOTIFICACION_CORREO_ENVIADA` / `_FALLIDA` con `nota` institucional fija. `metadata` contiene `tipoNotificacion`, `estado`, `actorRol`, `dependencia`, `tieneArchivo`. **No** contiene destinatario, asunto, ni cuerpo HTML. | | | ⬜ | |
| H02-19 | DevTools | Revisar la respuesta HTTP cruda de los 4xx/5xx (H02-04, H02-05, H02-07, H02-08, H02-09, H02-12, H02-16). | Ningún body contiene stack trace, nombre del host SMTP, correo destino real, ni el `motivo` interno (los `motivo` van a auditoría, no al cliente). Headers incluyen `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`. | | | ⬜ | |
| H02-20 | CONTROL_INTERNO y FUNCIONARIO propio tenant | POST con `{radicadoId: R-IDENT, accion: 'REINTENTO_NOTIFICACION'}` desde cada rol. | CONTROL_INTERNO → `403` motivo `ROL_NO_AUTORIZADO`. FUNCIONARIO propio tenant → `200 {enviado:true}`. La autorización se aplica igual al reintento. | | | ⬜ | |

---

## 8. Casos adicionales sugeridos (no obligatorios para firmar)

Útiles si el equipo UAT tiene tiempo, derivados del código actual:

- POST con body no-JSON o array → `400 {"error":"Solicitud inválida."}` motivo `PAYLOAD_INVALIDO`.
- POST sin `radicadoId` → `400` motivo `RADICADO_ID_REQUERIDO`.
- POST con `accion: 'CUALQUIER_OTRA'` → `400` motivo `ACCION_NO_PERMITIDA`.
- Usuario con `activo: false` (desactivado por Admin) intenta notificar → `403` motivo `USUARIO_INACTIVO`.

---

## 9. Evidencias requeridas

Por cada caso de la matriz, recolectar y archivar:

- usuario/rol y email usado;
- radicado de prueba (ID lógico y `radicadoId` real);
- acción ejecutada (curl o flujo UI);
- resultado esperado vs. obtenido;
- captura del response HTTP (status + headers + body, sin PII real);
- para H02-14 y H02-15: captura del correo recibido en el sandbox (asunto, To, Reply-To, fragmento del cuerpo);
- para H02-17, H02-18: captura del doc de Firestore correspondiente;
- para H02-16: captura de Sentry o log del operador con stack interno (sólo el operador lo ve, no el cliente);
- aprobado / no aprobado;
- observación.

Adjuntar como anexo a este documento o en carpeta segura referenciada por enlace
en la sección 10.

---

## 10. Criterio de aprobación

Para marcar H-02 como **✅ Corregido — UAT aprobada** se requieren simultáneamente:

1. **20/20** casos de la matriz en estado ✅ o 🟡 (no quedan ❌ ni ⬜).
2. Las observaciones 🟡 documentadas y aceptadas por Seguridad técnico.
3. Las tres firmas de la sección 11.
4. Evidencias archivadas y referenciadas.
5. Confirmación de que ningún correo salió a un ciudadano real durante la UAT.

Si cualquier caso queda ❌, **no marcar H-02 como cerrado**. Reportar caso,
evidencia, endpoint y recomendación; abrir tarea correctiva antes de re-UAT.

---

## 11. Firmas

### Responsable técnico / seguridad

- Nombre:
- Cargo:
- Firma:
- Fecha:

### Responsable funcional Ventanilla Única

- Nombre:
- Cargo:
- Firma:
- Fecha:

### Responsable UAT / supervisor

- Nombre:
- Cargo:
- Firma:
- Fecha:

---

## 12. Cierre administrativo

Cuando los tres roles firmen, actualizar en el mismo commit documental:

- `docs/SEGURIDAD_HOTFIXES.md` — bloque H-02 a `✅ Corregido — UAT aprobada`
  con fecha, ambiente Preview, commit `c65ed36` (PR #18) y resumen de casos.
- `docs/AUDITORIA_SEGURIDAD_DATOS_ESCALABILIDAD.md` — filas H-02 en Resumen,
  Parte 18 y Parte 20.

No modificar código de negocio en ese commit. La rama sugerida es
`docs/uat-h02-notificacion-ciudadano`.
