# Bitácora de hotfixes de seguridad

Este documento registra las correcciones aplicadas a los hallazgos del informe
[Auditoría integral](AUDITORIA_SEGURIDAD_DATOS_ESCALABILIDAD.md). Sirve como
historial vivo del avance hacia el go-live.

---

## H-04, H-05 y H-07 — Hardening de producción

**Estado:** 🟡 Implementado — pendiente Preview/UAT de hardening.
**Severidad original:** P2 — Medio.
**Archivos:**
- `app/api/ai/log/route.ts` *(reescrito)*
- `lib/seguridad/ai-log-seguro.ts` *(nuevo, helper puro)*
- `lib/seguridad/autorizar-cron.ts` *(nuevo, helper puro)*
- `app/api/cron/alertas-vencimiento/route.ts`
- `app/api/cron/simi/alertas-vencimiento/route.ts`
- `next.config.ts`
- `.env.example`
- `__tests__/hardening-produccion.test.ts` *(nuevo)*

### H-04 — `/api/ai/log` protegido

El endpoint dejó de ser una escritura pública a Firestore.

Controles implementados:

1. Exige sesión interna activa con `requireActiveInternalUser()`.
2. Solo permite `ADMIN` y `CONTROL_INTERNO`.
3. Aplica rate limit por UID.
4. Lee el cuerpo como texto y rechaza payloads mayores a 4 KB.
5. Rechaza campos desconocidos.
6. Acepta solo telemetría acotada: `radicadoId`, `endpoint`, `latenciaMs`,
   `error`/`errorCode`, `fallbackActivo` y `promptVersion`.
7. No persiste correo, documento, teléfono, dirección, token, prompt completo
   ni mensaje de error crudo.
8. Convierte errores a `errorPresente` + `errorCategoria`.
9. Registra denegados en `seguridad_ai_log_auditoria` sin PII.
10. Devuelve errores genéricos sin stack ni detalles de Firestore.

Los flujos normales de IA ya registran telemetría server-side mediante
`lib/ai/telemetry.ts`; por eso no se requiere escritura pública desde el
navegador.

### H-05 — Cron fail-closed

Se creó `lib/seguridad/autorizar-cron.ts` y todos los endpoints bajo
`app/api/cron/**` lo usan.

Comportamiento:

| Caso | Respuesta | Ejecuta tarea |
|------|-----------|---------------|
| `CRON_SECRET` ausente | `503 Servicio no disponible.` | No |
| Sin `Authorization` | `401 No autorizado.` | No |
| Formato no Bearer | `401 No autorizado.` | No |
| Token incorrecto | `401 No autorizado.` | No |
| `Authorization: Bearer <CRON_SECRET>` correcto | `200` si el job completa | Sí |

La comparación usa `timingSafeEqual` y los logs solo registran el motivo, nunca
el secreto ni el token recibido. `.env.example` incluye únicamente el
placeholder `CRON_SECRET=CAMBIAR_POR_SECRETO_SEGURO`.

### H-07 — Cabeceras de seguridad

Se configuró `headers()` en `next.config.ts` y se desactivó
`poweredByHeader`.

Cabeceras añadidas:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy-Report-Only`

La CSP se deja inicialmente en modo **Report-Only** para validar Preview sin
romper login, Firebase Auth/Firestore/Storage, Gemini, Sentry, imágenes locales
o assets de Next.js. Después de validar Preview puede promoverse a
`Content-Security-Policy`.

### Pendiente Preview/UAT

- Verificar cabeceras con `curl -I` en Preview para `/`, `/consulta` e
  `/interno/login`.
- Verificar que login Firebase, carga de dashboard, SIMI y Sentry no generen
  violaciones críticas de CSP.
- Verificar cron sin token, con token incorrecto y con `CRON_SECRET` ausente.
- No ejecutar cron real contra datos productivos durante pruebas.

---

## H-02 — Notificación al ciudadano protegida por rol y dependencia

**Estado:** 🟡 Implementado — pendiente aprobación UAT de Seguridad P1-02.
**Severidad original:** P1 — Alto.
**Archivos:**
- `lib/seguridad/autorizar-notificacion-ciudadano.ts` *(nuevo, helper puro)*
- `app/api/interno/notificar-ciudadano/route.ts` *(reescrito)*
- `lib/acciones/resolver-radicado.ts` *(cliente interno ajustado)*
- `__tests__/autorizar-notificacion-ciudadano.test.ts` *(nuevo)*

### Qué se hizo

Se eliminó el comportamiento de relay de correo arbitrario. El endpoint interno
ya no acepta destinatario, asunto, HTML, mensaje, nombre ciudadano, dependencia
ni contenido libre desde el cliente.

Flujo seguro aplicado por `POST /api/interno/notificar-ciudadano`:

1. Valida sesión interna activa mediante `requireActiveInternalUser()`
   incluyendo revocación, perfil registrado y usuario no archivado/inactivo.
2. Acepta únicamente `radicadoId` y una acción cerrada:
   `RESPUESTA_OFICIAL` o `REINTENTO_NOTIFICACION`.
3. Rechaza cualquier intento de enviar `emailCiudadano`, `correo`,
   `destinatario`, `asunto`, `mensaje`, `html`, `nota`, `tenantId` u otros
   campos libres equivalentes.
4. Carga el radicado desde `ventanilla_radicados/{radicadoId}`.
5. Autoriza por rol y dependencia:
   - `ADMIN` y `RECEPCIONISTA` → acceso global.
   - `FUNCIONARIO` → solo si
     `usuario.tenantId === radicado.clasificacion.oficinaDestino`.
   - `CONTROL_INTERNO`, `JEFE_DEPENDENCIA` y roles desconocidos → bloqueados.
6. Toma el correo desde `radicado.solicitante.email`.
7. Bloquea radicados anónimos, reservados o sin correo válido.
8. Construye asunto y HTML con templates institucionales desde datos del
   radicado (`respuestaOficial`, `detalle`, `clasificacion`).
9. Registra auditoría de seguridad sin PII.
10. Registra trazabilidad de envío/falla sin correo ni contenido completo del
    mensaje.

### Respuestas humanas y seguras

| Código | Cuándo | Mensaje |
|--------|--------|---------|
| `400` | Payload inválido, radicado anónimo/reservado, correo inválido o sin respuesta oficial notificable | `Solicitud inválida.` / `El radicado no cuenta con un correo válido para notificación.` |
| `401` | Sin sesión o sesión expirada | `Debe iniciar sesión nuevamente.` |
| `403` | Rol no autorizado, usuario inactivo/archivado, funcionario de otra dependencia o payload con campos libres | `No tiene permiso para realizar esta acción.` |
| `404` | Radicado inexistente | `No fue posible localizar el radicado.` |
| `500` | Falla SMTP o interna de envío | `No fue posible enviar la notificación.` |

Nunca se devuelve: correo destino, contenido del email, configuración SMTP,
stack trace, dependencia interna desconocida ni credenciales.

### Auditoría / trazabilidad

Auditoría de seguridad en `seguridad_notificaciones_auditoria`:

- `NOTIFICACION_CIUDADANO_AUTORIZADA`
- `NOTIFICACION_CIUDADANO_DENEGADA`
- `NOTIFICACION_CIUDADANO_ENVIADA`
- `NOTIFICACION_CIUDADANO_FALLIDA`

Campos permitidos:

- `actorUid`
- `actorRol`
- `actorTenant`
- `radicadoId`
- `motivo`
- `fecha`

La trazabilidad del radicado mantiene `NOTIFICACION_CORREO_ENVIADA` /
`NOTIFICACION_CORREO_FALLIDA`, pero la nueva ruta no guarda destinatario ni
contenido completo del correo.

### Tests

`__tests__/autorizar-notificacion-ciudadano.test.ts` cubre la matriz exigida:

1. ADMIN puede notificar cualquier radicado.
2. RECEPCIONISTA puede notificar cualquier radicado.
3. FUNCIONARIO puede notificar su dependencia.
4. FUNCIONARIO no puede notificar otra dependencia.
5. CONTROL_INTERNO recibe 403.
6. JEFE_DEPENDENCIA recibe 403.
7. Usuario sin sesión recibe 401.
8. Usuario inactivo recibe 403.
9. Radicado inexistente recibe respuesta segura.
10. Radicado anónimo no genera correo.
11. Radicado reservado no genera correo desde este endpoint.
12. Correo inválido no genera envío ni filtra el dato.
13. Destinatario libre del cliente se rechaza.
14. Contenido libre del cliente se rechaza.
15. Solo se aceptan acciones cerradas.

### Pendiente UAT

Este hallazgo solo debe pasar a ✅ Corregido después de aprobar UAT manual con
cuentas reales de `ADMIN`, `RECEPCIONISTA`, `FUNCIONARIO`,
`CONTROL_INTERNO` y `JEFE_DEPENDENCIA`, validando además un fallo SMTP
controlado en ambiente de pruebas.

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

---

## H-03 — Consulta pública protegida

**Estado:** 🟡 Implementado — pendiente aprobación UAT de Seguridad P1-03.
**Severidad original:** P1 — Alto.

### Inventario y flujo anterior

| Componente | Flujo anterior | Riesgo encontrado | Flujo seguro |
|---|---|---|---|
| `/consulta` | Enviaba solo el número a `GET /api/consulta/[id]` y hacía búsqueda automática desde `?id=` | Enumeración directa | Solicita número + dato de verificación y usa POST |
| `GET /api/consulta/[radicadoId]` | Devolvía estado, dependencia, trazabilidad y respuesta sin segundo factor ni límite | IDOR público enumerable | Retirado con `410 Gone` y `Cache-Control: no-store` |
| `GET /api/public/radicado/consulta` | Verificación documental opcional en query string y límite en memoria | Confirmaba existencia y filtraba el dato por URL | GET responde `405`; POST es la única ruta canónica |
| Constancia y enlaces | Incluían `/consulta?id={radicado}` | El número precargado disparaba la consulta | Solo precargan el número; nunca el dato de verificación |
| E2E SIMI | Consultaba el GET heredado | Conservaba una dependencia insegura | Usa POST canónico con segundo factor |
| PDF de firma | Aceptaba radicado/verificación en URL y permitía anónimos/reservados sin segundo factor | Fuga por URL y bypass alternativo | Acceso público directo cerrado; solo sesión interna autorizada |

El canal web almacena correo cuando el ciudadano lo registra, pero hoy no
captura documento (`numeroDocumento` queda vacío). Por eso el correo es el
método normal para solicitudes identificadas del portal. Los radicados creados
por otros canales pueden usar los últimos cuatro dígitos cuando exista un
documento válido.

### Controles implementados

- Verificación obligatoria y centralizada en
  `lib/seguridad/consulta-publica-radicado.ts`.
- Correo normalizado (`trim` + minúsculas), documento por últimos cuatro
  dígitos y código de consulta mediante SHA-256/comparación constante.
- Nuevas solicitudes sin correo —incluidas las anónimas— reciben un código
  aleatorio de 256 bits una sola vez; Firestore guarda únicamente
  `consultaTokenHash`.
- Respuesta pública construida por lista positiva. Nunca propaga PII, UIDs,
  rutas de Storage, adjuntos, comentarios internos ni auditoría privada.
- Anónimos y reservados omiten además la dependencia en la respuesta pública.
- Mensaje y código uniformes para formato inválido, inexistente, dato erróneo o
  expediente sin método de verificación.
- Rate limit compartido en `seguridad_rate_limits`: IP/minuto, radicado/hora,
  combinación IP+radicado y bloqueo progresivo por fallos. IP y radicado se
  guardan solo como HMAC SHA-256. El respaldo local se usa únicamente si falla
  el contador compartido.
- Auditoría agregada por ventanas de cinco minutos en
  `seguridad_consultas_auditoria`, sin correo, documento, token, IP completa ni
  contenido del expediente.
- `Cache-Control: no-store, no-cache, must-revalidate` y `Pragma: no-cache` en
  todas las respuestas de consulta.

### Compatibilidad

| Tipo de radicado | Método de verificación | Consulta pública | Acción |
|---|---|---:|---|
| Identificado con correo | Correo exacto normalizado | Sí | Sin migración |
| Identificado con documento válido | Últimos 4 dígitos | Sí | Sin migración |
| Identificado sin correo/documento, nuevo | Código aleatorio | Sí | Hash generado al radicar |
| Anónimo nuevo | Código aleatorio | Sí | Mostrar código una sola vez en constancia |
| Anónimo histórico sin código | Ninguno confiable | No | Orientar a Ventanilla Única; sin bypass |
| Legacy `EXT-*` | No normalizado | No | Orientar a Ventanilla Única hasta migración aprobada |
| Reservado | Correo/documento/código disponible | Sí, sanitizada | Ocultar identidad y dependencia |

No se modifican datos históricos. Cualquier migración futura exige script,
`dry run`, respaldo y aprobación explícita.

### Operación

Los límites se configuran mediante `CONSULTA_RATE_IP_MINUTO`,
`CONSULTA_RATE_RADICADO_HORA`, `CONSULTA_RATE_COMBINACION_MINUTO`,
`CONSULTA_RATE_FALLOS_RADICADO` y `CONSULTA_RATE_BLOQUEO_MINUTOS`.
`CONSULTA_HASH_SECRET` es recomendado; si no existe, el servidor utiliza la
credencial Firebase ya configurada como clave HMAC sin exponerla.

Configurar políticas TTL de Firestore sobre `expiresAt` para
`seguridad_rate_limits` y `seguridad_consultas_auditoria`. El código ya escribe
la fecha de expiración, pero la activación de TTL es una operación de
infraestructura y no debe ejecutarse automáticamente desde la aplicación.

La guía manual está en `docs/UAT_SEGURIDAD_H03_CONSULTA_PUBLICA.md`. Este
hallazgo solo debe pasar a ✅ Corregido después de aprobarla.

### Validación técnica ejecutada

- `npx tsc --noEmit`: aprobado.
- `npm run lint`: aprobado.
- `npm run test`: 19 archivos y 235 pruebas aprobadas.
- Pruebas específicas H-03 y sanitización: 34 aprobadas.
- `npm run build`: aprobado con Next.js 16.2.6.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- Revisión responsive: escritorio y 390 px sin desbordamiento horizontal; el
  dato de verificación no aparece en URL ni en logs del navegador.
- Búsqueda de secretos: solo variables/placeholders documentales ya existentes;
  no se añadieron credenciales.
