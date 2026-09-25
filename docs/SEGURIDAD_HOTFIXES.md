# Bitácora de hotfixes de seguridad

Este documento registra las correcciones aplicadas a los hallazgos del informe
[Auditoría integral](AUDITORIA_SEGURIDAD_DATOS_ESCALABILIDAD.md). Sirve como
historial vivo del avance hacia el go-live.

## Estado general (actualizado tras PRs #30, #31, #32)

Tabla de avance real al momento de esta actualización. **Implementado
técnicamente** significa que el código está en `main` y verificado por tests
automatizados; **no equivale a aprobación institucional** ni cierra el go-live
por sí solo.

| Hallazgo | Código en `main` | Validación humana | Estado bitácora |
|---|:-:|---|---|
| H-01 | ✅ PR #16 | ✅ aceptado en auditoría | ✅ Corregido |
| H-02 | ✅ PR #18 | ⏳ matriz publicada, sin ejecutar | 🟡 Pendiente UAT |
| H-03 | ✅ PR #17 | ⏳ matriz publicada, sin ejecutar | 🟡 Pendiente UAT |
| H-04 | ✅ PR #19 | ⏳ matriz publicada, sin ejecutar | 🟡 Pendiente UAT |
| H-05 | ✅ PR #19 | ⏳ matriz publicada, sin ejecutar | 🟡 Pendiente UAT |
| H-07 | ✅ PR #19 (CSP Report-Only) | ⏳ matriz + observación 7 días | 🟡 Pendiente UAT + Enforce |
| H-08 | ✅ PR #32 | ⏳ tests automatizados; sin UAT manual | 🟠 Implementado técnicamente |
| H-10 | ✅ PR #30 | ✅ tests automatizados | 🟠 Implementado técnicamente |
| H-11 | ✅ PR #31 (v1 + v2.2) | ✅ tests automatizados | 🟠 Implementado técnicamente; pendiente DPA institucional |

> **Nota institucional.** La plataforma está lista para uso interno y UAT en
> Preview, pero **NO queda autorizada aún para go-live ciudadano masivo** hasta
> cerrar:
>
> - UAT firmadas por los tres roles (Seguridad técnico, Ventanilla Única,
>   Responsable UAT) de las matrices H-02, H-03 y H-04/H-05/H-07.
> - Verificación de **SPF / DKIM / DMARC** del dominio
>   `simacota-santander.gov.co` con mxtoolbox.
> - Publicación de la **Política de Tratamiento de Datos** declarando uso de
>   IA (Gemini) y nube (Firebase, Vercel), enlazada desde `/radicacion`.
> - **Observación CSP Report-Only ≥ 7 días sin violaciones** y promoción a
>   `Content-Security-Policy` (Enforce).

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

---

## H-08 — Validación de adjuntos por firma real

**Estado:** 🟠 Implementado técnicamente en `main` — pendiente UAT manual.
**Severidad original:** P2 — Medio.
**Referencia:** PR #32 (commit `e304c81`), rama `fix/seguridad-h08-magic-bytes`.
**Archivos:**
- `lib/seguridad/magic-bytes.ts` *(nuevo, helper puro)*
- `__tests__/magic-bytes.test.ts` *(nuevo, 15 tests)*
- `app/api/radicacion/route.ts` *(integración del verificador y allowlist ampliada)*
- `app/radicacion/page.tsx` *(selector permite `.docx` y `.xlsx`)*

### Qué se hizo

Se reforzó la validación de archivos en la radicación pública. El control
anterior dependía únicamente del `Content-Type` declarado por el navegador,
trivialmente falsificable.

Controles agregados:

1. **PDF / JPG / PNG** se validan por firma de prefijo:
   `%PDF-`, `FFD8FF`, `89504E470D0A1A0A`.
2. **DOCX / XLSX** se validan por estructura interna del contenedor ZIP:
   - Firma `PK\x03\x04` al inicio.
   - Entrada `[Content_Types].xml` presente.
   - Al menos una entrada bajo `word/` (DOCX) o `xl/` (XLSX).
   - **Ausencia** de `vbaProject.bin` (rechaza DOCM/XLSM disfrazados).
3. Lista de tipos permitidos ampliada explícitamente a 5 MIMEs concretos.
4. Selector `<input accept="...">` actualizado para permitir `.docx,.xlsx`.

### Tipos rechazados

`DOC`, `XLS` (formatos OLE legacy), `DOCM`, `XLSM` (macros), `ZIP` genérico,
`RAR`, `EXE`, `HTML`, `JS`, cualquier binario con `Content-Type` falsificado.

### Decisiones de scope

- **Sin antivirus** todavía. Solo magic bytes y estructura.
- **Sin dependencias externas** (no se agregó `jszip` ni `adm-zip`). Parseo
  manual de local headers, acotado a 500 entradas escaneadas por archivo.
- Solo radicación pública. Endpoints internos de respuesta (subidas por
  funcionarios autenticados) quedan **fuera del scope inicial**.
- Sin cambios en `storage.rules`. El flujo público va por Admin SDK que ignora
  reglas; las reglas son defensa-en-profundidad para uploads cliente→Storage
  directos que hoy no existen.

### Tests

15 tests automatizados (`__tests__/magic-bytes.test.ts`):

- 7 de formatos simples: PDF/JPG/PNG válidos, mismatch tipo vs. contenido,
  buffer vacío, tipos no soportados.
- 8 de DOCX/XLSX: válidos sintéticos, rechazo de `vbaProject.bin`, ZIP sin
  estructura Office, ZIP sin `[Content_Types].xml`, no-ZIP declarado como
  DOCX, lista de 5 tipos permitidos.

Helper de fixtures ZIP (`buildZipConFiles`) sin dependencias externas.

### Pendiente

Este hallazgo solo debe pasar a ✅ Corregido después de:

- UAT manual del flujo de radicación pública con archivos reales:
  - PDF, JPG, PNG legítimos → aceptados.
  - DOCX, XLSX legítimos → aceptados.
  - Archivos disfrazados (binario renombrado, DOCM disfrazado de DOCX) →
    rechazados con mensaje uniforme.
- Decisión institucional sobre fase 2 (antivirus, endpoints internos de
  respuesta, actualización de `storage.rules` si se habilita upload directo
  cliente→Storage).

---

## H-10 — Reglas Firestore: Jefe de Dependencia restringido por tenant

**Estado:** 🟠 Implementado técnicamente en `main` — cubierto por tests
unitarios. Pendiente registro formal post-revisión.
**Severidad original:** P2 — Medio.
**Referencia:** PR #30 (commit `724bd16`), rama `fix/seguridad-h10-jefe-tenant`.
**Archivos:**
- `firestore.rules` (3 líneas modificadas + comentario preventivo)
- `lib/control-interno/permisos.ts` *(función nueva `puedeLeerRegistroControlInternoEnTenant`)*
- `__tests__/control-interno-riesgos.test.ts` *(5 tests nuevos)*

### Qué se hizo

Se cerró la brecha de lectura cross-tenant en las colecciones
`control_interno_hallazgos` y `control_interno_planes_mejora`. La regla
anterior permitía a cualquier `JEFE_DEPENDENCIA` leer registros de **todas**
las dependencias mediante SDK directo, aunque las APIs server-side sí
filtraban correctamente.

Reglas nuevas:

| Rol | `control_interno_hallazgos` | `control_interno_planes_mejora` |
|---|---|---|
| `ADMIN` | Global | Global |
| `CONTROL_INTERNO` | Global | Global |
| `JEFE_DEPENDENCIA` | Solo si `resource.data.tenantId == userTenant()` | Solo si `resource.data.tenantId == userTenant()` |
| `FUNCIONARIO` | (sin acceso) | Solo si `tenantId == userTenant()` |
| Otros / no autenticados | Denegado | Denegado |

Escrituras siguen cerradas (`allow create, update, delete: if false`). Las
mutaciones reales pasan por Admin SDK server-side que valida rol y tenant.

### Comentario preventivo en la regla

Se agregó en `firestore.rules` una advertencia: si en el futuro alguien
consulta estas colecciones desde cliente como `JEFE_DEPENDENCIA` o
`FUNCIONARIO`, la query debe incluir `.where('tenantId', '==', userTenant)`,
porque Firestore evalúa `list` por documento y rechaza la consulta entera si
no se prueba la condición.

### Tests

5 tests nuevos en `__tests__/control-interno-riesgos.test.ts`:

1. ADMIN y CONTROL_INTERNO mantienen lectura global (regression guard).
2. JEFE_DEPENDENCIA: positivo en su tenant, negativo cross-tenant.
3. FUNCIONARIO: positivo en su tenant, negativo cross-tenant.
4. Defensivo: `null/undefined` en tenant → niega.
5. RECEPCIONISTA no lee estas colecciones.

Los tests prueban la **función de aplicación** que espeja la regla. Para
probar las reglas directamente se requeriría infraestructura
`@firebase/rules-unit-testing` + Firebase emulator que el proyecto no tiene
todavía. Esa infraestructura queda como **deuda separada**, no bloqueante.

### Riesgo de regresión

Verificado con `grep`: ninguna capa cliente lee estas colecciones
directamente desde Firestore. Todas las lecturas pasan por Admin SDK
server-side. Cambio más restrictivo, no más permisivo. Cero regresión
esperada.

### Pendiente

- Para promoción a ✅ Corregido se sugiere observación 1-2 semanas en
  producción sin reporte de falsos negativos por parte de jefes legítimos.
- Implementación futura de `@firebase/rules-unit-testing` para test directo
  de la regla (deuda separada).

---

## H-11 — Minimización de PII enviada a SIMI/Gemini

**Estado:** 🟠 Implementado técnicamente en `main` (v1 + v2.2) — pendiente
complemento institucional DPA con Google y Política de Tratamiento de Datos.
**Severidad original:** P2 — Medio.
**Referencia:** PR #31 (commit `95d15a1`), rama `fix/seguridad-h11-pii-simi`.
**Archivos:**
- `lib/seguridad/sanitizar-pii.ts` *(nuevo, helper puro)*
- `__tests__/sanitizar-pii.test.ts` *(nuevo, 10 tests)*
- `lib/simi/contexto-radicado.ts` *(ediciones quirúrgicas en 4 puntos)*
- `__tests__/simi-confiable.test.ts` *(3 tests nuevos + 1 modificado)*

### Qué se hizo

**v1 — Omitir identidad directa del solicitante** (auditoría Parte 7).
Para radicados identificados, el `bloqueTexto` que va al prompt de Gemini ya
**no** incluye `solicitante.nombreCompleto` ni `solicitante.email`. En su
lugar indica que existe una persona identificada y, si hay correo, declara
"Canal de respuesta: correo electrónico registrado." sin exponer el valor.

**v2.2 — Sanitización de PII en textos libres.** Se agregó
`sanitizarPiiTextoSimi` que reemplaza patrones de alta confianza por
placeholders neutros antes de enviarlos a Gemini:

| Patrón | Reemplazo | Aplicado a |
|---|---|---|
| Correos electrónicos | `[CORREO]` | `asunto`, `descripcion`, `respuestaOficial.nota`, `trazabilidad.nota` |
| Móviles colombianos (10 dígitos por 3, ±`+57`) | `[TELEFONO]` | igual |
| Documentos con prefijo (CC, TI, NIT, cédula, ...) + dígitos | `<prefijo> [DOCUMENTO]` | igual |

### Lo que NO se sanitiza (decisión consciente)

- Números sin prefijo (riesgo de comer años, montos, códigos de radicado).
- Teléfonos fijos (formato ambiguo).
- Nombres propios y direcciones (requiere NER, fuera de scope).

Trade-off: preferimos falsos negativos (algo de PII se cuela) sobre falsos
positivos (texto del ciudadano destruido).

### Lo que NO cambia

- `meta.asunto`, `meta.descripcionResumen` y `trazabilidadResumida` siguen
  conteniendo el texto **original sin sanitizar** — la UI interna y la
  auditoría preservan los datos completos para que el funcionario pueda ver
  lo que realmente escribió el ciudadano.
- Casos anónimos y reservados: el placeholder genérico existente se mantiene
  (tests previos siguen verdes).

### Tests

13 tests nuevos:

- 10 unitarios del helper (`__tests__/sanitizar-pii.test.ts`): correos
  comunes, no toca `@usuario` sin TLD, móviles con separadores y `+57`,
  no toca radicados ni años ni montos, documentos con prefijo, no toca
  números bare sin prefijo, combinaciones multi-PII, idempotencia,
  null/undefined/vacío.
- 3 de integración (`__tests__/simi-confiable.test.ts`): sanitización en
  descripción, sanitización en respuesta oficial + trazabilidad, `meta`
  no está sanitizada.

### Pendiente institucional

- **DPA con Google** que cubra el procesamiento de PII residual vía Gemini.
  La sanitización reduce el riesgo pero no lo elimina: el texto del
  ciudadano (descripción del PQRSD) sigue viajando al modelo y puede
  contener datos personales que la sanitización no detecta (nombres
  propios, direcciones, contextos específicos).
- **Declaración explícita** en la Política de Tratamiento de Datos del uso
  de IA y procesamiento por terceros.

Hasta que estos dos puntos institucionales se cierren, este hallazgo se
considera **implementado técnicamente** pero **no cerrado**.
